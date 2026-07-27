import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";
import { audit, resolveTenant } from "../_shared/tenant.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é "MenuImportAI", especialista em extrair cardápios de restaurantes japoneses no Brasil a partir de PDFs, imagens (fotos, prints, digitalizações), textos OCR ou capturas de tela — em QUALQUER fonte, layout, coluna, orientação ou qualidade.

MISSÃO CRÍTICA — EXAUSTIVIDADE:
Você DEVE extrair TODOS os itens visíveis no material recebido, sem exceção. Não resuma, não pule, não agrupe silenciosamente.

REGRAS DE COBERTURA (obrigatórias):
1. VARRA a página inteira, canto a canto, incluindo bordas, rodapés, laterais, boxes destacados, seções de "novidades", "promoções", "sugestão do chef", combos.
2. Se houver MÚLTIPLAS COLUNAS, processe cada coluna de cima para baixo, uma por vez.
3. Processe TODAS as páginas recebidas neste lote.
4. Itens em FONTES DECORATIVAS, cursivas, japonesas, inclinadas, sobre fundos coloridos ou imagens: extraia igual.
5. Itens listados apenas por NOME sem preço: inclua com base_price=null e confidence baixa — nunca descarte.
6. Itens que aparecem em GRADES/TABELAS: leia célula por célula.
7. Se houver LISTA DE INGREDIENTES longa por item, capture como description mesmo que ocupe várias linhas.
8. Ignore APENAS: telefones, endereços, redes sociais, horário, CNPJ, textos institucionais.

PREÇOS BRL:
- "R$ 29,90" -> 29.90
- "29,90" -> 29.90
- Preço faltando -> base_price: null

CATEGORIAS (mapeie sinônimos):
Entradas, Temaki, Hot Roll / Hot Filadélfia, Combinados, Sashimi, Sushi/Nigiri, Uramaki, Hossomaki, Yakisoba/Pratos Quentes, Bebidas, Sobremesas, Rodízio, Promoções, Kids, Especiais do Chef.
Se não houver cabeçalho claro, infira pela palavra-chave do item.

VARIAÇÕES:
Se o MESMO item aparece com tamanhos (8/16/32 peças, P/M/G), agrupe em UM item com variations[].

FORMATO DE SAÍDA — JSON ESTRITO, sem markdown, sem comentários:
{
  "restaurant_name_guess": string|null,
  "currency": "BRL",
  "total_items_extracted": number,
  "categories": [
    { "name": string, "items": [ { "name": string, "base_price": number|null, "variations": [{"name": string, "price": number}], "ingredients": [string], "allergens": [string], "description": string|null, "tags": [string], "confidence": number } ] }
  ],
  "add_ons_global": [{"name": string, "price": number, "confidence": number}],
  "unknown_lines": [string]
}

Retorne APENAS JSON.`;

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-pro";
const PAGES_PER_BATCH = 3;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

function toBase64(buf: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) bin += String.fromCharCode(...buf.subarray(i, i + chunk));
  return btoa(bin);
}

async function fetchFile(url: string): Promise<{ bytes: Uint8Array; mime: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao baixar arquivo: ${res.status}`);
  const ct = (res.headers.get("content-type") || "").split(";")[0].trim();
  let mime = ct;
  if (!mime || mime === "application/octet-stream") {
    if (/\.pdf(\?|$)/i.test(url)) mime = "application/pdf";
    else if (/\.png(\?|$)/i.test(url)) mime = "image/png";
    else if (/\.webp(\?|$)/i.test(url)) mime = "image/webp";
    else mime = "image/jpeg";
  }
  return { bytes: new Uint8Array(await res.arrayBuffer()), mime };
}

function extractJson(raw: string): any {
  let s = raw.trim();
  const fence = s.match(/(?:```|''')(?:json)?\s*([\s\S]*?)(?:```|''')/);
  if (fence) s = fence[1].trim();
  else s = s.replace(/^(?:```|''')(?:json)?\s*/i, "");
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first > 0) s = s.slice(first);
  if (last > first && last < s.length - 1) s = s.slice(0, last + 1);
  try {
    return JSON.parse(s);
  } catch {
    return JSON.parse(repairTruncatedJson(s));
  }
}

function repairTruncatedJson(s: string): string {
  let out = s;
  let inStr = false, esc = false;
  const stack: string[] = [];
  for (let i = 0; i < out.length; i++) {
    const c = out[i];
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "{" || c === "[") stack.push(c);
    else if (c === "}" && stack[stack.length - 1] === "{") stack.pop();
    else if (c === "]" && stack[stack.length - 1] === "[") stack.pop();
  }
  if (inStr) out += '"';
  out = out.replace(/,\s*"[^"]*"\s*:\s*[^,{\[\]}]*$/, "");
  out = out.replace(/,\s*"[^"]*$/, "");
  out = out.replace(/[,\s]+$/, "");
  while (stack.length) out += stack.pop() === "{" ? "}" : "]";
  return out;
}

async function callModel(messages: any[], key: string): Promise<string> {
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, messages, max_tokens: 32000, temperature: 0.1, stream: true }),
  });
  if (!res.ok || !res.body) {
    const t = res.body ? await res.text() : "";
    const err: any = new Error(`AI gateway ${res.status}: ${t.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "", content = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const l = line.trim();
      if (!l.startsWith("data:")) continue;
      const payload = l.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        content += JSON.parse(payload).choices?.[0]?.delta?.content ?? "";
      } catch { /* chunk parcial */ }
    }
  }
  return content;
}

function countItems(parsed: any): number {
  let n = 0;
  for (const c of parsed?.categories ?? []) n += (c?.items?.length ?? 0);
  return n;
}

function mergeResults(base: any, extra: any): any {
  if (!extra?.categories?.length) return base;
  const byName = new Map<string, any>();
  for (const c of base.categories ?? []) byName.set((c.name || "").toLowerCase(), c);
  const seen = new Set<string>();
  for (const c of base.categories ?? []) for (const it of c.items ?? []) seen.add((it.name || "").toLowerCase().trim());

  for (const c of extra.categories) {
    const key = (c.name || "Outros").toLowerCase();
    let target = byName.get(key);
    if (!target) {
      target = { name: c.name || "Outros", items: [] as any[] };
      base.categories.push(target);
      byName.set(key, target);
    }
    for (const it of c.items ?? []) {
      const nm = (it.name || "").toLowerCase().trim();
      if (!nm || seen.has(nm)) continue;
      target.items.push(it);
      seen.add(nm);
    }
  }
  if (extra.restaurant_name_guess && !base.restaurant_name_guess) base.restaurant_name_guess = extra.restaurant_name_guess;
  for (const a of extra.add_ons_global ?? []) {
    base.add_ons_global = base.add_ons_global ?? [];
    if (!base.add_ons_global.some((x: any) => (x.name || "").toLowerCase() === (a.name || "").toLowerCase())) base.add_ons_global.push(a);
  }
  base.total_items_extracted = countItems(base);
  return base;
}

type Log = { at: string; message: string; level?: string };

async function pushJob(jobId: string, patch: Record<string, unknown>, logs?: Log[]) {
  const update: Record<string, unknown> = { ...patch };
  if (logs) update.logs = logs;
  await admin.from("menu_import_jobs").update(update).eq("id", jobId);
}

async function runJob(jobId: string) {
  const logs: Log[] = [];
  const log = (message: string, level = "info") => {
    logs.push({ at: new Date().toISOString(), message, level });
    if (logs.length > 200) logs.splice(0, logs.length - 200);
  };

  const { data: job, error } = await admin.from("menu_import_jobs").select("*").eq("id", jobId).maybeSingle();
  if (error || !job) return;

  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) {
    await pushJob(jobId, { status: "error", error_message: "LOVABLE_API_KEY não configurada", finished_at: new Date().toISOString() });
    return;
  }

  try {
    log("Baixando arquivo enviado…");
    await pushJob(jobId, { status: "processing", progress: 3, started_at: new Date().toISOString(), error_message: null }, logs);

    const { bytes, mime } = await fetchFile(job.file_url as string);
    const isPdf = mime === "application/pdf" || /\.pdf(\?|$)/i.test(job.file_url as string);

    // Monta os lotes: PDF -> grupos de páginas; imagem -> um lote único.
    const batches: { label: string; dataUrl: string; pages: number }[] = [];
    if (isPdf) {
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const total = src.getPageCount();
      log(`PDF com ${total} página(s). Dividindo em lotes de ${PAGES_PER_BATCH}.`);
      await pushJob(jobId, { pages_total: total, progress: 8 }, logs);
      for (let start = 0; start < total; start += PAGES_PER_BATCH) {
        const idx = Array.from({ length: Math.min(PAGES_PER_BATCH, total - start) }, (_, i) => start + i);
        const doc = await PDFDocument.create();
        const copied = await doc.copyPages(src, idx);
        copied.forEach((p) => doc.addPage(p));
        const out = await doc.save();
        batches.push({
          label: `páginas ${start + 1}–${start + idx.length}`,
          dataUrl: `data:application/pdf;base64,${toBase64(new Uint8Array(out))}`,
          pages: idx.length,
        });
      }
    } else {
      log("Imagem detectada — processando em lote único.");
      await pushJob(jobId, { pages_total: 1, progress: 8 }, logs);
      batches.push({ label: "imagem", dataUrl: `data:${mime};base64,${toBase64(bytes)}`, pages: 1 });
    }

    const merged: any = { categories: [], add_ons_global: [], currency: "BRL", total_items_extracted: 0 };
    let pagesDone = 0;

    for (let b = 0; b < batches.length; b++) {
      const batch = batches[b];
      log(`Extraindo ${batch.label} (lote ${b + 1}/${batches.length})…`);
      await pushJob(jobId, { progress: Math.round(8 + (b / batches.length) * 88) }, logs);

      const messages = [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: `Extraia EXAUSTIVAMENTE todos os itens deste trecho do cardápio (${batch.label}). Retorne APENAS JSON no schema definido.` },
            batch.dataUrl.startsWith("data:application/pdf")
              ? { type: "file", file: { filename: `lote-${b + 1}.pdf`, file_data: batch.dataUrl } }
              : { type: "image_url", image_url: { url: batch.dataUrl } },
          ],
        },
      ];

      try {
        const raw = await callModel(messages, key);
        const parsed = extractJson(raw);
        if (Array.isArray(parsed?.categories)) {
          mergeResults(merged, parsed);
        }
        pagesDone += batch.pages;
        const found = countItems(merged);
        log(`Lote ${b + 1} concluído: ${countItems(parsed)} item(ns) neste lote, ${found} no total.`);
        // Salva parcial: se algo falhar depois, o que já foi extraído permanece.
        await pushJob(jobId, {
          pages_processed: pagesDone,
          items_found: found,
          parsed_result: merged,
          progress: Math.round(8 + ((b + 1) / batches.length) * 88),
        }, logs);
      } catch (e: any) {
        pagesDone += batch.pages;
        const msg = e?.status === 429
          ? "Limite de requisições da IA atingido neste lote."
          : e?.status === 402
            ? "Créditos de IA esgotados."
            : e?.message ?? "Erro desconhecido";
        log(`Falha no lote ${b + 1} (${batch.label}): ${msg}`, "error");
        await pushJob(jobId, { pages_processed: pagesDone, parsed_result: merged, items_found: countItems(merged) }, logs);
      }
    }

    merged.total_items_extracted = countItems(merged);
    log(`Importação finalizada: ${merged.total_items_extracted} item(ns) encontrados.`, "success");
    await pushJob(jobId, {
      status: merged.total_items_extracted > 0 ? "ready_for_review" : "error",
      error_message: merged.total_items_extracted > 0 ? null : "Nenhum item foi extraído do arquivo.",
      parsed_result: merged,
      items_found: merged.total_items_extracted,
      progress: 100,
      finished_at: new Date().toISOString(),
    }, logs);
  } catch (e: any) {
    log(`Erro: ${e?.message ?? "desconhecido"}`, "error");
    await pushJob(jobId, {
      status: "error",
      error_message: e?.message ?? "Erro desconhecido",
      progress: 100,
      finished_at: new Date().toISOString(),
    }, logs);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const jobId = body?.job_id;
    if (!jobId || typeof jobId !== "string") {
      return new Response(JSON.stringify({ error: "job_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Tenant comes from the JWT — never from the request body.
    const tenant = await resolveTenant(req, admin);
    if (!tenant) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: job } = await admin
      .from("menu_import_jobs")
      .select("id, restaurant_id")
      .eq("id", jobId)
      .maybeSingle();
    if (!job) {
      return new Response(JSON.stringify({ error: "Job não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (job.restaurant_id !== tenant.restaurantId) {
      await audit(admin, {
        restaurantId: tenant.restaurantId,
        userId: tenant.userId,
        action: "menu_import.denied_cross_tenant",
        entityType: "menu_import_job",
        entityId: jobId,
        metadata: { attempted_restaurant_id: job.restaurant_id },
      });
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await audit(admin, {
      restaurantId: tenant.restaurantId,
      userId: tenant.userId,
      action: "menu_import.started",
      entityType: "menu_import_job",
      entityId: jobId,
    });


    await admin.from("menu_import_jobs").update({
      status: "queued", progress: 0, pages_processed: 0, items_found: 0,
      error_message: null, finished_at: null,
      logs: [{ at: new Date().toISOString(), message: "Importação enfileirada.", level: "info" }],
    }).eq("id", jobId);

    // Processa em background: a request retorna imediatamente (sem IDLE_TIMEOUT).
    // @ts-ignore EdgeRuntime é global no runtime do Supabase
    EdgeRuntime.waitUntil(runJob(jobId));

    return new Response(JSON.stringify({ ok: true, job_id: jobId, status: "queued" }), {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

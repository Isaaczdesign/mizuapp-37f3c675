import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é "MenuImportAI", especialista em extrair cardápios de restaurantes japoneses no Brasil a partir de PDFs, imagens (fotos, prints, digitalizações), textos OCR ou capturas de tela — em QUALQUER fonte, layout, coluna, orientação ou qualidade.

MISSÃO CRÍTICA — EXAUSTIVIDADE:
Você DEVE extrair TODOS os itens visíveis no cardápio, sem exceção. Não resuma, não pule, não agrupe silenciosamente. Se o cardápio tem 120 itens, retorne os 120.

REGRAS DE COBERTURA (obrigatórias):
1. VARRA a página inteira, canto a canto, incluindo bordas, rodapés, laterais, boxes destacados, seções de "novidades", "promoções", "sugestão do chef", combos.
2. Se houver MÚLTIPLAS COLUNAS, processe cada coluna de cima para baixo, uma por vez.
3. Se houver MÚLTIPLAS PÁGINAS (PDF), processe TODAS. Nunca pare na primeira página.
4. Itens em FONTES DECORATIVAS, cursivas, japonesas, inclinadas, sobre fundos coloridos ou imagens: extraia igual.
5. Itens listados apenas por NOME sem preço: inclua com base_price=null e confidence baixa — nunca descarte.
6. Itens que aparecem em GRADES/TABELAS: leia célula por célula.
7. Se houver LISTA DE INGREDIENTES longa por item, capture como description mesmo que ocupe várias linhas.
8. Ignore APENAS: telefones, endereços, redes sociais, horário, CNPJ, textos institucionais.

PREÇOS BRL:
- "R$ 29,90" -> 29.90
- "29,90" -> 29.90
- "R$2g,90" (OCR ruim) -> 29.90 com confidence ~0.5
- Preço faltando -> base_price: null

CATEGORIAS (mapeie sinônimos):
Entradas, Temaki, Hot Roll / Hot Filadélfia, Combinados, Sashimi, Sushi/Nigiri, Uramaki, Hossomaki, Yakisoba/Pratos Quentes, Bebidas, Sobremesas, Rodízio, Promoções, Kids, Especiais do Chef.
Se não houver cabeçalho claro, infira pela palavra-chave do item.

VARIAÇÕES:
Se o MESMO item aparece com tamanhos (8/16/32 peças, P/M/G), agrupe em UM item com variations[].

ADD-ONS:
"Adicional shoyu +R$2,00", "Extra gengibre 1,50" -> add_ons_global[].

FORMATO DE SAÍDA — JSON ESTRITO, sem markdown, sem comentários:
{
  "restaurant_name_guess": string|null,
  "currency": "BRL",
  "total_items_extracted": number,
  "pages_processed": number,
  "categories": [
    {
      "name": string,
      "items": [
        {
          "name": string,
          "base_price": number|null,
          "variations": [{"name": string, "price": number}],
          "ingredients": [string],
          "allergens": [string],
          "description": string|null,
          "tags": [string],
          "confidence": number,
          "source_lines": [string]
        }
      ]
    }
  ],
  "add_ons_global": [{"name": string, "price": number, "confidence": number}],
  "unknown_lines": [string],
  "errors": [{"type": string, "line": string, "reason": string}]
}

Antes de finalizar, CONTE os itens que você listou e preencha total_items_extracted. Se parecer baixo para o tamanho do cardápio, RELE o material e adicione o que faltou.

Retorne APENAS JSON.`;

const VERIFY_PROMPT = `Você já extraiu um cardápio deste arquivo. Agora sua tarefa é AUDITAR: releia o arquivo original inteiro e liste TODOS os itens que ficaram FALTANDO na extração anterior.

Retorne JSON estrito no mesmo schema (categories[].items[]) contendo APENAS os itens que estavam ausentes. Se nada faltou, retorne {"categories": []}.

Considere faltando: itens visíveis no cardápio original que não aparecem por nome na lista anterior, incluindo variações, promoções, itens de rodapé, kids, bebidas, sobremesas, adicionais.

Retorne APENAS JSON.`;

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-pro"; // mais preciso para extração exaustiva

async function fetchAsDataUrl(url: string): Promise<{ dataUrl: string; mime: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao baixar arquivo: ${res.status}`);
  const ct = res.headers.get("content-type") || "";
  let mime = ct.split(";")[0].trim();
  if (!mime) {
    if (/\.pdf(\?|$)/i.test(url)) mime = "application/pdf";
    else if (/\.png(\?|$)/i.test(url)) mime = "image/png";
    else if (/\.webp(\?|$)/i.test(url)) mime = "image/webp";
    else mime = "image/jpeg";
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  // base64 encode in chunks para evitar stack overflow
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    bin += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  const b64 = btoa(bin);
  return { dataUrl: `data:${mime};base64,${b64}`, mime };
}

function extractJson(raw: string): any {
  let s = raw.trim();
  // Aceita fences ```json ... ``` e '''json ... '''
  const fence = s.match(/(?:```|''')(?:json)?\s*([\s\S]*?)(?:```|''')/);
  if (fence) s = fence[1].trim();
  else {
    // Remove fence de abertura mesmo sem fechamento (resposta truncada)
    s = s.replace(/^(?:```|''')(?:json)?\s*/i, "");
  }
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
  // remove trailing incomplete tokens (e.g. `, "name": "SONO`)
  out = out.replace(/,\s*"[^"]*"\s*:\s*[^,{\[\]}]*$/, "");
  out = out.replace(/,\s*"[^"]*$/, "");
  out = out.replace(/[,\s]+$/, "");
  while (stack.length) {
    const c = stack.pop();
    out += c === "{" ? "}" : "]";
  }
  return out;
}

async function callModel(messages: any[], key: string): Promise<string> {
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, messages, max_tokens: 16000, temperature: 0.1 }),
  });
  if (!res.ok) {
    const t = await res.text();
    const err: any = new Error(`AI gateway ${res.status}: ${t.slice(0, 500)}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

function countItems(parsed: any): number {
  let n = 0;
  for (const c of parsed?.categories ?? []) n += (c?.items?.length ?? 0);
  return n;
}

function mergeResults(base: any, extra: any): any {
  if (!extra?.categories?.length) return base;
  const byName = new Map<string, any>();
  for (const c of base.categories ?? []) byName.set(c.name.toLowerCase(), c);
  const existingItemNames = new Set<string>();
  for (const c of base.categories ?? []) for (const it of c.items ?? []) existingItemNames.add((it.name || "").toLowerCase().trim());

  for (const c of extra.categories) {
    const key = (c.name || "Outros").toLowerCase();
    const target = byName.get(key) ?? (() => {
      const nc = { name: c.name || "Outros", items: [] as any[] };
      base.categories.push(nc); byName.set(key, nc); return nc;
    })();
    for (const it of c.items ?? []) {
      const nm = (it.name || "").toLowerCase().trim();
      if (!nm || existingItemNames.has(nm)) continue;
      target.items.push(it);
      existingItemNames.add(nm);
    }
  }
  base.total_items_extracted = countItems(base);
  return base;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { ocr_text, layout_hints, image_url } = await req.json();

    if (!image_url && (!ocr_text || typeof ocr_text !== "string" || ocr_text.trim().length < 10)) {
      return new Response(JSON.stringify({ error: "Either image_url or ocr_text is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Descobrir a URL real do arquivo (imagem OU PDF)
    let fileUrl: string | null = null;
    if (image_url) fileUrl = image_url;
    else if (ocr_text) {
      const m = ocr_text.match(/https?:\/\/\S+/);
      if (m) fileUrl = m[0].replace(/[)\].,]+$/, "");
    }

    let userContent: any;
    const textInstruction =
      "Extraia EXAUSTIVAMENTE todos os itens do cardápio (nenhum item deve ficar de fora). Retorne APENAS JSON no schema definido." +
      (layout_hints ? `\n\nDicas de layout: ${layout_hints}` : "");

    if (fileUrl) {
      // Baixa e envia como data URL — funciona para imagem e PDF (Gemini via gateway)
      const { dataUrl } = await fetchAsDataUrl(fileUrl);
      userContent = [
        { type: "text", text: textInstruction },
        { type: "image_url", image_url: { url: dataUrl } },
      ];
    } else {
      // Texto OCR puro
      userContent = `${textInstruction}\n\nTexto OCR do cardápio:\n\n${ocr_text}`;
    }

    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ];

    // ---- Passo 1: extração principal ----
    let raw1 = "";
    try {
      raw1 = await callModel(messages, LOVABLE_API_KEY);
    } catch (e: any) {
      if (e.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded, tente novamente em instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (e.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos para continuar." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw e;
    }

    let parsed: any;
    try {
      parsed = extractJson(raw1);
    } catch {
      return new Response(JSON.stringify({ error: "AI returned invalid JSON", raw: raw1.slice(0, 2000) }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Array.isArray(parsed.categories)) parsed.categories = [];

    // ---- Passo 2: verificação/auditoria para pegar itens faltantes ----
    // Só faz sentido quando temos o arquivo original em mãos
    if (fileUrl) {
      try {
        const summary = parsed.categories
          .map((c: any) => `# ${c.name}\n` + (c.items ?? []).map((i: any) => `- ${i.name}`).join("\n"))
          .join("\n\n")
          .slice(0, 12000);

        const verifyMessages: any[] = [
          { role: "system", content: VERIFY_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: `Extração anterior:\n\n${summary}\n\nAgora releia o arquivo original inteiro e devolva SOMENTE os itens que faltaram, em JSON.` },
              (userContent as any[])[1], // reenvia o arquivo
            ],
          },
        ];
        const raw2 = await callModel(verifyMessages, LOVABLE_API_KEY);
        const extras = extractJson(raw2);
        parsed = mergeResults(parsed, extras);
      } catch (e) {
        console.warn("verify pass failed:", e);
        // segue sem verificação
      }
    }

    parsed.total_items_extracted = countItems(parsed);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("import-menu error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

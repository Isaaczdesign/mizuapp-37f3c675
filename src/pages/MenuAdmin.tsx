import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, GripVertical, Upload, FileText, ChevronDown, ChevronUp, UtensilsCrossed, ExternalLink, Copy, Link, Palette, LayoutList, Search, X } from "lucide-react";
import UpsellBadges from "@/components/UpsellBadges";
import MenuThemeTab from "@/components/menu-admin/MenuThemeTab";

import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import MenuLinkQR from "@/components/MenuLinkQR";
import { PageShell, PageHeader, Surface, SectionHeader } from "@/components/dashboard/ui";

const TAG_OPTIONS = [
  { value: "best_seller", label: "🔥 Mais Vendido" },
  { value: "recommended", label: "⭐ Recomendado" },
  { value: "combo", label: "🎁 Combo" },
  { value: "high_margin", label: "💰 Alta Margem" },
  { value: "chef_pick", label: "👨‍🍳 Escolha do Chef" },
];

function SortableCategoryItem({ cat, isSelected, isEditing, editingCat, setEditingCat, updateCat, deleteCat, onSelect }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: cat.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm cursor-pointer transition-colors group ${
        isSelected ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
      }`}
      onClick={() => onSelect(cat.id)}
    >
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none" onClick={(e) => e.stopPropagation()}>
        <GripVertical className="w-3 h-3 opacity-40 hover:opacity-100" />
      </button>
      {isEditing ? (
        <Input value={editingCat.name} onChange={(e) => setEditingCat({ ...editingCat, name: e.target.value })}
          onBlur={() => updateCat({ id: editingCat.id, name: editingCat.name })}
          onKeyDown={(e) => e.key === "Enter" && updateCat({ id: editingCat.id, name: editingCat.name })}
          className="h-6 text-sm bg-transparent border-0 p-0" autoFocus onClick={(e) => e.stopPropagation()} />
      ) : (
        <span className="flex-1">{cat.name}</span>
      )}
      <button onClick={(e) => { e.stopPropagation(); setEditingCat({ id: cat.id, name: cat.name }); }} className="opacity-0 group-hover:opacity-100 hover:text-primary">
        <Pencil className="w-3 h-3" />
      </button>
      <button onClick={(e) => { e.stopPropagation(); deleteCat(cat.id); }} className="opacity-0 group-hover:opacity-100 hover:text-destructive">
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

function SortableMenuItem({ item, fmt, openEditItem, deleteItem, toggleItem }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const cost = item.cost_estimate ? Number(item.cost_estimate) : null;
  const margin = item.margin_percent ? Number(item.margin_percent) : null;
  const price = Number(item.price);
  const profit = cost ? price - cost : margin ? price * margin : null;

  return (
    <div ref={setNodeRef} style={style} className={`glass-card overflow-hidden relative ${!item.is_active ? "opacity-50" : ""} ${(item.tags ?? []).some((t: string) => ["combo","high_margin"].includes(t)) ? "ring-1 ring-primary/30" : ""}`}>
      {item.image_url && <img src={item.image_url} alt={item.name} className="w-full h-32 object-cover" />}
      <div className="p-4">
        <div className="flex justify-between items-start mb-1">
          <div className="flex items-center gap-1">
            <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none">
              <GripVertical className="w-3 h-3 opacity-40 hover:opacity-100" />
            </button>
            <h3 className="font-display font-bold text-sm">{item.name}</h3>
          </div>
          <span className="font-mono text-sm font-bold text-primary">{fmt(price)}</span>
        </div>
        {item.description && <p className="text-xs text-muted-foreground mb-1 line-clamp-2">{item.description}</p>}
        <div className="mb-2">
          <UpsellBadges tags={item.tags} itemName={item.name} />
        </div>
        {profit !== null && (
          <p className="text-[10px] text-green-400 mb-2">Lucro est.: {fmt(profit)}</p>
        )}
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => openEditItem(item)}><Pencil className="w-3 h-3" /></Button>
            <Button size="sm" variant="outline" className="text-destructive" onClick={() => deleteItem(item.id)}><Trash2 className="w-3 h-3" /></Button>
          </div>
          <Switch checked={item.is_active} onCheckedChange={(v) => toggleItem({ id: item.id, active: v })} />
        </div>
      </div>
    </div>
  );
}

// --- Variations/Addons sub-editor ---
function VariationsEditor({ itemId, rid }: { itemId: string; rid: string }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [priceDelta, setPriceDelta] = useState("");

  const { data: variations = [] } = useQuery({
    queryKey: ["variations", itemId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("menu_item_variations").select("*").eq("menu_item_id", itemId).order("sort_order");
      return data ?? [];
    },
  });

  const addVar = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("menu_item_variations").insert({
        menu_item_id: itemId, name: name.trim(), price_delta: parseFloat(priceDelta) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["variations", itemId] }); setName(""); setPriceDelta(""); toast.success("Variação adicionada!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteVar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("menu_item_variations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["variations", itemId] }),
  });

  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold">Variações (ex: 8 peças, 16 peças)</Label>
      {variations.map((v: any) => (
        <div key={v.id} className="flex items-center gap-2 text-sm">
          <span className="flex-1">{v.name}</span>
          <span className="text-muted-foreground">{v.price_delta > 0 ? "+" : ""}{Number(v.price_delta).toFixed(2)}</span>
          <button onClick={() => deleteVar.mutate(v.id)} className="text-destructive hover:text-destructive/80"><Trash2 className="w-3 h-3" /></button>
        </div>
      ))}
      <div className="flex gap-2">
        <Input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} className="text-sm" />
        <Input placeholder="+R$" type="number" step="0.01" value={priceDelta} onChange={(e) => setPriceDelta(e.target.value)} className="w-20 text-sm" />
        <Button size="sm" onClick={() => name.trim() && addVar.mutate()} disabled={addVar.isPending}><Plus className="w-3 h-3" /></Button>
      </div>
    </div>
  );
}

function AddonsEditor({ itemId, rid }: { itemId: string; rid: string }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  const { data: addons = [] } = useQuery({
    queryKey: ["addons", itemId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("menu_item_addons").select("*").eq("menu_item_id", itemId).order("sort_order");
      return data ?? [];
    },
  });

  const addAddon = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("menu_item_addons").insert({
        menu_item_id: itemId, name: name.trim(), price: parseFloat(price) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["addons", itemId] }); setName(""); setPrice(""); toast.success("Adicional adicionado!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteAddon = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("menu_item_addons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["addons", itemId] }),
  });

  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold">Adicionais (ex: shoyu extra, gengibre)</Label>
      {addons.map((a: any) => (
        <div key={a.id} className="flex items-center gap-2 text-sm">
          <span className="flex-1">{a.name}</span>
          <span className="text-muted-foreground">+{Number(a.price).toFixed(2)}</span>
          <button onClick={() => deleteAddon.mutate(a.id)} className="text-destructive hover:text-destructive/80"><Trash2 className="w-3 h-3" /></button>
        </div>
      ))}
      <div className="flex gap-2">
        <Input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} className="text-sm" />
        <Input placeholder="R$" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="w-20 text-sm" />
        <Button size="sm" onClick={() => name.trim() && addAddon.mutate()} disabled={addAddon.isPending}><Plus className="w-3 h-3" /></Button>
      </div>
    </div>
  );
}

// --- Menu Import Tab ---
function MenuImportTab({ rid }: { rid: string }) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<any>(null);
  const [parsedResult, setParsedResult] = useState<any>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const { data: jobs = [] } = useQuery({
    queryKey: ["import-jobs", rid],
    queryFn: async () => {
      const { data } = await (supabase as any).from("menu_import_jobs").select("*").eq("restaurant_id", rid).order("created_at", { ascending: false }).limit(10);
      return data ?? [];
    },
  });

  const selectAll = (parsed: any) => {
    const allKeys = new Set<string>();
    parsed?.categories?.forEach((cat: any, ci: number) => {
      cat.items?.forEach((_: any, ii: number) => allKeys.add(`${ci}-${ii}`));
    });
    setSelectedItems(allKeys);
  };

  // Acompanha o job em andamento (realtime + polling de segurança)
  useEffect(() => {
    if (!activeJobId) return;
    let stopped = false;

    const apply = (job: any) => {
      if (stopped || !job) return;
      setActiveJob(job);
      if (job.parsed_result) setParsedResult(job.parsed_result);
      if (job.status === "ready_for_review") {
        selectAll(job.parsed_result);
        setActiveJobId(null);
        qc.invalidateQueries({ queryKey: ["import-jobs", rid] });
        toast.success(`Cardápio processado! ${job.items_found ?? 0} itens encontrados.`);
      } else if (job.status === "error") {
        setActiveJobId(null);
        qc.invalidateQueries({ queryKey: ["import-jobs", rid] });
        toast.error(job.error_message || "Falha ao processar o cardápio.");
      }
    };

    const fetchJob = async () => {
      const { data } = await (supabase as any).from("menu_import_jobs").select("*").eq("id", activeJobId).maybeSingle();
      apply(data);
    };

    fetchJob();
    const interval = setInterval(fetchJob, 3000);
    const channel = supabase
      .channel(`import-job-${activeJobId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "menu_import_jobs", filter: `id=eq.${activeJobId}` },
        (payload) => apply(payload.new))
      .subscribe();

    return () => {
      stopped = true;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [activeJobId, rid, qc]);

  const startJob = async (jobId: string) => {
    setParsedResult(null);
    setSelectedItems(new Set());
    setActiveJob(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-menu`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ job_id: jobId }),
    });

    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
      throw new Error(errBody.error || `Erro ${resp.status}`);
    }
    setActiveJobId(jobId);
    qc.invalidateQueries({ queryKey: ["import-jobs", rid] });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setParsedResult(null);
    try {
      // Sanitize filename: remove accents, replace non-alphanumeric with dashes
      const sanitizedName = file.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9.-]/g, "-")
        .replace(/-+/g, "-");
      const path = `${rid}/imports/${Date.now()}-${sanitizedName}`;
      const { error: upErr } = await supabase.storage.from("menu-images").upload(path, file);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("menu-images").getPublicUrl(path);

      // Create job record
      const { data: job, error: jobErr } = await (supabase as any).from("menu_import_jobs").insert({
        restaurant_id: rid, file_url: urlData.publicUrl, status: "uploaded",
      }).select().single();
      if (jobErr) throw jobErr;

      toast.success("Arquivo enviado! A importação foi enfileirada.");
      await startJob(job.id);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleReprocess = async (jobId: string) => {
    try {
      await startJob(jobId);
      toast.success("Reprocessamento enfileirado.");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const toggleItem = (key: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSaveSelected = async () => {
    if (!parsedResult?.categories) return;
    setSaving(true);
    try {
      let savedCount = 0;
      for (let ci = 0; ci < parsedResult.categories.length; ci++) {
        const cat = parsedResult.categories[ci];

        // Create or find category
        let categoryId: string;
        const { data: existingCats } = await supabase.from("menu_categories")
          .select("id").eq("restaurant_id", rid).eq("name", cat.name).limit(1);

        if (existingCats && existingCats.length > 0) {
          categoryId = existingCats[0].id;
        } else {
          const { data: newCat, error: catErr } = await supabase.from("menu_categories")
            .insert({ restaurant_id: rid, name: cat.name, sort_order: ci })
            .select("id").single();
          if (catErr) throw catErr;
          categoryId = newCat.id;
        }

        // Insert selected items
        for (let ii = 0; ii < (cat.items ?? []).length; ii++) {
          const key = `${ci}-${ii}`;
          if (!selectedItems.has(key)) continue;

          const item = cat.items[ii];
          const price = item.base_price ?? item.variations?.[0]?.price ?? 0;
          const desc = item.description || item.ingredients?.join(", ") || null;
          const tags = item.tags ?? [];

          const { error: itemErr } = await supabase.from("menu_items").insert({
            restaurant_id: rid,
            category_id: categoryId,
            name: item.name,
            price,
            description: desc,
            tags,
            sort_order: ii,
            is_active: true,
          });
          if (itemErr) throw itemErr;
          savedCount++;
        }
      }

      toast.success(`${savedCount} itens importados com sucesso!`);
      setParsedResult(null);
      setSelectedItems(new Set());
      qc.invalidateQueries({ queryKey: ["menu-categories", rid] });
      qc.invalidateQueries({ queryKey: ["menu-items", rid] });
      qc.invalidateQueries({ queryKey: ["import-jobs", rid] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const confidenceColor = (c: number) =>
    c >= 0.9 ? "text-green-400" : c >= 0.6 ? "text-yellow-400" : "text-red-400";

  const statusLabels: Record<string, string> = {
    uploaded: "Enviado", queued: "Na fila", processing: "Processando...", ready_for_review: "Pronto p/ Revisão",
    imported: "Importado", failed: "Falhou", error: "Erro",
  };
  const statusColors: Record<string, string> = {
    uploaded: "bg-blue-500/20 text-blue-400", queued: "bg-blue-500/20 text-blue-400",
    processing: "bg-yellow-500/20 text-yellow-400",
    ready_for_review: "bg-green-500/20 text-green-400", imported: "bg-muted text-muted-foreground",
    failed: "bg-destructive/20 text-destructive", error: "bg-destructive/20 text-destructive",
  };

  return (
    <div className="space-y-6">
      {/* Upload area */}
      <div className="glass-card p-8 text-center">
        <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <h3 className="font-display font-bold mb-2">Importar Cardápio</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Envie um PDF ou imagem do seu cardápio e a IA extrairá os itens automaticamente.
        </p>
        <label className="cursor-pointer">
          <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors">
            <FileText className="w-4 h-4" />
            {uploading ? "Enviando..." : activeJobId ? "Processando com IA..." : "Selecionar Arquivo"}
          </div>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleUpload} disabled={uploading || !!activeJobId} />
        </label>
        <p className="text-xs text-muted-foreground mt-2">PDF, JPG, PNG (máx 20MB)</p>
      </div>

      {/* Progresso + logs da extração */}
      {(activeJobId || (activeJob && activeJob.status === "processing")) && (
        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
            <div className="flex-1">
              <p className="text-sm font-medium">
                {activeJob?.status === "queued" ? "Na fila…" : "Extraindo itens do cardápio…"}
              </p>
              <p className="text-xs text-muted-foreground">
                {activeJob?.pages_total
                  ? `Páginas: ${activeJob?.pages_processed ?? 0}/${activeJob.pages_total}`
                  : "Preparando lotes…"}
                {" · "}
                Itens encontrados: <strong>{activeJob?.items_found ?? 0}</strong>
              </p>
            </div>
            <span className="text-sm font-mono text-primary">{activeJob?.progress ?? 0}%</span>
          </div>

          <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
            <div className="h-full bg-primary transition-all duration-500" style={{ width: `${activeJob?.progress ?? 0}%` }} />
          </div>

          {Array.isArray(activeJob?.logs) && activeJob.logs.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-lg bg-secondary/50 p-3 space-y-1">
              {activeJob.logs.slice(-30).map((l: any, i: number) => (
                <p key={i} className={`text-[11px] font-mono ${l.level === "error" ? "text-destructive" : l.level === "success" ? "text-green-400" : "text-muted-foreground"}`}>
                  {new Date(l.at).toLocaleTimeString("pt-BR")} · {l.message}
                </p>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Pode fechar esta aba: a importação continua rodando em segundo plano e os itens são salvos em partes.
          </p>
        </div>
      )}

      {/* Parsed results for review */}
      {parsedResult && parsedResult.categories?.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-lg">📋 Revisão do Cardápio</h3>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setParsedResult(null)}>Cancelar</Button>
              <Button onClick={handleSaveSelected} disabled={saving || selectedItems.size === 0}>
                {saving ? "Salvando..." : `Importar ${selectedItems.size} itens`}
              </Button>
            </div>
          </div>

          {parsedResult.restaurant_name_guess && (
            <p className="text-sm text-muted-foreground">
              Restaurante detectado: <strong>{parsedResult.restaurant_name_guess}</strong>
            </p>
          )}

          {parsedResult.categories.map((cat: any, ci: number) => (
            <div key={ci} className="glass-card p-4 space-y-3">
              <h4 className="font-display font-bold text-sm uppercase tracking-wider text-primary">{cat.name}</h4>
              <div className="space-y-2">
                {(cat.items ?? []).map((item: any, ii: number) => {
                  const key = `${ci}-${ii}`;
                  const isSelected = selectedItems.has(key);
                  return (
                    <div key={key}
                      onClick={() => toggleItem(key)}
                      className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        isSelected ? "bg-primary/10 border border-primary/20" : "bg-secondary/50 border border-transparent hover:border-border"
                      }`}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleItem(key)} className="mt-1 accent-primary" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{item.name}</span>
                          <span className={`text-[10px] font-mono ${confidenceColor(item.confidence)}`}>
                            {Math.round(item.confidence * 100)}%
                          </span>
                        </div>
                        {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
                        {item.ingredients?.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5">🥢 {item.ingredients.join(", ")}</p>
                        )}
                        {item.allergens?.length > 0 && (
                          <p className="text-xs text-yellow-400 mt-0.5">⚠️ {item.allergens.join(", ")}</p>
                        )}
                        {item.variations?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.variations.map((v: any, vi: number) => (
                              <span key={vi} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                                {v.name}: {fmt(v.price)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="font-mono text-sm font-bold text-primary whitespace-nowrap">
                        {item.base_price ? fmt(item.base_price) : item.variations?.[0] ? fmt(item.variations[0].price) : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Add-ons */}
          {parsedResult.add_ons_global?.length > 0 && (
            <div className="glass-card p-4">
              <h4 className="font-display font-bold text-sm mb-2">Adicionais Globais</h4>
              <div className="flex flex-wrap gap-2">
                {parsedResult.add_ons_global.map((a: any, i: number) => (
                  <span key={i} className="text-xs bg-secondary px-2 py-1 rounded-full">
                    {a.name} +{fmt(a.price)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Unknown lines */}
          {parsedResult.unknown_lines?.length > 0 && (
            <div className="glass-card p-4">
              <h4 className="font-display font-bold text-sm text-yellow-400 mb-2">⚠️ Linhas não reconhecidas</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                {parsedResult.unknown_lines.map((l: string, i: number) => (
                  <li key={i} className="font-mono">{l}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Errors */}
          {parsedResult.errors?.length > 0 && (
            <div className="glass-card p-4">
              <h4 className="font-display font-bold text-sm text-destructive mb-2">❌ Erros</h4>
              <ul className="text-xs space-y-1">
                {parsedResult.errors.map((e: any, i: number) => (
                  <li key={i}><span className="text-destructive">{e.type}:</span> {e.reason} <span className="font-mono text-muted-foreground">({e.line})</span></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Previous jobs */}
      {jobs.length > 0 && !parsedResult && (
        <div className="space-y-2">
          <h3 className="font-display font-bold text-sm">Importações Recentes</h3>
          {jobs.map((job: any) => (
            <div key={job.id} className="glass-card p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium truncate max-w-[200px]">{job.file_url?.split("/").pop()}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(job.created_at).toLocaleDateString("pt-BR")}
                  {job.items_found ? ` · ${job.items_found} itens` : ""}
                  {job.pages_total ? ` · ${job.pages_processed ?? 0}/${job.pages_total} págs` : ""}
                </p>
                {job.error_message && <p className="text-xs text-destructive mt-0.5">{job.error_message}</p>}
              </div>
              <div className="flex items-center gap-2">
                {job.status === "ready_for_review" && job.parsed_result && (
                  <Button size="sm" variant="outline" onClick={() => {
                    setParsedResult(job.parsed_result);
                    const allKeys = new Set<string>();
                    job.parsed_result.categories?.forEach((cat: any, ci: number) => {
                      cat.items?.forEach((_: any, ii: number) => allKeys.add(`${ci}-${ii}`));
                    });
                    setSelectedItems(allKeys);
                  }}>
                    Revisar
                  </Button>
                )}
                <Button size="sm" variant="ghost" disabled={!!activeJobId} onClick={() => handleReprocess(job.id)}>
                  Reprocessar
                </Button>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[job.status] ?? ""}`}>
                  {statusLabels[job.status] ?? job.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Main Component ---
const MenuAdmin = () => {
  const { profile } = useAuth();
  const rid = profile?.restaurant_id;
  const qc = useQueryClient();

  const [catName, setCatName] = useState("");
  const [editingCat, setEditingCat] = useState<{ id: string; name: string } | null>(null);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [availFilter, setAvailFilter] = useState<"all" | "active" | "inactive">("all");
  const [itemDialog, setItemDialog] = useState<any>(null);

  const [itemForm, setItemForm] = useState({
    name: "", description: "", price: "", image: null as File | null,
    ingredients: "", allergens: "", cost_estimate: "", margin_percent: "", tags: [] as string[],
  });

  const { data: restaurant } = useQuery({
    queryKey: ["restaurant", rid],
    enabled: !!rid,
    queryFn: async () => {
      const { data } = await supabase.from("restaurants").select("slug, name, logo_url, primary_color, short_code, menu_theme").eq("id", rid!).single();
      return data;
    },
  });

  const { data: previewItems } = useQuery({
    queryKey: ["menu-preview-items", rid],
    enabled: !!rid,
    queryFn: async () => {
      const { data } = await supabase
        .from("menu_items")
        .select("id, name, description, price, image_url, tags")
        .eq("restaurant_id", rid!)
        .eq("is_active", true)
        .limit(3);
      return data ?? [];
    },
  });


  const publicMenuUrl = restaurant?.slug ? `${window.location.origin}/r/${restaurant.slug}` : null;

  const copyLink = () => {
    if (publicMenuUrl) {
      navigator.clipboard.writeText(publicMenuUrl);
      toast.success("Link copiado!");
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const { data: categories } = useQuery({
    queryKey: ["menu-categories", rid],
    enabled: !!rid,
    queryFn: async () => {
      const { data } = await supabase.from("menu_categories").select("*").eq("restaurant_id", rid!).order("sort_order");
      return data ?? [];
    },
  });

  const { data: items } = useQuery({
    queryKey: ["menu-items", rid, selectedCat],
    enabled: !!rid,
    queryFn: async () => {
      let q = supabase.from("menu_items").select("*").eq("restaurant_id", rid!);
      if (selectedCat) q = q.eq("category_id", selectedCat);
      const { data } = await q.order("sort_order");
      return data ?? [];
    },
  });


  const reorderMutation = useMutation({
    mutationFn: async (updates: { id: string; sort_order: number; table: "menu_categories" | "menu_items" }[]) => {
      for (const u of updates) {
        const { error } = await supabase.from(u.table).update({ sort_order: u.sort_order }).eq("id", u.id);
        if (error) throw error;
      }
    },
  });

  const handleCategoryDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !categories) return;
    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(categories, oldIndex, newIndex);
    qc.setQueryData(["menu-categories", rid], reordered);
    reorderMutation.mutate(reordered.map((c, i) => ({ id: c.id, sort_order: i, table: "menu_categories" as const })));
  }, [categories, rid, qc, reorderMutation]);

  const handleItemDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !items) return;
    const oldIndex = items.findIndex((c) => c.id === active.id);
    const newIndex = items.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex);
    qc.setQueryData(["menu-items", rid, selectedCat], reordered);
    reorderMutation.mutate(reordered.map((c, i) => ({ id: c.id, sort_order: i, table: "menu_items" as const })));
  }, [items, rid, selectedCat, qc, reorderMutation]);

  const addCat = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("menu_categories").insert({ restaurant_id: rid!, name, sort_order: categories?.length ?? 0 });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["menu-categories", rid] }); setCatName(""); toast.success("Categoria criada!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateCatMut = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("menu_categories").update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["menu-categories", rid] }); setEditingCat(null); toast.success("Categoria atualizada!"); },
  });

  const deleteCatMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("menu_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["menu-categories", rid] }); if (selectedCat) setSelectedCat(null); toast.success("Categoria removida!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const saveItem = useMutation({
    mutationFn: async (mode: "create" | "edit") => {
      let image_url: string | null = itemDialog?.item?.image_url ?? null;
      if (itemForm.image) {
        const ext = itemForm.image.name.split(".").pop();
        const path = `${rid}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("menu-images").upload(path, itemForm.image);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("menu-images").getPublicUrl(path);
        image_url = urlData.publicUrl;
      }
      const payload: any = {
        name: itemForm.name, description: itemForm.description || null,
        price: parseFloat(itemForm.price) || 0, image_url,
        restaurant_id: rid!, category_id: selectedCat!,
        ingredients: itemForm.ingredients || null, allergens: itemForm.allergens || null,
        cost_estimate: itemForm.cost_estimate ? parseFloat(itemForm.cost_estimate) : null,
        margin_percent: itemForm.margin_percent ? parseFloat(itemForm.margin_percent) : null,
        tags: itemForm.tags,
      };
      if (mode === "create") {
        const { error } = await supabase.from("menu_items").insert({ ...payload, sort_order: items?.length ?? 0 });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("menu_items").update(payload).eq("id", itemDialog.item.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menu-items", rid, selectedCat] });
      setItemDialog(null);
      setItemForm({ name: "", description: "", price: "", image: null, ingredients: "", allergens: "", cost_estimate: "", margin_percent: "", tags: [] });
      toast.success("Item salvo!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteItemMut = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("menu_items").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["menu-items", rid, selectedCat] }); toast.success("Item removido!"); },
  });

  const toggleItemMut = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => { const { error } = await supabase.from("menu_items").update({ is_active: active }).eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menu-items", rid, selectedCat] }),
  });

  const openCreateItem = () => {
    setItemForm({ name: "", description: "", price: "", image: null, ingredients: "", allergens: "", cost_estimate: "", margin_percent: "", tags: [] });
    setItemDialog({ mode: "create" });
  };
  const openEditItem = (item: any) => {
    setItemForm({
      name: item.name, description: item.description ?? "", price: String(item.price), image: null,
      ingredients: (item as any).ingredients ?? "", allergens: (item as any).allergens ?? "",
      cost_estimate: item.cost_estimate ? String(item.cost_estimate) : "",
      margin_percent: item.margin_percent ? String(item.margin_percent) : "",
      tags: item.tags ?? [],
    });
    setItemDialog({ mode: "edit", item });
  };
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const toggleTag = (tag: string) => {
    setItemForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag],
    }));
  };

  // Calculate estimated profit in form
  const formPrice = parseFloat(itemForm.price) || 0;
  const formCost = itemForm.cost_estimate ? parseFloat(itemForm.cost_estimate) : null;
  const formMargin = itemForm.margin_percent ? parseFloat(itemForm.margin_percent) : null;
  const formProfit = formCost ? formPrice - formCost : formMargin ? formPrice * formMargin : null;

  const totalCats = (categories ?? []).length;
  const allItems = items ?? [];
  const catNameById = (id: string) => categories?.find((c) => c.id === id)?.name ?? "";

  const q = search.trim().toLowerCase();
  const filteredItems = allItems.filter((it: any) => {
    if (q) {
      const hay = `${it.name ?? ""} ${it.description ?? ""} ${it.ingredients ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (tagFilter.length && !tagFilter.every((t) => (it.tags ?? []).includes(t))) return false;
    if (availFilter === "active" && !it.is_active) return false;
    if (availFilter === "inactive" && it.is_active) return false;
    return true;
  });
  const filtersActive = !!q || tagFilter.length > 0 || availFilter !== "all";
  const canReorder = !!selectedCat && !filtersActive;
  const totalItems = filteredItems.length;
  const clearFilters = () => { setSearch(""); setTagFilter([]); setAvailFilter("all"); };
  const toggleTagFilter = (t: string) =>
    setTagFilter((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));


  return (
    <AdminLayout>
      <PageShell>
        <PageHeader
          emoji="🍣"
          title="Gestão de Cardápio"
          subtitle="Itens, importação inteligente e personalização visual."
          actions={
            publicMenuUrl && restaurant ? (
              <>
                <MenuLinkQR
                  slug={restaurant.slug}
                  restaurantName={(restaurant as any).name ?? ""}
                  logoUrl={(restaurant as any).logo_url}
                  primaryColor={(restaurant as any).primary_color}
                  shortCode={(restaurant as any).short_code}
                  onShortCodeGenerated={() => qc.invalidateQueries({ queryKey: ["restaurant", rid] })}
                />
                <Button variant="outline" size="sm" onClick={copyLink}>
                  <Copy className="w-4 h-4 mr-1.5" /> Copiar link
                </Button>
                <Button size="sm" onClick={() => window.open(publicMenuUrl, "_blank")}>
                  <ExternalLink className="w-4 h-4 mr-1.5" /> Ver cardápio
                </Button>
              </>
            ) : undefined
          }
        />

        {/* Public menu link */}
        {publicMenuUrl && (
          <Surface className="p-3.5 flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/15 flex items-center justify-center shrink-0">
              <Link className="w-4 h-4 text-accent" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Link público do cardápio</p>
              <p className="text-sm font-mono truncate text-foreground">{publicMenuUrl}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={copyLink} className="shrink-0">
              <Copy className="w-4 h-4" />
            </Button>
          </Surface>
        )}

        <Tabs defaultValue="items" className="w-full flex flex-col gap-4">
          <TabsList className="h-auto w-full sm:w-auto sm:inline-flex grid grid-cols-3 gap-1 p-1 rounded-2xl border border-border bg-card/60 backdrop-blur-xl">
            {[
              { v: "items", label: "Itens", icon: UtensilsCrossed },
              { v: "import", label: "Importar", icon: Upload },
              { v: "theme", label: "Personalizar", icon: Palette },
            ].map((t) => (
              <TabsTrigger
                key={t.v}
                value={t.v}
                className="gap-1.5 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-muted-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:shadow-[0_6px_20px_-8px_hsl(var(--accent)/0.7)]"
              >
                <t.icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{t.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="items" className="mt-0">
            <div className="grid lg:grid-cols-[280px_1fr] gap-4">
              {/* Categories panel */}
              <Surface className="p-4 h-fit lg:sticky lg:top-4">
                <SectionHeader
                  title="Categorias"
                  subtitle={`${totalCats} ${totalCats === 1 ? "categoria" : "categorias"}`}
                  icon={LayoutList}
                />
                <div className="flex gap-2 mb-3">
                  <Input placeholder="Nova categoria" value={catName} onChange={(e) => setCatName(e.target.value)} className="bg-background/40 text-sm h-9" onKeyDown={(e) => e.key === "Enter" && catName.trim() && addCat.mutate(catName.trim())} />
                  <Button size="sm" className="h-9 px-3" onClick={() => catName.trim() && addCat.mutate(catName.trim())} disabled={addCat.isPending}><Plus className="w-4 h-4" /></Button>
                </div>
                <button
                  onClick={() => setSelectedCat(null)}
                  className={`w-full mb-1 flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm transition-colors ${
                    selectedCat === null ? "bg-accent/15 border border-accent/25 text-foreground" : "border border-transparent text-muted-foreground hover:bg-card/80 hover:text-foreground"
                  }`}
                >
                  <span className="flex items-center gap-2"><LayoutList className="w-4 h-4" /> Todos os itens</span>
                  <span className="text-xs tabular-nums opacity-70">{allItems.length}</span>
                </button>
                {totalCats === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/70 py-7 px-3 text-center">
                    <p className="text-sm text-foreground/80 mb-1">Nenhuma categoria ainda</p>
                    <p className="text-xs text-muted-foreground">Crie categorias para organizar seu cardápio.</p>
                  </div>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCategoryDragEnd}>
                    <SortableContext items={(categories ?? []).map((c) => c.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-1">
                        {(categories ?? []).map((cat) => (
                          <SortableCategoryItem key={cat.id} cat={cat} isSelected={selectedCat === cat.id} isEditing={editingCat?.id === cat.id}
                            editingCat={editingCat} setEditingCat={setEditingCat} updateCat={(v: any) => updateCatMut.mutate(v)}
                            deleteCat={(id: string) => deleteCatMut.mutate(id)} onSelect={setSelectedCat} />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </Surface>

              {/* Items panel */}
              <Surface className="p-4">
                <SectionHeader
                  title={selectedCat ? (categories?.find((c) => c.id === selectedCat)?.name ?? "Itens") : "Todos os itens"}
                  subtitle={`${totalItems} de ${allItems.length} ${allItems.length === 1 ? "item" : "itens"}${filtersActive ? " • filtros ativos" : ""}`}
                  icon={UtensilsCrossed}
                  action={
                    selectedCat ? (
                      <Button size="sm" onClick={openCreateItem}><Plus className="w-4 h-4 mr-1.5" /> Novo item</Button>
                    ) : undefined
                  }
                />

                {/* Search & filters */}
                <div className="mb-4 space-y-2.5">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar por nome, descrição ou ingrediente..."
                        className="pl-9 pr-9 h-10 bg-background/40 text-sm"
                      />
                      {search && (
                        <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Limpar busca">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="inline-flex items-center p-1 rounded-xl border border-border bg-card/60 self-start">
                      {([
                        { k: "all", label: "Todos" },
                        { k: "active", label: "Ativos" },
                        { k: "inactive", label: "Inativos" },
                      ] as const).map((o) => (
                        <button
                          key={o.k}
                          onClick={() => setAvailFilter(o.k)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                            availFilter === o.k ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {TAG_OPTIONS.map((t) => {
                      const on = tagFilter.includes(t.value);
                      return (
                        <button
                          key={t.value}
                          onClick={() => toggleTagFilter(t.value)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                            on ? "border-accent/40 bg-accent/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground hover:bg-card/80"
                          }`}
                        >
                          {t.label}
                        </button>
                      );
                    })}
                    {filtersActive && (
                      <button onClick={clearFilters} className="ml-1 px-2.5 py-1 rounded-full text-[11px] font-medium text-muted-foreground hover:text-foreground underline underline-offset-2">
                        Limpar filtros
                      </button>
                    )}
                  </div>
                </div>

                {allItems.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/70 py-14 text-center">
                    <p className="text-sm text-muted-foreground mb-3">Nenhum item cadastrado ainda.</p>
                    {selectedCat && <Button onClick={openCreateItem} variant="outline" size="sm"><Plus className="w-4 h-4 mr-1.5" /> Criar primeiro item</Button>}
                  </div>
                ) : totalItems === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/70 py-14 text-center">
                    <Search className="w-8 h-8 mx-auto mb-3 opacity-40 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-3">Nenhum item encontrado com esses filtros.</p>
                    <Button onClick={clearFilters} variant="outline" size="sm">Limpar filtros</Button>
                  </div>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleItemDragEnd}>
                    <SortableContext items={filteredItems.map((i: any) => i.id)} strategy={verticalListSortingStrategy} disabled={!canReorder}>
                      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {filteredItems.map((item: any) => (
                          <div key={item.id} className="relative">
                            {!selectedCat && (
                              <span className="absolute -top-1.5 left-3 z-10 px-2 py-0.5 rounded-full bg-card border border-border text-[10px] text-muted-foreground">
                                {catNameById(item.category_id)}
                              </span>
                            )}
                            <SortableMenuItem item={item} fmt={fmt} openEditItem={openEditItem}
                              deleteItem={(id: string) => deleteItemMut.mutate(id)} toggleItem={(v: any) => toggleItemMut.mutate(v)} />
                          </div>
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}

              </Surface>
            </div>
          </TabsContent>

          <TabsContent value="import" className="mt-0">
            <Surface className="p-4">{rid && <MenuImportTab rid={rid} />}</Surface>
          </TabsContent>

          <TabsContent value="theme" className="mt-0">
            <Surface className="p-4">
              <MenuThemeTab
                restaurantId={rid ?? undefined}
                currentTheme={(restaurant as any)?.menu_theme}
                currentColor={(restaurant as any)?.primary_color}
                restaurantName={(restaurant as any)?.name}
                publicMenuUrl={publicMenuUrl}
                previewItems={(previewItems ?? []) as any}
              />
            </Surface>
          </TabsContent>

        </Tabs>


        {/* Item Dialog - Enhanced */}
        <Dialog open={!!itemDialog} onOpenChange={() => setItemDialog(null)}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{itemDialog?.mode === "create" ? "Novo Item" : "Editar Item"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome *</Label>
                <Input placeholder="Nome do item" value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea placeholder="Descrição do item" value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} className="mt-1" rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Preço (R$) *</Label>
                  <Input type="number" step="0.01" placeholder="0.00" value={itemForm.price} onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <Label>Custo Estimado (R$)</Label>
                  <Input type="number" step="0.01" placeholder="0.00" value={itemForm.cost_estimate} onChange={(e) => setItemForm({ ...itemForm, cost_estimate: e.target.value })} className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Margem % (0-1)</Label>
                  <Input type="number" step="0.01" min="0" max="1" placeholder="0.60" value={itemForm.margin_percent} onChange={(e) => setItemForm({ ...itemForm, margin_percent: e.target.value })} className="mt-1" />
                </div>
                <div className="flex items-end">
                  {formProfit !== null && (
                    <p className="text-sm text-green-400 pb-2">💰 Lucro est.: {fmt(formProfit)}</p>
                  )}
                </div>
              </div>
              <div>
                <Label>Ingredientes</Label>
                <Textarea placeholder="Lista de ingredientes..." value={itemForm.ingredients} onChange={(e) => setItemForm({ ...itemForm, ingredients: e.target.value })} className="mt-1" rows={2} />
              </div>
              <div>
                <Label>Alérgenos</Label>
                <Input placeholder="Ex: Glúten, Soja, Frutos do mar" value={itemForm.allergens} onChange={(e) => setItemForm({ ...itemForm, allergens: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {TAG_OPTIONS.map((tag) => (
                    <button key={tag.value} onClick={() => toggleTag(tag.value)}
                      className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                        itemForm.tags.includes(tag.value) ? "bg-primary/20 text-primary border border-primary/30" : "bg-secondary text-muted-foreground hover:text-foreground"
                      }`}>
                      {tag.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Imagem</Label>
                <input type="file" accept="image/*" onChange={(e) => setItemForm({ ...itemForm, image: e.target.files?.[0] ?? null })} className="text-sm mt-1" />
                <p className="text-xs text-muted-foreground mt-1">
                  Tamanho recomendado: <strong>800×800 px</strong> (quadrado 1:1), JPG ou PNG, até 2 MB.
                </p>
              </div>

              {/* Variations & Addons - only for edit mode */}
              {itemDialog?.mode === "edit" && itemDialog?.item?.id && rid && (
                <>
                  <div className="border-t border-border pt-4">
                    <VariationsEditor itemId={itemDialog.item.id} rid={rid} />
                  </div>
                  <div className="border-t border-border pt-4">
                    <AddonsEditor itemId={itemDialog.item.id} rid={rid} />
                  </div>
                </>
              )}

              <Button className="w-full" onClick={() => saveItem.mutate(itemDialog?.mode)} disabled={!itemForm.name || !itemForm.price || saveItem.isPending}>
                {saveItem.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </PageShell>
    </AdminLayout>
  );
};

export default MenuAdmin;

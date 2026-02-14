import { useState, useCallback } from "react";
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
import { Plus, Pencil, Trash2, GripVertical, Upload, FileText, ChevronDown, ChevronUp, UtensilsCrossed } from "lucide-react";
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
    <div ref={setNodeRef} style={style} className={`glass-card overflow-hidden ${!item.is_active ? "opacity-50" : ""}`}>
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
        <div className="flex flex-wrap gap-1 mb-2">
          {(item.tags ?? []).map((tag: string) => {
            const t = TAG_OPTIONS.find((o) => o.value === tag);
            return t ? <span key={tag} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{t.label}</span> : null;
          })}
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

  const { data: jobs = [] } = useQuery({
    queryKey: ["import-jobs", rid],
    queryFn: async () => {
      const { data } = await (supabase as any).from("menu_import_jobs").select("*").eq("restaurant_id", rid).order("created_at", { ascending: false }).limit(10);
      return data ?? [];
    },
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = `${rid}/imports/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("menu-images").upload(path, file);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("menu-images").getPublicUrl(path);

      const { error } = await (supabase as any).from("menu_import_jobs").insert({
        restaurant_id: rid, file_url: urlData.publicUrl, status: "uploaded",
      });
      if (error) throw error;

      toast.success("Arquivo enviado! O processamento iniciará em breve.");
      qc.invalidateQueries({ queryKey: ["import-jobs", rid] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const statusLabels: Record<string, string> = {
    uploaded: "Enviado", processing: "Processando...", ready_for_review: "Pronto p/ Revisão",
    imported: "Importado", failed: "Falhou",
  };
  const statusColors: Record<string, string> = {
    uploaded: "bg-blue-500/20 text-blue-400", processing: "bg-yellow-500/20 text-yellow-400",
    ready_for_review: "bg-green-500/20 text-green-400", imported: "bg-muted text-muted-foreground",
    failed: "bg-destructive/20 text-destructive",
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-8 text-center">
        <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <h3 className="font-display font-bold mb-2">Importar Cardápio</h3>
        <p className="text-sm text-muted-foreground mb-4">Envie um PDF ou imagem do seu cardápio e nós extraímos os itens automaticamente.</p>
        <label className="cursor-pointer">
          <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors">
            <FileText className="w-4 h-4" /> {uploading ? "Enviando..." : "Selecionar Arquivo"}
          </div>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
        <p className="text-xs text-muted-foreground mt-2">PDF, JPG, PNG (máx 20MB)</p>
      </div>

      {jobs.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-display font-bold text-sm">Importações Recentes</h3>
          {jobs.map((job: any) => (
            <div key={job.id} className="glass-card p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium truncate max-w-[200px]">{job.file_url.split("/").pop()}</p>
                <p className="text-xs text-muted-foreground">{new Date(job.created_at).toLocaleDateString("pt-BR")}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[job.status] ?? ""}`}>
                {statusLabels[job.status] ?? job.status}
              </span>
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
  const [itemDialog, setItemDialog] = useState<any>(null);
  const [itemForm, setItemForm] = useState({
    name: "", description: "", price: "", image: null as File | null,
    ingredients: "", allergens: "", cost_estimate: "", margin_percent: "", tags: [] as string[],
  });

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
    enabled: !!rid && !!selectedCat,
    queryFn: async () => {
      const { data } = await supabase.from("menu_items").select("*").eq("restaurant_id", rid!).eq("category_id", selectedCat!).order("sort_order");
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

  return (
    <AdminLayout>
      <div className="p-6">
        <h1 className="font-display text-2xl md:text-3xl font-bold mb-6">🍣 <span className="gradient-text">Gestão de Cardápio</span></h1>

        <Tabs defaultValue="items" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="items">Itens do Cardápio</TabsTrigger>
            <TabsTrigger value="import">Importar Cardápio</TabsTrigger>
          </TabsList>

          <TabsContent value="items">
            <div className="grid md:grid-cols-[240px_1fr] gap-6">
              {/* Categories sidebar */}
              <div>
                <h2 className="font-display font-bold mb-3 text-sm text-muted-foreground uppercase tracking-wider">Categorias</h2>
                <div className="flex gap-2 mb-3">
                  <Input placeholder="Nova categoria" value={catName} onChange={(e) => setCatName(e.target.value)} className="bg-card/60 text-sm" onKeyDown={(e) => e.key === "Enter" && catName.trim() && addCat.mutate(catName.trim())} />
                  <Button size="sm" onClick={() => catName.trim() && addCat.mutate(catName.trim())} disabled={addCat.isPending}><Plus className="w-4 h-4" /></Button>
                </div>
                {(categories ?? []).length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-sm text-muted-foreground mb-2">Nenhuma categoria ainda.</p>
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
              </div>

              {/* Items grid */}
              <div>
                {!selectedCat ? (
                  <div className="glass-card p-12 text-center text-muted-foreground">
                    <UtensilsCrossed className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p>Selecione uma categoria para gerenciar os itens.</p>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="font-display font-bold">{categories?.find((c) => c.id === selectedCat)?.name}</h2>
                      <Button onClick={openCreateItem}><Plus className="w-4 h-4 mr-1" /> Novo Item</Button>
                    </div>
                    {(items ?? []).length === 0 ? (
                      <div className="glass-card p-12 text-center">
                        <p className="text-muted-foreground mb-2">Nenhum item nesta categoria.</p>
                        <Button onClick={openCreateItem} variant="outline"><Plus className="w-4 h-4 mr-1" /> Criar primeiro item</Button>
                      </div>
                    ) : (
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleItemDragEnd}>
                        <SortableContext items={(items ?? []).map((i) => i.id)} strategy={verticalListSortingStrategy}>
                          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {(items ?? []).map((item) => (
                              <SortableMenuItem key={item.id} item={item} fmt={fmt} openEditItem={openEditItem}
                                deleteItem={(id: string) => deleteItemMut.mutate(id)} toggleItem={(v: any) => toggleItemMut.mutate(v)} />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    )}
                  </>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="import">
            {rid && <MenuImportTab rid={rid} />}
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
      </div>
    </AdminLayout>
  );
};

export default MenuAdmin;

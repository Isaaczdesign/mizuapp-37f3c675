import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableCategoryItem({
  cat,
  isSelected,
  isEditing,
  editingCat,
  setEditingCat,
  updateCat,
  deleteCat,
  onSelect,
}: any) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: cat.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm cursor-pointer transition-colors group ${
        isSelected ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
      }`}
      onClick={() => onSelect(cat.id)}
    >
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none" onClick={(e) => e.stopPropagation()}>
        <GripVertical className="w-3 h-3 opacity-40 hover:opacity-100" />
      </button>
      {isEditing ? (
        <Input
          value={editingCat.name}
          onChange={(e) => setEditingCat({ ...editingCat, name: e.target.value })}
          onBlur={() => updateCat({ id: editingCat.id, name: editingCat.name })}
          onKeyDown={(e) => e.key === "Enter" && updateCat({ id: editingCat.id, name: editingCat.name })}
          className="h-6 text-sm bg-transparent border-0 p-0"
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="flex-1">{cat.name}</span>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); setEditingCat({ id: cat.id, name: cat.name }); }}
        className="opacity-0 group-hover:opacity-100 hover:text-primary"
      >
        <Pencil className="w-3 h-3" />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); deleteCat(cat.id); }}
        className="opacity-0 group-hover:opacity-100 hover:text-destructive"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

function SortableMenuItem({ item, fmt, openEditItem, deleteItem, toggleItem }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className={`glass-card overflow-hidden ${!item.is_active ? "opacity-50" : ""}`}>
      {item.image_url && <img src={item.image_url} alt={item.name} className="w-full h-32 object-cover" />}
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-1">
            <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none">
              <GripVertical className="w-3 h-3 opacity-40 hover:opacity-100" />
            </button>
            <h3 className="font-display font-bold text-sm">{item.name}</h3>
          </div>
          <span className="font-mono text-sm font-bold text-primary">{fmt(Number(item.price))}</span>
        </div>
        {item.description && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{item.description}</p>}
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

const MenuAdmin = () => {
  const { profile } = useAuth();
  const rid = profile?.restaurant_id;
  const qc = useQueryClient();

  const [catName, setCatName] = useState("");
  const [editingCat, setEditingCat] = useState<{ id: string; name: string } | null>(null);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [itemDialog, setItemDialog] = useState<any>(null);
  const [itemForm, setItemForm] = useState({ name: "", description: "", price: "", image: null as File | null });

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
      const payload = { name: itemForm.name, description: itemForm.description || null, price: parseFloat(itemForm.price) || 0, image_url, restaurant_id: rid!, category_id: selectedCat! };
      if (mode === "create") {
        const { error } = await supabase.from("menu_items").insert({ ...payload, sort_order: items?.length ?? 0 });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("menu_items").update(payload).eq("id", itemDialog.item.id);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["menu-items", rid, selectedCat] }); setItemDialog(null); setItemForm({ name: "", description: "", price: "", image: null }); toast.success("Item salvo!"); },
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

  const openCreateItem = () => { setItemForm({ name: "", description: "", price: "", image: null }); setItemDialog({ mode: "create" }); };
  const openEditItem = (item: any) => { setItemForm({ name: item.name, description: item.description ?? "", price: String(item.price), image: null }); setItemDialog({ mode: "edit", item }); };
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <AdminLayout>
      <div className="p-6">
        <h1 className="font-display text-2xl md:text-3xl font-bold mb-6">🍣 <span className="gradient-text">Gestão de Cardápio</span></h1>
        <div className="grid md:grid-cols-[240px_1fr] gap-6">
          {/* Categories */}
          <div>
            <h2 className="font-display font-bold mb-3 text-sm text-muted-foreground uppercase tracking-wider">Categorias</h2>
            <div className="flex gap-2 mb-3">
              <Input placeholder="Nova categoria" value={catName} onChange={(e) => setCatName(e.target.value)} className="bg-card/60 text-sm" onKeyDown={(e) => e.key === "Enter" && catName.trim() && addCat.mutate(catName.trim())} />
              <Button size="sm" onClick={() => catName.trim() && addCat.mutate(catName.trim())} disabled={addCat.isPending}><Plus className="w-4 h-4" /></Button>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCategoryDragEnd}>
              <SortableContext items={(categories ?? []).map((c) => c.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1">
                  {(categories ?? []).map((cat) => (
                    <SortableCategoryItem
                      key={cat.id}
                      cat={cat}
                      isSelected={selectedCat === cat.id}
                      isEditing={editingCat?.id === cat.id}
                      editingCat={editingCat}
                      setEditingCat={setEditingCat}
                      updateCat={(v: any) => updateCatMut.mutate(v)}
                      deleteCat={(id: string) => deleteCatMut.mutate(id)}
                      onSelect={setSelectedCat}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          {/* Items */}
          <div>
            {!selectedCat ? (
              <div className="glass-card p-12 text-center text-muted-foreground">Selecione uma categoria para gerenciar os itens.</div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="font-display font-bold">{categories?.find((c) => c.id === selectedCat)?.name}</h2>
                  <Button onClick={openCreateItem}><Plus className="w-4 h-4 mr-1" /> Novo Item</Button>
                </div>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleItemDragEnd}>
                  <SortableContext items={(items ?? []).map((i) => i.id)} strategy={verticalListSortingStrategy}>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {(items ?? []).map((item) => (
                        <SortableMenuItem
                          key={item.id}
                          item={item}
                          fmt={fmt}
                          openEditItem={openEditItem}
                          deleteItem={(id: string) => deleteItemMut.mutate(id)}
                          toggleItem={(v: any) => toggleItemMut.mutate(v)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </>
            )}
          </div>
        </div>

        <Dialog open={!!itemDialog} onOpenChange={() => setItemDialog(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{itemDialog?.mode === "create" ? "Novo Item" : "Editar Item"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Nome do item" value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} />
              <Input placeholder="Descrição (opcional)" value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} />
              <Input type="number" step="0.01" placeholder="Preço (R$)" value={itemForm.price} onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })} />
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Imagem</label>
                <input type="file" accept="image/*" onChange={(e) => setItemForm({ ...itemForm, image: e.target.files?.[0] ?? null })} className="text-sm" />
              </div>
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

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Image, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

const MenuAdmin = () => {
  const { profile } = useAuth();
  const rid = profile?.restaurant_id;
  const qc = useQueryClient();

  const [catName, setCatName] = useState("");
  const [editingCat, setEditingCat] = useState<{ id: string; name: string } | null>(null);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [itemDialog, setItemDialog] = useState<any>(null); // null | { mode: 'create' | 'edit', item?: any }
  const [itemForm, setItemForm] = useState({ name: "", description: "", price: "", image: null as File | null });

  const { data: categories } = useQuery({
    queryKey: ["menu-categories", rid],
    enabled: !!rid,
    queryFn: async () => {
      const { data } = await supabase
        .from("menu_categories")
        .select("*")
        .eq("restaurant_id", rid!)
        .order("sort_order");
      return data ?? [];
    },
  });

  const { data: items } = useQuery({
    queryKey: ["menu-items", rid, selectedCat],
    enabled: !!rid && !!selectedCat,
    queryFn: async () => {
      const { data } = await supabase
        .from("menu_items")
        .select("*")
        .eq("restaurant_id", rid!)
        .eq("category_id", selectedCat!)
        .order("sort_order");
      return data ?? [];
    },
  });

  // Category mutations
  const addCat = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("menu_categories").insert({
        restaurant_id: rid!,
        name,
        sort_order: (categories?.length ?? 0),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menu-categories", rid] });
      setCatName("");
      toast.success("Categoria criada!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateCat = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("menu_categories").update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menu-categories", rid] });
      setEditingCat(null);
      toast.success("Categoria atualizada!");
    },
  });

  const deleteCat = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("menu_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menu-categories", rid] });
      if (selectedCat) setSelectedCat(null);
      toast.success("Categoria removida!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Item mutations
  const saveItem = useMutation({
    mutationFn: async (mode: "create" | "edit") => {
      let image_url: string | null = itemDialog?.item?.image_url ?? null;

      if (itemForm.image) {
        const ext = itemForm.image.name.split(".").pop();
        const path = `${rid}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("menu-images")
          .upload(path, itemForm.image);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("menu-images").getPublicUrl(path);
        image_url = urlData.publicUrl;
      }

      const payload = {
        name: itemForm.name,
        description: itemForm.description || null,
        price: parseFloat(itemForm.price) || 0,
        image_url,
        restaurant_id: rid!,
        category_id: selectedCat!,
      };

      if (mode === "create") {
        const { error } = await supabase.from("menu_items").insert({
          ...payload,
          sort_order: (items?.length ?? 0),
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("menu_items").update(payload).eq("id", itemDialog.item.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menu-items", rid, selectedCat] });
      setItemDialog(null);
      setItemForm({ name: "", description: "", price: "", image: null });
      toast.success("Item salvo!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("menu_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menu-items", rid, selectedCat] });
      toast.success("Item removido!");
    },
  });

  const toggleItem = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("menu_items").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menu-items", rid, selectedCat] }),
  });

  const openCreateItem = () => {
    setItemForm({ name: "", description: "", price: "", image: null });
    setItemDialog({ mode: "create" });
  };

  const openEditItem = (item: any) => {
    setItemForm({ name: item.name, description: item.description ?? "", price: String(item.price), image: null });
    setItemDialog({ mode: "edit", item });
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <AdminLayout>
      <div className="p-6">
        <h1 className="font-display text-2xl md:text-3xl font-bold mb-6">
          🍣 <span className="gradient-text">Gestão de Cardápio</span>
        </h1>

        <div className="grid md:grid-cols-[240px_1fr] gap-6">
          {/* Categories sidebar */}
          <div>
            <h2 className="font-display font-bold mb-3 text-sm text-muted-foreground uppercase tracking-wider">Categorias</h2>
            <div className="flex gap-2 mb-3">
              <Input
                placeholder="Nova categoria"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                className="bg-card/60 text-sm"
                onKeyDown={(e) => e.key === "Enter" && catName.trim() && addCat.mutate(catName.trim())}
              />
              <Button size="sm" onClick={() => catName.trim() && addCat.mutate(catName.trim())} disabled={addCat.isPending}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-1">
              {(categories ?? []).map((cat) => (
                <div
                  key={cat.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm cursor-pointer transition-colors ${
                    selectedCat === cat.id ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                  onClick={() => setSelectedCat(cat.id)}
                >
                  <GripVertical className="w-3 h-3 opacity-30" />
                  {editingCat?.id === cat.id ? (
                    <Input
                      value={editingCat.name}
                      onChange={(e) => setEditingCat({ ...editingCat, name: e.target.value })}
                      onBlur={() => updateCat.mutate({ id: editingCat.id, name: editingCat.name })}
                      onKeyDown={(e) => e.key === "Enter" && updateCat.mutate({ id: editingCat.id, name: editingCat.name })}
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
                    onClick={(e) => { e.stopPropagation(); deleteCat.mutate(cat.id); }}
                    className="hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Items area */}
          <div>
            {!selectedCat ? (
              <div className="glass-card p-12 text-center text-muted-foreground">
                Selecione uma categoria para gerenciar os itens.
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="font-display font-bold">
                    {categories?.find((c) => c.id === selectedCat)?.name}
                  </h2>
                  <Button onClick={openCreateItem}>
                    <Plus className="w-4 h-4 mr-1" /> Novo Item
                  </Button>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(items ?? []).map((item) => (
                    <div key={item.id} className={`glass-card overflow-hidden ${!item.is_active ? "opacity-50" : ""}`}>
                      {item.image_url && (
                        <img src={item.image_url} alt={item.name} className="w-full h-32 object-cover" />
                      )}
                      <div className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-display font-bold text-sm">{item.name}</h3>
                          <span className="font-mono text-sm font-bold text-primary">{fmt(Number(item.price))}</span>
                        </div>
                        {item.description && (
                          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{item.description}</p>
                        )}
                        <div className="flex items-center justify-between">
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => openEditItem(item)}>
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="outline" className="text-destructive" onClick={() => deleteItem.mutate(item.id)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                          <Switch
                            checked={item.is_active}
                            onCheckedChange={(v) => toggleItem.mutate({ id: item.id, active: v })}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Item dialog */}
        <Dialog open={!!itemDialog} onOpenChange={() => setItemDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{itemDialog?.mode === "create" ? "Novo Item" : "Editar Item"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Nome do item"
                value={itemForm.name}
                onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
              />
              <Input
                placeholder="Descrição (opcional)"
                value={itemForm.description}
                onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
              />
              <Input
                type="number"
                step="0.01"
                placeholder="Preço (R$)"
                value={itemForm.price}
                onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })}
              />
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Imagem</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setItemForm({ ...itemForm, image: e.target.files?.[0] ?? null })}
                  className="text-sm"
                />
              </div>
              <Button
                className="w-full"
                onClick={() => saveItem.mutate(itemDialog?.mode)}
                disabled={!itemForm.name || !itemForm.price || saveItem.isPending}
              >
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

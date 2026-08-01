import { useEffect, useState } from "react";
import AdminMizuLayout from "@/components/admin-mizu/AdminMizuLayout";
import { supabase } from "@/integrations/supabase/client";
import { usePlatformRole, logPlatformAction } from "@/hooks/usePlatformRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Megaphone, Trash2, Users } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

type Announcement = {
  id: string;
  title: string;
  body: string;
  variant: string;
  active: boolean;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
  target_scope: string;
  target_restaurant_ids: string[] | null;
};

type RestaurantOption = { id: string; name: string; slug: string };

const VARIANTS: { id: string; label: string }[] = [
  { id: "update", label: "Atualização" },
  { id: "info", label: "Informação" },
  { id: "warning", label: "Aviso" },
  { id: "maintenance", label: "Manutenção" },
];

export function AdminNotifications() {
  const { isAdmin } = usePlatformRole();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [variant, setVariant] = useState("update");
  const [endsAt, setEndsAt] = useState("");
  const [scope, setScope] = useState<"all" | "restaurants">("all");
  const [restaurants, setRestaurants] = useState<RestaurantOption[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const load = async () => {
    const { data, error } = await supabase
      .from("platform_announcements")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Não foi possível carregar os avisos.");
    setItems((data ?? []) as Announcement[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const { data } = await supabase
        .from("restaurants")
        .select("id, name, slug")
        .order("name");
      setRestaurants((data ?? []) as RestaurantOption[]);
    })();
  }, [isAdmin]);

  const toggleRestaurant = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));

  const filteredRestaurants = restaurants.filter((r) =>
    `${r.name} ${r.slug}`.toLowerCase().includes(search.trim().toLowerCase())
  );

  const create = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Preencha título e mensagem.");
      return;
    }
    if (scope === "restaurants" && selected.length === 0) {
      toast.error("Selecione ao menos um restaurante.");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("platform_announcements")
      .insert({
        title: title.trim(),
        body: body.trim(),
        variant,
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        target_scope: scope,
        target_restaurant_ids: scope === "restaurants" ? selected : [],
      })
      .select()
      .single();
    setSaving(false);
    if (error) { toast.error("Erro ao publicar o aviso."); return; }
    await logPlatformAction({ action: "announcement.create", entityType: "platform_announcement", entityId: data.id, newValue: data });
    toast.success("Aviso publicado. Os restaurantes verão ao recarregar a página.");
    setTitle(""); setBody(""); setEndsAt(""); setVariant("update");
    setScope("all"); setSelected([]); setSearch("");
    load();
  };

  const toggle = async (item: Announcement, active: boolean) => {
    const { error } = await supabase.from("platform_announcements").update({ active }).eq("id", item.id);
    if (error) { toast.error("Erro ao atualizar."); return; }
    await logPlatformAction({ action: "announcement.toggle", entityType: "platform_announcement", entityId: item.id, newValue: { active } });
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, active } : i)));
  };

  const remove = async (item: Announcement) => {
    if (!confirm("Excluir este aviso definitivamente?")) return;
    const { error } = await supabase.from("platform_announcements").delete().eq("id", item.id);
    if (error) { toast.error("Erro ao excluir."); return; }
    await logPlatformAction({ action: "announcement.delete", entityType: "platform_announcement", entityId: item.id, oldValue: item });
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  };

  return (
    <AdminMizuLayout
      title="Avisos e notificações"
      description="Publique comunicados que aparecem no painel dos restaurantes ao recarregar a página."
    >
      {isAdmin && (
        <div className="mb-6 space-y-3 rounded-xl border border-border p-4">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Novo aviso</h2>
          </div>
          <Input placeholder="Título (ex.: Nova atualização do Mizu)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          <Textarea placeholder="Mensagem exibida ao dono do restaurante" value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={600} />
          <div className="flex flex-wrap items-center gap-2">
            {VARIANTS.map((v) => (
              <button
                key={v.id}
                onClick={() => setVariant(v.id)}
                className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                  variant === v.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/60"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
          <div className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <p className="text-xs font-semibold">Quem recebe este aviso</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {([
                { id: "all", label: "Todos os restaurantes" },
                { id: "restaurants", label: "Restaurantes selecionados" },
              ] as const).map((o) => (
                <button
                  key={o.id}
                  onClick={() => setScope(o.id)}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                    scope === o.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/60"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>

            {scope === "restaurants" && (
              <div className="space-y-2">
                <Input
                  placeholder="Buscar restaurante por nome ou link"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                  {filteredRestaurants.length === 0 ? (
                    <p className="p-2 text-xs text-muted-foreground">Nenhum restaurante encontrado.</p>
                  ) : (
                    filteredRestaurants.map((r) => (
                      <label
                        key={r.id}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/60"
                      >
                        <Checkbox
                          checked={selected.includes(r.id)}
                          onCheckedChange={() => toggleRestaurant(r.id)}
                        />
                        <span className="min-w-0 flex-1 truncate">{r.name}</span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">/{r.slug}</span>
                      </label>
                    ))
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {selected.length} restaurante(s) selecionado(s).
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs text-muted-foreground">Expira em (opcional)</label>
            <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="w-auto" />
            <Button onClick={create} disabled={saving} className="ml-auto">
              {saving ? "Publicando..." : "Publicar aviso"}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <Megaphone className="mx-auto h-6 w-6 text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum aviso publicado ainda.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-start gap-3 rounded-xl border border-border p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{item.title}</p>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {VARIANTS.find((v) => v.id === item.variant)?.label ?? item.variant}
                  </span>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                    {item.target_scope === "restaurants"
                      ? `${item.target_restaurant_ids?.length ?? 0} restaurante(s)`
                      : "Todos"}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{item.body}</p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Publicado em {new Date(item.created_at).toLocaleString("pt-BR")}
                  {item.ends_at ? ` · expira em ${new Date(item.ends_at).toLocaleString("pt-BR")}` : ""}
                </p>
              </div>
              {isAdmin && (
                <div className="flex shrink-0 items-center gap-2">
                  <Switch checked={item.active} onCheckedChange={(v) => toggle(item, v)} aria-label="Ativar aviso" />
                  <Button variant="ghost" size="icon" onClick={() => remove(item)} aria-label="Excluir aviso">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </AdminMizuLayout>
  );
}

export default AdminNotifications;

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminMizuLayout from "@/components/admin-mizu/AdminMizuLayout";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";

type Row = {
  user_id: string; display_name: string | null; created_at: string;
  restaurant_id: string | null; onboarding_complete: boolean;
};

export default function AdminUsers() {
  const [rows, setRows] = useState<Row[]>([]);
  const [restaurants, setRestaurants] = useState<Record<string, string>>({});
  const [roles, setRoles] = useState<Record<string, string[]>>({});
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      const [p, r, ur] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name, created_at, restaurant_id, onboarding_complete").order("created_at", { ascending: false }).limit(200),
        supabase.from("restaurants").select("id, name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (!active) return;
      setRows((p.data ?? []) as Row[]);
      setRestaurants(Object.fromEntries((r.data ?? []).map((x) => [x.id, x.name])));
      const map: Record<string, string[]> = {};
      (ur.data ?? []).forEach((x) => { (map[x.user_id] ??= []).push(x.role as string); });
      setRoles(map);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const filtered = rows.filter((r) =>
    !query.trim() || (r.display_name ?? "").toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <AdminMizuLayout title="Usuários" description="Perfis vinculados à plataforma e seus papéis no restaurante.">
      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome ou e-mail" className="pl-9" />
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((u) => (
            <div key={u.user_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{u.display_name || "Sem nome"}</p>
                <p className="text-xs text-muted-foreground">
                  {u.restaurant_id ? restaurants[u.restaurant_id] ?? "Restaurante removido" : "Sem restaurante vinculado"}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                  {(roles[u.user_id] ?? ["sem papel"]).join(" · ")}
                </span>
                <span className={`rounded-full px-2 py-0.5 ${u.onboarding_complete ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {u.onboarding_complete ? "active" : "invited"}
                </span>
                <span className="text-muted-foreground">{new Date(u.created_at).toLocaleDateString("pt-BR")}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Alterações de papel de plataforma (super administrador) só podem ser feitas por um super administrador diretamente
        na tabela de papéis, com registro em auditoria — nunca automaticamente.
      </p>
    </AdminMizuLayout>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminMizuLayout from "@/components/admin-mizu/AdminMizuLayout";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Users } from "lucide-react";
import { DataTable, Row, Cell, StatusPill, EmptyState, Toolbar, Notice } from "@/components/admin-mizu/ui";

type RowT = {
  user_id: string; display_name: string | null; created_at: string;
  restaurant_id: string | null; onboarding_complete: boolean;
};

export default function AdminUsers() {
  const [rows, setRows] = useState<RowT[]>([]);
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
      setRows((p.data ?? []) as RowT[]);
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
    <AdminMizuLayout
      title="Usuários"
      description="Perfis vinculados à plataforma e seus papéis no restaurante."
      actions={
        <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
          {filtered.length} perfil(is)
        </span>
      }
    >
      <Toolbar>
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome"
            className="border-transparent bg-background/60 pl-9"
          />
        </div>
      </Toolbar>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-2xl" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title="Nenhum usuário encontrado" description="Tente outro termo de busca." />
      ) : (
        <>
          <DataTable head={["Usuário", "Restaurante", "Papéis", "Situação", "Cadastro"]}>
            {filtered.map((u) => (
              <Row key={u.user_id}>
                <Cell><p className="font-medium">{u.display_name || "Sem nome"}</p></Cell>
                <Cell muted>
                  {u.restaurant_id ? restaurants[u.restaurant_id] ?? "Restaurante removido" : "Sem vínculo"}
                </Cell>
                <Cell muted className="capitalize">{(roles[u.user_id] ?? ["sem papel"]).join(" · ")}</Cell>
                <Cell>
                  <StatusPill tone={u.onboarding_complete ? "success" : "warning"}>
                    {u.onboarding_complete ? "Ativo" : "Onboarding pendente"}
                  </StatusPill>
                </Cell>
                <Cell muted className="tabular-nums text-right">{new Date(u.created_at).toLocaleDateString("pt-BR")}</Cell>
              </Row>
            ))}
          </DataTable>

          <div className="space-y-2 md:hidden">
            {filtered.map((u) => (
              <div key={u.user_id} className="rounded-2xl border border-border bg-card/40 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{u.display_name || "Sem nome"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {u.restaurant_id ? restaurants[u.restaurant_id] ?? "Restaurante removido" : "Sem vínculo"}
                    </p>
                  </div>
                  <StatusPill tone={u.onboarding_complete ? "success" : "warning"}>
                    {u.onboarding_complete ? "Ativo" : "Pendente"}
                  </StatusPill>
                </div>
                <p className="mt-2 text-[11px] capitalize text-muted-foreground">
                  {(roles[u.user_id] ?? ["sem papel"]).join(" · ")} · {new Date(u.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="mt-5">
        <Notice>
          Alterações de papel de plataforma (super administrador) só podem ser feitas por um super administrador
          diretamente na tabela de papéis, com registro em auditoria — nunca automaticamente.
        </Notice>
      </div>
    </AdminMizuLayout>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AdminMizuLayout from "@/components/admin-mizu/AdminMizuLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";

const PAGE_SIZE = 20;

type Row = {
  id: string; name: string; slug: string; owner_name: string | null; owner_email: string | null;
  owner_phone: string | null; address: string | null; is_active: boolean; created_at: string;
};

export default function AdminRestaurants() {
  const [rows, setRows] = useState<Row[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setPage(0); }, [query, status]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    let q = supabase
      .from("restaurants")
      .select("id, name, slug, owner_name, owner_email, owner_phone, address, is_active, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (query.trim()) {
      const term = `%${query.trim()}%`;
      q = q.or(`name.ilike.${term},owner_email.ilike.${term},owner_name.ilike.${term},address.ilike.${term}`);
    }
    if (status !== "all") q = q.eq("is_active", status === "active");

    q.then(({ data, count, error }) => {
      if (!active) return;
      if (error) setError(error.message);
      setRows((data ?? []) as Row[]);
      setCount(count ?? 0);
      setLoading(false);
    });
    return () => { active = false; };
  }, [page, query, status]);

  const pages = useMemo(() => Math.max(1, Math.ceil(count / PAGE_SIZE)), [count]);

  return (
    <AdminMizuLayout title="Restaurantes" description={`${count} estabelecimento(s) cadastrados na plataforma.`}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, e-mail, responsável ou endereço"
            className="pl-9"
          />
        </div>
        {(["all", "active", "inactive"] as const).map((s) => (
          <Button key={s} size="sm" variant={status === s ? "hero" : "glass"} onClick={() => setStatus(s)}>
            {s === "all" ? "Todos" : s === "active" ? "Ativos" : "Inativos"}
          </Button>
        ))}
      </div>

      {error && <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">Nenhum restaurante encontrado com esses filtros.</p>
        </div>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-3">Restaurante</th><th className="p-3">Responsável</th>
                  <th className="p-3">Contato</th><th className="p-3">Status</th>
                  <th className="p-3">Cadastro</th><th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="p-3">
                      <p className="font-medium">{r.name}</p>
                      <p className="text-xs text-muted-foreground">/{r.slug}</p>
                    </td>
                    <td className="p-3 text-muted-foreground">{r.owner_name || "—"}</td>
                    <td className="p-3 text-muted-foreground">
                      <p>{r.owner_email || "—"}</p><p className="text-xs">{r.owner_phone || ""}</p>
                    </td>
                    <td className="p-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${r.is_active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {r.is_active ? "Ativo" : "Suspenso"}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground">{new Date(r.created_at).toLocaleDateString("pt-BR")}</td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="glass" asChild>
                        <Link to={`/admin-mizu/restaurantes/${r.id}`}>Abrir <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="space-y-2 md:hidden">
            {rows.map((r) => (
              <Link key={r.id} to={`/admin-mizu/restaurantes/${r.id}`} className="block rounded-xl border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.owner_email || r.owner_name || `/${r.slug}`}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${r.is_active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {r.is_active ? "Ativo" : "Suspenso"}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">Desde {new Date(r.created_at).toLocaleDateString("pt-BR")}</p>
              </Link>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>Página {page + 1} de {pages}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="glass" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="glass" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </AdminMizuLayout>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import AdminMizuLayout from "@/components/admin-mizu/AdminMizuLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, ChevronLeft, ChevronRight, ArrowRight, Store } from "lucide-react";
import { DataTable, Row, Cell, StatusPill, EmptyState, Toolbar, SegmentedControl, Notice } from "@/components/admin-mizu/ui";

const PAGE_SIZE = 20;

type RowT = {
  id: string; name: string; slug: string; owner_name: string | null; owner_email: string | null;
  owner_phone: string | null; address: string | null; is_active: boolean; created_at: string;
};

export default function AdminRestaurants() {
  const [rows, setRows] = useState<RowT[]>([]);
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
      setRows((data ?? []) as RowT[]);
      setCount(count ?? 0);
      setLoading(false);
    });
    return () => { active = false; };
  }, [page, query, status]);

  const pages = useMemo(() => Math.max(1, Math.ceil(count / PAGE_SIZE)), [count]);

  return (
    <AdminMizuLayout title="Restaurantes" description={`${count} estabelecimento(s) cadastrados na plataforma.`}>
      <Toolbar>
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, e-mail, responsável ou endereço"
            className="border-transparent bg-background/60 pl-9"
          />
        </div>
        <SegmentedControl
          value={status}
          onChange={(v) => setStatus(v as "all" | "active" | "inactive")}
          options={[{ id: "all", label: "Todos" }, { id: "active", label: "Ativos" }, { id: "inactive", label: "Inativos" }]}
        />
      </Toolbar>

      {error && <div className="mb-4"><Notice tone="danger">{error}</Notice></div>}

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Store}
          title="Nenhum restaurante encontrado"
          description="Ajuste a busca ou os filtros de status para ver outros resultados."
        />
      ) : (
        <>
          <DataTable head={["Restaurante", "Responsável", "Contato", "Status", "Cadastro", ""]}>
            {rows.map((r) => (
              <Row key={r.id}>
                <Cell>
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground">/{r.slug}</p>
                </Cell>
                <Cell muted>{r.owner_name || "—"}</Cell>
                <Cell muted>
                  <p>{r.owner_email || "—"}</p>
                  {r.owner_phone && <p className="text-xs">{r.owner_phone}</p>}
                </Cell>
                <Cell>
                  <StatusPill tone={r.is_active ? "success" : "neutral"}>{r.is_active ? "Ativo" : "Suspenso"}</StatusPill>
                </Cell>
                <Cell muted className="tabular-nums">{new Date(r.created_at).toLocaleDateString("pt-BR")}</Cell>
                <Cell className="text-right">
                  <Button size="sm" variant="glass" asChild>
                    <Link to={`/admin-mizu/restaurantes/${r.id}`}>Abrir <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link>
                  </Button>
                </Cell>
              </Row>
            ))}
          </DataTable>

          {/* Mobile */}
          <div className="space-y-2 md:hidden">
            {rows.map((r) => (
              <Link
                key={r.id}
                to={`/admin-mizu/restaurantes/${r.id}`}
                className="block rounded-2xl border border-border bg-card/40 p-3.5 transition-colors active:bg-muted/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.owner_email || r.owner_name || `/${r.slug}`}</p>
                  </div>
                  <StatusPill tone={r.is_active ? "success" : "neutral"}>{r.is_active ? "Ativo" : "Suspenso"}</StatusPill>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Desde {new Date(r.created_at).toLocaleDateString("pt-BR")}
                </p>
              </Link>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Página {page + 1} de {pages} · {count} resultado(s)
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="glass" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="Página anterior">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="glass" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Próxima página">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </AdminMizuLayout>
  );
}

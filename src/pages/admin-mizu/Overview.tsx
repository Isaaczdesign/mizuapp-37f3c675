import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminMizuLayout from "@/components/admin-mizu/AdminMizuLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const RANGES = [
  { id: "today", label: "Hoje", days: 0 },
  { id: "7d", label: "7 dias", days: 7 },
  { id: "30d", label: "30 dias", days: 30 },
  { id: "month", label: "Mês atual", days: -1 },
  { id: "all", label: "Tudo", days: -2 },
];

type Stats = Record<string, number | Record<string, number>>;

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function sinceFor(id: string): string | null {
  const now = new Date();
  if (id === "all") return null;
  if (id === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  if (id === "month") return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const days = id === "7d" ? 7 : 30;
  return new Date(now.getTime() - days * 86400000).toISOString();
}

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function AdminOverview() {
  const [range, setRange] = useState("30d");
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    supabase.rpc("platform_overview_stats", { _since: sinceFor(range) }).then(({ data, error }) => {
      if (!active) return;
      if (error) setError(error.message);
      else setStats(data as Stats);
      setLoading(false);
    });
    return () => { active = false; };
  }, [range]);

  const n = (k: string) => Number((stats?.[k] as number) ?? 0);
  const byStatus = (stats?.subscriptions_by_status ?? {}) as Record<string, number>;
  const byPlan = (stats?.subscriptions_by_plan ?? {}) as Record<string, number>;

  return (
    <AdminMizuLayout
      title="Visão geral da plataforma"
      description="Métricas consolidadas de todos os restaurantes da Mizu."
      actions={
        <div className="flex flex-wrap gap-1.5">
          {RANGES.map((r) => (
            <Button key={r.id} size="sm" variant={range === r.id ? "hero" : "glass"} onClick={() => setRange(r.id)}>
              {r.label}
            </Button>
          ))}
        </div>
      }
    >
      {error && (
        <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Não foi possível carregar as métricas: {error}
        </p>
      )}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card label="Restaurantes" value={String(n("restaurants_total"))} hint={`${n("restaurants_new")} novos no período`} />
            <Card label="Ativos" value={String(n("restaurants_active"))} />
            <Card label="Inativos / suspensos" value={String(n("restaurants_inactive"))} />
            <Card label="Usuários" value={String(n("users_total"))} hint={`${n("users_new")} novos no período`} />
            <Card label="Pedidos processados" value={String(n("orders_total"))} />
            <Card label="Pedidos no período" value={String(n("orders_period"))} />
            <Card label="Volume transacionado" value={brl(n("gmv_period"))} hint="Soma dos pedidos não cancelados" />
            <Card label="Assinaturas" value={String(Object.values(byStatus).reduce((a, b) => a + Number(b), 0))} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border p-4">
              <h2 className="text-sm font-semibold">Assinaturas por plano</h2>
              {Object.keys(byPlan).length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Nenhuma assinatura registrada ainda.</p>
              ) : (
                <ul className="mt-3 space-y-1.5 text-sm">
                  {Object.entries(byPlan).map(([k, v]) => (
                    <li key={k} className="flex justify-between"><span className="text-muted-foreground">{k}</span><span>{v}</span></li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-border p-4">
              <h2 className="text-sm font-semibold">Assinaturas por status</h2>
              {Object.keys(byStatus).length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Nenhuma assinatura registrada ainda.</p>
              ) : (
                <ul className="mt-3 space-y-1.5 text-sm">
                  {Object.entries(byStatus).map(([k, v]) => (
                    <li key={k} className="flex justify-between"><span className="text-muted-foreground">{k}</span><span>{v}</span></li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            MRR, inadimplência e conversão de teste aparecerão aqui assim que os dados de cobrança forem integrados —
            a estrutura já está preparada e nenhuma métrica é estimada.
          </p>
        </div>
      )}
    </AdminMizuLayout>
  );
}

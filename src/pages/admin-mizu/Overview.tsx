import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminMizuLayout from "@/components/admin-mizu/AdminMizuLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionCard, StatCard, SegmentedControl, EmptyState, Notice } from "@/components/admin-mizu/ui";
import { Store, CheckCircle2, PauseCircle, Users, ShoppingBag, Clock, Wallet, CreditCard, PieChart } from "lucide-react";

const RANGES = [
  { id: "today", label: "Hoje" },
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "month", label: "Mês atual" },
  { id: "all", label: "Tudo" },
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

function Distribution({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data);
  const total = entries.reduce((a, [, v]) => a + Number(v), 0) || 1;
  return (
    <ul className="space-y-3">
      {entries.map(([k, v]) => (
        <li key={k}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate capitalize text-muted-foreground">{k}</span>
            <span className="tabular-nums font-medium">
              {v}
              <span className="ml-1.5 text-xs text-muted-foreground">{Math.round((Number(v) / total) * 100)}%</span>
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted/60">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(Number(v) / total) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
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
      actions={<SegmentedControl value={range} onChange={setRange} options={RANGES} />}
    >
      {error && (
        <div className="mb-5">
          <Notice tone="danger">Não foi possível carregar as métricas: {error}</Notice>
        </div>
      )}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[112px] rounded-2xl" />)}
        </div>
      ) : (
        <div className="space-y-8">
          <div>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Contas</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard accent icon={Store} label="Restaurantes" value={String(n("restaurants_total"))} hint={`${n("restaurants_new")} novos no período`} />
              <StatCard icon={CheckCircle2} label="Ativos" value={String(n("restaurants_active"))} />
              <StatCard icon={PauseCircle} label="Inativos / suspensos" value={String(n("restaurants_inactive"))} />
              <StatCard icon={Users} label="Usuários" value={String(n("users_total"))} hint={`${n("users_new")} novos no período`} />
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Movimento</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={ShoppingBag} label="Pedidos processados" value={String(n("orders_total"))} hint="Histórico completo" />
              <StatCard icon={Clock} label="Pedidos no período" value={String(n("orders_period"))} />
              <StatCard accent icon={Wallet} label="Volume transacionado" value={brl(n("gmv_period"))} hint="Pedidos não cancelados" />
              <StatCard icon={CreditCard} label="Assinaturas" value={String(Object.values(byStatus).reduce((a, b) => a + Number(b), 0))} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <SectionCard title="Assinaturas por plano" description="Distribuição do catálogo comercial">
              {Object.keys(byPlan).length === 0 ? (
                <EmptyState icon={PieChart} title="Nenhuma assinatura registrada" description="Os planos contratados aparecerão aqui." />
              ) : (
                <Distribution data={byPlan} />
              )}
            </SectionCard>
            <SectionCard title="Assinaturas por status" description="Situação de cobrança das contas">
              {Object.keys(byStatus).length === 0 ? (
                <EmptyState icon={PieChart} title="Nenhuma assinatura registrada" description="Os status de cobrança aparecerão aqui." />
              ) : (
                <Distribution data={byStatus} />
              )}
            </SectionCard>
          </div>

          <Notice>
            MRR, inadimplência e conversão de teste aparecerão aqui assim que os dados de cobrança forem integrados —
            a estrutura já está preparada e nenhuma métrica é estimada.
          </Notice>
        </div>
      )}
    </AdminMizuLayout>
  );
}

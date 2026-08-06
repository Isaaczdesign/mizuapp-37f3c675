import { useMemo, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, AlertTriangle } from "lucide-react";
import { usePlan } from "@/hooks/usePlan";
import PlanComparisonTable from "@/components/plan/PlanComparisonTable";
import { PLAN_LIST, PLANS, brlFromCents, FEATURE_LABELS, type FeatureKey, type PlanCode } from "@/lib/plans";
import { usePageMeta } from "@/hooks/usePageMeta";

const statusLabel: Record<string, string> = {
  none: "Sem assinatura ativa",
  active: "Ativa",
  ativa: "Ativa",
  trial: "Período de teste",
  trialing: "Período de teste",
  past_due: "Pagamento pendente",
  canceled: "Cancelada",
  cancelled: "Cancelada",
};

export default function MyPlan() {
  usePageMeta({ title: "Meu plano · Mizu", description: "Gerencie o plano e a assinatura do seu restaurante." });
  const plan = usePlan();
  const [cycle, setCycle] = useState<"monthly" | "annual">(plan.billingCycle);

  const current = PLANS[plan.planCode];
  const included = useMemo(
    () => Array.from(plan.features) as FeatureKey[],
    [plan.features],
  );

  const price = cycle === "annual" ? current.annualPriceCents : current.monthlyPriceCents;
  const date = (v: string | null) => (v ? new Date(v).toLocaleDateString("pt-BR") : "—");

  return (
    <AdminLayout>
      <div className="mx-auto max-w-5xl space-y-6 py-2">
        <header>
          <h1 className="font-display text-2xl font-semibold">Meu plano</h1>
          <p className="text-sm text-muted-foreground">
            Cada assinatura corresponde a um restaurante ou unidade.
          </p>
        </header>

        {plan.status === "past_due" && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="flex-1">Identificamos um pagamento pendente na sua assinatura.</span>
            <Button size="sm" variant="glass">Regularizar pagamento</Button>
          </div>
        )}

        <section className="rounded-2xl border border-accent/25 bg-card/50 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Plano atual</p>
              <p className="font-display text-2xl font-semibold">{current.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{current.tagline}</p>
            </div>
            <div className="text-right">
              <p className="font-display text-2xl font-semibold tabular-nums">{brlFromCents(price)}</p>
              <p className="text-xs text-muted-foreground">{cycle === "annual" ? "por ano" : "por mês"}</p>
            </div>
          </div>

          <dl className="mt-5 grid gap-4 border-t border-border/60 pt-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Status</dt>
              <dd className="font-medium">{statusLabel[plan.status?.toLowerCase()] ?? plan.status}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Periodicidade</dt>
              <dd className="font-medium">{plan.billingCycle === "annual" ? "Anual" : "Mensal"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                {plan.cancelAtPeriodEnd ? "Ativo até" : "Próxima cobrança"}
              </dt>
              <dd className="font-medium tabular-nums">{date(plan.currentPeriodEnd)}</dd>
            </div>
          </dl>

          {plan.scheduledPlan && (
            <p className="mt-3 rounded-xl border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
              Alteração agendada para {PLANS[plan.scheduledPlan as PlanCode]?.name ?? plan.scheduledPlan} em{" "}
              {date(plan.currentPeriodEnd)}. Seus dados permanecem preservados.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card/40 p-5">
          <h2 className="font-display text-base font-semibold">Funcionalidades incluídas</h2>
          <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {included.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                {FEATURE_LABELS[f] ?? f}
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-base font-semibold">Comparar planos</h2>
            <div className="inline-flex rounded-full border border-border p-0.5">
              {(["monthly", "annual"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCycle(c)}
                  className={`rounded-full px-3 py-1 text-xs transition-colors ${
                    cycle === c ? "bg-accent/15 text-accent" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {c === "monthly" ? "Mensal" : "Anual"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {PLAN_LIST.map((p) => {
              const isCurrent = p.code === plan.planCode;
              return (
                <div
                  key={p.code}
                  className={`flex flex-col rounded-2xl border p-5 ${
                    p.recommended ? "border-accent/40 bg-accent/[0.04]" : "border-border bg-card/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-display font-semibold">{p.name}</p>
                    {p.recommended && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] text-accent">
                        <Sparkles className="h-3 w-3" /> Mais escolhido
                      </span>
                    )}
                  </div>
                  <p className="mt-3 font-display text-2xl font-semibold tabular-nums">
                    {brlFromCents(cycle === "annual" ? p.annualPriceCents : p.monthlyPriceCents)}
                  </p>
                  <p className="text-xs text-muted-foreground">{cycle === "annual" ? "por ano" : "por mês"}</p>
                  <p className="mt-3 flex-1 text-sm text-muted-foreground">{p.tagline}</p>
                  <Button className="mt-4" variant={isCurrent ? "glass" : "default"} disabled={isCurrent}>
                    {isCurrent ? "Plano atual" : p.ctaLabel}
                  </Button>
                </div>
              );
            })}
          </div>

          <PlanComparisonTable currentPlan={plan.planCode} />

          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>· Cada assinatura corresponde a um restaurante ou unidade.</li>
            <li>· Taxas do Mercado Pago não estão incluídas na mensalidade.</li>
            <li>· Custos da Meta ou do provedor de WhatsApp são cobrados separadamente.</li>
            <li>· No downgrade, o plano atual continua ativo até o fim do período pago e nenhum dado é excluído.</li>
          </ul>
        </section>
      </div>
    </AdminLayout>
  );
}

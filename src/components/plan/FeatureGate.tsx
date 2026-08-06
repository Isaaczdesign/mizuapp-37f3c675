import { useState, type ReactNode } from "react";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlan } from "@/hooks/usePlan";
import { PLANS, minPlanFor, FEATURE_LABELS, type FeatureKey } from "@/lib/plans";
import UpgradeDialog from "./UpgradeDialog";
import AdminLayout from "@/components/AdminLayout";

/** Cartão elegante de recurso bloqueado, com CTA de upgrade. */
export function LockedFeatureCard({ feature, compact = false }: { feature: FeatureKey; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const required = minPlanFor(feature);
  const target = PLANS[required];

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-accent/25 bg-card/50 text-center ${
        compact ? "p-5" : "p-8 sm:p-12"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--accent)/0.14),transparent_65%)]" />
      <div className="relative mx-auto max-w-md">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10">
          <Lock className="h-5 w-5 text-accent" />
        </span>
        <h2 className={`font-display font-semibold ${compact ? "text-base" : "text-xl"}`}>
          {FEATURE_LABELS[feature]} disponível a partir do {target.name}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{target.tagline}</p>
        <Button className="mt-5" onClick={() => setOpen(true)}>
          <Sparkles className="mr-2 h-4 w-4" /> Conhecer o {target.name}
        </Button>
      </div>
      <UpgradeDialog open={open} onOpenChange={setOpen} feature={feature} />
    </div>
  );
}

/** Bloqueia um trecho da interface, mostrando o cartão de upgrade no lugar. */
export function FeatureGate({
  feature,
  children,
  fallback,
  compact,
}: {
  feature: FeatureKey;
  children: ReactNode;
  fallback?: ReactNode;
  compact?: boolean;
}) {
  const { hasFeature, loading } = usePlan();
  if (loading) return null;
  if (hasFeature(feature)) return <>{children}</>;
  return <>{fallback ?? <LockedFeatureCard feature={feature} compact={compact} />}</>;
}

/** Guarda de rota: impede o acesso direto pela URL a páginas fora do plano. */
export function FeatureRoute({ feature, children }: { feature: FeatureKey; children: ReactNode }) {
  const { hasFeature, loading } = usePlan();
  if (loading) {
    return (
      <AdminLayout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </AdminLayout>
    );
  }
  if (hasFeature(feature)) return <>{children}</>;
  return (
    <AdminLayout>
      <div className="mx-auto max-w-3xl py-8">
        <LockedFeatureCard feature={feature} />
      </div>
    </AdminLayout>
  );
}

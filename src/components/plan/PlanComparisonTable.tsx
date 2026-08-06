import { Check, Minus, Sparkles } from "lucide-react";
import {
  PLAN_LIST,
  PLAN_FEATURES,
  FEATURE_LABELS,
  STARTER_FEATURES,
  PRO_ONLY_FEATURES,
  PREMIUM_ONLY_FEATURES,
  UPCOMING_PREMIUM_FEATURES,
  type FeatureKey,
  type PlanCode,
} from "@/lib/plans";

const ALL_FEATURES: FeatureKey[] = [...STARTER_FEATURES, ...PRO_ONLY_FEATURES, ...PREMIUM_ONLY_FEATURES];

export default function PlanComparisonTable({ currentPlan }: { currentPlan?: PlanCode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card/40">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-border/70">
            <th className="p-3 text-left font-medium text-muted-foreground">Funcionalidade</th>
            {PLAN_LIST.map((p) => (
              <th key={p.code} className="p-3 text-center font-medium">
                <span className={p.recommended ? "text-accent" : undefined}>{p.name.replace("Mizu ", "")}</span>
                {currentPlan === p.code && (
                  <span className="ml-1.5 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] text-accent">atual</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ALL_FEATURES.map((f) => (
            <tr key={f} className="border-b border-border/40 last:border-0">
              <td className="p-3 text-muted-foreground">{FEATURE_LABELS[f]}</td>
              {PLAN_LIST.map((p) => (
                <td key={p.code} className="p-3 text-center">
                  {PLAN_FEATURES[p.code].includes(f) ? (
                    <Check className="mx-auto h-4 w-4 text-accent" aria-label="Disponível" />
                  ) : (
                    <Minus className="mx-auto h-4 w-4 text-muted-foreground/40" aria-label="Indisponível" />
                  )}
                </td>
              ))}
            </tr>
          ))}
          {UPCOMING_PREMIUM_FEATURES.map((label) => (
            <tr key={label} className="border-b border-border/40 last:border-0">
              <td className="p-3 text-muted-foreground/70">
                {label}
                <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  <Sparkles className="h-2.5 w-2.5" /> Em breve
                </span>
              </td>
              {PLAN_LIST.map((p) => (
                <td key={p.code} className="p-3 text-center text-[11px] text-muted-foreground/50">
                  {p.code === "premium" ? "Em breve" : "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import PlanComparisonTable from "./PlanComparisonTable";
import { PLANS, brlFromCents, minPlanFor, FEATURE_LABELS, type FeatureKey } from "@/lib/plans";
import { usePlan } from "@/hooks/usePlan";

export default function UpgradeDialog({
  open,
  onOpenChange,
  feature,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  feature?: FeatureKey;
}) {
  const navigate = useNavigate();
  const { planCode } = usePlan();
  const required = feature ? minPlanFor(feature) : "pro";
  const target = PLANS[required];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {feature ? `${FEATURE_LABELS[feature]} disponível a partir do ${target.name}` : "Compare os planos Mizu"}
          </DialogTitle>
          <DialogDescription>
            {target.tagline} A partir de {brlFromCents(target.monthlyPriceCents)}/mês. Suporte prioritário incluído em
            todos os planos.
          </DialogDescription>
        </DialogHeader>

        <PlanComparisonTable currentPlan={planCode} />

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Agora não
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              navigate(`/settings/plano?upgrade=${required}`);
            }}
          >
            Conhecer o {target.name}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

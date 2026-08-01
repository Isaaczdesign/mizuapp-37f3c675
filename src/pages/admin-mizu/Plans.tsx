import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminMizuLayout from "@/components/admin-mizu/AdminMizuLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { usePlatformRole, logPlatformAction } from "@/hooks/usePlatformRole";
import { EmptyState, Notice, StatusPill } from "@/components/admin-mizu/ui";
import { Package, Sparkles } from "lucide-react";

type Plan = {
  id: string; code: string; name: string; description: string | null; price_cents: number;
  interval: string; trial_days: number; features: unknown; limits: unknown;
  is_active: boolean; is_recommended: boolean;
};

const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function AdminPlans() {
  const { isAdmin } = usePlatformRole();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("platform_plans").select("*").order("sort_order");
    setPlans((data ?? []) as Plan[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const toggle = async (p: Plan) => {
    const { error } = await supabase.from("platform_plans").update({ is_active: !p.is_active }).eq("id", p.id);
    if (error) return toast.error(error.message);
    await logPlatformAction({
      action: p.is_active ? "plan.deactivated" : "plan.activated",
      entityType: "plan", entityId: p.id, oldValue: { is_active: p.is_active }, newValue: { is_active: !p.is_active },
    });
    toast.success("Plano atualizado.");
    load();
  };

  return (
    <AdminMizuLayout title="Planos" description="Catálogo comercial da Mizu. Alterações de preço não são retroativas.">
      <div className="mb-5">
        <Notice tone="warning">
          Alterar preço, recursos ou limites de um plano existente afeta os novos ciclos dos clientes atuais.
          Nenhuma mudança é aplicada retroativamente de forma automática.
        </Notice>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-2xl" />)}</div>
      ) : plans.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nenhum plano cadastrado"
          description="A estrutura de planos, recursos e limites já está criada no banco e pronta para uso."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.id}
              className={`flex flex-col rounded-2xl border bg-card/40 p-5 transition-colors ${
                p.is_recommended ? "border-primary/40 bg-primary/[0.04]" : "border-border hover:border-primary/30"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-display text-base font-semibold">{p.name}</p>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{p.code} · {p.interval}</p>
                </div>
                {p.is_recommended && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                    <Sparkles className="h-3 w-3" /> Recomendado
                  </span>
                )}
              </div>

              <p className="mt-4 font-display text-3xl font-semibold tabular-nums tracking-tight">{brl(p.price_cents)}</p>
              <p className="text-xs text-muted-foreground">{p.trial_days} dias de teste</p>
              {p.description && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.description}</p>}

              <div className="mt-5 flex items-center justify-between border-t border-border/70 pt-4">
                <StatusPill tone={p.is_active ? "success" : "neutral"}>{p.is_active ? "Ativo" : "Inativo"}</StatusPill>
                {isAdmin && (
                  <Button size="sm" variant="glass" onClick={() => toggle(p)}>
                    {p.is_active ? "Desativar" : "Ativar"}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminMizuLayout>
  );
}

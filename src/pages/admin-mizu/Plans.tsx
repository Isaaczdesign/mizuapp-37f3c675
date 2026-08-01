import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminMizuLayout from "@/components/admin-mizu/AdminMizuLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { usePlatformRole, logPlatformAction } from "@/hooks/usePlatformRole";

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
      <p className="mb-4 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        Atenção: alterar preço, recursos ou limites de um plano existente afeta os novos ciclos dos clientes atuais.
        Nenhuma mudança é aplicada retroativamente de forma automática.
      </p>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}</div>
      ) : plans.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">Nenhum plano cadastrado ainda.</p>
          <p className="mt-1 text-xs text-muted-foreground">A estrutura de planos, recursos e limites já está criada no banco.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {plans.map((p) => (
            <div key={p.id} className="rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-base font-semibold">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.code} · {p.interval}</p>
                </div>
                {p.is_recommended && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">Recomendado</span>}
              </div>
              <p className="mt-3 font-display text-2xl font-semibold">{brl(p.price_cents)}</p>
              <p className="text-xs text-muted-foreground">{p.trial_days} dias de teste</p>
              {p.description && <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>}
              <div className="mt-3 flex items-center justify-between">
                <span className={`rounded-full px-2 py-0.5 text-xs ${p.is_active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {p.is_active ? "Ativo" : "Inativo"}
                </span>
                {isAdmin && <Button size="sm" variant="glass" onClick={() => toggle(p)}>{p.is_active ? "Desativar" : "Ativar"}</Button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminMizuLayout>
  );
}

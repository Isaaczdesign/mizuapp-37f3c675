import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PLAN_FEATURES, type FeatureKey, type PlanCode } from "@/lib/plans";

interface PlanState {
  loading: boolean;
  planCode: PlanCode;
  planName: string;
  status: string;
  billingCycle: "monthly" | "annual";
  currentPeriodEnd: string | null;
  currentPeriodStart: string | null;
  cancelAtPeriodEnd: boolean;
  scheduledPlan: string | null;
  features: Set<string>;
  hasFeature: (key: FeatureKey) => boolean;
  refresh: () => Promise<void>;
}

const fallback = (): PlanState => ({
  loading: true,
  planCode: "starter",
  planName: "Mizu Starter",
  status: "none",
  billingCycle: "monthly",
  currentPeriodEnd: null,
  currentPeriodStart: null,
  cancelAtPeriodEnd: false,
  scheduledPlan: null,
  features: new Set(PLAN_FEATURES.starter),
  hasFeature: () => false,
  refresh: async () => {},
});

const PlanContext = createContext<PlanState>(fallback());

export const usePlan = () => useContext(PlanContext);
export function useFeature(key: FeatureKey) {
  const { hasFeature, loading } = usePlan();
  return { allowed: hasFeature(key), loading };
}

export function PlanProvider({ children }: { children: ReactNode }) {
  const { user, profile, loading: authLoading } = useAuth();
  const restaurantId = profile?.restaurant_id ?? null;

  const [state, setState] = useState(() => ({
    loading: true,
    planCode: "starter" as PlanCode,
    planName: "Mizu Starter",
    status: "none",
    billingCycle: "monthly" as "monthly" | "annual",
    currentPeriodEnd: null as string | null,
    currentPeriodStart: null as string | null,
    cancelAtPeriodEnd: false,
    scheduledPlan: null as string | null,
    features: new Set<string>(PLAN_FEATURES.starter),
  }));

  const load = useCallback(async () => {
    if (!user || !restaurantId) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    const { data, error } = await supabase.rpc("get_my_plan");
    const row = Array.isArray(data) ? data[0] : null;
    if (error || !row) {
      // fail-closed no plano base
      setState((s) => ({ ...s, loading: false, features: new Set(PLAN_FEATURES.starter) }));
      return;
    }
    const code = (row.plan_code ?? "starter") as PlanCode;
    setState({
      loading: false,
      planCode: code,
      planName: row.plan_name ?? "Mizu Starter",
      status: row.status ?? "none",
      billingCycle: (row.billing_cycle === "annual" ? "annual" : "monthly"),
      currentPeriodEnd: row.current_period_end ?? null,
      currentPeriodStart: row.current_period_start ?? null,
      cancelAtPeriodEnd: !!row.cancel_at_period_end,
      scheduledPlan: row.scheduled_plan ?? null,
      features: new Set<string>(row.features ?? PLAN_FEATURES[code] ?? []),
    });
  }, [user, restaurantId]);

  useEffect(() => {
    if (authLoading) return;
    load();
  }, [authLoading, load]);

  const value = useMemo<PlanState>(
    () => ({
      ...state,
      hasFeature: (key: FeatureKey) => state.features.has(key),
      refresh: load,
    }),
    [state, load],
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

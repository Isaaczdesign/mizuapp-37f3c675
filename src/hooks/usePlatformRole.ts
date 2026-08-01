import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type PlatformRole = "super_admin" | "admin" | "support";

/**
 * Papéis de plataforma (equipe Mizu). A verificação real acontece no banco via RLS —
 * este hook serve apenas para exibir/ocultar a interface.
 */
export function usePlatformRole() {
  const { user, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<PlatformRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (authLoading) return;
    if (!user) { setRoles([]); setLoading(false); return; }
    setLoading(true);
    supabase
      .from("platform_user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (!active) return;
        setRoles((data ?? []).map((r) => r.role as PlatformRole));
        setLoading(false);
      });
    return () => { active = false; };
  }, [user, authLoading]);

  const isSuperAdmin = roles.includes("super_admin");
  const isAdmin = isSuperAdmin || roles.includes("admin");
  const isStaff = roles.length > 0;

  return { roles, loading: loading || authLoading, isStaff, isAdmin, isSuperAdmin, user };
}

export async function logPlatformAction(params: {
  action: string; entityType: string; entityId?: string;
  oldValue?: unknown; newValue?: unknown; reason?: string;
}) {
  await supabase.rpc("log_platform_action", {
    _action: params.action,
    _entity_type: params.entityType,
    _entity_id: params.entityId ?? null,
    _old: (params.oldValue ?? null) as never,
    _new: (params.newValue ?? null) as never,
    _reason: params.reason ?? null,
  });
}

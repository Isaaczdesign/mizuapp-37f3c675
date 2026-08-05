import type { ReactNode } from "react";
import { Navigate } from "@/lib/router-compat";
import { useAuth } from "@/hooks/useAuth";
import Onboarding from "@/components/Onboarding";

export default function ProtectedRoute({ children, allowedRoles }: { children: ReactNode; allowedRoles?: string[] }) {
  const { user, loading, profile, roles } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!profile?.restaurant_id || !profile?.onboarding_complete) return <Onboarding />;
  // Role check
  if (allowedRoles && allowedRoles.length > 0) {
    const userRoles = roles.length > 0 ? roles : ["owner"]; // fallback
    const hasAccess = allowedRoles.some((r) => userRoles.includes(r));
    if (!hasAccess) return <Navigate to="/kds" replace />;
  }
  return <>{children}</>;
}

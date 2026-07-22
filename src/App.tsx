import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Onboarding from "@/components/Onboarding";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import KDS from "./pages/KDS";
import PublicMenu from "./pages/PublicMenu";
import Customers from "./pages/Customers";
import Tables from "./pages/Tables";
import MenuAdmin from "./pages/MenuAdmin";
import Automations from "./pages/Automations";
import Agenda from "./pages/Agenda";
import NotFound from "./pages/NotFound";
import Settings from "./pages/Settings";
import NotificationSettings from "./pages/NotificationSettings";
import OrderTracking from "./pages/OrderTracking";

const queryClient = new QueryClient();

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/m/:slug" element={<PublicMenu />} />
            <Route path="/r/:slug" element={<PublicMenu />} />
            <Route path="/pedido/:token" element={<OrderTracking />} />
            <Route path="/dashboard" element={<ProtectedRoute allowedRoles={["owner", "manager"]}><Dashboard /></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute allowedRoles={["owner", "manager", "staff"]}><Orders /></ProtectedRoute>} />
            <Route path="/kds" element={<ProtectedRoute><KDS /></ProtectedRoute>} />
            <Route path="/menu-admin" element={<ProtectedRoute allowedRoles={["owner", "manager"]}><MenuAdmin /></ProtectedRoute>} />
            <Route path="/customers" element={<ProtectedRoute allowedRoles={["owner", "manager", "staff"]}><Customers /></ProtectedRoute>} />
            <Route path="/tables" element={<ProtectedRoute allowedRoles={["owner", "manager"]}><Tables /></ProtectedRoute>} />
            <Route path="/automations" element={<ProtectedRoute allowedRoles={["owner", "manager"]}><Automations /></ProtectedRoute>} />
            <Route path="/agenda" element={<ProtectedRoute allowedRoles={["owner", "manager", "staff"]}><Agenda /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute allowedRoles={["owner", "manager"]}><Settings /></ProtectedRoute>} />
            <Route path="/settings/notifications" element={<ProtectedRoute><NotificationSettings /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

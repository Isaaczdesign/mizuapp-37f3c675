import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import KDS from "./pages/KDS";
import PublicMenu from "./pages/PublicMenu";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
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
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
            <Route path="/kds" element={<ProtectedRoute><KDS /></ProtectedRoute>} />
            <Route path="/menu-admin" element={<ProtectedRoute><div className="min-h-screen bg-background flex items-center justify-center text-foreground">Gestão de Cardápio — em breve</div></ProtectedRoute>} />
            <Route path="/customers" element={<ProtectedRoute><div className="min-h-screen bg-background flex items-center justify-center text-foreground">CRM — em breve</div></ProtectedRoute>} />
            <Route path="/tables" element={<ProtectedRoute><div className="min-h-screen bg-background flex items-center justify-center text-foreground">Mesas — em breve</div></ProtectedRoute>} />
            <Route path="/automations" element={<ProtectedRoute><div className="min-h-screen bg-background flex items-center justify-center text-foreground">Automações — em breve</div></ProtectedRoute>} />
            <Route path="/agenda" element={<ProtectedRoute><div className="min-h-screen bg-background flex items-center justify-center text-foreground">Agenda — em breve</div></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

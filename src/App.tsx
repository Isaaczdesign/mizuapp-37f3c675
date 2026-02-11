import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<div className="flex items-center justify-center min-h-screen bg-background text-foreground">Login — em breve</div>} />
          <Route path="/dashboard" element={<div className="flex items-center justify-center min-h-screen bg-background text-foreground">Dashboard — em breve</div>} />
          <Route path="/orders" element={<div className="flex items-center justify-center min-h-screen bg-background text-foreground">Pedidos — em breve</div>} />
          <Route path="/kds" element={<div className="flex items-center justify-center min-h-screen bg-background text-foreground">KDS Cozinha — em breve</div>} />
          <Route path="/menu-admin" element={<div className="flex items-center justify-center min-h-screen bg-background text-foreground">Gestão de Cardápio — em breve</div>} />
          <Route path="/customers" element={<div className="flex items-center justify-center min-h-screen bg-background text-foreground">CRM — em breve</div>} />
          <Route path="/tables" element={<div className="flex items-center justify-center min-h-screen bg-background text-foreground">Mesas — em breve</div>} />
          <Route path="/automations" element={<div className="flex items-center justify-center min-h-screen bg-background text-foreground">Automações — em breve</div>} />
          <Route path="/agenda" element={<div className="flex items-center justify-center min-h-screen bg-background text-foreground">Agenda — em breve</div>} />
          <Route path="/m/:slug" element={<div className="flex items-center justify-center min-h-screen bg-background text-foreground">Cardápio Público — em breve</div>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

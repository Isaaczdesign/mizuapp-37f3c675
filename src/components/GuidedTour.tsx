import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { QrCode, PlusCircle, ChefHat, LayoutDashboard, ArrowRight, ArrowLeft, Check, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { isTourPending, finishTour } from "@/lib/guidedTour";

type TourStep = {
  route: string;
  icon: typeof QrCode;
  title: string;
  text: string;
  tip: string;
};

export const TOUR_STEPS: TourStep[] = [
  {
    route: "/menu-admin",
    icon: QrCode,
    title: "Cardápio e QR Code",
    text: "Cadastre itens, importe o cardápio com IA e personalize o layout público.",
    tip: "Na aba Personalizar você troca o template e copia o link /q/ do QR.",
  },
  {
    route: "/orders",
    icon: PlusCircle,
    title: "Criar pedido manual",
    text: "Atendimento por telefone ou balcão? Use “Novo pedido” para lançar direto.",
    tip: "Pedidos manuais entram no mesmo fluxo dos pedidos do QR.",
  },
  {
    route: "/kds",
    icon: ChefHat,
    title: "Cozinha (KDS)",
    text: "A cozinha vê os pedidos em tempo real e avança os status com um toque.",
    tip: "Alertas sonoros e cores por tempo de espera ajudam a priorizar.",
  },
  {
    route: "/dashboard",
    icon: LayoutDashboard,
    title: "Painel de pedidos",
    text: "Acompanhe vendas, ticket médio e o desempenho do expediente.",
    tip: "As notificações de novos pedidos aparecem em qualquer aba do painel.",
  },
];

export default function GuidedTour() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (user?.id && isTourPending(user.id)) {
      setActive(true);
      setIndex(0);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!active) return;
    const target = TOUR_STEPS[index].route;
    if (location.pathname !== target) navigate(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, index]);

  const close = (completed: boolean) => {
    finishTour(user?.id);
    setActive(false);
    if (completed) navigate("/dashboard");
  };

  if (!active) return null;
  const step = TOUR_STEPS[index];
  const Icon = step.icon;

  return (
    <AnimatePresence>
      <motion.div
        key="tour"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
        className="fixed z-[70] left-3 right-3 bottom-24 md:left-auto md:right-6 md:bottom-6 md:w-[360px]"
      >
        <div className="rounded-2xl border border-border/70 bg-card/95 backdrop-blur-xl shadow-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/15 text-primary p-2.5">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                <Sparkles className="h-3 w-3" /> Tour guiado · {index + 1}/{TOUR_STEPS.length}
              </div>
              <h3 className="mt-1 font-semibold leading-tight">{step.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{step.text}</p>
              <p className="mt-2 text-xs text-primary/90">{step.tip}</p>
            </div>
            <button
              onClick={() => close(false)}
              aria-label="Fechar tour"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-1.5">
            {TOUR_STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${i <= index ? "bg-primary" : "bg-border"}`}
              />
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={() => close(false)}>Pular</Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                disabled={index === 0}
              >
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              {index === TOUR_STEPS.length - 1 ? (
                <Button size="sm" onClick={() => close(true)}>
                  Concluir <Check className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button size="sm" onClick={() => setIndex((i) => i + 1)}>
                  Próximo <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, Loader2, ChevronRight, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { loadActiveOrders, saveRecentOrder } from "@/lib/publicMenuStorage";
import { toast } from "sonner";

type Found = { tracking_token: string; status: string; created_at: string; total: number; restaurant_slug: string | null };

const STATUS_LABELS: Record<string, string> = {
  new: "Pedido recebido",
  preparing: "Em preparo",
  ready: "Pronto",
  out_for_delivery: "A caminho",
};

/**
 * Ícone flutuante (canto superior direito) para recuperar pedidos em andamento
 * das últimas 24h pelo WhatsApp — funciona mesmo após limpar cache ou trocar de
 * navegador/aparelho. Exibe contador quando há pedidos recentes salvos no
 * navegador para facilitar o retorno ao acompanhamento.
 */
export default function RecoverOrdersByWhatsapp({
  restaurantId,
  restaurantSlug,
  accentColor = "#E84310",
}: {
  restaurantId: string;
  restaurantSlug?: string | null;
  accentColor?: string;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Found[] | null>(null);
  const [recentCount, setRecentCount] = useState(0);

  // Atualiza contagem de pedidos recentes salvos no navegador
  useEffect(() => {
    const refresh = () => {
      try {
        setRecentCount(loadActiveOrders(restaurantSlug ?? null).length);
      } catch {
        setRecentCount(0);
      }
    };
    refresh();
    const onFocus = () => refresh();
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key.includes("recent-orders")) refresh();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    const t = setInterval(refresh, 15_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
      clearInterval(t);
    };
  }, [restaurantSlug]);

  // Fecha com ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function search() {
    if (phone.replace(/\D/g, "").length < 10) {
      toast.error("Informe o WhatsApp com DDD usado no pedido");
      return;
    }
    if (name.trim().length < 2) {
      toast.error("Informe o nome usado no pedido");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc("get_active_orders_by_whatsapp", {
        _restaurant_id: restaurantId,
        _whatsapp: phone,
        _name: name.trim(),
      });
      if (error) throw error;
      const rows = (data ?? []) as Found[];
      rows.forEach((r) =>
        saveRecentOrder({ token: r.tracking_token, status: r.status, slug: r.restaurant_slug }),
      );
      setResults(rows);
      if (rows.length === 1) navigate(`/pedido/${rows[0].tracking_token}`);
      if (rows.length === 0) toast.info("Nenhum pedido em andamento nas últimas 24h para este número.");
    } catch (e: any) {
      console.error(e);
      toast.error("Não foi possível buscar seus pedidos. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function close() {
    setOpen(false);
    setResults(null);
  }

  const label = recentCount > 0
    ? `Recuperar meu pedido (${recentCount} em andamento)`
    : "Recuperar meu pedido";

  return (
    <>
      {/* Ícone flutuante */}
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpen(true);
                }
              }}
              aria-label={label}
              aria-haspopup="dialog"
              aria-expanded={open}
              className="fixed bottom-24 right-4 z-[100] w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-white active:scale-95 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              style={{
                background: accentColor,
                boxShadow: `0 8px 24px ${accentColor}66, 0 0 0 4px ${accentColor}22`,
              }}
            >
              <History className="w-5 h-5" aria-hidden="true" />
              {recentCount > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[11px] font-bold flex items-center justify-center border-2 border-background animate-scale-in"
                >
                  {recentCount > 9 ? "9+" : recentCount}
                </span>
              )}
              <span className="sr-only">{label}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="left" sideOffset={8}>
            {recentCount > 0
              ? `${recentCount} pedido${recentCount > 1 ? "s" : ""} em andamento — toque para acompanhar`
              : "Recuperar meu pedido pelo WhatsApp"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Modal */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="recover-order-title"
          className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={close}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-4 space-y-3 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span id="recover-order-title" className="text-sm font-bold">
                Recuperar meu pedido
              </span>
              <button aria-label="Fechar" onClick={close} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Informe o nome e o WhatsApp usados no pedido. Buscamos pedidos em andamento das últimas 24 horas.
            </p>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
              autoFocus
              aria-label="Nome usado no pedido"
              onKeyDown={(e) => e.key === "Enter" && search()}
            />
            <div className="flex gap-2">
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 99999-9999"
                inputMode="tel"
                aria-label="WhatsApp usado no pedido"
                onKeyDown={(e) => e.key === "Enter" && search()}
              />

              <Button
                onClick={search}
                disabled={loading}
                aria-label="Buscar pedidos"
                style={{ background: accentColor }}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
            {results && results.length > 0 && (
              <div className="rounded-xl border border-border overflow-hidden">
                {results.map((r) => (
                  <button
                    key={r.tracking_token}
                    onClick={() => navigate(`/pedido/${r.tracking_token}`)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-secondary/60 border-b border-border last:border-0 focus:outline-none focus-visible:bg-secondary/60"
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium">{STATUS_LABELS[r.status] ?? "Em andamento"}</span>
                      <span className="block text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString("pt-BR")}
                      </span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

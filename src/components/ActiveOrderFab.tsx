import { useEffect, useState, useCallback } from "react";
import { useLocation, useNavigate } from "@/lib/router-compat";
import { motion, AnimatePresence } from "framer-motion";
import { ClipboardList, ChevronRight, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  loadActiveOrders,
  saveRecentOrder,
  removeRecentOrder,
  TERMINAL_ORDER_STATUSES,
  type RecentOrder,
} from "@/lib/publicMenuStorage";

const STATUS_LABELS: Record<string, string> = {
  new: "Pedido recebido",
  preparing: "Em preparo",
  ready: "Pronto",
  out_for_delivery: "A caminho",
};

// Rotas administrativas / internas — o botão é só para o cliente.
const HIDDEN_PREFIXES = [
  "/dashboard", "/orders", "/kds", "/menu-admin", "/customers", "/tables",
  "/automations", "/agenda", "/settings", "/expediente", "/auth", "/reset-password",
];

export default function ActiveOrderFab() {
  const location = useLocation();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Esconde o botão enquanto qualquer modal/drawer estiver aberto
  useEffect(() => {
    const check = () => setDialogOpen(!!document.querySelector('[role="dialog"][aria-modal="true"]'));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);

  const hidden =
    HIDDEN_PREFIXES.some((p) => location.pathname.startsWith(p)) ||
    location.pathname.startsWith("/pedido/");

  const refresh = useCallback(async () => {
    const stored = loadActiveOrders();
    if (!stored.length) { setOrders([]); return; }
    const rows = await Promise.all(
      stored.map(async (o) => {
        try {
          const { data } = await (supabase as any).rpc("get_public_order", { _token: o.token });
          const row = Array.isArray(data) ? data[0] : data;
          if (!row) { removeRecentOrder(o.token); return null; }
          saveRecentOrder({ token: o.token, status: row.status, slug: row.restaurant_slug ?? o.slug });
          if (TERMINAL_ORDER_STATUSES.includes(String(row.status))) return null;
          return { ...o, status: row.status as string };
        } catch {
          return o;
        }
      }),
    );
    setOrders(rows.filter(Boolean) as RecentOrder[]);
  }, []);

  useEffect(() => {
    if (hidden) return;
    refresh();
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, [hidden, refresh, location.pathname]);

  if (hidden || dismissed || dialogOpen || orders.length === 0) return null;

  const primary = orders[0];

  return (
    <div className="fixed bottom-24 right-4 z-[45] flex flex-col items-end gap-2 print:hidden">
      <AnimatePresence>
        {expanded && orders.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            className="w-64 rounded-2xl border border-border bg-card shadow-xl overflow-hidden"
          >
            {orders.map((o) => (
              <button
                key={o.token}
                onClick={() => navigate(`/pedido/${o.token}`)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-secondary/60 border-b border-border last:border-0"
              >
                <span className="flex-1 min-w-0 text-sm font-medium truncate">
                  {STATUS_LABELS[String(o.status)] ?? "Pedido em andamento"}
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-1"
      >
        <button
          onClick={() => (orders.length > 1 ? setExpanded((v) => !v) : navigate(`/pedido/${primary.token}`))}
          className="flex items-center gap-2 pl-3 pr-4 py-3 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 font-bold text-sm active:scale-95 transition-transform"
        >
          <span className="relative flex items-center justify-center">
            <ClipboardList className="w-4 h-4" />
            <span className="absolute -top-1.5 -right-1.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </span>
          <span className="flex flex-col items-start leading-tight">
            <span>Acompanhar pedido</span>
            <span className="text-[10px] font-medium opacity-80">
              {orders.length > 1 ? `${orders.length} pedidos em andamento` : STATUS_LABELS[String(primary.status)] ?? "Em andamento"}
            </span>
          </span>
        </button>
        <button
          aria-label="Ocultar"
          onClick={() => setDismissed(true)}
          className="w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center text-muted-foreground"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </motion.div>
    </div>
  );
}

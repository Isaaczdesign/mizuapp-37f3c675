import { useEffect, useCallback, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, X, ChevronRight, Bell, ArrowUpLeft, ArrowUp, ArrowUpRight, ArrowDownLeft, ArrowDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotificationPrefs, PopupPosition } from "@/hooks/useNotificationPrefs";

interface NewOrderPayload {
  id: string;
  total: number;
  status: string;
  created_at: string;
  table_id: string | null;
  customer_id: string | null;
  notes: string | null;
}

interface OrderPopup extends NewOrderPayload {
  customerName?: string;
  tableNumber?: number;
  items?: { name: string; quantity: number }[];
}

const positionClass: Record<PopupPosition, string> = {
  "top-left": "top-4 left-4",
  "top-center": "top-4 left-1/2 -translate-x-1/2",
  "top-right": "top-4 right-4",
  "bottom-left": "bottom-4 left-4",
  "bottom-right": "bottom-4 right-4",
};

export default function OrderNotificationProvider() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const restaurantId = profile?.restaurant_id;
  const { prefs, save } = useNotificationPrefs();
  const [popup, setPopup] = useState<OrderPopup | null>(null);
  const autoCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenOrderIds = useRef<Set<string>>(new Set());

  const playSound = useCallback(() => {
    if (!prefs.sound_enabled) return;
    try {
      const ctx = new AudioContext();
      const playBeep = (freq: number, startTime: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = "sine";
        gain.gain.setValueAtTime(0.3, ctx.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + startTime + 0.4);
        osc.start(ctx.currentTime + startTime);
        osc.stop(ctx.currentTime + startTime + 0.4);
      };
      playBeep(880, 0);
      playBeep(1100, 0.15);
      playBeep(1320, 0.3);
    } catch {}
  }, [prefs.sound_enabled]);

  const showBrowserNotification = useCallback((order: OrderPopup) => {
    if (!prefs.browser_push_enabled) return;
    if ("Notification" in window && Notification.permission === "granted") {
      const body = [
        order.customerName && `Cliente: ${order.customerName}`,
        order.tableNumber && `Mesa ${order.tableNumber}`,
        `Total: R$${Number(order.total).toFixed(2)}`,
      ].filter(Boolean).join(" · ");

      const notif = new Notification("🔔 Novo Pedido!", {
        body,
        icon: "/favicon.ico",
        tag: `order-${order.id}`,
        requireInteraction: true,
      });

      notif.onclick = () => {
        window.focus();
        navigate("/orders");
        notif.close();
      };
    }
  }, [navigate, prefs.browser_push_enabled]);

  const enrichOrder = useCallback(async (payload: NewOrderPayload): Promise<OrderPopup> => {
    const enriched: OrderPopup = { ...payload };
    try {
      if (payload.customer_id) {
        const { data } = await supabase.from("customers").select("name").eq("id", payload.customer_id).single();
        if (data) enriched.customerName = data.name;
      }
      if (payload.table_id) {
        const { data } = await supabase.from("restaurant_tables").select("number").eq("id", payload.table_id).single();
        if (data) enriched.tableNumber = data.number;
      }
      const { data: items } = await supabase.from("order_items").select("name, quantity").eq("order_id", payload.id);
      if (items) enriched.items = items;
    } catch {}
    return enriched;
  }, []);

  const handleNewOrder = useCallback(async (payload: any) => {
    const order = payload.new as NewOrderPayload;
    if (seenOrderIds.current.has(order.id)) return;
    seenOrderIds.current.add(order.id);
    const enriched = await enrichOrder(order);

    playSound();
    showBrowserNotification(enriched);
    if (prefs.popup_enabled) {
      setPopup(enriched);
      if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
      autoCloseTimer.current = setTimeout(() => setPopup(null), 20000);
    }
  }, [playSound, showBrowserNotification, enrichOrder, prefs.popup_enabled]);

  useEffect(() => {
    if (!restaurantId) return;

    // Marca os pedidos já existentes como "vistos" para não estourar popup antigo ao carregar
    (async () => {
      const { data } = await supabase
        .from("orders")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false })
        .limit(200);
      (data ?? []).forEach((o: any) => seenOrderIds.current.add(o.id));
    })();

    const channel = supabase
      .channel("global-order-notif")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "orders",
        filter: `restaurant_id=eq.${restaurantId}`,
      }, handleNewOrder)
      .subscribe();

    // Fallback: se um evento realtime for perdido (ex.: pedido PIX pendente),
    // detectamos novos pedidos por polling e disparamos o popup mesmo assim.
    const poll = setInterval(async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, total, status, created_at, table_id, customer_id, notes")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false })
        .limit(20);
      for (const o of (data ?? []) as NewOrderPayload[]) {
        if (!seenOrderIds.current.has(o.id)) {
          await handleNewOrder({ new: o });
        }
      }
    }, 8000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
      if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
    };
  }, [restaurantId, handleNewOrder]);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const movePopup = (pos: PopupPosition) => {
    save({ popup_position: pos });
    if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
    autoCloseTimer.current = setTimeout(() => setPopup(null), 20000);
  };

  return (
    <AnimatePresence>
      {popup && (
        <motion.div
          key={prefs.popup_position}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className={`fixed z-[70] w-[360px] max-w-[calc(100vw-2rem)] ${positionClass[prefs.popup_position]}`}
        >
          <div className="glass-card border border-primary/30 shadow-2xl shadow-primary/10 overflow-hidden">
            {/* Header */}
            <div className="bg-primary/10 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-display font-bold text-sm">Novo Pedido!</p>
                  <p className="text-xs text-muted-foreground font-mono">#{popup.id.slice(0, 8)}</p>
                </div>
              </div>
              <button
                onClick={() => setPopup(null)}
                className="p-1 rounded-lg hover:bg-secondary transition-colors"
                aria-label="Fechar"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Reposition bar */}
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-background/40">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Mover</span>
              <div className="flex gap-0.5">
                <button onClick={() => movePopup("top-left")} className="p-1 rounded hover:bg-secondary" title="Superior esquerda">
                  <ArrowUpLeft className="w-3 h-3" />
                </button>
                <button onClick={() => movePopup("top-center")} className="p-1 rounded hover:bg-secondary" title="Superior centro">
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button onClick={() => movePopup("top-right")} className="p-1 rounded hover:bg-secondary" title="Superior direita">
                  <ArrowUpRight className="w-3 h-3" />
                </button>
                <button onClick={() => movePopup("bottom-left")} className="p-1 rounded hover:bg-secondary" title="Inferior esquerda">
                  <ArrowDownLeft className="w-3 h-3" />
                </button>
                <button onClick={() => movePopup("bottom-right")} className="p-1 rounded hover:bg-secondary" title="Inferior direita">
                  <ArrowDownRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3">
              {(popup.customerName || popup.tableNumber) && (
                <div className="flex items-center gap-3 text-sm">
                  {popup.customerName && <span className="font-medium">{popup.customerName}</span>}
                  {popup.tableNumber && (
                    <span className="px-2 py-0.5 rounded-full bg-secondary text-xs">Mesa {popup.tableNumber}</span>
                  )}
                </div>
              )}

              {popup.items && popup.items.length > 0 && (
                <div className="space-y-1">
                  {popup.items.slice(0, 4).map((item, i) => (
                    <div key={i} className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <span className="text-foreground font-medium">{item.quantity}x</span>
                      <span>{item.name}</span>
                    </div>
                  ))}
                  {popup.items.length > 4 && (
                    <p className="text-xs text-muted-foreground">+{popup.items.length - 4} itens</p>
                  )}
                </div>
              )}

              {popup.notes && <p className="text-xs text-muted-foreground italic">📝 {popup.notes}</p>}

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="font-display font-bold text-lg text-primary">{fmt(Number(popup.total))}</span>
                <Button
                  variant="hero"
                  size="sm"
                  onClick={() => {
                    setPopup(null);
                    navigate("/orders");
                  }}
                  className="gap-1"
                >
                  Ver Pedido
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

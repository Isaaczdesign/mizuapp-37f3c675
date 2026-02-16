import { useEffect, useCallback, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, X, ChevronRight, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

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

export default function OrderNotificationProvider() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const restaurantId = profile?.restaurant_id;
  const [popup, setPopup] = useState<OrderPopup | null>(null);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");
  const autoCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window) {
      setNotifPermission(Notification.permission);
      if (Notification.permission === "default") {
        Notification.requestPermission().then(setNotifPermission);
      }
    }
  }, []);

  // Play sound
  const playSound = useCallback(() => {
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
  }, []);

  // Show browser push notification
  const showBrowserNotification = useCallback((order: OrderPopup) => {
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
  }, [navigate]);

  // Enrich order with customer/table/items data
  const enrichOrder = useCallback(async (payload: NewOrderPayload): Promise<OrderPopup> => {
    const enriched: OrderPopup = { ...payload };
    try {
      const promises: Promise<void>[] = [];

      if (payload.customer_id) {
        promises.push(
          supabase.from("customers").select("name").eq("id", payload.customer_id).single()
            .then(({ data }) => { if (data) enriched.customerName = data.name; })
        );
      }
      if (payload.table_id) {
        promises.push(
          supabase.from("restaurant_tables").select("number").eq("id", payload.table_id).single()
            .then(({ data }) => { if (data) enriched.tableNumber = data.number; })
        );
      }
      promises.push(
        supabase.from("order_items").select("name, quantity").eq("order_id", payload.id)
          .then(({ data }) => { if (data) enriched.items = data; })
      );

      await Promise.all(promises);
    } catch {}
    return enriched;
  }, []);

  // Handle new order
  const handleNewOrder = useCallback(async (payload: any) => {
    const order = payload.new as NewOrderPayload;
    const enriched = await enrichOrder(order);

    playSound();
    showBrowserNotification(enriched);
    setPopup(enriched);

    // Auto-close after 15s
    if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
    autoCloseTimer.current = setTimeout(() => setPopup(null), 15000);
  }, [playSound, showBrowserNotification, enrichOrder]);

  // Subscribe to new orders
  useEffect(() => {
    if (!restaurantId) return;

    const channel = supabase
      .channel("global-order-notif")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "orders",
        filter: `restaurant_id=eq.${restaurantId}`,
      }, handleNewOrder)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
    };
  }, [restaurantId, handleNewOrder]);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <>
      {/* Notification permission banner */}
      {notifPermission === "default" && (
        <div className="fixed top-4 right-4 z-[60] glass-card p-3 flex items-center gap-3 max-w-sm animate-in slide-in-from-right">
          <Bell className="w-5 h-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Ativar notificações?</p>
            <p className="text-xs text-muted-foreground">Receba alertas de novos pedidos mesmo com a aba em segundo plano.</p>
          </div>
          <Button size="sm" variant="hero" onClick={() => {
            Notification.requestPermission().then(setNotifPermission);
          }}>
            Ativar
          </Button>
        </div>
      )}

      {/* Order popup overlay */}
      <AnimatePresence>
        {popup && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed top-4 right-4 z-[70] w-[360px] max-w-[calc(100vw-2rem)]"
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
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* Body */}
              <div className="p-4 space-y-3">
                {(popup.customerName || popup.tableNumber) && (
                  <div className="flex items-center gap-3 text-sm">
                    {popup.customerName && (
                      <span className="font-medium">{popup.customerName}</span>
                    )}
                    {popup.tableNumber && (
                      <span className="px-2 py-0.5 rounded-full bg-secondary text-xs">
                        Mesa {popup.tableNumber}
                      </span>
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

                {popup.notes && (
                  <p className="text-xs text-muted-foreground italic">📝 {popup.notes}</p>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="font-display font-bold text-lg text-primary">
                    {fmt(Number(popup.total))}
                  </span>
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

              {/* Progress bar auto-close */}
              <motion.div
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: 15, ease: "linear" }}
                className="h-0.5 bg-primary origin-left"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

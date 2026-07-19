import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Eye, X as XIcon, Bell, BellRing, FileText } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { generateReceiptPDF } from "@/lib/receipt";

type OrderStatus = Database["public"]["Enums"]["order_status"];

interface Order {
  id: string;
  status: OrderStatus;
  notes: string | null;
  total: number;
  created_at: string;
  updated_at: string;
  table_id: string | null;
  customer_id: string | null;
  order_items: { id: string; name: string; quantity: number; unit_price: number; notes: string | null }[];
  restaurant_tables: { number: number } | null;
  customers: { name: string; whatsapp: string } | null;
}

const columns: { status: OrderStatus; label: string; color: string }[] = [
  { status: "new", label: "Novos", color: "bg-primary" },
  { status: "preparing", label: "Preparando", color: "bg-yellow-500" },
  { status: "ready", label: "Prontos", color: "bg-green-500" },
  { status: "completed", label: "Concluídos", color: "bg-muted" },
  { status: "canceled", label: "Cancelados", color: "bg-destructive" },
];

const Orders = () => {
  const { profile, roles } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const restaurantId = profile?.restaurant_id;
  const canCancel = roles.includes("owner") || roles.includes("manager");
  const knownOrderIds = useRef<Set<string>>(new Set());
  const isInitialLoad = useRef(true);

  // Notification sound
  const playNotificationSound = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
      // Second beep
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.value = 1100;
      osc2.type = "sine";
      gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.65);
      osc2.start(ctx.currentTime + 0.15);
      osc2.stop(ctx.currentTime + 0.65);
    } catch {}
  }, []);

  useEffect(() => {
    if (!restaurantId) return;
    loadOrders();

    const channel = supabase
      .channel("orders-panel")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` }, (payload) => {
        playNotificationSound();
        toast.success("🔔 Novo pedido recebido!", {
          description: `Pedido #${(payload.new as any).id?.slice(0, 6)} — R$${Number((payload.new as any).total).toFixed(2)}`,
          duration: 8000,
        });
        loadOrders();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` }, () => {
        loadOrders();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [restaurantId]);

  async function loadOrders() {
    if (!restaurantId) return;
    const { data } = await supabase
      .from("orders")
      .select("id, status, notes, total, created_at, updated_at, table_id, customer_id, order_items(id, name, quantity, unit_price, notes), restaurant_tables(number), customers(name, whatsapp)")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false })
      .limit(100);

    const newOrders = (data as unknown as Order[]) ?? [];
    
    // Track known IDs for future comparison
    newOrders.forEach(o => knownOrderIds.current.add(o.id));
    isInitialLoad.current = false;

    setOrders(newOrders);
    setLoading(false);
  }

  async function updateStatus(orderId: string, newStatus: OrderStatus) {
    const { error } = await supabase.from("orders").update({ status: newStatus }).eq("id", orderId);
    if (error) { toast.error("Erro ao atualizar status"); return; }
    toast.success("Status atualizado!");
    setSelectedOrder(null);
  }

  const getNextStatus = (current: OrderStatus): OrderStatus | null => {
    const flow: Record<string, OrderStatus> = { new: "preparing", preparing: "ready", ready: "completed" };
    return flow[current] ?? null;
  };

  const getNextLabel = (current: OrderStatus): string => {
    const labels: Record<string, string> = { new: "Confirmar", preparing: "Pronto", ready: "Concluir" };
    return labels[current] ?? "Avançar";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <h1 className="font-display text-2xl font-bold mb-6">
        📋 <span className="gradient-text">Pedidos</span>
      </h1>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => {
          const colOrders = orders.filter((o) => o.status === col.status);
          return (
            <div key={col.status} className="min-w-[280px] w-[280px] flex-shrink-0 flex flex-col">
              <div className={`${col.color} text-primary-foreground rounded-t-xl px-3 py-2 font-display font-semibold text-sm flex items-center justify-between`}>
                <span>{col.label}</span>
                <span className="bg-background/20 rounded-full px-2 py-0.5 text-xs">{colOrders.length}</span>
              </div>
              <div className="flex-1 bg-card/20 rounded-b-xl border border-border border-t-0 p-2 space-y-2 max-h-[calc(100vh-160px)] overflow-y-auto">
                {colOrders.map((order) => {
                  const next = getNextStatus(order.status);
                  return (
                    <div key={order.id} className="glass-card p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-muted-foreground">#{order.id.slice(0, 6)}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      {order.restaurant_tables && (
                        <p className="text-sm font-semibold">Mesa {order.restaurant_tables.number}</p>
                      )}
                      {order.customers && (
                        <p className="text-xs text-muted-foreground">{order.customers.name}</p>
                      )}
                      <ul className="text-xs space-y-0.5">
                        {order.order_items.slice(0, 3).map((item) => (
                          <li key={item.id}>{item.quantity}x {item.name}</li>
                        ))}
                        {order.order_items.length > 3 && <li className="text-muted-foreground">+{order.order_items.length - 3} itens</li>}
                      </ul>
                      <div className="flex items-center justify-between pt-1">
                        <span className="font-display font-bold text-sm text-primary">R${order.total.toFixed(2)}</span>
                        <div className="flex gap-1">
                          <button onClick={() => setSelectedOrder(order)} className="p-1.5 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {next && (
                            <Button variant="hero" size="sm" className="text-xs h-7" onClick={() => updateStatus(order.id, next)}>
                              {getNextLabel(order.status)}
                            </Button>
                          )}
                          {canCancel && order.status !== "canceled" && order.status !== "completed" && (
                            <button onClick={() => updateStatus(order.id, "canceled")} className="p-1.5 rounded-lg bg-destructive/20 hover:bg-destructive/30 text-destructive transition-colors">
                              <XIcon className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {colOrders.length === 0 && <p className="text-center text-muted-foreground py-6 text-xs">Vazio</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Order detail modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setSelectedOrder(null)} />
          <div className="relative glass-card p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold">Pedido #{selectedOrder.id.slice(0, 8)}</h2>
              <button onClick={() => setSelectedOrder(null)}><XIcon className="w-5 h-5" /></button>
            </div>
            {selectedOrder.customers && (
              <div className="mb-3 text-sm">
                <p><strong>Cliente:</strong> {selectedOrder.customers.name}</p>
                <p><strong>WhatsApp:</strong> {selectedOrder.customers.whatsapp}</p>
              </div>
            )}
            {selectedOrder.restaurant_tables && (
              <p className="text-sm mb-3"><strong>Mesa:</strong> {selectedOrder.restaurant_tables.number}</p>
            )}
            <div className="space-y-2 mb-4">
              {selectedOrder.order_items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>{item.quantity}x {item.name}</span>
                  <span className="text-muted-foreground">R${(item.unit_price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
            {selectedOrder.notes && <p className="text-sm text-muted-foreground mb-3 italic">📝 {selectedOrder.notes}</p>}
            <div className="flex justify-between font-display font-bold text-lg border-t border-border pt-3 mb-4">
              <span>Total</span>
              <span className="gradient-text">R${selectedOrder.total.toFixed(2)}</span>
            </div>
            <Button
              variant="hero"
              className="w-full gap-2"
              onClick={async () => {
                const { data: r } = await supabase
                  .from("restaurants")
                  .select("name, slug, owner_phone")
                  .eq("id", restaurantId!)
                  .single();
                generateReceiptPDF(selectedOrder, {
                  name: r?.name ?? "Restaurante",
                  slug: r?.slug ?? null,
                  phone: r?.owner_phone ?? null,
                });
                toast.success("Recibo gerado!");
              }}
            >
              <FileText className="w-4 h-4" />
              Gerar recibo (PDF)
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;

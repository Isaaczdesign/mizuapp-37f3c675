import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Eye, X as XIcon, FileText, UtensilsCrossed, ShoppingBag, Truck, MapPin, Volume2, VolumeX } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { generateReceiptPDF } from "@/lib/receipt";
import { useNotificationPrefs } from "@/hooks/useNotificationPrefs";

type OrderStatus = Database["public"]["Enums"]["order_status"];
type OrderType = "all" | "dine_in" | "pickup" | "delivery";

interface Order {
  id: string;
  status: OrderStatus;
  notes: string | null;
  total: number;
  created_at: string;
  updated_at: string;
  table_id: string | null;
  customer_id: string | null;
  order_type: string;
  payment_method: string | null;
  payment_change_for: number | null;
  delivery_address: any;
  delivery_fee: number;
  delivery_eta: string | null;
  order_items: { id: string; name: string; quantity: number; unit_price: number; notes: string | null }[];
  restaurant_tables: { number: number } | null;
  customers: { name: string; whatsapp: string } | null;
}

const columns: { status: OrderStatus; label: string; color: string; deliveryOnly?: boolean }[] = [
  { status: "new", label: "Novos", color: "bg-primary" },
  { status: "preparing", label: "Preparando", color: "bg-yellow-500" },
  { status: "ready", label: "Prontos", color: "bg-green-500" },
  { status: "out_for_delivery" as OrderStatus, label: "A caminho", color: "bg-sky-500", deliveryOnly: true },
  { status: "delivered" as OrderStatus, label: "Entregues", color: "bg-emerald-600", deliveryOnly: true },
  { status: "completed", label: "Concluídos", color: "bg-muted" },
  { status: "canceled", label: "Cancelados", color: "bg-destructive" },
];

const TYPE_META: Record<string, { label: string; icon: any; color: string }> = {
  dine_in: { label: "Mesa", icon: UtensilsCrossed, color: "text-blue-400 bg-blue-500/15" },
  pickup: { label: "Retirada", icon: ShoppingBag, color: "text-amber-400 bg-amber-500/15" },
  delivery: { label: "Delivery", icon: Truck, color: "text-emerald-400 bg-emerald-500/15" },
};

// Next-status flow per type. Delivery: ready → out_for_delivery → delivered.
function getNextStatus(current: OrderStatus, type: string): OrderStatus | null {
  if (type === "delivery") {
    const flow: Record<string, OrderStatus> = {
      new: "preparing",
      preparing: "ready",
      ready: "out_for_delivery" as OrderStatus,
      out_for_delivery: "delivered" as OrderStatus,
    };
    return flow[current] ?? null;
  }
  const flow: Record<string, OrderStatus> = { new: "preparing", preparing: "ready", ready: "completed" };
  return flow[current] ?? null;
}

function getNextLabel(current: OrderStatus, type: string): string {
  if (type === "delivery") {
    if (current === "ready") return "Saiu p/ entrega";
    if ((current as string) === "out_for_delivery") return "Entregue";
  }
  if (current === "ready") {
    if (type === "pickup") return "Retirado";
    return "Finalizar";
  }
  const labels: Record<string, string> = { new: "Confirmar", preparing: "Pronto" };
  return labels[current] ?? "Avançar";
}

function formatAddress(addr: any): string {
  if (!addr || typeof addr !== "object") return "";
  const parts = [addr.street, addr.number, addr.complement, addr.neighborhood, addr.city, addr.cep]
    .filter(Boolean);
  return parts.join(", ");
}

const Orders = () => {
  const { profile, roles } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [typeFilter, setTypeFilter] = useState<OrderType>("all");
  const restaurantId = profile?.restaurant_id;
  const canCancel = roles.includes("owner") || roles.includes("manager");
  const knownOrderIds = useRef<Set<string>>(new Set());
  const { prefs, save } = useNotificationPrefs();

  useEffect(() => {
    if (!restaurantId) return;
    loadOrders();

    const channel = supabase
      .channel("orders-panel")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` }, () => {
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
      .select("id, status, notes, total, created_at, updated_at, table_id, customer_id, order_type, payment_method, payment_change_for, delivery_address, delivery_fee, delivery_eta, order_items(id, name, quantity, unit_price, notes), restaurant_tables(number), customers(name, whatsapp)")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false })
      .limit(100);

    const newOrders = (data as unknown as Order[]) ?? [];
    newOrders.forEach(o => knownOrderIds.current.add(o.id));
    setOrders(newOrders);
    setLoading(false);
  }

  async function updateStatus(orderId: string, newStatus: OrderStatus) {
    const order = orders.find((o) => o.id === orderId);
    const patch: any = { status: newStatus };

    // Auto-fill ETA when a delivery order transitions to "ready" (Pronto p/ envio)
    if (order?.order_type === "delivery" && newStatus === "ready" && !order.delivery_eta) {
      const { data: s } = await supabase
        .from("settings")
        .select("avg_delivery_minutes")
        .eq("restaurant_id", restaurantId!)
        .maybeSingle();
      const mins = (s as any)?.avg_delivery_minutes ?? 30;
      if (mins > 0) patch.delivery_eta = new Date(Date.now() + mins * 60000).toISOString();
    }

    const { error } = await supabase.from("orders").update(patch).eq("id", orderId);
    if (error) { toast.error("Erro ao atualizar status"); return; }
    toast.success(patch.delivery_eta ? "Status atualizado! Previsão calculada automaticamente." : "Status atualizado!");
    if (newStatus === ("out_for_delivery" as OrderStatus) || newStatus === ("delivered" as OrderStatus)) {
      supabase.functions.invoke("send-order-whatsapp", {
        body: { order_id: orderId, event: newStatus },
      }).then(({ error: fnErr }) => {
        if (fnErr) toast.error("Falha ao notificar cliente no WhatsApp");
        else toast.success("📱 Cliente notificado no WhatsApp");
      });
    }
    setSelectedOrder(null);
  }

  async function saveEta(orderId: string, isoDatetime: string | null) {
    const { error } = await supabase.from("orders").update({ delivery_eta: isoDatetime }).eq("id", orderId);
    if (error) { toast.error("Erro ao salvar previsão"); return; }
    toast.success("Previsão salva!");
    setSelectedOrder((prev) => prev && prev.id === orderId ? { ...prev, delivery_eta: isoDatetime } : prev);
    loadOrders();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const filtered = typeFilter === "all" ? orders : orders.filter((o) => o.order_type === typeFilter);
  const typeCounts = {
    all: orders.length,
    dine_in: orders.filter((o) => o.order_type === "dine_in").length,
    pickup: orders.filter((o) => o.order_type === "pickup").length,
    delivery: orders.filter((o) => o.order_type === "delivery").length,
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h1 className="font-display text-2xl font-bold">
          📋 <span className="gradient-text">Pedidos</span>
        </h1>
        <button
          onClick={() => {
            const next = !prefs.sound_enabled;
            save({ sound_enabled: next });
            toast.success(next ? "🔊 Alerta sonoro ativado" : "🔇 Alerta sonoro desativado");
          }}
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
            prefs.sound_enabled
              ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/15"
              : "bg-secondary border-border text-muted-foreground hover:text-foreground"
          }`}
          title={prefs.sound_enabled ? "Desativar alerta sonoro" : "Ativar alerta sonoro"}
          aria-pressed={prefs.sound_enabled}
        >
          {prefs.sound_enabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          <span className="hidden sm:inline">{prefs.sound_enabled ? "Som ativado" : "Som desativado"}</span>
        </button>
      </div>

      {/* Type filter tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {([
          { key: "all", label: "Todos" },
          { key: "dine_in", label: "Mesa" },
          { key: "pickup", label: "Retirada" },
          { key: "delivery", label: "Delivery" },
        ] as { key: OrderType; label: string }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTypeFilter(t.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              typeFilter === t.key ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/80"
            }`}
          >
            {t.label} · {typeCounts[t.key]}
          </button>
        ))}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.filter((c) => !c.deliveryOnly || typeFilter === "all" || typeFilter === "delivery").map((col) => {
          const colOrders = filtered.filter((o) => o.status === col.status);
          return (
            <div key={col.status} className="min-w-[280px] w-[280px] flex-shrink-0 flex flex-col">
              <div className={`${col.color} text-primary-foreground rounded-t-xl px-3 py-2 font-display font-semibold text-sm flex items-center justify-between`}>
                <span>{col.label}</span>
                <span className="bg-background/20 rounded-full px-2 py-0.5 text-xs">{colOrders.length}</span>
              </div>
              <div className="flex-1 bg-card/20 rounded-b-xl border border-border border-t-0 p-2 space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
                {colOrders.map((order) => {
                  const next = getNextStatus(order.status, order.order_type);
                  const meta = TYPE_META[order.order_type] ?? TYPE_META.dine_in;
                  const TypeIcon = meta.icon;
                  return (
                    <div key={order.id} className="glass-card p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${meta.color}`}>
                          <TypeIcon className="w-3 h-3" />
                          {meta.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-muted-foreground">#{order.id.slice(0, 6)}</span>
                      </div>

                      {order.order_type === "dine_in" && order.restaurant_tables && (
                        <p className="text-sm font-semibold">🍽️ Mesa {order.restaurant_tables.number}</p>
                      )}
                      {order.order_type === "delivery" && order.delivery_address && (
                        <p className="text-xs text-muted-foreground flex items-start gap-1">
                          <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                          <span className="line-clamp-2">{formatAddress(order.delivery_address)}</span>
                        </p>
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
                        <span className="font-display font-bold text-sm text-primary">R${Number(order.total).toFixed(2)}</span>
                        <div className="flex gap-1">
                          <button onClick={() => setSelectedOrder(order)} className="p-1.5 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {next && (
                            <Button variant="hero" size="sm" className="text-xs h-7" onClick={() => updateStatus(order.id, next)}>
                              {getNextLabel(order.status, order.order_type)}
                            </Button>
                          )}
                          {canCancel && order.status !== "canceled" && order.status !== "completed" && (order.status as string) !== "delivered" && (
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

            <div className="mb-3 space-y-1 text-sm">
              <p><strong>Tipo:</strong> {TYPE_META[selectedOrder.order_type]?.label ?? selectedOrder.order_type}</p>
              {selectedOrder.customers && (
                <>
                  <p><strong>Cliente:</strong> {selectedOrder.customers.name}</p>
                  <p><strong>WhatsApp:</strong> {selectedOrder.customers.whatsapp}</p>
                </>
              )}
              {selectedOrder.restaurant_tables && (
                <p><strong>Mesa:</strong> {selectedOrder.restaurant_tables.number}</p>
              )}
              {selectedOrder.order_type === "delivery" && selectedOrder.delivery_address && (
                <div className="p-2 rounded-lg bg-secondary/40 space-y-0.5">
                  <p className="font-semibold flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Endereço de entrega</p>
                  {selectedOrder.delivery_address.street && (
                    <p>{selectedOrder.delivery_address.street}, {selectedOrder.delivery_address.number || "s/n"}</p>
                  )}
                  {selectedOrder.delivery_address.complement && (
                    <p className="text-muted-foreground">Compl.: {selectedOrder.delivery_address.complement}</p>
                  )}
                  {(selectedOrder.delivery_address.neighborhood || selectedOrder.delivery_address.city) && (
                    <p className="text-muted-foreground">
                      {[selectedOrder.delivery_address.neighborhood, selectedOrder.delivery_address.city].filter(Boolean).join(" - ")}
                    </p>
                  )}
                  {selectedOrder.delivery_address.cep && (
                    <p className="text-muted-foreground">CEP: {selectedOrder.delivery_address.cep}</p>
                  )}
                </div>
              )}
              {selectedOrder.payment_method && (
                <p>
                  <strong>Pagamento:</strong> {selectedOrder.payment_method}
                  {selectedOrder.payment_change_for && Number(selectedOrder.payment_change_for) > 0 && (
                    <> · Troco p/ R${Number(selectedOrder.payment_change_for).toFixed(2)}</>
                  )}
                </p>
              )}
              {selectedOrder.delivery_fee > 0 && (
                <p><strong>Taxa de entrega:</strong> R${Number(selectedOrder.delivery_fee).toFixed(2)}</p>
              )}
              {selectedOrder.order_type === "delivery" && (
                <div className="pt-2 border-t border-border">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Previsão de entrega (ETA)</label>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="datetime-local"
                      className="flex-1 bg-background border border-border rounded-lg px-2 py-1.5 text-sm"
                      defaultValue={selectedOrder.delivery_eta
                        ? new Date(new Date(selectedOrder.delivery_eta).getTime() - new Date().getTimezoneOffset()*60000).toISOString().slice(0,16)
                        : ""}
                      onBlur={(e) => {
                        const v = e.target.value;
                        const iso = v ? new Date(v).toISOString() : null;
                        if (iso !== selectedOrder.delivery_eta) saveEta(selectedOrder.id, iso);
                      }}
                    />
                    {selectedOrder.delivery_eta && (
                      <button onClick={() => saveEta(selectedOrder.id, null)} className="text-xs px-2 rounded-lg bg-secondary hover:bg-secondary/80">Limpar</button>
                    )}
                  </div>
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {[20, 30, 45, 60].map((m) => (
                      <button
                        key={m}
                        onClick={() => saveEta(selectedOrder.id, new Date(Date.now() + m*60000).toISOString())}
                        className="text-[11px] px-2 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20"
                      >+{m} min</button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2 mb-4 border-t border-border pt-3">
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
              <span className="gradient-text">R${Number(selectedOrder.total).toFixed(2)}</span>
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

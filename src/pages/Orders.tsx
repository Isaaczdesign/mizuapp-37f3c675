import { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Eye, X as XIcon, FileText, UtensilsCrossed, ShoppingBag, Truck, MapPin, Volume2, VolumeX, Plus, Pencil, Clock } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { generateReceiptPDF } from "@/lib/receipt";
import { useNotificationPrefs } from "@/hooks/useNotificationPrefs";
import AdminLayout from "@/components/AdminLayout";
import NewOrderModal from "@/components/NewOrderModal";
import EditOrderModal from "@/components/EditOrderModal";

type OrderStatus = Database["public"]["Enums"]["order_status"];
type OrderType = "all" | "dine_in" | "pickup" | "delivery";
type ScopeFilter = "current" | "7d" | "all";

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
  payment_status: string | null;
  delivery_address: any;
  delivery_fee: number;
  delivery_eta: string | null;
  order_items: { id: string; name: string; quantity: number; unit_price: number; notes: string | null }[];
  restaurant_tables: { number: number } | null;
  customers: { name: string; whatsapp: string } | null;
  shift_id: string | null;
}

const PAYMENT_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: "PIX pendente", cls: "text-amber-400 bg-amber-500/15" },
  in_process: { label: "PIX em análise", cls: "text-amber-400 bg-amber-500/15" },
  approved: { label: "Pago", cls: "text-emerald-400 bg-emerald-500/15" },
  rejected: { label: "Pgto recusado", cls: "text-red-400 bg-red-500/15" },
  cancelled: { label: "Pgto cancelado", cls: "text-red-400 bg-red-500/15" },
  refunded: { label: "Reembolsado", cls: "text-muted-foreground bg-secondary" },
  not_required: { label: "No local", cls: "text-blue-400 bg-blue-500/15" },
};

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
  dine_in: { label: "No local", icon: UtensilsCrossed, color: "text-blue-400 bg-blue-500/15" },
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

function parseAddress(addr: any): any | null {
  if (!addr) return null;
  if (typeof addr === "string") {
    try {
      return JSON.parse(addr);
    } catch {
      return { formatted: addr };
    }
  }
  return typeof addr === "object" ? addr : null;
}

function getAddressField(addr: any, keys: string[]): string {
  const parsed = parseAddress(addr);
  if (!parsed) return "";
  for (const key of keys) {
    const value = parsed[key];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function formatAddress(addr: any): string {
  const parsed = parseAddress(addr);
  if (!parsed) return "";
  const formatted = getAddressField(parsed, ["formatted", "formatted_address", "address", "endereco"]);
  if (formatted) return formatted;
  const parts = [
    getAddressField(parsed, ["street", "rua", "logradouro"]),
    getAddressField(parsed, ["number", "numero", "número"]),
    getAddressField(parsed, ["complement", "complemento"]),
    getAddressField(parsed, ["neighborhood", "bairro"]),
    getAddressField(parsed, ["city", "cidade", "localidade"]),
    getAddressField(parsed, ["cep", "zip", "zip_code", "postal_code"]),
  ].filter(Boolean);
  return parts.join(", ");
}

function hasDeliveryRoute(order: Order | null): boolean {
  return Boolean(order?.delivery_address && formatAddress(order.delivery_address));
}

const Orders = () => {
  const { profile, roles } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [typeFilter, setTypeFilter] = useState<OrderType>("all");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("current");
  const [currentShiftId, setCurrentShiftId] = useState<string | null>(null);
  const [viewingShift, setViewingShift] = useState<{ id: string; opened_at: string; status: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const restaurantId = profile?.restaurant_id;
  const canCancel = roles.includes("owner") || roles.includes("manager");
  const knownOrderIds = useRef<Set<string>>(new Set());
  const { prefs, save } = useNotificationPrefs();
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [restaurantAddress, setRestaurantAddress] = useState<string>("");

  const historyShiftId = searchParams.get("shift");


  useEffect(() => {
    if (!restaurantId) return;
    supabase.from("restaurants").select("address").eq("id", restaurantId).maybeSingle()
      .then(({ data }) => setRestaurantAddress(((data as any)?.address ?? "") as string));
  }, [restaurantId]);

  function buildRouteUrl(destAddr: any): string {
    const dest = encodeURIComponent(formatAddress(destAddr));
    const origin = restaurantAddress ? `&origin=${encodeURIComponent(restaurantAddress)}` : "";
    return `https://www.google.com/maps/dir/?api=1${origin}&destination=${dest}&travelmode=driving`;
  }

  // Load current open shift for the restaurant
  useEffect(() => {
    if (!restaurantId) { setCurrentShiftId(null); return; }
    supabase.rpc("get_current_shift", { _restaurant_id: restaurantId }).then(({ data }) => {
      const arr = data as any[] | null;
      setCurrentShiftId(arr && arr[0]?.id ? arr[0].id : null);
    });
  }, [restaurantId]);

  // If ?shift=<id>, load that shift's info (for the header banner)
  useEffect(() => {
    if (!historyShiftId) { setViewingShift(null); return; }
    supabase.from("work_shifts").select("id, opened_at, status").eq("id", historyShiftId).maybeSingle()
      .then(({ data }) => setViewingShift((data as any) ?? null));
  }, [historyShiftId]);

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

    const poll = setInterval(loadOrders, 10000);
    return () => { supabase.removeChannel(channel); clearInterval(poll); };
  }, [restaurantId, scopeFilter, currentShiftId, historyShiftId]);

  async function loadOrders() {
    if (!restaurantId) return;
    let q = supabase
      .from("orders")
      .select("id, status, notes, total, created_at, updated_at, table_id, customer_id, order_type, payment_method, payment_change_for, payment_status, delivery_address, delivery_fee, delivery_eta, shift_id, order_items(id, name, quantity, unit_price, notes), restaurant_tables(number), customers(name, whatsapp)")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (historyShiftId) {
      q = q.eq("shift_id", historyShiftId);
    } else if (scopeFilter === "current") {
      if (currentShiftId) {
        q = q.eq("shift_id", currentShiftId);
      } else {
        // no open shift → show nothing under "current"
        setOrders([]); setLoading(false); return;
      }
    } else if (scopeFilter === "7d") {
      const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      q = q.gte("created_at", from);
    }

    const { data } = await q;
    const visible = ((data as unknown as Order[]) ?? []).filter(
      (o) => o.payment_status == null || o.payment_status === "paid" || o.payment_status === "approved"
    );
    visible.forEach(o => knownOrderIds.current.add(o.id));
    setOrders(visible);
    setLoading(false);
  }


  async function updateStatus(orderId: string, newStatus: OrderStatus) {
    const order = orders.find((o) => o.id === orderId);
    const patch: any = { status: newStatus };

    // Cancelamento: se for pagamento online já aprovado, reembolsar automaticamente
    const isOnlinePaid =
      order &&
      (order.payment_method === "pix" || order.payment_method === "credit_card_online") &&
      (order.payment_status === "approved" || order.payment_status === "paid");

    if (newStatus === "canceled") {
      const msg = isOnlinePaid
        ? `Cancelar este pedido? O valor de R$${Number(order!.total).toFixed(2)} será REEMBOLSADO automaticamente ao cliente via Mercado Pago.`
        : "Cancelar este pedido?";
      if (!window.confirm(msg)) return;
    }

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

    // Dispara reembolso via edge function (não bloqueia a UI)
    if (newStatus === "canceled" && isOnlinePaid) {
      const t = toast.loading("Processando reembolso no Mercado Pago...");
      supabase.functions.invoke("refund-mp-payment", { body: { order_id: orderId } })
        .then(({ data, error: fnErr }) => {
          toast.dismiss(t);
          if (fnErr || (data as any)?.error) {
            toast.error(`Falha no reembolso: ${(data as any)?.error || fnErr?.message || "erro desconhecido"}`);
          } else if ((data as any)?.already_refunded) {
            toast.success("Pedido já havia sido reembolsado.");
          } else if ((data as any)?.skipped) {
            toast.message((data as any).reason || "Reembolso não aplicável");
          } else {
            toast.success("💸 Reembolso enviado ao cliente via Mercado Pago");
          }
        });
    }

    const notifiableEvents: OrderStatus[] = ["preparing", "ready", "out_for_delivery" as OrderStatus, "delivered" as OrderStatus, "completed", "canceled"];
    if (order?.customer_id && notifiableEvents.includes(newStatus)) {
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
      <AdminLayout collapsible>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  const byType = typeFilter === "all" ? orders : orders.filter((o) => o.order_type === typeFilter);
  const q = searchQuery.trim().toLowerCase();
  const filtered = !q ? byType : byType.filter((o) => {
    const idMatch = o.id.toLowerCase().includes(q) || o.id.slice(0, 6).toLowerCase().includes(q);
    const cust = o.customers?.name?.toLowerCase() ?? "";
    const phone = o.customers?.whatsapp?.toLowerCase() ?? "";
    const table = o.restaurant_tables?.number ? `mesa ${o.restaurant_tables.number}`.includes(q) || String(o.restaurant_tables.number).includes(q) : false;
    const items = o.order_items.some((it) => it.name.toLowerCase().includes(q));
    const notes = o.notes?.toLowerCase().includes(q) ?? false;
    const addr = formatAddress(o.delivery_address).toLowerCase().includes(q);
    return idMatch || cust.includes(q) || phone.includes(q) || table || items || notes || addr;
  });
  const typeCounts = {
    all: orders.length,
    dine_in: orders.filter((o) => o.order_type === "dine_in").length,
    pickup: orders.filter((o) => o.order_type === "pickup").length,
    delivery: orders.filter((o) => o.order_type === "delivery").length,
  };
  const selectedAddress = selectedOrder?.delivery_address;
  const selectedHasRoute = hasDeliveryRoute(selectedOrder);

  return (
    <AdminLayout collapsible>
    <div className="min-h-screen bg-background p-4">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h1 className="font-display text-2xl font-bold">
          📋 <span className="gradient-text">Pedidos</span>
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
        <Button variant="hero" size="sm" onClick={() => setShowNewOrder(true)} className="gap-1">
          <Plus className="w-4 h-4" /> Novo pedido
        </Button>
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
      </div>

      {/* Shift scope banner / filter */}
      {historyShiftId ? (
        <div className="mb-4 p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm flex items-center gap-2 text-amber-300">
            <Clock className="w-4 h-4" />
            <span>
              Vendo pedidos do expediente
              {viewingShift ? ` aberto em ${new Date(viewingShift.opened_at).toLocaleString("pt-BR")}` : ""}
            </span>
          </div>
          <Button size="sm" variant="outline" onClick={() => { setSearchParams({}); }}>
            Voltar ao expediente atual
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-xs text-muted-foreground">Escopo:</span>
          {([
            { key: "current", label: "Expediente atual" },
            { key: "7d", label: "Últimos 7 dias" },
            { key: "all", label: "Todos" },
          ] as { key: ScopeFilter; label: string }[]).map((s) => (
            <button
              key={s.key}
              onClick={() => setScopeFilter(s.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                scopeFilter === s.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary/60 text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
          {scopeFilter === "current" && !currentShiftId && (
            <span className="text-xs text-amber-400 ml-1">Nenhum expediente aberto</span>
          )}
        </div>
      )}

      {/* Search */}
      <div className="mb-3 relative max-w-md">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por cliente, telefone, mesa, item, endereço ou #ID..."
          className="w-full pl-10 pr-9 py-2 rounded-xl bg-secondary/60 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40"
          aria-label="Buscar pedidos"
        />
        <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"
            aria-label="Limpar busca"
          >
            <XIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Type filter tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">

        {([
          { key: "all", label: "Todos", icon: FileText },
          { key: "dine_in", label: "No local", icon: UtensilsCrossed },
          { key: "pickup", label: "Retirada", icon: ShoppingBag },
          { key: "delivery", label: "Delivery", icon: Truck },
        ] as { key: OrderType; label: string; icon: any }[]).map((t) => {
          const Icon = t.icon;
          const active = typeFilter === t.key;
          const count = typeCounts[t.key];
          return (
            <button
              key={t.key}
              onClick={() => setTypeFilter(t.key)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap border transition-all ${
                active
                  ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20 scale-[1.02]"
                  : "bg-secondary/60 text-muted-foreground border-border hover:text-foreground hover:bg-secondary"
              }`}
              aria-pressed={active}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
              <span
                className={`inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-bold ${
                  active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-background/60 text-foreground"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
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
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-mono text-xs text-muted-foreground">#{order.id.slice(0, 6)}</span>
                        {(() => {
                          const isOnlinePix = order.payment_method === "pix";
                          const key = isOnlinePix ? (order.payment_status ?? "pending") : "not_required";
                          const pb = PAYMENT_BADGE[key] ?? PAYMENT_BADGE.pending;
                          let label = pb.label;
                          if (key === "not_required") {
                            if (order.order_type === "delivery") label = "Na entrega";
                            else if (order.order_type === "pickup") label = "Na retirada";
                            else label = "No local";
                          }
                          return (
                            <span className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-medium ${pb.cls}`}>
                              {label}
                            </span>
                          );
                        })()}
                      </div>


                      {order.order_type === "dine_in" && order.restaurant_tables && (
                        <p className="text-sm font-semibold">🍽️ Mesa {order.restaurant_tables.number}</p>
                      )}
                      {hasDeliveryRoute(order) && (
                        <>
                          <p className="text-xs text-muted-foreground flex items-start gap-1">
                            <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                            <span className="line-clamp-2">{formatAddress(order.delivery_address)}</span>
                          </p>
                          <a
                            href={buildRouteUrl(order.delivery_address)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/15 text-sky-400 hover:bg-sky-500/25 transition-colors"
                          >
                            <MapPin className="w-3 h-3" /> Ver rota
                          </a>
                        </>
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
              <div className="flex items-center gap-2">
                {selectedOrder.status !== "canceled" && (selectedOrder.status as string) !== "delivered" && selectedOrder.status !== "completed" && (
                  <button
                    onClick={() => { setEditingOrder(selectedOrder); setSelectedOrder(null); }}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 transition-colors"
                    title="Editar pedido"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Editar
                  </button>
                )}
                <button onClick={() => setSelectedOrder(null)}><XIcon className="w-5 h-5" /></button>
              </div>
            </div>

            {selectedHasRoute && selectedAddress && (
              <a
                href={buildRouteUrl(selectedAddress)}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-4 flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-primary/20"
              >
                <MapPin className="w-4 h-4" /> Ver rota no Google Maps
              </a>
            )}



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
              {selectedHasRoute && selectedAddress && (() => {
                const address = parseAddress(selectedAddress) ?? {};
                const street = getAddressField(address, ["street", "rua", "logradouro"]);
                const number = getAddressField(address, ["number", "numero", "número"]);
                const complement = getAddressField(address, ["complement", "complemento"]);
                const neighborhood = getAddressField(address, ["neighborhood", "bairro"]);
                const city = getAddressField(address, ["city", "cidade", "localidade"]);
                const cep = getAddressField(address, ["cep", "zip", "zip_code", "postal_code"]);
                const addressLine = formatAddress(address);
                return (
                <div className="p-2 rounded-lg bg-secondary/40 space-y-0.5">
                  <p className="font-semibold flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Endereço de entrega</p>
                  {street ? (
                    <p>{street}, {number || "s/n"}</p>
                  ) : (
                    <p>{addressLine}</p>
                  )}
                  {complement && (
                    <p className="text-muted-foreground">Compl.: {complement}</p>
                  )}
                  {(neighborhood || city) && (
                    <p className="text-muted-foreground">
                      {[neighborhood, city].filter(Boolean).join(" - ")}
                    </p>
                  )}
                  {cep && (
                    <p className="text-muted-foreground">CEP: {cep}</p>
                  )}
                  <div className="pt-2 grid grid-cols-2 gap-2">
                    <a
                      href={buildRouteUrl(address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1 text-xs px-2 py-1.5 rounded-lg bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 transition-colors"
                    >
                      <MapPin className="w-3.5 h-3.5" /> Ver rota
                    </a>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLine)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1 text-xs px-2 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
                    >
                      <MapPin className="w-3.5 h-3.5" /> Abrir no mapa
                    </a>
                  </div>
                  <div className="pt-2">
                    <iframe
                      title="Rota de entrega"
                      className="w-full h-48 rounded-lg border border-border"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      src={`https://maps.google.com/maps?q=${encodeURIComponent(addressLine)}&output=embed`}
                    />
                  </div>
                </div>
                );
              })()}
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

      {showNewOrder && restaurantId && (
        <NewOrderModal
          restaurantId={restaurantId}
          onClose={() => setShowNewOrder(false)}
          onCreated={loadOrders}
        />
      )}

      {editingOrder && restaurantId && (
        <EditOrderModal
          restaurantId={restaurantId}
          order={editingOrder}
          onClose={() => setEditingOrder(null)}
          onSaved={loadOrders}
        />
      )}
    </div>
    </AdminLayout>
  );
};

export default Orders;

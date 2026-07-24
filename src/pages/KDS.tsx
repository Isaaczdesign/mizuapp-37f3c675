import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import AdminLayout from "@/components/AdminLayout";
import { Maximize2, Minimize2, Volume2, VolumeX, Printer, PrinterIcon, Undo2, Pin, PinOff, LayoutGrid, Rows3, Clock } from "lucide-react";
import { orderTypeLabel, ORDER_TYPE_EMOJI } from "@/lib/orderTypes";

type OrderStatus = Database["public"]["Enums"]["order_status"];

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  notes: string | null;
  menu_items: { prep_time_minutes: number | null } | null;
}
interface Order {
  id: string;
  status: OrderStatus;
  notes: string | null;
  total: number;
  created_at: string;
  preparing_started_at: string | null;
  ready_at: string | null;
  table_id: string | null;
  order_type: string | null;
  order_items: OrderItem[];
  restaurant_tables: { number: number } | null;
}

const statusConfig: Record<string, { label: string; color: string; next?: OrderStatus; prev?: OrderStatus }> = {
  new: { label: "NOVO", color: "bg-primary", next: "preparing" },
  preparing: { label: "PREPARANDO", color: "bg-yellow-500", next: "ready", prev: "new" },
  ready: { label: "PRONTO", color: "bg-green-500", prev: "preparing" },
};

const TYPE_FILTERS = [
  { key: "all", label: "Todos" },
  { key: "dine_in", label: "No local" },
  { key: "pickup", label: "Retirada" },
  { key: "delivery", label: "Delivery" },
] as const;
type TypeFilter = typeof TYPE_FILTERS[number]["key"];

const PREFS_KEY = "kds-prefs-v2";
type ViewMode = "columns" | "tables";
type Prefs = { sound: boolean; autoPrint: boolean; tvMode: boolean; filter: TypeFilter; view: ViewMode };
const defaultPrefs: Prefs = { sound: true, autoPrint: false, tvMode: false, filter: "all", view: "columns" };

const PINS_KEY = "kds-pinned-orders-v1";
const loadPins = (): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(PINS_KEY) || "[]")); }
  catch { return new Set(); }
};
const savePins = (s: Set<string>) => localStorage.setItem(PINS_KEY, JSON.stringify([...s]));

// Estimativa: base 3min + (soma de prep_time × qtd, mas contando itens em paralelo com máximo)
function estimatePrepMinutes(order: Order): number {
  if (!order.order_items?.length) return 10;
  let maxItem = 0;
  let totalQty = 0;
  for (const it of order.order_items) {
    const t = it.menu_items?.prep_time_minutes ?? 10;
    if (t > maxItem) maxItem = t;
    totalQty += it.quantity || 1;
  }
  // preparo paralelo: max do item + 1min por item extra
  return Math.max(5, maxItem + Math.max(0, totalQty - 1));
}

// Retorna início da contagem para o card conforme status
function statusStartAt(order: Order): number {
  if (order.status === "ready" && order.ready_at) return new Date(order.ready_at).getTime();
  if (order.status === "preparing" && order.preparing_started_at) return new Date(order.preparing_started_at).getTime();
  return new Date(order.created_at).getTime();
}

const KDS = () => {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentShiftId, setCurrentShiftId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(() => {
    try { return { ...defaultPrefs, ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") }; }
    catch { return defaultPrefs; }
  });
  const [pinned, setPinned] = useState<Set<string>>(() => loadPins());
  const seenIds = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);

  const restaurantId = profile?.restaurant_id;

  const setPrefsPatch = (p: Partial<Prefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...p };
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const togglePin = (id: string) => {
    setPinned((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      savePins(next);
      return next;
    });
  };

  const playBeep = () => {
    if (!prefs.sound) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const beep = (freq: number, start: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = freq; osc.type = "sine";
        gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + 0.4);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + 0.4);
      };
      beep(880, 0); beep(1100, 0.15); beep(1320, 0.3);
      if (navigator.vibrate) navigator.vibrate([200, 80, 200]);
    } catch {}
  };

  const printTicket = (order: Order) => {
    const w = window.open("", "_blank", "width=380,height=600");
    if (!w) return;
    const dt = new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const where = order.restaurant_tables ? `Mesa ${order.restaurant_tables.number}` : `#${order.id.slice(0, 6)}`;
    const type = order.order_type ? `${ORDER_TYPE_EMOJI[order.order_type] ?? ""} ${orderTypeLabel(order.order_type)}` : "";
    const eta = estimatePrepMinutes(order);
    const items = order.order_items.map(i =>
      `<div style="margin:4px 0"><b>${i.quantity}x</b> ${i.name}${i.notes ? `<div style="font-size:11px;color:#555">⚠️ ${i.notes}</div>` : ""}</div>`
    ).join("");
    w.document.write(`<html><head><title>Pedido ${where}</title>
      <style>body{font-family:monospace;padding:12px;width:280px}h2{margin:0 0 4px;font-size:16px}hr{border:0;border-top:1px dashed #333;margin:8px 0}</style>
      </head><body>
      <h2>🍳 COZINHA</h2>
      <div style="font-size:13px">${where} · ${dt}</div>
      ${type ? `<div style="font-size:12px">${type}</div>` : ""}
      <div style="font-size:12px">⏱ Preparo estimado: ${eta} min</div>
      <hr/>${items}
      ${order.notes ? `<hr/><div style="font-size:11px;font-style:italic">📝 ${order.notes}</div>` : ""}
      </body></html>`);
    w.document.close();
    setTimeout(() => { try { w.print(); } catch {} }, 250);
  };

  useEffect(() => {
    if (!restaurantId) return;
    loadOrders();
    const channel = supabase
      .channel("kds-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` }, () => loadOrders())
      .on("postgres_changes", { event: "*", schema: "public", table: "work_shifts", filter: `restaurant_id=eq.${restaurantId}` }, () => loadOrders())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  async function loadOrders() {
    if (!restaurantId) return;
    const { data: shift } = await supabase
      .from("work_shifts").select("id")
      .eq("restaurant_id", restaurantId)
      .in("status", ["open", "service_closed"])
      .order("opened_at", { ascending: false })
      .limit(1).maybeSingle();

    const shiftId = shift?.id ?? null;
    setCurrentShiftId(shiftId);
    if (!shiftId) { setOrders([]); setLoading(false); return; }

    const { data } = await supabase
      .from("orders")
      .select("id, status, notes, total, created_at, preparing_started_at, ready_at, table_id, order_type, order_items(id, name, quantity, notes, menu_items(prep_time_minutes)), restaurant_tables(number)")
      .eq("restaurant_id", restaurantId)
      .eq("shift_id", shiftId)
      .in("status", ["new", "preparing", "ready"])
      .order("created_at", { ascending: true });

    const list = (data as unknown as Order[]) ?? [];
    const newlyArrived: Order[] = [];
    for (const o of list) {
      if (o.status === "new" && !seenIds.current.has(o.id)) newlyArrived.push(o);
      seenIds.current.add(o.id);
    }
    if (!firstLoad.current && newlyArrived.length > 0) {
      playBeep();
      if (prefs.autoPrint) newlyArrived.forEach(printTicket);
    }
    firstLoad.current = false;

    // Limpa pins de pedidos que saíram
    const active = new Set(list.map(o => o.id));
    setPinned(prev => {
      let changed = false;
      const next = new Set<string>();
      prev.forEach(id => { if (active.has(id)) next.add(id); else changed = true; });
      if (changed) savePins(next);
      return changed ? next : prev;
    });

    setOrders(list);
    setLoading(false);
  }

  async function updateStatus(orderId: string, newStatus: OrderStatus, silent = false) {
    const { error } = await supabase.from("orders").update({ status: newStatus }).eq("id", orderId);
    if (error) { toast.error("Erro ao atualizar"); return; }
    if (!silent) toast.success("Status atualizado!");
  }

  // Tick a cada 15s para atualizar timers/etas
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 15000);
    return () => clearInterval(t);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
    setPrefsPatch({ tvMode: !prefs.tvMode });
  };

  const filteredOrders = useMemo(() => {
    if (prefs.filter === "all") return orders;
    return orders.filter(o => (o.order_type ?? "dine_in") === prefs.filter);
  }, [orders, prefs.filter]);

  // Ordena com pinned no topo, mantendo ordem interna por created_at
  const sortWithPins = (list: Order[]) =>
    [...list].sort((a, b) => {
      const ap = pinned.has(a.id) ? 0 : 1;
      const bp = pinned.has(b.id) ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });


  const columns = ["new", "preparing", "ready"] as const;

  // Render helper — card único de pedido
  const OrderCard = ({ order }: { order: Order }) => {
    const eta = estimatePrepMinutes(order);
    const start = statusStartAt(order);
    const elapsedMin = Math.floor((Date.now() - start) / 60000);
    const remaining = eta - elapsedMin;
    // Cor por tempo baseada no ETA (não em minutos brutos)
    const overdue = remaining < 0;
    const nearing = !overdue && remaining <= Math.max(2, Math.floor(eta * 0.25));
    const timeBorder = overdue ? "border-destructive/60 bg-destructive/5"
      : nearing ? "border-yellow-500/60 bg-yellow-500/5"
      : "border-green-500/40 bg-green-500/5";
    const timeText = overdue ? "text-destructive"
      : nearing ? "text-yellow-600 dark:text-yellow-400"
      : "text-green-600 dark:text-green-400";
    const type = order.order_type ? `${ORDER_TYPE_EMOJI[order.order_type] ?? ""} ${orderTypeLabel(order.order_type)}` : null;
    const isPinned = pinned.has(order.id);
    const config = statusConfig[order.status];

    return (
      <div className={`glass-card p-4 border ${timeBorder} ${isPinned ? "ring-2 ring-primary/50" : ""}`}>
        <div className="flex items-center justify-between mb-2 gap-2">
          <span className={`font-display font-bold ${prefs.tvMode ? "text-2xl" : "text-lg"} flex items-center gap-2`}>
            {isPinned && <Pin className="w-4 h-4 text-primary fill-primary" />}
            {order.restaurant_tables ? `Mesa ${order.restaurant_tables.number}` : `#${order.id.slice(0, 6)}`}
          </span>
          <button
            onClick={() => togglePin(order.id)}
            className="p-1 rounded hover:bg-secondary transition-colors"
            title={isPinned ? "Desafixar" : "Fixar no topo"}
          >
            {isPinned ? <PinOff className="w-4 h-4 text-primary" /> : <Pin className="w-4 h-4 text-muted-foreground" />}
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap mb-2 text-xs">
          {type && (
            <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary font-medium">{type}</span>
          )}
          <span className={`inline-flex items-center gap-1 font-mono font-bold ${timeText}`}>
            <Clock className="w-3 h-3" />
            {order.status === "ready"
              ? `pronto há ${elapsedMin}min`
              : overdue
                ? `+${Math.abs(remaining)}min atrasado`
                : `${remaining}min restantes`}
          </span>
          <span className="text-muted-foreground">· ETA {eta}min</span>
        </div>

        <ul className="space-y-1 mb-3">
          {order.order_items.map((item) => (
            <li key={item.id} className={`font-medium ${prefs.tvMode ? "text-lg" : "text-base"}`}>
              <span className="text-primary font-bold mr-1">{item.quantity}x</span>
              {item.name}
              {item.notes && <p className="text-xs text-muted-foreground ml-5">⚠️ {item.notes}</p>}
            </li>
          ))}
        </ul>
        {order.notes && <p className="text-xs text-muted-foreground mb-2 italic">📝 {order.notes}</p>}
        <div className="flex gap-2">
          {config.prev && (
            <Button variant="outline" size="sm" onClick={() => updateStatus(order.id, config.prev!)} title="Voltar etapa">
              <Undo2 className="w-4 h-4" />
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => printTicket(order)} title="Imprimir">
            <Printer className="w-4 h-4" />
          </Button>
          {config.next && (
            <Button variant="hero" className="flex-1" onClick={() => updateStatus(order.id, config.next!)}>
              {config.next === "preparing" ? "▶ Iniciar" : "✅ Pronto"}
            </Button>
          )}
        </div>
      </div>
    );
  };

  // Agrupamento por mesa
  const tableGroups = useMemo(() => {
    const groups = new Map<string, { tableNumber: number | null; orders: Order[] }>();
    const others: Order[] = [];
    for (const o of filteredOrders) {
      if (o.restaurant_tables && o.table_id) {
        const key = o.table_id;
        if (!groups.has(key)) groups.set(key, { tableNumber: o.restaurant_tables.number, orders: [] });
        groups.get(key)!.orders.push(o);
      } else {
        others.push(o);
      }
    }
    const arr = [...groups.entries()].map(([id, g]) => ({ id, ...g }));
    arr.sort((a, b) => (a.tableNumber ?? 0) - (b.tableNumber ?? 0));
    return { grouped: arr, others };
  }, [filteredOrders]);

  const content = (
    <div className={`min-h-screen bg-background p-4 ${prefs.tvMode ? "text-lg" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className={`font-display font-bold ${prefs.tvMode ? "text-4xl" : "text-2xl md:text-3xl"}`}>
          🍳 <span className="gradient-text">Cozinha</span>
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-lg border border-border p-1 bg-card/50">
            {TYPE_FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setPrefsPatch({ filter: f.key })}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  prefs.filter === f.key ? "bg-primary text-primary-foreground" : "hover:bg-secondary text-muted-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 rounded-lg border border-border p-1 bg-card/50">
            <button
              onClick={() => setPrefsPatch({ view: "columns" })}
              className={`px-2 py-1 rounded-md transition-colors ${prefs.view === "columns" ? "bg-primary text-primary-foreground" : "hover:bg-secondary text-muted-foreground"}`}
              title="Colunas por status"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPrefsPatch({ view: "tables" })}
              className={`px-2 py-1 rounded-md transition-colors ${prefs.view === "tables" ? "bg-primary text-primary-foreground" : "hover:bg-secondary text-muted-foreground"}`}
              title="Agrupar por mesa"
            >
              <Rows3 className="w-4 h-4" />
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setPrefsPatch({ sound: !prefs.sound })} title={prefs.sound ? "Silenciar" : "Ativar som"}>
            {prefs.sound ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPrefsPatch({ autoPrint: !prefs.autoPrint })} title={prefs.autoPrint ? "Desativar impressão automática" : "Ativar impressão automática"}>
            {prefs.autoPrint ? <Printer className="w-4 h-4 text-primary" /> : <PrinterIcon className="w-4 h-4" />}
          </Button>
          <Button variant="outline" size="sm" onClick={toggleFullscreen} title="Modo TV">
            {prefs.tvMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
          <span className="text-muted-foreground text-sm ml-2">{filteredOrders.length} ativos</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !currentShiftId ? (
        <div className="glass-card p-8 text-center">
          <p className="text-4xl mb-3">🌙</p>
          <p className="font-display font-bold text-lg mb-1">Expediente encerrado</p>
          <p className="text-sm text-muted-foreground">
            A cozinha só recebe pedidos com o expediente aberto. Abra um novo expediente no painel para retomar o serviço.
          </p>
        </div>
      ) : prefs.view === "columns" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-120px)]">
          {columns.map((status) => {
            const config = statusConfig[status];
            const col = sortWithPins(filteredOrders.filter((o) => o.status === status));
            return (
              <div key={status} className="flex flex-col">
                <div className={`${config.color} text-primary-foreground rounded-t-xl px-4 py-2 font-display font-bold text-lg flex items-center justify-between`}>
                  <span>{config.label}</span>
                  <span className="bg-background/20 rounded-full w-8 h-8 flex items-center justify-center text-sm">{col.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto bg-card/30 rounded-b-xl border border-border border-t-0 p-2 space-y-2">
                  {col.map((order) => <OrderCard key={order.id} order={order} />)}
                  {col.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">Nenhum pedido</p>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          {tableGroups.grouped.length === 0 && tableGroups.others.length === 0 && (
            <p className="text-center text-muted-foreground py-12">Nenhum pedido ativo</p>
          )}
          {tableGroups.grouped.map(g => {
            const hasPinned = g.orders.some(o => pinned.has(o.id));
            const sorted = sortWithPins(g.orders);
            return (
              <div key={g.id} className={`glass-card p-4 ${hasPinned ? "ring-2 ring-primary/50" : ""}`}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-display font-bold text-xl flex items-center gap-2">
                    🍽️ Mesa {g.tableNumber}
                    <span className="text-sm text-muted-foreground font-normal">
                      · {g.orders.length} pedido{g.orders.length > 1 ? "s" : ""}
                    </span>
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {sorted.map(order => <OrderCard key={order.id} order={order} />)}
                </div>
              </div>
            );
          })}
          {tableGroups.others.length > 0 && (
            <div className="glass-card p-4">
              <h2 className="font-display font-bold text-xl mb-3">🥡 Retirada / Delivery</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {sortWithPins(tableGroups.others).map(order => <OrderCard key={order.id} order={order} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return prefs.tvMode ? content : <AdminLayout collapsible>{content}</AdminLayout>;
};

export default KDS;

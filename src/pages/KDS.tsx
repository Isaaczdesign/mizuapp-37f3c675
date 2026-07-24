import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import AdminLayout from "@/components/AdminLayout";
import { Maximize2, Minimize2, Volume2, VolumeX, Printer, PrinterIcon, Undo2 } from "lucide-react";
import { orderTypeLabel, ORDER_TYPE_EMOJI } from "@/lib/orderTypes";

type OrderStatus = Database["public"]["Enums"]["order_status"];

interface Order {
  id: string;
  status: OrderStatus;
  notes: string | null;
  total: number;
  created_at: string;
  table_id: string | null;
  order_type: string | null;
  order_items: { id: string; name: string; quantity: number; notes: string | null }[];
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

// Persisted prefs
const PREFS_KEY = "kds-prefs-v1";
type Prefs = { sound: boolean; autoPrint: boolean; tvMode: boolean; filter: TypeFilter };
const defaultPrefs: Prefs = { sound: true, autoPrint: false, tvMode: false, filter: "all" };

const KDS = () => {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentShiftId, setCurrentShiftId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(() => {
    try { return { ...defaultPrefs, ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") }; }
    catch { return defaultPrefs; }
  });
  const seenIds = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);

  const restaurantId = profile?.restaurant_id;

  const savePrefs = (p: Partial<Prefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...p };
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
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
    const items = order.order_items.map(i =>
      `<div style="margin:4px 0"><b>${i.quantity}x</b> ${i.name}${i.notes ? `<div style="font-size:11px;color:#555">⚠️ ${i.notes}</div>` : ""}</div>`
    ).join("");
    w.document.write(`<html><head><title>Pedido ${where}</title>
      <style>body{font-family:monospace;padding:12px;width:280px}h2{margin:0 0 4px;font-size:16px}hr{border:0;border-top:1px dashed #333;margin:8px 0}</style>
      </head><body>
      <h2>🍳 COZINHA</h2>
      <div style="font-size:13px">${where} · ${dt}</div>
      ${type ? `<div style="font-size:12px">${type}</div>` : ""}
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
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` }, () => {
        loadOrders();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "work_shifts", filter: `restaurant_id=eq.${restaurantId}` }, () => {
        loadOrders();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  async function loadOrders() {
    if (!restaurantId) return;
    const { data: shift } = await supabase
      .from("work_shifts")
      .select("id")
      .eq("restaurant_id", restaurantId)
      .in("status", ["open", "service_closed"])
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const shiftId = shift?.id ?? null;
    setCurrentShiftId(shiftId);

    if (!shiftId) {
      setOrders([]); setLoading(false); return;
    }

    const { data } = await supabase
      .from("orders")
      .select("id, status, notes, total, created_at, table_id, order_type, order_items(id, name, quantity, notes), restaurant_tables(number)")
      .eq("restaurant_id", restaurantId)
      .eq("shift_id", shiftId)
      .in("status", ["new", "preparing", "ready"])
      .order("created_at", { ascending: true });

    const list = (data as unknown as Order[]) ?? [];

    // Detecta pedidos novos (status "new") para tocar som / imprimir
    const newlyArrived: Order[] = [];
    for (const o of list) {
      if (o.status === "new" && !seenIds.current.has(o.id)) {
        newlyArrived.push(o);
      }
      seenIds.current.add(o.id);
    }
    if (!firstLoad.current && newlyArrived.length > 0) {
      playBeep();
      if (prefs.autoPrint) newlyArrived.forEach(printTicket);
    }
    firstLoad.current = false;

    setOrders(list);
    setLoading(false);
  }

  async function updateStatus(orderId: string, newStatus: OrderStatus, silent = false) {
    const { error } = await supabase.from("orders").update({ status: newStatus }).eq("id", orderId);
    if (error) { toast.error("Erro ao atualizar"); return; }
    if (!silent) toast.success("Status atualizado!");
  }

  // Re-render por minuto para atualizar cores por tempo
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
    savePrefs({ tvMode: !prefs.tvMode });
  };

  const filteredOrders = useMemo(() => {
    if (prefs.filter === "all") return orders;
    return orders.filter(o => (o.order_type ?? "dine_in") === prefs.filter);
  }, [orders, prefs.filter]);

  if (loading) {
    return (
      <AdminLayout collapsible>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  const columns = ["new", "preparing", "ready"] as const;

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
                onClick={() => savePrefs({ filter: f.key })}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  prefs.filter === f.key ? "bg-primary text-primary-foreground" : "hover:bg-secondary text-muted-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => savePrefs({ sound: !prefs.sound })} title={prefs.sound ? "Silenciar" : "Ativar som"}>
            {prefs.sound ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </Button>
          <Button variant="outline" size="sm" onClick={() => savePrefs({ autoPrint: !prefs.autoPrint })} title={prefs.autoPrint ? "Desativar impressão automática" : "Ativar impressão automática"}>
            {prefs.autoPrint ? <Printer className="w-4 h-4 text-primary" /> : <PrinterIcon className="w-4 h-4" />}
          </Button>
          <Button variant="outline" size="sm" onClick={toggleFullscreen} title="Modo TV">
            {prefs.tvMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
          <span className="text-muted-foreground text-sm ml-2">{filteredOrders.length} ativos</span>
        </div>
      </div>

      {!currentShiftId ? (
        <div className="glass-card p-8 text-center">
          <p className="text-4xl mb-3">🌙</p>
          <p className="font-display font-bold text-lg mb-1">Expediente encerrado</p>
          <p className="text-sm text-muted-foreground">
            A cozinha só recebe pedidos com o expediente aberto. Abra um novo expediente no painel para retomar o serviço.
          </p>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-120px)]">
        {columns.map((status) => {
          const config = statusConfig[status];
          const col = filteredOrders.filter((o) => o.status === status);
          return (
            <div key={status} className="flex flex-col">
              <div className={`${config.color} text-primary-foreground rounded-t-xl px-4 py-2 font-display font-bold text-lg flex items-center justify-between`}>
                <span>{config.label}</span>
                <span className="bg-background/20 rounded-full w-8 h-8 flex items-center justify-center text-sm">{col.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto bg-card/30 rounded-b-xl border border-border border-t-0 p-2 space-y-2">
                {col.map((order) => {
                  const mins = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
                  // Cor por tempo: verde <5, amarelo 5-15, vermelho >15
                  const timeBorder =
                    mins > 15 ? "border-destructive/60 bg-destructive/5"
                    : mins >= 5 ? "border-yellow-500/60 bg-yellow-500/5"
                    : "border-green-500/40 bg-green-500/5";
                  const timeText =
                    mins > 15 ? "text-destructive"
                    : mins >= 5 ? "text-yellow-600 dark:text-yellow-400"
                    : "text-green-600 dark:text-green-400";
                  const type = order.order_type ? `${ORDER_TYPE_EMOJI[order.order_type] ?? ""} ${orderTypeLabel(order.order_type)}` : null;
                  return (
                    <div key={order.id} className={`glass-card p-4 border ${timeBorder} ${status === "new" && mins < 1 ? "animate-fade-in" : ""}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`font-display font-bold ${prefs.tvMode ? "text-2xl" : "text-lg"}`}>
                          {order.restaurant_tables ? `Mesa ${order.restaurant_tables.number}` : `#${order.id.slice(0, 6)}`}
                        </span>
                        <span className={`text-xs font-mono font-bold ${timeText}`}>
                          {mins}min
                        </span>
                      </div>
                      {type && (
                        <span className="inline-block mb-2 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-medium">
                          {type}
                        </span>
                      )}
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
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateStatus(order.id, config.prev!)}
                            title="Voltar etapa"
                          >
                            <Undo2 className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => printTicket(order)}
                          title="Imprimir"
                        >
                          <Printer className="w-4 h-4" />
                        </Button>
                        {config.next && (
                          <Button
                            variant="hero"
                            className="flex-1"
                            onClick={() => updateStatus(order.id, config.next!)}
                          >
                            {config.next === "preparing" ? "▶ Iniciar" : "✅ Pronto"}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {col.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">Nenhum pedido</p>}
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );

  return prefs.tvMode ? content : <AdminLayout collapsible>{content}</AdminLayout>;
};

export default KDS;

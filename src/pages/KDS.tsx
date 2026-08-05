import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { orderRef } from "@/lib/orderNumber";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import AdminLayout from "@/components/AdminLayout";
import { Maximize2, Minimize2, Volume2, VolumeX, Printer, PrinterIcon, Undo2, Pin, PinOff, LayoutGrid, Rows3, Clock, Settings2 } from "lucide-react";
import { orderTypeLabel, ORDER_TYPE_EMOJI } from "@/lib/orderTypes";
import { PageShell, PageHeader, SectionHeader, Segmented, Surface, EmptyState } from "@/components/dashboard/ui";


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

const PREFS_KEY = "kds-prefs-v3";
type ViewMode = "columns" | "tables";
type PrintTrigger = "new" | "ready" | "both";
type PaperWidth = "58" | "80";
type Prefs = {
  sound: boolean;
  autoPrint: boolean;
  tvMode: boolean;
  filter: TypeFilter;
  view: ViewMode;
  printTrigger: PrintTrigger;
  printCopies: number;
  paperWidth: PaperWidth;
  printPrices: boolean;
  printNotes: boolean;
  printHeader: string;
  printAutoClose: boolean;
  printDelayMs: number;
};
const defaultPrefs: Prefs = {
  sound: true,
  autoPrint: false,
  tvMode: false,
  filter: "all",
  view: "columns",
  printTrigger: "new",
  printCopies: 1,
  paperWidth: "80",
  printPrices: false,
  printNotes: true,
  printHeader: "🍳 COZINHA",
  printAutoClose: true,
  printDelayMs: 300,
};

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const seenIds = useRef<Set<string>>(new Set());
  const prevStatus = useRef<Map<string, OrderStatus>>(new Map());
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
    const widthPx = prefs.paperWidth === "58" ? 200 : 280;
    const w = window.open("", "_blank", `width=${widthPx + 60},height=600`);
    if (!w) { toast.error("Bloqueador de pop-up ativo. Libere para imprimir."); return; }
    const dt = new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const where = order.restaurant_tables ? `Mesa ${order.restaurant_tables.number}` : orderRef(order);
    const type = order.order_type ? `${ORDER_TYPE_EMOJI[order.order_type] ?? ""} ${orderTypeLabel(order.order_type)}` : "";
    const eta = estimatePrepMinutes(order);
    const items = order.order_items.map(i =>
      `<div style="margin:4px 0"><b>${i.quantity}x</b> ${i.name}${prefs.printNotes && i.notes ? `<div style="font-size:11px;color:#555">⚠️ ${i.notes}</div>` : ""}</div>`
    ).join("");
    const copiesHtml = Array.from({ length: Math.max(1, prefs.printCopies) }).map((_, idx) => `
      <section style="page-break-after:${idx < prefs.printCopies - 1 ? "always" : "auto"}">
        <h2 style="margin:0 0 4px;font-size:16px">${prefs.printHeader || "COZINHA"}</h2>
        <div style="font-size:13px">${where} · ${dt}</div>
        ${type ? `<div style="font-size:12px">${type}</div>` : ""}
        <div style="font-size:12px">⏱ Preparo estimado: ${eta} min</div>
        <hr style="border:0;border-top:1px dashed #333;margin:8px 0"/>
        ${items}
        ${prefs.printNotes && order.notes ? `<hr style="border:0;border-top:1px dashed #333;margin:8px 0"/><div style="font-size:11px;font-style:italic">📝 ${order.notes}</div>` : ""}
        ${prefs.printPrices ? `<hr style="border:0;border-top:1px dashed #333;margin:8px 0"/><div style="font-size:13px;text-align:right"><b>Total: R$ ${Number(order.total || 0).toFixed(2)}</b></div>` : ""}
        ${prefs.printCopies > 1 ? `<div style="font-size:10px;text-align:center;color:#888;margin-top:6px">via ${idx + 1}/${prefs.printCopies}</div>` : ""}
      </section>
    `).join("");
    w.document.write(`<html><head><title>Pedido ${where}</title>
      <style>body{font-family:monospace;padding:8px;width:${widthPx}px}@media print{body{width:${prefs.paperWidth}mm;padding:0}}</style>
      </head><body>${copiesHtml}</body></html>`);
    w.document.close();
    setTimeout(() => {
      try {
        w.print();
        if (prefs.printAutoClose) setTimeout(() => { try { w.close(); } catch {} }, 500);
      } catch {}
    }, Math.max(0, prefs.printDelayMs));
  };

  useEffect(() => {
    if (!restaurantId) return;
    loadOrders();
    const channel = supabase
      .channel("kds-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` }, () => loadOrders())
      .on("postgres_changes", { event: "*", schema: "public", table: "work_shifts", filter: `restaurant_id=eq.${restaurantId}` }, () => loadOrders())
      .subscribe();
    const poll = setInterval(() => loadOrders(), 10000);
    return () => { supabase.removeChannel(channel); clearInterval(poll); };

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
      .select("id, order_number, status, notes, total, created_at, preparing_started_at, ready_at, table_id, order_type, order_items(id, name, quantity, notes, menu_items(prep_time_minutes)), restaurant_tables(number)")
      .eq("restaurant_id", restaurantId)
      .eq("shift_id", shiftId)
      .in("status", ["new", "preparing", "ready"])
      .order("created_at", { ascending: true });

    const list = (data as unknown as Order[]) ?? [];
    const newlyArrived: Order[] = [];
    const becameReady: Order[] = [];
    for (const o of list) {
      const prev = prevStatus.current.get(o.id);
      if (o.status === "new" && !seenIds.current.has(o.id)) newlyArrived.push(o);
      if (prev && prev !== "ready" && o.status === "ready") becameReady.push(o);
      seenIds.current.add(o.id);
      prevStatus.current.set(o.id, o.status);
    }
    if (!firstLoad.current && newlyArrived.length > 0) playBeep();
    if (!firstLoad.current && prefs.autoPrint) {
      if (prefs.printTrigger === "new" || prefs.printTrigger === "both") newlyArrived.forEach(printTicket);
      if (prefs.printTrigger === "ready" || prefs.printTrigger === "both") becameReady.forEach(printTicket);
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
    // Atualização otimista para feedback imediato (não depende do Realtime)
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));

    const nowIso = new Date().toISOString();
    const patch: { status: OrderStatus; preparing_started_at?: string; ready_at?: string } = { status: newStatus };
    if (newStatus === "preparing") patch.preparing_started_at = nowIso;
    if (newStatus === "ready") patch.ready_at = nowIso;


    const { data, error } = await supabase
      .from("orders")
      .update(patch)
      .eq("id", orderId)
      .select("id, status")
      .maybeSingle();

    if (error || !data) {
      toast.error(error?.message ? `Erro ao atualizar: ${error.message}` : "Erro ao atualizar o pedido");
      await loadOrders();
      return;
    }
    if (!silent) toast.success("Status atualizado!");
    await loadOrders();
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
  };

  // Sync tvMode with actual fullscreen state (handles ESC / browser exit)
  useEffect(() => {
    const onFsChange = () => {
      const isFs = !!document.fullscreenElement;
      setPrefsPatch({ tvMode: isFs });
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            {order.restaurant_tables ? `Mesa ${order.restaurant_tables.number}` : orderRef(order)}
          </span>
          <button
            onClick={() => togglePin(order.id)}
            className="p-1 rounded-[4px] hover:bg-secondary transition-colors"
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
    <PageShell fullHeight className={prefs.tvMode ? "text-lg" : undefined}>
      <PageHeader
        title="Cozinha"
        subtitle={`${filteredOrders.length} pedido${filteredOrders.length === 1 ? "" : "s"} ativo${filteredOrders.length === 1 ? "" : "s"}`}
        emoji="🍳"
        actions={
          <>
            <Segmented
              value={prefs.filter}
              onChange={(v) => setPrefsPatch({ filter: v as TypeFilter })}
              options={TYPE_FILTERS.map((f) => ({ key: f.key as string, label: f.label }))}
              layoutId="kds-type-filter"
            />
            <Segmented
              value={prefs.view}
              onChange={(v) => setPrefsPatch({ view: v as ViewMode })}
              options={[
                { key: "columns", label: <LayoutGrid className="w-4 h-4" /> },
                { key: "tables", label: <Rows3 className="w-4 h-4" /> },
              ]}
              layoutId="kds-view-mode"
            />
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setPrefsPatch({ sound: !prefs.sound })} title={prefs.sound ? "Silenciar" : "Ativar som"}>
              {prefs.sound ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setPrefsPatch({ autoPrint: !prefs.autoPrint })} title={prefs.autoPrint ? "Desativar impressão automática" : "Ativar impressão automática"}>
              {prefs.autoPrint ? <Printer className="w-4 h-4 text-accent" /> : <PrinterIcon className="w-4 h-4" />}
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setSettingsOpen(true)} title="Configurar impressão">
              <Settings2 className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={toggleFullscreen} title="Modo TV">
              {prefs.tvMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          </>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !currentShiftId ? (
        <Surface className="p-8">
          <EmptyState
            icon={Clock}
            title="Expediente encerrado"
            description="A cozinha só recebe pedidos com o expediente aberto. Abra um novo expediente no painel para retomar o serviço."
          />
        </Surface>
      ) : prefs.view === "columns" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 min-h-0 lg:overflow-hidden">
          {columns.map((status) => {
            const config = statusConfig[status];
            const col = sortWithPins(filteredOrders.filter((o) => o.status === status));
            return (
              <Surface key={status} className="flex flex-col min-h-0 overflow-hidden p-0">
                <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-border/70 bg-secondary/40">
                  <span className="flex items-center gap-2 font-display font-semibold tracking-tight text-sm">
                    <span className={`w-2 h-2 rounded-full ${config.color}`} />
                    {config.label}
                  </span>
                  <span className="rounded-full bg-secondary/80 border border-border/70 min-w-7 h-7 px-2 flex items-center justify-center text-xs font-semibold tabular-nums">
                    {col.length}
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
                  {col.map((order) => <OrderCard key={order.id} order={order} />)}
                  {col.length === 0 && <p className="text-center text-muted-foreground py-8 text-xs">Nenhum pedido</p>}
                </div>
              </Surface>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4 flex-1 min-h-0 lg:overflow-y-auto">
          {tableGroups.grouped.length === 0 && tableGroups.others.length === 0 && (
            <Surface className="p-8">
              <EmptyState icon={LayoutGrid} title="Nenhum pedido ativo" description="Os pedidos aparecem aqui assim que chegarem do cardápio ou do painel." />
            </Surface>
          )}
          {tableGroups.grouped.map(g => {
            const hasPinned = g.orders.some(o => pinned.has(o.id));
            const sorted = sortWithPins(g.orders);
            return (
              <Surface key={g.id} className={`p-4 ${hasPinned ? "ring-2 ring-accent/40" : ""}`}>
                <SectionHeader
                  title={`Mesa ${g.tableNumber}`}
                  subtitle={`${g.orders.length} pedido${g.orders.length > 1 ? "s" : ""}`}
                  icon={Rows3}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {sorted.map(order => <OrderCard key={order.id} order={order} />)}
                </div>
              </Surface>
            );
          })}
          {tableGroups.others.length > 0 && (
            <Surface className="p-4">
              <SectionHeader title="Retirada / Delivery" subtitle="Pedidos sem mesa" icon={LayoutGrid} />
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {sortWithPins(tableGroups.others).map(order => <OrderCard key={order.id} order={order} />)}
              </div>
            </Surface>
          )}
        </div>
      )}


      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>🖨️ Configurar impressão</DialogTitle>
            <DialogDescription>
              Ajuste como os tickets são impressos automaticamente ao chegar/ficar prontos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Impressão automática</Label>
                <p className="text-xs text-muted-foreground">Imprime tickets sem clicar em cada pedido</p>
              </div>
              <Switch
                checked={prefs.autoPrint}
                onCheckedChange={(v) => setPrefsPatch({ autoPrint: v })}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Quando imprimir</Label>
              <Select
                value={prefs.printTrigger}
                onValueChange={(v: PrintTrigger) => setPrefsPatch({ printTrigger: v })}
                disabled={!prefs.autoPrint}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Ao chegar novo pedido</SelectItem>
                  <SelectItem value="ready">Quando marcar como Pronto</SelectItem>
                  <SelectItem value="both">Ambos (novo + pronto)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Largura do papel</Label>
                <Select
                  value={prefs.paperWidth}
                  onValueChange={(v: PaperWidth) => setPrefsPatch({ paperWidth: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="58">58mm</SelectItem>
                    <SelectItem value="80">80mm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Cópias (vias)</Label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={prefs.printCopies}
                  onChange={(e) => setPrefsPatch({ printCopies: Math.max(1, Math.min(5, Number(e.target.value) || 1)) })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Cabeçalho do ticket</Label>
              <Input
                value={prefs.printHeader}
                onChange={(e) => setPrefsPatch({ printHeader: e.target.value })}
                placeholder="🍳 COZINHA"
                maxLength={40}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Atraso antes de imprimir (ms)</Label>
              <Input
                type="number"
                min={0}
                max={5000}
                step={100}
                value={prefs.printDelayMs}
                onChange={(e) => setPrefsPatch({ printDelayMs: Math.max(0, Math.min(5000, Number(e.target.value) || 0)) })}
              />
              <p className="text-xs text-muted-foreground">Dê tempo para a impressora térmica responder.</p>
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-sm">Incluir observações do cliente</Label>
              <Switch checked={prefs.printNotes} onCheckedChange={(v) => setPrefsPatch({ printNotes: v })} />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-sm">Incluir total (R$)</Label>
              <Switch checked={prefs.printPrices} onCheckedChange={(v) => setPrefsPatch({ printPrices: v })} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Fechar janela após imprimir</Label>
                <p className="text-xs text-muted-foreground">Evita janelas acumuladas no navegador</p>
              </div>
              <Switch checked={prefs.printAutoClose} onCheckedChange={(v) => setPrefsPatch({ printAutoClose: v })} />
            </div>

            <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
              <p>💡 <b>Dica:</b> no diálogo de impressão do navegador, desmarque cabeçalho/rodapé e ative "Imprimir sempre nesta impressora" para tickets automáticos.</p>
              <p>🚫 Se nada aparecer, libere <b>pop-ups</b> para este site.</p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                const sample = orders[0];
                if (!sample) { toast.info("Faça um pedido para testar."); return; }
                printTicket(sample);
              }}
            >
              Imprimir teste
            </Button>
            <Button onClick={() => setSettingsOpen(false)}>Concluído</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>

  );

  return prefs.tvMode ? content : <AdminLayout collapsible>{content}</AdminLayout>;
};

export default KDS;

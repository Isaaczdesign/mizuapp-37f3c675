import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { format, subDays, startOfDay, endOfDay, eachDayOfInterval, startOfWeek, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, TrendingUp, Users, DollarSign, ShoppingBag, Repeat, Target, Rocket, X, ExternalLink, Copy, Link, Lock, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { isOpenNow, nextOpenAt, formatCountdown } from "@/lib/operatingHours";
type Period = "today" | "week" | "month" | "custom";
type OpenOrder = { id: string; status: string; order_type: string; total: number; created_at: string; table_id: string | null };

const Dashboard = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const rid = profile?.restaurant_id;
  const [period, setPeriod] = useState<Period>("today");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [hasActiveShift, setHasActiveShift] = useState(false);
  const [currentShiftId, setCurrentShiftId] = useState<string | null>(null);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);
  const [loadingOpenOrders, setLoadingOpenOrders] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    if (!rid) return;
    let cancelled = false;
    const check = () => {
      (supabase as any).rpc("get_current_shift", { _restaurant_id: rid }).then(({ data }: any) => {
        if (cancelled) return;
        const row = Array.isArray(data) ? data[0] : data;
        setHasActiveShift(!!row?.id);
        setCurrentShiftId(row?.id ?? null);
      });
    };
    check();
    const iv = setInterval(check, 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [rid]);

  async function openCloseDialog() {
    if (!rid) return;
    setCloseDialogOpen(true);
    setConfirmText("");
    setLoadingOpenOrders(true);
    let q = supabase.from("orders")
      .select("id, status, order_type, total, created_at, table_id")
      .eq("restaurant_id", rid)
      .not("status", "in", "(delivered,completed,canceled)")
      .order("created_at", { ascending: true });
    if (currentShiftId) q = q.eq("shift_id", currentShiftId);
    const { data } = await q;
    setOpenOrders((data as any) ?? []);
    setLoadingOpenOrders(false);
  }


  // Check setup completeness
  const { data: setupStatus } = useQuery({
    queryKey: ["setup-status", rid],
    enabled: !!rid,
    queryFn: async () => {
      const [restRes, settingsRes, catsRes, menuRes] = await Promise.all([
        supabase.from("restaurants").select("logo_url, payment_methods, description, slug").eq("id", rid!).single(),
        supabase.from("settings").select("operating_hours").eq("restaurant_id", rid!).maybeSingle(),
        supabase.from("menu_categories").select("id").eq("restaurant_id", rid!).limit(1),
        supabase.from("menu_items").select("id").eq("restaurant_id", rid!).limit(1),
      ]);
      const rest = restRes.data;
      const hasLogo = !!rest?.logo_url;
      const hasHours = !!settingsRes.data?.operating_hours && Object.keys(settingsRes.data.operating_hours as any).length > 0;
      const hasMenu = (menuRes.data?.length ?? 0) > 0;
      const hasPayment = Array.isArray(rest?.payment_methods) && (rest.payment_methods as any[]).length > 0;
      const steps = [
        { label: "Logo do restaurante", done: hasLogo },
        { label: "Horários de funcionamento", done: hasHours },
        { label: "Cardápio com itens", done: hasMenu },
        { label: "Métodos de pagamento", done: hasPayment },
      ];
      const completed = steps.filter((s) => s.done).length;
      return { steps, completed, total: steps.length, allDone: completed === steps.length, slug: rest?.slug };
    },
  });

  const publicMenuUrl = setupStatus?.slug ? `${window.location.origin}/r/${setupStatus.slug}` : null;

  // Fetch operating hours + refresh clock every minute for closed-hours banner
  const { data: hoursData } = useQuery({
    queryKey: ["operating-hours", rid],
    enabled: !!rid,
    queryFn: async () => {
      const [sRes, rRes] = await Promise.all([
        supabase.from("settings").select("operating_hours").eq("restaurant_id", rid!).maybeSingle(),
        supabase.from("restaurants").select("accepting_orders").eq("id", rid!).maybeSingle(),
      ]);
      return { hours: sRes.data?.operating_hours as any, accepting: (rRes.data as any)?.accepting_orders !== false };
    },
  });
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 60_000); return () => clearInterval(t); }, []);
  void tick;
  const outsideHours = !!hoursData?.hours && !isOpenNow(hoursData.hours);
  const shopClosed = outsideHours || (hoursData && !hoursData.accepting);
  const nextOpen = outsideHours ? nextOpenAt(hoursData!.hours) : null;
  const countdown = nextOpen ? formatCountdown(nextOpen) : null;


  const copyMenuLink = () => {
    if (publicMenuUrl) {
      navigator.clipboard.writeText(publicMenuUrl);
      toast.success("Link copiado!");
    }
  };

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case "today": return { from: startOfDay(now), to: endOfDay(now) };
      case "week": return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfDay(now) };
      case "month": return { from: startOfMonth(now), to: endOfDay(now) };
      case "custom": return customRange?.from && customRange?.to ? { from: startOfDay(customRange.from), to: endOfDay(customRange.to) } : { from: startOfDay(now), to: endOfDay(now) };
    }
  }, [period, customRange]);

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", rid, dateRange.from.toISOString(), dateRange.to.toISOString()],
    enabled: !!rid,
    queryFn: async () => {
      const [ordersRes, customersRes, allCustomersRes] = await Promise.all([
        supabase.from("orders").select("id, total, created_at, status, customer_id")
          .eq("restaurant_id", rid!)
          .gte("created_at", dateRange.from.toISOString())
          .lte("created_at", dateRange.to.toISOString()),
        supabase.from("customers").select("id, total_orders, created_at, last_order_at")
          .eq("restaurant_id", rid!),
        supabase.from("customers").select("id, total_orders, last_order_at")
          .eq("restaurant_id", rid!),
      ]);

      const allOrders = ordersRes.data ?? [];
      const validOrders = allOrders.filter((o) => o.status !== "canceled");
      const revenue = validOrders.reduce((s, o) => s + Number(o.total), 0);
      const count = validOrders.length;
      const avg = count > 0 ? revenue / count : 0;

      // New vs recurring customers in period
      const periodCustomerIds = new Set(validOrders.map((o) => o.customer_id).filter(Boolean));
      const allCustomers = allCustomersRes.data ?? [];
      const customerMap = new Map(allCustomers.map((c) => [c.id, c]));
      let newCustomers = 0;
      let recurringCustomers = 0;
      periodCustomerIds.forEach((cid) => {
        const c = customerMap.get(cid!);
        if (c && c.total_orders <= 1) newCustomers++;
        else if (c) recurringCustomers++;
      });

      // Reactivation rate (customers inactive 30d+ who ordered in period)
      const thirtyDaysAgo = subDays(new Date(), 30);
      const reactivated = allCustomers.filter((c) => {
        if (!c.last_order_at) return false;
        const lastOrder = new Date(c.last_order_at);
        return lastOrder >= dateRange.from && lastOrder <= dateRange.to && periodCustomerIds.has(c.id);
      });
      const inactiveCount = allCustomers.filter((c) => {
        if (!c.last_order_at) return true;
        return new Date(c.last_order_at) < thirtyDaysAgo;
      }).length;
      const reactivationRate = inactiveCount > 0 ? (reactivated.length / inactiveCount) * 100 : 0;

      // Profit estimation
      const orderIds = validOrders.map((o) => o.id);
      let estimatedProfit = 0;
      let topItemsByProfit: { name: string; profit: number; qty: number }[] = [];
      let topItems: { name: string; qty: number }[] = [];

      if (orderIds.length > 0) {
        const { data: orderItems } = await supabase.from("order_items").select("name, quantity, unit_price, menu_item_id").in("order_id", orderIds);
        const { data: menuItems } = await supabase.from("menu_items").select("id, cost_estimate, margin_percent").eq("restaurant_id", rid!);
        const menuMap = new Map((menuItems ?? []).map((m) => [m.id, m]));

        const itemMap: Record<string, number> = {};
        const profitMap: Record<string, number> = {};

        (orderItems ?? []).forEach((oi) => {
          itemMap[oi.name] = (itemMap[oi.name] || 0) + oi.quantity;
          const mi = oi.menu_item_id ? menuMap.get(oi.menu_item_id) : null;
          if (mi) {
            const price = Number(oi.unit_price);
            const cost = mi.cost_estimate ? Number(mi.cost_estimate) : null;
            const margin = mi.margin_percent ? Number(mi.margin_percent) : null;
            const profit = cost ? (price - cost) * oi.quantity : margin ? (price * margin) * oi.quantity : 0;
            estimatedProfit += profit;
            profitMap[oi.name] = (profitMap[oi.name] || 0) + profit;
          }
        });

        topItems = Object.entries(itemMap).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 5);
        topItemsByProfit = Object.entries(profitMap).map(([name, profit]) => ({ name, profit, qty: itemMap[name] || 0 })).sort((a, b) => b.profit - a.profit).slice(0, 5);
      }

      // Peak hours
      const hourMap: Record<number, number> = {};
      validOrders.forEach((o) => { const h = new Date(o.created_at).getHours(); hourMap[h] = (hourMap[h] || 0) + 1; });
      const peakHours = Array.from({ length: 24 }, (_, i) => ({ hour: `${String(i).padStart(2, "0")}h`, pedidos: hourMap[i] || 0 }));

      // Evolution by day
      const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
      const dayMap: Record<string, { revenue: number; orders: number }> = {};
      days.forEach((d) => { dayMap[format(d, "yyyy-MM-dd")] = { revenue: 0, orders: 0 }; });
      validOrders.forEach((o) => {
        const key = format(new Date(o.created_at), "yyyy-MM-dd");
        if (dayMap[key]) { dayMap[key].revenue += Number(o.total); dayMap[key].orders += 1; }
      });
      const evolution = days.map((d) => {
        const key = format(d, "yyyy-MM-dd");
        return { date: format(d, "dd/MM", { locale: ptBR }), ...dayMap[key] };
      });

      return { revenue, count, avg, peakHours, topItems, topItemsByProfit, evolution, newCustomers, recurringCustomers, reactivationRate, estimatedProfit };
    },
  });

  // Previous comparable period (display-only comparison)
  const prevRange = useMemo(() => {
    const span = dateRange.to.getTime() - dateRange.from.getTime();
    return { from: new Date(dateRange.from.getTime() - span - 1), to: new Date(dateRange.from.getTime() - 1) };
  }, [dateRange]);

  const { data: prevStats } = useQuery({
    queryKey: ["dashboard-stats-prev", rid, prevRange.from.toISOString(), prevRange.to.toISOString()],
    enabled: !!rid,
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("total, status")
        .eq("restaurant_id", rid!)
        .gte("created_at", prevRange.from.toISOString())
        .lte("created_at", prevRange.to.toISOString());
      const valid = (data ?? []).filter((o: any) => o.status !== "canceled");
      const revenue = valid.reduce((s: number, o: any) => s + Number(o.total), 0);
      return { revenue, count: valid.length, avg: valid.length ? revenue / valid.length : 0 };
    },
  });

  const delta = (curr: number, prev?: number) => (prev && prev > 0 ? ((curr - prev) / prev) * 100 : null);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const int = (v: number) => String(Math.round(v));
  const periodLabel = { today: "Hoje", week: "Semana", month: "Mês", custom: "Personalizado" };
  const firstName = (profile?.display_name ?? "").trim().split(" ")[0];

  const cards = [
    { label: "Receita", raw: stats?.revenue ?? 0, format: fmt, icon: DollarSign, hint: <Trend delta={delta(stats?.revenue ?? 0, prevStats?.revenue)} />, accent: true },
    { label: "Pedidos", raw: stats?.count ?? 0, format: int, icon: ShoppingBag, hint: <Trend delta={delta(stats?.count ?? 0, prevStats?.count)} /> },
    { label: "Ticket médio", raw: stats?.avg ?? 0, format: fmt, icon: Target, hint: <Trend delta={delta(stats?.avg ?? 0, prevStats?.avg)} /> },
    { label: "Lucro estimado", raw: stats?.estimatedProfit ?? 0, format: fmt, icon: TrendingUp, hint: <span className="text-muted-foreground">baseado em custo/margem</span> },
    { label: "Clientes novos", raw: stats?.newCustomers ?? 0, format: int, icon: Users, hint: <span className="text-muted-foreground">no período selecionado</span> },
    { label: "Recorrentes", raw: stats?.recurringCustomers ?? 0, format: int, icon: Repeat, hint: <span className="text-muted-foreground">clientes que voltaram</span> },
  ];

  return (
    <AdminLayout>
      <div className="relative">
        {/* ambient gradient */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(60%_100%_at_50%_0%,hsl(var(--accent)/0.07),transparent_70%)]" />

        <div className="relative p-5 md:p-8 max-w-[1400px] mx-auto space-y-6 md:space-y-8">
          {/* Header */}
          <motion.div initial="hidden" animate="show" variants={stagger} className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
            <motion.div variants={fadeUp}>
              <h1 className="font-display text-2xl md:text-[28px] font-semibold tracking-tight text-foreground">
                Bem-vindo de volta{firstName ? `, ${firstName}` : ""} <span className="align-middle">👋</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-1.5">
                Aqui está um resumo do desempenho do seu restaurante {period === "today" ? "hoje" : "no período selecionado"}.
              </p>
            </motion.div>

            <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center p-1 rounded-2xl border border-border bg-card/60 backdrop-blur-xl">
                {(["today", "week", "month"] as Period[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={cn(
                      "relative px-3.5 py-1.5 text-xs font-medium rounded-xl transition-colors",
                      period === p ? "text-accent-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {period === p && (
                      <motion.span layoutId="period-pill" transition={{ type: "spring", stiffness: 400, damping: 32 }}
                        className="absolute inset-0 rounded-xl bg-accent shadow-[0_6px_20px_-8px_hsl(var(--accent)/0.7)]" />
                    )}
                    <span className="relative">{periodLabel[p]}</span>
                  </button>
                ))}
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <Button size="sm" variant={period === "custom" ? "default" : "outline"} className="rounded-xl">
                    <CalendarIcon className="w-4 h-4 mr-1.5" />
                    {period === "custom" && customRange?.from && customRange?.to
                      ? `${format(customRange.from, "dd/MM")} — ${format(customRange.to, "dd/MM")}`
                      : "Personalizado"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl" align="end">
                  <Calendar mode="range" selected={customRange}
                    onSelect={(range) => { setCustomRange(range); if (range?.from && range?.to) setPeriod("custom"); }}
                    numberOfMonths={1} locale={ptBR} className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>

              {hasActiveShift && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={openCloseDialog}
                  className="rounded-xl text-muted-foreground hover:text-foreground gap-1.5"
                  title="Encerrar expediente"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-xs">Encerrar expediente</span>
                </Button>
              )}
            </motion.div>
          </motion.div>

          {/* Setup Progress Banner */}
          {setupStatus && !setupStatus.allDone && !bannerDismissed && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Surface className="p-5 border-accent/25">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                    <Rocket className="w-5 h-5 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-display font-semibold text-sm">Complete a configuração do seu restaurante</h3>
                      <button onClick={() => setBannerDismissed(true)} className="text-muted-foreground hover:text-foreground transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{setupStatus.completed}/{setupStatus.total} etapas concluídas</p>
                    <Progress value={(setupStatus.completed / setupStatus.total) * 100} className="mt-3 h-1.5" />
                    <div className="flex flex-wrap gap-2 mt-3">
                      {setupStatus.steps.filter((s) => !s.done).map((s) => (
                        <span key={s.label} className="text-[11px] px-2.5 py-1 rounded-full bg-secondary/70 border border-border text-muted-foreground">
                          {s.label}
                        </span>
                      ))}
                    </div>
                    <Button size="sm" variant="outline" className="mt-4 rounded-xl" onClick={() => (window.location.href = "/settings")}>
                      Ir para Configurações
                    </Button>
                  </div>
                </div>
              </Surface>
            </motion.div>
          )}

          {shopClosed && (
            <Surface className="p-5 border-destructive/40 bg-destructive/5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <Lock className="w-5 h-5 text-destructive shrink-0" />
                <div className="flex-1">
                  <div className="font-display font-semibold text-destructive text-sm">Recebimento de pedidos encerrado</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {outsideHours
                      ? (countdown
                          ? <>O restaurante está fora do horário. Reabre em <span className="font-semibold text-foreground">{countdown}</span>{nextOpen ? ` (${nextOpen.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "2-digit", minute: "2-digit" })})` : ""}.</>
                          : "O restaurante está fora do horário de funcionamento configurado.")
                      : "O recebimento de pedidos está desativado manualmente. Reabra em Configurações ou pelo Expediente."}
                  </div>
                </div>
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => navigate("/settings")}>Ajustar horários</Button>
              </div>
            </Surface>
          )}

          {/* Public Menu Link */}
          {publicMenuUrl && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Surface hover className="relative overflow-hidden p-5">
                <div className="pointer-events-none absolute -left-16 -top-16 w-52 h-52 rounded-full bg-accent/10 blur-3xl" />
                <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                    <Link className="w-5 h-5 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-semibold text-sm">Link do cardápio digital</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Compartilhe com seus clientes ou use no QR Code das mesas.</p>
                    <p className="text-xs font-mono truncate text-accent mt-2">{publicMenuUrl}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" className="rounded-xl" onClick={copyMenuLink}>
                      <Copy className="w-4 h-4 mr-1.5" /> Copiar
                    </Button>
                    <Button size="sm" className="rounded-xl" onClick={() => window.open(publicMenuUrl, "_blank")}>
                      <ExternalLink className="w-4 h-4 mr-1.5" /> Abrir
                    </Button>
                  </div>
                </div>
              </Surface>
            </motion.div>
          )}

          {/* KPI Cards */}
          <motion.div
            key={`${period}-${dateRange.from.toISOString()}`}
            initial="hidden"
            animate="show"
            variants={stagger}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4"
          >
            {cards.map((card) => (
              <MetricCard
                key={card.label}
                label={card.label}
                icon={card.icon}
                accent={card.accent}
                hint={card.hint}
                value={stats ? <AnimatedValue value={card.raw} format={card.format} /> : <Skeleton className="h-7 w-24" />}
              />
            ))}
          </motion.div>

          {/* Reactivation */}
          <Surface hover className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
              <Repeat className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1">
              <p className="font-display text-xl font-semibold tabular-nums">{(stats?.reactivationRate ?? 0).toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">Taxa de reativação · clientes inativos há 30 dias que voltaram a pedir</p>
            </div>
          </Surface>

          {/* Charts */}
          <div className="grid lg:grid-cols-2 gap-5 md:gap-6">
            <Surface className="p-6">
              <SectionHeader
                title="Evolução de receita"
                subtitle={`${format(dateRange.from, "dd/MM")} — ${format(dateRange.to, "dd/MM")}`}
                icon={TrendingUp}
                action={<span className="text-xs text-muted-foreground hidden sm:block">{periodLabel[period]}</span>}
              />
              {(stats?.evolution?.some((d) => d.revenue > 0) ?? false) ? (
                <ResponsiveContainer width="100%" height={230}>
                  <LineChart data={stats?.evolution ?? []} margin={{ left: -12, right: 8, top: 6 }}>
                    <defs>
                      <linearGradient id="revLine" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="hsl(var(--primary))" />
                        <stop offset="100%" stopColor="hsl(var(--accent))" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 6" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tickLine={false} axisLine={false} width={54} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip cursor={{ stroke: "hsl(var(--accent))", strokeOpacity: 0.25 }} content={<ChartTooltip formatter={fmt} />} />
                    <Line type="monotone" dataKey="revenue" stroke="url(#revLine)" strokeWidth={2.5} dot={false}
                      activeDot={{ r: 4, fill: "hsl(var(--accent))" }} animationDuration={700} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState icon={TrendingUp} title="Sem receita registrada" description="Assim que os primeiros pedidos forem concluídos, a evolução aparecerá aqui." />
              )}
            </Surface>

            <Surface className="p-6">
              <SectionHeader title="Horários de pico" subtitle="Distribuição de pedidos por hora" icon={CalendarIcon} />
              {(stats?.peakHours?.some((h) => h.pedidos > 0) ?? false) ? (
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={stats?.peakHours ?? []} margin={{ left: -18, right: 8, top: 6 }}>
                    <defs>
                      <linearGradient id="peakBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--accent))" />
                        <stop offset="100%" stopColor="hsl(var(--primary))" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 6" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="hour" tickLine={false} axisLine={false} interval={2} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip cursor={{ fill: "hsl(var(--accent)/0.06)" }} content={<ChartTooltip />} />
                    <Bar dataKey="pedidos" fill="url(#peakBar)" radius={[6, 6, 2, 2]} animationDuration={700} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState icon={CalendarIcon} title="Nenhum pedido no período" description="Os horários com maior movimento aparecerão aqui para ajudar no planejamento da equipe." />
              )}
            </Surface>
          </div>

          {/* Top items */}
          <div className="grid lg:grid-cols-2 gap-5 md:gap-6">
            <Surface className="p-6">
              <SectionHeader title="Top itens por vendas" subtitle="Os 5 mais pedidos do período" icon={ShoppingBag} />
              {(stats?.topItems?.length ?? 0) === 0 ? (
                <EmptyState icon={ShoppingBag} title="Nenhum pedido neste período" description="Quando os pedidos começarem a chegar, seus campeões de venda aparecerão aqui." />
              ) : (
                <ul className="space-y-1">
                  {stats?.topItems?.map((item, i) => (
                    <motion.li key={item.name} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                      className="flex justify-between items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-secondary/50 transition-colors">
                      <span className="flex items-center gap-3 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-secondary border border-border text-[11px] font-semibold flex items-center justify-center text-muted-foreground shrink-0">{i + 1}</span>
                        <span className="text-sm truncate">{item.name}</span>
                      </span>
                      <span className="font-mono text-sm font-semibold tabular-nums shrink-0">{item.qty}x</span>
                    </motion.li>
                  ))}
                </ul>
              )}
            </Surface>

            <Surface className="p-6">
              <SectionHeader title="Top itens por lucro" subtitle="Maior contribuição de margem" icon={TrendingUp} />
              {(stats?.topItemsByProfit?.length ?? 0) === 0 ? (
                <EmptyState icon={Target} title="Sem dados de custo ou margem" description="Cadastre custo/margem dos itens no cardápio para desbloquear a análise de lucratividade." />
              ) : (
                <ul className="space-y-1">
                  {stats?.topItemsByProfit?.map((item, i) => (
                    <motion.li key={item.name} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                      className="flex justify-between items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-secondary/50 transition-colors">
                      <span className="flex items-center gap-3 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-secondary border border-border text-[11px] font-semibold flex items-center justify-center text-muted-foreground shrink-0">{i + 1}</span>
                        <span className="text-sm truncate">{item.name}</span>
                      </span>
                      <span className="font-mono text-sm font-semibold tabular-nums text-emerald-400 shrink-0">{fmt(item.profit)}</span>
                    </motion.li>
                  ))}
                </ul>
              )}
            </Surface>
          </div>
        </div>
      </div>


      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-destructive" /> Encerrar expediente
            </DialogTitle>
            <DialogDescription>
              Esta ação encerra o turno atual. Confira os pedidos em aberto antes de continuar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="text-sm font-medium">
              Pedidos em aberto {loadingOpenOrders ? "…" : `(${openOrders.length})`}
            </div>

            {!loadingOpenOrders && openOrders.length === 0 && (
              <div className="text-sm text-muted-foreground rounded-lg border border-border p-3">
                Nenhum pedido pendente. Você pode encerrar com segurança.
              </div>
            )}

            {openOrders.length > 0 && (
              <>
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    Existem pedidos ainda não finalizados. Encerrar agora exigirá justificativa e pode confundir clientes que ainda aguardam.
                  </div>
                </div>
                <div className="max-h-56 overflow-y-auto space-y-1.5 rounded-lg border border-border p-2">
                  {openOrders.map((o) => (
                    <div key={o.id} className="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded hover:bg-secondary">
                      <div className="flex flex-col min-w-0">
                        <span className="font-mono truncate">#{o.id.slice(0, 8)}</span>
                        <span className="text-muted-foreground">
                          {format(new Date(o.created_at), "HH:mm")} · {o.order_type} · {o.status}
                        </span>
                      </div>
                      <span className="font-semibold shrink-0">
                        R$ {Number(o.total ?? 0).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="pt-2">
              <label className="text-xs text-muted-foreground">
                Para confirmar, digite <span className="font-mono font-semibold text-foreground">ENCERRAR</span>
              </label>
              <Input
                autoFocus
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                placeholder="ENCERRAR"
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setCloseDialogOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={confirmText.trim() !== "ENCERRAR" || loadingOpenOrders}
              onClick={() => { setCloseDialogOpen(false); navigate("/expediente"); }}
            >
              <Lock className="w-4 h-4 mr-1" /> Confirmar e continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default Dashboard;

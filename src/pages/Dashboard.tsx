import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, subDays, startOfDay, endOfDay, eachDayOfInterval, startOfWeek, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, TrendingUp, Users, DollarSign, ShoppingBag, Repeat, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

type Period = "today" | "week" | "month" | "custom";

const Dashboard = () => {
  const { profile } = useAuth();
  const rid = profile?.restaurant_id;
  const [period, setPeriod] = useState<Period>("today");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();

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

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const periodLabel = { today: "Hoje", week: "Semana", month: "Mês", custom: "Personalizado" };

  const cards = [
    { label: "Receita", value: fmt(stats?.revenue ?? 0), icon: DollarSign, color: "text-green-400" },
    { label: "Pedidos", value: String(stats?.count ?? 0), icon: ShoppingBag, color: "text-primary" },
    { label: "Ticket Médio", value: fmt(stats?.avg ?? 0), icon: Target, color: "text-blue-400" },
    { label: "Lucro Estimado", value: fmt(stats?.estimatedProfit ?? 0), icon: TrendingUp, color: "text-emerald-400" },
    { label: "Clientes Novos", value: String(stats?.newCustomers ?? 0), icon: Users, color: "text-cyan-400" },
    { label: "Recorrentes", value: String(stats?.recurringCustomers ?? 0), icon: Repeat, color: "text-purple-400" },
  ];

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h1 className="font-display text-2xl md:text-3xl font-bold">📊 <span className="gradient-text">Dashboard</span></h1>
          <div className="flex gap-2 flex-wrap">
            {(["today", "week", "month"] as Period[]).map((p) => (
              <Button key={p} size="sm" variant={period === p ? "default" : "outline"} onClick={() => setPeriod(p)}>
                {periodLabel[p]}
              </Button>
            ))}
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant={period === "custom" ? "default" : "outline"}>
                  <CalendarIcon className="w-4 h-4 mr-1" />
                  {period === "custom" && customRange?.from && customRange?.to
                    ? `${format(customRange.from, "dd/MM")} — ${format(customRange.to, "dd/MM")}`
                    : "Personalizado"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar mode="range" selected={customRange}
                  onSelect={(range) => { setCustomRange(range); if (range?.from && range?.to) setPeriod("custom"); }}
                  numberOfMonths={1} locale={ptBR} className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {cards.map((card) => (
            <div key={card.label} className="glass-card p-4">
              <card.icon className={`w-5 h-5 mb-2 ${card.color}`} />
              <p className="font-display text-lg md:text-xl font-bold">{card.value}</p>
              <p className="text-xs text-muted-foreground">{card.label}</p>
            </div>
          ))}
        </div>

        {/* Reactivation Rate */}
        <div className="glass-card p-4 mb-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Repeat className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="font-display font-bold text-lg">{(stats?.reactivationRate ?? 0).toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">Taxa de Reativação (30 dias)</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Revenue evolution */}
          <div className="glass-card p-6">
            <h2 className="font-display font-bold mb-4">Evolução de Receita</h2>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={stats?.evolution ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Peak hours */}
          <div className="glass-card p-6">
            <h2 className="font-display font-bold mb-4">Horários de Pico</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats?.peakHours ?? []}>
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="pedidos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Top Items by Sales */}
          <div className="glass-card p-6">
            <h2 className="font-display font-bold mb-4">Top Itens (Vendas)</h2>
            {(stats?.topItems?.length ?? 0) === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum pedido neste período.</p>
            ) : (
              <ul className="space-y-2">
                {stats?.topItems?.map((item, i) => (
                  <li key={item.name} className="flex justify-between items-center">
                    <span className="text-sm"><span className="text-muted-foreground mr-2">#{i + 1}</span>{item.name}</span>
                    <span className="font-mono text-sm font-bold">{item.qty}x</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Top Items by Profit */}
          <div className="glass-card p-6">
            <h2 className="font-display font-bold mb-4">Top Itens (Lucro)</h2>
            {(stats?.topItemsByProfit?.length ?? 0) === 0 ? (
              <p className="text-muted-foreground text-sm">Sem dados de custo/margem cadastrados.</p>
            ) : (
              <ul className="space-y-2">
                {stats?.topItemsByProfit?.map((item, i) => (
                  <li key={item.name} className="flex justify-between items-center">
                    <span className="text-sm"><span className="text-muted-foreground mr-2">#{i + 1}</span>{item.name}</span>
                    <span className="font-mono text-sm font-bold text-green-400">{fmt(item.profit)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default Dashboard;

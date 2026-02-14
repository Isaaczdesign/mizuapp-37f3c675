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
import { CalendarIcon } from "lucide-react";
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
      const { data: orders } = await supabase
        .from("orders")
        .select("id, total, created_at, status")
        .eq("restaurant_id", rid!)
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString());

      const validOrders = (orders ?? []).filter((o) => o.status !== "canceled");
      const revenue = validOrders.reduce((s, o) => s + Number(o.total), 0);
      const count = validOrders.length;
      const avg = count > 0 ? revenue / count : 0;

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

      // Top items
      const orderIds = validOrders.map((o) => o.id);
      let topItems: { name: string; qty: number }[] = [];
      if (orderIds.length > 0) {
        const { data: items } = await supabase.from("order_items").select("name, quantity").in("order_id", orderIds);
        const itemMap: Record<string, number> = {};
        (items ?? []).forEach((i) => { itemMap[i.name] = (itemMap[i.name] || 0) + i.quantity; });
        topItems = Object.entries(itemMap).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 5);
      }

      return { revenue, count, avg, peakHours, topItems, evolution };
    },
  });

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const periodLabel = { today: "Hoje", week: "Semana", month: "Mês", custom: "Personalizado" };

  const cards = [
    { label: "Receita", value: fmt(stats?.revenue ?? 0), icon: "💰" },
    { label: "Pedidos", value: String(stats?.count ?? 0), icon: "📦" },
    { label: "Ticket Médio", value: fmt(stats?.avg ?? 0), icon: "🎫" },
    { label: "Top Itens", value: String(stats?.topItems?.length ?? 0), icon: "🏆" },
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
                <Calendar
                  mode="range"
                  selected={customRange}
                  onSelect={(range) => { setCustomRange(range); if (range?.from && range?.to) setPeriod("custom"); }}
                  numberOfMonths={1}
                  locale={ptBR}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {cards.map((card) => (
            <div key={card.label} className="glass-card p-4">
              <p className="text-2xl mb-1">{card.icon}</p>
              <p className="font-display text-xl md:text-2xl font-bold">{card.value}</p>
              <p className="text-xs text-muted-foreground">{card.label}</p>
            </div>
          ))}
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

        {/* Top Items */}
        <div className="glass-card p-6">
          <h2 className="font-display font-bold mb-4">Top Itens do Período</h2>
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
      </div>
    </AdminLayout>
  );
};

export default Dashboard;

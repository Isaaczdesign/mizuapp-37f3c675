import { useAuth } from "@/hooks/useAuth";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const Dashboard = () => {
  const { profile } = useAuth();
  const rid = profile?.restaurant_id;

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", rid],
    enabled: !!rid,
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: orders } = await supabase
        .from("orders")
        .select("id, total, created_at, status")
        .eq("restaurant_id", rid!)
        .gte("created_at", todayStart.toISOString());

      const validOrders = (orders ?? []).filter((o) => o.status !== "canceled");
      const revenue = validOrders.reduce((s, o) => s + Number(o.total), 0);
      const count = validOrders.length;
      const avg = count > 0 ? revenue / count : 0;

      // peak hours
      const hourMap: Record<number, number> = {};
      validOrders.forEach((o) => {
        const h = new Date(o.created_at).getHours();
        hourMap[h] = (hourMap[h] || 0) + 1;
      });
      const peakHours = Array.from({ length: 24 }, (_, i) => ({
        hour: `${String(i).padStart(2, "0")}h`,
        pedidos: hourMap[i] || 0,
      }));

      // top items
      const orderIds = validOrders.map((o) => o.id);
      let topItems: { name: string; qty: number }[] = [];
      if (orderIds.length > 0) {
        const { data: items } = await supabase
          .from("order_items")
          .select("name, quantity")
          .in("order_id", orderIds);
        const itemMap: Record<string, number> = {};
        (items ?? []).forEach((i) => {
          itemMap[i.name] = (itemMap[i.name] || 0) + i.quantity;
        });
        topItems = Object.entries(itemMap)
          .map(([name, qty]) => ({ name, qty }))
          .sort((a, b) => b.qty - a.qty)
          .slice(0, 5);
      }

      return { revenue, count, avg, peakHours, topItems };
    },
  });

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const cards = [
    { label: "Receita Hoje", value: fmt(stats?.revenue ?? 0), icon: "💰" },
    { label: "Pedidos Hoje", value: String(stats?.count ?? 0), icon: "📦" },
    { label: "Ticket Médio", value: fmt(stats?.avg ?? 0), icon: "🎫" },
    { label: "Top Itens", value: String(stats?.topItems?.length ?? 0), icon: "🏆" },
  ];

  return (
    <AdminLayout>
      <div className="p-6">
        <h1 className="font-display text-2xl md:text-3xl font-bold mb-6">
          📊 <span className="gradient-text">Dashboard</span>
        </h1>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {cards.map((card) => (
            <div key={card.label} className="glass-card p-4">
              <p className="text-2xl mb-1">{card.icon}</p>
              <p className="font-display text-xl md:text-2xl font-bold">{card.value}</p>
              <p className="text-xs text-muted-foreground">{card.label}</p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Peak Hours */}
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

          {/* Top Items */}
          <div className="glass-card p-6">
            <h2 className="font-display font-bold mb-4">Top Itens do Dia</h2>
            {(stats?.topItems?.length ?? 0) === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum pedido hoje ainda.</p>
            ) : (
              <ul className="space-y-2">
                {stats?.topItems?.map((item, i) => (
                  <li key={item.name} className="flex justify-between items-center">
                    <span className="text-sm">
                      <span className="text-muted-foreground mr-2">#{i + 1}</span>
                      {item.name}
                    </span>
                    <span className="font-mono text-sm font-bold">{item.qty}x</span>
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

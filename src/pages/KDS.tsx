import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import AdminLayout from "@/components/AdminLayout";

type OrderStatus = Database["public"]["Enums"]["order_status"];

interface Order {
  id: string;
  status: OrderStatus;
  notes: string | null;
  total: number;
  created_at: string;
  table_id: string | null;
  order_items: { id: string; name: string; quantity: number; notes: string | null }[];
  restaurant_tables: { number: number } | null;
}

const statusConfig: Record<string, { label: string; color: string; next?: OrderStatus }> = {
  new: { label: "NOVO", color: "bg-primary", next: "preparing" },
  preparing: { label: "PREPARANDO", color: "bg-yellow-500", next: "ready" },
  ready: { label: "PRONTO", color: "bg-green-500" },
};

const KDS = () => {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const restaurantId = profile?.restaurant_id;

  useEffect(() => {
    if (!restaurantId) return;
    loadOrders();

    const channel = supabase
      .channel("kds-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` }, () => {
        loadOrders();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [restaurantId]);

  async function loadOrders() {
    if (!restaurantId) return;
    const { data } = await supabase
      .from("orders")
      .select("id, status, notes, total, created_at, table_id, order_items(id, name, quantity, notes), restaurant_tables(number)")
      .eq("restaurant_id", restaurantId)
      .in("status", ["new", "preparing", "ready"])
      .order("created_at", { ascending: true });

    setOrders((data as unknown as Order[]) ?? []);
    setLoading(false);
  }

  async function updateStatus(orderId: string, newStatus: OrderStatus) {
    const { error } = await supabase.from("orders").update({ status: newStatus }).eq("id", orderId);
    if (error) { toast.error("Erro ao atualizar"); return; }
    toast.success("Status atualizado!");
  }

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

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl md:text-3xl font-bold">
          🍳 <span className="gradient-text">Cozinha</span>
        </h1>
        <span className="text-muted-foreground text-sm">{orders.length} pedidos ativos</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-100px)]">
        {columns.map((status) => {
          const config = statusConfig[status];
          const col = orders.filter((o) => o.status === status);
          return (
            <div key={status} className="flex flex-col">
              <div className={`${config.color} text-primary-foreground rounded-t-xl px-4 py-2 font-display font-bold text-lg flex items-center justify-between`}>
                <span>{config.label}</span>
                <span className="bg-background/20 rounded-full w-8 h-8 flex items-center justify-center text-sm">{col.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto bg-card/30 rounded-b-xl border border-border border-t-0 p-2 space-y-2">
                {col.map((order) => {
                  const mins = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
                  return (
                    <div key={order.id} className="glass-card p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-display font-bold text-lg">
                          {order.restaurant_tables ? `Mesa ${order.restaurant_tables.number}` : `#${order.id.slice(0, 6)}`}
                        </span>
                        <span className={`text-xs font-mono ${mins > 15 ? "text-destructive" : "text-muted-foreground"}`}>
                          {mins}min
                        </span>
                      </div>
                      <ul className="space-y-1 mb-3">
                        {order.order_items.map((item) => (
                          <li key={item.id} className="text-base font-medium">
                            <span className="text-primary font-bold mr-1">{item.quantity}x</span>
                            {item.name}
                            {item.notes && <p className="text-xs text-muted-foreground ml-5">⚠️ {item.notes}</p>}
                          </li>
                        ))}
                      </ul>
                      {order.notes && <p className="text-xs text-muted-foreground mb-2 italic">📝 {order.notes}</p>}
                      {config.next && (
                        <Button
                          variant="hero"
                          className="w-full"
                          onClick={() => updateStatus(order.id, config.next!)}
                        >
                          {config.next === "preparing" ? "▶ Iniciar" : "✅ Pronto"}
                        </Button>
                      )}
                    </div>
                  );
                })}
                {col.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">Nenhum pedido</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default KDS;

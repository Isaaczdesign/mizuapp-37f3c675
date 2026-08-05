import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// Conta pedidos "novos" (status='new') que já estão visíveis no dashboard,
// ou seja: pagamento offline (payment_status null) OU pagos (paid/approved).
export function usePendingOrdersCount() {
  const { profile } = useAuth();
  const restaurantId = profile?.restaurant_id;
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!restaurantId) return;

    let cancelled = false;
    async function load() {
      const { count: c } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurantId as string)
        .eq("status", "new")
        .or("payment_status.is.null,payment_status.eq.paid,payment_status.eq.approved");
      if (!cancelled) setCount(c ?? 0);
    }
    load();

    const channel = supabase
      .channel(`pending-orders-count-${restaurantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` }, load)
      .subscribe();
    const poll = setInterval(load, 10000);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [restaurantId]);

  return count;
}

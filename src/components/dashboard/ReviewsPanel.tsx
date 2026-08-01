import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { Surface, SectionHeader, EmptyState } from "@/components/dashboard/ui";

function StarRow({ value, size = 12 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          style={{ width: size, height: size }}
          className={n <= value ? "text-primary" : "text-muted-foreground/30"}
          fill={n <= value ? "currentColor" : "none"}
          strokeWidth={1.6}
        />
      ))}
    </span>
  );
}

/** Painel de avaliações dos clientes (nota do pedido + itens mais bem avaliados). */
export default function ReviewsPanel({ restaurantId }: { restaurantId?: string | null }) {
  const { data } = useQuery({
    queryKey: ["dashboard-reviews", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const [reviewsRes, itemsRes] = await Promise.all([
        (supabase as any)
          .from("order_reviews")
          .select("id, rating, comment, created_at")
          .eq("restaurant_id", restaurantId!)
          .order("created_at", { ascending: false })
          .limit(30),
        (supabase as any)
          .from("order_item_reviews")
          .select("rating, menu_item_id, menu_items(name)")
          .eq("restaurant_id", restaurantId!)
          .limit(500),
      ]);

      const reviews = (reviewsRes.data ?? []) as any[];
      const avg = reviews.length
        ? reviews.reduce((s, r) => s + Number(r.rating), 0) / reviews.length
        : 0;

      const byItem = new Map<string, { name: string; sum: number; n: number }>();
      for (const ir of (itemsRes.data ?? []) as any[]) {
        const name = ir.menu_items?.name;
        if (!name) continue;
        const cur = byItem.get(name) ?? { name, sum: 0, n: 0 };
        cur.sum += Number(ir.rating);
        cur.n += 1;
        byItem.set(name, cur);
      }
      const topItems = [...byItem.values()]
        .map((v) => ({ name: v.name, avg: v.sum / v.n, n: v.n }))
        .sort((a, b) => b.avg - a.avg || b.n - a.n)
        .slice(0, 5);

      return { reviews, avg, topItems, total: reviews.length };
    },
  });

  return (
    <Surface className="p-4 lg:col-span-2 flex flex-col min-h-[240px] lg:min-h-0">
      <SectionHeader
        title="Avaliações dos clientes"
        subtitle={data?.total ? `${data.total} avaliações recentes` : "Notas de 1 a 5 estrelas"}
        icon={Star}
        action={
          data?.total ? (
            <span className="inline-flex items-center gap-2">
              <span className="font-mono text-sm font-semibold tabular-nums">{data.avg.toFixed(1)}</span>
              <StarRow value={Math.round(data.avg)} />
            </span>
          ) : null
        }
      />
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">
        {!data?.total ? (
          <EmptyState
            className="h-full"
            icon={Star}
            title="Ainda sem avaliações"
            description="Os clientes podem avaliar o pedido e cada item na tela de acompanhamento."
          />
        ) : (
          <>
            {data.topItems.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium mb-1.5">
                  Itens mais bem avaliados
                </p>
                <ul className="space-y-0.5">
                  {data.topItems.map((it, i) => (
                    <motion.li
                      key={it.name}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex justify-between items-center gap-3 rounded-xl px-2.5 py-1.5 hover:bg-secondary/50 transition-colors"
                    >
                      <span className="text-xs truncate">{it.name}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        <StarRow value={Math.round(it.avg)} />
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">
                          {it.avg.toFixed(1)} ({it.n})
                        </span>
                      </span>
                    </motion.li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-3 border-t border-border/60">
              <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium mb-1.5">
                Comentários recentes
              </p>
              <ul className="space-y-2">
                {data.reviews.slice(0, 6).map((r: any) => (
                  <li key={r.id} className="rounded-xl bg-secondary/40 border border-border/60 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <StarRow value={r.rating} />
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    {r.comment && <p className="text-xs mt-1 text-muted-foreground break-words">“{r.comment}”</p>}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </Surface>
  );
}

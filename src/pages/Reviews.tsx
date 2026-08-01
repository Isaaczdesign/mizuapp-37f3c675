import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Star, MessageSquare } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PageShell, PageHeader, Surface, SectionHeader, EmptyState } from "@/components/dashboard/ui";
import { Button } from "@/components/ui/button";

function StarRow({ value, size = 14 }: { value: number; size?: number }) {
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

export default function Reviews() {
  const { profile } = useAuth();
  const rid = profile?.restaurant_id;
  const [filter, setFilter] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["reviews-page", rid],
    enabled: !!rid,
    queryFn: async () => {
      const [reviewsRes, itemsRes] = await Promise.all([
        (supabase as any)
          .from("order_reviews")
          .select("id, rating, comment, created_at")
          .eq("restaurant_id", rid!)
          .order("created_at", { ascending: false })
          .limit(200),
        (supabase as any)
          .from("order_item_reviews")
          .select("rating, menu_item_id, menu_items(name)")
          .eq("restaurant_id", rid!)
          .limit(1000),
      ]);

      const reviews = (reviewsRes.data ?? []) as any[];
      const avg = reviews.length ? reviews.reduce((s, r) => s + Number(r.rating), 0) / reviews.length : 0;

      const dist = [1, 2, 3, 4, 5].map((n) => ({
        stars: n,
        count: reviews.filter((r) => Number(r.rating) === n).length,
      }));

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
        .sort((a, b) => b.avg - a.avg || b.n - a.n);

      return { reviews, avg, dist, topItems, total: reviews.length };
    },
  });

  const filtered = useMemo(
    () => (data?.reviews ?? []).filter((r: any) => (filter ? Number(r.rating) === filter : true)),
    [data, filter],
  );

  return (
    <AdminLayout>
      <PageShell>
        <PageHeader
          emoji="⭐"
          title="Avaliações"
          subtitle="O que seus clientes acharam dos pedidos e dos itens do cardápio."
        />

        {!isLoading && !data?.total ? (
          <Surface className="p-6">
            <EmptyState
              icon={Star}
              title="Ainda sem avaliações"
              description="Os clientes podem avaliar o pedido e cada item na tela de acompanhamento do pedido."
            />
          </Surface>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            <Surface className="p-5 flex flex-col items-center justify-center text-center gap-2">
              <span className="font-mono text-5xl font-semibold tabular-nums">{(data?.avg ?? 0).toFixed(1)}</span>
              <StarRow value={Math.round(data?.avg ?? 0)} size={20} />
              <p className="text-xs text-muted-foreground">{data?.total ?? 0} avaliações</p>
            </Surface>

            <Surface className="p-5 lg:col-span-2">
              <SectionHeader title="Distribuição das notas" icon={Star} />
              <ul className="space-y-2">
                {[...(data?.dist ?? [])].reverse().map((d) => {
                  const pct = data?.total ? (d.count / data.total) * 100 : 0;
                  return (
                    <li key={d.stars} className="flex items-center gap-3">
                      <span className="w-10 text-xs text-muted-foreground tabular-nums">{d.stars}★</span>
                      <div className="flex-1 h-2 rounded-full bg-secondary/60 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6 }}
                          className="h-full rounded-full bg-primary"
                        />
                      </div>
                      <span className="w-8 text-right font-mono text-xs tabular-nums text-muted-foreground">
                        {d.count}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Surface>

            <Surface className="p-5">
              <SectionHeader title="Itens mais bem avaliados" subtitle="Média por item" icon={Star} />
              {data?.topItems.length ? (
                <ul className="space-y-0.5 max-h-[420px] overflow-y-auto pr-1">
                  {data.topItems.map((it, i) => (
                    <motion.li
                      key={it.name}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i, 10) * 0.03 }}
                      className="flex justify-between items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-secondary/50 transition-colors"
                    >
                      <span className="text-xs truncate">{it.name}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        <StarRow value={Math.round(it.avg)} size={12} />
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">
                          {it.avg.toFixed(1)} ({it.n})
                        </span>
                      </span>
                    </motion.li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhum item avaliado ainda.</p>
              )}
            </Surface>

            <Surface className="p-5 lg:col-span-2">
              <SectionHeader
                title="Comentários dos clientes"
                subtitle={`${filtered.length} avaliações`}
                icon={MessageSquare}
                action={
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant={filter === null ? "default" : "outline"} onClick={() => setFilter(null)}>
                      Todas
                    </Button>
                    {[5, 4, 3, 2, 1].map((n) => (
                      <Button
                        key={n}
                        size="sm"
                        variant={filter === n ? "default" : "outline"}
                        onClick={() => setFilter(n)}
                      >
                        {n}★
                      </Button>
                    ))}
                  </div>
                }
              />
              {filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma avaliação com esse filtro.</p>
              ) : (
                <ul className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                  {filtered.map((r: any) => (
                    <li key={r.id} className="rounded-xl bg-secondary/40 border border-border/60 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <StarRow value={r.rating} />
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(r.created_at).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      {r.comment ? (
                        <p className="text-xs mt-1 text-muted-foreground break-words">“{r.comment}”</p>
                      ) : (
                        <p className="text-xs mt-1 text-muted-foreground/60 italic">Sem comentário</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Surface>
          </div>
        )}
      </PageShell>
    </AdminLayout>
  );
}

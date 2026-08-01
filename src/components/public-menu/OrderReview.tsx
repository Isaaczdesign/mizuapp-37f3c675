import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Sparkles, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type OrderItemLite = { id: string; name: string; quantity: number };

type ExistingReview = {
  rating: number;
  comment: string | null;
  created_at: string;
  items: { order_item_id: string; rating: number; comment: string | null }[];
};

const RATING_LABELS: Record<number, string> = {
  1: "Muito ruim",
  2: "Ruim",
  3: "Ok",
  4: "Muito bom",
  5: "Excelente!",
};

/** Estrelas animadas reutilizáveis. */
function Stars({
  value,
  onChange,
  size = "lg",
  readOnly = false,
}: {
  value: number;
  onChange?: (n: number) => void;
  size?: "sm" | "lg";
  readOnly?: boolean;
}) {
  const [hover, setHover] = useState(0);
  const dim = size === "lg" ? "w-9 h-9" : "w-5 h-5";
  const shown = hover || value;
  return (
    <div className="flex items-center gap-1" role={readOnly ? undefined : "radiogroup"}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= shown;
        return (
          <motion.button
            key={n}
            type="button"
            disabled={readOnly}
            aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
            aria-pressed={value === n}
            whileTap={readOnly ? undefined : { scale: 0.82 }}
            animate={filled ? { scale: 1.06 } : { scale: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 18 }}
            onMouseEnter={() => !readOnly && setHover(n)}
            onMouseLeave={() => !readOnly && setHover(0)}
            onClick={() => !readOnly && onChange?.(n)}
            className={`${readOnly ? "cursor-default" : "cursor-pointer"} p-0.5`}
          >
            <Star
              className={`${dim} transition-colors ${
                filled ? "text-primary" : "text-muted-foreground/35"
              }`}
              fill={filled ? "currentColor" : "none"}
              strokeWidth={filled ? 1.5 : 1.8}
              style={filled ? { filter: "drop-shadow(0 0 8px hsl(var(--primary)/0.55))" } : undefined}
            />
          </motion.button>
        );
      })}
    </div>
  );
}

/**
 * Avaliação do pedido (até 5 estrelas) com nota individual por item.
 * Aparece na página de acompanhamento quando o pedido é concluído/entregue.
 */
export default function OrderReview({ token }: { token: string }) {
  const [items, setItems] = useState<OrderItemLite[]>([]);
  const [existing, setExisting] = useState<ExistingReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [itemRatings, setItemRatings] = useState<Record<string, number>>({});
  const [sending, setSending] = useState(false);
  const [justSent, setJustSent] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [itemsRes, reviewRes] = await Promise.all([
        (supabase as any).rpc("get_public_order_items", { _token: token }),
        (supabase as any).rpc("get_public_order_review", { _token: token }),
      ]);
      if (!alive) return;
      setItems(itemsRes.data ?? []);
      setExisting(reviewRes.data?.[0] ?? null);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  async function submit() {
    if (rating < 1) {
      toast.error("Escolha de 1 a 5 estrelas");
      return;
    }
    setSending(true);
    const { error } = await (supabase as any).rpc("submit_order_review", {
      _token: token,
      _rating: rating,
      _comment: comment.trim() || null,
      _items: Object.entries(itemRatings)
        .filter(([, v]) => v > 0)
        .map(([order_item_id, r]) => ({ order_item_id, rating: r })),
    });
    setSending(false);
    if (error) {
      toast.error(error.message ?? "Não foi possível enviar sua avaliação");
      return;
    }
    if (navigator.vibrate) navigator.vibrate([12, 40, 12]);
    setJustSent(true);
    setExisting({
      rating,
      comment: comment.trim() || null,
      created_at: new Date().toISOString(),
      items: Object.entries(itemRatings).map(([order_item_id, r]) => ({
        order_item_id,
        rating: r,
        comment: null,
      })),
    });
    toast.success("Obrigado pela avaliação!");
  }

  if (loading) return null;

  if (existing) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-5 mt-6 relative overflow-hidden"
      >
        <AnimatePresence>
          {justSent && (
            <motion.div
              initial={{ x: "-120%" }}
              animate={{ x: "120%" }}
              transition={{ duration: 1.1, ease: "easeOut" }}
              className="absolute inset-y-0 w-1/2"
              style={{ background: "linear-gradient(90deg, transparent, hsl(var(--primary)/0.18), transparent)" }}
            />
          )}
        </AnimatePresence>
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 className="w-4 h-4 text-primary" />
          <h2 className="font-display font-bold text-sm">Sua avaliação</h2>
        </div>
        <Stars value={existing.rating} readOnly />
        <p className="text-xs text-muted-foreground mt-2">
          {RATING_LABELS[existing.rating]} · obrigado por ajudar o restaurante a melhorar.
        </p>
        {existing.comment && (
          <p className="text-sm mt-3 border-t border-border pt-3 italic text-muted-foreground">
            “{existing.comment}”
          </p>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 240, damping: 24 }}
      className="glass-card p-5 mt-6 space-y-5 border-primary/25"
    >
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-medium uppercase tracking-wider">
          <Sparkles className="w-3 h-3" />
          Avalie seu pedido
        </div>
        <h2 className="font-display font-bold text-lg">Como foi sua experiência?</h2>
        <div className="flex justify-center pt-1">
          <Stars value={rating} onChange={setRating} />
        </div>
        <AnimatePresence mode="wait">
          {rating > 0 && (
            <motion.p
              key={rating}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="text-sm font-medium text-primary"
            >
              {RATING_LABELS[rating]}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {items.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
            Avalie os itens (opcional)
          </p>
          <div className="space-y-2">
            {items.map((it) => (
              <div
                key={it.id}
                className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-border bg-secondary/40"
              >
                <span className="text-sm min-w-0 truncate">
                  <span className="text-muted-foreground">{it.quantity}× </span>
                  {it.name}
                </span>
                <div className="shrink-0">
                  <Stars
                    size="sm"
                    value={itemRatings[it.id] ?? 0}
                    onChange={(n) => setItemRatings((p) => ({ ...p, [it.id]: n }))}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="review-comment" className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
          Comentário (opcional)
        </label>
        <textarea
          id="review-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, 1000))}
          rows={3}
          placeholder="Conte o que você achou do sabor, da entrega, do atendimento…"
          className="w-full rounded-xl bg-secondary/50 border border-border px-3 py-2.5 text-sm resize-none outline-none focus:border-primary/60 transition-colors"
        />
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={sending || rating < 1}
        className="w-full min-h-[50px] rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 transition-transform active:scale-[0.985] disabled:opacity-40 disabled:pointer-events-none"
      >
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" fill="currentColor" />}
        Enviar avaliação
      </button>
    </motion.div>
  );
}

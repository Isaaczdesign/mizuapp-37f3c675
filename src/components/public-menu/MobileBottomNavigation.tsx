import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ShoppingBag, ReceiptText, TicketPercent, X, ChevronRight, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { loadActiveOrders, type RecentOrder } from "@/lib/publicMenuStorage";
import { toast } from "sonner";

export type BottomNavTab = "cart" | "orders" | "coupons";

interface PublicCoupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  expires_at: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  new: "Pedido recebido",
  preparing: "Em preparo",
  ready: "Pronto",
  out_for_delivery: "A caminho",
};

const TABS: { key: BottomNavTab; label: string; icon: typeof ShoppingBag; aria: string }[] = [
  { key: "cart", label: "Carrinho", icon: ShoppingBag, aria: "Abrir carrinho" },
  { key: "orders", label: "Pedidos", icon: ReceiptText, aria: "Acompanhar pedidos" },
  { key: "coupons", label: "Cupons", icon: TicketPercent, aria: "Ver cupons disponíveis" },
];

const MIZU_GOLD = "#ffdc8b";

/** Contraste simples para decidir a cor do ícone sobre a cápsula ativa. */
function readableInk(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#101010";
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#101010" : "#ffffff";
}

function fmtDiscount(c: PublicCoupon) {
  return c.discount_type === "percent"
    ? `${Number(c.discount_value)}% OFF`
    : `R$ ${Number(c.discount_value).toFixed(2).replace(".", ",")} OFF`;
}

export default function MobileBottomNavigation({
  restaurantId,
  restaurantSlug,
  accentColor,
  cartItemCount,
  cartLoading = false,
  onOpenCart,
  activeTab,
  hidden = false,
}: {
  restaurantId: string;
  restaurantSlug: string | null;
  accentColor?: string | null;
  cartItemCount: number;
  cartLoading?: boolean;
  onOpenCart: () => void;
  activeTab?: BottomNavTab;
  hidden?: boolean;
}) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [sheet, setSheet] = useState<null | "orders" | "coupons">(null);
  const [internalActive, setInternalActive] = useState<BottomNavTab>("cart");
  const active = activeTab ?? internalActive;

  const accent = accentColor || MIZU_GOLD;
  const activeInk = useMemo(() => readableInk(accent), [accent]);

  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [coupons, setCoupons] = useState<PublicCoupon[] | null>(null);
  const [loadingCoupons, setLoadingCoupons] = useState(false);
  const [couponsError, setCouponsError] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const refreshOrders = useCallback(() => {
    // leitura local é síncrona: nada de delay artificial (evita sensação de travamento)
    setOrders(loadActiveOrders(restaurantSlug ?? undefined));
    setOrdersLoading(false);
  }, [restaurantSlug]);

  const fetchCoupons = useCallback(() => {
    setLoadingCoupons(true);
    setCouponsError(false);
    (supabase as any)
      .rpc("get_public_coupons", { _restaurant_id: restaurantId })
      .then(({ data, error }: { data: PublicCoupon[] | null; error: unknown }) => {
        if (error) {
          setCouponsError(true);
          setCoupons(null);
        } else {
          setCoupons(data ?? []);
        }
        setLoadingCoupons(false);
      })
      .catch(() => {
        setCouponsError(true);
        setLoadingCoupons(false);
      });
  }, [restaurantId]);

  // Pré-carrega cupons e pedidos em idle para o sheet abrir instantâneo.
  useEffect(() => {
    if (!restaurantId) return;
    const ric: typeof window.requestIdleCallback | undefined = window.requestIdleCallback;
    const run = () => {
      setOrders(loadActiveOrders(restaurantSlug ?? undefined));
      fetchCoupons();
    };
    const id = ric ? ric(run, { timeout: 2000 }) : window.setTimeout(run, 800);
    return () => {
      if (ric && window.cancelIdleCallback) window.cancelIdleCallback(id as number);
      else window.clearTimeout(id as number);
    };
  }, [restaurantId, restaurantSlug, fetchCoupons]);

  useEffect(() => {
    if (sheet === "orders") refreshOrders();
    if (sheet === "coupons" && coupons === null && !loadingCoupons && !couponsError) fetchCoupons();
  }, [sheet, coupons, loadingCoupons, couponsError, fetchCoupons, refreshOrders]);

  // Trava o scroll do fundo enquanto o sheet está aberto.
  // Usamos overflow/overscroll (sem `position: fixed`) para evitar o reflow
  // pesado da página inteira, que causava a sensação de travamento no toque.
  useEffect(() => {
    if (!sheet) return;
    const root = document.documentElement;
    const body = document.body;
    const prev = {
      rootOverflow: root.style.overflow,
      bodyOverflow: body.style.overflow,
      overscroll: body.style.overscrollBehavior,
    };
    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    return () => {
      root.style.overflow = prev.rootOverflow;
      body.style.overflow = prev.bodyOverflow;
      body.style.overscrollBehavior = prev.overscroll;
    };
  }, [sheet]);

  const handleTab = useCallback(
    (key: BottomNavTab) => {
      setInternalActive(key);
      if (key === "cart") {
        setSheet(null);
        onOpenCart();
        return;
      }
      setSheet(key);
    },
    [onOpenCart],
  );


  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      toast.success(`Cupom ${code} copiado!`);
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 2000);
    } catch {
      toast.error("Não foi possível copiar o cupom");
    }
  }

  const rowSkeletons = (
    <ul className="space-y-2 pb-2" aria-hidden>
      {Array.from({ length: 3 }).map((_, i) => (
        <li
          key={i}
          className="h-[62px] rounded-2xl bg-[hsl(var(--menu-ink)/0.06)] animate-pulse motion-reduce:animate-none"
        />
      ))}
    </ul>
  );


  const nav = (
    <>
      <nav
        aria-label="Navegação do cardápio"
        className="fixed inset-x-0 z-40 md:hidden print:hidden pointer-events-none"
        style={{ bottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}
      >
        <div
          className="pointer-events-auto relative mx-auto flex items-stretch gap-1 p-1.5 overflow-hidden"
          style={{
            width: "calc(100% - 32px)",
            maxWidth: 420,
            borderRadius: 9999,
            background: "rgba(14, 17, 20, 0.72)",
            backdropFilter: "blur(22px) saturate(160%)",
            WebkitBackdropFilter: "blur(22px) saturate(160%)",
            border: "1px solid rgba(255,255,255,0.10)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.08)",
            opacity: hidden ? 0 : 1,
            transform: hidden ? "translateY(16px)" : "none",
            transition: reduceMotion ? "none" : "opacity 240ms ease, transform 240ms ease",
            visibility: hidden ? "hidden" : "visible",
          }}
        >
          {/* reflexo interno superior */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-6 top-0 h-1/2 rounded-b-[9999px]"
            style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.07), transparent)" }}
          />
          {TABS.map((tab) => {
            const isActive = active === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTab(tab.key)}
                aria-label={tab.aria}
                aria-current={isActive ? "page" : undefined}
                style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
                className="relative flex-1 min-h-[56px] min-w-[44px] flex flex-col items-center justify-center gap-0.5 rounded-full select-none outline-none focus-visible:ring-2 focus-visible:ring-white/60 active:scale-[0.96] transition-transform duration-200"
              >
                {isActive && (
                  <motion.span
                    layoutId="mizu-bottomnav-pill"
                    aria-hidden
                    className="absolute inset-0 rounded-full"
                    style={{ background: accent }}
                    transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <span
                  className="relative flex items-center justify-center"
                  style={{ color: isActive ? activeInk : "rgba(255,255,255,0.78)" }}
                >
                  <Icon className="w-5 h-5" strokeWidth={isActive ? 2.4 : 2} />
                  {tab.key === "cart" && cartLoading && (
                    <span
                      aria-hidden
                      className="absolute -top-2 -right-3 w-[18px] h-[18px] rounded-full bg-white/25 animate-pulse motion-reduce:animate-none ring-2 ring-[rgba(14,17,20,0.9)]"
                    />
                  )}
                  {tab.key === "cart" && !cartLoading && cartItemCount > 0 && (
                    <AnimatePresence mode="popLayout">
                      <motion.span
                        key={cartItemCount}
                        initial={reduceMotion ? false : { scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="absolute -top-2 -right-3 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center bg-[#e84310] text-white ring-2 ring-[rgba(14,17,20,0.9)]"
                      >
                        {cartItemCount > 99 ? "99+" : cartItemCount}
                      </motion.span>
                    </AnimatePresence>
                  )}
                </span>

                <span
                  className="relative text-[10.5px] font-semibold tracking-tight"
                  style={{ color: isActive ? activeInk : "rgba(255,255,255,0.72)" }}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      <AnimatePresence>
        {sheet && (
          <motion.div
            className="fixed inset-0 z-[60] md:hidden flex flex-col justify-end"
            role="dialog"
            aria-modal="true"
            aria-label={sheet === "orders" ? "Seus pedidos" : "Cupons disponíveis"}
          >
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setSheet(null)}
            />
            <motion.div
              initial={reduceMotion ? false : { y: "100%" }}
              animate={{ y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              className="relative max-h-[78dvh] overflow-y-auto overscroll-contain rounded-t-[26px] border-t border-white/10 bg-[hsl(var(--menu-bg))] text-[hsl(var(--menu-ink))] px-5 pt-4"
              style={{
                paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
                WebkitOverflowScrolling: "touch",
                touchAction: "pan-y",
              }}
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[hsl(var(--menu-ink)/0.18)]" />
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-lg font-bold">
                  {sheet === "orders" ? "Seus pedidos" : "Cupons disponíveis"}
                </h2>
                <button
                  type="button" onClick={() => setSheet(null)} aria-label="Fechar"
                  style={{ touchAction: "manipulation" }}
                  className="w-9 h-9 rounded-xl flex items-center justify-center bg-[hsl(var(--menu-ink)/0.06)] border border-[hsl(var(--menu-ink)/0.08)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {sheet === "orders" && (
                ordersLoading ? (
                  <>
                    {rowSkeletons}
                    <span className="sr-only" role="status">Carregando seus pedidos</span>
                  </>
                ) : orders.length === 0 ? (
                  <p className="py-8 text-center text-sm text-[hsl(var(--menu-ink-2))]">
                    Nenhum pedido em andamento no momento.
                  </p>
                ) : (
                  <ul className="space-y-2 pb-2">
                    {orders.map((o) => (
                      <li key={o.token}>
                        <button
                          type="button"
                          onClick={() => { setSheet(null); navigate(`/pedido/${o.token}`); }}
                          style={{ touchAction: "manipulation" }}
                          className="w-full flex items-center gap-3 rounded-2xl border border-[hsl(var(--menu-ink)/0.08)] bg-[hsl(var(--menu-ink)/0.04)] px-4 py-3 text-left active:scale-[0.98] transition-transform"
                        >
                          <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${accent}25` }}>
                            <ReceiptText className="w-4 h-4" style={{ color: accent }} />
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-semibold truncate">
                              {STATUS_LABELS[String(o.status)] ?? "Pedido em andamento"}
                            </span>
                            <span className="block text-[11.5px] text-[hsl(var(--menu-ink-2))]">Toque para acompanhar</span>
                          </span>
                          <ChevronRight className="w-4 h-4 shrink-0 text-[hsl(var(--menu-ink-2))]" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              )}

              {sheet === "coupons" && (
                loadingCoupons ? (
                  <>
                    {rowSkeletons}
                    <span className="sr-only" role="status">Carregando cupons</span>
                  </>
                ) : couponsError ? (
                  <div className="py-8 text-center">
                    <p className="text-sm text-[hsl(var(--menu-ink-2))]">
                      Não foi possível carregar os cupons.
                    </p>
                    <button
                      type="button"
                      onClick={fetchCoupons}
                      style={{ background: accent, color: activeInk, touchAction: "manipulation" }}
                      className="mt-4 min-h-[44px] px-5 rounded-xl text-sm font-bold active:scale-95 transition-transform"
                    >
                      Tentar novamente
                    </button>
                  </div>
                ) : !coupons?.length ? (
                  <p className="py-8 text-center text-sm text-[hsl(var(--menu-ink-2))]">
                    Nenhum cupom disponível no momento.
                  </p>
                ) : (
                  <ul className="space-y-2 pb-2">
                    {coupons.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center gap-3 rounded-2xl border border-dashed px-4 py-3"
                        style={{ borderColor: `${accent}55`, background: `${accent}10` }}
                      >
                        <span className="flex-1 min-w-0">
                          <span className="block font-mono text-sm font-bold tracking-wide">{c.code}</span>
                          <span className="block text-[11.5px] text-[hsl(var(--menu-ink-2))] truncate">
                            {fmtDiscount(c)}
                            {c.description ? ` · ${c.description}` : ""}
                            {c.expires_at ? ` · até ${new Date(c.expires_at).toLocaleDateString("pt-BR")}` : ""}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => copyCode(c.code)}
                          aria-label={`Copiar cupom ${c.code}`}
                          className="min-h-[44px] min-w-[44px] px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-transform"
                          style={{ background: accent, color: activeInk, touchAction: "manipulation" }}
                        >
                          {copied === c.code ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {copied === c.code ? "Copiado" : "Copiar"}
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              )}

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );

  if (typeof document === "undefined") return null;
  return createPortal(nav, document.body);
}

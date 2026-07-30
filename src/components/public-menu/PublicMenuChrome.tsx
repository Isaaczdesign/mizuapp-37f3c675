import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, X, ShoppingCart, ChevronRight, Share2, Heart, Clock, Bike,
  UtensilsCrossed, BadgeCheck, Phone,
} from "lucide-react";
import {
  BORDER, GLASS, GLASS_SOFT, R_BANNER, R_CHIP, SHADOW_CARD,
  TEXT_SECONDARY, accentFaint, accentGlow, brl as fmt, D_MICRO, EASE,
} from "./menuTokens";

/* ════════════════════════════════════════════════════════
   HERO (mobile + tablet) — capa, identidade, status
   No desktop a identidade vive na sidebar fixa.
   ════════════════════════════════════════════════════════ */
export function RestaurantHero({
  name, description, logoUrl, bannerUrl, accentColor, isOpen, statusLabel,
  deliveryEnabled, deliveryFee, ownerPhone,
}: {
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  accentColor: string;
  isOpen: boolean;
  statusLabel: string;
  deliveryEnabled?: boolean;
  deliveryFee?: number | null;
  ownerPhone?: string | null;
}) {
  const [fav, setFav] = useState(false);

  const share = async () => {
    const data = { title: name, text: `Peça no ${name}`, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(data);
      else await navigator.clipboard.writeText(window.location.href);
    } catch { /* cancelado */ }
  };

  return (
    <header className="relative">
      {/* Capa */}
      <div className="relative h-48 sm:h-64 overflow-hidden">
        {bannerUrl ? (
          <motion.img
            src={bannerUrl}
            alt=""
            initial={{ scale: 1.05, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.7, ease: EASE }}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ background: `radial-gradient(120% 90% at 50% 0%, ${accentColor}33 0%, transparent 70%)` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#080909] via-[#080909]/60 to-[#080909]/10" />

        <div className="absolute top-4 right-4 flex items-center gap-2">
          <GlassIconButton label="Compartilhar" onClick={share}>
            <Share2 className="w-[18px] h-[18px]" />
          </GlassIconButton>
          <GlassIconButton label="Favoritar" onClick={() => setFav((f) => !f)}>
            <motion.span animate={{ scale: fav ? [1, 1.3, 1] : 1 }} transition={{ duration: 0.3 }}>
              <Heart
                className="w-[18px] h-[18px] transition-colors"
                style={fav ? { color: accentColor, fill: accentColor } : undefined}
              />
            </motion.span>
          </GlassIconButton>
        </div>
      </div>

      {/* Cartão de identidade */}
      <div className="relative -mt-12 px-4 sm:px-6 max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className={`${R_BANNER} ${BORDER} bg-[#131414] ${SHADOW_CARD} p-4 sm:p-5`}
        >
          <div className="flex items-start gap-3.5">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt=""
                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-[18px] object-cover shrink-0 ${BORDER}`}
              />
            ) : (
              <div
                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-[18px] shrink-0 flex items-center justify-center ${BORDER}`}
                style={{ backgroundColor: accentFaint(accentColor) }}
              >
                <UtensilsCrossed className="w-6 h-6" style={{ color: accentColor }} />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h1 className="font-display text-[19px] sm:text-2xl font-bold tracking-tight leading-[1.15] line-clamp-2">
                {name}
              </h1>

              <span
                className={`mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-[3px] rounded-full border align-middle ${
                  isOpen
                    ? "text-emerald-300 border-emerald-400/25 bg-emerald-400/10"
                    : "text-red-300 border-red-400/25 bg-red-400/10"
                }`}
              >
                <span className="relative flex w-1.5 h-1.5">
                  {isOpen && (
                    <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-70 animate-ping motion-reduce:hidden" />
                  )}
                  <span className={`relative w-1.5 h-1.5 rounded-full ${isOpen ? "bg-emerald-400" : "bg-red-400"}`} />
                </span>
                {statusLabel}
              </span>
            </div>

            {ownerPhone && (
              <a
                href={`https://wa.me/${ownerPhone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Falar com o restaurante"
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${BORDER} transition-transform active:scale-95`}
                style={{ backgroundColor: accentFaint(accentColor) }}
              >
                <Phone className="w-4 h-4" style={{ color: accentColor }} />
              </a>
            )}

          </div>

          {description && (
            <p className={`mt-3 text-[12.5px] leading-relaxed line-clamp-2 ${TEXT_SECONDARY}`}>
              {description}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {deliveryEnabled && (
              <InfoChip icon={<Bike className="w-3 h-3" />}>
                {deliveryFee && Number(deliveryFee) > 0 ? `Entrega ${fmt(Number(deliveryFee))}` : "Entrega grátis"}
              </InfoChip>
            )}
            <InfoChip icon={<Clock className="w-3 h-3" />}>Pedido direto</InfoChip>
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
              style={{ color: accentColor, backgroundColor: accentFaint(accentColor) }}
            >
              <BadgeCheck className="w-3.5 h-3.5" />
              Sem taxas de app
            </span>
          </div>
        </motion.div>
      </div>
    </header>
  );
}

function GlassIconButton({ children, label, onClick }: { children: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
      className={`w-11 h-11 rounded-full flex items-center justify-center text-[#F7F7F5] ${GLASS}`}
    >
      {children}
    </motion.button>
  );
}

function InfoChip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border border-white/[0.08] bg-white/[0.04] text-[#A5A5A0]">
      {icon}
      {children}
    </span>
  );
}

/* ════════════════════════════════════════════════════════
   BUSCA + CATEGORIAS (sticky, mobile e tablet)
   ════════════════════════════════════════════════════════ */
export function MenuStickyBar({
  search, onSearch, categories, activeCategory, onCategory, accentColor, className = "",
}: {
  search: string;
  onSearch: (v: string) => void;
  categories: { id: string; name: string }[];
  activeCategory: string | null;
  onCategory: (id: string) => void;
  accentColor: string;
  className?: string;
}) {
  const [focused, setFocused] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeCategory || !railRef.current) return;
    const el = railRef.current.querySelector<HTMLElement>(`[data-chip="${activeCategory}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeCategory]);

  // Mede a altura real da barra sticky (busca + categorias) e expõe como CSS var,
  // para que os cabeçalhos de categoria grudem exatamente abaixo dela.
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const apply = () => {
      document.documentElement.style.setProperty(
        "--menu-sticky-h",
        `${Math.round(el.getBoundingClientRect().height)}px`,
      );
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    window.addEventListener("resize", apply);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", apply);
      document.documentElement.style.removeProperty("--menu-sticky-h");
    };
  }, [categories.length, search]);

  return (
    <div ref={barRef} className={`sticky top-0 z-40 mt-5 ${GLASS_SOFT} ${className}`}>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-3 pb-2">
        <div
          className={`relative ${R_CHIP} bg-white/[0.05] transition-shadow duration-150`}
          style={{
            boxShadow: focused ? `0 0 0 1.5px ${accentColor}` : "0 0 0 1px rgba(255,255,255,0.07)",
          }}
        >
          <Search
            className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: focused ? accentColor : undefined }}
          />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Buscar no cardápio..."
            aria-label="Buscar no cardápio"
            className="w-full bg-transparent rounded-[14px] pl-10 pr-11 min-h-[48px] text-[14px] outline-none placeholder:text-[#74746F]"
          />
          <AnimatePresence>
            {search && (
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: D_MICRO }}
                onClick={() => onSearch("")}
                aria-label="Limpar busca"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.08]"
              >
                <X className="w-3.5 h-3.5 text-[#A5A5A0]" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {!search && categories.length > 0 && (
        <div
          ref={railRef}
          role="tablist"
          aria-label="Categorias"
          className="max-w-3xl mx-auto flex gap-2 px-4 sm:px-6 pb-3 overflow-x-auto scrollbar-hide"
        >
          {categories.map((cat) => {
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                role="tab"
                aria-selected={active}
                data-chip={cat.id}
                onClick={() => onCategory(cat.id)}
                className="relative px-4 min-h-[40px] rounded-full text-[13px] whitespace-nowrap font-semibold transition-transform active:scale-[0.96]"
                style={{ color: active ? "#080909" : undefined }}
              >
                {active && (
                  <motion.span
                    layoutId="cat-chip"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    className="absolute inset-0 rounded-full"
                    style={{ backgroundColor: accentColor, boxShadow: accentGlow(accentColor) }}
                  />
                )}
                {!active && <span className="absolute inset-0 rounded-full border border-white/[0.08] bg-white/[0.04]" />}
                <span className="relative">{cat.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   BARRA FLUTUANTE DO CARRINHO (mobile + tablet)
   ════════════════════════════════════════════════════════ */
export function FloatingCartBar({
  count, total, accentColor, onClick,
}: { count: number; total: number; accentColor: string; onClick: () => void }) {
  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className="fixed inset-x-0 z-50 px-4 sm:px-6 pointer-events-none lg:hidden"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
    >
      <motion.button
        type="button"
        onClick={onClick}
        whileTap={{ scale: 0.98 }}
        aria-label={`Ver carrinho, ${count} ${count === 1 ? "item" : "itens"}, total ${fmt(total)}`}
        className={`pointer-events-auto relative w-full max-w-md mx-auto flex items-center gap-3 rounded-full p-2.5 overflow-hidden ${GLASS}`}
      >
        <span
          className="relative w-11 h-11 rounded-full flex items-center justify-center text-[#080909] shrink-0"
          style={{ backgroundColor: accentColor, boxShadow: accentGlow(accentColor) }}
        >
          <ShoppingCart className="w-[18px] h-[18px]" strokeWidth={2.4} />
          <AnimatePresence mode="popLayout">
            <motion.span
              key={count}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: "spring", stiffness: 520, damping: 24 }}
              className="absolute -top-1 -right-1 min-w-[19px] h-[19px] px-1 rounded-full text-[10.5px] font-bold flex items-center justify-center bg-[#080909] text-[#F7F7F5] border border-white/15"
            >
              {count}
            </motion.span>
          </AnimatePresence>
        </span>

        <span className="relative flex-1 min-w-0 text-left">
          <span className="block text-[14.5px] font-bold leading-tight">Ver carrinho</span>
          <span className="block text-[11.5px] text-[#A5A5A0] leading-tight">
            {count} {count === 1 ? "item" : "itens"}
          </span>
        </span>

        <span className="relative flex items-center gap-1.5 pr-1.5">
          <AnimatePresence mode="popLayout">
            <motion.span
              key={total}
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -8, opacity: 0 }}
              transition={{ duration: D_MICRO }}
              className="font-display font-bold text-[16px] tabular-nums"
            >
              {fmt(total)}
            </motion.span>
          </AnimatePresence>
          <ChevronRight className="w-4 h-4 text-[#A5A5A0]" />
        </span>
      </motion.button>
    </motion.div>
  );
}

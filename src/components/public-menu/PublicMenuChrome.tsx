import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, X, ShoppingCart, ChevronRight, Share2, Heart, Clock, Bike,
  UtensilsCrossed, BadgeCheck, Phone,
} from "lucide-react";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/* ════════════════════════════════════════════════════════
   HERO — capa, avatar, nome, status e métricas
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
      <div className="relative h-56 sm:h-72 md:h-80 overflow-hidden">
        {bannerUrl ? (
          <motion.img
            src={bannerUrl}
            alt=""
            initial={{ scale: 1.08, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ background: `radial-gradient(120% 90% at 50% 0%, ${accentColor}38 0%, transparent 70%)` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-background/10" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />

        {/* Ações flutuantes */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <GlassIconButton label="Compartilhar" onClick={share}>
            <Share2 className="w-[18px] h-[18px]" />
          </GlassIconButton>
          <GlassIconButton label="Favoritar" onClick={() => setFav((f) => !f)}>
            <motion.span animate={{ scale: fav ? [1, 1.35, 1] : 1 }} transition={{ duration: 0.35 }}>
              <Heart
                className="w-[18px] h-[18px] transition-colors"
                style={fav ? { color: accentColor, fill: accentColor } : undefined}
              />
            </motion.span>
          </GlassIconButton>
        </div>
      </div>

      {/* Cartão de identidade */}
      <div className="relative -mt-14 px-4 sm:px-6 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-[26px] border border-white/[0.07] bg-[#141414]/85 backdrop-blur-2xl p-4 sm:p-5 shadow-[0_28px_70px_-40px_rgba(0,0,0,0.95)]"
        >
          <div className="flex items-start gap-3 sm:gap-4">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt=""
                className="w-14 h-14 sm:w-[72px] sm:h-[72px] rounded-[18px] sm:rounded-[20px] object-cover shrink-0 border border-white/10 shadow-lg"
              />
            ) : (
              <div
                className="w-14 h-14 sm:w-[72px] sm:h-[72px] rounded-[18px] sm:rounded-[20px] shrink-0 flex items-center justify-center border border-white/10"
                style={{ background: `linear-gradient(140deg, ${accentColor}33, ${accentColor}0d)` }}
              >
                <UtensilsCrossed className="w-6 h-6 sm:w-7 sm:h-7" style={{ color: accentColor }} />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2">
                <h1 className="flex-1 font-display text-[18px] sm:text-2xl font-bold tracking-tight leading-tight line-clamp-2 sm:truncate">
                  {name}
                </h1>

                {ownerPhone && (
                  <a
                    href={`https://wa.me/${ownerPhone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Falar com o restaurante"
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center shrink-0 border border-white/10 transition-transform active:scale-95"
                    style={{ backgroundColor: accentColor + "1a" }}
                  >
                    <Phone className="w-4 h-4" style={{ color: accentColor }} />
                  </a>
                )}
              </div>

              {description && (
                <p className="text-[12.5px] sm:text-[13px] leading-relaxed text-muted-foreground/90 mt-1.5 line-clamp-2">
                  {description}
                </p>
              )}
            </div>
          </div>

          {/* Informações: status, entrega e selo — organizadas em grade fluida no mobile */}
          <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
                isOpen
                  ? "text-emerald-300 border-emerald-400/25 bg-emerald-400/10"
                  : "text-red-300 border-red-400/25 bg-red-400/10"
              }`}
            >
              <span className="relative flex w-1.5 h-1.5">
                {isOpen && <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-70 animate-ping" />}
                <span className={`relative w-1.5 h-1.5 rounded-full ${isOpen ? "bg-emerald-400" : "bg-red-400"}`} />
              </span>
              {statusLabel}
            </span>

            {deliveryEnabled && (
              <InfoChip icon={<Bike className="w-3 h-3" />}>
                {deliveryFee && Number(deliveryFee) > 0 ? `Entrega ${fmt(Number(deliveryFee))}` : "Entrega grátis"}
              </InfoChip>
            )}
            <InfoChip icon={<Clock className="w-3 h-3" />}>Pedido direto</InfoChip>

            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border"
              style={{ color: accentColor, borderColor: accentColor + "33", backgroundColor: accentColor + "12" }}
            >
              <BadgeCheck className="w-3.5 h-3.5" />
              <span className="hidden xs:inline sm:inline">Sem taxas de aplicativo</span>
              <span className="xs:hidden sm:hidden">Sem taxas</span>
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
      whileTap={{ scale: 0.88 }}
      whileHover={{ scale: 1.06 }}
      className="w-10 h-10 rounded-full flex items-center justify-center text-foreground/90 bg-black/35 backdrop-blur-xl border border-white/[0.12] shadow-[0_10px_30px_-16px_rgba(0,0,0,0.9)]"
    >
      {children}
    </motion.button>
  );
}

function InfoChip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border border-white/[0.08] bg-white/[0.04] text-muted-foreground">
      {icon}
      {children}
    </span>
  );
}

/* ════════════════════════════════════════════════════════
   BUSCA + CATEGORIAS (barra fixa)
   ════════════════════════════════════════════════════════ */
export function MenuStickyBar({
  search, onSearch, categories, activeCategory, onCategory, accentColor,
}: {
  search: string;
  onSearch: (v: string) => void;
  categories: { id: string; name: string }[];
  activeCategory: string | null;
  onCategory: (id: string) => void;
  accentColor: string;
}) {
  const [focused, setFocused] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeCategory || !railRef.current) return;
    const el = railRef.current.querySelector<HTMLElement>(`[data-chip="${activeCategory}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeCategory]);

  return (
    <div className="sticky top-0 z-40 mt-5 border-b border-white/[0.05] bg-background/70 backdrop-blur-2xl">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-3 pb-2">
        <motion.div
          animate={{
            boxShadow: focused
              ? `0 0 0 1.5px ${accentColor}66, 0 14px 34px -22px ${accentColor}`
              : "0 0 0 1px rgba(255,255,255,0.06), 0 10px 30px -26px rgba(0,0,0,0.9)",
          }}
          transition={{ duration: 0.22 }}
          className="relative rounded-2xl bg-white/[0.045] backdrop-blur-xl"
        >
          <Search
            className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors"
            style={{ color: focused ? accentColor : undefined }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Buscar no cardápio..."
            className="w-full bg-transparent rounded-2xl pl-10 pr-10 py-3 text-sm outline-none placeholder:text-muted-foreground/70"
          />
          <AnimatePresence>
            {search && (
              <motion.button
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                onClick={() => onSearch("")}
                aria-label="Limpar busca"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center bg-white/[0.07]"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {!search && categories.length > 0 && (
        <div ref={railRef} className="max-w-5xl mx-auto flex gap-2 px-4 sm:px-6 pb-3 overflow-x-auto scrollbar-hide">
          {categories.map((cat) => {
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                data-chip={cat.id}
                onClick={() => onCategory(cat.id)}
                className="relative px-4 py-2 rounded-full text-[13px] whitespace-nowrap font-semibold transition-colors active:scale-[0.96]"
                style={{ color: active ? "#0B0B0B" : undefined }}
              >
                {active && (
                  <motion.span
                    layoutId="cat-chip"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    className="absolute inset-0 rounded-full"
                    style={{ backgroundColor: accentColor, boxShadow: `0 8px 26px -12px ${accentColor}` }}
                  />
                )}
                {!active && <span className="absolute inset-0 rounded-full border border-white/[0.07] bg-white/[0.035]" />}
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
   BARRA FLUTUANTE DO CARRINHO — vidro moderno
   ════════════════════════════════════════════════════════ */
export function FloatingCartBar({
  count, total, accentColor, onClick,
}: { count: number; total: number; accentColor: string; onClick: () => void }) {
  return (
    <motion.div
      initial={{ y: 90, opacity: 0, scale: 0.96 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: 90, opacity: 0, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 360, damping: 30 }}
      className="fixed inset-x-0 z-50 px-4 sm:px-6 pointer-events-none"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
    >
      <motion.button
        type="button"
        onClick={onClick}
        whileTap={{ scale: 0.975 }}
        className="pointer-events-auto group relative w-full max-w-md sm:max-w-lg mx-auto flex items-center gap-3 rounded-full pl-2.5 pr-2.5 py-2.5 overflow-hidden border border-white/[0.14] bg-[#141414]/70 backdrop-blur-2xl shadow-[0_26px_60px_-28px_rgba(0,0,0,1)]"
      >
        <span
          className="absolute inset-0 opacity-70"
          style={{ background: `linear-gradient(100deg, ${accentColor}1f, transparent 55%)` }}
          aria-hidden
        />
        <span
          className="relative w-11 h-11 rounded-full flex items-center justify-center text-white shrink-0"
          style={{ backgroundColor: accentColor, boxShadow: `0 12px 30px -14px ${accentColor}` }}
        >
          <ShoppingCart className="w-[18px] h-[18px]" strokeWidth={2.4} />
          <AnimatePresence mode="popLayout">
            <motion.span
              key={count}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ type: "spring", stiffness: 520, damping: 24 }}
              className="absolute -top-1 -right-1 min-w-[19px] h-[19px] px-1 rounded-full text-[10.5px] font-bold flex items-center justify-center bg-background text-foreground border border-white/15"
            >
              {count}
            </motion.span>
          </AnimatePresence>
        </span>

        <span className="relative flex-1 min-w-0 text-left">
          <span className="block text-[14.5px] font-bold leading-tight">Ver carrinho</span>
          <span className="block text-[11.5px] text-muted-foreground leading-tight">
            {count} {count === 1 ? "item" : "itens"}
          </span>
        </span>

        <span className="relative flex items-center gap-1.5 pr-1.5">
          <AnimatePresence mode="popLayout">
            <motion.span
              key={total}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -10, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="font-display font-bold text-[16px] tabular-nums"
            >
              {fmt(total)}
            </motion.span>
          </AnimatePresence>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </span>
      </motion.button>
    </motion.div>
  );
}

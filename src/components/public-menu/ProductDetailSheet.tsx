import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Minus, AlertTriangle, UtensilsCrossed } from "lucide-react";
import {
  BORDER, R_CHIP, TEXT_SECONDARY, accentFaint, accentGlow, brl as fmt, D_MICRO, EASE,
} from "./menuTokens";

type Variation = { id: string; name: string; price_delta: number; absolute_price: number | null };
type Addon = { id: string; name: string; price: number };

export type DetailItem = {
  id: string;
  name: string;
  description?: string | null;
  price: number | string;
  image_url?: string | null;
  ingredients?: string | null;
  allergens?: string | null;
  variations?: Variation[];
  addons?: Addon[];
};

/**
 * Detalhe do produto.
 * Mobile/tablet: bottom sheet com arraste visual.
 * Desktop: modal centralizado em duas colunas (foto | escolhas).
 */
export default function ProductDetailSheet({
  item, accentColor, selectedVariation, onSelectVariation,
  selectedAddons, onToggleAddon, qty, onQty, onClose, onAdd,
}: {
  item: DetailItem;
  accentColor: string;
  selectedVariation: Variation | null;
  onSelectVariation: (v: Variation | null) => void;
  selectedAddons: Addon[];
  onToggleAddon: (a: Addon) => void;
  qty: number;
  onQty: (n: number) => void;
  onClose: () => void;
  onAdd: () => void;
}) {
  const basePrice =
    selectedVariation?.absolute_price != null
      ? Number(selectedVariation.absolute_price)
      : Number(item.price) + (selectedVariation?.price_delta ?? 0);
  const addonsPrice = selectedAddons.reduce((s, a) => s + Number(a.price), 0);
  const totalPrice = (basePrice + addonsPrice) * qty;

  const media = item.image_url ? (
    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
  ) : (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ background: `linear-gradient(140deg, ${accentColor}26, ${accentColor}06)` }}
    >
      <UtensilsCrossed className="w-10 h-10" style={{ color: accentColor }} aria-hidden />
    </div>
  );

  const choices = (
    <div className="p-5 space-y-5 lg:p-6 lg:flex lg:flex-col lg:min-h-full">
      <div className="flex items-start justify-between gap-4">
        <h2 id="product-title" className="font-display text-[21px] lg:text-[24px] font-bold tracking-tight leading-tight">
          {item.name}
        </h2>
        <span
          className="font-display text-[16px] font-bold shrink-0 px-3 py-1.5 rounded-full tabular-nums"
          style={{ color: accentColor, backgroundColor: accentFaint(accentColor) }}
        >
          {fmt(Number(item.price))}
        </span>
      </div>

      {item.description && (
        <p className={`text-[13.5px] leading-relaxed ${TEXT_SECONDARY}`}>{item.description}</p>
      )}

      {item.ingredients && (
        <div className={`rounded-2xl ${BORDER} bg-white/[0.03] p-4`}>
          <p className="text-[10.5px] font-bold text-[#74746F] uppercase tracking-[0.16em] mb-1.5">Ingredientes</p>
          <p className="text-[13px] leading-relaxed">{item.ingredients}</p>
        </div>
      )}

      {item.allergens && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-yellow-500/10 border border-yellow-500/20">
          <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" aria-hidden />
          <p className="text-xs text-yellow-500/90 leading-relaxed">{item.allergens}</p>
        </div>
      )}

      {(item.variations?.length ?? 0) > 0 && (
        <fieldset>
          <legend className="text-[10.5px] font-bold text-[#74746F] uppercase tracking-[0.16em] mb-2.5">
            Escolha a variação
          </legend>
          <div className="space-y-2">
            {item.variations!.map((v) => {
              const isSelected = selectedVariation?.id === v.id;
              return (
                <Choice
                  key={v.id}
                  selected={isSelected}
                  accentColor={accentColor}
                  onClick={() => onSelectVariation(isSelected ? null : v)}
                  label={v.name}
                  value={
                    v.absolute_price != null
                      ? fmt(Number(v.absolute_price))
                      : v.price_delta > 0
                      ? `+${fmt(Number(v.price_delta))}`
                      : "incluso"
                  }
                />
              );
            })}
          </div>
        </fieldset>
      )}

      {(item.addons?.length ?? 0) > 0 && (
        <fieldset>
          <legend className="text-[10.5px] font-bold text-[#74746F] uppercase tracking-[0.16em] mb-2.5">
            Adicionais
          </legend>
          <div className="space-y-2">
            {item.addons!.map((a) => (
              <Choice
                key={a.id}
                selected={!!selectedAddons.find((sa) => sa.id === a.id)}
                accentColor={accentColor}
                onClick={() => onToggleAddon(a)}
                label={a.name}
                value={`+${fmt(Number(a.price))}`}
              />
            ))}
          </div>
        </fieldset>
      )}

      <div className="flex items-center justify-center gap-5 py-1 lg:mt-auto lg:pt-4">
        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          onClick={() => onQty(Math.max(1, qty - 1))}
          aria-label="Diminuir quantidade"
          className={`w-11 h-11 rounded-full ${BORDER} bg-white/[0.04] flex items-center justify-center`}
        >
          <Minus className="w-4 h-4" />
        </motion.button>
        <AnimatePresence mode="popLayout">
          <motion.span
            key={qty}
            initial={{ y: 6, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -6, opacity: 0 }}
            transition={{ duration: D_MICRO }}
            className="font-display text-2xl font-bold w-10 text-center tabular-nums"
            aria-live="polite"
          >
            {qty}
          </motion.span>
        </AnimatePresence>
        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          onClick={() => onQty(qty + 1)}
          aria-label="Aumentar quantidade"
          className="w-11 h-11 rounded-full text-[#080909] flex items-center justify-center"
          style={{ backgroundColor: accentColor, boxShadow: accentGlow(accentColor) }}
        >
          <Plus className="w-4 h-4" strokeWidth={2.6} />
        </motion.button>
      </div>
    </div>
  );

  const footer = (
    <div
      className="p-4 border-t border-white/[0.06] bg-[#131414] lg:p-5"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
    >
      <button
        type="button"
        onClick={onAdd}
        className="w-full min-h-[52px] rounded-[16px] font-bold text-[15px] text-[#080909] transition-transform active:scale-[0.985]"
        style={{ backgroundColor: accentColor, boxShadow: accentGlow(accentColor) }}
      >
        Adicionar • {fmt(totalPrice)}
      </button>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: D_MICRO }}
      className="fixed inset-0 z-50 flex flex-col lg:items-center lg:justify-center lg:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-title"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />

      <motion.div
        initial={{ y: "100%", opacity: 1 }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 32, stiffness: 340 }}
        className="mt-auto relative w-full sm:max-w-lg sm:mx-auto lg:mt-0 lg:max-w-4xl bg-[#131414] border-t lg:border border-white/[0.08] rounded-t-[24px] lg:rounded-[24px] max-h-[92dvh] lg:max-h-[86dvh] flex flex-col overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
      >
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 w-10 h-1 rounded-full bg-white/25 lg:hidden" aria-hidden />

        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-3 right-3 lg:right-auto lg:left-3 z-20 w-10 h-10 rounded-full flex items-center justify-center bg-black/45 backdrop-blur-xl border border-white/10 active:scale-90 transition-transform"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Mobile / tablet: coluna única rolável */}
        <div className="lg:hidden overflow-y-auto flex-1 overscroll-contain">
          <div className="relative h-60 sm:h-64">
            {media}
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#131414] to-transparent" />
          </div>
          {choices}
        </div>
        <div className="lg:hidden">{footer}</div>

        {/* Desktop: duas colunas */}
        <div className="hidden lg:grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] flex-1 min-h-0">
          <div className="relative min-h-0">{media}</div>
          <div className="flex flex-col min-h-0 border-l border-white/[0.06]">
            <div className="overflow-y-auto flex-1">{choices}</div>
            {footer}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Choice({
  selected, accentColor, onClick, label, value,
}: { selected: boolean; accentColor: string; onClick: () => void; label: string; value: string }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.99 }}
      aria-pressed={selected}
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-3 min-h-[52px] px-4 ${R_CHIP} text-[13.5px] border transition-colors duration-150`}
      style={
        selected
          ? { borderColor: accentColor, backgroundColor: accentFaint(accentColor) }
          : { borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.03)" }
      }
    >
      <span className="font-medium text-left">{label}</span>
      <span className="font-semibold tabular-nums" style={{ color: accentColor }}>{value}</span>
    </motion.button>
  );
}

export { EASE };

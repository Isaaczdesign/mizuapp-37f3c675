import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import type { MenuTheme } from "@/lib/menuThemes";

export const TAG_BADGES: Record<
  string,
  { emoji: string; label: string; gradient: string; ring: string; glow: string; pulse?: boolean }
> = {
  best_seller: {
    emoji: "🔥", label: "Mais Vendido",
    gradient: "linear-gradient(135deg, #FF3D00 0%, #FF9100 100%)",
    ring: "rgba(255,109,0,0.55)", glow: "0 0 18px rgba(255,109,0,0.45)", pulse: true,
  },
  recommended: {
    emoji: "⭐", label: "Recomendado",
    gradient: "linear-gradient(135deg, #FFB300 0%, #FFD54F 100%)",
    ring: "rgba(255,193,7,0.5)", glow: "0 0 14px rgba(255,193,7,0.4)",
  },
  chef_pick: {
    emoji: "👨‍🍳", label: "Escolha do Chef",
    gradient: "linear-gradient(135deg, #1a1a1a 0%, #3d2b1f 100%)",
    ring: "rgba(212,175,55,0.7)", glow: "0 0 12px rgba(212,175,55,0.4)",
  },
  high_margin: {
    emoji: "💎", label: "Destaque",
    gradient: "linear-gradient(135deg, #00B8D4 0%, #7C4DFF 100%)",
    ring: "rgba(124,77,255,0.55)", glow: "0 0 16px rgba(124,77,255,0.45)",
  },
  combo: {
    emoji: "🎁", label: "Combo",
    gradient: "linear-gradient(135deg, #E91E63 0%, #FF5252 100%)",
    ring: "rgba(233,30,99,0.55)", glow: "0 0 16px rgba(233,30,99,0.45)", pulse: true,
  },
};

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export type MenuCardItem = {
  id: string;
  name: string;
  description?: string | null;
  price: number | string;
  image_url?: string | null;
  tags?: string[] | null;
};

/** Badges compactos e uniformes em todos os templates */
function Tags({ tags, dense, className = "" }: { tags: string[]; dense?: boolean; className?: string }) {
  if (!tags.length) return null;
  return (
    <div className={`flex flex-wrap gap-1.5 ${dense ? "mt-1" : "mt-2"} ${className}`}>
      {tags.map((t) => {
        const b = TAG_BADGES[t];
        return (
          <motion.span
            key={t}
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 20 }}
            className="relative inline-flex items-center gap-1 text-[9.5px] leading-none px-2 py-[5px] rounded-full font-bold text-white uppercase tracking-[0.06em] overflow-hidden"
            style={{
              backgroundImage: b.gradient,
              boxShadow: `${b.glow}, inset 0 1px 0 rgba(255,255,255,0.22)`,
              border: `1px solid ${b.ring}`,
            }}
          >
            {b.pulse && (
              <span className="absolute inset-0 rounded-full animate-ping opacity-30" style={{ backgroundImage: b.gradient }} aria-hidden />
            )}
            <span className="relative text-[11px] leading-none drop-shadow">{b.emoji}</span>
            <span className="relative">{b.label}</span>
          </motion.span>
        );
      })}
    </div>
  );
}

/** Botão adicionar — idêntico em todos os templates */
function AddButton({
  color, size = "md", onClick, label,
}: { color: string; size?: "sm" | "md" | "lg"; onClick?: () => void; label?: string }) {
  const dims = size === "sm" ? "w-8 h-8" : size === "lg" ? "w-11 h-11" : "w-9 h-9";
  const icon = size === "sm" ? "w-4 h-4" : "w-[18px] h-[18px]";
  return (
    <motion.button
      type="button"
      aria-label={label || "Adicionar"}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.9 }}
      transition={{ type: "spring", stiffness: 420, damping: 20 }}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      className={`${dims} shrink-0 rounded-full flex items-center justify-center text-[hsl(var(--menu-on-accent))]`}
      style={{ backgroundColor: color, boxShadow: `0 10px 24px -12px ${color}` }}
    >
      <Plus className={icon} strokeWidth={2.6} />
    </motion.button>
  );
}

interface Props {
  item: MenuCardItem;
  theme: MenuTheme;
  accentColor: string;
  inCart?: number;
  index?: number;
  onClick?: () => void;
  animate?: boolean;
}

export default function MenuItemCard({ item, theme, accentColor, inCart = 0, index = 0, onClick, animate = true }: Props) {
  const tags = (item.tags ?? []).filter((t) => TAG_BADGES[t]);
  const price = Number(item.price);
  const showImage = theme.showImage && !!item.image_url;

  const priceEl = theme.boldPrice ? (
    <span className={`${theme.priceClass} px-3 py-1 rounded-full text-[hsl(var(--menu-on-accent))]`} style={{ backgroundColor: accentColor }}>
      {fmt(price)}
    </span>
  ) : (
    <span className={theme.priceClass} style={{ color: accentColor }}>{fmt(price)}</span>
  );

  const cartBadge = inCart > 0 && (
    <span
      className="text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ backgroundColor: accentColor + "22", color: accentColor }}
    >
      {inCart}×
    </span>
  );

  const placeholder = (className: string) => (
    <div
      className={className}
      style={{ background: `linear-gradient(135deg, ${accentColor}22, ${accentColor}05)` }}
      aria-hidden
    />
  );

  let body: React.ReactNode = null;

  if (theme.layout === "stacked") {
    /* ── Showcase: foto dominante (~65%) + preço grande ── */
    body = (
      <>
        <div className="relative overflow-hidden">
          {showImage
            ? <img src={item.image_url!} alt={item.name} className={`${theme.imageClass} transition-transform duration-500 group-hover:scale-[1.04]`} loading="lazy" />
            : placeholder("w-full h-52")}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent" />
          {tags.length > 0 && <Tags tags={tags} className="!mt-0 absolute top-3 left-3" />}
          {inCart > 0 && <div className="absolute top-3 right-3">{cartBadge}</div>}
        </div>
        <div className="p-5">
          <h3 className={theme.titleClass}>{item.name}</h3>
          {theme.showDescription && item.description && (
            <p className="text-[13px] text-muted-foreground/90 mt-2 line-clamp-2 leading-relaxed">{item.description}</p>
          )}
          <div className="mt-4 flex items-center justify-between gap-3">
            {priceEl}
            <AddButton color={accentColor} size="lg" onClick={onClick} label={`Adicionar ${item.name}`} />
          </div>
        </div>
      </>
    );
  } else if (theme.layout === "tile") {
    /* ── Grid: duas colunas compactas ── */
    body = (
      <>
        <div className="relative overflow-hidden">
          {showImage
            ? <img src={item.image_url!} alt={item.name} className={`${theme.imageClass} transition-transform duration-500 group-hover:scale-[1.05]`} loading="lazy" />
            : placeholder("w-full aspect-square")}
          {tags.length > 0 && <Tags tags={tags.slice(0, 1)} dense className="!mt-0 absolute top-2 left-2" />}
        </div>
        <div className="p-3.5 flex-1 flex flex-col">
          <h3 className={theme.titleClass}>{item.name}</h3>
          <div className="mt-auto pt-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">{priceEl}{cartBadge}</div>
            <AddButton color={accentColor} size="sm" onClick={onClick} label={`Adicionar ${item.name}`} />
          </div>
        </div>
      </>
    );
  } else if (theme.layout === "editorial") {
    /* ── Elegant: fine dining, muito respiro ── */
    body = (
      <>
        {showImage && (
          <img src={item.image_url!} alt={item.name} className={`${theme.imageClass} opacity-90 transition-opacity duration-300 group-hover:opacity-100`} loading="lazy" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-3">
            <h3 className={`${theme.titleClass} min-w-0`}>{item.name}</h3>
            <span className="flex-1 border-b border-dashed border-[hsl(var(--menu-ink)/0.12)] translate-y-[-3px]" aria-hidden />
            <span className={theme.priceClass} style={{ color: accentColor }}>{fmt(price)}</span>
          </div>
          {theme.showDescription && item.description && (
            <p className="text-[12.5px] text-muted-foreground/80 mt-2 line-clamp-2 leading-relaxed font-light">{item.description}</p>
          )}
          {tags.length > 0 && <Tags tags={tags.slice(0, 2)} dense />}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {cartBadge}
          <AddButton color={accentColor} size="sm" onClick={onClick} label={`Adicionar ${item.name}`} />
        </div>
      </>
    );
  } else if (theme.layout === "express") {
    /* ── Express: lista rápida, preço grande ── */
    body = (
      <>
        {showImage
          ? <img src={item.image_url!} alt={item.name} className={theme.imageClass} loading="lazy" />
          : placeholder("w-12 h-12 rounded-xl shrink-0")}
        <div className="flex-1 min-w-0">
          <h3 className={`${theme.titleClass} truncate`}>{item.name}</h3>
          {tags.length > 0 && <Tags tags={tags.slice(0, 1)} dense />}
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          {cartBadge}
          {priceEl}
          <AddButton color={accentColor} size="sm" onClick={onClick} label={`Adicionar ${item.name}`} />
        </div>
      </>
    );
  } else {
    /* ── Classic: foto à esquerda ── */
    body = (
      <>
        {showImage
          ? <img src={item.image_url!} alt={item.name} className={theme.imageClass} loading="lazy" />
          : placeholder("w-[88px] h-[88px] sm:w-24 sm:h-24 rounded-2xl shrink-0")}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
          <div className="min-w-0">
            <h3 className={theme.titleClass}>{item.name}</h3>
            {theme.showDescription && item.description && (
              <p className="text-[12.5px] text-muted-foreground/85 mt-1.5 line-clamp-2 leading-relaxed">{item.description}</p>
            )}
            {tags.length > 0 && <Tags tags={tags.slice(0, 2)} dense />}
          </div>
          <div className="flex items-center justify-between gap-2 mt-3">
            <div className="flex items-center gap-2 min-w-0">{priceEl}{cartBadge}</div>
            <AddButton color={accentColor} onClick={onClick} label={`Adicionar ${item.name}`} />
          </div>
        </div>
      </>
    );
  }

  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 14 } : false}
      animate={animate ? { opacity: 1, y: 0 } : undefined}
      transition={{ delay: Math.min(index * 0.035, 0.3), duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      whileTap={{ scale: 0.985 }}
      onClick={onClick}
      className={`${theme.cardClass} cursor-pointer transition-all duration-300`}
    >
      {body}
    </motion.div>
  );
}

import { motion } from "framer-motion";
import type { MenuTheme } from "@/lib/menuThemes";

export const TAG_BADGES: Record<
  string,
  { emoji: string; label: string; gradient: string; ring: string; glow: string; pulse?: boolean }
> = {
  best_seller: {
    emoji: "🔥", label: "Mais Vendido",
    gradient: "linear-gradient(135deg, #FF3D00 0%, #FF9100 100%)",
    ring: "rgba(255,109,0,0.55)", glow: "0 0 18px rgba(255,109,0,0.55)", pulse: true,
  },
  recommended: {
    emoji: "⭐", label: "Recomendado",
    gradient: "linear-gradient(135deg, #FFB300 0%, #FFD54F 100%)",
    ring: "rgba(255,193,7,0.5)", glow: "0 0 14px rgba(255,193,7,0.45)",
  },
  chef_pick: {
    emoji: "👨‍🍳", label: "Escolha do Chef",
    gradient: "linear-gradient(135deg, #1a1a1a 0%, #3d2b1f 100%)",
    ring: "rgba(212,175,55,0.7)", glow: "0 0 12px rgba(212,175,55,0.45)",
  },
  high_margin: {
    emoji: "💎", label: "Destaque",
    gradient: "linear-gradient(135deg, #00B8D4 0%, #7C4DFF 100%)",
    ring: "rgba(124,77,255,0.55)", glow: "0 0 16px rgba(124,77,255,0.5)",
  },
  combo: {
    emoji: "🎁", label: "Combo",
    gradient: "linear-gradient(135deg, #E91E63 0%, #FF5252 100%)",
    ring: "rgba(233,30,99,0.55)", glow: "0 0 16px rgba(233,30,99,0.5)", pulse: true,
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

function Tags({ tags, dense }: { tags: string[]; dense?: boolean }) {
  if (!tags.length) return null;
  return (
    <div className={`flex flex-wrap gap-1.5 ${dense ? "mt-1" : "mt-1.5"}`}>
      {tags.map((t) => {
        const b = TAG_BADGES[t];
        return (
          <motion.span
            key={t}
            initial={{ scale: 0.6, opacity: 0, y: -4 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 18 }}
            className="relative inline-flex items-center gap-1 text-[10px] leading-none px-2 py-1 rounded-full font-bold text-white uppercase tracking-wide overflow-hidden"
            style={{
              backgroundImage: b.gradient,
              boxShadow: `${b.glow}, inset 0 1px 0 rgba(255,255,255,0.25)`,
              border: `1px solid ${b.ring}`,
            }}
          >
            {b.pulse && (
              <span className="absolute inset-0 rounded-full animate-ping opacity-40" style={{ backgroundImage: b.gradient }} aria-hidden />
            )}
            <span className="relative text-sm leading-none drop-shadow">{b.emoji}</span>
            <span className="relative">{b.label}</span>
          </motion.span>
        );
      })}
    </div>
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
    <span
      className={`${theme.priceClass} px-2.5 py-1 rounded-full text-white`}
      style={{ backgroundColor: accentColor }}
    >
      {fmt(price)}
    </span>
  ) : (
    <span className={theme.priceClass} style={{ color: accentColor }}>
      {fmt(price)}
    </span>
  );

  const cartBadge = inCart > 0 && (
    <span
      className="text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ backgroundColor: accentColor + "20", color: accentColor }}
    >
      {inCart}×
    </span>
  );

  const cardStyle =
    theme.id === "vibrant"
      ? { backgroundColor: accentColor + "12", borderColor: accentColor + "55" }
      : undefined;

  let body: React.ReactNode = null;

  if (theme.layout === "stacked") {
    body = (
      <>
        {showImage && <img src={item.image_url!} alt={item.name} className={theme.imageClass} loading="lazy" />}
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className={theme.titleClass}>{item.name}</h3>
            {cartBadge}
          </div>
          <Tags tags={tags} />
          {theme.showDescription && item.description && (
            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{item.description}</p>
          )}
          <div className="mt-3">{priceEl}</div>
        </div>
      </>
    );
  } else if (theme.layout === "tile") {
    body = (
      <>
        {showImage ? (
          <img src={item.image_url!} alt={item.name} className={theme.imageClass} loading="lazy" />
        ) : (
          <div className="w-full aspect-square" style={{ background: `linear-gradient(135deg, ${accentColor}25, ${accentColor}05)` }} />
        )}
        <div className="p-2.5 flex-1 flex flex-col">
          <h3 className={theme.titleClass}>{item.name}</h3>
          <Tags tags={tags} dense />
          <div className="mt-auto pt-2 flex items-center justify-between gap-2">
            {priceEl}
            {cartBadge}
          </div>
        </div>
      </>
    );
  } else if (theme.layout === "text") {
    body = (
      <>
        <div className="flex-1 min-w-0">
          <h3 className={theme.titleClass}>{item.name}</h3>
          <Tags tags={tags} dense />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {cartBadge}
          {priceEl}
        </div>
      </>
    );
  } else {
    body = (
      <>
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <h3 className={theme.titleClass}>{item.name}</h3>
            <Tags tags={tags} />
            {theme.showDescription && item.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 mt-2">
            {priceEl}
            {cartBadge}
          </div>
        </div>
        {showImage && <img src={item.image_url!} alt={item.name} className={theme.imageClass} loading="lazy" />}
      </>
    );
  }

  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 12 } : false}
      animate={animate ? { opacity: 1, y: 0 } : undefined}
      transition={{ delay: index * 0.03, duration: 0.3 }}
      onClick={onClick}
      style={cardStyle}
      className={`${theme.cardClass} cursor-pointer transition-all active:scale-[0.98]`}
    >
      {body}
    </motion.div>
  );
}

import { motion } from "framer-motion";
import { Sparkles, Gift, Gem, Flame, Star, ChefHat } from "lucide-react";

type BadgeStyle = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  ring: string;
  glow: string;
  pulse?: boolean;
  hint?: string;
};

const UPSELL_STYLES: Record<string, BadgeStyle> = {
  combo: {
    label: "Combo",
    icon: Gift,
    gradient: "linear-gradient(135deg, #E91E63 0%, #FF5252 100%)",
    ring: "rgba(233,30,99,0.55)",
    glow: "0 0 14px rgba(233,30,99,0.55)",
    pulse: true,
    hint: "Sugerido no checkout",
  },
  high_margin: {
    label: "Alta Margem",
    icon: Gem,
    gradient: "linear-gradient(135deg, #00B8D4 0%, #7C4DFF 100%)",
    ring: "rgba(124,77,255,0.55)",
    glow: "0 0 14px rgba(124,77,255,0.55)",
    pulse: true,
    hint: "Prioridade de recomendação",
  },
  best_seller: {
    label: "Mais Vendido",
    icon: Flame,
    gradient: "linear-gradient(135deg, #FF3D00 0%, #FF9100 100%)",
    ring: "rgba(255,109,0,0.55)",
    glow: "0 0 12px rgba(255,109,0,0.5)",
  },
  recommended: {
    label: "Recomendado",
    icon: Star,
    gradient: "linear-gradient(135deg, #FFB300 0%, #FFD54F 100%)",
    ring: "rgba(255,193,7,0.5)",
    glow: "0 0 10px rgba(255,193,7,0.45)",
  },
  chef_pick: {
    label: "Escolha do Chef",
    icon: ChefHat,
    gradient: "linear-gradient(135deg, #1a1a1a 0%, #3d2b1f 100%)",
    ring: "rgba(212,175,55,0.7)",
    glow: "0 0 10px rgba(212,175,55,0.45)",
  },
};

export function UpsellBadges({
  tags,
  size = "sm",
}: {
  tags: string[] | null | undefined;
  /** kept for backwards compat, no longer used */
  itemName?: string;
  size?: "sm" | "md";
}) {
  const activeTags = (tags ?? []).filter((t) => UPSELL_STYLES[t]);

  if (activeTags.length === 0) return null;

  const px = size === "md" ? "px-2.5 py-1" : "px-2 py-0.5";
  const text = size === "md" ? "text-[11px]" : "text-[10px]";
  const iconSz = size === "md" ? "w-3.5 h-3.5" : "w-3 h-3";

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {activeTags.map((tag, i) => {
        const s = UPSELL_STYLES[tag];
        const Icon = s.icon;
        return (
          <motion.span
            key={tag}
            initial={{ scale: 0.6, opacity: 0, y: 4 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, type: "spring", stiffness: 380, damping: 18 }}
            whileHover={{ scale: 1.08, y: -1 }}
            className={`relative inline-flex items-center gap-1 rounded-full font-bold text-white ${px} ${text} select-none`}
            style={{
              background: s.gradient,
              boxShadow: `${s.glow}, 0 0 0 1px ${s.ring}`,
            }}
            title={s.hint}
          >
            {s.pulse && (
              <motion.span
                aria-hidden
                className="absolute inset-0 rounded-full"
                style={{ boxShadow: `0 0 0 2px ${s.ring}` }}
                animate={{ opacity: [0.9, 0, 0.9], scale: [1, 1.35, 1] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
              />
            )}
            <Icon className={`${iconSz} relative z-10`} />
            <span className="relative z-10 tracking-wide">{s.label}</span>
            {s.pulse && (
              <motion.span
                aria-hidden
                className="relative z-10"
                animate={{ rotate: [0, 18, -12, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              >
                <Sparkles className={iconSz} />
              </motion.span>
            )}
          </motion.span>
        );
      })}

    </div>
  );
}

export default UpsellBadges;

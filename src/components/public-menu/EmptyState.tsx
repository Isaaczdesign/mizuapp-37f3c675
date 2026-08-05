import { motion } from "framer-motion";
import { BG_CARD, BORDER, R_CARD, D_ENTER, EASE, accentFaint } from "./menuTokens";

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  accentColor,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  accentColor: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: D_ENTER, ease: EASE }}
      className={`${BG_CARD} ${BORDER} ${R_CARD} px-6 py-12 text-center max-w-md mx-auto`}
    >
      <span
        className="mx-auto mb-4 flex w-14 h-14 items-center justify-center rounded-2xl"
        style={{ backgroundColor: accentFaint(accentColor), color: accentColor }}
        aria-hidden
      >
        {icon}
      </span>
      <h3 className="font-display text-[17px] font-bold tracking-tight">{title}</h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-[hsl(var(--menu-ink-2))]">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 min-h-[44px] px-5 rounded-[14px] text-[13.5px] font-semibold text-[hsl(var(--menu-on-accent))] transition-transform active:scale-[0.97] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--menu-bg))]"
          style={{ backgroundColor: accentColor }}
        >
          {actionLabel}
        </button>
      )}
    </motion.div>
  );
}

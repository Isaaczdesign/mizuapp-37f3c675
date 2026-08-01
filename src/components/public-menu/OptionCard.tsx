import { LucideIcon, ChevronRight, Check } from "lucide-react";
import {
  ICON_LG,
  ICON_SM,
  ICON_STROKE,
  R_CARD_SM,
  R_TILE,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TOUCH_ROW,
  SELECTABLE_BASE,
  SELECTABLE_IDLE,
  selectedSurface,
  selectedTileStyle,
} from "./menuTokens";

interface OptionCardProps {
  icon: LucideIcon;
  title: string;
  desc?: string;
  selected: boolean;
  accentColor: string;
  /** "chevron" avança de etapa, "check" apenas seleciona */
  trailing?: "chevron" | "check";
  disabled?: boolean;
  onClick: () => void;
}

/**
 * Card de opção padrão do cardápio público (tipo de pedido, pagamento, etc).
 * Mantém ícone, raio, borda, sombra e hierarquia tipográfica idênticos
 * em todo o fluxo de checkout.
 */
const OptionCard = ({
  icon: Icon,
  title,
  desc,
  selected,
  accentColor,
  trailing = "chevron",
  disabled,
  onClick,
}: OptionCardProps) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    aria-pressed={selected}
    className={`group w-full flex items-center gap-3.5 sm:gap-4 p-3.5 sm:p-4 ${TOUCH_ROW} ${R_CARD_SM} text-left ${SELECTABLE_BASE} disabled:opacity-45 disabled:pointer-events-none ${
      selected ? "" : SELECTABLE_IDLE
    }`}
    style={selected ? selectedSurface(accentColor) : {}}
  >
    <span
      className={`w-11 h-11 sm:w-12 sm:h-12 shrink-0 ${R_TILE} flex items-center justify-center border transition-all duration-300 ease-out`}
      style={selectedTileStyle(accentColor, selected)}
    >
      <Icon
        className={ICON_LG}
        strokeWidth={ICON_STROKE}
        style={{ color: selected ? accentColor : "hsl(var(--menu-ink)/0.65)" }}
      />
    </span>

    <span className="flex-1 min-w-0">
      <span
        className={`block font-semibold text-[15px] leading-snug transition-colors duration-300 ${
          selected ? "" : TEXT_PRIMARY
        }`}
        style={{ color: selected ? accentColor : undefined }}
      >
        {title}
      </span>
      {desc && <span className={`block text-xs leading-snug ${TEXT_SECONDARY} mt-1`}>{desc}</span>}
    </span>

    {trailing === "check" ? (
      <span
        className="w-[22px] h-[22px] shrink-0 rounded-full border flex items-center justify-center transition-all duration-300 ease-out"
        style={{
          borderColor: selected ? accentColor : "hsl(var(--menu-ink)/0.18)",
          backgroundColor: selected ? accentColor : "transparent",
          boxShadow: selected ? `0 0 0 3px ${accentColor}1f` : "none",
        }}
      >
        {selected && <Check className="w-3 h-3 text-[hsl(var(--menu-bg))]" strokeWidth={3} />}
      </span>
    ) : (
      <ChevronRight
        className={`${ICON_SM} shrink-0 transition-transform duration-300 ease-out group-hover:translate-x-0.5 group-hover:opacity-100`}
        strokeWidth={ICON_STROKE}
        style={{ color: selected ? accentColor : "hsl(var(--menu-ink)/0.35)" }}
      />
    )}
  </button>
);

export default OptionCard;

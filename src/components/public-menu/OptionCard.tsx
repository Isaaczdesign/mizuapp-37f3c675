import { LucideIcon, ChevronRight, Check } from "lucide-react";
import {
  ICON_TILE,
  ICON_LG,
  ICON_SM,
  ICON_STROKE,
  R_CARD_SM,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
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
    className={`group w-full flex items-center gap-3.5 p-3.5 ${R_CARD_SM} border text-left transition-all duration-200 active:scale-[0.99] disabled:opacity-45 disabled:pointer-events-none ${
      selected
        ? ""
        : "border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.05] hover:border-white/[0.12]"
    }`}
    style={
      selected
        ? {
            borderColor: accentColor,
            backgroundColor: `${accentColor}12`,
            boxShadow: `0 0 0 3px ${accentColor}1a`,
          }
        : {}
    }
  >
    <span
      className={ICON_TILE}
      style={{
        backgroundColor: selected ? `${accentColor}1f` : "rgba(255,255,255,0.04)",
        borderColor: selected ? `${accentColor}4d` : "rgba(255,255,255,0.07)",
      }}
    >
      <Icon
        className={ICON_LG}
        strokeWidth={ICON_STROKE}
        style={{ color: selected ? accentColor : "rgba(255,255,255,0.65)" }}
      />
    </span>

    <span className="flex-1 min-w-0">
      <span className={`block font-semibold text-sm ${TEXT_PRIMARY}`}>{title}</span>
      {desc && <span className={`block text-xs ${TEXT_SECONDARY} mt-0.5`}>{desc}</span>}
    </span>

    {trailing === "check" ? (
      <span
        className="w-5 h-5 shrink-0 rounded-full border flex items-center justify-center transition-all duration-200"
        style={{
          borderColor: selected ? accentColor : "rgba(255,255,255,0.18)",
          backgroundColor: selected ? accentColor : "transparent",
        }}
      >
        {selected && <Check className="w-3 h-3 text-[#080909]" strokeWidth={3} />}
      </span>
    ) : (
      <ChevronRight
        className={`${ICON_SM} shrink-0 transition-transform duration-200 group-hover:translate-x-0.5`}
        strokeWidth={ICON_STROKE}
        style={{ color: selected ? accentColor : "rgba(255,255,255,0.3)" }}
      />
    )}
  </button>
);

export default OptionCard;

import { LucideIcon, ChevronRight, Check } from "lucide-react";
import {
  ICON_LG,
  ICON_SM,
  ICON_STROKE,
  R_CARD_SM,
  R_TILE,
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
    className={`group w-full flex items-center gap-4 sm:gap-5 p-4 sm:p-5 ${R_CARD_SM} border text-left transition-all duration-300 ease-out active:scale-[0.99] disabled:opacity-45 disabled:pointer-events-none ${
      selected
        ? ""
        : "border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.05] hover:border-white/[0.14] hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]"
    }`}
    style={
      selected
        ? {
            borderColor: accentColor,
            backgroundImage: `linear-gradient(145deg, ${accentColor}18, ${accentColor}0c)`,
            boxShadow: `0 0 0 4px ${accentColor}1f, 0 6px 20px -6px ${accentColor}`,
          }
        : {}
    }
  >
    <span
      className={`w-12 h-12 sm:w-13 sm:h-13 shrink-0 ${R_TILE} flex items-center justify-center border transition-all duration-300 ease-out`}
      style={{
        backgroundColor: selected ? `${accentColor}1f` : "rgba(255,255,255,0.04)",
        borderColor: selected ? `${accentColor}55` : "rgba(255,255,255,0.08)",
        boxShadow: selected ? `inset 0 1px 0 ${accentColor}33` : "inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      <Icon
        className={ICON_LG}
        strokeWidth={ICON_STROKE}
        style={{ color: selected ? accentColor : "rgba(255,255,255,0.65)" }}
      />
    </span>

    <span className="flex-1 min-w-0">
      <span
        className={`block font-semibold text-sm transition-colors duration-300 ${
          selected ? "" : TEXT_PRIMARY
        }`}
        style={{ color: selected ? accentColor : undefined }}
      >
        {title}
      </span>
      {desc && <span className={`block text-xs ${TEXT_SECONDARY} mt-0.5`}>{desc}</span>}
    </span>

    {trailing === "check" ? (
      <span
        className="w-5 h-5 shrink-0 rounded-full border flex items-center justify-center transition-all duration-300 ease-out"
        style={{
          borderColor: selected ? accentColor : "rgba(255,255,255,0.18)",
          backgroundColor: selected ? accentColor : "transparent",
          boxShadow: selected ? `0 0 0 3px ${accentColor}1f` : "none",
        }}
      >
        {selected && <Check className="w-3 h-3 text-[#080909]" strokeWidth={3} />}
      </span>
    ) : (
      <ChevronRight
        className={`${ICON_SM} shrink-0 transition-transform duration-300 ease-out group-hover:translate-x-0.5 group-hover:opacity-100`}
        strokeWidth={ICON_STROKE}
        style={{ color: selected ? accentColor : "rgba(255,255,255,0.35)" }}
      />
    )}
  </button>
);

export default OptionCard;

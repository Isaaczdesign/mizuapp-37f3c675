/**
 * Design System do cardápio público da Mizu.
 * Fonte única de superfícies, bordas, sombras e raios usados por todos os
 * templates e componentes públicos. A cor de destaque é sempre dinâmica
 * (vem de restaurants.primary_color) e nunca fica gravada aqui.
 */

/** Fundos */
export const BG_BASE = "bg-[hsl(var(--menu-bg))]";
export const BG_SOFT = "bg-[hsl(var(--menu-soft))]";
export const BG_CARD = "bg-[hsl(var(--menu-card))]";
export const BG_RAISED = "bg-[hsl(var(--menu-raised))]";

/** Bordas */
export const BORDER = "border border-[hsl(var(--menu-ink)/0.07)]";
export const BORDER_STRONG = "border border-[hsl(var(--menu-ink)/0.12)]";

/** Sombras */
export const SHADOW_CARD =
  "shadow-[0_16px_40px_rgba(0,0,0,0.32),inset_0_1px_0_hsl(var(--menu-ink)/0.04)]";
export const SHADOW_FLOAT =
  "shadow-[0_18px_45px_rgba(0,0,0,0.42),inset_0_1px_0_hsl(var(--menu-ink)/0.08)]";

/** Vidro escuro (barra do carrinho, headers sticky, botões flutuantes) */
export const GLASS =
  "bg-[hsl(var(--menu-card))]/[0.72] backdrop-blur-[22px] backdrop-saturate-150 border border-[hsl(var(--menu-ink)/0.12)] " +
  SHADOW_FLOAT;

export const GLASS_SOFT =
  "bg-[hsl(var(--menu-bg))] supports-[backdrop-filter]:bg-[hsl(var(--menu-bg) / 95)] backdrop-blur-xl backdrop-saturate-150 border-b border-[hsl(var(--menu-ink)/0.06)]";

/** Superfície padrão de card, com interação de hover no desktop */
export const CARD_SURFACE = `${BG_CARD} ${BORDER} ${SHADOW_CARD} transition-[transform,border-color,background-color,box-shadow] duration-200 ease-out hover:border-[hsl(var(--menu-ink)/0.14)] hover:bg-[hsl(var(--menu-raised))] lg:hover:-translate-y-[2px] motion-reduce:transition-none motion-reduce:hover:translate-y-0`;

/** Texto */
export const TEXT_PRIMARY = "text-[hsl(var(--menu-ink))]";
export const TEXT_SECONDARY = "text-[hsl(var(--menu-ink-2))]";
export const TEXT_TERTIARY = "text-[hsl(var(--menu-ink-3))]";

/** Raios */
export const R_CHIP = "rounded-[14px]";
export const R_CARD_SM = "rounded-2xl";
export const R_CARD = "rounded-[20px]";
export const R_BANNER = "rounded-[22px]";
export const R_SHEET = "rounded-[24px]";
export const R_TILE = "rounded-[14px]";
export const R_FIELD = "rounded-[14px]";
export const R_BUTTON = "rounded-[16px]";

/** Ícones — tamanho, traço e container padronizados em todo o cardápio */
export const ICON_STROKE = 1.75;
export const ICON_SM = "w-4 h-4";
export const ICON_MD = "w-[18px] h-[18px]";
export const ICON_LG = "w-5 h-5";
/** Container (tile) padrão de ícone dentro de cards e listas */
export const ICON_TILE = `w-11 h-11 shrink-0 ${R_TILE} flex items-center justify-center border transition-colors duration-200`;


/** Durações (ms) — microinterações rápidas, entradas discretas */
export const D_MICRO = 0.15;
export const D_ENTER = 0.22;
export const D_SHEET = 0.28;

export const EASE = [0.22, 1, 0.36, 1] as const;

/** Helpers de cor de destaque, sempre em opacidade controlada */
export const accentSoft = (c: string) => `${c}24`;
export const accentFaint = (c: string) => `${c}14`;
export const accentRing = (c: string) => `${c}55`;
export const accentGlow = (c: string) => `0 10px 30px -16px ${c}`;

export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** ---- Estados de seleção / hover compartilhados (checkout, mesa, endereços, cupom) ---- */

/** Base de transição para qualquer superfície selecionável */
export const SELECTABLE_BASE =
  "border transition-all duration-300 ease-out active:scale-[0.99]";

/** Estado não selecionado (inclui hover) */
export const SELECTABLE_IDLE =
  "border-[hsl(var(--menu-ink)/0.07)] bg-[hsl(var(--menu-ink)/0.025)] hover:bg-[hsl(var(--menu-ink)/0.05)] hover:border-[hsl(var(--menu-ink)/0.14)] hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]";

/** Estado selecionado — borda sólida, gradiente sutil, halo e sombra projetada */
export const selectedSurface = (c: string) => ({
  borderColor: c,
  backgroundImage: `linear-gradient(145deg, ${c}18, ${c}0c)`,
  boxShadow: `0 0 0 4px ${c}1f, 0 6px 20px -6px ${c}`,
});

/** Tile de ícone dentro de uma superfície selecionável */
export const selectedTileStyle = (c: string, selected: boolean) => ({
  backgroundColor: selected ? `${c}1f` : "hsl(var(--menu-ink)/0.04)",
  borderColor: selected ? `${c}55` : "hsl(var(--menu-ink)/0.08)",
  boxShadow: selected
    ? `inset 0 1px 0 ${c}33`
    : "inset 0 1px 0 hsl(var(--menu-ink)/0.04)",
});

/** ---- Mobile-first: alvos de toque e respiro padrão ---- */

/** Altura mínima confortável de toque (WCAG 2.5.5 / iOS HIG) */
export const TOUCH = "min-h-[48px]";
/** Alvo de toque para linhas de card selecionáveis */
export const TOUCH_ROW = "min-h-[56px]";
/** Alvo de toque para botões secundários pequenos (remover, fechar) */
export const TOUCH_ICON =
  "min-w-[40px] min-h-[40px] flex items-center justify-center";
/** Padding padrão do conteúdo das etapas do checkout (respeita safe-area) */
export const SHEET_PAD = "px-4 sm:px-5 pt-4 sm:pt-5 pb-[max(1rem,env(safe-area-inset-bottom))]";

// Templates de layout do cardápio público.
// Fonte única usada pelo admin (aba Personalizar) e pela página pública.
// Todos compartilham o mesmo Design System premium da Mizu — muda só a organização visual.

export type MenuThemeId = "classic" | "showcase" | "grid" | "elegant" | "express";

export type MenuTheme = {
  id: MenuThemeId;
  name: string;
  description: string;
  /** Estrutura do card do item */
  layout: "row" | "stacked" | "tile" | "editorial" | "express";
  /** Classes do container da lista de itens */
  listClass: string;
  /** Classes do card */
  cardClass: string;
  /** Classes da imagem */
  imageClass: string;
  /** Classes do título do item */
  titleClass: string;
  /** Classes do preço */
  priceClass: string;
  /** Classes do título da categoria */
  categoryTitleClass: string;
  /** Mostra imagem do item? */
  showImage: boolean;
  /** Mostra descrição do item? */
  showDescription: boolean;
  /** Preço com fundo em destaque */
  boldPrice?: boolean;
};

/** Base compartilhada: mesmas bordas, sombras e vidro em todos os templates */
const SURFACE =
  "bg-[hsl(var(--menu-card))] border border-[hsl(var(--menu-ink)/0.07)] shadow-[0_16px_40px_rgba(0,0,0,0.32),inset_0_1px_0_hsl(var(--menu-ink)/0.04)] transition-[transform,border-color,background-color] duration-200 ease-out hover:border-[hsl(var(--menu-ink)/0.14)] hover:bg-[hsl(var(--menu-raised))] lg:hover:-translate-y-[2px] motion-reduce:transition-none motion-reduce:hover:translate-y-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[hsl(var(--menu-ink)/0.25)]";

export const MENU_THEMES: MenuTheme[] = [
  {
    id: "classic",
    name: "Mizu Classic",
    description: "Lista elegante com foto à esquerda, preço destacado e muito respiro.",
    layout: "row",
    listClass: "space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 xl:grid-cols-2",
    cardClass: `group flex gap-4 p-3.5 rounded-3xl ${SURFACE}`,
    imageClass: "w-[88px] h-[88px] sm:w-24 sm:h-24 rounded-2xl object-cover object-center bg-[hsl(var(--menu-ink)/0.03)] shrink-0",
    titleClass: "text-[hsl(var(--menu-ink))] font-display font-semibold text-[15px] leading-snug tracking-tight",
    priceClass: "font-display font-bold text-[15px] tabular-nums",
    categoryTitleClass: "font-display text-lg font-bold tracking-tight",
    showImage: true,
    showDescription: true,
  },
  {
    id: "showcase",
    name: "Mizu Showcase",
    description: "Cards grandes com foto dominante e preço em destaque. Feito para converter.",
    layout: "stacked",
    listClass: "space-y-5 md:grid md:grid-cols-2 md:gap-5 md:space-y-0 xl:grid-cols-3",
    cardClass: `group block overflow-hidden rounded-[28px] ${SURFACE}`,
    imageClass: "w-full h-52 object-cover object-center bg-[hsl(var(--menu-ink)/0.03)]",
    titleClass: "text-[hsl(var(--menu-ink))] font-display font-bold text-[17px] leading-snug tracking-tight",
    priceClass: "font-display font-bold text-lg tabular-nums",
    categoryTitleClass: "font-display text-xl font-bold tracking-tight",
    showImage: true,
    showDescription: true,
  },
  {
    id: "grid",
    name: "Mizu Grid",
    description: "Duas colunas compactas com foto grande. Padrão dos apps de delivery.",
    layout: "tile",
    listClass: "grid grid-cols-2 gap-3.5 md:grid-cols-3 md:gap-4 xl:grid-cols-4",
    cardClass: `group flex flex-col overflow-hidden rounded-3xl ${SURFACE}`,
    imageClass: "w-full aspect-square object-cover object-center bg-[hsl(var(--menu-ink)/0.03)]",
    titleClass: "text-[hsl(var(--menu-ink))] font-display font-semibold text-[13.5px] leading-snug line-clamp-2 tracking-tight",
    priceClass: "font-display font-bold text-[15px] tabular-nums",
    categoryTitleClass: "font-display text-lg font-bold tracking-tight",
    showImage: true,
    showDescription: false,
  },
  {
    id: "elegant",
    name: "Mizu Elegant",
    description: "Muito espaço em branco, divisores finos e foto discreta. Visual fine dining.",
    layout: "editorial",
    listClass: "divide-y divide-[hsl(var(--menu-ink)/0.06)] md:grid md:grid-cols-2 md:gap-x-10 md:divide-y-0 lg:grid-cols-2 xl:grid-cols-3",
    cardClass: "group flex items-center gap-5 py-6 md:border-b md:border-[hsl(var(--menu-ink)/0.06)]",
    imageClass: "w-14 h-14 rounded-2xl object-cover object-center bg-[hsl(var(--menu-ink)/0.03)] shrink-0",
    titleClass: "text-[hsl(var(--menu-ink))] font-display text-[15px] tracking-[0.06em] uppercase leading-snug",
    priceClass: "text-[13px] tracking-[0.12em] tabular-nums",
    categoryTitleClass: "font-display text-sm tracking-[0.28em] uppercase",
    showImage: true,
    showDescription: true,
  },
  {
    id: "express",
    name: "Mizu Express",
    description: "Lista limpa e rápida, preço grande e botão sempre à mão. Ideal para cardápios extensos.",
    layout: "express",
    listClass: "space-y-2 md:grid md:grid-cols-2 md:gap-2.5 md:space-y-0 xl:grid-cols-3",
    cardClass: `group flex items-center gap-3.5 px-3.5 py-3 rounded-2xl ${SURFACE}`,
    imageClass: "w-12 h-12 rounded-xl object-cover object-center bg-[hsl(var(--menu-ink)/0.03)] shrink-0",
    titleClass: "text-[hsl(var(--menu-ink))] font-display font-semibold text-[14.5px] leading-snug tracking-tight",
    priceClass: "font-display font-bold text-base tabular-nums",
    categoryTitleClass: "font-display text-base font-bold uppercase tracking-[0.14em]",
    showImage: true,
    showDescription: false,
  },
];

export const DEFAULT_MENU_THEME: MenuThemeId = "classic";

/** Compatibilidade com temas salvos antes do redesign */
const LEGACY_ALIASES: Record<string, MenuThemeId> = {
  compact: "express",
  vibrant: "showcase",
};

export function resolveMenuTheme(id?: string | null): MenuTheme {
  const key = id ? (LEGACY_ALIASES[id] ?? id) : undefined;
  return MENU_THEMES.find((t) => t.id === key) ?? MENU_THEMES[0];
}

export type MenuDevice = "mobile" | "desktop";

/**
 * Resolve o template correto para o dispositivo atual.
 * `menu_theme` continua sendo o fallback dos registros antigos.
 */
export function resolveDeviceTheme(
  device: MenuDevice,
  r?: { menu_theme?: string | null; menu_theme_mobile?: string | null; menu_theme_desktop?: string | null } | null,
): MenuTheme {
  const specific = device === "mobile" ? r?.menu_theme_mobile : r?.menu_theme_desktop;
  return resolveMenuTheme(specific ?? r?.menu_theme);
}


export const ACCENT_PRESETS: { name: string; value: string }[] = [
  { name: "Laranja Mizu", value: "#E84310" },
  { name: "Areia Mizu", value: "#FFDC8B" },
  { name: "Vermelho Sakura", value: "#E5383B" },
  { name: "Dourado Umami", value: "#D4AF37" },
  { name: "Verde Matcha", value: "#4C956C" },
  { name: "Azul Índigo", value: "#3A5A98" },
  { name: "Roxo Ume", value: "#7C4DFF" },
  { name: "Rosa Nigiri", value: "#EC4899" },
  { name: "Grafite", value: "#4B5563" },
];

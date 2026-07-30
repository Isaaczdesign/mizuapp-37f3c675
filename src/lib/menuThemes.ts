// Templates de layout do cardápio público.
// Fonte única usada pelo admin (aba Personalizar) e pela página pública.

export type MenuThemeId = "classic" | "showcase" | "compact" | "grid" | "elegant" | "vibrant";

export type MenuTheme = {
  id: MenuThemeId;
  name: string;
  description: string;
  /** Estrutura do card do item */
  layout: "row" | "stacked" | "text" | "tile";
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

export const MENU_THEMES: MenuTheme[] = [
  {
    id: "classic",
    name: "Clássico",
    description: "Lista com foto pequena à direita. Equilibrado e familiar.",
    layout: "row",
    listClass: "space-y-2",
    cardClass:
      "flex gap-3 p-3 rounded-2xl bg-card/60 backdrop-blur border border-white/[0.05] hover:border-white/[0.1]",
    imageClass: "w-24 h-24 rounded-xl object-cover shrink-0",
    titleClass: "font-semibold text-sm leading-tight",
    priceClass: "font-display font-bold text-sm",
    categoryTitleClass: "font-display text-lg font-bold",
    showImage: true,
    showDescription: true,
  },
  {
    id: "showcase",
    name: "Vitrine",
    description: "Cards grandes com foto no topo. Ideal para dar água na boca.",
    layout: "stacked",
    listClass: "space-y-4",
    cardClass:
      "block overflow-hidden rounded-3xl bg-card/70 backdrop-blur border border-white/[0.06] hover:border-white/[0.12]",
    imageClass: "w-full h-44 object-cover",
    titleClass: "font-display font-bold text-base leading-tight",
    priceClass: "font-display font-bold text-base",
    categoryTitleClass: "font-display text-xl font-bold",
    showImage: true,
    showDescription: true,
  },
  {
    id: "compact",
    name: "Compacto",
    description: "Lista densa sem fotos. Perfeito para cardápios extensos.",
    layout: "text",
    listClass: "divide-y divide-border/60 rounded-2xl border border-border/60 bg-card/40 overflow-hidden",
    cardClass: "flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/40",
    imageClass: "hidden",
    titleClass: "font-medium text-sm leading-tight",
    priceClass: "font-semibold text-sm tabular-nums",
    categoryTitleClass: "font-display text-base font-bold uppercase tracking-wide",
    showImage: false,
    showDescription: false,
  },
  {
    id: "grid",
    name: "Grade",
    description: "Duas colunas com fotos quadradas. Visual de app de delivery.",
    layout: "tile",
    listClass: "grid grid-cols-2 gap-3",
    cardClass:
      "flex flex-col overflow-hidden rounded-2xl bg-card/60 backdrop-blur border border-white/[0.05] hover:border-white/[0.12]",
    imageClass: "w-full aspect-square object-cover",
    titleClass: "font-semibold text-[13px] leading-tight line-clamp-2",
    priceClass: "font-display font-bold text-sm",
    categoryTitleClass: "font-display text-lg font-bold",
    showImage: true,
    showDescription: false,
  },
  {
    id: "elegant",
    name: "Elegante",
    description: "Tipografia serifada, divisores finos e foto discreta.",
    layout: "row",
    listClass: "divide-y divide-border/50",
    cardClass: "flex gap-4 py-4 hover:opacity-90",
    imageClass: "w-16 h-16 rounded-full object-cover shrink-0",
    titleClass: "font-serif text-[15px] tracking-wide leading-tight",
    priceClass: "font-serif text-sm tracking-wider",
    categoryTitleClass: "font-serif text-lg tracking-[0.2em] uppercase",
    showImage: true,
    showDescription: true,
  },
  {
    id: "vibrant",
    name: "Vibrante",
    description: "Cards arredondados, cores fortes e preço em destaque.",
    layout: "row",
    listClass: "space-y-3",
    cardClass:
      "flex gap-3 p-3.5 rounded-[26px] border-2 hover:brightness-110 shadow-lg",
    imageClass: "w-24 h-24 rounded-2xl object-cover shrink-0",
    titleClass: "font-display font-bold text-[15px] leading-tight",
    priceClass: "font-display font-extrabold text-sm",
    categoryTitleClass: "font-display text-xl font-extrabold",
    showImage: true,
    showDescription: true,
    boldPrice: true,
  },
];

export const DEFAULT_MENU_THEME: MenuThemeId = "classic";

export function resolveMenuTheme(id?: string | null): MenuTheme {
  return MENU_THEMES.find((t) => t.id === id) ?? MENU_THEMES[0];
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

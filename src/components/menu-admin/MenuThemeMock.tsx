import type { MenuTheme, MenuDevice } from "@/lib/menuThemes";
import type { MenuCardItem } from "@/components/public-menu/MenuItemCard";

/**
 * Mockup fiel (porém esquemático) de cada template de cardápio.
 *
 * Por que não usar o `MenuItemCard` real aqui?
 * Ele usa breakpoints do Tailwind (`md:`/`xl:`), que respondem à largura da JANELA
 * e não à largura da prévia. Dentro de um "celular" de 340px isso virava grid de
 * 3 colunas com o texto se sobrepondo. Este componente reproduz o layout com
 * colunas fixas por dispositivo, então a prévia sempre fica legível.
 */

type Variant = "thumb" | "full";

interface Props {
  theme: MenuTheme;
  color: string;
  items: MenuCardItem[];
  device: MenuDevice;
  variant?: Variant;
}

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

/** Quantidade de colunas de cada template por dispositivo */
function columnsFor(theme: MenuTheme, device: MenuDevice) {
  if (device === "mobile") return theme.layout === "tile" ? 2 : 1;
  switch (theme.layout) {
    case "tile": return 3;
    case "express": return 2;
    case "showcase" as never: return 2;
    default: return 2;
  }
}

export default function MenuThemeMock({ theme, color, items, device, variant = "full" }: Props) {
  const thumb = variant === "thumb";
  const cols = columnsFor(theme, device);
  const max = thumb ? (cols > 1 ? cols * 2 : 3) : cols * 2;
  const list = items.slice(0, max);

  return (
    <div
      className={thumb ? "grid gap-1.5" : "grid gap-3"}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {list.map((item) => (
        <MockCard key={item.id} item={item} theme={theme} color={color} thumb={thumb} />
      ))}
    </div>
  );
}

function Surface({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#131414] border border-white/[0.07] overflow-hidden ${className}`}>{children}</div>
  );
}

/** Bloco cinza que representa a foto do item */
function Photo({ className, color }: { className: string; color: string }) {
  return (
    <div
      className={`${className} shrink-0`}
      style={{ background: `linear-gradient(135deg, ${color}26, rgba(255,255,255,0.05))` }}
    />
  );
}

function Line({ w, h = 6, dim = false }: { w: string; h?: number; dim?: boolean }) {
  return (
    <div
      className={`rounded-full ${dim ? "bg-white/12" : "bg-white/30"}`}
      style={{ width: w, height: h }}
    />
  );
}

function AddButton({ color, size }: { color: string; size: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center text-black font-bold shrink-0"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.6, lineHeight: 1 }}
    >
      +
    </div>
  );
}

function MockCard({
  item, theme, color, thumb,
}: { item: MenuCardItem; theme: MenuTheme; color: string; thumb: boolean }) {
  const price = (
    <span
      className={thumb ? "text-[7px] font-bold tabular-nums" : "text-[13px] font-bold tabular-nums"}
      style={{ color }}
    >
      {brl(Number(item.price) || 0)}
    </span>
  );
  const title = (
    <div className={`font-semibold text-foreground truncate ${thumb ? "text-[7px]" : "text-[13px]"}`}>
      {item.name}
    </div>
  );

  switch (theme.layout) {
    /* ——— Classic: foto à esquerda ——— */
    case "row":
      return (
        <Surface className={thumb ? "flex gap-1.5 p-1.5 rounded-lg" : "flex gap-3 p-3 rounded-2xl"}>
          <Photo color={color} className={thumb ? "w-7 h-7 rounded-md" : "w-16 h-16 rounded-xl"} />
          <div className="min-w-0 flex-1 flex flex-col justify-center gap-1">
            {title}
            {thumb ? <Line w="70%" h={3} dim /> : <p className="text-[11px] text-muted-foreground line-clamp-2">{item.description}</p>}
            {price}
          </div>
        </Surface>
      );

    /* ——— Showcase: foto dominante ——— */
    case "stacked":
      return (
        <Surface className={thumb ? "rounded-lg" : "rounded-2xl"}>
          <Photo color={color} className={thumb ? "w-full h-10" : "w-full h-24"} />
          <div className={thumb ? "p-1.5 space-y-1" : "p-3 space-y-1.5"}>
            {title}
            {thumb ? <Line w="60%" h={3} dim /> : <p className="text-[11px] text-muted-foreground line-clamp-1">{item.description}</p>}
            <div className="flex items-center justify-between">{price}<AddButton color={color} size={thumb ? 9 : 22} /></div>
          </div>
        </Surface>
      );

    /* ——— Grid: tile quadrado ——— */
    case "tile":
      return (
        <Surface className={thumb ? "rounded-lg" : "rounded-2xl"}>
          <Photo color={color} className={thumb ? "w-full aspect-square" : "w-full aspect-square"} />
          <div className={thumb ? "p-1 space-y-0.5" : "p-2.5 space-y-1"}>
            {title}
            <div className="flex items-center justify-between gap-1">{price}<AddButton color={color} size={thumb ? 8 : 20} /></div>
          </div>
        </Surface>
      );

    /* ——— Elegant: divisores finos ——— */
    case "editorial":
      return (
        <div className={`flex items-center border-b border-white/[0.07] ${thumb ? "gap-1.5 py-1.5" : "gap-3 py-3"}`}>
          <Photo color={color} className={thumb ? "w-5 h-5 rounded-md" : "w-11 h-11 rounded-xl"} />
          <div className="min-w-0 flex-1 space-y-1">
            <div className={`uppercase tracking-[0.14em] text-foreground truncate ${thumb ? "text-[6px]" : "text-[11px]"}`}>
              {item.name}
            </div>
            <Line w="55%" h={thumb ? 2 : 4} dim />
          </div>
          {price}
        </div>
      );

    /* ——— Express: linha compacta ——— */
    default:
      return (
        <Surface className={thumb ? "flex items-center gap-1.5 px-1.5 py-1 rounded-md" : "flex items-center gap-3 px-3 py-2.5 rounded-xl"}>
          <Photo color={color} className={thumb ? "w-4 h-4 rounded" : "w-10 h-10 rounded-lg"} />
          <div className="min-w-0 flex-1">{title}</div>
          {price}
          <AddButton color={color} size={thumb ? 8 : 22} />
        </Surface>
      );
  }
}

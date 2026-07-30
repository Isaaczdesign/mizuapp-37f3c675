import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, X, ShoppingCart, UtensilsCrossed, Bike, Share2, Phone, BadgeCheck,
} from "lucide-react";
import {
  BORDER, R_CHIP, R_CARD_SM, TEXT_SECONDARY, TEXT_TERTIARY,
  accentFaint, accentGlow, brl, D_MICRO,
} from "./menuTokens";

type Cat = { id: string; name: string; count: number };

/**
 * Sidebar fixa do desktop (>=1024px): identidade, busca, navegação de
 * categorias e resumo do carrinho. Substitui o hero rolável do mobile.
 */
export default function MenuSidebar({
  name, description, logoUrl, accentColor, isOpen, statusLabel,
  deliveryEnabled, deliveryFee, ownerPhone,
  search, onSearch, categories, activeCategory, onCategory,
  cartCount, cartTotal, onOpenCart,
}: {
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  accentColor: string;
  isOpen: boolean;
  statusLabel: string;
  deliveryEnabled?: boolean;
  deliveryFee?: number | null;
  ownerPhone?: string | null;
  search: string;
  onSearch: (v: string) => void;
  categories: Cat[];
  activeCategory: string | null;
  onCategory: (id: string) => void;
  cartCount: number;
  cartTotal: number;
  onOpenCart: () => void;
}) {
  const [focused, setFocused] = useState(false);

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: name, url: window.location.href });
      else await navigator.clipboard.writeText(window.location.href);
    } catch { /* cancelado */ }
  };

  return (
    <aside
      className="hidden lg:flex flex-col w-[272px] xl:w-[300px] shrink-0 h-[100dvh] sticky top-0 border-r border-white/[0.06] bg-[#0D0E0E]"
      aria-label="Navegação do cardápio"
    >
      {/* Identidade */}
      <div className="p-5 pb-4">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt="" className={`w-12 h-12 ${R_CARD_SM} object-cover ${BORDER}`} />
          ) : (
            <div
              className={`w-12 h-12 ${R_CARD_SM} flex items-center justify-center ${BORDER}`}
              style={{ backgroundColor: accentFaint(accentColor) }}
            >
              <UtensilsCrossed className="w-5 h-5" style={{ color: accentColor }} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[15px] font-bold tracking-tight leading-tight line-clamp-2">
              {name}
            </h1>
            <span className={`mt-1 inline-flex items-center gap-1.5 text-[11px] font-semibold ${isOpen ? "text-emerald-300" : "text-red-300"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? "bg-emerald-400" : "bg-red-400"}`} />
              {statusLabel}
            </span>
          </div>
        </div>

        {description && (
          <p className={`mt-3 text-[12px] leading-relaxed line-clamp-2 ${TEXT_SECONDARY}`}>{description}</p>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5">
          {deliveryEnabled && (
            <Chip icon={<Bike className="w-3 h-3" />}>
              {deliveryFee && Number(deliveryFee) > 0 ? `Entrega ${brl(Number(deliveryFee))}` : "Entrega grátis"}
            </Chip>
          )}
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-semibold"
            style={{ color: accentColor, backgroundColor: accentFaint(accentColor) }}
          >
            <BadgeCheck className="w-3 h-3" /> Sem taxas de app
          </span>
        </div>

        <div className="mt-3 flex gap-2">
          <SideAction onClick={share} label="Compartilhar">
            <Share2 className="w-3.5 h-3.5" /> Compartilhar
          </SideAction>
          {ownerPhone && (
            <SideAction
              href={`https://wa.me/${ownerPhone.replace(/\D/g, "")}`}
              label="Falar com o restaurante"
            >
              <Phone className="w-3.5 h-3.5" /> Contato
            </SideAction>
          )}
        </div>
      </div>

      {/* Busca */}
      <div className="px-5 pb-3">
        <div
          className={`relative ${R_CHIP} bg-white/[0.045] transition-shadow duration-150`}
          style={{
            boxShadow: focused
              ? `0 0 0 1.5px ${accentColor}`
              : "0 0 0 1px rgba(255,255,255,0.07)",
          }}
        >
          <Search
            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: focused ? accentColor : undefined }}
          />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Buscar prato..."
            aria-label="Buscar no cardápio"
            className="w-full bg-transparent rounded-[14px] pl-9 pr-9 min-h-[44px] text-[13.5px] outline-none placeholder:text-[#74746F]"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearch("")}
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center bg-white/[0.07] hover:bg-white/[0.12] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Categorias */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Categorias">
        <p className={`px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] ${TEXT_TERTIARY}`}>
          Categorias
        </p>
        <ul className="space-y-1">
          {categories.map((cat) => {
            const active = activeCategory === cat.id;
            return (
              <li key={cat.id}>
                <button
                  type="button"
                  onClick={() => onCategory(cat.id)}
                  aria-current={active ? "true" : undefined}
                  className={`relative w-full flex items-center gap-2 min-h-[42px] px-3 ${R_CHIP} text-[13.5px] font-medium text-left transition-colors duration-150 ${
                    active ? "text-[#F7F7F5]" : "text-[#A5A5A0] hover:text-[#F7F7F5] hover:bg-white/[0.04]"
                  }`}
                  style={active ? { backgroundColor: accentFaint(accentColor) } : undefined}
                >
                  {active && (
                    <motion.span
                      layoutId="mizu-cat-marker"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full"
                      style={{ backgroundColor: accentColor }}
                    />
                  )}
                  <span className="flex-1 min-w-0 truncate">{cat.name}</span>
                  <span className="text-[11px] tabular-nums text-[#74746F]">{cat.count}</span>
                </button>
              </li>
            );
          })}
          {categories.length === 0 && (
            <li className={`px-3 py-2 text-[12.5px] ${TEXT_TERTIARY}`}>Nenhuma categoria</li>
          )}
        </ul>
      </nav>

      {/* Carrinho */}
      <div className="p-4 border-t border-white/[0.06]">
        <AnimatePresence initial={false} mode="wait">
          {cartCount > 0 ? (
            <motion.button
              key="cart"
              type="button"
              onClick={onOpenCart}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: D_MICRO }}
              className={`w-full flex items-center gap-3 p-3 ${R_CHIP} text-[#080909] font-semibold transition-transform active:scale-[0.98]`}
              style={{ backgroundColor: accentColor, boxShadow: accentGlow(accentColor) }}
            >
              <ShoppingCart className="w-[18px] h-[18px]" strokeWidth={2.4} />
              <span className="flex-1 text-left text-[13.5px]">
                {cartCount} {cartCount === 1 ? "item" : "itens"}
              </span>
              <span className="font-display font-bold tabular-nums text-[14.5px]">{brl(cartTotal)}</span>
            </motion.button>
          ) : (
            <motion.p
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`text-[12px] text-center ${TEXT_TERTIARY}`}
            >
              Seu carrinho está vazio
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
}

function Chip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10.5px] font-medium px-2.5 py-1 rounded-full border border-white/[0.08] bg-white/[0.04] text-[#A5A5A0]">
      {icon}
      {children}
    </span>
  );
}

function SideAction({
  children, onClick, href, label,
}: { children: React.ReactNode; onClick?: () => void; href?: string; label: string }) {
  const cls =
    "flex-1 inline-flex items-center justify-center gap-1.5 min-h-[36px] rounded-[12px] text-[11.5px] font-semibold text-[#A5A5A0] border border-white/[0.08] bg-white/[0.03] hover:text-[#F7F7F5] hover:bg-white/[0.07] transition-colors";
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-label={label} className={cls}>
      {children}
    </button>
  );
}

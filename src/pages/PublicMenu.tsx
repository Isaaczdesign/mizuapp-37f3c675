import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart, Plus, Minus, X, Send, ChevronRight, Phone, Clock,
  AlertTriangle, Check, UtensilsCrossed, MapPin, Star, Truck, ShoppingBag, CreditCard,
} from "lucide-react";

// ── Types ──
interface Variation { id: string; name: string; price_delta: number; absolute_price: number | null; }
interface Addon { id: string; name: string; price: number; }
interface MenuItem {
  id: string; name: string; description: string | null; price: number; image_url: string | null;
  tags: string[] | null; category_id: string; ingredients: string | null; allergens: string | null;
  variations?: Variation[]; addons?: Addon[];
}
interface CartItem {
  cartKey: string; menuItemId: string; name: string; price: number; quantity: number;
  variationName?: string; selectedAddons: { name: string; price: number }[];
  image_url: string | null; itemNotes?: string;
}
interface Category { id: string; name: string; sort_order: number; }
interface Restaurant {
  id: string; name: string; logo_url: string | null; primary_color: string | null;
  banner_url: string | null; description: string | null; pickup_dine_in_note: string | null;
  owner_phone: string | null; upsell_item_ids: string[] | null;
  pickup_enabled: boolean; dine_in_enabled: boolean; delivery_enabled: boolean;
  delivery_fee: number | null; payment_methods: any;
}
type OrderType = "dine_in" | "pickup" | "delivery";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const TAG_BADGES: Record<string, { emoji: string; label: string }> = {
  best_seller: { emoji: "🔥", label: "Mais Vendido" },
  recommended: { emoji: "⭐", label: "Recomendado" },
  chef_pick: { emoji: "👨‍🍳", label: "Chef" },
  high_margin: { emoji: "💎", label: "Destaque" },
  combo: { emoji: "🎁", label: "Combo" },
};

// ── Operating Hours helper ──
function getOpenStatus(hours: any): { isOpen: boolean; label: string } {
  if (!hours) return { isOpen: true, label: "Aberto" };
  const now = new Date();
  const dayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const dayKey = dayKeys[now.getDay()];
  const today = hours[dayKey];
  if (!today || today.closed) return { isOpen: false, label: "Fechado hoje" };
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const [oh, om] = (today.open || "00:00").split(":").map(Number);
  const [ch, cm] = (today.close || "23:59").split(":").map(Number);
  const openMin = oh * 60 + om;
  const closeMin = ch * 60 + cm;
  if (nowMin >= openMin && nowMin <= closeMin) return { isOpen: true, label: `Aberto até ${today.close}` };
  if (nowMin < openMin) return { isOpen: false, label: `Abre às ${today.open}` };
  return { isOpen: false, label: "Fechado agora" };
}

// ── Skeleton Loaders ──
function MenuSkeleton() {
  return (
    <div className="space-y-4 px-4 py-6">
      {/* Banner skeleton */}
      <Skeleton className="w-full h-44 rounded-2xl" />
      {/* Category bar skeleton */}
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-8 w-20 rounded-full" />)}
      </div>
      {/* Item skeletons */}
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex gap-3">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="w-24 h-24 rounded-xl shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ── Main Component ──
const PublicMenu = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const tableToken = searchParams.get("t");

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [tableId, setTableId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(0); // 0=closed, 1=dados, 2=confirmar
  const [showItemDetail, setShowItemDetail] = useState<MenuItem | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [operatingHours, setOperatingHours] = useState<any>(null);

  const [customerName, setCustomerName] = useState("");
  const [customerWhatsapp, setCustomerWhatsapp] = useState("");
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [orderNotes, setOrderNotes] = useState("");

  const [selectedVariation, setSelectedVariation] = useState<Variation | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<Addon[]>([]);
  const [detailQty, setDetailQty] = useState(1);

  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const categoryNavRef = useRef<HTMLDivElement>(null);
  const scrollObserver = useRef<IntersectionObserver | null>(null);

  useEffect(() => { loadMenu(); }, [slug]);

  // ── Scroll-spy for category nav ──
  useEffect(() => {
    if (!categories.length) return;
    scrollObserver.current?.disconnect();
    scrollObserver.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveCategory(entry.target.getAttribute("data-cat-id"));
          }
        }
      },
      { rootMargin: "-120px 0px -60% 0px", threshold: 0.1 }
    );
    Object.values(categoryRefs.current).forEach((el) => {
      if (el) scrollObserver.current!.observe(el);
    });
    return () => scrollObserver.current?.disconnect();
  }, [categories, items]);

  async function loadMenu() {
    if (!slug) return;
    const { data: restaurantRows, error: restaurantError } = await (supabase as any)
      .rpc("get_public_restaurant_by_slug", { _slug: slug });
    const rest = Array.isArray(restaurantRows) ? restaurantRows[0] : restaurantRows;
    if (restaurantError) console.error("Erro ao carregar cardápio público:", restaurantError);
    if (!rest) { setLoading(false); return; }
    setRestaurant(rest as any);

    if (rest.operating_hours) setOperatingHours(rest.operating_hours);

    if (tableToken) {
      const { data: tableRows } = await (supabase as any).rpc("get_table_by_token", { _token: tableToken });
      const table = Array.isArray(tableRows) ? tableRows[0] : tableRows;
      if (table && table.restaurant_id === rest.id) setTableId(table.id);
    }

    const [catRes, itemRes] = await Promise.all([
      supabase.from("menu_categories").select("*").eq("restaurant_id", rest.id).order("sort_order"),
      supabase.from("menu_items").select("*").eq("restaurant_id", rest.id).eq("is_active", true).order("sort_order"),
    ]);

    const menuItems = itemRes.data ?? [];
    const itemIds = menuItems.map((i) => i.id);

    let variations: any[] = [];
    let addons: any[] = [];
    if (itemIds.length > 0) {
      const [varRes, addonRes] = await Promise.all([
        (supabase as any).from("menu_item_variations").select("*").in("menu_item_id", itemIds).eq("is_active", true).order("sort_order"),
        (supabase as any).from("menu_item_addons").select("*").in("menu_item_id", itemIds).eq("is_active", true).order("sort_order"),
      ]);
      variations = varRes.data ?? [];
      addons = addonRes.data ?? [];
    }

    const enrichedItems = menuItems.map((item) => ({
      ...item,
      variations: variations.filter((v: any) => v.menu_item_id === item.id),
      addons: addons.filter((a: any) => a.menu_item_id === item.id),
    }));

    setCategories(catRes.data ?? []);
    setItems(enrichedItems as any);
    if (catRes.data?.length) setActiveCategory(catRes.data[0].id);
    setLoading(false);
  }

  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  const accentColor = restaurant?.primary_color ?? "#FF6B35";
  const openStatus = getOpenStatus(operatingHours);

  // ── Upsell ──
  const upsellItems = useMemo(() => {
    if (!cart.length) return [];
    const cartIds = new Set(cart.map((i) => i.menuItemId));
    const suggestions: MenuItem[] = [];
    const upsellIds = restaurant?.upsell_item_ids ?? [];
    upsellIds.forEach((uid) => {
      const item = items.find((i) => i.id === uid && !cartIds.has(i.id));
      if (item && suggestions.length < 3) suggestions.push(item);
    });
    if (suggestions.length < 3) {
      const highMargin = items.find((i) => !cartIds.has(i.id) && (i.tags ?? []).includes("high_margin") && !suggestions.find((s) => s.id === i.id));
      if (highMargin) suggestions.push(highMargin);
    }
    return suggestions.slice(0, 3);
  }, [cart, items, restaurant]);

  // ── Cart Logic ──
  function openItemDetail(item: MenuItem) {
    setShowItemDetail(item);
    setSelectedVariation(null);
    setSelectedAddons([]);
    setDetailQty(1);
  }

  function addToCartFromDetail() {
    if (!showItemDetail) return;
    const item = showItemDetail;
    const basePrice = selectedVariation?.absolute_price != null
      ? Number(selectedVariation.absolute_price)
      : Number(item.price) + (selectedVariation?.price_delta ?? 0);
    const addonsPrice = selectedAddons.reduce((s, a) => s + Number(a.price), 0);
    const totalPrice = basePrice + addonsPrice;
    const cartKey = `${item.id}-${selectedVariation?.id ?? "base"}-${selectedAddons.map((a) => a.id).sort().join(",")}`;

    setCart((prev) => {
      const existing = prev.find((i) => i.cartKey === cartKey);
      if (existing) return prev.map((i) => i.cartKey === cartKey ? { ...i, quantity: i.quantity + detailQty } : i);
      return [...prev, {
        cartKey, menuItemId: item.id,
        name: item.name + (selectedVariation ? ` (${selectedVariation.name})` : ""),
        price: totalPrice, quantity: detailQty, variationName: selectedVariation?.name,
        selectedAddons: selectedAddons.map((a) => ({ name: a.name, price: Number(a.price) })),
        image_url: item.image_url,
      }];
    });
    setShowItemDetail(null);
    toast.success("Adicionado ao carrinho!");
  }

  function addSimpleToCart(item: MenuItem) {
    if ((item.variations?.length ?? 0) > 0 || (item.addons?.length ?? 0) > 0) {
      openItemDetail(item);
      return;
    }
    const cartKey = `${item.id}-base-`;
    setCart((prev) => {
      const existing = prev.find((i) => i.cartKey === cartKey);
      if (existing) return prev.map((i) => i.cartKey === cartKey ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { cartKey, menuItemId: item.id, name: item.name, price: Number(item.price), quantity: 1, selectedAddons: [], image_url: item.image_url }];
    });
    toast.success("Adicionado!");
  }

  function removeFromCart(cartKey: string) {
    setCart((prev) => {
      const existing = prev.find((i) => i.cartKey === cartKey);
      if (existing && existing.quantity > 1) return prev.map((i) => i.cartKey === cartKey ? { ...i, quantity: i.quantity - 1 } : i);
      return prev.filter((i) => i.cartKey !== cartKey);
    });
  }

  const scrollToCategory = useCallback((catId: string) => {
    setActiveCategory(catId);
    const el = categoryRefs.current[catId];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (!restaurant || !cart.length) return;
    setSubmitting(true);
    try {
      // Find or create customer via SECURITY DEFINER RPC (anon has no SELECT/UPDATE on customers)
      const { data: customerId, error: custErr } = await supabase.rpc("find_or_create_customer", {
        _restaurant_id: restaurant.id,
        _name: customerName.trim(),
        _whatsapp: customerWhatsapp.trim(),
        _consent: consentMarketing,
      });
      if (custErr || !customerId) throw custErr ?? new Error("Falha ao registrar cliente");

      const { data: order, error: orderErr } = await supabase.from("orders")
        .insert({ restaurant_id: restaurant.id, table_id: tableId, customer_id: customerId, total: cartTotal, notes: orderNotes || null })
        .select("id").single();
      if (orderErr) throw orderErr;

      const orderItems = cart.map((item) => ({
        order_id: order.id, menu_item_id: item.menuItemId, name: item.name,
        quantity: item.quantity, unit_price: item.price, notes: item.itemNotes || null,
      } as any));

      const { error: itemsErr } = await supabase.from("order_items").insert(orderItems);
      if (itemsErr) throw itemsErr;

      setOrderSuccess(order.id.slice(0, 8).toUpperCase());
      setCart([]); setCheckoutStep(0); setShowCart(false);
      setCustomerName(""); setCustomerWhatsapp(""); setOrderNotes("");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao enviar pedido. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading ──
  if (loading) return <MenuSkeleton />;

  // ── Not found ──
  if (!restaurant) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-center">
        <UtensilsCrossed className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="font-display text-xl font-bold mb-2">Restaurante não encontrado</h2>
        <p className="text-sm text-muted-foreground">Verifique o link e tente novamente.</p>
      </div>
    );
  }

  // ── Order success ──
  if (orderSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="glass-card p-8 text-center max-w-sm w-full"
        >
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: accentColor + "15" }}>
            <Check className="w-10 h-10" style={{ color: accentColor }} />
          </div>
          <h2 className="font-display text-2xl font-bold mb-2">Pedido Enviado!</h2>
          <p className="text-muted-foreground mb-1">Seu pedido já está na cozinha.</p>
          <p className="font-mono text-3xl font-bold my-4" style={{ color: accentColor }}>#{orderSuccess}</p>
          <p className="text-xs text-muted-foreground mb-6">Guarde este código para acompanhar.</p>
          <Button onClick={() => setOrderSuccess(null)} className="w-full" style={{ backgroundColor: accentColor }}>
            Fazer Novo Pedido
          </Button>
        </motion.div>
      </div>
    );
  }

  const categorizedItems = categories.map((cat) => ({
    ...cat,
    items: items.filter((i) => i.category_id === cat.id),
  })).filter((c) => c.items.length > 0);

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* ── Banner ── */}
      <div className="relative">
        {restaurant.banner_url ? (
          <div className="h-48 md:h-56 relative">
            <img src={restaurant.banner_url} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          </div>
        ) : (
          <div className="h-32 relative" style={{ background: `linear-gradient(135deg, ${accentColor}30, ${accentColor}05)` }}>
            <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
          </div>
        )}

        {/* Restaurant info overlaying banner */}
        <div className="relative -mt-16 px-4 z-10">
          <div className="flex items-end gap-3">
            {restaurant.logo_url ? (
              <img src={restaurant.logo_url} alt="" className="w-16 h-16 rounded-2xl object-cover border-2 border-background shadow-lg shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-2xl border-2 border-background shadow-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: accentColor + "20" }}>
                <UtensilsCrossed className="w-7 h-7" style={{ color: accentColor }} />
              </div>
            )}
            <div className="flex-1 min-w-0 pb-1">
              <h1 className="font-display text-xl font-bold truncate">{restaurant.name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                  openStatus.isOpen ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${openStatus.isOpen ? "bg-green-400" : "bg-red-400"}`} />
                  {openStatus.label}
                </span>
              </div>
            </div>
            {restaurant.owner_phone && (
              <a href={`https://wa.me/${restaurant.owner_phone.replace(/\D/g, "")}`}
                target="_blank" rel="noopener noreferrer"
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors"
                style={{ backgroundColor: accentColor + "15" }}>
                <Phone className="w-4 h-4" style={{ color: accentColor }} />
              </a>
            )}
          </div>

          {restaurant.description && (
            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{restaurant.description}</p>
          )}

          {/* Badge */}
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ backgroundColor: accentColor + "10", color: accentColor }}>
            <Star className="w-3 h-3" />
            Peça direto sem taxas de app
          </div>
        </div>
      </div>

      {/* ── Sticky Category Nav ── */}
      <div className="sticky top-0 z-40 mt-4 bg-background/90 backdrop-blur-xl border-b border-border">
        <div ref={categoryNavRef} className="flex gap-1 px-4 py-2 overflow-x-auto scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => scrollToCategory(cat.id)}
              className="px-4 py-2 rounded-full text-sm whitespace-nowrap transition-all font-medium"
              style={
                activeCategory === cat.id
                  ? { backgroundColor: accentColor, color: "white" }
                  : {}
              }
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── Items by Category ── */}
      <div className="px-4 pt-4">
        {categorizedItems.length === 0 && (
          <div className="text-center py-16">
            <UtensilsCrossed className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-display font-bold mb-1">Cardápio em breve</h3>
            <p className="text-sm text-muted-foreground">Este restaurante ainda está preparando o cardápio.</p>
          </div>
        )}

        {categorizedItems.map((cat) => (
          <div
            key={cat.id}
            ref={(el) => { categoryRefs.current[cat.id] = el; }}
            data-cat-id={cat.id}
            className="mb-6 scroll-mt-[60px]"
          >
            <h2 className="font-display text-lg font-bold mb-3 sticky top-[52px] bg-background/90 backdrop-blur-sm py-2 z-20">
              {cat.name}
            </h2>

            <div className="space-y-2">
              {cat.items.map((item, idx) => {
                const inCart = cart.filter((c) => c.menuItemId === item.id).reduce((s, c) => s + c.quantity, 0);
                const tags = (item.tags ?? []).filter((t) => TAG_BADGES[t]);
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03, duration: 0.3 }}
                    onClick={() => openItemDetail(item)}
                    className="flex gap-3 p-3 rounded-2xl bg-card/60 backdrop-blur border border-white/[0.05] cursor-pointer hover:border-white/[0.1] transition-all active:scale-[0.98]"
                  >
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <h3 className="font-semibold text-sm leading-tight">{item.name}</h3>
                        {tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {tags.map((t) => (
                              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                                style={{ backgroundColor: accentColor + "15", color: accentColor }}>
                                {TAG_BADGES[t].emoji} {TAG_BADGES[t].label}
                              </span>
                            ))}
                          </div>
                        )}
                        {item.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="font-display font-bold text-sm" style={{ color: accentColor }}>
                          {fmt(Number(item.price))}
                        </span>
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {inCart > 0 && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: accentColor + "20", color: accentColor }}>
                              {inCart}×
                            </span>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); addSimpleToCart(item); }}
                            className="w-8 h-8 rounded-xl text-white flex items-center justify-center transition-transform active:scale-90"
                            style={{ backgroundColor: accentColor }}
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                    {item.image_url && (
                      <img
                        src={item.image_url} alt={item.name}
                        className="w-24 h-24 rounded-xl object-cover shrink-0"
                        loading="lazy"
                      />
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ── Item Detail Modal ── */}
      <AnimatePresence>
        {showItemDetail && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col"
          >
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowItemDetail(null)} />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="mt-auto relative bg-card border-t border-border rounded-t-3xl max-h-[90vh] flex flex-col"
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-muted" />
              </div>

              <div className="overflow-y-auto flex-1">
                {showItemDetail.image_url && (
                  <img src={showItemDetail.image_url} alt="" className="w-full h-56 object-cover" />
                )}
                <div className="p-4 space-y-4">
                  <div>
                    <h2 className="font-display text-xl font-bold">{showItemDetail.name}</h2>
                    <p className="font-display text-lg font-bold mt-1" style={{ color: accentColor }}>
                      {fmt(Number(showItemDetail.price))}
                    </p>
                  </div>

                  {showItemDetail.description && (
                    <p className="text-sm text-muted-foreground">{showItemDetail.description}</p>
                  )}

                  {showItemDetail.ingredients && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Ingredientes</p>
                      <p className="text-sm">{showItemDetail.ingredients}</p>
                    </div>
                  )}

                  {showItemDetail.allergens && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-yellow-500/10">
                      <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-yellow-500">{showItemDetail.allergens}</p>
                    </div>
                  )}

                  {/* Variations */}
                  {(showItemDetail.variations?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-sm font-semibold mb-2">Variação</p>
                      <div className="space-y-1.5">
                        {showItemDetail.variations!.map((v) => (
                          <button key={v.id}
                            onClick={() => setSelectedVariation(selectedVariation?.id === v.id ? null : v)}
                            className={`w-full flex items-center justify-between p-3 rounded-xl text-sm transition-all ${
                              selectedVariation?.id === v.id ? "" : "bg-secondary"
                            }`}
                            style={selectedVariation?.id === v.id ? { outlineColor: accentColor, backgroundColor: accentColor + "08", outline: `2px solid ${accentColor}` } : {}}
                          >
                            <span>{v.name}</span>
                            <span className="font-medium" style={{ color: accentColor }}>
                              {v.absolute_price != null ? fmt(Number(v.absolute_price)) :
                                v.price_delta > 0 ? `+${fmt(Number(v.price_delta))}` : "incluso"}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Addons */}
                  {(showItemDetail.addons?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-sm font-semibold mb-2">Adicionais</p>
                      <div className="space-y-1.5">
                        {showItemDetail.addons!.map((a) => {
                          const isSelected = selectedAddons.find((sa) => sa.id === a.id);
                          return (
                            <button key={a.id}
                              onClick={() => setSelectedAddons(isSelected
                                ? selectedAddons.filter((sa) => sa.id !== a.id) : [...selectedAddons, a]
                              )}
                              className={`w-full flex items-center justify-between p-3 rounded-xl text-sm transition-all ${
                                isSelected ? "" : "bg-secondary"
                              }`}
                              style={isSelected ? { outlineColor: accentColor, backgroundColor: accentColor + "08", outline: `2px solid ${accentColor}` } : {}}
                            >
                              <span>{a.name}</span>
                              <span className="font-medium" style={{ color: accentColor }}>+{fmt(Number(a.price))}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Quantity */}
                  <div className="flex items-center justify-center gap-6 py-2">
                    <button onClick={() => setDetailQty(Math.max(1, detailQty - 1))}
                      className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center transition-transform active:scale-90">
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="font-display text-2xl font-bold w-8 text-center">{detailQty}</span>
                    <button onClick={() => setDetailQty(detailQty + 1)}
                      className="w-10 h-10 rounded-xl text-white flex items-center justify-center transition-transform active:scale-90"
                      style={{ backgroundColor: accentColor }}>
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-border">
                <Button className="w-full py-6 text-base rounded-2xl font-bold" style={{ backgroundColor: accentColor }}
                  onClick={addToCartFromDetail}>
                  Adicionar • {fmt(
                    ((selectedVariation?.absolute_price != null ? Number(selectedVariation.absolute_price) :
                      Number(showItemDetail.price) + (selectedVariation?.price_delta ?? 0)) +
                      selectedAddons.reduce((s, a) => s + Number(a.price), 0)) * detailQty
                  )}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Floating Cart Bar ── */}
      <AnimatePresence>
        {cartCount > 0 && !showCart && !showItemDetail && checkoutStep === 0 && (
          <motion.button
            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
            onClick={() => setShowCart(true)}
            className="fixed bottom-4 left-4 right-4 text-white rounded-2xl py-4 px-5 flex items-center justify-between z-50 transition-transform active:scale-[0.98]"
            style={{ backgroundColor: accentColor, boxShadow: `0 8px 32px -4px ${accentColor}60` }}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <span className="font-bold">{cartCount} {cartCount === 1 ? "item" : "itens"}</span>
            </div>
            <span className="font-display font-bold text-lg">{fmt(cartTotal)}</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Cart Drawer ── */}
      <AnimatePresence>
        {showCart && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowCart(false)} />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="mt-auto relative bg-card border-t border-border rounded-t-3xl max-h-[85vh] flex flex-col"
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-muted" />
              </div>
              <div className="flex items-center justify-between px-4 pb-3 border-b border-border">
                <h2 className="font-display text-lg font-bold">Seu Pedido</h2>
                <button onClick={() => setShowCart(false)} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 p-4 space-y-3">
                {cart.map((item) => (
                  <div key={item.cartKey} className="flex items-center gap-3">
                    {item.image_url && (
                      <img src={item.image_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      {item.selectedAddons.length > 0 && (
                        <p className="text-[10px] text-muted-foreground">+ {item.selectedAddons.map((a) => a.name).join(", ")}</p>
                      )}
                      <p className="text-xs font-medium mt-0.5" style={{ color: accentColor }}>{fmt(item.price)}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => removeFromCart(item.cartKey)} className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-sm font-bold w-5 text-center">{item.quantity}</span>
                      <button
                        onClick={() => setCart((prev) => prev.map((i) => i.cartKey === item.cartKey ? { ...i, quantity: i.quantity + 1 } : i))}
                        className="w-7 h-7 rounded-lg text-white flex items-center justify-center"
                        style={{ backgroundColor: accentColor }}>
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Upsell */}
                {upsellItems.length > 0 && (
                  <div className="pt-3 border-t border-border">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Que tal adicionar?</p>
                    {upsellItems.map((item) => (
                      <button key={item.id} onClick={() => { addSimpleToCart(item); }}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl bg-secondary/50 mb-1.5 hover:bg-secondary transition-colors">
                        <div className="text-left">
                          <p className="text-sm font-medium">{item.name}</p>
                          <p className="text-xs font-bold" style={{ color: accentColor }}>+ {fmt(Number(item.price))}</p>
                        </div>
                        <Plus className="w-4 h-4 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Order notes */}
                <div className="pt-3 border-t border-border">
                  <label className="text-xs font-medium text-muted-foreground">Observações</label>
                  <textarea value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)}
                    className="w-full mt-1 p-3 rounded-xl bg-secondary text-sm resize-none h-16 border-none outline-none placeholder:text-muted-foreground"
                    placeholder="Sem wasabi, alergia a amendoim..." />
                </div>
              </div>

              <div className="p-4 border-t border-border space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-display text-2xl font-bold" style={{ color: accentColor }}>{fmt(cartTotal)}</span>
                </div>
                <Button
                  className="w-full py-6 text-base rounded-2xl font-bold"
                  style={{ backgroundColor: accentColor }}
                  onClick={() => { setShowCart(false); setCheckoutStep(1); }}
                >
                  Ver pedido <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Step-Based Checkout ── */}
      <AnimatePresence>
        {checkoutStep > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setCheckoutStep(0)} />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="mt-auto relative bg-card border-t border-border rounded-t-3xl max-h-[90vh] flex flex-col"
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-muted" />
              </div>

              {/* Step indicators */}
              <div className="flex items-center gap-2 px-4 pb-3 border-b border-border">
                {["Dados", "Confirmação"].map((label, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center transition-colors ${
                      checkoutStep > i + 1 ? "text-white" : checkoutStep === i + 1 ? "text-white" : "bg-secondary text-muted-foreground"
                    }`} style={checkoutStep >= i + 1 ? { backgroundColor: accentColor } : {}}>
                      {checkoutStep > i + 1 ? <Check className="w-3 h-3" /> : i + 1}
                    </div>
                    <span className={`text-xs font-medium ${checkoutStep === i + 1 ? "text-foreground" : "text-muted-foreground"}`}>
                      {label}
                    </span>
                    {i < 1 && <div className="w-8 h-px bg-border" />}
                  </div>
                ))}
              </div>

              {/* Step 1: Customer data */}
              {checkoutStep === 1 && (
                <div className="p-4 space-y-4 overflow-y-auto flex-1">
                  <div>
                    <label className="text-sm font-medium">Nome *</label>
                    <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                      required placeholder="Seu nome" className="mt-1" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">WhatsApp *</label>
                    <Input value={customerWhatsapp} onChange={(e) => setCustomerWhatsapp(e.target.value)}
                      required placeholder="(11) 99999-9999" className="mt-1" />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input type="checkbox" checked={consentMarketing} onChange={(e) => setConsentMarketing(e.target.checked)}
                      className="rounded accent-primary" style={{ accentColor }} />
                    Aceito receber promoções por WhatsApp
                  </label>
                  <Button
                    className="w-full py-6 rounded-2xl font-bold text-base"
                    style={{ backgroundColor: accentColor }}
                    disabled={!customerName.trim() || !customerWhatsapp.trim()}
                    onClick={() => setCheckoutStep(2)}
                  >
                    Continuar
                  </Button>
                </div>
              )}

              {/* Step 2: Confirmation */}
              {checkoutStep === 2 && (
                <form onSubmit={handleCheckout} className="p-4 space-y-4 overflow-y-auto flex-1">
                  <div className="space-y-2">
                    {cart.map((item) => (
                      <div key={item.cartKey} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{item.quantity}× {item.name}</span>
                        <span className="font-medium">{fmt(item.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-border pt-3 flex justify-between">
                    <span className="font-bold">Total</span>
                    <span className="font-display text-xl font-bold" style={{ color: accentColor }}>{fmt(cartTotal)}</span>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>📛 {customerName}</p>
                    <p>📱 {customerWhatsapp}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="flex-1 py-6 rounded-2xl"
                      onClick={() => setCheckoutStep(1)}>
                      Voltar
                    </Button>
                    <Button type="submit" className="flex-1 py-6 rounded-2xl font-bold text-base"
                      style={{ backgroundColor: accentColor }} disabled={submitting}>
                      {submitting ? "Enviando..." : "Confirmar"} <Send className="ml-2 w-4 h-4" />
                    </Button>
                  </div>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PublicMenu;

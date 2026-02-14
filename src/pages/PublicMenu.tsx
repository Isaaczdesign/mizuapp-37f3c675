import { useState, useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ShoppingCart, Plus, Minus, X, Send, ChevronRight, ChevronDown, ChevronUp, Phone, Clock, AlertTriangle, Check } from "lucide-react";

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
}

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
  const [showCheckout, setShowCheckout] = useState(false);
  const [showItemDetail, setShowItemDetail] = useState<MenuItem | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [operatingHours, setOperatingHours] = useState<any>(null);

  const [customerName, setCustomerName] = useState("");
  const [customerWhatsapp, setCustomerWhatsapp] = useState("");
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [orderNotes, setOrderNotes] = useState("");

  // Item detail state
  const [selectedVariation, setSelectedVariation] = useState<Variation | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<Addon[]>([]);
  const [detailQty, setDetailQty] = useState(1);

  useEffect(() => { loadMenu(); }, [slug]);

  async function loadMenu() {
    if (!slug) return;
    const { data: rest } = await supabase.from("restaurants").select("*").eq("slug", slug).single();
    if (!rest) { setLoading(false); return; }
    setRestaurant(rest as any);

    // Load settings for operating hours
    const { data: settings } = await supabase.from("settings").select("operating_hours").eq("restaurant_id", rest.id).maybeSingle();
    if (settings?.operating_hours) setOperatingHours(settings.operating_hours);

    if (tableToken) {
      const { data: table } = await supabase.from("restaurant_tables").select("id")
        .eq("token", tableToken).eq("restaurant_id", rest.id).eq("is_active", true).single();
      if (table) setTableId(table.id);
    }

    const [catRes, itemRes] = await Promise.all([
      supabase.from("menu_categories").select("*").eq("restaurant_id", rest.id).order("sort_order"),
      supabase.from("menu_items").select("*").eq("restaurant_id", rest.id).eq("is_active", true).order("sort_order"),
    ]);

    const menuItems = itemRes.data ?? [];
    const itemIds = menuItems.map((i) => i.id);

    // Load variations and addons
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

  // Upsell logic
  const upsellItems = useMemo(() => {
    if (!cart.length) return [];
    const suggestions: MenuItem[] = [];
    const cartIds = new Set(cart.map((i) => i.menuItemId));

    // Custom upsell items from restaurant settings
    const upsellIds = restaurant?.upsell_item_ids ?? [];
    upsellIds.forEach((uid) => {
      const item = items.find((i) => i.id === uid && !cartIds.has(i.id));
      if (item && suggestions.length < 3) suggestions.push(item);
    });

    // Default rules
    if (suggestions.length < 3) {
      const hasSushi = cart.some((i) => i.name.toLowerCase().includes("temaki") || i.name.toLowerCase().includes("sushi"));
      const hasCombo = cart.some((i) => items.find((mi) => mi.id === i.menuItemId)?.tags?.includes("combo"));

      if (hasSushi) {
        const drink = items.find((i) => !cartIds.has(i.id) && !suggestions.find((s) => s.id === i.id) && i.name.toLowerCase().includes("drink"));
        if (drink) suggestions.push(drink);
      }
      if (hasCombo) {
        const dessert = items.find((i) => !cartIds.has(i.id) && !suggestions.find((s) => s.id === i.id) && i.name.toLowerCase().includes("sobremesa"));
        if (dessert) suggestions.push(dessert);
      }
      const highMargin = items.find((i) => !cartIds.has(i.id) && (i.tags ?? []).includes("high_margin") && !suggestions.find((s) => s.id === i.id));
      if (highMargin) suggestions.push(highMargin);
    }

    return suggestions.slice(0, 3);
  }, [cart, items, restaurant]);

  function openItemDetail(item: MenuItem) {
    setShowItemDetail(item);
    setSelectedVariation(null);
    setSelectedAddons([]);
    setDetailQty(1);
  }

  function addToCartFromDetail() {
    if (!showItemDetail) return;
    const item = showItemDetail;
    const basePrice = selectedVariation?.absolute_price != null ? Number(selectedVariation.absolute_price) :
      Number(item.price) + (selectedVariation?.price_delta ?? 0);
    const addonsPrice = selectedAddons.reduce((s, a) => s + Number(a.price), 0);
    const totalPrice = basePrice + addonsPrice;
    const cartKey = `${item.id}-${selectedVariation?.id ?? "base"}-${selectedAddons.map((a) => a.id).sort().join(",")}`;

    setCart((prev) => {
      const existing = prev.find((i) => i.cartKey === cartKey);
      if (existing) return prev.map((i) => i.cartKey === cartKey ? { ...i, quantity: i.quantity + detailQty } : i);
      return [...prev, {
        cartKey, menuItemId: item.id, name: item.name + (selectedVariation ? ` (${selectedVariation.name})` : ""),
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
  }

  function removeFromCart(cartKey: string) {
    setCart((prev) => {
      const existing = prev.find((i) => i.cartKey === cartKey);
      if (existing && existing.quantity > 1) return prev.map((i) => i.cartKey === cartKey ? { ...i, quantity: i.quantity - 1 } : i);
      return prev.filter((i) => i.cartKey !== cartKey);
    });
  }

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (!restaurant || !cart.length) return;
    setSubmitting(true);
    try {
      const { data: customer, error: custErr } = await supabase.from("customers")
        .upsert({ restaurant_id: restaurant.id, name: customerName.trim(), whatsapp: customerWhatsapp.trim(), consent_marketing: consentMarketing },
          { onConflict: "restaurant_id,whatsapp" }).select("id").single();
      if (custErr) throw custErr;

      const { data: order, error: orderErr } = await supabase.from("orders")
        .insert({ restaurant_id: restaurant.id, table_id: tableId, customer_id: customer.id, total: cartTotal, notes: orderNotes || null })
        .select("id").single();
      if (orderErr) throw orderErr;

      const orderItems = cart.map((item) => ({
        order_id: order.id, menu_item_id: item.menuItemId, name: item.name,
        quantity: item.quantity, unit_price: item.price, notes: item.itemNotes || null,
        variation_name: item.variationName || null,
        addons_json: item.selectedAddons.length > 0 ? JSON.stringify(item.selectedAddons) : null,
      } as any));

      const { error: itemsErr } = await supabase.from("order_items").insert(orderItems);
      if (itemsErr) throw itemsErr;

      setOrderSuccess(order.id.slice(0, 8).toUpperCase());
      setCart([]);
      setShowCheckout(false);
      setShowCart(false);
      setCustomerName("");
      setCustomerWhatsapp("");
      setOrderNotes("");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao enviar pedido. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  const accentColor = restaurant?.primary_color ?? "#FF6B35";

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-foreground">
        <p>Restaurante não encontrado.</p>
      </div>
    );
  }

  // Order success screen
  if (orderSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="glass-card p-8 text-center max-w-sm w-full">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: accentColor + "20" }}>
            <Check className="w-8 h-8" style={{ color: accentColor }} />
          </div>
          <h2 className="font-display text-2xl font-bold mb-2">Pedido Enviado!</h2>
          <p className="text-muted-foreground mb-4">Seu pedido foi enviado para a cozinha.</p>
          <p className="font-mono text-2xl font-bold mb-6" style={{ color: accentColor }}>#{orderSuccess}</p>
          <Button onClick={() => setOrderSuccess(null)} className="w-full" style={{ backgroundColor: accentColor }}>
            Fazer Novo Pedido
          </Button>
        </div>
      </div>
    );
  }

  const filteredItems = activeCategory ? items.filter((i) => i.category_id === activeCategory) : items;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Banner */}
      {restaurant.banner_url && (
        <div className="relative h-40 md:h-52">
          <img src={restaurant.banner_url} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          {restaurant.logo_url && (
            <img src={restaurant.logo_url} alt="" className="w-10 h-10 rounded-xl object-cover" />
          )}
          <div className="flex-1">
            <h1 className="font-display text-xl font-bold" style={{ color: accentColor }}>{restaurant.name}</h1>
            {restaurant.description && <p className="text-xs text-muted-foreground line-clamp-1">{restaurant.description}</p>}
          </div>
          {restaurant.owner_phone && (
            <a href={`https://wa.me/${restaurant.owner_phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
              className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: accentColor + "20" }}>
              <Phone className="w-4 h-4" style={{ color: accentColor }} />
            </a>
          )}
        </div>
        {restaurant.pickup_dine_in_note && (
          <p className="text-xs text-muted-foreground mt-1">{restaurant.pickup_dine_in_note}</p>
        )}
      </header>

      {/* Categories tabs */}
      <div className="sticky top-[65px] z-30 bg-background/80 backdrop-blur-xl border-b border-border overflow-x-auto">
        <div className="flex gap-1 px-4 py-2">
          {categories.map((cat) => (
            <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
              className="px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors"
              style={activeCategory === cat.id ? { backgroundColor: accentColor, color: "white" } : { backgroundColor: "hsl(var(--secondary))", color: "hsl(var(--secondary-foreground))" }}>
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Items */}
      <div className="px-4 py-4 space-y-3">
        {filteredItems.map((item) => {
          const inCart = cart.filter((c) => c.menuItemId === item.id).reduce((s, c) => s + c.quantity, 0);
          return (
            <div key={item.id} className="glass-card p-3 flex gap-3 cursor-pointer" onClick={() => openItemDetail(item)}>
              {item.image_url && <img src={item.image_url} alt={item.name} className="w-20 h-20 rounded-xl object-cover shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-sm">{item.name}</h3>
                    {(item.tags ?? []).includes("best_seller") && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: accentColor + "20", color: accentColor }}>🔥 Mais Vendido</span>
                    )}
                    {(item.tags ?? []).includes("chef_pick") && (
                      <span className="text-[10px] bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded-full ml-1">👨‍🍳 Chef</span>
                    )}
                  </div>
                  <span className="font-display font-bold text-sm whitespace-nowrap" style={{ color: accentColor }}>
                    R${Number(item.price).toFixed(2)}
                  </span>
                </div>
                {item.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>}
                {item.allergens && <p className="text-[10px] text-yellow-500 mt-1">⚠️ {item.allergens}</p>}
                <div className="flex items-center justify-end mt-2 gap-2" onClick={(e) => e.stopPropagation()}>
                  {inCart > 0 && <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: accentColor + "20", color: accentColor }}>{inCart}x</span>}
                  <button onClick={(e) => { e.stopPropagation(); addSimpleToCart(item); }}
                    className="w-7 h-7 rounded-lg text-white flex items-center justify-center" style={{ backgroundColor: accentColor }}>
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {filteredItems.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhum item nesta categoria.</p>}
      </div>

      {/* Item Detail Sheet */}
      {showItemDetail && (
        <div className="fixed inset-0 z-50 flex flex-col">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowItemDetail(null)} />
          <div className="mt-auto relative bg-card border-t border-border rounded-t-3xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="font-display text-lg font-bold">{showItemDetail.name}</h2>
              <button onClick={() => setShowItemDetail(null)}><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-4">
              {showItemDetail.image_url && (
                <img src={showItemDetail.image_url} alt="" className="w-full h-48 rounded-xl object-cover" />
              )}
              {showItemDetail.description && <p className="text-sm text-muted-foreground">{showItemDetail.description}</p>}
              {showItemDetail.ingredients && (
                <div>
                  <p className="text-xs font-semibold mb-1">Ingredientes</p>
                  <p className="text-xs text-muted-foreground">{showItemDetail.ingredients}</p>
                </div>
              )}
              {showItemDetail.allergens && (
                <div className="flex items-center gap-1 text-yellow-500">
                  <AlertTriangle className="w-3 h-3" />
                  <p className="text-xs">{showItemDetail.allergens}</p>
                </div>
              )}

              {/* Variations */}
              {(showItemDetail.variations?.length ?? 0) > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2">Variação</p>
                  <div className="space-y-1">
                    {showItemDetail.variations!.map((v) => (
                      <button key={v.id} onClick={() => setSelectedVariation(selectedVariation?.id === v.id ? null : v)}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl text-sm transition-colors ${
                          selectedVariation?.id === v.id ? "border-2" : "bg-secondary"
                        }`}
                        style={selectedVariation?.id === v.id ? { borderColor: accentColor, backgroundColor: accentColor + "10" } : {}}>
                        <span>{v.name}</span>
                        <span className="font-medium" style={{ color: accentColor }}>
                          {v.absolute_price != null ? `R$${Number(v.absolute_price).toFixed(2)}` : v.price_delta > 0 ? `+R$${Number(v.price_delta).toFixed(2)}` : "incluso"}
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
                  <div className="space-y-1">
                    {showItemDetail.addons!.map((a) => {
                      const selected = selectedAddons.find((sa) => sa.id === a.id);
                      return (
                        <button key={a.id}
                          onClick={() => setSelectedAddons(selected ? selectedAddons.filter((sa) => sa.id !== a.id) : [...selectedAddons, a])}
                          className={`w-full flex items-center justify-between p-2.5 rounded-xl text-sm transition-colors ${
                            selected ? "border-2" : "bg-secondary"
                          }`}
                          style={selected ? { borderColor: accentColor, backgroundColor: accentColor + "10" } : {}}>
                          <span>{a.name}</span>
                          <span className="font-medium" style={{ color: accentColor }}>+R${Number(a.price).toFixed(2)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quantity */}
              <div className="flex items-center justify-center gap-4">
                <button onClick={() => setDetailQty(Math.max(1, detailQty - 1))} className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
                  <Minus className="w-4 h-4" />
                </button>
                <span className="font-display text-xl font-bold w-8 text-center">{detailQty}</span>
                <button onClick={() => setDetailQty(detailQty + 1)} className="w-9 h-9 rounded-lg text-white flex items-center justify-center" style={{ backgroundColor: accentColor }}>
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-4 border-t border-border">
              <Button className="w-full py-6 text-base" style={{ backgroundColor: accentColor }} onClick={addToCartFromDetail}>
                Adicionar • R${(
                  ((selectedVariation?.absolute_price != null ? Number(selectedVariation.absolute_price) :
                    Number(showItemDetail.price) + (selectedVariation?.price_delta ?? 0)) +
                    selectedAddons.reduce((s, a) => s + Number(a.price), 0)) * detailQty
                ).toFixed(2)}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cart FAB */}
      {cartCount > 0 && !showCart && !showItemDetail && (
        <button onClick={() => setShowCart(true)}
          className="fixed bottom-4 left-4 right-4 text-white rounded-2xl py-4 px-6 flex items-center justify-between z-50"
          style={{ backgroundColor: accentColor, boxShadow: `0 8px 32px -8px ${accentColor}80` }}>
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            <span className="font-semibold">{cartCount} {cartCount === 1 ? "item" : "itens"}</span>
          </div>
          <span className="font-display font-bold">R${cartTotal.toFixed(2)}</span>
        </button>
      )}

      {/* Cart drawer */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex flex-col">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowCart(false)} />
          <div className="mt-auto relative bg-card border-t border-border rounded-t-3xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="font-display text-lg font-bold">Seu Pedido</h2>
              <button onClick={() => setShowCart(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {cart.map((item) => (
                <div key={item.cartKey} className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    {item.selectedAddons.length > 0 && (
                      <p className="text-[10px] text-muted-foreground">+ {item.selectedAddons.map((a) => a.name).join(", ")}</p>
                    )}
                    <p className="text-xs text-muted-foreground">R${item.price.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => removeFromCart(item.cartKey)} className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-sm font-medium w-5 text-center">{item.quantity}</span>
                    <button onClick={() => setCart((prev) => prev.map((i) => i.cartKey === item.cartKey ? { ...i, quantity: i.quantity + 1 } : i))}
                      className="w-7 h-7 rounded-lg text-white flex items-center justify-center" style={{ backgroundColor: accentColor }}>
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="text-sm font-bold w-16 text-right">R${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}

              {/* Upsell */}
              {upsellItems.length > 0 && (
                <div className="pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-2">Que tal adicionar?</p>
                  {upsellItems.map((item) => (
                    <button key={item.id} onClick={() => addSimpleToCart(item)}
                      className="w-full flex items-center justify-between p-2 rounded-xl bg-secondary/50 mb-2 hover:bg-secondary transition-colors">
                      <div className="text-left">
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="text-xs font-semibold" style={{ color: accentColor }}>+ R${Number(item.price).toFixed(2)}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}

              <div className="pt-3 border-t border-border">
                <label className="text-xs text-muted-foreground">Observações do pedido</label>
                <textarea value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)}
                  className="w-full mt-1 p-2 rounded-xl bg-secondary text-sm resize-none h-16 border-none outline-none"
                  placeholder="Sem wasabi, alergia a amendoim..." />
              </div>
            </div>
            <div className="p-4 border-t border-border">
              <div className="flex justify-between mb-3">
                <span className="font-medium">Total</span>
                <span className="font-display text-xl font-bold" style={{ color: accentColor }}>R${cartTotal.toFixed(2)}</span>
              </div>
              <Button className="w-full py-6 text-base" style={{ backgroundColor: accentColor }}
                onClick={() => { setShowCart(false); setShowCheckout(true); }}>
                Finalizar Pedido <Send className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex flex-col">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowCheckout(false)} />
          <div className="mt-auto relative bg-card border-t border-border rounded-t-3xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="font-display text-lg font-bold">Seus Dados</h2>
              <button onClick={() => setShowCheckout(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCheckout} className="p-4 space-y-4 overflow-y-auto">
              <div>
                <label className="text-sm font-medium">Nome *</label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} required placeholder="Seu nome" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">WhatsApp *</label>
                <Input value={customerWhatsapp} onChange={(e) => setCustomerWhatsapp(e.target.value)} required placeholder="(11) 99999-9999" className="mt-1" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={consentMarketing} onChange={(e) => setConsentMarketing(e.target.checked)} className="rounded" />
                Aceito receber promoções por WhatsApp
              </label>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{cartCount} itens</span>
                <span className="font-bold" style={{ color: accentColor }}>R${cartTotal.toFixed(2)}</span>
              </div>
              <Button className="w-full py-6 text-base" style={{ backgroundColor: accentColor }} disabled={submitting}>
                {submitting ? "Enviando..." : "Enviar Pedido"} <Send className="ml-2 w-4 h-4" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicMenu;

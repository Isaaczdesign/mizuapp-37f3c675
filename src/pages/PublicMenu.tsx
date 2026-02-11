import { useState, useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ShoppingCart, Plus, Minus, X, Send, ChevronRight } from "lucide-react";

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  tags: string[] | null;
  category_id: string;
}

interface CartItem extends MenuItem {
  quantity: number;
  itemNotes?: string;
}

interface Category {
  id: string;
  name: string;
  sort_order: number;
}

const PublicMenu = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const tableToken = searchParams.get("t");

  const [restaurant, setRestaurant] = useState<{ id: string; name: string } | null>(null);
  const [tableId, setTableId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [customerWhatsapp, setCustomerWhatsapp] = useState("");
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [orderNotes, setOrderNotes] = useState("");

  useEffect(() => {
    loadMenu();
  }, [slug]);

  async function loadMenu() {
    if (!slug) return;

    const { data: rest } = await supabase
      .from("restaurants")
      .select("id, name")
      .eq("slug", slug)
      .single();

    if (!rest) {
      setLoading(false);
      return;
    }
    setRestaurant(rest);

    if (tableToken) {
      const { data: table } = await supabase
        .from("restaurant_tables")
        .select("id")
        .eq("token", tableToken)
        .eq("restaurant_id", rest.id)
        .eq("is_active", true)
        .single();
      if (table) setTableId(table.id);
    }

    const [catRes, itemRes] = await Promise.all([
      supabase.from("menu_categories").select("*").eq("restaurant_id", rest.id).order("sort_order"),
      supabase.from("menu_items").select("*").eq("restaurant_id", rest.id).eq("is_active", true).order("sort_order"),
    ]);

    setCategories(catRes.data ?? []);
    setItems(itemRes.data ?? []);
    if (catRes.data?.length) setActiveCategory(catRes.data[0].id);
    setLoading(false);
  }

  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  // Upsell logic
  const upsellItems = useMemo(() => {
    if (!cart.length) return [];
    const suggestions: MenuItem[] = [];
    const cartTags = cart.flatMap((i) => i.tags ?? []);
    const cartIds = new Set(cart.map((i) => i.id));

    // temaki → drink, combo → dessert
    const hasSushi = cart.some((i) => i.name.toLowerCase().includes("temaki") || i.name.toLowerCase().includes("sushi"));
    const hasCombo = cart.some((i) => (i.tags ?? []).includes("combo"));

    if (hasSushi) {
      const drink = items.find((i) => !cartIds.has(i.id) && i.name.toLowerCase().includes("drink"));
      if (drink) suggestions.push(drink);
    }
    if (hasCombo) {
      const dessert = items.find((i) => !cartIds.has(i.id) && i.name.toLowerCase().includes("sobremesa"));
      if (dessert) suggestions.push(dessert);
    }

    // Always suggest 1 high_margin item
    const highMargin = items.find(
      (i) => !cartIds.has(i.id) && (i.tags ?? []).includes("high_margin") && !suggestions.find((s) => s.id === i.id)
    );
    if (highMargin) suggestions.push(highMargin);

    return suggestions.slice(0, 2);
  }, [cart, items]);

  function addToCart(item: MenuItem) {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) return prev.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
      return [...prev, { ...item, quantity: 1 }];
    });
  }

  function removeFromCart(id: string) {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === id);
      if (existing && existing.quantity > 1) return prev.map((i) => (i.id === id ? { ...i, quantity: i.quantity - 1 } : i));
      return prev.filter((i) => i.id !== id);
    });
  }

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (!restaurant || !cart.length) return;
    setSubmitting(true);

    try {
      // Upsert customer
      const { data: customer, error: custErr } = await supabase
        .from("customers")
        .upsert(
          { restaurant_id: restaurant.id, name: customerName.trim(), whatsapp: customerWhatsapp.trim(), consent_marketing: consentMarketing },
          { onConflict: "restaurant_id,whatsapp" }
        )
        .select("id")
        .single();

      if (custErr) throw custErr;

      // Create order
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          restaurant_id: restaurant.id,
          table_id: tableId,
          customer_id: customer.id,
          total: cartTotal,
          notes: orderNotes || null,
        })
        .select("id")
        .single();

      if (orderErr) throw orderErr;

      // Create order items
      const orderItems = cart.map((item) => ({
        order_id: order.id,
        menu_item_id: item.id,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        notes: item.itemNotes || null,
      }));

      const { error: itemsErr } = await supabase.from("order_items").insert(orderItems);
      if (itemsErr) throw itemsErr;

      toast.success("Pedido enviado com sucesso! 🎉");
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

  const filteredItems = activeCategory ? items.filter((i) => i.category_id === activeCategory) : items;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-3">
        <h1 className="font-display text-xl font-bold gradient-text">{restaurant.name}</h1>
      </header>

      {/* Categories tabs */}
      <div className="sticky top-[53px] z-30 bg-background/80 backdrop-blur-xl border-b border-border overflow-x-auto">
        <div className="flex gap-1 px-4 py-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                activeCategory === cat.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Items */}
      <div className="px-4 py-4 space-y-3">
        {filteredItems.map((item) => {
          const inCart = cart.find((c) => c.id === item.id);
          return (
            <div key={item.id} className="glass-card p-3 flex gap-3">
              {item.image_url && (
                <img src={item.image_url} alt={item.name} className="w-20 h-20 rounded-xl object-cover shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-sm">{item.name}</h3>
                    {(item.tags ?? []).includes("best_seller") && (
                      <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">🔥 Mais Vendido</span>
                    )}
                  </div>
                  <span className="font-display font-bold text-primary text-sm whitespace-nowrap">
                    R${item.price.toFixed(2)}
                  </span>
                </div>
                {item.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>}
                <div className="flex items-center justify-end mt-2 gap-2">
                  {inCart ? (
                    <div className="flex items-center gap-2">
                      <button onClick={() => removeFromCart(item.id)} className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-sm font-medium w-5 text-center">{inCart.quantity}</span>
                      <button onClick={() => addToCart(item)} className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => addToCart(item)} className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                      <Plus className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {filteredItems.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Nenhum item nesta categoria.</p>
        )}
      </div>

      {/* Cart FAB */}
      {cartCount > 0 && !showCart && (
        <button
          onClick={() => setShowCart(true)}
          className="fixed bottom-4 left-4 right-4 bg-primary text-primary-foreground rounded-2xl py-4 px-6 flex items-center justify-between glow-orange z-50"
        >
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
                <div key={item.id} className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">R${item.price.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => removeFromCart(item.id)} className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-sm font-medium w-5 text-center">{item.quantity}</span>
                    <button onClick={() => addToCart(item)} className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
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
                    <button
                      key={item.id}
                      onClick={() => addToCart(item)}
                      className="w-full flex items-center justify-between p-2 rounded-xl bg-secondary/50 mb-2 hover:bg-secondary transition-colors"
                    >
                      <div className="text-left">
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-primary font-semibold">+ R${item.price.toFixed(2)}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}

              {/* Notes */}
              <div className="pt-3 border-t border-border">
                <label className="text-xs text-muted-foreground">Observações do pedido</label>
                <textarea
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  className="w-full mt-1 p-2 rounded-xl bg-secondary text-sm resize-none h-16 border-none outline-none"
                  placeholder="Sem wasabi, alergia a amendoim..."
                />
              </div>
            </div>

            <div className="p-4 border-t border-border">
              <div className="flex justify-between mb-3">
                <span className="font-medium">Total</span>
                <span className="font-display text-xl font-bold gradient-text">R${cartTotal.toFixed(2)}</span>
              </div>
              <Button variant="hero" className="w-full py-6 text-base" onClick={() => { setShowCart(false); setShowCheckout(true); }}>
                Finalizar Pedido
                <Send className="ml-2 w-4 h-4" />
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
                <span className="font-bold gradient-text">R${cartTotal.toFixed(2)}</span>
              </div>
              <Button variant="hero" className="w-full py-6 text-base" disabled={submitting}>
                {submitting ? "Enviando..." : "Enviar Pedido"}
                <Send className="ml-2 w-4 h-4" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicMenu;

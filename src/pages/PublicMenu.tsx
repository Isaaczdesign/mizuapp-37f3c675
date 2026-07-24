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
  AlertTriangle, Check, UtensilsCrossed, MapPin, Star, Truck, ShoppingBag, CreditCard, Search,
} from "lucide-react";
import { isOpenNow, nextOpenAt, formatCountdown } from "@/lib/operatingHours";

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
  delivery_fee: number | null; payment_methods: any; mp_enabled?: boolean;
}
type OrderType = "dine_in" | "pickup" | "delivery";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const onlinePaymentMinAmount = 1;
const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

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
  const navigate = useNavigate();
  const tableToken = searchParams.get("t");

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [tableId, setTableId] = useState<string | null>(null);
  const [tables, setTables] = useState<{ id: string; number: number }[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showCart, setShowCart] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(0); // 0=closed, 1=tipo, 2=infos, 3=pagamento, 4=revisão
  const [showItemDetail, setShowItemDetail] = useState<MenuItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [operatingHours, setOperatingHours] = useState<any>(null);

  // Order type + delivery + payment
  const [orderType, setOrderType] = useState<OrderType | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [deliveryCep, setDeliveryCep] = useState("");
  const [deliveryStreet, setDeliveryStreet] = useState("");
  const [deliveryNumber, setDeliveryNumber] = useState("");
  const [deliveryNeighborhood, setDeliveryNeighborhood] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [deliveryComplement, setDeliveryComplement] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [changeFor, setChangeFor] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [customerWhatsapp, setCustomerWhatsapp] = useState("");
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [orderNotes, setOrderNotes] = useState("");

  // Coupon state
  const [couponInput, setCouponInput] = useState("");
  const [couponValidating, setCouponValidating] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{ id: string; code: string; discount_type: string; discount_value: number; description: string | null } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  const [selectedVariation, setSelectedVariation] = useState<Variation | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<Addon[]>([]);
  const [detailQty, setDetailQty] = useState(1);

  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const categoryNavRef = useRef<HTMLDivElement>(null);
  const scrollObserver = useRef<IntersectionObserver | null>(null);

  useEffect(() => { loadMenu(); }, [slug]);

  // ── Saved customer data (localStorage, per restaurant, auto-expires) ──
  const [autofillEnabled, setAutofillEnabled] = useState(true);
  const [savedAddresses, setSavedAddresses] = useState<import("@/lib/publicMenuStorage").SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [hasSavedData, setHasSavedData] = useState(false);

  useEffect(() => {
    if (!slug) return;
    import("@/lib/publicMenuStorage").then(({ loadCustomerStorage }) => {
      const store = loadCustomerStorage(slug);
      if (!store) return;
      setHasSavedData(true);
      setAutofillEnabled(store.autofillEnabled);
      setSavedAddresses(store.addresses);
      if (store.autofillEnabled) {
        if (store.customerName) setCustomerName(store.customerName);
        if (store.customerWhatsapp) setCustomerWhatsapp(store.customerWhatsapp);
        setConsentMarketing(store.consentMarketing);
        // Pre-select the most recent address (list is stored newest-first)
        const first = store.addresses[0];
        if (first) {
          setSelectedAddressId(first.id);
          setDeliveryCep(first.cep);
          setDeliveryStreet(first.street);
          setDeliveryNumber(first.number);
          setDeliveryNeighborhood(first.neighborhood);
          setDeliveryCity(first.city);
          setDeliveryComplement(first.complement);
        }
      }
    });
  }, [slug]);


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
      if (table && table.restaurant_id === rest.id) {
        setTableId(table.id);
        setOrderType("dine_in");
      }
    }

    // Load public tables list (for dine-in without QR token)
    if (rest.dine_in_enabled) {
      const { data: tbls } = await (supabase as any).rpc("get_public_tables", { _restaurant_id: rest.id });
      if (Array.isArray(tbls)) setTables(tbls);
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

  const deliveryFeeApplied = orderType === "delivery" ? Number(restaurant?.delivery_fee ?? 0) : 0;
  const couponDiscount = useMemo(() => {
    if (!appliedCoupon) return 0;
    const d = appliedCoupon.discount_type === "percent"
      ? Math.round(cartTotal * (Number(appliedCoupon.discount_value) / 100) * 100) / 100
      : Math.min(Number(appliedCoupon.discount_value), cartTotal);
    return Math.max(0, d);
  }, [appliedCoupon, cartTotal]);
  const grandTotal = Math.max(0, cartTotal - couponDiscount) + deliveryFeeApplied;

  async function applyCouponCode() {
    if (!restaurant || !couponInput.trim()) return;
    setCouponValidating(true);
    setCouponError(null);
    try {
      const { data, error } = await (supabase as any).rpc("validate_public_coupon", {
        _restaurant_id: restaurant.id,
        _code: couponInput.trim(),
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.is_valid) {
        setAppliedCoupon(null);
        setCouponError(row?.reason || "Cupom inválido");
        toast.error(row?.reason || "Cupom inválido");
        return;
      }
      setAppliedCoupon({
        id: row.id, code: row.code, discount_type: row.discount_type,
        discount_value: Number(row.discount_value), description: row.description,
      });
      toast.success(`Cupom ${row.code} aplicado!`);
    } catch (e: any) {
      setCouponError(e.message || "Erro ao validar cupom");
      toast.error("Erro ao validar cupom");
    } finally {
      setCouponValidating(false);
    }
  }

  function removeCoupon() {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponError(null);
  }

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (!restaurant || !cart.length || !orderType) return;
    setSubmitting(true);
    try {
      const { data: customerId, error: custErr } = await supabase.rpc("find_or_create_customer", {
        _restaurant_id: restaurant.id,
        _name: customerName.trim(),
        _whatsapp: customerWhatsapp.trim(),
        _consent: consentMarketing,
      });
      if (custErr || !customerId) throw custErr ?? new Error("Falha ao registrar cliente");

      const deliveryAddress = orderType === "delivery" ? {
        cep: deliveryCep.replace(/\D/g, ""),
        street: deliveryStreet.trim(),
        number: deliveryNumber.trim(),
        neighborhood: deliveryNeighborhood.trim(),
        city: deliveryCity.trim(),
        complement: deliveryComplement.trim() || null,
      } : null;

      const itemsPayload = cart.map((item) => ({
        menu_item_id: item.menuItemId,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        notes: item.itemNotes || null,
      }));

      const orderTotal = roundCurrency(grandTotal);
      if (["pix", "credit_card_online"].includes(paymentMethod) && orderTotal < onlinePaymentMinAmount) {
        toast.error("Pagamento online exige pedido mínimo de R$ 1,00. Adicione mais itens ou escolha outra forma de pagamento.");
        return;
      }

      const { data: rpcData, error: orderErr } = await (supabase as any).rpc("create_public_order", {
        _restaurant_id: restaurant.id,
        _customer_id: customerId,
        _total: orderTotal,
        _notes: orderNotes || null,
        _order_type: orderType,
        _payment_method: paymentMethod,
        _payment_change_for: paymentMethod === "cash" && changeFor ? Number(changeFor) : null,
        _table_id: orderType === "dine_in" ? (tableId ?? selectedTableId) : null,
        _delivery_fee: deliveryFeeApplied,
        _delivery_address: deliveryAddress,
        _items: itemsPayload,
        _coupon_code: appliedCoupon?.code ?? null,
      });
      if (orderErr) throw orderErr;
      const created = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      if (!created?.tracking_token) throw new Error("Falha ao criar pedido");

      // If PIX online + restaurante tem Mercado Pago habilitado, dispara criação da cobrança
      if (paymentMethod === "pix" && (restaurant as any).mp_enabled) {
        try {
          await supabase.functions.invoke("create-mp-payment", {
            body: { tracking_token: created.tracking_token },
          });
        } catch (mpErr) {
          console.error("Falha ao criar cobrança PIX:", mpErr);
          toast.error("Pedido criado, mas não conseguimos gerar o PIX. Tente novamente na tela seguinte.");
        }
      }

      // Persist customer info for next order (no login needed).
      // Respect autofill preference; addresses are only saved for delivery.
      if (slug && autofillEnabled) {
        try {
          const { saveCustomerStorage, upsertAddress } = await import("@/lib/publicMenuStorage");
          let addresses = savedAddresses;
          if (orderType === "delivery" && deliveryCep && deliveryStreet && deliveryNumber) {
            addresses = upsertAddress(addresses, {
              cep: deliveryCep, street: deliveryStreet, number: deliveryNumber,
              neighborhood: deliveryNeighborhood, city: deliveryCity, complement: deliveryComplement,
            });
            setSavedAddresses(addresses);
          }
          saveCustomerStorage(slug, {
            v: 2, savedAt: Date.now(), autofillEnabled: true,
            customerName: customerName.trim(),
            customerWhatsapp: customerWhatsapp.trim(),
            consentMarketing,
            addresses,
          });
        } catch {}
      }

      setCart([]); setCheckoutStep(0); setShowCart(false);
      setOrderNotes("");
      navigate(`/pedido/${created.tracking_token}`);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao enviar pedido. Tente novamente. Seu carrinho está preservado.");
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

  const q = search.trim().toLowerCase();
  const matchesSearch = (i: MenuItem) =>
    !q ||
    i.name.toLowerCase().includes(q) ||
    (i.description ?? "").toLowerCase().includes(q) ||
    (i.ingredients ?? "").toLowerCase().includes(q) ||
    (i.tags ?? []).some((t) => t.toLowerCase().includes(q));
  const categorizedItems = categories.map((cat) => ({
    ...cat,
    items: items.filter((i) => i.category_id === cat.id && matchesSearch(i)),
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

      {(() => {
        const acceptingOff = (restaurant as any)?.accepting_orders === false;
        const outsideHours = !!operatingHours && !isOpenNow(operatingHours);
        if (!acceptingOff && !outsideHours) return null;
        const nextOpen = outsideHours ? nextOpenAt(operatingHours) : null;
        const countdown = nextOpen ? formatCountdown(nextOpen) : null;
        return (
          <div className="mx-4 mt-4 p-4 rounded-2xl border border-red-500/30 bg-red-500/10 text-sm">
            <div className="font-bold text-red-400 mb-1">Estabelecimento fechado</div>
            <div className="text-muted-foreground">
              {acceptingOff
                ? ((restaurant as any)?.closed_message || "O estabelecimento encerrou o atendimento e não está aceitando novos pedidos no momento.")
                : (countdown
                    ? <>Fora do horário de funcionamento. Reabre em <span className="font-semibold text-red-300">{countdown}</span>{nextOpen ? ` (${nextOpen.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "2-digit", minute: "2-digit" })})` : ""}.</>
                    : "Fora do horário de funcionamento. Novos pedidos serão aceitos no próximo horário de abertura.")}
            </div>
          </div>
        );
      })()}


      {/* ── Sticky Category Nav ── */}
      <div className="sticky top-0 z-40 mt-4 bg-background/90 backdrop-blur-xl border-b border-border">
        <div className="px-4 pt-2 pb-1">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar no cardápio..."
              className="w-full bg-secondary/60 rounded-full pl-9 pr-9 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-background/50"
                aria-label="Limpar busca"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
        {!search && (
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
        )}
      </div>

      {/* ── Items by Category ── */}
      <div className="px-4 pt-4">
        {categorizedItems.length === 0 && (
          <div className="text-center py-16">
            {search ? (
              <>
                <Search className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-display font-bold mb-1">Nenhum item encontrado</h3>
                <p className="text-sm text-muted-foreground">Tente outro termo ou limpe a busca.</p>
              </>
            ) : (
              <>
                <UtensilsCrossed className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-display font-bold mb-1">Cardápio em breve</h3>
                <p className="text-sm text-muted-foreground">Este restaurante ainda está preparando o cardápio.</p>
              </>
            )}
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
                {(() => {
                  const closed = (restaurant as any)?.accepting_orders === false || (!!operatingHours && !isOpenNow(operatingHours));
                  return (
                    <Button
                      className="w-full py-6 text-base rounded-2xl font-bold"
                      style={{ backgroundColor: accentColor }}
                      disabled={closed}
                      onClick={() => { setShowCart(false); setCheckoutStep(1); }}
                    >
                      {closed ? "Estabelecimento fechado" : (<>Ver pedido <ChevronRight className="w-4 h-4 ml-1" /></>)}
                    </Button>
                  );
                })()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Step-Based Checkout (4 steps) ── */}
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
              <div className="flex items-center gap-1.5 px-4 pb-3 border-b border-border overflow-x-auto">
                {["Tipo", "Infos", "Pagamento", "Revisão"].map((label, i) => (
                  <div key={i} className="flex items-center gap-1.5 shrink-0">
                    <div className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center transition-colors ${
                      checkoutStep > i + 1 ? "text-white" : checkoutStep === i + 1 ? "text-white" : "bg-secondary text-muted-foreground"
                    }`} style={checkoutStep >= i + 1 ? { backgroundColor: accentColor } : {}}>
                      {checkoutStep > i + 1 ? <Check className="w-3 h-3" /> : i + 1}
                    </div>
                    <span className={`text-xs font-medium ${checkoutStep === i + 1 ? "text-foreground" : "text-muted-foreground"}`}>
                      {label}
                    </span>
                    {i < 3 && <div className="w-4 h-px bg-border" />}
                  </div>
                ))}
              </div>

              {/* Step 1: Tipo de atendimento */}
              {checkoutStep === 1 && (
                <div className="p-4 space-y-3 overflow-y-auto flex-1">
                  <h3 className="font-display font-bold">Como deseja seu pedido?</h3>
                  {restaurant.dine_in_enabled && (
                    <button
                      onClick={() => { setOrderType("dine_in"); setCheckoutStep(2); }}
                      className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
                        orderType === "dine_in" ? "" : "border-border bg-secondary/40"
                      }`}
                      style={orderType === "dine_in" ? { borderColor: accentColor, backgroundColor: accentColor + "10" } : {}}
                    >
                      <UtensilsCrossed className="w-5 h-5" style={{ color: accentColor }} />
                      <div className="text-left">
                        <p className="font-medium text-sm">No local</p>
                        <p className="text-xs text-muted-foreground">Peça direto da mesa</p>
                      </div>
                    </button>
                  )}
                  {restaurant.pickup_enabled && (
                    <button
                      onClick={() => { setOrderType("pickup"); setCheckoutStep(2); }}
                      className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
                        orderType === "pickup" ? "" : "border-border bg-secondary/40"
                      }`}
                      style={orderType === "pickup" ? { borderColor: accentColor, backgroundColor: accentColor + "10" } : {}}
                    >
                      <ShoppingBag className="w-5 h-5" style={{ color: accentColor }} />
                      <div className="text-left">
                        <p className="font-medium text-sm">Retirada</p>
                        <p className="text-xs text-muted-foreground">Buscar no balcão</p>
                      </div>
                    </button>
                  )}
                  {restaurant.delivery_enabled && (
                    <button
                      onClick={() => { setOrderType("delivery"); setCheckoutStep(2); }}
                      className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
                        orderType === "delivery" ? "" : "border-border bg-secondary/40"
                      }`}
                      style={orderType === "delivery" ? { borderColor: accentColor, backgroundColor: accentColor + "10" } : {}}
                    >
                      <Truck className="w-5 h-5" style={{ color: accentColor }} />
                      <div className="text-left flex-1">
                        <p className="font-medium text-sm">Delivery</p>
                        <p className="text-xs text-muted-foreground">
                          Entrega em casa {restaurant.delivery_fee ? `· Taxa ${fmt(Number(restaurant.delivery_fee))}` : ""}
                        </p>
                      </div>
                    </button>
                  )}
                  {!restaurant.dine_in_enabled && !restaurant.pickup_enabled && !restaurant.delivery_enabled && (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum tipo de atendimento disponível.</p>
                  )}
                </div>
              )}

              {/* Step 2: Infos (customer + mesa/endereço) */}
              {checkoutStep === 2 && orderType && (
                <div className="p-4 space-y-4 overflow-y-auto flex-1">
                  {hasSavedData && (
                    <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-xs space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">
                          {autofillEnabled ? "✨ Dados salvos neste dispositivo" : "Preenchimento automático desativado"}
                          <span className="ml-1 opacity-70">· expira em 30 dias</span>
                        </span>
                        <button
                          type="button"
                          className="text-destructive hover:underline font-medium shrink-0"
                          onClick={async () => {
                            const { clearCustomerStorage } = await import("@/lib/publicMenuStorage");
                            clearCustomerStorage(slug);
                            setHasSavedData(false);
                            setSavedAddresses([]);
                            setSelectedAddressId(null);
                            setCustomerName(""); setCustomerWhatsapp(""); setConsentMarketing(false);
                            setDeliveryCep(""); setDeliveryStreet(""); setDeliveryNumber("");
                            setDeliveryNeighborhood(""); setDeliveryCity(""); setDeliveryComplement("");
                          }}
                        >
                          Apagar tudo
                        </button>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={autofillEnabled}
                          onChange={async (e) => {
                            const enabled = e.target.checked;
                            setAutofillEnabled(enabled);
                            const { saveCustomerStorage } = await import("@/lib/publicMenuStorage");
                            saveCustomerStorage(slug, {
                              v: 2, savedAt: Date.now(),
                              autofillEnabled: enabled,
                              customerName: enabled ? customerName.trim() : "",
                              customerWhatsapp: enabled ? customerWhatsapp.trim() : "",
                              consentMarketing: enabled ? consentMarketing : false,
                              addresses: enabled ? savedAddresses : [],
                            });
                          }}
                          className="rounded"
                          style={{ accentColor }}
                        />
                        <span className="text-muted-foreground">Preencher automaticamente meus dados neste dispositivo</span>
                      </label>
                    </div>
                  )}
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

                  {orderType === "dine_in" && !tableId && (
                    <div>
                      <label className="text-sm font-medium">Mesa *</label>
                      {tables.length > 0 ? (
                        <div className="grid grid-cols-4 gap-2 mt-2">
                          {tables.map((t) => (
                            <button key={t.id} type="button"
                              onClick={() => setSelectedTableId(t.id)}
                              className={`py-2 rounded-lg text-sm font-medium border transition-all ${
                                selectedTableId === t.id ? "text-white" : "bg-secondary border-border"
                              }`}
                              style={selectedTableId === t.id ? { backgroundColor: accentColor, borderColor: accentColor } : {}}
                            >
                              {t.number}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1">Nenhuma mesa cadastrada.</p>
                      )}
                    </div>
                  )}
                  {orderType === "dine_in" && tableId && (
                    <div className="p-3 rounded-xl bg-secondary/50 text-sm">
                      🍽️ Mesa identificada via QR Code
                    </div>
                  )}

                  {orderType === "delivery" && (
                    <div className="space-y-3">
                      {savedAddresses.length > 0 && (
                        <div>
                          <label className="text-xs font-medium">Endereços salvos</label>
                          <div className="mt-1 space-y-1.5">
                            {savedAddresses.map((a) => {
                              const active = selectedAddressId === a.id;
                              return (
                                <div
                                  key={a.id}
                                  className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition ${
                                    active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                                  }`}
                                  onClick={() => {
                                    setSelectedAddressId(a.id);
                                    setDeliveryCep(a.cep); setDeliveryStreet(a.street);
                                    setDeliveryNumber(a.number); setDeliveryNeighborhood(a.neighborhood);
                                    setDeliveryCity(a.city); setDeliveryComplement(a.complement);
                                  }}
                                >
                                  <div className="min-w-0">
                                    <p className="font-medium truncate">{a.label}</p>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {[a.neighborhood, a.city].filter(Boolean).join(" · ")}
                                      {a.complement ? ` · ${a.complement}` : ""}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    className="text-xs text-destructive hover:underline shrink-0"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      const { removeAddress, saveCustomerStorage } = await import("@/lib/publicMenuStorage");
                                      const next = removeAddress(savedAddresses, a.id);
                                      setSavedAddresses(next);
                                      if (selectedAddressId === a.id) {
                                        setSelectedAddressId(null);
                                        setDeliveryCep(""); setDeliveryStreet(""); setDeliveryNumber("");
                                        setDeliveryNeighborhood(""); setDeliveryCity(""); setDeliveryComplement("");
                                      }
                                      saveCustomerStorage(slug, {
                                        v: 2, savedAt: Date.now(),
                                        autofillEnabled,
                                        customerName: customerName.trim(),
                                        customerWhatsapp: customerWhatsapp.trim(),
                                        consentMarketing,
                                        addresses: next,
                                      });
                                    }}
                                  >
                                    Remover
                                  </button>
                                </div>
                              );
                            })}
                            <button
                              type="button"
                              className={`w-full text-left rounded-lg border border-dashed px-3 py-2 text-sm transition ${
                                selectedAddressId === null ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                              }`}
                              onClick={() => {
                                setSelectedAddressId(null);
                                setDeliveryCep(""); setDeliveryStreet(""); setDeliveryNumber("");
                                setDeliveryNeighborhood(""); setDeliveryCity(""); setDeliveryComplement("");
                              }}
                            >
                              + Novo endereço
                            </button>
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="text-xs font-medium">CEP *</label>
                        <Input
                          value={deliveryCep}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                            setDeliveryCep(digits.length > 5 ? `${digits.slice(0,5)}-${digits.slice(5)}` : digits);
                            if (digits.length === 8) {
                              fetch(`https://viacep.com.br/ws/${digits}/json/`)
                                .then((r) => r.json())
                                .then((d) => {
                                  if (d?.erro) { toast.error("CEP não encontrado"); return; }
                                  if (d.logradouro && !deliveryStreet) setDeliveryStreet(d.logradouro);
                                  if (d.bairro) setDeliveryNeighborhood(d.bairro);
                                  if (d.localidade) setDeliveryCity(d.localidade);
                                })
                                .catch(() => {});
                            }
                          }}
                          required
                          inputMode="numeric"
                          placeholder="00000-000"
                          className="mt-1"
                        />
                        {deliveryCep && deliveryCep.replace(/\D/g, "").length !== 8 && (
                          <p className="text-[11px] text-destructive mt-1">CEP deve ter 8 dígitos</p>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                          <label className="text-xs font-medium">Rua *</label>
                          <Input value={deliveryStreet} onChange={(e) => setDeliveryStreet(e.target.value)} required placeholder="Rua" className="mt-1" />
                        </div>
                        <div>
                          <label className="text-xs font-medium">Nº *</label>
                          <Input value={deliveryNumber} onChange={(e) => setDeliveryNumber(e.target.value)} required inputMode="numeric" placeholder="123" className="mt-1" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium">Bairro *</label>
                        <Input value={deliveryNeighborhood} onChange={(e) => setDeliveryNeighborhood(e.target.value)} required placeholder="Bairro" className="mt-1" />
                      </div>
                      <div>
                        <label className="text-xs font-medium">Cidade *</label>
                        <Input value={deliveryCity} onChange={(e) => setDeliveryCity(e.target.value)} required placeholder="Cidade" className="mt-1" />
                      </div>
                      <div>
                        <label className="text-xs font-medium">Complemento</label>
                        <Input value={deliveryComplement} onChange={(e) => setDeliveryComplement(e.target.value)} placeholder="Apto, referência, ponto de apoio..." className="mt-1" />
                      </div>
                    </div>
                  )}

                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input type="checkbox" checked={consentMarketing} onChange={(e) => setConsentMarketing(e.target.checked)}
                      className="rounded" style={{ accentColor }} />
                    Aceito receber promoções por WhatsApp
                  </label>

                  <div className="flex gap-2 pt-2">
                    <Button type="button" variant="outline" className="flex-1 py-6 rounded-2xl" onClick={() => setCheckoutStep(1)}>
                      Voltar
                    </Button>
                    <Button
                      className="flex-1 py-6 rounded-2xl font-bold"
                      style={{ backgroundColor: accentColor }}
                      disabled={
                        !customerName.trim() || !customerWhatsapp.trim() ||
                        (orderType === "dine_in" && !tableId && !selectedTableId) ||
                        (orderType === "delivery" && (deliveryCep.replace(/\D/g,"").length !== 8 || !deliveryStreet.trim() || !deliveryNumber.trim() || !deliveryNeighborhood.trim() || !deliveryCity.trim()))
                      }
                      onClick={() => {
                        if (orderType === "dine_in") {
                          setPaymentMethod("pay_at_place");
                          setCheckoutStep(4);
                        } else {
                          setCheckoutStep(3);
                        }
                      }}
                    >
                      Continuar
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Pagamento */}
              {checkoutStep === 3 && (
                <div className="p-4 space-y-3 overflow-y-auto flex-1">
                  <h3 className="font-display font-bold">Forma de pagamento</h3>
                  {(() => {
                    const pm = restaurant.payment_methods;
                    const mpOn = Boolean((restaurant as any).mp_enabled);
                    const canUseOnlinePayment = grandTotal >= onlinePaymentMinAmount;
                    const available: { key: string; label: string; hint?: string }[] = [];
                    const enabled = (k: string) =>
                      Array.isArray(pm) ? pm.includes(k) : pm && typeof pm === "object" ? Boolean(pm[k]) : true;
                    if (enabled("pix")) available.push({ key: "pix", label: mpOn ? "PIX (online)" : "PIX", hint: mpOn ? (canUseOnlinePayment ? "QR Code na próxima tela" : "Mínimo R$ 1,00") : undefined });
                    if (mpOn) available.push({ key: "credit_card_online", label: "Cartão de Crédito (online)", hint: canUseOnlinePayment ? "até 3x sem juros" : "Mínimo R$ 1,00" });
                    if (enabled("credit_card") || enabled("card")) available.push({ key: "credit_card", label: "Cartão de Crédito (no local)" });
                    if (enabled("debit_card")) available.push({ key: "debit_card", label: "Cartão de Débito (no local)" });
                    if (enabled("cash")) available.push({ key: "cash", label: "Dinheiro" });
                    if (available.length === 0) {
                      available.push({ key: "pix", label: "PIX" }, { key: "cash", label: "Dinheiro" });
                    }
                    return available.map((p) => (
                      <button key={p.key} type="button"
                        onClick={() => setPaymentMethod(p.key)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                          paymentMethod === p.key ? "" : "border-border bg-secondary/40"
                        }`}
                        style={paymentMethod === p.key ? { borderColor: accentColor, backgroundColor: accentColor + "10" } : {}}
                      >
                        <CreditCard className="w-4 h-4" style={{ color: accentColor }} />
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium">{p.label}</p>
                          {p.hint && <p className="text-[10px] text-muted-foreground">{p.hint}</p>}
                        </div>
                      </button>
                    ));
                  })()}

                  {paymentMethod === "cash" && (
                    <div>
                      <label className="text-xs font-medium">Precisa de troco para quanto? (opcional)</label>
                      <Input value={changeFor} onChange={(e) => setChangeFor(e.target.value)}
                        type="number" step="0.01" placeholder="Ex: 100.00" className="mt-1" />
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button type="button" variant="outline" className="flex-1 py-6 rounded-2xl" onClick={() => setCheckoutStep(2)}>
                      Voltar
                    </Button>
                    <Button
                      className="flex-1 py-6 rounded-2xl font-bold"
                      style={{ backgroundColor: accentColor }}
                      disabled={!paymentMethod}
                      onClick={() => setCheckoutStep(4)}
                    >
                      Revisar
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 4: Revisão */}
              {checkoutStep === 4 && (
                <form onSubmit={handleCheckout} className="p-4 space-y-4 overflow-y-auto flex-1">
                  <div className="space-y-2">
                    {cart.map((item) => (
                      <div key={item.cartKey} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{item.quantity}× {item.name}</span>
                        <span className="font-medium">{fmt(item.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                  {/* Coupon */}
                  <div className="border-t border-border pt-3">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1.5">🎟️ Cupom de desconto</label>
                    {appliedCoupon ? (
                      <motion.div
                        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        className="flex items-center justify-between p-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10">
                        <div className="flex items-center gap-2 min-w-0">
                          <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                          <div className="min-w-0">
                            <div className="font-mono font-bold text-sm truncate">{appliedCoupon.code}</div>
                            <div className="text-[11px] text-muted-foreground truncate">
                              {appliedCoupon.discount_type === "percent"
                                ? `${appliedCoupon.discount_value}% de desconto`
                                : `${fmt(appliedCoupon.discount_value)} de desconto`}
                              {appliedCoupon.description ? ` · ${appliedCoupon.description}` : ""}
                            </div>
                          </div>
                        </div>
                        <button type="button" onClick={removeCoupon} className="text-muted-foreground hover:text-destructive p-1 rounded-md transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          value={couponInput}
                          onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(null); }}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyCouponCode(); } }}
                          placeholder="Digite o código"
                          className="flex-1 font-mono uppercase tracking-wider"
                          maxLength={40}
                        />
                        <Button type="button" onClick={applyCouponCode}
                          disabled={couponValidating || !couponInput.trim()}
                          className="px-4 rounded-xl" style={{ backgroundColor: accentColor }}>
                          {couponValidating ? "..." : "Aplicar"}
                        </Button>
                      </div>
                    )}
                    <AnimatePresence>
                      {couponError && !appliedCoupon && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          className="text-xs text-destructive mt-1.5 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> {couponError}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="border-t border-border pt-3 space-y-1 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span><span>{fmt(cartTotal)}</span>
                    </div>
                    {couponDiscount > 0 && (
                      <motion.div
                        initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                        className="flex justify-between text-emerald-500 font-medium">
                        <span>Desconto ({appliedCoupon?.code})</span><span>-{fmt(couponDiscount)}</span>
                      </motion.div>
                    )}
                    {deliveryFeeApplied > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Taxa de entrega</span><span>{fmt(deliveryFeeApplied)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-1">
                      <span className="font-bold">Total</span>
                      <span className="font-display text-xl font-bold" style={{ color: accentColor }}>{fmt(grandTotal)}</span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1 border-t border-border pt-3">
                    <p>👤 {customerName} · 📱 {customerWhatsapp}</p>
                    <p>
                      {orderType === "dine_in" && `🍽️ Mesa ${tables.find(t => t.id === (tableId ?? selectedTableId))?.number ?? ""}`}
                      {orderType === "pickup" && `🛍️ Retirada`}
                      {orderType === "delivery" && `🛵 ${deliveryStreet}, ${deliveryNumber} — ${deliveryNeighborhood}`}
                    </p>
                    <p>💳 {orderType === "dine_in" ? "Pagamento no local (mesa)" : paymentMethod?.replace("_", " ")}{paymentMethod === "cash" && changeFor ? ` · troco p/ ${fmt(Number(changeFor))}` : ""}</p>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Observações</label>
                    <textarea value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)}
                      className="w-full mt-1 p-3 rounded-xl bg-secondary text-sm resize-none h-16 border-none outline-none"
                      placeholder="Sem wasabi, alergia a amendoim..." />
                  </div>

                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="flex-1 py-6 rounded-2xl" onClick={() => setCheckoutStep(orderType === "dine_in" ? 2 : 3)}>
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

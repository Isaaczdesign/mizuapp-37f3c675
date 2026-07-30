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
  AlertTriangle, Check, UtensilsCrossed, MapPin, Star, Truck, ShoppingBag, CreditCard, Search, ClipboardList,
  QrCode, Banknote, Ticket, StickyNote,
} from "lucide-react";
import RecoverOrdersByWhatsapp from "@/components/RecoverOrdersByWhatsapp";
import { isOpenNow, nextOpenAt, formatCountdown } from "@/lib/operatingHours";
import { paymentMethodLabel, resolveStoredPaymentMethod } from "@/lib/paymentMethods";
import MenuItemCard from "@/components/public-menu/MenuItemCard";
import { resolveMenuTheme } from "@/lib/menuThemes";
import { RestaurantHero, MenuStickyBar, FloatingCartBar } from "@/components/public-menu/PublicMenuChrome";
import { ClosedNotice } from "@/components/public-menu/ClosedNotice";
import { subscribeMenuUpdates } from "@/lib/menuRealtime";
import MenuSidebar from "@/components/public-menu/MenuSidebar";
import ProductDetailSheet from "@/components/public-menu/ProductDetailSheet";
import EmptyState from "@/components/public-menu/EmptyState";
import MenuSkeleton from "@/components/public-menu/MenuSkeletons";
import OptionCard from "@/components/public-menu/OptionCard";
import {
  BG_CARD, BORDER, R_CARD_SM, R_FIELD, R_BUTTON, R_TILE, ICON_SM, ICON_STROKE,
  TEXT_SECONDARY, TEXT_TERTIARY,
  SELECTABLE_BASE, SELECTABLE_IDLE, selectedSurface, selectedTileStyle,
  TOUCH,
  TOUCH_ROW,
  TOUCH_ICON,
  SHEET_PAD,
} from "@/components/public-menu/menuTokens";
import { useSheetViewport, useKeyboardFocusScroll, useVisualViewport } from "@/hooks/useSheetViewport";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { AutoResizeTextarea } from "@/components/public-menu/AutoResizeTextarea";






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
  variationName?: string; variationId?: string | null; addonIds?: string[];
  selectedAddons: { name: string; price: number }[];
  image_url: string | null; itemNotes?: string;
}
interface Category { id: string; name: string; sort_order: number; }
interface Restaurant {
  id: string; name: string; logo_url: string | null; primary_color: string | null;
  banner_url: string | null; description: string | null; pickup_dine_in_note: string | null;
  owner_phone: string | null; upsell_item_ids: string[] | null;
  pickup_enabled: boolean; dine_in_enabled: boolean; delivery_enabled: boolean;
  delivery_fee: number | null; payment_methods: any; mp_enabled?: boolean; menu_theme?: string | null;
}
type OrderType = "dine_in" | "pickup" | "delivery";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const onlinePaymentMinAmount = 1;
const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

// Badges de tag e card de item vivem em @/components/public-menu/MenuItemCard


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
  const [clockTick, setClockTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setClockTick((n) => n + 1), 30_000); return () => clearInterval(t); }, []);

  const [showItemDetail, setShowItemDetail] = useState<MenuItem | null>(null);
  const [loading, setLoading] = useState(true);
  const sheetViewport = useSheetViewport(showCart || checkoutStep > 0);
  useKeyboardFocusScroll(showCart || checkoutStep > 0);
  const { keyboardInset } = useVisualViewport();
  const keyboardOpen = keyboardInset > 120;
  const closeCheckout = useCallback(() => setCheckoutStep(0), []);
  const closeCart = useCallback(() => setShowCart(false), []);
  const checkoutTrapRef = useFocusTrap<HTMLDivElement>(checkoutStep > 0, closeCheckout);
  const cartTrapRef = useFocusTrap<HTMLDivElement>(showCart, closeCart);
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<null | { token: string }>(null);
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

  // ── Active orders (so the customer can go back to tracking) ──
  const [activeOrders, setActiveOrders] = useState<{ token: string; status?: string | null }[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { loadActiveOrders, saveRecentOrder, removeRecentOrder, TERMINAL_ORDER_STATUSES } =
        await import("@/lib/publicMenuStorage");
      const stored = loadActiveOrders(slug);
      if (!stored.length) { if (!cancelled) setActiveOrders([]); return; }
      const refreshed = await Promise.all(
        stored.map(async (o) => {
          try {
            const { data } = await (supabase as any).rpc("get_public_order", { _token: o.token });
            const row = Array.isArray(data) ? data[0] : data;
            if (!row) { removeRecentOrder(o.token); return null; }
            saveRecentOrder({ token: o.token, status: row.status, slug: row.restaurant_slug ?? o.slug });
            if (TERMINAL_ORDER_STATUSES.includes(String(row.status))) return null;
            return { token: o.token, status: row.status as string };
          } catch {
            return { token: o.token, status: o.status };
          }
        })
      );
      if (!cancelled) setActiveOrders(refreshed.filter(Boolean) as { token: string; status?: string | null }[]);
    })();
    return () => { cancelled = true; };
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

  const accentColor = restaurant?.primary_color ?? "#E84310";
  const menuTheme = resolveMenuTheme(restaurant?.menu_theme);
  // status do hero acompanha o tick de relógio (30s)
  const openStatus = useMemo(() => getOpenStatus(operatingHours), [operatingHours, clockTick]);

  // ── Sincronização com o painel (backend = fonte da verdade) ──
  // Revalida configurações (horários, aceitar pedidos, tema, taxas...) sem recarregar o cardápio inteiro.
  const refreshingRef = useRef(false);
  const refreshSettings = useCallback(async () => {
    if (!slug || refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      const { data } = await (supabase as any).rpc("get_public_restaurant_by_slug", { _slug: slug });
      const rest = Array.isArray(data) ? data[0] : data;
      if (!rest) return;
      setRestaurant((prev) => (prev ? { ...prev, ...rest } : (rest as any)));
      setOperatingHours((prev: any) =>
        JSON.stringify(prev ?? null) === JSON.stringify(rest.operating_hours ?? null) ? prev : rest.operating_hours ?? null,
      );
      setClockTick((t) => t + 1);
    } finally {
      refreshingRef.current = false;
    }
  }, [slug]);

  // Fallback: revalida a cada 5 min e sempre que a aba volta ao foco / reconecta
  useEffect(() => {
    if (!slug) return;
    const id = setInterval(refreshSettings, 300_000);
    const onFocus = () => { if (document.visibilityState === "visible") refreshSettings(); };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
    };
  }, [slug, refreshSettings]);

  // Tempo real: o painel avisa (broadcast via WebSocket) assim que muda horário,
  // status de "aceitando pedidos" ou expediente — revalida na hora.
  useEffect(() => {
    const rid = restaurant?.id;
    if (!rid) return;
    let cancelled = false;
    const unsubscribe = subscribeMenuUpdates(rid, (reason) => {
      if (cancelled) return;
      if (reason === "menu") { loadMenu(); return; }
      refreshSettings();
    });
    return () => { cancelled = true; unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant?.id, refreshSettings]);

  // Agenda uma revalidação exata no instante da próxima abertura/fechamento
  useEffect(() => {
    if (!operatingHours) return;
    const next = nextOpenAt(operatingHours as any, new Date());
    if (!next) return;
    const ms = next.getTime() - Date.now();
    if (ms <= 0 || ms > 24 * 60 * 60 * 1000) return;
    const t = setTimeout(() => { refreshSettings(); }, ms + 1500);
    return () => clearTimeout(t);
  }, [operatingHours, clockTick, refreshSettings]);


  // chamado quando o horário de reabertura chega: confirma no backend antes de liberar pedidos
  const reopenLockRef = useRef(false);
  const handleReopen = useCallback(async () => {
    if (reopenLockRef.current) return;
    reopenLockRef.current = true;
    await refreshSettings();
    await loadMenu();
    // libera novamente após um intervalo curto (caso o backend ainda indique fechado)
    setTimeout(() => { reopenLockRef.current = false; }, 30_000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSettings]);




  // ── Upsell (rule engine) ──
  type UpsellSuggestion = {
    item: MenuItem;
    reason: "combo" | "temaki_drink" | "high_margin" | "manual";
    label: string;
    emoji: string;
    accent: string;
  };
  const DRINK_RX = /(bebida|drink|refri|refrigerante|suco|água|agua|cerveja|chá|cha|coca|guaraná|guarana|heineken|sake)/i;
  const TEMAKI_RX = /temaki/i;
  const upsellItems = useMemo<UpsellSuggestion[]>(() => {
    if (!cart.length) return [];
    const cartIds = new Set(cart.map((i) => i.menuItemId));
    const catMap = new Map(categories.map((c) => [c.id, c.name] as const));
    const isDrink = (it: MenuItem) =>
      DRINK_RX.test(it.name) || DRINK_RX.test(catMap.get(it.category_id) ?? "");
    const suggestions: UpsellSuggestion[] = [];
    const seen = new Set<string>();
    const push = (s: UpsellSuggestion) => {
      if (seen.has(s.item.id) || cartIds.has(s.item.id)) return;
      seen.add(s.item.id);
      suggestions.push(s);
    };

    // Rule 1 — manual upsell list defined by the owner
    (restaurant?.upsell_item_ids ?? []).forEach((uid) => {
      const item = items.find((i) => i.id === uid);
      if (!item) return;
      push({ item, reason: "manual", label: "Recomendado pra você", emoji: "⭐", accent: "#FFB300" });
    });

    // Rule 2 — combo tag
    items.forEach((it) => {
      if ((it.tags ?? []).includes("combo")) {
        push({ item: it, reason: "combo", label: "Vira combo!", emoji: "🎁", accent: "#E91E63" });
      }
    });

    // Rule 3 — temaki → bebida
    const hasTemaki = cart.some((c) => TEMAKI_RX.test(c.name));
    const hasDrink = cart.some((c) => {
      const it = items.find((i) => i.id === c.menuItemId);
      return it ? isDrink(it) : DRINK_RX.test(c.name);
    });
    if (hasTemaki && !hasDrink) {
      const drink = items.find((i) => isDrink(i));
      if (drink) push({ item: drink, reason: "temaki_drink", label: "Combina com temaki", emoji: "🥤", accent: "#00B8D4" });
    }

    // Rule 4 — high margin fallback
    items.forEach((it) => {
      if (suggestions.length >= 3) return;
      if ((it.tags ?? []).includes("high_margin")) {
        push({ item: it, reason: "high_margin", label: "Destaque da casa", emoji: "💎", accent: "#7C4DFF" });
      }
    });

    return suggestions.slice(0, 3);
  }, [cart, items, restaurant, categories]);

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
        variationId: selectedVariation?.id ?? null,
        addonIds: selectedAddons.map((a) => a.id),
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

      // Preço é recalculado no servidor a partir do cardápio; enviamos apenas as escolhas.
      const itemsPayload = cart.map((item) => ({
        menu_item_id: item.menuItemId,
        quantity: item.quantity,
        variation_id: item.variationId ?? null,
        addon_ids: item.addonIds ?? [],
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
        _payment_method: resolveStoredPaymentMethod(paymentMethod, orderType),
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
      try {
        const { saveRecentOrder } = await import("@/lib/publicMenuStorage");
        saveRecentOrder({ token: created.tracking_token, status: "new", slug: slug ?? null });
      } catch {}
      setOrderSuccess({ token: created.tracking_token });
      setTimeout(() => navigate(`/pedido/${created.tracking_token}`), 2200);
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

  const categoryCounts = categorizedItems.map((c) => ({ id: c.id, name: c.name, count: c.items.length }));

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-[#080909] text-[#F7F7F5] lg:flex">
      {/* ── Desktop: sidebar fixa ── */}
      <MenuSidebar
        name={restaurant.name}
        description={restaurant.description}
        logoUrl={restaurant.logo_url}
        accentColor={accentColor}
        isOpen={openStatus.isOpen}
        statusLabel={openStatus.label}
        deliveryEnabled={restaurant.delivery_enabled}
        deliveryFee={restaurant.delivery_fee}
        ownerPhone={restaurant.owner_phone}
        search={search}
        onSearch={setSearch}
        categories={categoryCounts}
        activeCategory={activeCategory}
        onCategory={scrollToCategory}
        cartCount={cartCount}
        cartTotal={cartTotal}
        onOpenCart={() => setShowCart(true)}
      />

      <main className="flex-1 min-w-0 pb-32 lg:pb-16">
      {/* ── Hero (mobile e tablet) ── */}
      <div className="lg:hidden">
      <RestaurantHero
        name={restaurant.name}
        description={restaurant.description}
        logoUrl={restaurant.logo_url}
        bannerUrl={restaurant.banner_url}
        accentColor={accentColor}
        isOpen={openStatus.isOpen}
        statusLabel={openStatus.label}
        deliveryEnabled={restaurant.delivery_enabled}
        deliveryFee={restaurant.delivery_fee}
        ownerPhone={restaurant.owner_phone}
      />
      </div>

      {/* ── Desktop: banner de capa ── */}
      {restaurant.banner_url && (
        <div className="hidden lg:block px-8 pt-8">
          <div className="relative h-56 xl:h-64 rounded-[22px] overflow-hidden border border-white/[0.07]">
            <img src={restaurant.banner_url} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#080909]/85 via-[#080909]/25 to-transparent" />
            <div className="absolute bottom-5 left-6 right-6">
              <h2 className="font-display text-2xl xl:text-[28px] font-bold tracking-tight">{restaurant.name}</h2>
              {restaurant.description && (
                <p className="mt-1 text-[13.5px] text-[#A5A5A0] line-clamp-1 max-w-2xl">{restaurant.description}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <ClosedNotice
        operatingHours={operatingHours as any}
        acceptingOff={(restaurant as any)?.accepting_orders === false}
        closedMessage={(restaurant as any)?.closed_message}
        onReopen={handleReopen}
      />



      {/* Ícone flutuante para recuperar pedido pelo WhatsApp */}
      <RecoverOrdersByWhatsapp restaurantId={restaurant.id} restaurantSlug={(restaurant as any).slug ?? null} accentColor={accentColor} />

      {activeOrders.length > 0 && (
        <div className="px-4 mt-4 space-y-2">
          {activeOrders.map((o) => (
            <button
              key={o.token}
              onClick={() => navigate(`/pedido/${o.token}`)}
              className="w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-transform active:scale-[0.98]"
              style={{ borderColor: `${accentColor}55`, background: `${accentColor}12` }}
            >
              <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${accentColor}25` }}>
                <ClipboardList className="w-4 h-4" style={{ color: accentColor }} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold">Você tem um pedido em andamento</span>
                <span className="block text-xs text-muted-foreground">Toque para voltar ao acompanhamento</span>
              </span>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}

      <MenuStickyBar
        className="lg:hidden"
        search={search}
        onSearch={setSearch}
        categories={categories}
        activeCategory={activeCategory}
        onCategory={scrollToCategory}
        accentColor={accentColor}
      />


      {/* ── Items by Category ── */}
      <div className="max-w-3xl lg:max-w-none mx-auto px-4 sm:px-6 lg:px-8 pt-6 lg:pt-8">
        {categorizedItems.length === 0 && (
          <div className="py-16">
            {search ? (
              <EmptyState
                icon={<Search className="w-6 h-6" />}
                title="Nenhum item encontrado"
                description={`Não achamos nada para “${search}”. Tente outro termo ou veja o cardápio completo.`}
                actionLabel="Limpar busca"
                onAction={() => setSearch("")}
                accentColor={accentColor}
              />
            ) : (
              <EmptyState
                icon={<UtensilsCrossed className="w-6 h-6" />}
                title="Cardápio em breve"
                description="Este restaurante ainda está preparando os pratos. Volte em instantes."
                accentColor={accentColor}
              />
            )}
          </div>
        )}

        {categorizedItems.map((cat) => (
          <div
            key={cat.id}
            ref={(el) => { categoryRefs.current[cat.id] = el; }}
            data-cat-id={cat.id}
            className="mb-10 lg:mb-12 scroll-mt-[calc(var(--menu-sticky-h,112px)+12px)] lg:scroll-mt-6"
          >
            <div className="sticky top-[var(--menu-sticky-h,112px)] lg:top-0 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 pt-3 pb-2.5 lg:pt-5 lg:pb-3 mb-4 bg-[#080909] border-b border-white/[0.05]">

              <div className="flex items-baseline gap-3">
                <h2 className={menuTheme.categoryTitleClass}>{cat.name}</h2>
                <span className="text-[11.5px] tabular-nums text-[#74746F]">
                  {cat.items.length} {cat.items.length === 1 ? "item" : "itens"}
                </span>
              </div>
              <span className="mt-2 block h-px w-14 rounded-full" style={{ backgroundColor: accentColor + "66" }} />
              <span aria-hidden className="pointer-events-none absolute inset-x-0 top-full h-4 bg-gradient-to-b from-[#080909] to-transparent" />
            </div>



            <div className={menuTheme.listClass}>
              {cat.items.map((item, idx) => {

                const inCart = cart.filter((c) => c.menuItemId === item.id).reduce((s, c) => s + c.quantity, 0);
                return (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    theme={menuTheme}
                    accentColor={accentColor}
                    inCart={inCart}
                    index={idx}
                    onClick={() => openItemDetail(item)}
                  />
                );
              })}
            </div>

          </div>
        ))}
      </div>

      </main>

      {/* ── Detalhe do produto ── */}
      <AnimatePresence>
        {showItemDetail && (
          <ProductDetailSheet
            item={showItemDetail}
            accentColor={accentColor}
            selectedVariation={selectedVariation}
            onSelectVariation={setSelectedVariation}
            selectedAddons={selectedAddons}
            onToggleAddon={(a) =>
              setSelectedAddons((prev) =>
                prev.find((sa) => sa.id === a.id) ? prev.filter((sa) => sa.id !== a.id) : [...prev, a],
              )
            }
            qty={detailQty}
            onQty={setDetailQty}
            onClose={() => setShowItemDetail(null)}
            onAdd={addToCartFromDetail}
          />
        )}
      </AnimatePresence>

      {/* ── Floating Cart Bar ── */}
      <AnimatePresence>
        {cartCount > 0 && !showCart && !showItemDetail && checkoutStep === 0 && (
          <FloatingCartBar
            count={cartCount}
            total={cartTotal}
            accentColor={accentColor}
            onClick={() => setShowCart(true)}
          />
        )}
      </AnimatePresence>


      {/* ── Cart Drawer ── */}
      <AnimatePresence>
        {showCart && (
          <motion.div
            role="dialog" aria-modal="true" aria-label="Seu pedido"
            style={sheetViewport}
            className="z-50 flex flex-col overflow-hidden lg:flex-row lg:justify-end">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80"
              style={{ height: "100lvh", minHeight: "100vh", backdropFilter: "blur(20px) saturate(120%)", WebkitBackdropFilter: "blur(20px) saturate(120%)" }}
              onClick={() => setShowCart(false)} />

            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              ref={cartTrapRef}
              className={`relative bg-[#131414] border-t lg:border-t-0 lg:border-l border-white/[0.08] rounded-t-[24px] lg:rounded-none ${keyboardOpen ? "mt-0 h-full max-h-full rounded-t-none" : "mt-auto max-h-[88%]"} lg:max-h-none lg:h-full lg:mt-0 lg:w-[420px] flex flex-col shadow-[0_-24px_60px_rgba(0,0,0,0.5)]`}
            >
              <div className="flex justify-center pt-3 pb-1 lg:hidden">
                <div className="w-10 h-1 rounded-full bg-white/25" />
              </div>
              <div className="flex items-center justify-between px-4 pt-1 pb-3 lg:pt-4 border-b border-white/[0.06]">
                <h2 className="font-display text-lg font-bold">Seu Pedido</h2>
                <button onClick={() => setShowCart(false)} aria-label="Fechar carrinho" className={`w-10 h-10 ${R_TILE} bg-white/[0.06] ${BORDER} flex items-center justify-center transition-colors hover:bg-white/[0.1]`}>
                  <X className={ICON_SM} strokeWidth={ICON_STROKE} />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 px-4 pt-4 pb-2 space-y-3">
                {cart.map((item) => (
                  <div
                    key={item.cartKey}
                    className={`flex items-center gap-3 p-3 ${R_CARD_SM} ${SELECTABLE_BASE} ${SELECTABLE_IDLE}`}
                  >
                    {item.image_url && (
                      <img src={item.image_url} alt="" className={`w-12 h-12 ${R_TILE} object-cover shrink-0`} />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      {item.selectedAddons.length > 0 && (
                        <p className={`text-[10px] ${TEXT_TERTIARY}`}>+ {item.selectedAddons.map((a) => a.name).join(", ")}</p>
                      )}
                      <p className="text-xs font-medium mt-0.5" style={{ color: accentColor }}>{fmt(item.price)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => removeFromCart(item.cartKey)} aria-label="Remover uma unidade" className={`w-9 h-9 rounded-xl bg-white/[0.06] ${BORDER} flex items-center justify-center transition-colors hover:bg-white/[0.1]`}>
                        <Minus className="w-3.5 h-3.5" strokeWidth={ICON_STROKE} />
                      </button>
                      <span className="text-sm font-bold w-6 text-center tabular-nums">{item.quantity}</span>
                      <button
                        onClick={() => setCart((prev) => prev.map((i) => i.cartKey === item.cartKey ? { ...i, quantity: i.quantity + 1 } : i))}
                        aria-label="Adicionar uma unidade"
                        className="w-9 h-9 rounded-xl text-[#080909] flex items-center justify-center transition-transform active:scale-95"
                        style={{ backgroundColor: accentColor }}>
                        <Plus className="w-3.5 h-3.5" strokeWidth={2.25} />
                      </button>
                    </div>
                  </div>
                ))}


                {/* Order notes */}
                <div className="pt-3 border-t border-white/[0.06] scroll-mb-24">

                  <label className={`text-xs font-medium ${TEXT_SECONDARY} flex items-center gap-1.5`}>
                    <StickyNote className="w-3.5 h-3.5" strokeWidth={ICON_STROKE} /> Observações
                  </label>
                <AutoResizeTextarea value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)}
                    className={`w-full mt-1.5 p-3 ${R_FIELD} bg-white/[0.04] ${BORDER} text-[16px] leading-snug outline-none focus:border-white/20 transition-colors placeholder:text-white/30`}
                    placeholder="Sem wasabi, alergia a amendoim..." />
                </div>
              </div>


              <div className="px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-white/[0.06] space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-display text-2xl font-bold" style={{ color: accentColor }}>{fmt(cartTotal)}</span>
                </div>
                {(() => {
                  const closed = (restaurant as any)?.accepting_orders === false || (!!operatingHours && !isOpenNow(operatingHours));
                  return (
                    <Button
                      className="w-full min-h-[52px] text-base rounded-[16px] font-bold text-[#080909]"
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
          <motion.div
            role="dialog" aria-modal="true" aria-label="Finalizar pedido"
            style={sheetViewport}
            className="z-50 flex flex-col overflow-hidden lg:items-center lg:justify-center lg:p-8">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80"
              style={{ height: "100lvh", minHeight: "100vh", backdropFilter: "blur(20px) saturate(120%)", WebkitBackdropFilter: "blur(20px) saturate(120%)" }}
              onClick={() => setCheckoutStep(0)} />

            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              ref={checkoutTrapRef}
              className="mt-auto lg:mt-0 relative bg-[#131414] border-t lg:border border-white/[0.08] rounded-t-[24px] lg:rounded-[24px] lg:w-full lg:max-w-xl max-h-[92%] lg:max-h-[86%] flex flex-col shadow-[0_-24px_60px_rgba(0,0,0,0.5)]"
            >
              <div className="flex justify-center pt-3 pb-1 lg:hidden">
                <div className="w-10 h-1 rounded-full bg-white/25" />
              </div>

              {/* Step indicators */}
              <div className="flex items-center gap-2 sm:gap-2.5 px-4 sm:px-5 pt-2.5 pb-3.5 border-b border-white/[0.06] overflow-x-auto no-scrollbar">
                {["Tipo", "Infos", "Pagamento", "Revisão"].map((label, i) => {
                  const done = checkoutStep > i + 1;
                  const active = checkoutStep === i + 1;
                  return (
                    <div key={i} className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                      <div className="flex items-center gap-2">
                        <div
                          className={`relative w-7 h-7 rounded-full text-[11px] font-bold flex items-center justify-center transition-all duration-300 ${
                            done || active
                              ? "text-[#080909]"
                              : "bg-white/[0.045] text-white/40 border border-white/[0.09]"
                          } ${active ? "scale-105" : ""}`}
                          style={
                            done || active
                              ? {
                                  backgroundImage: `linear-gradient(145deg, ${accentColor}, ${accentColor}c4)`,
                                  boxShadow: active
                                    ? `0 0 0 4px ${accentColor}1f, 0 6px 18px -6px ${accentColor}`
                                    : `0 0 0 3px ${accentColor}14`,
                                }
                              : {}
                          }
                        >
                          {done ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : i + 1}
                        </div>
                        <span
                          className={`text-[10.5px] font-semibold uppercase tracking-[0.08em] whitespace-nowrap transition-colors duration-300 ${
                            active ? "text-white inline" : done ? "text-white/55 hidden sm:inline" : "text-white/30 hidden sm:inline"
                          }`}
                        >
                          {label}
                        </span>
                      </div>
                      {i < 3 && (
                        <div className="w-5 sm:w-6 h-[2px] rounded-full bg-white/[0.08] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500 ease-out"
                            style={{
                              width: done ? "100%" : "0%",
                              backgroundImage: `linear-gradient(90deg, ${accentColor}99, ${accentColor})`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Step 1: Tipo de atendimento */}
              {checkoutStep === 1 && (
                <div className={`${SHEET_PAD} space-y-3 overflow-y-auto flex-1`}>
                  <h3 className="font-display text-base font-bold tracking-tight mb-1">Como deseja seu pedido?</h3>
                  {([
                    restaurant.dine_in_enabled && {
                      key: "dine_in" as const,
                      icon: UtensilsCrossed,
                      title: "No local",
                      desc: "Peça direto da mesa",
                    },
                    restaurant.pickup_enabled && {
                      key: "pickup" as const,
                      icon: ShoppingBag,
                      title: "Retirada",
                      desc: "Buscar no balcão",
                    },
                    restaurant.delivery_enabled && {
                      key: "delivery" as const,
                      icon: Truck,
                      title: "Delivery",
                      desc: `Entrega em casa${restaurant.delivery_fee ? ` · Taxa ${fmt(Number(restaurant.delivery_fee))}` : ""}`,
                    },
                  ].filter(Boolean) as Array<{ key: "dine_in" | "pickup" | "delivery"; icon: typeof Truck; title: string; desc: string }>).map(
                    (opt) => (
                      <OptionCard
                        key={opt.key}
                        icon={opt.icon}
                        title={opt.title}
                        desc={opt.desc}
                        selected={orderType === opt.key}
                        accentColor={accentColor}
                        trailing="chevron"
                        onClick={() => { setOrderType(opt.key); setCheckoutStep(2); }}
                      />
                    ),
                  )}

                  {!restaurant.dine_in_enabled && !restaurant.pickup_enabled && !restaurant.delivery_enabled && (
                    <p className="text-sm text-white/45 text-center py-4">Nenhum tipo de atendimento disponível.</p>
                  )}
                </div>
              )}


              {/* Step 2: Infos (customer + mesa/endereço) */}
              {checkoutStep === 2 && orderType && (
                <div className={`${SHEET_PAD} space-y-4 overflow-y-auto flex-1`}>
                  {hasSavedData && (
                    <div className={`${R_FIELD} bg-white/[0.03] ${BORDER} p-3 text-xs space-y-2.5`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">
                          {autofillEnabled ? "✨ Dados salvos neste dispositivo" : "Preenchimento automático desativado"}
                          <span className="ml-1 opacity-70">· expira em 30 dias</span>
                        </span>
                        <button
                          type="button"
                          className="text-destructive hover:underline font-medium shrink-0 min-h-[36px] px-1 -mr-1"
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
                      <label className="flex items-center gap-2.5 cursor-pointer min-h-[40px]">
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
                          className="rounded w-[18px] h-[18px] shrink-0"
                          style={{ accentColor }}
                        />
                        <span className="text-muted-foreground">Preencher automaticamente meus dados neste dispositivo</span>
                      </label>
                    </div>
                  )}
                  <div>
                    <label className={`text-sm font-medium ${TEXT_SECONDARY}`}>Nome *</label>
                    <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                      required placeholder="Seu nome" className="mt-1.5 h-12" />
                  </div>
                  <div>
                    <label className={`text-sm font-medium ${TEXT_SECONDARY}`}>WhatsApp *</label>
                    <Input value={customerWhatsapp} onChange={(e) => setCustomerWhatsapp(e.target.value)}
                      required placeholder="(11) 99999-9999" className="mt-1.5 h-12" />
                  </div>

                  {orderType === "dine_in" && !tableId && (
                    <div>
                      <label className={`text-sm font-medium ${TEXT_SECONDARY}`}>Mesa *</label>
                      {tables.length > 0 ? (
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5 mt-2">
                          {tables.map((t) => (
                            <button key={t.id} type="button"
                              onClick={() => setSelectedTableId(t.id)}
                              className={`min-h-[52px] px-2 ${R_TILE} text-sm font-semibold ${SELECTABLE_BASE} ${
                                selectedTableId === t.id
                                  ? "font-bold"
                                  : `${SELECTABLE_IDLE} text-white/70`
                              }`}
                              style={selectedTableId === t.id ? { ...selectedSurface(accentColor), color: accentColor } : {}}
                            >
                              {t.number}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className={`text-xs ${TEXT_TERTIARY} mt-1`}>Nenhuma mesa cadastrada.</p>
                      )}
                    </div>
                  )}
                  {orderType === "dine_in" && tableId && (
                    <div className={`flex items-center gap-2.5 p-3 ${R_FIELD} ${BG_CARD} ${BORDER} text-sm`}>
                      <UtensilsCrossed className={ICON_SM} strokeWidth={ICON_STROKE} style={{ color: accentColor }} />
                      <span className={TEXT_SECONDARY}>Mesa identificada via QR Code</span>
                    </div>
                  )}


                  {orderType === "delivery" && (
                    <div className="space-y-3">
                      {savedAddresses.length > 0 && (
                        <div>
                          <label className={`text-xs font-medium ${TEXT_SECONDARY}`}>Endereços salvos</label>
                          <div className="mt-2 space-y-2">
                            {savedAddresses.map((a) => {
                              const active = selectedAddressId === a.id;
                              return (
                                <div
                                  key={a.id}
                                  className={`group flex items-center gap-3 ${TOUCH_ROW} ${R_FIELD} p-3 text-sm cursor-pointer ${SELECTABLE_BASE} ${
                                    active ? "" : SELECTABLE_IDLE
                                  }`}
                                  style={active ? selectedSurface(accentColor) : {}}
                                  onClick={() => {
                                    setSelectedAddressId(a.id);
                                    setDeliveryCep(a.cep); setDeliveryStreet(a.street);
                                    setDeliveryNumber(a.number); setDeliveryNeighborhood(a.neighborhood);
                                    setDeliveryCity(a.city); setDeliveryComplement(a.complement);
                                  }}
                                >
                                  <MapPin
                                    className={`${ICON_SM} shrink-0`}
                                    strokeWidth={ICON_STROKE}
                                    style={{ color: active ? accentColor : "rgba(255,255,255,0.45)" }}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium truncate">{a.label}</p>
                                    <p className={`text-xs ${TEXT_TERTIARY} truncate`}>
                                      {[a.neighborhood, a.city].filter(Boolean).join(" · ")}
                                      {a.complement ? ` · ${a.complement}` : ""}
                                    </p>
                                  </div>

                                  <button
                                    type="button"
                                    className={`text-xs text-destructive hover:underline shrink-0 ${TOUCH_ICON}`}
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
                              className={`w-full flex items-center justify-center gap-2 ${TOUCH} ${R_FIELD} border-dashed px-3 text-sm font-medium ${SELECTABLE_BASE} ${
                                selectedAddressId === null
                                  ? ""
                                  : `${SELECTABLE_IDLE} text-white/60 hover:text-white`
                              }`}
                              style={selectedAddressId === null ? { ...selectedSurface(accentColor), color: accentColor } : {}}
                              onClick={() => {
                                setSelectedAddressId(null);
                                setDeliveryCep(""); setDeliveryStreet(""); setDeliveryNumber("");
                                setDeliveryNeighborhood(""); setDeliveryCity(""); setDeliveryComplement("");
                              }}
                            >
                              <Plus className={ICON_SM} strokeWidth={ICON_STROKE} /> Novo endereço
                            </button>

                          </div>
                        </div>
                      )}

                      <div>
                        <label className={`text-xs font-medium ${TEXT_SECONDARY}`}>CEP *</label>
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
                          className="mt-1.5 h-12"
                        />
                        {deliveryCep && deliveryCep.replace(/\D/g, "").length !== 8 && (
                          <p className="text-[11px] text-destructive mt-1">CEP deve ter 8 dígitos</p>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2.5">
                        <div className="col-span-2">
                          <label className={`text-xs font-medium ${TEXT_SECONDARY}`}>Rua *</label>
                          <Input value={deliveryStreet} onChange={(e) => setDeliveryStreet(e.target.value)} required placeholder="Rua" className="mt-1.5 h-12" />
                        </div>
                        <div>
                          <label className={`text-xs font-medium ${TEXT_SECONDARY}`}>Nº *</label>
                          <Input value={deliveryNumber} onChange={(e) => setDeliveryNumber(e.target.value)} required inputMode="numeric" placeholder="123" className="mt-1.5 h-12" />
                        </div>
                      </div>
                      <div>
                        <label className={`text-xs font-medium ${TEXT_SECONDARY}`}>Bairro *</label>
                        <Input value={deliveryNeighborhood} onChange={(e) => setDeliveryNeighborhood(e.target.value)} required placeholder="Bairro" className="mt-1.5 h-12" />
                      </div>
                      <div>
                        <label className={`text-xs font-medium ${TEXT_SECONDARY}`}>Cidade *</label>
                        <Input value={deliveryCity} onChange={(e) => setDeliveryCity(e.target.value)} required placeholder="Cidade" className="mt-1.5 h-12" />
                      </div>
                      <div>
                        <label className={`text-xs font-medium ${TEXT_SECONDARY}`}>Complemento</label>
                        <Input value={deliveryComplement} onChange={(e) => setDeliveryComplement(e.target.value)} placeholder="Apto, referência, ponto de apoio..." className="mt-1.5 h-12" />
                      </div>
                    </div>
                  )}

                  <label className={`flex items-center gap-2.5 ${TOUCH} text-sm text-muted-foreground cursor-pointer`}>
                    <input type="checkbox" checked={consentMarketing} onChange={(e) => setConsentMarketing(e.target.checked)}
                      className="rounded w-[18px] h-[18px] shrink-0" style={{ accentColor }} />
                    Aceito receber promoções por WhatsApp
                  </label>

                  <div className="flex gap-2.5 pt-2">
                    <Button type="button" variant="outline" className="flex-1 min-h-[52px] rounded-[16px] border-white/[0.12] bg-white/[0.03]" onClick={() => setCheckoutStep(1)}>
                      Voltar
                    </Button>
                    <Button
                      className="flex-1 min-h-[52px] rounded-[16px] font-bold text-[#080909]"
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
                <div className={`${SHEET_PAD} space-y-3 overflow-y-auto flex-1`}>
                  <h3 className="font-display text-base font-bold tracking-tight mb-1">Forma de pagamento</h3>
                  {(() => {
                    const pm = restaurant.payment_methods;
                    const mpOn = Boolean((restaurant as any).mp_enabled);
                    const canUseOnlinePayment = grandTotal >= onlinePaymentMinAmount;
                    const available: { key: string; label: string; hint?: string; icon: typeof CreditCard }[] = [];
                    const enabled = (k: string) =>
                      Array.isArray(pm) ? pm.includes(k) : pm && typeof pm === "object" ? Boolean(pm[k]) : true;
                    if (enabled("pix")) available.push({ key: "pix", icon: QrCode, label: mpOn ? "PIX (online)" : "PIX", hint: mpOn ? (canUseOnlinePayment ? "QR Code na próxima tela" : "Mínimo R$ 1,00") : undefined });
                    if (mpOn) available.push({ key: "credit_card_online", icon: CreditCard, label: "Cartão de Crédito (online)", hint: canUseOnlinePayment ? "até 3x sem juros" : "Mínimo R$ 1,00" });
                    const isDelivery = orderType === "delivery";
                    if (enabled("credit_card") || enabled("card")) available.push({ key: "credit_card", icon: CreditCard, label: isDelivery ? "Pagar na entrega" : "Cartão de Crédito (no local)", hint: isDelivery ? "Cartão na maquininha do entregador" : undefined });
                    if (enabled("debit_card")) available.push({ key: "debit_card", icon: CreditCard, label: isDelivery ? "Cartão de Débito (na entrega)" : "Cartão de Débito (no local)" });
                    if (enabled("cash")) available.push({ key: "cash", icon: Banknote, label: "Dinheiro" });
                    if (available.length === 0) {
                      available.push({ key: "pix", icon: QrCode, label: "PIX" }, { key: "cash", icon: Banknote, label: "Dinheiro" });
                    }
                    return available.map((p) => (
                      <OptionCard
                        key={p.key}
                        icon={p.icon}
                        title={p.label}
                        desc={p.hint}
                        selected={paymentMethod === p.key}
                        accentColor={accentColor}
                        trailing="check"
                        onClick={() => setPaymentMethod(p.key)}
                      />
                    ));

                  })()}

                  {paymentMethod === "cash" && (
                    <div>
                      <label className={`text-xs font-medium ${TEXT_SECONDARY}`}>Precisa de troco para quanto? (opcional)</label>
                      <Input value={changeFor} onChange={(e) => setChangeFor(e.target.value)}
                        type="number" step="0.01" placeholder="Ex: 100.00" className="mt-1.5 h-12" />
                    </div>
                  )}

                  <div className="flex gap-2.5 pt-2">
                    <Button type="button" variant="outline" className="flex-1 min-h-[52px] rounded-[16px] border-white/[0.12] bg-white/[0.03]" onClick={() => setCheckoutStep(2)}>
                      Voltar
                    </Button>
                    <Button
                      className="flex-1 min-h-[52px] rounded-[16px] font-bold text-[#080909]"
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
                <form onSubmit={handleCheckout} className={`${SHEET_PAD} space-y-4 overflow-y-auto flex-1`}>
                  <div className="space-y-2">
                    {cart.map((item) => (
                      <div key={item.cartKey} className={`flex justify-between gap-3 text-sm px-3 py-2.5 ${R_FIELD} ${SELECTABLE_BASE} ${SELECTABLE_IDLE}`}>
                        <span className="text-muted-foreground">{item.quantity}× {item.name}</span>
                        <span className="font-medium">{fmt(item.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                  {/* Coupon */}
                  <div className="border-t border-white/[0.06] pt-3">
                    <label className={`text-xs font-medium ${TEXT_SECONDARY} flex items-center gap-1.5 mb-1.5`}>
                      <Ticket className="w-3.5 h-3.5" strokeWidth={ICON_STROKE} /> Cupom de desconto
                    </label>
                    {appliedCoupon ? (
                      <motion.div
                        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        className={`flex items-center justify-between gap-3 p-3 ${R_FIELD} ${SELECTABLE_BASE}`}
                        style={selectedSurface("#10b981")}>

                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`w-9 h-9 shrink-0 ${R_TILE} flex items-center justify-center border`}
                            style={selectedTileStyle("#10b981", true)}
                          >
                            <Check className="w-4 h-4 text-emerald-400" strokeWidth={ICON_STROKE} />
                          </span>
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
                        <button type="button" onClick={removeCoupon} className={`text-muted-foreground hover:text-destructive rounded-lg transition-colors shrink-0 ${TOUCH_ICON}`}>
                          <X className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ) : (
                      <div className="flex gap-2.5">
                        <Input
                          value={couponInput}
                          onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(null); }}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyCouponCode(); } }}
                          placeholder="Digite o código"
                          className="flex-1 min-h-[48px] font-mono uppercase tracking-wider"
                          maxLength={40}
                        />
                        <Button type="button" onClick={applyCouponCode}
                          disabled={couponValidating || !couponInput.trim()}
                          className="px-5 min-h-[48px] rounded-[14px] font-semibold text-[#080909]" style={{ backgroundColor: accentColor }}>
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

                  <div className="border-t border-white/[0.06] pt-3 space-y-1 text-sm">
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
                  <div className={`text-xs ${TEXT_SECONDARY} space-y-2 border-t border-white/[0.06] pt-3`}>
                    <p className="flex items-center gap-2">
                      <Phone className={`${ICON_SM} shrink-0`} strokeWidth={ICON_STROKE} style={{ color: accentColor }} />
                      <span className="truncate">{customerName} · {customerWhatsapp}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      {orderType === "delivery"
                        ? <Truck className={`${ICON_SM} shrink-0`} strokeWidth={ICON_STROKE} style={{ color: accentColor }} />
                        : orderType === "pickup"
                          ? <ShoppingBag className={`${ICON_SM} shrink-0`} strokeWidth={ICON_STROKE} style={{ color: accentColor }} />
                          : <UtensilsCrossed className={`${ICON_SM} shrink-0`} strokeWidth={ICON_STROKE} style={{ color: accentColor }} />}
                      <span className="truncate">
                        {orderType === "dine_in" && `Mesa ${tables.find(t => t.id === (tableId ?? selectedTableId))?.number ?? ""}`}
                        {orderType === "pickup" && `Retirada no balcão`}
                        {orderType === "delivery" && `${deliveryStreet}, ${deliveryNumber} — ${deliveryNeighborhood}`}
                      </span>
                    </p>
                    <p className="flex items-center gap-2">
                      <CreditCard className={`${ICON_SM} shrink-0`} strokeWidth={ICON_STROKE} style={{ color: accentColor }} />
                      <span className="truncate">{orderType === "dine_in" ? "Pagamento no local (mesa)" : paymentMethodLabel(paymentMethod && resolveStoredPaymentMethod(paymentMethod, orderType), orderType)}{paymentMethod === "cash" && changeFor ? ` · troco p/ ${fmt(Number(changeFor))}` : ""}</span>
                    </p>
                  </div>

                  <div>
                    <label className={`text-xs font-medium ${TEXT_SECONDARY} flex items-center gap-1.5`}>
                      <StickyNote className="w-3.5 h-3.5" strokeWidth={ICON_STROKE} /> Observações
                    </label>
                    <AutoResizeTextarea value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)}
                      className={`w-full mt-1.5 p-3 ${R_FIELD} bg-white/[0.04] ${BORDER} text-[16px] leading-snug outline-none focus:border-white/20 transition-colors`}
                      placeholder="Sem wasabi, alergia a amendoim..." />
                  </div>


                  <div className="flex gap-2.5">
                    <Button type="button" variant="outline" className="flex-1 min-h-[52px] rounded-[16px] border-white/[0.12] bg-white/[0.03]" onClick={() => setCheckoutStep(orderType === "dine_in" ? 2 : 3)}>
                      Voltar
                    </Button>
                    <Button type="submit" className="flex-1 min-h-[52px] rounded-[16px] font-bold text-base text-[#080909]"
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

      {/* Order success celebration overlay */}
      <AnimatePresence>
        {orderSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-background/85 backdrop-blur-xl"
          >
            {/* Confetti */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {Array.from({ length: 28 }).map((_, i) => {
                const colors = [accentColor, "#FFD54F", "#FF3D00", "#7C4DFF", "#00E5FF", "#E91E63"];
                const color = colors[i % colors.length];
                const left = Math.random() * 100;
                const delay = Math.random() * 0.4;
                const duration = 1.6 + Math.random() * 1.2;
                const rotate = Math.random() * 720 - 360;
                return (
                  <motion.span
                    key={i}
                    initial={{ y: -40, x: `${left}vw`, opacity: 0, rotate: 0 }}
                    animate={{ y: "110vh", opacity: [0, 1, 1, 0], rotate }}
                    transition={{ duration, delay, ease: "easeIn" }}
                    className="absolute top-0 w-2 h-3 rounded-sm"
                    style={{ backgroundColor: color }}
                  />
                );
              })}
            </div>

            <motion.div
              initial={{ scale: 0.6, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className="relative text-center px-8"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.2, 1] }}
                transition={{ duration: 0.6, times: [0, 0.6, 1], ease: "backOut" }}
                className="mx-auto w-28 h-28 rounded-full flex items-center justify-center relative"
                style={{
                  backgroundImage: `linear-gradient(135deg, ${accentColor}, #FFB300)`,
                  boxShadow: `0 0 60px ${accentColor}80`,
                }}
              >
                <motion.span
                  className="absolute inset-0 rounded-full"
                  animate={{ scale: [1, 1.4, 1.8], opacity: [0.5, 0.2, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                  style={{ border: `2px solid ${accentColor}` }}
                />
                <motion.div
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ delay: 0.35, duration: 0.5, ease: "easeOut" }}
                >
                  <Check className="w-14 h-14 text-white" strokeWidth={3.5} />
                </motion.div>
              </motion.div>
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mt-6 font-display text-2xl font-bold"
              >
                Pedido enviado! 🎉
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="mt-2 text-sm text-muted-foreground"
              >
                Estamos te levando ao acompanhamento…
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PublicMenu;

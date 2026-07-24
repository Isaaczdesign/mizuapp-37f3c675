// LocalStorage helpers for the public menu (no login required).
// - Data expires automatically after EXPIRATION_DAYS.
// - Users can disable autofill per device.
// - Multiple delivery addresses per restaurant.

export const EXPIRATION_DAYS = 30;
const EXPIRATION_MS = EXPIRATION_DAYS * 24 * 60 * 60 * 1000;
const MAX_ADDRESSES = 5;

export type SavedAddress = {
  id: string;
  label: string;
  cep: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  complement: string;
  savedAt: number;
};

export type CustomerStorage = {
  v: 2;
  savedAt: number;
  autofillEnabled: boolean;
  customerName: string;
  customerWhatsapp: string;
  consentMarketing: boolean;
  addresses: SavedAddress[];
};

const keyFor = (slug: string) => `koban:customer:${slug}`;

function emptyStore(): CustomerStorage {
  return {
    v: 2,
    savedAt: Date.now(),
    autofillEnabled: true,
    customerName: "",
    customerWhatsapp: "",
    consentMarketing: false,
    addresses: [],
  };
}

function migrate(raw: any): CustomerStorage {
  if (!raw || typeof raw !== "object") return emptyStore();
  if (raw.v === 2) return { ...emptyStore(), ...raw, addresses: Array.isArray(raw.addresses) ? raw.addresses : [] };
  // v1 (flat fields) → v2
  const store = emptyStore();
  store.customerName = raw.customerName || "";
  store.customerWhatsapp = raw.customerWhatsapp || "";
  store.consentMarketing = !!raw.consentMarketing;
  if (raw.deliveryCep || raw.deliveryStreet) {
    store.addresses.push({
      id: crypto.randomUUID(),
      label: [raw.deliveryStreet, raw.deliveryNumber].filter(Boolean).join(", ") || "Endereço salvo",
      cep: raw.deliveryCep || "",
      street: raw.deliveryStreet || "",
      number: raw.deliveryNumber || "",
      neighborhood: raw.deliveryNeighborhood || "",
      city: raw.deliveryCity || "",
      complement: raw.deliveryComplement || "",
      savedAt: Date.now(),
    });
  }
  return store;
}

export function loadCustomerStorage(slug: string | null | undefined): CustomerStorage | null {
  if (!slug || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(keyFor(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const store = migrate(parsed);
    // Expire everything if last save is too old.
    if (!store.savedAt || Date.now() - store.savedAt > EXPIRATION_MS) {
      localStorage.removeItem(keyFor(slug));
      return null;
    }
    return store;
  } catch {
    return null;
  }
}

export function saveCustomerStorage(slug: string | null | undefined, store: CustomerStorage): void {
  if (!slug || typeof window === "undefined") return;
  try {
    localStorage.setItem(keyFor(slug), JSON.stringify({ ...store, savedAt: Date.now() }));
  } catch {}
}

export function clearCustomerStorage(slug: string | null | undefined): void {
  if (!slug || typeof window === "undefined") return;
  try {
    localStorage.removeItem(keyFor(slug));
  } catch {}
}

/** Save (or update) an address, dedup by cep+number+complement, keep the most recent MAX_ADDRESSES. */
export function upsertAddress(list: SavedAddress[], addr: Omit<SavedAddress, "id" | "savedAt" | "label"> & { label?: string }): SavedAddress[] {
  const norm = (s: string) => (s || "").trim().toLowerCase();
  const same = (a: SavedAddress) =>
    norm(a.cep) === norm(addr.cep) &&
    norm(a.number) === norm(addr.number) &&
    norm(a.complement) === norm(addr.complement) &&
    norm(a.street) === norm(addr.street);

  const existing = list.find(same);
  const label = addr.label?.trim() || [addr.street, addr.number].filter(Boolean).join(", ") || "Endereço";
  const next: SavedAddress = existing
    ? { ...existing, ...addr, label, savedAt: Date.now() }
    : { ...addr, label, id: crypto.randomUUID(), savedAt: Date.now() };

  const rest = list.filter((a) => a.id !== next.id);
  return [next, ...rest].slice(0, MAX_ADDRESSES);
}

export function removeAddress(list: SavedAddress[], id: string): SavedAddress[] {
  return list.filter((a) => a.id !== id);
}

/* ────────────────────────────────────────────────────────────
   Recent orders — lets the customer come back to the tracking
   page after leaving it (browser back, closing the tab, etc.).
   ──────────────────────────────────────────────────────────── */

export type RecentOrder = {
  token: string;
  orderNumber?: string | number | null;
  status?: string | null;
  slug?: string | null;
  savedAt: number;
};

const RECENT_ORDERS_KEY = "koban:recent-orders";
const RECENT_ORDERS_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const MAX_RECENT_ORDERS = 5;

export const TERMINAL_ORDER_STATUSES = ["completed", "delivered", "cancelled", "canceled"];

export function loadRecentOrders(slug?: string | null): RecentOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_ORDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    const valid = parsed.filter(
      (o: any) => o && typeof o.token === "string" && now - (o.savedAt || 0) < RECENT_ORDERS_TTL_MS,
    ) as RecentOrder[];
    if (valid.length !== parsed.length) {
      localStorage.setItem(RECENT_ORDERS_KEY, JSON.stringify(valid));
    }
    return slug ? valid.filter((o) => !o.slug || o.slug === slug) : valid;
  } catch {
    return [];
  }
}

export function saveRecentOrder(order: Omit<RecentOrder, "savedAt"> & { savedAt?: number }): void {
  if (typeof window === "undefined" || !order?.token) return;
  try {
    const all = loadRecentOrders();
    const prev = all.find((o) => o.token === order.token);
    const next: RecentOrder = {
      ...prev,
      ...order,
      slug: order.slug ?? prev?.slug ?? null,
      savedAt: prev?.savedAt ?? Date.now(),
    };
    const list = [next, ...all.filter((o) => o.token !== order.token)].slice(0, MAX_RECENT_ORDERS);
    localStorage.setItem(RECENT_ORDERS_KEY, JSON.stringify(list));
  } catch {}
}

export function removeRecentOrder(token: string): void {
  if (typeof window === "undefined") return;
  try {
    const list = loadRecentOrders().filter((o) => o.token !== token);
    localStorage.setItem(RECENT_ORDERS_KEY, JSON.stringify(list));
  } catch {}
}

/** Orders still worth showing a "back to tracking" shortcut for. */
export function loadActiveOrders(slug?: string | null): RecentOrder[] {
  return loadRecentOrders(slug).filter((o) => !TERMINAL_ORDER_STATUSES.includes(String(o.status || "")));
}

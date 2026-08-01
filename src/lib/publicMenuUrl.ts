// Canonical public menu URL helpers.
// The menu now lives at the root path (`/meu-restaurante`); `/r/:slug` and `/m/:slug`
// keep working as legacy aliases so QR codes already printed never break.

/** Top-level app paths that can never be used as a restaurant slug. */
export const RESERVED_SLUGS = new Set([
  "auth", "dashboard", "orders", "kds", "menu-admin", "customers", "tables",
  "automations", "agenda", "settings", "perfil", "expediente", "admin-mizu", "demonstracao",
  "reset-password", "pedido", "q", "r", "m", "dev", "api", "assets", "public",
  "login", "signup", "cadastro", "app", "www", "suporte", "sobre", "precos",
  "termos", "privacidade", "blog", "docs", "static",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.trim().toLowerCase());
}

/** Relative path of the public menu, e.g. `/meu-restaurante`. */
export function menuPath(slug: string): string {
  return `/${slug}`;
}

/** Absolute URL of the public menu, e.g. `https://mizu.lovable.app/meu-restaurante`. */
export function menuUrl(slug: string, origin?: string): string {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}${menuPath(slug)}`;
}

/** Absolute URL of the public menu pre-filled for a table QR code. */
export function tableMenuUrl(slug: string, tableToken: string, origin?: string): string {
  return `${menuUrl(slug, origin)}?t=${encodeURIComponent(tableToken)}`;
}


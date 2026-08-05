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

/** Domínio raiz da plataforma. Cada restaurante ganha `slug.BASE_DOMAIN`. */
export const BASE_DOMAIN = "mizuapp.com.br";

/** Hosts que servem a plataforma (sem subdomínio de restaurante). */
const PLATFORM_HOSTS = new Set([BASE_DOMAIN, `www.${BASE_DOMAIN}`]);

/** Extrai o slug do restaurante a partir de um hostname (`restaurantex.mizuapp.com.br`). */
export function slugFromHost(host?: string): string | null {
  const h = (host ?? (typeof window !== "undefined" ? window.location.hostname : "")).toLowerCase();
  if (!h.endsWith(`.${BASE_DOMAIN}`) || PLATFORM_HOSTS.has(h)) return null;
  const sub = h.slice(0, -(BASE_DOMAIN.length + 1));
  if (!sub || sub.includes(".") || isReservedSlug(sub)) return null;
  return sub;
}

/** Relative path of the public menu, e.g. `/meu-restaurante`. */
export function menuPath(slug: string): string {
  return `/${slug}`;
}

/**
 * Absolute URL of the public menu.
 * Em produção (domínio próprio) usa `https://slug.mizuapp.com.br`;
 * em preview/local mantém o caminho `origin/slug`.
 */
export function menuUrl(slug: string, origin?: string): string {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  try {
    const host = new URL(base).hostname.toLowerCase();
    if (host === BASE_DOMAIN || host.endsWith(`.${BASE_DOMAIN}`)) {
      return `https://${slug}.${BASE_DOMAIN}`;
    }
  } catch {
    /* base pode estar vazio em SSR */
  }
  return `${base}${menuPath(slug)}`;
}

/** Absolute URL of the public menu pre-filled for a table QR code. */
export function tableMenuUrl(slug: string, tableToken: string, origin?: string): string {
  return `${menuUrl(slug, origin)}?t=${encodeURIComponent(tableToken)}`;
}


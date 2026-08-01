/**
 * Assets usados nas notificações do navegador.
 *
 * - `icon`: PNG quadrado 192x192 com padding (Chrome/Firefox recortam imagens
 *   não quadradas; o logo original é 1653x1920).
 * - `badge`: PNG monocromático 96x96 (Chrome Android/desktop exige silhueta).
 *
 * URLs absolutas: alguns navegadores (e o Safari em contexto de PWA) não
 * resolvem caminhos relativos passados para a Notification API.
 */
const origin = typeof window !== "undefined" ? window.location.origin : "";

export const NOTIFICATION_ICON = `${origin}/mizu-notification.png`;
export const NOTIFICATION_BADGE = `${origin}/mizu-badge.png`;

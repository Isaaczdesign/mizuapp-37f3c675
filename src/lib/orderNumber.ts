/**
 * Numeração amigável dos pedidos: #0001, #0002, ...
 * O número é sequencial por restaurante (coluna `order_number`).
 * Enquanto um pedido antigo não tiver número, cai no fallback do id curto.
 */

export function formatOrderNumber(
  orderNumber?: number | null,
  fallbackId?: string | null,
): string {
  if (orderNumber != null && Number.isFinite(Number(orderNumber))) {
    return `#${String(Number(orderNumber)).padStart(4, "0")}`;
  }
  return `#${(fallbackId ?? "").slice(0, 6).toUpperCase()}`;
}

/** Mesma numeração, mas aceitando o objeto do pedido direto. */
export function orderRef(order: { order_number?: number | null; id?: string | null } | null | undefined): string {
  return formatOrderNumber(order?.order_number, order?.id);
}

// Canonical labels for order modality across the app.
// Use these everywhere an order type is displayed (lists, modals, notifications).
export type OrderTypeKey = "dine_in" | "pickup" | "delivery";

export const ORDER_TYPE_LABEL: Record<string, string> = {
  dine_in: "No local",
  pickup: "Retirada",
  delivery: "Delivery",
};

export const ORDER_TYPE_EMOJI: Record<string, string> = {
  dine_in: "🍽️",
  pickup: "🛍️",
  delivery: "🛵",
};

export function orderTypeLabel(type?: string | null): string {
  if (!type) return "—";
  return ORDER_TYPE_LABEL[type] ?? type;
}

// Canonical payment method keys + labels used across public menu, dashboard and receipts.
export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: "Dinheiro",
  pix: "PIX (no local)",
  pix_online: "PIX (online)",
  credit_card: "Cartão de crédito (local)",
  card: "Cartão (maquininha)",
  debit_card: "Cartão de débito",
  credit_card_online: "Cartão de crédito (online)",
  meal_voucher: "Vale-refeição",
  on_delivery: "Pagar na entrega",
  other: "Outro",
};

/**
 * Human label for a stored payment method.
 * `on_delivery` is persisted for delivery orders paid to the courier, so no
 * order-type inference is needed — legacy rows still fall back to it.
 */
export function paymentMethodLabel(method?: string | null, orderType?: string | null): string {
  if (!method) return "—";
  if (method === "credit_card" && orderType === "delivery") return PAYMENT_METHOD_LABEL.on_delivery;
  return PAYMENT_METHOD_LABEL[method] ?? method.replace(/_/g, " ");
}

/** Maps the option selected in the public checkout to the key stored in the order. */
export function resolveStoredPaymentMethod(method: string, orderType: string): string {
  if (method === "credit_card" && orderType === "delivery") return "on_delivery";
  return method;
}

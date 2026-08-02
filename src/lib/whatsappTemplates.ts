/** Utilitários para abrir o WhatsApp com mensagens prontas. */

/** Número de suporte da Mizu (formato internacional, só dígitos). */
export const SUPPORT_WHATSAPP = "5524988416887";

export const SUPPORT_MESSAGE =
  "Olá, sou cliente Mizu e preciso de suporte com o meu painel.";

export function waLink(phone: string, message: string) {
  const digits = (phone ?? "").replace(/\D/g, "");
  const withCountry = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}

export function supportWhatsappUrl(message: string = SUPPORT_MESSAGE) {
  return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(message)}`;
}

export function openWhatsapp(phone: string, message: string) {
  window.open(waLink(phone, message), "_blank", "noopener,noreferrer");
}

/** Mensagem de pedido confirmado / em preparo. */
export function orderConfirmedMessage(opts: {
  customerName?: string | null;
  restaurantName?: string | null;
  orderId: string;
  trackingUrl?: string | null;
}) {
  const name = opts.customerName ? `${opts.customerName}, ` : "";
  const rest = opts.restaurantName ? ` no *${opts.restaurantName}*` : "";
  return (
    `👨‍🍳 Olá ${name}seu pedido #${opts.orderId.slice(0, 6).toUpperCase()}${rest} foi *confirmado* e já está sendo preparado!` +
    (opts.trackingUrl ? `\n\nAcompanhe em tempo real: ${opts.trackingUrl}` : "")
  );
}

/** Mensagem de pedido saiu para entrega. */
export function orderOutForDeliveryMessage(opts: {
  customerName?: string | null;
  restaurantName?: string | null;
  orderId: string;
  eta?: string | null;
  trackingUrl?: string | null;
}) {
  const name = opts.customerName ? `${opts.customerName}, ` : "";
  const rest = opts.restaurantName ? ` do *${opts.restaurantName}*` : "";
  const eta = opts.eta ? ` e chega por volta das ${opts.eta}` : "";
  return (
    `🛵 ${name}seu pedido #${opts.orderId.slice(0, 6).toUpperCase()}${rest} *saiu para entrega*${eta}!` +
    (opts.trackingUrl ? `\n\nAcompanhe em tempo real: ${opts.trackingUrl}` : "")
  );
}

/** Mensagem de cupom de desconto enviado ao cliente. */
export function couponMessage(opts: {
  customerName?: string | null;
  restaurantName?: string | null;
  code: string;
  discountLabel: string;
  description?: string | null;
  expiresAt?: string | null;
  menuUrl?: string | null;
}) {
  const name = opts.customerName ? `${opts.customerName}, ` : "";
  const rest = opts.restaurantName ? ` no *${opts.restaurantName}*` : "";
  const lines = [
    `🎁 ${name}você ganhou um cupom de desconto${rest}!`,
    "",
    `Cupom: *${opts.code}*`,
    `Desconto: ${opts.discountLabel}`,
  ];
  if (opts.description) lines.push(opts.description);
  if (opts.expiresAt)
    lines.push(`Válido até ${new Date(opts.expiresAt).toLocaleDateString("pt-BR")}`);
  if (opts.menuUrl) lines.push("", `Peça agora: ${opts.menuUrl}`);
  lines.push("", "É só informar o código na finalização do pedido. 😉");
  return lines.join("\n");
}

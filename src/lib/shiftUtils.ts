// Utilities and constants for the Encerramento de Expediente feature.
import type { Database } from "@/integrations/supabase/types";

export type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
export type ShiftRow = Database["public"]["Tables"]["work_shifts"]["Row"];

export const PAYMENT_METHODS: { key: string; label: string }[] = [
  { key: "cash", label: "Dinheiro" },
  { key: "pix", label: "Pix" },
  { key: "credit_card", label: "Cartão de crédito (maquineta)" },
  { key: "debit_card", label: "Cartão de débito" },
  { key: "credit_card_online", label: "Pagamento online" },
  { key: "meal_voucher", label: "Vale-refeição" },
  { key: "on_delivery", label: "Pagamento na entrega" },
  { key: "other", label: "Outros" },
];

export const PAYMENT_LABEL: Record<string, string> = PAYMENT_METHODS.reduce(
  (a, m) => ({ ...a, [m.key]: m.label }),
  {},
);

export const TERMINAL_STATUSES = new Set(["delivered", "canceled", "refused", "completed"]);
export const IN_PROGRESS_STATUSES = ["new", "confirmed", "preparing", "ready", "out_for_delivery"] as const;

export const STATUS_LABEL: Record<string, string> = {
  new: "Novo",
  confirmed: "Confirmado",
  preparing: "Em preparo",
  ready: "Pronto",
  out_for_delivery: "Em entrega",
  delivered: "Entregue",
  completed: "Concluído",
  canceled: "Cancelado",
  refused: "Recusado",
};

export function fmtBRL(v: number) {
  return (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function computeShiftTotals(orders: OrderRow[]) {
  const byStatus: Record<string, number> = {};
  const byType: Record<string, number> = { dine_in: 0, pickup: 0, delivery: 0 };
  let gross = 0, canceledSum = 0, deliveryFees = 0, uniqueCustomers = new Set<string>();
  let completed = 0, canceled = 0, refused = 0, pending = 0;

  for (const o of orders) {
    byStatus[o.status] = (byStatus[o.status] || 0) + 1;
    if (o.order_type && byType[o.order_type] !== undefined) byType[o.order_type]++;
    if (o.customer_id) uniqueCustomers.add(o.customer_id);
    const total = Number(o.total || 0);
    const fee = Number((o as any).delivery_fee || 0);
    const st = o.status as string;
    if (st === "canceled" || st === "refused") {
      canceledSum += total;
      if (st === "canceled") canceled++;
      else refused++;
    } else {
      gross += total;
      deliveryFees += fee;
      if (st === "delivered" || st === "completed") completed++;
      else pending++;
    }
  }
  const net = gross;
  const ticket = completed > 0 ? gross / completed : 0;
  return {
    total: orders.length,
    completed, canceled, refused, pending,
    byStatus, byType,
    gross, canceledSum, deliveryFees, net, ticket,
    customers: uniqueCustomers.size,
  };
}

export function expectedByPaymentMethod(orders: OrderRow[]) {
  const map: Record<string, { total: number; count: number }> = {};
  for (const o of orders) {
    if (o.status === "canceled" || o.status === "refused") continue;
    const key = (o as any).payment_method || "other";
    if (!map[key]) map[key] = { total: 0, count: 0 };
    map[key].total += Number(o.total || 0);
    map[key].count += 1;
  }
  return map;
}

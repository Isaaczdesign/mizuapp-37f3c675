/**
 * Catálogo central de planos e funcionalidades do Mizu.
 * Toda verificação de permissão comercial deve passar por aqui — nunca comparar
 * nomes de plano ou preços espalhados pelos componentes.
 */

export type PlanCode = "starter" | "pro" | "premium";
export type BillingCycle = "monthly" | "annual";

export const PLAN_ORDER: PlanCode[] = ["starter", "pro", "premium"];

export type FeatureKey =
  | "dashboard"
  | "orders"
  | "manual_orders"
  | "order_filters"
  | "kitchen"
  | "menu_management"
  | "menu_public_link"
  | "menu_qr_code"
  | "menu_default_template"
  | "menu_all_templates"
  | "menu_advanced_customization"
  | "menu_smart_import"
  | "dine_in"
  | "pickup"
  | "delivery"
  | "delivery_settings"
  | "local_payments"
  | "online_payments"
  | "mercado_pago_restaurant"
  | "tables"
  | "table_qr_codes"
  | "crm"
  | "crm_customer_history"
  | "crm_segmentation"
  | "crm_whatsapp_link"
  | "coupons"
  | "reviews"
  | "agenda"
  | "shift_management"
  | "shift_history"
  | "notifications"
  | "whatsapp_provider"
  | "crm_integrated_messages"
  | "assisted_integrations"
  | "early_access"
  | "priority_support";

/** Funcionalidades liberadas em cada plano (espelha `plan_features` no banco). */
export const STARTER_FEATURES: FeatureKey[] = [
  "dashboard",
  "orders",
  "manual_orders",
  "order_filters",
  "kitchen",
  "menu_management",
  "menu_public_link",
  "menu_qr_code",
  "menu_default_template",
  "dine_in",
  "pickup",
  "delivery",
  "delivery_settings",
  "local_payments",
  "tables",
  "table_qr_codes",
  "shift_management",
  "shift_history",
  "notifications",
  "priority_support",
];

export const PRO_ONLY_FEATURES: FeatureKey[] = [
  "menu_all_templates",
  "menu_advanced_customization",
  "menu_smart_import",
  "online_payments",
  "mercado_pago_restaurant",
  "crm",
  "crm_customer_history",
  "crm_segmentation",
  "crm_whatsapp_link",
  "coupons",
  "reviews",
  "agenda",
];

export const PREMIUM_ONLY_FEATURES: FeatureKey[] = [
  "whatsapp_provider",
  "crm_integrated_messages",
  "assisted_integrations",
  "early_access",
];

export const PLAN_FEATURES: Record<PlanCode, FeatureKey[]> = {
  starter: STARTER_FEATURES,
  pro: [...STARTER_FEATURES, ...PRO_ONLY_FEATURES],
  premium: [...STARTER_FEATURES, ...PRO_ONLY_FEATURES, ...PREMIUM_ONLY_FEATURES],
};

/** Plano mínimo em que a funcionalidade está disponível. */
export function minPlanFor(feature: FeatureKey): PlanCode {
  if (STARTER_FEATURES.includes(feature)) return "starter";
  if (PRO_ONLY_FEATURES.includes(feature)) return "pro";
  return "premium";
}

export interface PlanMeta {
  code: PlanCode;
  name: string;
  tagline: string;
  monthlyPriceCents: number;
  annualPriceCents: number;
  recommended?: boolean;
  ctaLabel: string;
}

export const PLANS: Record<PlanCode, PlanMeta> = {
  starter: {
    code: "starter",
    name: "Mizu Starter",
    tagline: "Tudo o que você precisa para começar a receber e organizar pedidos online.",
    monthlyPriceCents: 7900,
    annualPriceCents: 79000,
    ctaLabel: "Começar com o Starter",
  },
  pro: {
    code: "pro",
    name: "Mizu Pro",
    tagline: "Transforme seus pedidos em relacionamento e novas vendas.",
    monthlyPriceCents: 14900,
    annualPriceCents: 149000,
    recommended: true,
    ctaLabel: "Escolher o Pro",
  },
  premium: {
    code: "premium",
    name: "Mizu Premium",
    tagline: "Automação e integração para restaurantes que querem crescer.",
    monthlyPriceCents: 24900,
    annualPriceCents: 249000,
    ctaLabel: "Escolher o Premium",
  },
};

export const PLAN_LIST: PlanMeta[] = PLAN_ORDER.map((c) => PLANS[c]);

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  dashboard: "Dashboard operacional",
  orders: "Gestão de pedidos em tempo real",
  manual_orders: "Criação manual de pedidos",
  order_filters: "Busca e filtros de pedidos",
  kitchen: "Tela da cozinha (KDS)",
  menu_management: "Gestão completa do cardápio",
  menu_public_link: "Link público do cardápio",
  menu_qr_code: "QR Code geral do cardápio",
  menu_default_template: "Template padrão de cardápio",
  menu_all_templates: "Todos os templates de cardápio",
  menu_advanced_customization: "Personalização visual avançada",
  menu_smart_import: "Importação inteligente de cardápio",
  dine_in: "Consumo no local",
  pickup: "Retirada no balcão",
  delivery: "Delivery",
  delivery_settings: "Taxa de entrega e tempos médios",
  local_payments: "Pagamentos no local (dinheiro, Pix, cartão)",
  online_payments: "Pagamentos online (Pix e cartão)",
  mercado_pago_restaurant: "Mercado Pago do restaurante",
  tables: "Gestão de mesas",
  table_qr_codes: "QR Code individual por mesa",
  crm: "CRM completo",
  crm_customer_history: "Histórico individual de clientes",
  crm_segmentation: "Segmentação de clientes",
  crm_whatsapp_link: "Mensagem via link do WhatsApp",
  coupons: "Cupons de desconto",
  reviews: "Avaliações de pedidos e itens",
  agenda: "Agenda, reservas e lembretes",
  shift_management: "Abertura e encerramento de expediente",
  shift_history: "Histórico de expedientes",
  notifications: "Notificações de pedidos",
  whatsapp_provider: "Integração com provedor de WhatsApp",
  crm_integrated_messages: "Envio integrado de mensagens pelo CRM",
  assisted_integrations: "Configuração assistida das integrações",
  early_access: "Acesso antecipado a novidades",
  priority_support: "Suporte prioritário",
};

/** Funcionalidades futuras — exibidas com selo "Em breve" (Premium quando prontas). */
export const UPCOMING_PREMIUM_FEATURES: string[] = [
  "Sistema de pontos",
  "Programa de fidelidade",
  "Campanhas de aniversário",
  "Cupons automáticos de aniversário",
  "Recuperação de clientes inativos",
  "Mensagens automáticas pós-compra",
  "Automações de CRM",
  "Relatórios avançados",
  "Gestão de múltiplas unidades",
  "Permissões avançadas para funcionários",
];

export const brlFromCents = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

export const planName = (code: string | null | undefined) =>
  PLANS[(code ?? "starter") as PlanCode]?.name ?? "Mizu Starter";

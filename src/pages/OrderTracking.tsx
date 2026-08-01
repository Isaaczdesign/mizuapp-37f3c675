import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Check, Clock, ChefHat, PackageCheck, XCircle, UtensilsCrossed, Bike, Home, MapPin, ExternalLink, Copy, QrCode, CheckCircle2, Loader2, ArrowLeft, RotateCcw, CreditCard, PartyPopper } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import MpCardForm from "@/components/MpCardForm";
import { saveRecentOrder } from "@/lib/publicMenuStorage";
import { menuPath } from "@/lib/publicMenuUrl";

interface TrackingOrder {
  id: string;
  status: string;
  order_type: string;
  total: number;
  notes: string | null;
  created_at: string;
  delivery_eta: string | null;
  delivery_address: any | null;
  restaurant_address: string | null;
  restaurant_slug: string | null;
  items: { name: string; quantity: number; unit_price: number; notes: string | null }[];
}

interface PaymentStatus {
  payment_status: string;
  mp_qr_code: string | null;
  mp_qr_code_base64: string | null;
  mp_ticket_url: string | null;
  payment_method: string | null;
  mp_public_key: string | null;
  total: number | null;
  payment_expires_at: string | null;
}

const DEFAULT_FLOW: { key: string; label: string; icon: any }[] = [
  { key: "new", label: "Recebido", icon: Clock },
  { key: "preparing", label: "Preparando", icon: ChefHat },
  { key: "ready", label: "Pronto", icon: PackageCheck },
  { key: "completed", label: "Concluído", icon: Check },
];

const DELIVERY_FLOW: { key: string; label: string; icon: any }[] = [
  { key: "new", label: "Recebido", icon: Clock },
  { key: "preparing", label: "Preparando", icon: ChefHat },
  { key: "ready", label: "Pronto p/ envio", icon: PackageCheck },
  { key: "out_for_delivery", label: "A caminho", icon: Bike },
  { key: "delivered", label: "Entregue", icon: Home },
];

const fmt = (v: number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const PAYMENT_META: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Aguardando pagamento", color: "text-amber-400 bg-amber-500/15 border-amber-500/30", icon: Loader2 },
  in_process: { label: "Pagamento em análise", color: "text-amber-400 bg-amber-500/15 border-amber-500/30", icon: Loader2 },
  approved: { label: "Pagamento aprovado", color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30", icon: CheckCircle2 },
  rejected: { label: "Pagamento recusado", color: "text-red-400 bg-red-500/15 border-red-500/30", icon: XCircle },
  cancelled: { label: "Pagamento cancelado", color: "text-red-400 bg-red-500/15 border-red-500/30", icon: XCircle },
  refunded: { label: "Reembolsado", color: "text-muted-foreground bg-secondary border-border", icon: XCircle },
  not_required: { label: "Pagamento no local", color: "text-blue-400 bg-blue-500/15 border-blue-500/30", icon: CheckCircle2 },
};

export default function OrderTracking() {
  const { token } = useParams<{ token: string }>();
  const [order, setOrder] = useState<TrackingOrder | null>(null);
  const [payment, setPayment] = useState<PaymentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const [orderRes, payRes] = await Promise.all([
      (supabase as any).rpc("get_public_order", { _token: token }),
      (supabase as any).rpc("get_order_payment_status", { _token: token }),
    ]);
    const row = Array.isArray(orderRes.data) ? orderRes.data[0] : orderRes.data;
    if (!row) { setNotFound(true); setLoading(false); return; }
    setOrder(row as TrackingOrder);
    const pay = Array.isArray(payRes.data) ? payRes.data[0] : payRes.data;
    if (pay) setPayment(pay as PaymentStatus);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    load();
    // Faster polling while payment pending
    const interval = setInterval(load, payment?.payment_status === "approved" ? 8000 : 4000);
    return () => clearInterval(interval);
  }, [load, payment?.payment_status]);

  // Sem assinatura Realtime aqui: o cliente é anônimo e a RLS de `orders`
  // não expõe linhas para o papel anon — o polling acima (RPC pública
  // get_public_order) é a fonte de verdade do acompanhamento.


  // Remember this order locally so the customer can come back to it later
  useEffect(() => {
    if (!token || !order) return;
    saveRecentOrder({ token, status: order.status, slug: order.restaurant_slug });
  }, [token, order?.status, order?.restaurant_slug]);

  // ── Cancelamento pelo cliente (permitido só enquanto o status for "new") ──
  const CANCEL_REASONS = [
    "Mudei de ideia",
    "Escolhi errado / quero refazer o pedido",
    "Demora para confirmar",
    "Endereço ou forma de pagamento incorretos",
    "Outro",
  ];
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReasonType, setCancelReasonType] = useState<string>("");
  const [cancelReasonDetail, setCancelReasonDetail] = useState("");
  const [canceling, setCanceling] = useState(false);

  async function handleCancel() {
    if (!token) return;
    if (!cancelReasonType) {
      toast.error("Selecione um motivo para o cancelamento.");
      return;
    }
    if (cancelReasonType === "Outro" && cancelReasonDetail.trim().length < 3) {
      toast.error("Descreva o motivo do cancelamento.");
      return;
    }
    const fullReason = cancelReasonType === "Outro"
      ? cancelReasonDetail.trim()
      : cancelReasonDetail.trim()
        ? `${cancelReasonType} — ${cancelReasonDetail.trim()}`
        : cancelReasonType;
    setCanceling(true);
    try {
      const { data, error } = await (supabase as any).rpc("cancel_public_order", {
        _token: token,
        _reason: fullReason,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.refund_needed) {
        try {
          await supabase.functions.invoke("refund-mp-payment", { body: { tracking_token: token } });
        } catch (e) {
          console.error("Falha ao solicitar reembolso", e);
        }
      }
      toast.success("Pedido cancelado.");
      setCancelOpen(false);
      setCancelReasonType("");
      setCancelReasonDetail("");
      await load();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message?.includes("preparo")
        ? "O restaurante já começou a preparar seu pedido — não é mais possível cancelar."
        : "Não foi possível cancelar. Tente novamente.");
      await load();
    } finally {
      setCanceling(false);
    }
  }


  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Detect status transitions → toast + banner + haptic + confetti on completion
  const prevStatusRef = useRef<string | null>(null);
  const [statusBurst, setStatusBurst] = useState<{ key: string; label: string } | null>(null);
  const [celebrate, setCelebrate] = useState(false);

  const STATUS_MESSAGES: Record<string, { label: string; emoji: string; toast: string }> = {
    new: { label: "Pedido recebido", emoji: "📥", toast: "Recebemos seu pedido!" },
    preparing: { label: "Na cozinha!", emoji: "👨‍🍳", toast: "Seu pedido está sendo preparado!" },
    ready: { label: "Pronto!", emoji: "📦", toast: "Seu pedido está pronto!" },
    out_for_delivery: { label: "A caminho!", emoji: "🛵", toast: "Seu pedido saiu para entrega!" },
    delivered: { label: "Entregue!", emoji: "🎉", toast: "Pedido entregue. Bom apetite!" },
    completed: { label: "Concluído!", emoji: "🎉", toast: "Pedido concluído. Obrigado!" },
    canceled: { label: "Cancelado", emoji: "⚠️", toast: "Seu pedido foi cancelado." },
  };

  useEffect(() => {
    if (!order?.status) return;
    const prev = prevStatusRef.current;
    if (prev && prev !== order.status) {
      const meta = STATUS_MESSAGES[order.status];
      if (meta) {
        toast.success(`${meta.emoji} ${meta.toast}`);
        setStatusBurst({ key: order.status, label: meta.label });
        try { navigator.vibrate?.([80, 40, 120]); } catch {}
        if (order.status === "completed" || order.status === "delivered") {
          setCelebrate(true);
          setTimeout(() => setCelebrate(false), 3500);
        }
        setTimeout(() => setStatusBurst(null), 2600);
      }
    }
    prevStatusRef.current = order.status;
  }, [order?.status]);



  function copyPix() {
    if (!payment?.mp_qr_code) return;
    navigator.clipboard.writeText(payment.mp_qr_code);
    toast.success("Código PIX copiado!");
  }



  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-center">
        <UtensilsCrossed className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="font-display text-xl font-bold mb-2">Pedido não encontrado</h2>
        <p className="text-sm text-muted-foreground">Verifique o link recebido.</p>
      </div>
    );
  }

  const isCanceled = order.status === "canceled";
  const isTerminal = order.status === "completed" || order.status === "delivered";
  const flow = order.order_type === "delivery" ? DELIVERY_FLOW : DEFAULT_FLOW;
  const activeIdx = flow.findIndex((s) => s.key === order.status);
  const menuUrl = order.restaurant_slug ? menuPath(order.restaurant_slug) : null;

  return (
    <div className="min-h-screen bg-background px-4 py-6 max-w-lg mx-auto">
      <div className="text-center mb-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Pedido</p>
        <h1 className="font-display text-3xl font-bold gradient-text">
          #{order.id.slice(0, 8).toUpperCase()}
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          {new Date(order.created_at).toLocaleString("pt-BR")}
        </p>
      </div>

      {/* Payment status / PIX QR */}
      {payment && payment.payment_status && (() => {
        const meta = PAYMENT_META[payment.payment_status] ?? PAYMENT_META.pending;
        const PayIcon = meta.icon;
        const showQR = payment.payment_status !== "approved" && payment.mp_qr_code;
        return (
          <div className={`glass-card p-4 mb-6 border ${meta.color.split(" ").filter(c => c.startsWith("border-")).join(" ") || "border-border"}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${meta.color}`}>
                <PayIcon className={`w-5 h-5 ${payment.payment_status === "pending" || payment.payment_status === "in_process" ? "animate-spin" : ""}`} />
              </div>
              <div className="flex-1">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Status do pagamento</p>
                <p className="font-display font-bold text-sm">{meta.label}</p>
              </div>
            </div>

            {payment.payment_expires_at && (payment.payment_status === "pending" || payment.payment_status === "in_process") && (() => {
              const remainingMs = new Date(payment.payment_expires_at).getTime() - nowTs;
              if (remainingMs <= 0) {
                return (
                  <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-medium text-center">
                    Prazo expirado — cancelando pedido…
                  </div>
                );
              }
              const mm = Math.floor(remainingMs / 60000);
              const ss = Math.floor((remainingMs % 60000) / 1000);
              const urgent = remainingMs < 60000;
              return (
                <div className={`mb-3 px-3 py-2 rounded-lg border text-xs font-medium text-center ${urgent ? "bg-red-500/15 border-red-500/30 text-red-400 animate-pulse" : "bg-amber-500/10 border-amber-500/30 text-amber-400"}`}>
                  ⏱ Pague em <span className="font-bold tabular-nums">{mm}:{String(ss).padStart(2, "0")}</span> — depois disso o pedido será cancelado automaticamente.
                </div>
              );
            })()}



            {showQR && payment.mp_qr_code_base64 && (
              <div className="space-y-3">
                <div className="bg-white p-3 rounded-xl flex justify-center">
                  <img
                    src={`data:image/png;base64,${payment.mp_qr_code_base64}`}
                    alt="QR Code PIX"
                    className="w-48 h-48"
                  />
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  Escaneie com o app do seu banco ou copie o código abaixo
                </p>
                <button
                  onClick={copyPix}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
                >
                  <Copy className="w-4 h-4" />
                  Copiar código PIX
                </button>
                <p className="text-[10px] text-center text-muted-foreground">
                  Esta tela atualiza automaticamente assim que o pagamento é confirmado.
                </p>
              </div>
            )}

            {payment.payment_method === "credit_card_online"
              && payment.payment_status !== "approved"
              && payment.payment_status !== "in_process"
              && payment.mp_public_key && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-2 mb-3">
                    <CreditCard className="w-4 h-4 text-primary" />
                    <p className="text-sm font-semibold">Pague com cartão</p>
                  </div>
                  <MpCardForm
                    trackingToken={token!}
                    publicKey={payment.mp_public_key}
                    amount={Number(payment.total ?? order.total)}
                    onApproved={load}
                  />
                </div>
            )}

            {payment.payment_method === "credit_card_online" && !payment.mp_public_key && (
              <p className="text-xs text-amber-400">
                O restaurante ainda não configurou a chave pública do Mercado Pago. Escolha outra forma de pagamento.
              </p>
            )}

            {payment.payment_status === "approved" && (
              <p className="text-xs text-emerald-400">
                ✓ Pagamento confirmado. Seu pedido já foi enviado para a cozinha.
              </p>
            )}
          </div>
        );
      })()}


      {order.order_type === "delivery" && order.delivery_eta && !isCanceled && (
        <div className="glass-card p-4 mb-6 flex items-center gap-3">
          <Bike className="w-5 h-5 text-primary shrink-0" />
          <div className="flex-1">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Previsão de entrega</p>
            <p className="font-display font-bold text-lg">
              {new Date(order.delivery_eta).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>
      )}

      {order.order_type === "delivery" && order.delivery_address && (() => {
        const a = order.delivery_address;
        const line1 = [a.street, a.number].filter(Boolean).join(", ");
        const line2 = [a.neighborhood, a.city].filter(Boolean).join(" - ");
        const destination = [line1, a.complement, line2, a.cep].filter(Boolean).join(", ");
        const origin = (order.restaurant_address || "").trim();
        const mapsUrl = origin
          ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`
          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`;
        return (
          <div className="glass-card p-4 mb-6 space-y-3">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Endereço de entrega</p>
                {line1 && <p className="font-medium text-sm">{line1}</p>}
                {a.complement && <p className="text-xs text-muted-foreground">Compl.: {a.complement}</p>}
                {line2 && <p className="text-xs text-muted-foreground">{line2}</p>}
                {a.cep && <p className="text-xs text-muted-foreground">CEP: {a.cep}</p>}
              </div>
            </div>
            {origin && (
              <p className="text-[11px] text-muted-foreground pl-8">
                Rota partindo de: <span className="text-foreground">{origin}</span>
              </p>
            )}
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <ExternalLink className="w-4 h-4" />
              {origin ? "Ver rota no Google Maps" : "Abrir no Google Maps"}
            </a>
          </div>
        );
      })()}


      {/* Status change banner */}
      <AnimatePresence>
        {statusBurst && (
          <motion.div
            key={statusBurst.key}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            className="glass-card p-4 mb-4 flex items-center gap-3 border-primary/40 bg-primary/10 relative overflow-hidden"
          >
            <motion.div
              className="absolute inset-0"
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: 1.4, ease: "easeOut" }}
              style={{ background: "linear-gradient(90deg, transparent, hsl(var(--primary)/0.25), transparent)" }}
            />
            <motion.div
              initial={{ rotate: -20, scale: 0.6 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 380 }}
              className="w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl shrink-0 relative"
            >
              <span className="absolute inset-0 rounded-full bg-primary/60 animate-ping" />
              <span className="relative">{STATUS_MESSAGES[statusBurst.key]?.emoji}</span>
            </motion.div>
            <div className="relative min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-primary/80">Novo status</p>
              <p className="font-display font-bold text-base truncate">{statusBurst.label}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timeline */}
      {isCanceled ? (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="glass-card p-6 flex flex-col items-center text-center mb-6 border-destructive/30"
        >
          <motion.div
            animate={{ rotate: [0, -8, 8, -4, 0] }}
            transition={{ duration: 0.6 }}
          >
            <XCircle className="w-12 h-12 text-destructive mb-2" />
          </motion.div>
          <p className="font-display font-bold">Pedido cancelado</p>
          {(() => {
            const m = order.notes?.match(/Cancelado pelo cliente(?:\s*:\s*([^\n]+))?/i);
            if (!m) return (
              <p className="text-xs text-muted-foreground mt-1">Entre em contato com o restaurante para saber mais.</p>
            );
            const reason = m[1]?.trim();
            return (
              <div className="mt-3 w-full max-w-sm rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-left">
                <p className="text-[11px] uppercase tracking-wider text-destructive/80 font-medium">Motivo informado</p>
                <p className="text-sm text-foreground mt-0.5 break-words">
                  {reason || "Não informado"}
                </p>
              </div>
            );
          })()}

        </motion.div>
      ) : (
        <div className="glass-card p-5 mb-6">
          <div className="relative">
            {/* Vertical connector background */}
            <div className="absolute left-5 top-5 bottom-5 w-0.5 bg-secondary rounded-full" aria-hidden />
            {/* Vertical connector progress */}
            <motion.div
              className="absolute left-5 top-5 w-0.5 rounded-full bg-primary origin-top"
              initial={false}
              animate={{
                height: `calc(${Math.max(activeIdx, 0) * (100 / Math.max(flow.length - 1, 1))}% - 0px)`,
              }}
              transition={{ duration: 0.7, ease: "easeInOut" }}
              style={{ boxShadow: "0 0 12px hsl(var(--primary)/0.6)" }}
              aria-hidden
            />
            <div className="space-y-5 relative">
              {flow.map((step, i) => {
                const done = i <= activeIdx;
                const active = i === activeIdx && !isTerminal;
                const justReached = statusBurst?.key === step.key;
                const Icon = step.icon;
                return (
                  <div key={step.key} className="flex items-center gap-4">
                    <div className="relative shrink-0">
                      {active && (
                        <>
                          <motion.span
                            className="absolute inset-0 rounded-full bg-primary/40"
                            animate={{ scale: [1, 1.6, 1.9], opacity: [0.6, 0.2, 0] }}
                            transition={{ duration: 1.6, repeat: Infinity }}
                          />
                          <motion.span
                            className="absolute inset-0 rounded-full bg-primary/30"
                            animate={{ scale: [1, 1.4, 1.7], opacity: [0.5, 0.15, 0] }}
                            transition={{ duration: 1.6, repeat: Infinity, delay: 0.4 }}
                          />
                        </>
                      )}
                      <motion.div
                        initial={false}
                        animate={justReached ? { scale: [1, 1.35, 1.1], rotate: [0, -8, 0] } : { scale: active ? 1.12 : 1 }}
                        transition={{ duration: 0.55, ease: "backOut" }}
                        className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                          done
                            ? "bg-primary text-primary-foreground shadow-[0_0_18px_hsl(var(--primary)/0.55)]"
                            : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {done && !active ? (
                          <motion.div
                            initial={{ scale: 0, rotate: -30 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: "spring", stiffness: 400 }}
                          >
                            <Check className="w-4 h-4" strokeWidth={3} />
                          </motion.div>
                        ) : (
                          <Icon className="w-4 h-4" />
                        )}
                      </motion.div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <motion.p
                        animate={{ color: done ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))" }}
                        className="text-sm font-medium"
                      >
                        {step.label}
                      </motion.p>
                      {active && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="flex gap-1">
                            {[0, 1, 2].map((d) => (
                              <motion.span
                                key={d}
                                className="w-1 h-1 rounded-full bg-primary"
                                animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                                transition={{ duration: 1, repeat: Infinity, delay: d * 0.15 }}
                              />
                            ))}
                          </span>
                          <p className="text-xs text-primary font-medium">Em andamento</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}


      {/* Items */}
      <div className="glass-card p-5 space-y-3">
        <h2 className="font-display font-bold text-sm">Resumo</h2>
        <div className="space-y-2">
          {order.items?.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                <span className="text-foreground font-medium">{item.quantity}×</span> {item.name}
              </span>
              <span className="font-medium">{fmt(item.unit_price * item.quantity)}</span>
            </div>
          ))}
        </div>
        {order.notes && (
          <p className="text-xs text-muted-foreground italic border-t border-border pt-3">📝 {order.notes}</p>
        )}
        <div className="flex justify-between border-t border-border pt-3">
          <span className="font-bold">Total</span>
          <span className="font-display text-xl font-bold gradient-text">{fmt(order.total)}</span>
        </div>
      </div>

      {/* Cancelamento — disponível até o restaurante iniciar o preparo */}
      {order.status === "new" && (
        <div className="mt-6">
          {!cancelOpen ? (
            <button
              onClick={() => setCancelOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl border border-destructive/40 text-destructive text-sm font-medium hover:bg-destructive/10 transition-colors"
            >
              <XCircle className="w-4 h-4" />
              Cancelar pedido
            </button>
          ) : (
            <div className="glass-card p-4 border-destructive/30 space-y-3">
              <p className="font-display font-bold text-sm">Cancelar este pedido?</p>
              <p className="text-xs text-muted-foreground">
                Você pode cancelar enquanto o restaurante ainda não iniciou o preparo. Se o pagamento
                online já foi aprovado, o estorno é solicitado automaticamente.
              </p>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Motivo do cancelamento <span className="text-destructive">*</span>
                </label>
                <div className="grid gap-1.5">
                  {CANCEL_REASONS.map((r) => (
                    <label
                      key={r}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${
                        cancelReasonType === r
                          ? "border-destructive bg-destructive/10"
                          : "border-border bg-secondary/40 hover:bg-secondary/60"
                      }`}
                    >
                      <input
                        type="radio"
                        name="cancel-reason"
                        value={r}
                        checked={cancelReasonType === r}
                        onChange={() => setCancelReasonType(r)}
                        className="accent-destructive"
                      />
                      <span>{r}</span>
                    </label>
                  ))}
                </div>
                <textarea
                  value={cancelReasonDetail}
                  onChange={(e) => setCancelReasonDetail(e.target.value)}
                  placeholder={cancelReasonType === "Outro" ? "Conte para o restaurante o que aconteceu…" : "Detalhes adicionais (opcional)"}
                  rows={2}
                  maxLength={280}
                  className="w-full rounded-xl bg-secondary/60 border border-border px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setCancelOpen(false)}
                  disabled={canceling}
                  className="px-3 py-2.5 rounded-xl bg-secondary text-sm font-medium"
                >
                  Manter pedido
                </button>
                <button
                  onClick={handleCancel}
                  disabled={canceling}
                  className="px-3 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {canceling && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirmar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {menuUrl && (
        <div className="grid grid-cols-2 gap-3 mt-6">
          <Link
            to={menuUrl}
            className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao cardápio
          </Link>
          <Link
            to={menuUrl}
            className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <RotateCcw className="w-4 h-4" />
            Pedir novamente
          </Link>
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground mt-6">
        Atualiza automaticamente em tempo real.
      </p>

      {/* Celebration overlay on completion / delivery */}
      <AnimatePresence>
        {celebrate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] pointer-events-none flex items-center justify-center"
          >
            <div className="absolute inset-0 overflow-hidden">
              {Array.from({ length: 32 }).map((_, i) => {
                const colors = ["#FF6D00", "#FFD54F", "#7C4DFF", "#00E5FF", "#E91E63", "#4CAF50"];
                const color = colors[i % colors.length];
                const left = Math.random() * 100;
                const delay = Math.random() * 0.4;
                const duration = 1.8 + Math.random() * 1.4;
                const rotate = Math.random() * 720 - 360;
                return (
                  <motion.span
                    key={i}
                    initial={{ y: -40, x: `${left}vw`, opacity: 0, rotate: 0 }}
                    animate={{ y: "110vh", opacity: [0, 1, 1, 0], rotate }}
                    transition={{ duration, delay, ease: "easeIn" }}
                    className="absolute top-0 w-2 h-3 rounded-sm"
                    style={{ backgroundColor: color }}
                  />
                );
              })}
            </div>
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className="glass-card px-6 py-5 flex items-center gap-3 border-primary/40 bg-primary/10 backdrop-blur-xl"
            >
              <PartyPopper className="w-8 h-8 text-primary" />
              <div>
                <p className="font-display font-bold text-lg">Bom apetite! 🎉</p>
                <p className="text-xs text-muted-foreground">Obrigado por pedir com a gente.</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

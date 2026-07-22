import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Check, Clock, ChefHat, PackageCheck, Truck, XCircle, UtensilsCrossed, Bike, Home, MapPin, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";

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
  items: { name: string; quantity: number; unit_price: number; notes: string | null }[];
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

export default function OrderTracking() {
  const { token } = useParams<{ token: string }>();
  const [order, setOrder] = useState<TrackingOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const { data } = await (supabase as any).rpc("get_public_order", { _token: token });
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) { setNotFound(true); setLoading(false); return; }
    setOrder(row as TrackingOrder);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [load]);

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
  const flow = order.order_type === "delivery" ? DELIVERY_FLOW : DEFAULT_FLOW;
  const activeIdx = flow.findIndex((s) => s.key === order.status);

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


      {/* Timeline */}
      {isCanceled ? (
        <div className="glass-card p-6 flex flex-col items-center text-center mb-6">
          <XCircle className="w-12 h-12 text-destructive mb-2" />
          <p className="font-display font-bold">Pedido cancelado</p>
          <p className="text-xs text-muted-foreground mt-1">Entre em contato com o restaurante para saber mais.</p>
        </div>
      ) : (
        <div className="glass-card p-5 mb-6">
          <div className="space-y-4">
            {flow.map((step, i) => {
              const done = i <= activeIdx;
              const active = i === activeIdx;
              const Icon = step.icon;
              return (
                <div key={step.key} className="flex items-center gap-3">
                  <motion.div
                    initial={false}
                    animate={{ scale: active ? 1.1 : 1 }}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                      done ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </motion.div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${done ? "text-foreground" : "text-muted-foreground"}`}>
                      {step.label}
                    </p>
                    {active && (
                      <p className="text-xs text-primary animate-pulse">Em andamento…</p>
                    )}
                  </div>
                  {done && <Check className="w-4 h-4 text-primary" />}
                </div>
              );
            })}
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

      <p className="text-center text-xs text-muted-foreground mt-6">
        Atualiza automaticamente a cada 8 segundos.
      </p>
    </div>
  );
}

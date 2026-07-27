import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { audit, resolveTenant } from "../_shared/tenant.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { order_id, event } = await req.json();
    if (!order_id || !event) {
      return new Response(JSON.stringify({ error: "order_id and event required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Staff-only endpoint: the tenant always comes from the JWT, never from the body.
    const tenant = await resolveTenant(req, supabase);
    if (!tenant) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: order, error: oErr } = await supabase
      .from("orders")
      .select("id, restaurant_id, tracking_token, delivery_eta, order_type, customers(name, whatsapp), restaurants(name, slug), restaurant_tables(number)")
      .eq("id", order_id)
      .eq("restaurant_id", tenant.restaurantId)
      .maybeSingle();
    if (oErr || !order) {
      await audit(supabase, {
        restaurantId: tenant.restaurantId,
        userId: tenant.userId,
        action: "whatsapp.denied_or_missing_order",
        entityType: "order",
        entityId: order_id,
        metadata: { event },
      });
      return new Response(JSON.stringify({ error: "Pedido não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await audit(supabase, {
      restaurantId: tenant.restaurantId,
      userId: tenant.userId,
      action: "whatsapp.notify",
      entityType: "order",
      entityId: order_id,
      metadata: { event },
    });


    const cust: any = (order as any).customers;
    const rest: any = (order as any).restaurants;
    if (!cust?.whatsapp) {
      return new Response(JSON.stringify({ skipped: "no customer whatsapp" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: settings } = await supabase
      .from("settings")
      .select("whatsapp_provider, whatsapp_api_key, whatsapp_sender_id")
      .eq("restaurant_id", (order as any).restaurant_id)
      .maybeSingle();


    const trackingUrl = `${new URL(req.url).origin.replace(/\/functions.*/, "")}`;
    // Build customer-friendly tracking link using request Origin header when present
    const originHeader = req.headers.get("origin") ?? "";
    const trackLink = `${originHeader || trackingUrl}/pedido/${(order as any).tracking_token}`;

    const etaStr = (order as any).delivery_eta
      ? new Date((order as any).delivery_eta).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      : null;

    const restName = rest?.name ?? "nosso restaurante";

    // Canonical modality label (must match frontend src/lib/orderTypes.ts)
    const orderType = (order as any).order_type as string | null;
    const TYPE_LABEL: Record<string, string> = { dine_in: "No local", pickup: "Retirada", delivery: "Delivery" };
    const TYPE_EMOJI: Record<string, string> = { dine_in: "🍽️", pickup: "🛍️", delivery: "🛵" };
    const typeLabel = orderType ? (TYPE_LABEL[orderType] ?? orderType) : "";
    const typeEmoji = orderType ? (TYPE_EMOJI[orderType] ?? "") : "";
    const tableNum = (order as any).restaurant_tables?.number;
    const modalityLine = orderType
      ? `\n${typeEmoji} Modalidade: *${typeLabel}*${orderType === "dine_in" && tableNum ? ` — Mesa ${tableNum}` : ""}`
      : "";

    let message = "";
    if (event === "out_for_delivery") {
      message = `🛵 Olá ${cust.name}! Seu pedido em *${restName}* saiu para entrega${etaStr ? ` e chega por volta das ${etaStr}` : ""}.${modalityLine}\nAcompanhe: ${trackLink}`;
    } else if (event === "delivered") {
      message = `✅ ${cust.name}, seu pedido foi *entregue*! Obrigado pela preferência em ${restName} 🍣${modalityLine}`;
    } else if (event === "preparing") {
      message = `👨‍🍳 ${cust.name}, seu pedido em *${restName}* está sendo preparado!${modalityLine}\nAcompanhe: ${trackLink}`;
    } else if (event === "ready") {
      const readyExtra = orderType === "pickup"
        ? " Já pode vir retirar 🛍️"
        : orderType === "dine_in"
          ? " Será servido na sua mesa 🍽️"
          : etaStr ? ` Previsão de entrega: ${etaStr}.` : "";
      message = `🍱 ${cust.name}, seu pedido em *${restName}* está *pronto*!${readyExtra}${modalityLine}\nAcompanhe: ${trackLink}`;
    } else if (event === "completed") {
      message = `✅ ${cust.name}, seu pedido foi concluído! Obrigado pela preferência em ${restName} 🍣${modalityLine}`;
    } else if (event === "canceled") {
      message = `⚠️ ${cust.name}, seu pedido em *${restName}* foi *cancelado*.${modalityLine}\nEm caso de dúvidas, entre em contato conosco.`;
    } else if (event === "edited") {
      message = `✏️ ${cust.name}, seu pedido em *${restName}* foi *atualizado* pelo restaurante.${modalityLine}\nConfira os novos detalhes: ${trackLink}`;
    } else {
      return new Response(JSON.stringify({ skipped: "unsupported event" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phone = cust.whatsapp.replace(/\D/g, "");
    let status = "sent";
    let providerMessageId: string | null = null;

    if (settings?.whatsapp_provider === "meta" && settings?.whatsapp_api_key && (settings as any)?.whatsapp_sender_id) {
      try {
        const res = await fetch(
          `https://graph.facebook.com/v21.0/${(settings as any).whatsapp_sender_id}/messages`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${settings.whatsapp_api_key}`,
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: phone,
              type: "text",
              text: { preview_url: true, body: message },
            }),
          },
        );
        if (!res.ok) {
          const errorBody = await res.text();
          console.error(`Meta WhatsApp send failed [${res.status}]: ${errorBody}`);
          status = "failed";
        } else {
          const j = await res.json().catch(() => ({}));
          providerMessageId = j?.messages?.[0]?.id ?? null;
        }
      } catch (e) {
        console.error("meta whatsapp send error", e);
        status = "failed";
      }
    } else {
      // No provider configured — log as skipped but still record intent
      status = "skipped_no_provider";
      console.log(`[whatsapp:${event}] would send to ${phone}: ${message}`);
    }


    await supabase.from("message_logs").insert({
      customer_id: null,
      restaurant_id: (order as any).restaurant_id,
      trigger: `order.${event}`,
      message,
      status,
      provider_message_id: providerMessageId,
    } as any);

    return new Response(JSON.stringify({ success: true, status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-order-whatsapp error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

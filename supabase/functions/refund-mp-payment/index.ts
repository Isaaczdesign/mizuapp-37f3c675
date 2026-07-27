// Refunds a Mercado Pago payment (PIX or card) in full.
// Two authorized paths:
//  - staff: authenticated user, order must belong to the tenant on their JWT (order_id)
//  - customer: unauthenticated, must prove ownership with the unguessable tracking_token
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { adminClient, audit, resolveTenant } from "../_shared/tenant.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const orderId = body?.order_id;
    const trackingToken = body?.tracking_token;
    if (!orderId && !trackingToken) return json({ error: "order_id ou tracking_token obrigatório" }, 400);

    const admin = adminClient();
    const tenant = await resolveTenant(req, admin);

    let query = admin
      .from("orders")
      .select("id, restaurant_id, mp_payment_id, payment_status, payment_method, total");
    query = trackingToken ? query.eq("tracking_token", trackingToken) : query.eq("id", orderId);

    const { data: order, error: oErr } = await query.maybeSingle();
    if (oErr || !order) return json({ error: "Pedido não encontrado" }, 404);

    // Staff path: ignore any restaurant provided by the client, enforce the JWT tenant.
    if (!trackingToken) {
      if (!tenant) return json({ error: "Não autorizado" }, 401);
      if (order.restaurant_id !== tenant.restaurantId) {
        await audit(admin, {
          restaurantId: tenant.restaurantId,
          userId: tenant.userId,
          action: "refund.denied_cross_tenant",
          entityType: "order",
          entityId: order.id,
          metadata: { attempted_restaurant_id: order.restaurant_id },
        });
        return json({ error: "Não autorizado" }, 403);
      }
    }

    await audit(admin, {
      restaurantId: order.restaurant_id,
      userId: tenant?.userId ?? null,
      action: "refund.attempt",
      entityType: "order",
      entityId: order.id,
      metadata: { via: trackingToken ? "customer_token" : "staff", payment_status: order.payment_status },
    });

    if (!order.mp_payment_id) {
      return json({ ok: true, skipped: true, reason: "Pedido sem pagamento online vinculado" });
    }
    if (order.payment_status === "refunded") {
      return json({ ok: true, already_refunded: true });
    }
    if (!["approved", "paid"].includes(String(order.payment_status))) {
      return json({ ok: true, skipped: true, reason: `Pagamento não estava aprovado (status: ${order.payment_status})` });
    }

    const { data: creds } = await admin.rpc("get_restaurant_mp_credentials", {
      _restaurant_id: order.restaurant_id,
    });
    const cred = Array.isArray(creds) ? creds[0] : creds;
    if (!cred?.access_token) return json({ error: "Mercado Pago não configurado" }, 400);

    const mpResp = await fetch(
      `https://api.mercadopago.com/v1/payments/${order.mp_payment_id}/refunds`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cred.access_token}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": `refund-${order.id}`,
        },
        body: JSON.stringify({}), // empty body = full refund
      },
    );

    const mpData = await mpResp.json().catch(() => ({}));
    if (!mpResp.ok) {
      console.error("MP refund failed", mpResp.status, mpData);
      await audit(admin, {
        restaurantId: order.restaurant_id,
        userId: tenant?.userId ?? null,
        action: "refund.failed",
        entityType: "order",
        entityId: order.id,
        metadata: { status: mpResp.status, message: mpData?.message ?? null },
      });
      return json({
        error: mpData?.message || "Falha ao reembolsar no Mercado Pago",
        details: mpData,
      }, 400);
    }

    await admin.from("orders").update({
      payment_status: "refunded",
    }).eq("id", order.id);

    await audit(admin, {
      restaurantId: order.restaurant_id,
      userId: tenant?.userId ?? null,
      action: "refund.succeeded",
      entityType: "order",
      entityId: order.id,
      metadata: { refund_id: mpData?.id ?? null, amount: mpData?.amount ?? order.total },
    });

    return json({ ok: true, refund_id: mpData?.id, amount: mpData?.amount ?? order.total });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

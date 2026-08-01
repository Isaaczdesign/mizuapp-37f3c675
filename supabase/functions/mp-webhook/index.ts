// Mercado Pago webhook receiver — keeps the order payment/status in sync automatically.
// Public (no JWT). MP sends notifications like { type: "payment", data: { id } } or ?topic=payment&id=...
// Security: the notification body is NEVER trusted. We always re-fetch the payment from the
// Mercado Pago API using the restaurant's own access token before applying any change.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const ok = () => new Response("ok", { headers: corsHeaders });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    let body: any = {};
    try { body = await req.json(); } catch { /* MP sometimes GET-pings */ }

    const paymentId =
      body?.data?.id ??
      url.searchParams.get("data.id") ??
      url.searchParams.get("id");
    const topic = body?.type ?? body?.topic ?? url.searchParams.get("topic") ?? url.searchParams.get("type");

    if (!paymentId || (topic && topic !== "payment")) return ok();

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Locate the order: by mp_payment_id, or (race with our own create call) by external_reference.
    let { data: order } = await admin
      .from("orders")
      .select("id, restaurant_id, status, payment_status, mp_payment_id")
      .eq("mp_payment_id", String(paymentId))
      .maybeSingle();

    let externalReference: string | null = null;
    if (!order) {
      // We still need a token to query MP. Use the most recent restaurant that has a pending
      // payment only if external_reference is provided in the notification body.
      externalReference = body?.data?.external_reference ?? null;
      if (externalReference) {
        const { data: byRef } = await admin
          .from("orders")
          .select("id, restaurant_id, status, payment_status, mp_payment_id")
          .eq("id", externalReference)
          .maybeSingle();
        order = byRef ?? null;
      }
    }

    if (!order) {
      console.warn("Webhook for unknown payment_id", paymentId);
      return ok(); // ack so MP stops retrying
    }

    const { data: creds } = await admin.rpc("get_restaurant_mp_credentials", {
      _restaurant_id: order.restaurant_id,
    });
    const cred = Array.isArray(creds) ? creds[0] : creds;
    if (!cred?.access_token) {
      console.error("No MP token for restaurant", order.restaurant_id);
      return ok();
    }

    const mpResp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${cred.access_token}` },
    });
    const payment = await mpResp.json();
    if (!mpResp.ok) {
      console.error("MP fetch failed", mpResp.status, payment);
      return ok();
    }

    // Sanity: the payment must belong to this order.
    if (payment?.external_reference && payment.external_reference !== order.id) {
      console.error("Payment/order mismatch", payment.external_reference, order.id);
      return ok();
    }

    const mpStatus: string = payment?.status ?? "pending";
    const detail: string | null = payment?.status_detail ?? null;

    // Idempotency: nothing to do if the status did not change.
    if (order.payment_status === mpStatus && order.mp_payment_id === String(paymentId)) {
      return ok();
    }

    const update: Record<string, unknown> = {
      payment_status: mpStatus,
      mp_payment_id: String(paymentId),
    };

    if (mpStatus === "approved") {
      // Paid: stop the 15-min expiration clock and make sure the order is live for the kitchen.
      update.payment_expires_at = null;
      if (order.status === "canceled") {
        // Approved after auto-cancel — reopen so staff can act (or refund).
        update.status = "new";
      }
    } else if (["rejected", "cancelled", "canceled"].includes(mpStatus)) {
      if (["new"].includes(String(order.status))) {
        update.status = "canceled";
      }
    }

    const { error: uErr } = await admin.from("orders").update(update).eq("id", order.id);
    if (uErr) {
      console.error("Failed to update order from webhook", uErr);
      return new Response("retry", { status: 500, headers: corsHeaders });
    }

    console.log(`Order ${order.id}: payment ${mpStatus}${detail ? ` (${detail})` : ""}`);
    return ok();
  } catch (err) {
    console.error(err);
    return ok();
  }
});

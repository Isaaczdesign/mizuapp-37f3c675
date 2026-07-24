// Refunds a Mercado Pago payment (PIX or card) in full.
// Called from the dashboard when staff cancels a paid online order.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { order_id } = await req.json();
    if (!order_id) return json({ error: "order_id required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: order, error: oErr } = await admin
      .from("orders")
      .select("id, restaurant_id, mp_payment_id, payment_status, payment_method, total")
      .eq("id", order_id)
      .maybeSingle();

    if (oErr || !order) return json({ error: "Pedido não encontrado" }, 404);
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
      return json({
        error: mpData?.message || "Falha ao reembolsar no Mercado Pago",
        details: mpData,
      }, 400);
    }

    await admin.from("orders").update({
      payment_status: "refunded",
    }).eq("id", order.id);

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

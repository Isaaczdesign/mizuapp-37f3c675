// Creates a Mercado Pago PIX payment for a given order using the restaurant's own access token.
// Public (no JWT) — validated by tracking_token which is unguessable.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { tracking_token } = await req.json();
    if (!tracking_token) {
      return json({ error: "tracking_token required" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch order + restaurant credentials
    const { data: order, error: oErr } = await admin
      .from("orders")
      .select("id, restaurant_id, total, payment_status, mp_payment_id, customer_id, customers(name, whatsapp)")
      .eq("tracking_token", tracking_token)
      .maybeSingle();

    if (oErr || !order) return json({ error: "order not found" }, 404);
    if (order.payment_status === "approved") {
      return json({ status: "approved", already_paid: true });
    }

    const { data: creds } = await admin.rpc("get_restaurant_mp_credentials", {
      _restaurant_id: order.restaurant_id,
    });
    const cred = Array.isArray(creds) ? creds[0] : creds;
    if (!cred?.enabled || !cred?.access_token) {
      return json({ error: "Mercado Pago não configurado para este restaurante" }, 400);
    }
    if (cred.access_token.startsWith("TEST-")) {
      return json({
        error: "O restaurante está usando credenciais de teste do Mercado Pago (TEST-). PIX de sandbox não é aceito por bancos reais. Configure o Access Token de produção (APP_USR-) em Configurações → Mercado Pago.",
      }, 400);
    }


    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/mp-webhook`;
    const customerName = (order as any).customers?.name ?? "Cliente";
    const idempotencyKey = crypto.randomUUID();

    const mpResp = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cred.access_token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        transaction_amount: Number(order.total),
        description: `Pedido ${order.id.slice(0, 8)}`,
        payment_method_id: "pix",
        external_reference: order.id,
        notification_url: webhookUrl,
        payer: {
          email: `cliente-${order.id.slice(0, 8)}@koban.app`,
          first_name: customerName.split(" ")[0] || "Cliente",
        },
      }),
    });

    const mpData = await mpResp.json();
    if (!mpResp.ok) {
      console.error("MP payment creation failed", mpData);
      return json({ error: "Falha ao criar pagamento no Mercado Pago", details: mpData }, mpResp.status);
    }

    const qr = mpData?.point_of_interaction?.transaction_data;

    await admin.from("orders").update({
      mp_payment_id: String(mpData.id),
      mp_qr_code: qr?.qr_code ?? null,
      mp_qr_code_base64: qr?.qr_code_base64 ?? null,
      mp_ticket_url: qr?.ticket_url ?? null,
      payment_status: mpData.status ?? "pending",
    }).eq("id", order.id);

    return json({
      status: mpData.status,
      qr_code: qr?.qr_code,
      qr_code_base64: qr?.qr_code_base64,
      ticket_url: qr?.ticket_url,
      payment_id: mpData.id,
    });
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

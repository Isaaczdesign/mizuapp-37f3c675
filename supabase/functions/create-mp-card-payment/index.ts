// Charges a credit/debit card via Mercado Pago using a card token generated on the client (PCI-safe).
// The client uses MercadoPago.js v2 to tokenize card data — raw PAN/CVV never touches our server.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      tracking_token,
      card_token_id,
      payment_method_id,
      issuer_id,
      installments,
      payer_email,
      identification_type,
      identification_number,
    } = body ?? {};

    if (!tracking_token || !card_token_id || !payment_method_id) {
      return json({ error: "Parâmetros obrigatórios faltando" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: order, error: oErr } = await admin
      .from("orders")
      .select("id, restaurant_id, total, payment_status, mp_payment_id, customer_id, customers(name, whatsapp)")
      .eq("tracking_token", tracking_token)
      .maybeSingle();

    if (oErr || !order) return json({ error: "Pedido não encontrado" }, 404);
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
        error: "Restaurante está em modo de teste do Mercado Pago (TEST-). Cartões reais não serão aceitos. Configure o Access Token de produção (APP_USR-).",
      }, 400);
    }

    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/mp-webhook`;
    const customerName: string = (order as any).customers?.name ?? "Cliente";
    const idempotencyKey = crypto.randomUUID();
    const finalInstallments = Math.min(Math.max(Number(installments) || 1, 1), 3); // enforce max 3x

    const amount = Math.round(Number(order.total) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0) {
      return json({ error: "Valor do pedido inválido" }, 400);
    }
    const payload: Record<string, unknown> = {
      transaction_amount: amount,
      description: `Pedido ${order.id.slice(0, 8)}`,
      token: card_token_id,
      installments: finalInstallments,
      payment_method_id,
      external_reference: order.id,
      notification_url: webhookUrl,
      statement_descriptor: "KOBAN",
      payer: {
        email: payer_email || `cliente-${order.id.slice(0, 8)}@koban.app`,
        first_name: customerName.split(" ")[0] || "Cliente",
        ...(identification_type && identification_number
          ? { identification: { type: identification_type, number: identification_number } }
          : {}),
      },
    };
    if (issuer_id) (payload as any).issuer_id = issuer_id;

    const mpResp = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cred.access_token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    const mpData = await mpResp.json();
    if (!mpResp.ok) {
      console.error("MP card payment failed", mpResp.status, mpData);
      return json({
        error: mpData?.message || "Falha ao processar pagamento",
        status_detail: mpData?.status_detail,
        details: mpData,
      }, mpResp.status);
    }

    await admin.from("orders").update({
      mp_payment_id: String(mpData.id),
      payment_status: mpData.status ?? "pending",
    }).eq("id", order.id);

    return json({
      status: mpData.status,
      status_detail: mpData.status_detail,
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

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

interface Props {
  trackingToken: string;
  publicKey: string;
  amount: number;
  onApproved: () => void;
}

declare global {
  interface Window {
    MercadoPago?: any;
  }
}

const SDK_URL = "https://sdk.mercadopago.com/js/v2";

function loadSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.MercadoPago) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_URL}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Falha ao carregar SDK")));
      return;
    }
    const s = document.createElement("script");
    s.src = SDK_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Falha ao carregar SDK"));
    document.head.appendChild(s);
  });
}

const fmt = (v: number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function MpCardForm({ trackingToken, publicKey, amount, onApproved }: Props) {
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [installments, setInstallments] = useState(1);
  const [cardNumber, setCardNumber] = useState("");
  const [cardholder, setCardholder] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [docType, setDocType] = useState("CPF");
  const [docNumber, setDocNumber] = useState("");
  const [email, setEmail] = useState("");
  const [detectedPm, setDetectedPm] = useState<{ id: string; name: string } | null>(null);
  const mpRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadSdk();
        if (cancelled) return;
        mpRef.current = new window.MercadoPago(publicKey, { locale: "pt-BR" });
        setReady(true);
      } catch (e: any) {
        toast.error("Não foi possível carregar o formulário de cartão");
      }
    })();
    return () => { cancelled = true; };
  }, [publicKey]);

  // Detect card brand as user types (BIN >= 6 digits)
  useEffect(() => {
    const bin = cardNumber.replace(/\D/g, "").slice(0, 8);
    if (!mpRef.current || bin.length < 6) { setDetectedPm(null); return; }
    let cancelled = false;
    mpRef.current.getPaymentMethods({ bin }).then((res: any) => {
      if (cancelled) return;
      const pm = res?.results?.[0];
      if (pm) setDetectedPm({ id: pm.id, name: pm.name });
      else setDetectedPm(null);
    }).catch(() => setDetectedPm(null));
    return () => { cancelled = true; };
  }, [cardNumber]);

  function formatCard(v: string) {
    return v.replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim();
  }
  function formatExpiry(v: string) {
    const d = v.replace(/\D/g, "").slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!mpRef.current) return;
    const [mm, yy] = expiry.split("/");
    if (!mm || !yy || mm.length !== 2 || yy.length !== 2) {
      toast.error("Data de validade inválida (MM/AA)"); return;
    }
    if (cardNumber.replace(/\D/g, "").length < 13) { toast.error("Número do cartão inválido"); return; }
    if (cvv.length < 3) { toast.error("CVV inválido"); return; }
    if (!cardholder.trim()) { toast.error("Informe o nome impresso no cartão"); return; }
    if (docNumber.replace(/\D/g, "").length < 8) { toast.error("Documento inválido"); return; }

    setSubmitting(true);
    try {
      const tokenResp = await mpRef.current.createCardToken({
        cardNumber: cardNumber.replace(/\D/g, ""),
        cardholderName: cardholder.trim(),
        cardExpirationMonth: mm,
        cardExpirationYear: `20${yy}`,
        securityCode: cvv,
        identificationType: docType,
        identificationNumber: docNumber.replace(/\D/g, ""),
      });

      if (!tokenResp?.id) {
        throw new Error(tokenResp?.cause?.[0]?.description || "Não foi possível validar o cartão");
      }

      const { data, error } = await supabase.functions.invoke("create-mp-card-payment", {
        body: {
          tracking_token: trackingToken,
          card_token_id: tokenResp.id,
          payment_method_id: detectedPm?.id || tokenResp.payment_method_id,
          installments,
          payer_email: email || undefined,
          identification_type: docType,
          identification_number: docNumber.replace(/\D/g, ""),
        },
      });

      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);

      const status = (data as any)?.status;
      if (status === "approved") {
        toast.success("Pagamento aprovado!");
        onApproved();
      } else if (status === "in_process" || status === "pending") {
        toast.info("Pagamento em análise. Você será notificado.");
        onApproved();
      } else {
        toast.error((data as any)?.status_detail || "Pagamento recusado. Tente outro cartão.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao processar pagamento");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex items-center gap-2 text-[11px] text-emerald-400">
        <Lock className="w-3.5 h-3.5" />
        Pagamento seguro via Mercado Pago. Seus dados não são armazenados.
      </div>

      <div>
        <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Número do cartão</label>
        <div className="relative mt-1">
          <input
            inputMode="numeric" autoComplete="cc-number"
            className="w-full bg-secondary rounded-lg px-3 py-2.5 text-sm pr-16"
            placeholder="0000 0000 0000 0000"
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCard(e.target.value))}
          />
          <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        </div>
        {detectedPm && (
          <p className="text-[10px] text-muted-foreground mt-1">Detectado: {detectedPm.name}</p>
        )}
      </div>

      <div>
        <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Nome impresso no cartão</label>
        <input
          autoComplete="cc-name"
          className="w-full bg-secondary rounded-lg px-3 py-2.5 text-sm mt-1 uppercase"
          placeholder="COMO ESTÁ NO CARTÃO"
          value={cardholder}
          onChange={(e) => setCardholder(e.target.value.toUpperCase())}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Validade</label>
          <input
            inputMode="numeric" autoComplete="cc-exp"
            className="w-full bg-secondary rounded-lg px-3 py-2.5 text-sm mt-1"
            placeholder="MM/AA"
            value={expiry}
            onChange={(e) => setExpiry(formatExpiry(e.target.value))}
          />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">CVV</label>
          <input
            inputMode="numeric" autoComplete="cc-csc"
            className="w-full bg-secondary rounded-lg px-3 py-2.5 text-sm mt-1"
            placeholder="123"
            maxLength={4}
            value={cvv}
            onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
          />
        </div>
      </div>

      <div className="grid grid-cols-[90px_1fr] gap-2">
        <div>
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Doc.</label>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="w-full bg-secondary rounded-lg px-2 py-2.5 text-sm mt-1"
          >
            <option value="CPF">CPF</option>
            <option value="CNPJ">CNPJ</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Número</label>
          <input
            inputMode="numeric"
            className="w-full bg-secondary rounded-lg px-3 py-2.5 text-sm mt-1"
            placeholder="000.000.000-00"
            value={docNumber}
            onChange={(e) => setDocNumber(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">E-mail (recibo)</label>
        <input
          type="email" autoComplete="email"
          className="w-full bg-secondary rounded-lg px-3 py-2.5 text-sm mt-1"
          placeholder="voce@email.com (opcional)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div>
        <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Parcelas</label>
        <select
          value={installments}
          onChange={(e) => setInstallments(Number(e.target.value))}
          className="w-full bg-secondary rounded-lg px-3 py-2.5 text-sm mt-1"
        >
          {[1, 2, 3].map((n) => (
            <option key={n} value={n}>
              {n}x de {fmt(amount / n)} sem juros
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={!ready || submitting}
        className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {submitting ? (<><Loader2 className="w-4 h-4 animate-spin" /> Processando…</>) : (<>Pagar {fmt(amount)}</>)}
      </button>
    </form>
  );
}

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { broadcastMenuUpdate } from "@/lib/menuRealtime";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, Crown, User, MessageSquare, Palette, CreditCard, UtensilsCrossed, Truck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useNavigate } from "react-router-dom";
import { PageShell, PageHeader } from "@/components/dashboard/ui";
import DangerZone from "@/components/settings/DangerZone";
import { menuUrl, isReservedSlug } from "@/lib/publicMenuUrl";

const DAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const PAYMENT_OPTIONS = [
  { id: "cash", label: "Dinheiro no local", icon: "💵" },
  { id: "pix", label: "Pix online", icon: "📱" },
  { id: "credit_card", label: "Cartão de crédito", icon: "💳" },
];

type OperatingHours = Record<string, { open: string; close: string; closed: boolean }>;

const defaultHours: OperatingHours = Object.fromEntries(
  DAY_KEYS.map((k) => [k, { open: "11:00", close: "23:00", closed: false }])
);

const Settings = () => {
  const { profile } = useAuth();
  const rid = profile?.restaurant_id;
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [hours, setHours] = useState<OperatingHours>(defaultHours);

  const [whatsappProvider, setWhatsappProvider] = useState("");
  const [whatsappApiKey, setWhatsappApiKey] = useState("");
  const [whatsappSenderId, setWhatsappSenderId] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<string[]>(["cash"]);
  const [dineInEnabled, setDineInEnabled] = useState(true);
  const [pickupEnabled, setPickupEnabled] = useState(true);
  const [deliveryEnabled, setDeliveryEnabled] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState<string>("0");
  const [avgPrepMinutes, setAvgPrepMinutes] = useState<string>("25");
  const [avgDeliveryMinutes, setAvgDeliveryMinutes] = useState<string>("30");
  const [address, setAddress] = useState<string>("");
  const [mpEnabled, setMpEnabled] = useState<boolean>(false);
  const [mpPixEnabled, setMpPixEnabled] = useState<boolean>(true);
  const [mpCardEnabled, setMpCardEnabled] = useState<boolean>(true);
  const [mpAccessToken, setMpAccessToken] = useState<string>("");
  const [mpPublicKey, setMpPublicKey] = useState<string>("");
  const [slug, setSlug] = useState<string>("");
  const [slugCheck, setSlugCheck] = useState<{ status: "idle" | "checking" | "available" | "taken" | "invalid" | "same"; msg?: string }>({ status: "idle" });

  const { data: restaurant } = useQuery({
    queryKey: ["restaurant", rid],
    enabled: !!rid,
    queryFn: async () => {
      const { data } = await supabase.from("restaurants").select("*").eq("id", rid!).single();
      return data;
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["settings", rid],
    enabled: !!rid,
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("*").eq("restaurant_id", rid!).maybeSingle();
      return data;
    },
  });

  const { data: subscription } = useQuery({
    queryKey: ["subscription", rid],
    enabled: !!rid,
    queryFn: async () => {
      const { data } = await supabase.from("subscriptions").select("*").eq("restaurant_id", rid!).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (restaurant) {
      setName(restaurant.name);
      setOwnerName((restaurant as any).owner_name ?? "");
      setOwnerPhone((restaurant as any).owner_phone ?? "");
      setOwnerEmail((restaurant as any).owner_email ?? "");

      const pm = (restaurant as any).payment_methods;
      if (Array.isArray(pm) && pm.length > 0) setPaymentMethods(pm);
      setDineInEnabled(((restaurant as any).dine_in_enabled ?? true) as boolean);
      setPickupEnabled(((restaurant as any).pickup_enabled ?? true) as boolean);
      setDeliveryEnabled(((restaurant as any).delivery_enabled ?? false) as boolean);
      setDeliveryFee(String((restaurant as any).delivery_fee ?? 0));
      setAddress(((restaurant as any).address ?? "") as string);
      setMpEnabled(((restaurant as any).mp_enabled ?? false) as boolean);
      setMpPixEnabled(((restaurant as any).mp_pix_enabled ?? true) as boolean);
      setMpCardEnabled(((restaurant as any).mp_card_enabled ?? true) as boolean);
      setMpAccessToken(((restaurant as any).mp_access_token ?? "") as string);
      setMpPublicKey(((restaurant as any).mp_public_key ?? "") as string);
      setSlug((restaurant as any).slug ?? "");
    }
  }, [restaurant]);

  // Slug live validation (debounced)
  useEffect(() => {
    if (!restaurant?.id) return;
    const cleaned = slug.trim().toLowerCase();
    const currentSlug = ((restaurant as any).slug ?? "").toLowerCase();
    if (!cleaned) { setSlugCheck({ status: "invalid", msg: "Slug obrigatório" }); return; }
    if (!/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/.test(cleaned)) {
      setSlugCheck({ status: "invalid", msg: "Use 3–40 caracteres: letras minúsculas, números e hífen" });
      return;
    }
    if (isReservedSlug(cleaned)) {
      setSlugCheck({ status: "invalid", msg: "Este endereço é reservado pelo sistema. Escolha outro." });
      return;
    }
    if (cleaned === currentSlug) { setSlugCheck({ status: "same" }); return; }
    setSlugCheck({ status: "checking" });
    const t = setTimeout(async () => {
      const { data, error } = await (supabase as any).rpc("check_slug_available", {
        _slug: cleaned, _restaurant_id: restaurant.id,
      });
      if (error) { setSlugCheck({ status: "invalid", msg: error.message }); return; }
      setSlugCheck(data ? { status: "available" } : { status: "taken", msg: "Este slug já está em uso" });
    }, 400);
    return () => clearTimeout(t);
  }, [slug, restaurant]);

  useEffect(() => {
    if (settings) {
      if (settings.operating_hours && typeof settings.operating_hours === "object" && !Array.isArray(settings.operating_hours)) {
        setHours({ ...defaultHours, ...(settings.operating_hours as OperatingHours) });
      }
      setWhatsappProvider(settings.whatsapp_provider ?? "");
      setWhatsappApiKey(settings.whatsapp_api_key ?? "");
      setWhatsappSenderId((settings as any).whatsapp_sender_id ?? "");
      setAvgPrepMinutes(String((settings as any).avg_prep_minutes ?? 25));
      setAvgDeliveryMinutes(String((settings as any).avg_delivery_minutes ?? 30));
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!rid) throw new Error("Restaurante não encontrado");

      // Validate slug before saving
      const cleanedSlug = slug.trim().toLowerCase();
      if (slugCheck.status === "checking") throw new Error("Aguarde a verificação do slug");
      if (slugCheck.status === "invalid" || slugCheck.status === "taken") {
        throw new Error(slugCheck.msg || "Slug inválido");
      }

      const payload: any = {
        name, owner_name: ownerName, owner_phone: ownerPhone, owner_email: ownerEmail,
        payment_methods: paymentMethods,

        dine_in_enabled: dineInEnabled, pickup_enabled: pickupEnabled,
        delivery_enabled: deliveryEnabled, delivery_fee: Number(deliveryFee) || 0,
        address: address || null,
        mp_enabled: mpEnabled,
        mp_pix_enabled: mpPixEnabled,
        mp_card_enabled: mpCardEnabled,
        mp_access_token: mpAccessToken.trim() || null,
        mp_public_key: mpPublicKey.trim() || null,
      };
      if (slugCheck.status === "available") payload.slug = cleanedSlug;

      const { error: restError } = await supabase.from("restaurants").update(payload).eq("id", rid);
      if (restError) throw restError;

      const settingsPayload: any = {
        operating_hours: hours,
        whatsapp_provider: whatsappProvider || null,
        whatsapp_api_key: whatsappApiKey || null,
        whatsapp_sender_id: whatsappSenderId || null,
        avg_prep_minutes: Math.max(0, parseInt(avgPrepMinutes, 10) || 0),
        avg_delivery_minutes: Math.max(0, parseInt(avgDeliveryMinutes, 10) || 0),
      };

      if (settings?.id) {
        const { error } = await supabase.from("settings").update(settingsPayload).eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("settings").insert({ restaurant_id: rid, ...settingsPayload });
        if (error) throw error;
      }

      // avisa o cardápio público em tempo real
      await broadcastMenuUpdate(rid, "settings");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["restaurant", rid] });
      qc.invalidateQueries({ queryKey: ["settings", rid] });
      toast.success("Configurações salvas!");
    },
    onError: (e: any) => toast.error(e.message),
  });




  const updateHour = (day: string, field: "open" | "close", value: string) => {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
  };

  const toggleDay = (day: string) => {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], closed: !prev[day].closed } }));
  };

  const togglePayment = (id: string) => {
    setPaymentMethods((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const planLabels: Record<string, string> = { free: "Gratuito", starter: "Starter", pro: "Profissional", enterprise: "Enterprise" };
  const statusLabels: Record<string, string> = { active: "Ativo", inactive: "Inativo", trial: "Trial", expired: "Expirado" };

  return (
    <AdminLayout>
      <PageShell className="max-w-2xl">
        <PageHeader emoji="⚙️" title="Configurações" subtitle="Dados do restaurante, horários, pagamentos e integrações." />

        <div className="space-y-8">
          {/* Plan Status */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <Crown className="w-5 h-5 text-primary" />
              <h2 className="font-display font-bold">Plano</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-lg font-bold">{planLabels[subscription?.plan ?? "free"] ?? subscription?.plan ?? "Gratuito"}</p>
                <p className="text-sm text-muted-foreground">
                  Status: <span className={`font-medium ${subscription?.status === "active" ? "text-green-500" : "text-destructive"}`}>
                    {statusLabels[subscription?.status ?? "active"] ?? subscription?.status ?? "Ativo"}
                  </span>
                </p>
                {subscription?.expires_at && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Expira em: {new Date(subscription.expires_at).toLocaleDateString("pt-BR")}
                  </p>
                )}
                {subscription?.started_at && (
                  <p className="text-xs text-muted-foreground">
                    Início: {new Date(subscription.started_at).toLocaleDateString("pt-BR")}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Owner info */}
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <User className="w-5 h-5 text-primary" />
              <h2 className="font-display font-bold">Responsável</h2>
            </div>
            <div>
              <Label>Nome do Responsável</Label>
              <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className="mt-1" placeholder="Nome completo" />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} className="mt-1" placeholder="(11) 99999-9999" />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} className="mt-1" placeholder="responsavel@email.com" />
            </div>
          </div>

          {/* Restaurant info */}
          <div className="glass-card p-6 space-y-4">
            <h2 className="font-display font-bold">Informações do Restaurante</h2>
            <div>
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Endereço do cardápio</Label>
              <div className="mt-1 flex items-center gap-1 rounded-xl bg-secondary/50 border border-border px-3 py-2">
                <span className="text-sm text-muted-foreground font-mono shrink-0 truncate max-w-[55%]">
                  {typeof window !== "undefined" ? window.location.host : ""}/
                </span>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  className="border-0 bg-transparent px-0 h-auto font-mono text-sm focus-visible:ring-0"
                  placeholder="meu-restaurante"
                  maxLength={40}
                />
              </div>
              <div className="mt-1.5 text-xs flex items-center gap-1.5 min-h-[16px]">
                {slugCheck.status === "checking" && <span className="text-muted-foreground">Verificando…</span>}
                {slugCheck.status === "available" && <span className="text-green-500">✓ Disponível — não esqueça de salvar</span>}
                {slugCheck.status === "taken" && <span className="text-destructive">✕ {slugCheck.msg}</span>}
                {slugCheck.status === "invalid" && <span className="text-destructive">✕ {slugCheck.msg}</span>}
                {slugCheck.status === "same" && <span className="text-muted-foreground">Endereço atual</span>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Link curto e memorável (ex: <span className="font-mono">{menuUrl("sushi-do-isaac").replace(/^https?:\/\//, "")}</span>).
                Os links antigos <span className="font-mono">/r/{slug || "slug"}</span> continuam funcionando.
              </p>

            </div>
            <div className="rounded-xl border border-border bg-secondary/30 p-4 flex items-start gap-3">
              <Palette className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">Personalização do cardápio público</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Logo, banner, descrição, cor principal e templates agora ficam em Cardápio → Personalizar.
                </p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/menu-admin")}>
                  Ir para Personalizar
                </Button>
              </div>
            </div>
          </div>


          {/* Operating hours */}
          <div className="glass-card p-6 space-y-4">
            <h2 className="font-display font-bold">Horário de Funcionamento</h2>
            <div className="space-y-3">
              {DAY_KEYS.map((key, i) => (
                <div key={key} className="flex items-center gap-3">
                  <button onClick={() => toggleDay(key)}
                    className={`w-20 text-left text-sm font-medium transition-colors ${hours[key]?.closed ? "text-muted-foreground line-through" : "text-foreground"}`}>
                    {DAYS[i]}
                  </button>
                  {hours[key]?.closed ? (
                    <span className="text-sm text-muted-foreground">Fechado</span>
                  ) : (
                    <>
                      <Input type="time" value={hours[key]?.open ?? "11:00"} onChange={(e) => updateHour(key, "open", e.target.value)} className="w-28 text-sm" />
                      <span className="text-muted-foreground text-sm">até</span>
                      <Input type="time" value={hours[key]?.close ?? "23:00"} onChange={(e) => updateHour(key, "close", e.target.value)} className="w-28 text-sm" />
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Tipos de atendimento */}
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <Truck className="w-5 h-5 text-primary" />
              <h2 className="font-display font-bold">Tipos de Atendimento</h2>
            </div>
            <p className="text-sm text-muted-foreground">Escolha quais opções aparecem para o cliente no checkout do cardápio público.</p>
            <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/40 border border-border">
              <div>
                <p className="font-medium text-sm">🍽️ Consumo no local (Mesa)</p>
                <p className="text-xs text-muted-foreground">Pedido vinculado a uma mesa via QR Code</p>
              </div>
              <Switch checked={dineInEnabled} onCheckedChange={setDineInEnabled} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/40 border border-border">
              <div>
                <p className="font-medium text-sm">🛍️ Retirada no balcão</p>
                <p className="text-xs text-muted-foreground">Cliente busca o pedido no restaurante</p>
              </div>
              <Switch checked={pickupEnabled} onCheckedChange={setPickupEnabled} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/40 border border-border">
              <div>
                <p className="font-medium text-sm">🛵 Delivery</p>
                <p className="text-xs text-muted-foreground">Entrega no endereço do cliente</p>
              </div>
              <Switch checked={deliveryEnabled} onCheckedChange={setDeliveryEnabled} />
            </div>
            {deliveryEnabled && (
              <>
                <div>
                  <Label>Endereço da unidade (origem da rota)</Label>
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="mt-1"
                    placeholder="Ex: Rua das Flores, 123 - Centro, São Paulo - SP"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Usado para gerar a rota no Google Maps da unidade até o endereço do cliente.
                  </p>
                </div>
                <div>
                  <Label>Taxa de entrega (R$)</Label>
                  <Input
                    type="number" min="0" step="0.01"
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(e.target.value)}
                    className="mt-1 max-w-[160px]"
                    placeholder="0,00"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Tempo médio de preparo (min)</Label>
                    <Input
                      type="number" min="0" step="1"
                      value={avgPrepMinutes}
                      onChange={(e) => setAvgPrepMinutes(e.target.value)}
                      className="mt-1"
                      placeholder="25"
                    />
                  </div>
                  <div>
                    <Label>Tempo médio de entrega (min)</Label>
                    <Input
                      type="number" min="0" step="1"
                      value={avgDeliveryMinutes}
                      onChange={(e) => setAvgDeliveryMinutes(e.target.value)}
                      className="mt-1"
                      placeholder="30"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  A previsão de entrega (ETA) é calculada automaticamente ao marcar o pedido como <strong>Pronto p/ envio</strong>: horário atual + tempo médio de entrega.
                </p>
              </>
            )}
          </div>

          {/* Payment Methods */}
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <CreditCard className="w-5 h-5 text-primary" />
              <h2 className="font-display font-bold">Métodos de Pagamento</h2>
            </div>
            <div className="grid gap-3">
              {PAYMENT_OPTIONS.map((opt) => {
                const selected = paymentMethods.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    onClick={() => togglePayment(opt.id)}
                    className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${
                      selected
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-card/40 text-muted-foreground hover:border-muted-foreground/30"
                    }`}
                  >
                    <span className="text-xl">{opt.icon}</span>
                    <span className="font-medium text-sm">{opt.label}</span>
                    {selected && (
                      <span className="ml-auto text-primary text-xs font-semibold">Ativo</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mercado Pago (pagamentos online) */}
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <CreditCard className="w-5 h-5 text-primary" />
              <h2 className="font-display font-bold">Mercado Pago (pagamentos online)</h2>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              Ative para receber PIX e cartão direto na sua conta Mercado Pago. Pegue suas credenciais em{" "}
              <a href="https://www.mercadopago.com.br/developers/panel/app" target="_blank" rel="noreferrer" className="text-primary underline">
                mercadopago.com.br/developers/panel
              </a>
              . Use o <strong>Access Token de Produção</strong> (começa com <code>APP_USR-</code>) para receber pagamentos de verdade.
            </p>
            {mpAccessToken.trim().startsWith("TEST-") && (
              <div className="p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-200 text-xs">
                ⚠️ <strong>Credencial de teste (sandbox) detectada.</strong> PIX gerado com token <code>TEST-</code> não existe no sistema bancário real —
                seu banco vai recusar com "PIX não encontrado". Substitua pelo <strong>Access Token de Produção</strong> (começa com <code>APP_USR-</code>)
                em <em>Mercado Pago → Suas integrações → Credenciais de produção</em>.
              </div>
            )}
            <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card/40">
              <div>
                <p className="font-medium text-sm">Ativar pagamentos online</p>
                <p className="text-xs text-muted-foreground">Cliente paga na hora e o pedido chega marcado como pago.</p>
              </div>
              <Switch checked={mpEnabled} onCheckedChange={setMpEnabled} />
            </div>

            <div className={`grid gap-3 sm:grid-cols-2 ${mpEnabled ? "" : "opacity-50 pointer-events-none"}`}>
              <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card/40">
                <div>
                  <p className="font-medium text-sm">Aceitar PIX</p>
                  <p className="text-xs text-muted-foreground">QR Code na hora do checkout.</p>
                </div>
                <Switch checked={mpPixEnabled} onCheckedChange={setMpPixEnabled} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card/40">
                <div>
                  <p className="font-medium text-sm">Aceitar cartão</p>
                  <p className="text-xs text-muted-foreground">Crédito online em até 3x sem juros.</p>
                </div>
                <Switch checked={mpCardEnabled} onCheckedChange={setMpCardEnabled} />
              </div>
            </div>
            {mpEnabled && !mpPixEnabled && !mpCardEnabled && (
              <p className="text-[11px] text-amber-300">Ative pelo menos PIX ou cartão para o cliente conseguir pagar online.</p>
            )}

            <div>
              <Label>Access Token (Produção)</Label>
              <Input
                type="password"
                value={mpAccessToken}
                onChange={(e) => setMpAccessToken(e.target.value)}
                className="mt-1 font-mono"
                placeholder="APP_USR-..."
                autoComplete="off"
              />
            </div>
            <div>
              <Label>Public Key (opcional)</Label>
              <Input
                value={mpPublicKey}
                onChange={(e) => setMpPublicKey(e.target.value)}
                className="mt-1 font-mono"
                placeholder="APP_USR-..."
                autoComplete="off"
              />
            </div>

            <div className="text-[11px] text-muted-foreground p-2 rounded-lg bg-secondary/40">
              <strong>Webhook do Mercado Pago:</strong> configure no painel MP para{" "}
              <code className="text-primary">https://rfeljyjaebgoehnlxxxk.supabase.co/functions/v1/mp-webhook</code>{" "}
              (eventos: <code>payment</code>).
            </div>
          </div>



          {/* Menu Shortcut */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-3">
              <UtensilsCrossed className="w-5 h-5 text-primary" />
              <h2 className="font-display font-bold">Cardápio</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Gerencie categorias, itens, preços, variações e adicionais do seu cardápio.
            </p>
            <Button variant="outline" onClick={() => navigate("/menu-admin")} className="w-full">
              <UtensilsCrossed className="w-4 h-4 mr-2" /> Abrir Gestão de Cardápio
            </Button>
          </div>

          {/* WhatsApp Provider */}
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              <h2 className="font-display font-bold">WhatsApp (Provedor)</h2>
            </div>
            <div>
              <Label>Provedor</Label>
              <Select value={whatsappProvider} onValueChange={setWhatsappProvider}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="meta">Meta WhatsApp Cloud API</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Access Token</Label>
              <Input type="password" value={whatsappApiKey} onChange={(e) => setWhatsappApiKey(e.target.value)} className="mt-1" placeholder="Token permanente da Meta" />
            </div>
            <div>
              <Label>Phone Number ID</Label>
              <Input value={whatsappSenderId} onChange={(e) => setWhatsappSenderId(e.target.value)} className="mt-1" placeholder="Ex.: 123456789012345" />
            </div>

          </div>

          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !rid} className="w-full">
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? "Salvando..." : "Salvar Configurações"}
          </Button>

          <DangerZone />
        </div>
      </PageShell>
    </AdminLayout>
  );
};

export default Settings;

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, Upload, Crown, User, Globe, MessageSquare, Palette, CreditCard, UtensilsCrossed, Truck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useNavigate } from "react-router-dom";

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
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [hours, setHours] = useState<OperatingHours>(defaultHours);
  const [primaryColor, setPrimaryColor] = useState("#FF6B35");
  const [description, setDescription] = useState("");
  const [pickupNote, setPickupNote] = useState("");
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
      setLogoPreview(restaurant.logo_url);
      setOwnerName((restaurant as any).owner_name ?? "");
      setOwnerPhone((restaurant as any).owner_phone ?? "");
      setOwnerEmail((restaurant as any).owner_email ?? "");
      setPrimaryColor((restaurant as any).primary_color ?? "#FF6B35");
      setBannerPreview((restaurant as any).banner_url ?? null);
      setDescription((restaurant as any).description ?? "");
      setPickupNote((restaurant as any).pickup_dine_in_note ?? "");
      const pm = (restaurant as any).payment_methods;
      if (Array.isArray(pm) && pm.length > 0) setPaymentMethods(pm);
      setDineInEnabled(((restaurant as any).dine_in_enabled ?? true) as boolean);
      setPickupEnabled(((restaurant as any).pickup_enabled ?? true) as boolean);
      setDeliveryEnabled(((restaurant as any).delivery_enabled ?? false) as boolean);
      setDeliveryFee(String((restaurant as any).delivery_fee ?? 0));
    }
  }, [restaurant]);

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
      let logo_url = restaurant?.logo_url ?? null;
      let banner_url = (restaurant as any)?.banner_url ?? null;

      const uploadViaEdge = async (file: File, kind: "logo" | "banner") => {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("kind", kind);
        const { data, error } = await supabase.functions.invoke("upload-restaurant-image", { body: fd });
        if (error) throw new Error(`Falha ao enviar ${kind}: ${error.message}`);
        if (!data?.url) throw new Error(`Falha ao enviar ${kind}`);
        return data.url as string;
      };

      if (logoFile) logo_url = await uploadViaEdge(logoFile, "logo");
      if (bannerFile) banner_url = await uploadViaEdge(bannerFile, "banner");

      const { error: restError } = await supabase
        .from("restaurants")
        .update({
          name, logo_url, owner_name: ownerName, owner_phone: ownerPhone, owner_email: ownerEmail,
          primary_color: primaryColor, banner_url, description, pickup_dine_in_note: pickupNote,
          payment_methods: paymentMethods,
          dine_in_enabled: dineInEnabled, pickup_enabled: pickupEnabled,
          delivery_enabled: deliveryEnabled, delivery_fee: Number(deliveryFee) || 0,
        } as any)
        .eq("id", rid);
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
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["restaurant", rid] });
      qc.invalidateQueries({ queryKey: ["settings", rid] });
      toast.success("Configurações salvas!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setLogoFile(file); setLogoPreview(URL.createObjectURL(file)); }
  };

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setBannerFile(file); setBannerPreview(URL.createObjectURL(file)); }
  };

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
      <div className="p-6 max-w-2xl">
        <h1 className="font-display text-2xl md:text-3xl font-bold mb-6">⚙️ <span className="gradient-text">Configurações</span></h1>

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
              <Label>Slug (URL pública)</Label>
              <p className="text-sm text-muted-foreground font-mono mt-1">/r/{restaurant?.slug ?? "..."}</p>
            </div>
            <div>
              <Label>Logomarca</Label>
              <div className="flex items-center gap-4 mt-2">
                {logoPreview && <img src={logoPreview} alt="Logo" className="w-16 h-16 rounded-xl object-cover border border-border" />}
                <label className="cursor-pointer">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary text-sm hover:bg-secondary/80 transition-colors">
                    <Upload className="w-4 h-4" /> Enviar logo
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                </label>
              </div>
            </div>
          </div>

          {/* Public Page customization */}
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <Globe className="w-5 h-5 text-primary" />
              <h2 className="font-display font-bold">Página Pública</h2>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" rows={2} placeholder="Descrição do seu restaurante..." />
            </div>
            <div>
              <Label>Nota de Retirada / Dine-in</Label>
              <Input value={pickupNote} onChange={(e) => setPickupNote(e.target.value)} className="mt-1" placeholder="Ex: Disponível para retirada e consumo no local" />
            </div>
            <div>
              <Label className="flex items-center gap-2"><Palette className="w-4 h-4" /> Cor Principal</Label>
              <div className="flex items-center gap-3 mt-1">
                <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer border-0" />
                <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-28 font-mono text-sm" />
              </div>
            </div>
            <div>
              <Label>Banner (Imagem de Capa)</Label>
              <div className="mt-2">
                {bannerPreview && <img src={bannerPreview} alt="Banner" className="w-full h-32 rounded-xl object-cover border border-border mb-2" />}
                <label className="cursor-pointer">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary text-sm hover:bg-secondary/80 transition-colors w-fit">
                    <Upload className="w-4 h-4" /> Enviar banner
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={handleBannerChange} />
                </label>
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
              <div>
                <Label>Taxa de entrega (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(e.target.value)}
                  className="mt-1 max-w-[160px]"
                  placeholder="0,00"
                />
              </div>
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
                  <SelectItem value="twilio">Twilio</SelectItem>
                  <SelectItem value="360dialog">360Dialog</SelectItem>
                  <SelectItem value="zapi">Z-API</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>API Key</Label>
              <Input type="password" value={whatsappApiKey} onChange={(e) => setWhatsappApiKey(e.target.value)} className="mt-1" placeholder="Chave de API do provedor" />
            </div>
            <div>
              <Label>Sender ID / Phone Number ID</Label>
              <Input value={whatsappSenderId} onChange={(e) => setWhatsappSenderId(e.target.value)} className="mt-1" placeholder="ID do remetente" />
            </div>
          </div>

          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !rid} className="w-full">
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
};

export default Settings;

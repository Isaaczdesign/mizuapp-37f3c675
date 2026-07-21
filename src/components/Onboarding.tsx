import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Store, Upload, Clock, UtensilsCrossed, CreditCard, QrCode,
  ShoppingCart, ArrowRight, ArrowLeft, Check, Copy, Download,
  Palette, FileText, Plus, CheckCircle2,
} from "lucide-react";

const DAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

type OperatingHours = Record<string, { open: string; close: string; closed: boolean }>;

const defaultHours: OperatingHours = Object.fromEntries(
  DAY_KEYS.map((k) => [k, { open: "11:00", close: "23:00", closed: false }])
);

const STEPS = [
  { icon: Store, label: "Identidade" },
  { icon: Clock, label: "Horários" },
  { icon: UtensilsCrossed, label: "Cardápio" },
  { icon: CreditCard, label: "Pagamento" },
  { icon: QrCode, label: "Link & QR" },
  { icon: ShoppingCart, label: "Teste" },
];

const PAYMENT_OPTIONS = [
  { id: "cash", label: "Dinheiro no local", icon: "💵" },
  { id: "pix", label: "Pix online", icon: "📱" },
  { id: "credit_card", label: "Cartão de crédito", icon: "💳" },
];

export default function Onboarding() {
  const { user, profile } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Step 1 — Identity
  const [name, setName] = useState(() => {
    try { return localStorage.getItem("koban_signup_restaurant_name") || ""; } catch { return ""; }
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState("#F97316");

  // Step 2 — Hours
  const [hours, setHours] = useState<OperatingHours>(defaultHours);
  const [pickupEnabled, setPickupEnabled] = useState(false);
  const [dineInEnabled, setDineInEnabled] = useState(true);

  // Step 3 — Menu
  const [menuChoice, setMenuChoice] = useState<"import" | "manual" | null>(null);
  const [menuFile, setMenuFile] = useState<File | null>(null);
  const [menuUploading, setMenuUploading] = useState(false);
  const [menuImported, setMenuImported] = useState(false);
  const [menuStage, setMenuStage] = useState<"idle" | "uploading" | "analyzing" | "saving">("idle");
  const [dragOver, setDragOver] = useState(false);

  // Step 4 — Payment
  const [paymentMethods, setPaymentMethods] = useState<string[]>(["cash"]);

  // Step 5 — Public page
  const [slug, setSlug] = useState("");
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Step 6 — Test
  const [testStarted, setTestStarted] = useState(false);
  const [testComplete, setTestComplete] = useState(false);

  // If user already has a restaurant, load it and skip step 0
  useEffect(() => {
    async function loadExistingRestaurant() {
      if (profile?.restaurant_id) {
        const { data: rest } = await supabase
          .from("restaurants")
          .select("id, name, slug, primary_color, logo_url, pickup_enabled, dine_in_enabled, payment_methods")
          .eq("id", profile.restaurant_id)
          .single();
        if (rest) {
          setRestaurantId(rest.id);
          setName(rest.name);
          setSlug(rest.slug);
          setPrimaryColor(rest.primary_color || "#F97316");
          if (rest.logo_url) setLogoPreview(rest.logo_url);
          setPickupEnabled(rest.pickup_enabled);
          setDineInEnabled(rest.dine_in_enabled);
          if (Array.isArray((rest as any).payment_methods) && (rest as any).payment_methods.length) {
            setPaymentMethods((rest as any).payment_methods);
          }
          // Hydrate saved operating hours from settings
          const { data: settingsRow } = await supabase
            .from("settings").select("operating_hours").eq("restaurant_id", rest.id).maybeSingle();
          if (settingsRow && (settingsRow as any).operating_hours) {
            setHours((settingsRow as any).operating_hours as OperatingHours);
          }
          try { localStorage.removeItem("koban_signup_restaurant_name"); } catch {}
          setStep(1); // skip identity step
        }
      }
      setInitialLoading(false);
    }
    loadExistingRestaurant();
  }, [profile?.restaurant_id]);

  const progress = Math.round(((step + 1) / STEPS.length) * 100);
  const publicUrl = typeof window !== "undefined"
    ? `${window.location.origin}/r/${slug}`
    : `/r/${slug}`;

  // ---- Step 1: Create Restaurant ----
  const handleCreateRestaurant = async () => {
    if (!name.trim() || name.trim().length < 2) {
      toast.error("Nome deve ter no mínimo 2 caracteres.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-restaurant", {
        body: { restaurant_name: name.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Handle both new creation and existing restaurant (idempotent retry)
      let rest = data?.restaurant;
      if (!rest && data?.restaurant_id) {
        const { data: existing } = await supabase
          .from("restaurants")
          .select("id, slug")
          .eq("id", data.restaurant_id)
          .single();
        rest = existing;
      }
      if (!rest?.id) throw new Error("Não foi possível carregar o restaurante");

      setRestaurantId(rest.id);
      setSlug(rest.slug);

      // Upload logo if selected
      if (logoFile) {
        const ext = logoFile.name.split(".").pop();
        const path = `${rest.id}/logo.${ext}`;
        await supabase.storage.from("menu-images").upload(path, logoFile, { upsert: true });
        const { data: urlData } = supabase.storage.from("menu-images").getPublicUrl(path);
        await supabase.from("restaurants").update({
          logo_url: urlData.publicUrl,
          primary_color: primaryColor,
        } as any).eq("id", rest.id);
      } else {
        await supabase.from("restaurants").update({
          primary_color: primaryColor,
        } as any).eq("id", rest.id);
      }

      toast.success("Restaurante criado!");
      setStep(1);
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar restaurante");
    } finally {
      setLoading(false);
    }
  };

  // ---- Step 2: Save Hours ----
  const handleSaveHours = async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      // Upsert settings with hours
      const { data: existing } = await supabase.from("settings")
        .select("id").eq("restaurant_id", restaurantId).maybeSingle();

      if (existing?.id) {
        await supabase.from("settings").update({ operating_hours: hours } as any).eq("id", existing.id);
      } else {
        await supabase.from("settings").insert({ restaurant_id: restaurantId, operating_hours: hours } as any);
      }

      // Update pickup/dine-in
      await supabase.from("restaurants").update({
        pickup_enabled: pickupEnabled,
        dine_in_enabled: dineInEnabled,
      } as any).eq("id", restaurantId);

      toast.success("Horários salvos!");
      setStep(2);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ---- Step 3: Menu ----
  const handleMenuImport = async () => {
    if (!menuFile || !restaurantId) return;
    setMenuUploading(true);
    setMenuStage("uploading");
    try {
      // Sanitize filename to avoid storage "Invalid key" errors
      const safeName = menuFile.name
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]+/g, "-");
      const path = `${restaurantId}/imports/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from("menu-images").upload(path, menuFile);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("menu-images").getPublicUrl(path);

      await (supabase as any).from("menu_import_jobs").insert({
        restaurant_id: restaurantId, file_url: urlData.publicUrl, status: "uploaded",
      });

      setMenuStage("analyzing");
      const isImage = /\.(jpg|jpeg|png|webp)$/i.test(menuFile.name);
      const body = isImage
        ? { image_url: urlData.publicUrl }
        : { ocr_text: `[PDF: ${menuFile.name}]. URL: ${urlData.publicUrl}` };

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-menu`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) throw new Error("Erro ao processar cardápio");

      const parsed = await resp.json();
      setMenuStage("saving");
      // Auto-save all parsed items
      let count = 0;
      for (let ci = 0; ci < (parsed.categories ?? []).length; ci++) {
        const cat = parsed.categories[ci];
        const { data: newCat } = await supabase.from("menu_categories")
          .insert({ restaurant_id: restaurantId, name: cat.name, sort_order: ci })
          .select("id").single();
        if (!newCat) continue;
        for (const item of cat.items ?? []) {
          await supabase.from("menu_items").insert({
            restaurant_id: restaurantId, category_id: newCat.id,
            name: item.name, price: item.base_price ?? 0,
            description: item.description || null, sort_order: count,
          });
          count++;
        }
      }
      setMenuImported(true);
      toast.success(`${count} itens importados!`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setMenuUploading(false);
      setMenuStage("idle");
    }
  };

  // ---- Step 4: Payment ----
  const handleSavePayment = async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      await supabase.from("restaurants").update({
        payment_methods: paymentMethods,
      } as any).eq("id", restaurantId);
      toast.success("Métodos de pagamento salvos!");
      setStep(4);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ---- Step 6: Complete ----
  const handleComplete = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await supabase.from("profiles").update({
        onboarding_complete: true,
      } as any).eq("user_id", user.id);
      toast.success("Tudo pronto! Bem-vindo ao Kōban 🎉");
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ---- Skip onboarding ----
  const handleSkip = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await supabase.from("profiles").update({
        onboarding_complete: true,
      } as any).eq("user_id", user.id);
      toast.success("Você pode continuar a configuração em Configurações.");
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ---- Test Order simulation ----
  const handleTestOrder = async () => {
    setTestStarted(true);
    // Simulate a short delay
    await new Promise((r) => setTimeout(r, 2000));
    setTestComplete(true);
  };

  const togglePayment = (id: string) => {
    setPaymentMethods((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const updateHour = (day: string, field: "open" | "close", value: string) => {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
  };

  const toggleDay = (day: string) => {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], closed: !prev[day].closed } }));
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setLogoFile(file); setLogoPreview(URL.createObjectURL(file)); }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setLinkCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const downloadQR = () => {
    const svg = document.getElementById("onboarding-qr");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, 512, 512);
      ctx.drawImage(img, 0, 0, 512, 512);
      const a = document.createElement("a");
      a.download = `qrcode-${slug}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const canProceed = () => {
    switch (step) {
      case 0: return name.trim().length >= 2;
      case 1: return true;
      case 2: return menuImported || menuChoice === "manual";
      case 3: return paymentMethods.length > 0;
      case 4: return true;
      case 5: return testComplete;
      default: return true;
    }
  };

  const handleNext = () => {
    switch (step) {
      case 0: handleCreateRestaurant(); break;
      case 1: handleSaveHours(); break;
      case 2: setStep(3); break;
      case 3: handleSavePayment(); break;
      case 4: setStep(5); break;
      case 5: handleComplete(); break;
    }
  };

  const slideVariants = {
    enter: { opacity: 0, x: 40 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -40 },
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b border-border px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-display text-lg font-bold">
            Bem-vindo ao <span className="gradient-text">Kōban</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Você está {progress}% pronto para vender
          </p>
          <Progress value={progress} className="mt-3 h-2" />
        </div>
      </div>

      {/* Step indicators */}
      <div className="border-b border-border px-4 py-3 overflow-x-auto">
        <div className="max-w-2xl mx-auto flex gap-1">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isDone = i < step;
            const isCurrent = i === step;
            return (
              <div
                key={i}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  isCurrent ? "bg-primary/10 text-primary" :
                  isDone ? "text-primary/60" : "text-muted-foreground"
                }`}
              >
                {isDone ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-8 overflow-y-auto">
        <div className="max-w-2xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25 }}
            >
              {/* STEP 0: Identity */}
              {step === 0 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="font-display text-xl font-bold">Identidade do Restaurante</h2>
                    <p className="text-sm text-muted-foreground mt-1">Configure o nome, logo e cor do seu restaurante.</p>
                  </div>

                  <div className="glass-card p-6 space-y-5">
                    <div>
                      <Label htmlFor="r-name">Nome do Restaurante *</Label>
                      <Input id="r-name" value={name} onChange={(e) => setName(e.target.value)}
                        placeholder="Ex: Sushi Katana" className="mt-1" required minLength={2} />
                    </div>

                    <div>
                      <Label>Logomarca</Label>
                      <div className="flex items-center gap-4 mt-2">
                        {logoPreview ? (
                          <img src={logoPreview} alt="Logo" className="w-16 h-16 rounded-xl object-cover border border-border" />
                        ) : (
                          <div className="w-16 h-16 rounded-xl bg-secondary flex items-center justify-center">
                            <Store className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                        <label className="cursor-pointer">
                          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary text-sm hover:bg-secondary/80 transition-colors">
                            <Upload className="w-4 h-4" /> Enviar logo
                          </div>
                          <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                        </label>
                      </div>
                    </div>

                    <div>
                      <Label className="flex items-center gap-2"><Palette className="w-4 h-4" /> Cor Principal</Label>
                      <div className="flex items-center gap-3 mt-1">
                        <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)}
                          className="w-10 h-10 rounded-lg cursor-pointer border-0" />
                        <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)}
                          className="w-28 font-mono text-sm" />
                      </div>
                    </div>

                    {/* Live preview */}
                    <div>
                      <Label className="text-xs text-muted-foreground">Pré-visualização</Label>
                      <div className="mt-2 rounded-xl border border-border p-4 flex items-center gap-3" style={{ borderColor: primaryColor + "40" }}>
                        {logoPreview ? (
                          <img src={logoPreview} alt="" className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: primaryColor + "20" }}>
                            <Store className="w-5 h-5" style={{ color: primaryColor }} />
                          </div>
                        )}
                        <div>
                          <p className="font-display font-bold text-sm">{name || "Seu Restaurante"}</p>
                          <p className="text-xs" style={{ color: primaryColor }}>● Aberto agora</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 1: Hours */}
              {step === 1 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="font-display text-xl font-bold">Horários de Funcionamento</h2>
                    <p className="text-sm text-muted-foreground mt-1">Defina quando seu restaurante está aberto.</p>
                  </div>

                  <div className="glass-card p-6 space-y-4">
                    <div className="space-y-3">
                      {DAY_KEYS.map((key, i) => (
                        <div key={key} className="flex items-center gap-3">
                          <button
                            onClick={() => toggleDay(key)}
                            className={`w-20 text-left text-sm font-medium transition-colors ${
                              hours[key]?.closed ? "text-muted-foreground line-through" : "text-foreground"
                            }`}
                          >
                            {DAYS[i]}
                          </button>
                          {hours[key]?.closed ? (
                            <span className="text-sm text-muted-foreground">Fechado</span>
                          ) : (
                            <>
                              <Input type="time" value={hours[key]?.open ?? "11:00"}
                                onChange={(e) => updateHour(key, "open", e.target.value)} className="w-28 text-sm" />
                              <span className="text-muted-foreground text-sm">até</span>
                              <Input type="time" value={hours[key]?.close ?? "23:00"}
                                onChange={(e) => updateHour(key, "close", e.target.value)} className="w-28 text-sm" />
                            </>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-border pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Retirada (Pickup)</p>
                          <p className="text-xs text-muted-foreground">Clientes podem retirar no local</p>
                        </div>
                        <Switch checked={pickupEnabled} onCheckedChange={setPickupEnabled} />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Consumo no local (Dine-in)</p>
                          <p className="text-xs text-muted-foreground">Clientes podem comer no restaurante</p>
                        </div>
                        <Switch checked={dineInEnabled} onCheckedChange={setDineInEnabled} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Menu */}
              {step === 2 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="font-display text-xl font-bold">Monte seu Cardápio</h2>
                    <p className="text-sm text-muted-foreground mt-1">Escolha como quer adicionar seus itens.</p>
                  </div>

                  {!menuImported && !menuChoice && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <button
                        onClick={() => setMenuChoice("import")}
                        className="glass-card p-6 text-left hover:border-primary/30 transition-colors"
                      >
                        <FileText className="w-8 h-8 text-primary mb-3" />
                        <h3 className="font-display font-bold mb-1">Importar Cardápio</h3>
                        <p className="text-xs text-muted-foreground">Envie um PDF ou foto e a IA extrai tudo automaticamente.</p>
                      </button>
                      <button
                        onClick={() => setMenuChoice("manual")}
                        className="glass-card p-6 text-left hover:border-primary/30 transition-colors"
                      >
                        <Plus className="w-8 h-8 text-primary mb-3" />
                        <h3 className="font-display font-bold mb-1">Criar Manualmente</h3>
                        <p className="text-xs text-muted-foreground">Adicione categorias e itens pelo painel depois.</p>
                      </button>
                    </div>
                  )}

                  {menuChoice === "import" && !menuImported && (
                    <div className="glass-card p-6 text-center">
                      <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground mb-4">
                        Envie um PDF ou imagem do seu cardápio.
                      </p>
                      <label className="cursor-pointer">
                        <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors">
                          <FileText className="w-4 h-4" />
                          {menuUploading ? "Processando com IA..." : menuFile ? menuFile.name : "Selecionar Arquivo"}
                        </div>
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) { setMenuFile(f); }
                          }}
                          disabled={menuUploading} />
                      </label>
                      {menuFile && !menuUploading && (
                        <Button className="mt-4" onClick={handleMenuImport}>
                          <Upload className="w-4 h-4 mr-2" /> Processar com IA
                        </Button>
                      )}
                      <button
                        onClick={() => setMenuChoice(null)}
                        className="block mx-auto mt-3 text-xs text-muted-foreground hover:text-foreground"
                      >
                        ← Voltar
                      </button>
                    </div>
                  )}

                  {menuChoice === "manual" && (
                    <div className="glass-card p-6 text-center">
                      <CheckCircle2 className="w-10 h-10 text-primary mx-auto mb-3" />
                      <h3 className="font-display font-bold mb-1">Tudo certo!</h3>
                      <p className="text-sm text-muted-foreground">
                        Você pode criar seu cardápio completo no painel administrativo após finalizar o setup.
                      </p>
                    </div>
                  )}

                  {menuImported && (
                    <div className="glass-card p-6 text-center">
                      <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
                      <h3 className="font-display font-bold mb-1">Cardápio importado!</h3>
                      <p className="text-sm text-muted-foreground">
                        Seus itens foram adicionados. Você pode editar detalhes no painel.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3: Payment */}
              {step === 3 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="font-display text-xl font-bold">Formas de Pagamento</h2>
                    <p className="text-sm text-muted-foreground mt-1">Selecione como seus clientes podem pagar.</p>
                  </div>

                  <div className="glass-card p-6 space-y-3">
                    {PAYMENT_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => togglePayment(opt.id)}
                        className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all ${
                          paymentMethods.includes(opt.id)
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-border/80"
                        }`}
                      >
                        <span className="text-2xl">{opt.icon}</span>
                        <span className="font-medium text-sm flex-1 text-left">{opt.label}</span>
                        {paymentMethods.includes(opt.id) && (
                          <Check className="w-5 h-5 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* STEP 4: Public Page & QR */}
              {step === 4 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="font-display text-xl font-bold">Sua Página Pública</h2>
                    <p className="text-sm text-muted-foreground mt-1">Compartilhe com seus clientes.</p>
                  </div>

                  <div className="glass-card p-6 space-y-5">
                    <div>
                      <Label className="text-xs text-muted-foreground">Link público</Label>
                      <div className="mt-1 flex items-center gap-2">
                        <code className="flex-1 text-sm bg-secondary px-3 py-2 rounded-lg font-mono truncate">
                          {publicUrl}
                        </code>
                        <Button size="sm" variant="outline" onClick={copyLink}>
                          {linkCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-4">
                      <div className="bg-white p-4 rounded-2xl">
                        <QRCodeSVG id="onboarding-qr" value={publicUrl} size={180} />
                      </div>
                      <Button variant="outline" size="sm" onClick={downloadQR}>
                        <Download className="w-4 h-4 mr-2" /> Baixar QR Code
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 5: Test Order */}
              {step === 5 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="font-display text-xl font-bold">Faça um Pedido Teste</h2>
                    <p className="text-sm text-muted-foreground mt-1">Simule como seus clientes vão pedir.</p>
                  </div>

                  <div className="glass-card p-6 text-center space-y-4">
                    {!testStarted && (
                      <>
                        <ShoppingCart className="w-12 h-12 text-primary mx-auto" />
                        <p className="text-sm text-muted-foreground">
                          Clique abaixo para simular um pedido e ver como ele aparece no painel da cozinha.
                        </p>
                        <Button onClick={handleTestOrder}>
                          <ShoppingCart className="w-4 h-4 mr-2" /> Simular Pedido
                        </Button>
                      </>
                    )}

                    {testStarted && !testComplete && (
                      <div className="space-y-3">
                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                        <p className="text-sm text-muted-foreground">Enviando pedido teste...</p>
                      </div>
                    )}

                    {testComplete && (
                      <div className="space-y-3">
                        <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
                        <h3 className="font-display font-bold">Pedido recebido!</h3>
                        <p className="text-sm text-muted-foreground">
                          Na tela da cozinha (KDS), os pedidos aparecerão em tempo real. 
                          Você está pronto para começar a vender!
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="border-t border-border px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>

          <div className="flex items-center gap-2">
            {step < STEPS.length - 1 && restaurantId && (
              <Button
                variant="outline"
                onClick={handleSkip}
                disabled={loading}
              >
                Pular por agora
              </Button>
            )}
            <Button
              onClick={handleNext}
              disabled={loading || !canProceed()}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  Aguarde...
                </span>
              ) : step === STEPS.length - 1 ? (
                <span className="flex items-center gap-1">
                  Finalizar <Check className="w-4 h-4 ml-1" />
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  Continuar <ArrowRight className="w-4 h-4 ml-1" />
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

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
  Palette, FileText, Plus, CheckCircle2, Sparkles,
} from "lucide-react";
import { loadOnboardingDraft, saveOnboardingDraft, clearOnboardingDraft } from "@/lib/onboardingDraft";

const DAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

type OperatingHours = Record<string, { open: string; close: string; closed: boolean }>;

const defaultHours: OperatingHours = Object.fromEntries(
  DAY_KEYS.map((k) => [k, { open: "11:00", close: "23:00", closed: false }])
);

const STEPS = [
  { icon: Store, label: "Identidade", title: "Identidade do restaurante", subtitle: "Nome, logo e cor que aparecem no cardápio digital." },
  { icon: Clock, label: "Horários", title: "Horários e modalidades", subtitle: "Quando você abre e como o cliente recebe o pedido." },
  { icon: UtensilsCrossed, label: "Cardápio", title: "Monte seu cardápio", subtitle: "Importe com IA ou crie manualmente no painel." },
  { icon: CreditCard, label: "Pagamento", title: "Formas de pagamento", subtitle: "Pagamentos no local ou online via Mercado Pago." },
  { icon: QrCode, label: "Link & QR", title: "Sua página pública", subtitle: "Link exclusivo e QR Code para as mesas." },
  { icon: ShoppingCart, label: "Teste", title: "Pedido de teste", subtitle: "Veja o pedido chegando no painel e na cozinha." },
];

const PAYMENT_OPTIONS = [
  { id: "cash", label: "Dinheiro no local", hint: "Confirmação manual no painel", icon: "💵" },
  { id: "pix", label: "Pix online", hint: "QR Code automático via Mercado Pago", icon: "📱" },
  { id: "credit_card", label: "Cartão de crédito", hint: "Online com parcelamento", icon: "💳" },
];

const READY_FEATURES = [
  "Painel de pedidos em tempo real com notificações",
  "Tela de cozinha (KDS) com alertas sonoros",
  "Acompanhamento do pedido para o cliente",
  "Delivery com rota, ETA e WhatsApp automático",
  "CRM, cupons e relatórios de vendas",
  "Templates de layout para o cardápio público",
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
  const [deliveryEnabled, setDeliveryEnabled] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState("0");

  // Step 3 — Menu
  const [menuChoice, setMenuChoice] = useState<"import" | "manual" | null>(null);
  const [menuFile, setMenuFile] = useState<File | null>(null);
  const [menuUploading, setMenuUploading] = useState(false);
  const [menuImported, setMenuImported] = useState(false);
  const [menuStage, setMenuStage] = useState<"idle" | "uploading" | "analyzing" | "saving">("idle");
  const [menuJob, setMenuJob] = useState<any>(null);
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

  const [draftRestored, setDraftRestored] = useState(false);

  // If user already has a restaurant, load it and skip step 0
  useEffect(() => {
    async function loadExistingRestaurant() {
      let hydratedStep: number | null = null;
      if (profile?.restaurant_id) {
        const { data: rest } = await supabase
          .from("restaurants")
          .select("id, name, slug, primary_color, logo_url, pickup_enabled, dine_in_enabled, delivery_enabled, delivery_fee, payment_methods")
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
          setDeliveryEnabled(((rest as any).delivery_enabled ?? false) as boolean);
          setDeliveryFee(String((rest as any).delivery_fee ?? 0));
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
          hydratedStep = 1; // skip identity step
        }
      }

      // Restaura rascunho salvo automaticamente (retomar de onde parou)
      const draft = loadOnboardingDraft(user?.id);
      if (draft) {
        if (draft.name) setName(draft.name);
        if (draft.primaryColor) setPrimaryColor(draft.primaryColor);
        if (draft.hours) setHours(draft.hours as OperatingHours);
        if (typeof draft.pickupEnabled === "boolean") setPickupEnabled(draft.pickupEnabled);
        if (typeof draft.dineInEnabled === "boolean") setDineInEnabled(draft.dineInEnabled);
        if (typeof draft.deliveryEnabled === "boolean") setDeliveryEnabled(draft.deliveryEnabled);
        if (typeof draft.deliveryFee === "string") setDeliveryFee(draft.deliveryFee);
        if (draft.menuChoice !== undefined) setMenuChoice(draft.menuChoice ?? null);
        if (typeof draft.menuImported === "boolean") setMenuImported(draft.menuImported);
        if (Array.isArray(draft.paymentMethods) && draft.paymentMethods.length) setPaymentMethods(draft.paymentMethods);
        if (typeof draft.testComplete === "boolean") setTestComplete(draft.testComplete);
        if (typeof draft.step === "number") {
          const target = Math.min(Math.max(draft.step, hydratedStep ?? 0), STEPS.length - 1);
          hydratedStep = target;
          if (target > 0) toast.info("Retomamos sua configuração de onde você parou.");
        }
      }

      if (hydratedStep !== null) setStep(hydratedStep);
      setInitialLoading(false);
      setDraftRestored(true);
    }
    loadExistingRestaurant();
  }, [profile?.restaurant_id, user?.id]);

  // Salvamento automático do progresso
  useEffect(() => {
    if (!draftRestored || !user?.id) return;
    saveOnboardingDraft(user.id, {
      step, name, primaryColor, hours,
      pickupEnabled, dineInEnabled, deliveryEnabled, deliveryFee,
      menuChoice, menuImported, paymentMethods, testComplete,
    });
  }, [draftRestored, user?.id, step, name, primaryColor, hours, pickupEnabled,
      dineInEnabled, deliveryEnabled, deliveryFee, menuChoice, menuImported,
      paymentMethods, testComplete]);


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
      let newLogoUrl: string | null = null;
      if (logoFile) {
        const ext = (logoFile.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
        const path = `${rest.id}/logo.${ext}`;
        const { error: upErr } = await supabase.storage.from("menu-images").upload(path, logoFile, { upsert: true, contentType: logoFile.type });
        if (upErr) throw new Error(`Falha ao enviar logo: ${upErr.message}`);
        const { data: urlData } = supabase.storage.from("menu-images").getPublicUrl(path);
        newLogoUrl = urlData.publicUrl;
      }
      await supabase.from("restaurants").update({
        primary_color: primaryColor,
        ...(newLogoUrl ? { logo_url: newLogoUrl } : {}),
      } as any).eq("id", rest.id);

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
        delivery_enabled: deliveryEnabled,
        delivery_fee: Number(deliveryFee.replace(",", ".")) || 0,
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
    setMenuJob(null);
    try {
      // Sanitize filename to avoid storage "Invalid key" errors
      const safeName = menuFile.name
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]+/g, "-");
      const path = `${restaurantId}/imports/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from("menu-images").upload(path, menuFile);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("menu-images").getPublicUrl(path);

      const { data: job, error: jobErr } = await (supabase as any).from("menu_import_jobs").insert({
        restaurant_id: restaurantId, file_url: urlData.publicUrl, status: "uploaded",
      }).select().single();
      if (jobErr) throw jobErr;

      setMenuStage("analyzing");
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-menu`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ job_id: job.id }),
      });

      if (!resp.ok) throw new Error("Erro ao enfileirar a importação do cardápio");

      // Aguarda o job assíncrono terminar (progresso parcial vai aparecendo na tela)
      let parsed: any = null;
      const deadline = Date.now() + 20 * 60 * 1000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 3000));
        const { data: cur } = await (supabase as any).from("menu_import_jobs").select("*").eq("id", job.id).maybeSingle();
        if (!cur) continue;
        setMenuJob(cur);
        if (cur.status === "ready_for_review") { parsed = cur.parsed_result; break; }
        if (cur.status === "error") throw new Error(cur.error_message || "Falha ao processar cardápio");
      }
      if (!parsed) throw new Error("Tempo limite ao processar o cardápio. Tente reprocessar em Cardápio.");

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
      clearOnboardingDraft(user.id);
      toast.success("Tudo pronto! Bem-vindo à Mizu 🎉");
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
      clearOnboardingDraft(user.id);
      toast.success("Você pode continuar a configuração em Configurações.");
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ---- Test Order simulation (creates a real order visible in dashboard/KDS) ----
  const handleTestOrder = async () => {
    if (!restaurantId) return;
    setTestStarted(true);
    try {
      // Ensure a test customer exists (RLS: owner can insert)
      let customerId: string | null = null;
      const { data: existingCustomer } = await supabase
        .from("customers")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .eq("whatsapp", "+5500000000000")
        .maybeSingle();
      if (existingCustomer?.id) {
        customerId = existingCustomer.id;
      } else {
        const { data: newCustomer } = await supabase
          .from("customers")
          .insert({ restaurant_id: restaurantId, name: "Cliente Teste", whatsapp: "+5500000000000" } as any)
          .select("id").single();
        customerId = newCustomer?.id ?? null;
      }

      // Try to use a real menu item, fallback to a placeholder name
      const { data: sampleItem } = await supabase
        .from("menu_items")
        .select("id, name, price")
        .eq("restaurant_id", restaurantId)
        .limit(1).maybeSingle();

      const itemName = sampleItem?.name ?? "Combo Teste 8 peças";
      const itemPrice = Number(sampleItem?.price ?? 29.9);

      const testOrderType = "pickup";
      const { data: order, error: orderErr } = await supabase.from("orders")
        .insert({
          restaurant_id: restaurantId,
          customer_id: customerId,
          total: itemPrice,
          status: "new",
          order_type: testOrderType,
          table_id: null,
          delivery_address: null,
          delivery_fee: 0,
          payment_method: "cash",
          notes: "Pedido de teste do onboarding",
        } as any)
        .select("id").single();
      if (orderErr) throw orderErr;

      await supabase.from("order_items").insert({
        order_id: order!.id,
        menu_item_id: sampleItem?.id ?? null,
        name: itemName,
        quantity: 1,
        unit_price: itemPrice,
      } as any);

      setTestComplete(true);
      toast.success("Pedido teste enviado ao painel!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao enviar pedido teste");
      setTestStarted(false);
    }
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
    enter: { opacity: 0, y: 24, filter: "blur(6px)" },
    center: { opacity: 1, y: 0, filter: "blur(0px)" },
    exit: { opacity: 0, y: -18, filter: "blur(6px)" },
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const current = STEPS[step];

  return (
    <div className="relative min-h-screen bg-background flex flex-col overflow-hidden">
      {/* Ambient premium background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <motion.div
          aria-hidden
          className="absolute -top-40 -left-32 h-[420px] w-[420px] rounded-full bg-primary/10 blur-[120px]"
          animate={{ opacity: [0.35, 0.7, 0.35], scale: [1, 1.12, 1] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          aria-hidden
          className="absolute -bottom-40 -right-24 h-[460px] w-[460px] rounded-full bg-accent/10 blur-[130px]"
          animate={{ opacity: [0.25, 0.6, 0.25], scale: [1.08, 1, 1.08] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Header */}
      <div className="border-b border-border/60 backdrop-blur-xl bg-background/70 px-4 py-5">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
              <Sparkles className="w-3 h-3" /> Setup guiado
            </span>
          </motion.div>
          <h1 className="font-display text-xl sm:text-2xl font-bold mt-3 tracking-tight">
            Bem-vindo à <span className="gradient-text">Mizu</span>
          </h1>
          <div className="mt-1 flex items-baseline gap-2">
            <motion.span
              key={progress}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-display text-lg font-bold text-primary tabular-nums"
            >
              {progress}%
            </motion.span>
            <p className="text-sm text-muted-foreground">pronto para vender</p>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary/70">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-primary via-primary to-accent"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            />
          </div>
        </div>
      </div>

      {/* Step indicators */}
      <div className="border-b border-border/60 px-4 py-3 overflow-x-auto no-scrollbar">
        <div className="max-w-2xl mx-auto flex gap-1.5">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isDone = i < step;
            const isCurrent = i === step;
            return (
              <div
                key={i}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  isCurrent ? "text-primary" : isDone ? "text-primary/60" : "text-muted-foreground"
                }`}
              >
                {isCurrent && (
                  <motion.span
                    layoutId="onb-step-pill"
                    className="absolute inset-0 rounded-full bg-primary/10 border border-primary/25"
                    transition={{ type: "spring", stiffness: 300, damping: 28 }}
                  />
                )}
                <span className="relative flex items-center gap-1.5">
                  {isDone ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{s.label}</span>
                </span>
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
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="mb-6 flex items-start gap-3">
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 18 }}
                  className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary"
                >
                  <current.icon className="w-5 h-5" />
                </motion.div>
                <div>
                  <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight">{current.title}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{current.subtitle}</p>
                </div>
              </div>

              {/* STEP 0: Identity */}
              {step === 0 && (
                <div className="space-y-6">


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
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium">Delivery</p>
                          <p className="text-xs text-muted-foreground">Sua empresa faz entregas?</p>
                        </div>
                        <Switch checked={deliveryEnabled} onCheckedChange={setDeliveryEnabled} />
                      </div>
                      {deliveryEnabled && (
                        <div className="rounded-xl border border-border bg-secondary/30 p-3">
                          <Label htmlFor="delivery-fee" className="text-xs text-muted-foreground">Taxa de entrega padrão</Label>
                          <Input
                            id="delivery-fee"
                            inputMode="decimal"
                            value={deliveryFee}
                            onChange={(e) => setDeliveryFee(e.target.value)}
                            placeholder="0,00"
                            className="mt-1"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Menu */}
              {step === 2 && (
                <div className="space-y-6">
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

                  {menuChoice === "import" && !menuImported && !menuUploading && (
                    <div
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(false);
                        const f = e.dataTransfer.files?.[0];
                        if (f) setMenuFile(f);
                      }}
                      className={`glass-card p-8 text-center border-2 border-dashed transition-all ${
                        dragOver ? "border-primary bg-primary/5 scale-[1.01]" : "border-border"
                      }`}
                    >
                      <Upload className={`w-12 h-12 mx-auto mb-3 transition-colors ${dragOver ? "text-primary" : "text-muted-foreground"}`} />
                      <p className="text-sm font-medium mb-1">
                        {dragOver ? "Solte o arquivo aqui" : "Arraste e solte seu cardápio"}
                      </p>
                      <p className="text-xs text-muted-foreground mb-4">
                        PDF, JPG, PNG ou WEBP — ou clique para selecionar
                      </p>
                      <label className="cursor-pointer">
                        <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors">
                          <FileText className="w-4 h-4" />
                          {menuFile ? menuFile.name : "Selecionar Arquivo"}
                        </div>
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) setMenuFile(f);
                          }} />
                      </label>
                      {menuFile && (
                        <Button className="mt-4 ml-2" onClick={handleMenuImport}>
                          <Upload className="w-4 h-4 mr-2" /> Processar com IA
                        </Button>
                      )}
                      <button
                        onClick={() => setMenuChoice(null)}
                        className="block mx-auto mt-4 text-xs text-muted-foreground hover:text-foreground"
                      >
                        ← Voltar
                      </button>
                    </div>
                  )}

                  {menuUploading && (
                    <div className="glass-card p-8">
                      <div className="flex flex-col items-center gap-5">
                        <div className="relative w-20 h-20">
                          <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                          <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <FileText className="w-8 h-8 text-primary animate-pulse" />
                          </div>
                        </div>
                        <div className="w-full max-w-sm space-y-2">
                          {[
                            { key: "uploading", label: "Enviando arquivo" },
                            { key: "analyzing", label: "Analisando com IA" },
                            { key: "saving", label: "Salvando itens no cardápio" },
                          ].map((s, idx) => {
                            const order = ["uploading", "analyzing", "saving"];
                            const currentIdx = order.indexOf(menuStage);
                            const done = idx < currentIdx;
                            const active = idx === currentIdx;
                            return (
                              <div key={s.key} className="flex items-center gap-3 text-sm">
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                                  done ? "bg-primary text-primary-foreground" :
                                  active ? "border-2 border-primary" : "border-2 border-border"
                                }`}>
                                  {done && <Check className="w-3 h-3" />}
                                  {active && <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />}
                                </div>
                                <span className={active ? "font-medium text-foreground" : done ? "text-muted-foreground" : "text-muted-foreground/60"}>
                                  {s.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        {menuJob && (
                          <div className="w-full max-w-sm space-y-2">
                            <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                              <div className="h-full bg-primary transition-all duration-500" style={{ width: `${menuJob.progress ?? 0}%` }} />
                            </div>
                            <p className="text-xs text-muted-foreground text-center">
                              {menuJob.pages_total ? `Páginas ${menuJob.pages_processed ?? 0}/${menuJob.pages_total} · ` : ""}
                              {menuJob.items_found ?? 0} itens encontrados
                            </p>
                            {Array.isArray(menuJob.logs) && menuJob.logs.length > 0 && (
                              <div className="max-h-28 overflow-y-auto rounded-lg bg-secondary/50 p-2 space-y-1">
                                {menuJob.logs.slice(-12).map((l: any, i: number) => (
                                  <p key={i} className={`text-[10px] font-mono ${l.level === "error" ? "text-destructive" : "text-muted-foreground"}`}>
                                    {l.message}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground text-center">
                          Cardápios grandes são processados em lotes; isso pode levar alguns minutos.
                        </p>
                      </div>
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
                <div className="space-y-4">
                  <div className="glass-card p-4 sm:p-6 space-y-3">
                    {PAYMENT_OPTIONS.map((opt, i) => {
                      const active = paymentMethods.includes(opt.id);
                      return (
                        <motion.button
                          key={opt.id}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.07 }}
                          whileTap={{ scale: 0.985 }}
                          onClick={() => togglePayment(opt.id)}
                          className={`relative w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all ${
                            active
                              ? "border-primary/60 bg-primary/[0.07] shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]"
                              : "border-border hover:border-primary/30 hover:bg-secondary/40"
                          }`}
                        >
                          <span className="text-2xl">{opt.icon}</span>
                          <span className="flex-1">
                            <span className="block font-medium text-sm">{opt.label}</span>
                            <span className="block text-xs text-muted-foreground mt-0.5">{opt.hint}</span>
                          </span>
                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-full border transition-colors ${
                              active ? "border-primary bg-primary text-primary-foreground" : "border-border"
                            }`}
                          >
                            {active && <Check className="w-3.5 h-3.5" />}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground px-1">
                    Pagamentos online expiram em 15 min sem confirmação e podem ser reembolsados pelo painel.
                  </p>
                </div>
              )}

              {/* STEP 4: Public Page & QR */}
              {step === 4 && (
                <div className="space-y-4">
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
                      <p className="text-xs text-muted-foreground mt-2">
                        Você pode personalizar esse endereço depois em Configurações.
                      </p>
                    </div>

                    <div className="flex flex-col items-center gap-4">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.92, rotate: -2 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 200, damping: 18 }}
                        className="relative rounded-3xl p-[2px] bg-gradient-to-br from-primary/60 via-primary/10 to-accent/50"
                      >
                        <div className="bg-white p-4 rounded-[22px]">
                          <QRCodeSVG id="onboarding-qr" value={publicUrl} size={180} />
                        </div>
                      </motion.div>
                      <Button variant="outline" size="sm" onClick={downloadQR}>
                        <Download className="w-4 h-4 mr-2" /> Baixar QR Code
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 5: Test Order */}
              {step === 5 && (
                <div className="space-y-4">
                  <div className="glass-card p-6 text-center space-y-4">
                    {!testStarted && (
                      <>
                        <motion.div
                          animate={{ y: [0, -6, 0] }}
                          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                          className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10"
                        >
                          <ShoppingCart className="w-7 h-7 text-primary" />
                        </motion.div>
                        <p className="text-sm text-muted-foreground">
                          Simule um pedido e veja ele chegar no painel de pedidos, na cozinha (KDS) e nas notificações.
                        </p>
                        <Button onClick={handleTestOrder}>
                          <ShoppingCart className="w-4 h-4 mr-2" /> Simular Pedido
                        </Button>
                      </>
                    )}

                    {testStarted && !testComplete && (
                      <div className="space-y-3 py-2">
                        <div className="relative mx-auto h-14 w-14">
                          <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
                          <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                          <motion.div
                            className="absolute inset-0 rounded-full bg-primary/20 blur-xl"
                            animate={{ opacity: [0.3, 0.8, 0.3] }}
                            transition={{ duration: 1.6, repeat: Infinity }}
                          />
                        </div>
                        <p className="text-sm text-muted-foreground">Enviando pedido teste...</p>
                      </div>
                    )}

                    {testComplete && (
                      <div className="space-y-3">
                        <motion.div
                          initial={{ scale: 0.6, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: "spring", stiffness: 260, damping: 14 }}
                        >
                          <CheckCircle2 className="w-14 h-14 text-primary mx-auto" />
                        </motion.div>
                        <h3 className="font-display text-lg font-bold">Pedido recebido!</h3>
                        <p className="text-sm text-muted-foreground">
                          Tudo funcionando. Você está pronto para começar a vender.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="glass-card p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary mb-3">
                      Já liberado na sua conta
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {READY_FEATURES.map((f, i) => (
                        <motion.div
                          key={f}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.05 * i }}
                          className="flex items-start gap-2 text-sm text-muted-foreground"
                        >
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <span>{f}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="sticky bottom-0 border-t border-border/60 bg-background/80 backdrop-blur-xl px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">

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

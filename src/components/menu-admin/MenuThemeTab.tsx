import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { broadcastMenuUpdate } from "@/lib/menuRealtime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Check, ExternalLink, Palette, Sparkles, Smartphone, Search, ShoppingBag, Upload, ImageIcon, Trash2 } from "lucide-react";
import { MENU_THEMES, ACCENT_PRESETS, resolveMenuTheme, type MenuThemeId, type MenuTheme, type MenuDevice } from "@/lib/menuThemes";
import MenuItemCard, { type MenuCardItem } from "@/components/public-menu/MenuItemCard";

interface Props {
  restaurantId: string | undefined;
  currentTheme: string | null | undefined;
  currentThemeMobile?: string | null;
  currentThemeDesktop?: string | null;
  currentColor: string | null | undefined;
  restaurantName?: string | null;
  publicMenuUrl?: string | null;
  previewItems?: MenuCardItem[];
}


const FALLBACK_ITEMS: MenuCardItem[] = [
  { id: "p1", name: "Combo Sushi 20 peças", description: "Seleção do chef com salmão, atum e kani.", price: 89.9, image_url: null, tags: ["best_seller", "combo"] },
  { id: "p2", name: "Temaki Salmão Grelhado", description: "Cone de alga com arroz, cream cheese e salmão maçaricado.", price: 34.5, image_url: null, tags: ["chef_pick"] },
  { id: "p3", name: "Yakisoba de Frango", description: "Macarrão oriental com legumes frescos.", price: 42, image_url: null, tags: [] },
];

/** Templates sugeridos pela equipe Mizu */
const RECOMMENDED: MenuThemeId[] = ["classic", "showcase"];

export default function MenuThemeTab({ restaurantId, currentTheme, currentThemeMobile, currentThemeDesktop, currentColor, restaurantName, publicMenuUrl, previewItems }: Props) {
  const queryClient = useQueryClient();
  const savedMobile = resolveMenuTheme(currentThemeMobile ?? currentTheme).id;
  const savedDesktop = resolveMenuTheme(currentThemeDesktop ?? currentTheme).id;

  /** Aba de dispositivo que está sendo editada */
  const [device, setDevice] = useState<MenuDevice>("mobile");
  const [themeMobile, setThemeMobile] = useState<MenuThemeId>(savedMobile);
  const [themeDesktop, setThemeDesktop] = useState<MenuThemeId>(savedDesktop);
  /** Quando ativo, escolher um template aplica nos dois dispositivos */
  const [syncDevices, setSyncDevices] = useState(savedMobile === savedDesktop);
  const [color, setColor] = useState(currentColor || "#E84310");
  const [ready, setReady] = useState(false);

  const themeId = device === "mobile" ? themeMobile : themeDesktop;
  const setThemeId = (id: MenuThemeId) => {
    if (syncDevices) { setThemeMobile(id); setThemeDesktop(id); return; }
    if (device === "mobile") setThemeMobile(id); else setThemeDesktop(id);
  };


  // ——— Identidade visual do cardápio público ———
  const { data: identity } = useQuery({
    queryKey: ["menu-identity", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("restaurants")
        .select("logo_url, banner_url, description, pickup_dine_in_note")
        .eq("id", restaurantId!)
        .single();
      return data;
    },
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoRemoved, setLogoRemoved] = useState(false);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [bannerRemoved, setBannerRemoved] = useState(false);
  const [description, setDescription] = useState("");
  const [pickupNote, setPickupNote] = useState("");

  useEffect(() => {
    if (!identity) return;
    setLogoPreview((identity as any).logo_url ?? null);
    setBannerPreview((identity as any).banner_url ?? null);
    setDescription((identity as any).description ?? "");
    setPickupNote((identity as any).pickup_dine_in_note ?? "");
    setLogoFile(null); setBannerFile(null); setLogoRemoved(false); setBannerRemoved(false);
  }, [identity]);

  useEffect(() => {
    setThemeMobile(savedMobile);
    setThemeDesktop(savedDesktop);
    setSyncDevices(savedMobile === savedDesktop);
  }, [savedMobile, savedDesktop]);
  useEffect(() => { setColor(currentColor || "#E84310"); }, [currentColor]);
  useEffect(() => { const t = setTimeout(() => setReady(true), 350); return () => clearTimeout(t); }, []);

  const theme = useMemo(() => resolveMenuTheme(themeId), [themeId]);
  const items = previewItems && previewItems.length > 0 ? previewItems.slice(0, 3) : FALLBACK_ITEMS;
  const identityDirty =
    !!logoFile || !!bannerFile || logoRemoved || bannerRemoved ||
    description !== (((identity as any)?.description ?? "")) ||
    pickupNote !== (((identity as any)?.pickup_dine_in_note ?? ""));
  const dirty =
    themeMobile !== savedMobile ||
    themeDesktop !== savedDesktop ||
    color !== (currentColor || "#E84310") ||
    identityDirty;


  const pickLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setLogoFile(file); setLogoRemoved(false); setLogoPreview(URL.createObjectURL(file)); }
    e.target.value = "";
  };
  const pickBanner = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setBannerFile(file); setBannerRemoved(false); setBannerPreview(URL.createObjectURL(file)); }
    e.target.value = "";
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!restaurantId) throw new Error("Restaurante não encontrado");

      const uploadViaEdge = async (file: File, kind: "logo" | "banner") => {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("kind", kind);
        const { data, error } = await supabase.functions.invoke("upload-restaurant-image", { body: fd });
        if (error) throw new Error(`Falha ao enviar ${kind}: ${error.message}`);
        if (!data?.url) throw new Error(`Falha ao enviar ${kind}`);
        return data.url as string;
      };

      let logo_url = logoRemoved ? null : ((identity as any)?.logo_url ?? null);
      let banner_url = bannerRemoved ? null : ((identity as any)?.banner_url ?? null);
      if (logoFile) logo_url = await uploadViaEdge(logoFile, "logo");
      if (bannerFile) banner_url = await uploadViaEdge(bannerFile, "banner");

      const { error } = await supabase
        .from("restaurants")
        .update({
          menu_theme: themeId,
          primary_color: color,
          logo_url,
          banner_url,
          description: description.trim() || null,
          pickup_dine_in_note: pickupNote.trim() || null,
        })
        .eq("id", restaurantId);
      if (error) throw error;

      await broadcastMenuUpdate(restaurantId, "settings");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant"] });
      queryClient.invalidateQueries({ queryKey: ["menu-identity", restaurantId] });
      queryClient.invalidateQueries({ queryKey: ["menu-restaurant"] });
      queryClient.invalidateQueries({ queryKey: ["settings-restaurant"] });
      toast.success("Personalização do cardápio atualizada!");
    },
    onError: (e: any) => toast.error(e.message || "Não foi possível salvar"),
  });


  return (
    <div className="grid xl:grid-cols-[minmax(0,1fr)_460px] gap-8 items-start">
      {/* ————— Coluna esquerda ————— */}
      <div className="space-y-8 min-w-0">
        {/* Identidade visual */}
        <section>
          <SectionHeader
            icon={<ImageIcon className="w-4 h-4" />}
            title="Identidade visual"
            subtitle="Logo, banner e textos que o cliente vê no topo do cardápio público."
          />

          <div className="rounded-3xl border border-border/60 bg-card/60 backdrop-blur-xl p-6 space-y-6 shadow-[0_20px_60px_-40px_hsl(0_0%_0%/0.9)]">
            {/* Logo */}
            <div>
              <Label>Logomarca</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Recomendado: imagem quadrada (512x512).</p>
              <div className="flex items-center gap-4 mt-3">
                <div className="w-20 h-20 rounded-2xl border border-border bg-secondary/40 overflow-hidden flex items-center justify-center shrink-0">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-muted-foreground opacity-50" />
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <label className="cursor-pointer">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary text-sm hover:bg-secondary/80 transition-colors">
                      <Upload className="w-4 h-4" /> {logoPreview ? "Trocar logo" : "Enviar logo"}
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={pickLogo} />
                  </label>
                  {logoPreview && (
                    <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => { setLogoFile(null); setLogoPreview(null); setLogoRemoved(true); }}>
                      <Trash2 className="w-4 h-4 mr-1.5" /> Remover
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Banner */}
            <div>
              <Label>Banner (imagem de capa)</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Recomendado: 1600x600 px.</p>
              <div className="mt-3 space-y-2">
                <div className="w-full h-32 rounded-2xl border border-border bg-secondary/40 overflow-hidden flex items-center justify-center">
                  {bannerPreview ? (
                    <img src={bannerPreview} alt="Banner" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs text-muted-foreground">Nenhum banner enviado</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <label className="cursor-pointer">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary text-sm hover:bg-secondary/80 transition-colors w-fit">
                      <Upload className="w-4 h-4" /> {bannerPreview ? "Trocar banner" : "Enviar banner"}
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={pickBanner} />
                  </label>
                  {bannerPreview && (
                    <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => { setBannerFile(null); setBannerPreview(null); setBannerRemoved(true); }}>
                      <Trash2 className="w-4 h-4 mr-1.5" /> Remover
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Textos */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Descrição do restaurante</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1.5" placeholder="Ex: Sushi artesanal preparado na hora." />
              </div>
              <div>
                <Label>Nota de retirada / consumo no local</Label>
                <Input value={pickupNote} onChange={(e) => setPickupNote(e.target.value)} className="mt-1.5" placeholder="Ex: Disponível para retirada e consumo no local" />
              </div>
            </div>
          </div>
        </section>

        {/* Templates */}

        <section>
          <SectionHeader
            icon={<Smartphone className="w-4 h-4" />}
            title="Templates de layout"
            subtitle="Escolha como os itens aparecem para o cliente no cardápio público."
          />

          <LayoutGroup>
            <div className="grid sm:grid-cols-2 2xl:grid-cols-3 gap-5">
              {MENU_THEMES.map((t, i) => (
                <TemplateCard
                  key={t.id}
                  theme={t}
                  index={i}
                  color={color}
                  items={items}
                  active={t.id === themeId}
                  recommended={RECOMMENDED.includes(t.id)}
                  loading={!ready}
                  onSelect={() => setThemeId(t.id)}
                />
              ))}
            </div>
          </LayoutGroup>
        </section>

        {/* Cor principal */}
        <section>
          <SectionHeader
            icon={<Palette className="w-4 h-4" />}
            title="Cor principal"
            subtitle="Aplicada em botões, badges, categorias, preços, ícones e destaques."
          />

          <div className="rounded-3xl border border-border/60 bg-card/60 backdrop-blur-xl p-6 shadow-[0_20px_60px_-40px_hsl(0_0%_0%/0.9)]">
            <div className="flex flex-wrap gap-3">
              {ACCENT_PRESETS.map((p, i) => {
                const selected = color.toLowerCase() === p.value.toLowerCase();
                return (
                  <motion.button
                    key={p.value}
                    type="button"
                    title={p.name}
                    aria-label={p.name}
                    aria-pressed={selected}
                    onClick={() => setColor(p.value)}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.03, type: "spring", stiffness: 340, damping: 22 }}
                    whileHover={{ scale: 1.12, y: -2 }}
                    whileTap={{ scale: 0.94 }}
                    className="relative w-12 h-12 rounded-2xl"
                    style={{
                      backgroundColor: p.value,
                      boxShadow: selected
                        ? `0 0 0 2px hsl(var(--background)), 0 0 0 4px ${p.value}, 0 10px 26px -12px ${p.value}`
                        : `0 8px 20px -14px ${p.value}`,
                    }}
                  >
                    <AnimatePresence>
                      {selected && (
                        <motion.span
                          initial={{ scale: 0.4, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.4, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 24 }}
                          className="absolute inset-0 flex items-center justify-center"
                        >
                          <Check className="w-5 h-5 text-white drop-shadow" strokeWidth={3} />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                );
              })}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="relative">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-14 h-11 rounded-xl bg-transparent border border-border cursor-pointer"
                  aria-label="Cor personalizada"
                />
              </div>
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-36 font-mono text-sm rounded-xl"
              />
              <motion.div
                key={color}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                Prévia atualizada em tempo real
              </motion.div>
            </div>
          </div>
        </section>

        {/* Ações */}
        <div className="flex flex-wrap gap-3">
          <motion.div whileHover={{ scale: dirty ? 1.02 : 1 }} whileTap={{ scale: 0.98 }}>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !dirty} className="rounded-xl px-6">
              {save.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  Salvando...
                </span>
              ) : dirty ? "Salvar personalização" : "Tudo salvo"}
            </Button>
          </motion.div>
          {publicMenuUrl && (
            <Button variant="outline" className="rounded-xl" onClick={() => window.open(publicMenuUrl, "_blank")}>
              <ExternalLink className="w-4 h-4 mr-2" /> Ver cardápio virtual
            </Button>
          )}
        </div>
      </div>

      {/* ————— Coluna direita: preview grande ————— */}
      <div className="xl:sticky xl:top-6 h-fit">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] text-muted-foreground uppercase tracking-[0.2em]">Prévia ao vivo</p>
          <motion.span
            key={theme.id}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[11px] font-medium px-2.5 py-1 rounded-full border"
            style={{ borderColor: color + "55", color, backgroundColor: color + "12" }}
          >
            {theme.name}
          </motion.span>
        </div>

        <div className="relative">
          <div
            className="absolute -inset-10 rounded-[4rem] blur-3xl opacity-25 pointer-events-none"
            style={{ background: `radial-gradient(circle at 50% 20%, ${color}, transparent 70%)` }}
          />
          <PhoneFrame>
            <PhonePreview
              theme={theme}
              color={color}
              items={items}
              restaurantName={restaurantName}
              logoUrl={logoPreview}
              bannerUrl={bannerPreview}
              description={description}

              loading={!ready}
            />
          </PhoneFrame>
        </div>
      </div>
    </div>
  );
}

/* ——————————————————————————— UI pieces ——————————————————————————— */

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="mb-5">
      <h2 className="font-display font-bold text-base flex items-center gap-2.5">
        <span className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
          {icon}
        </span>
        {title}
      </h2>
      <p className="text-sm text-muted-foreground mt-2 ml-[2.6rem]">{subtitle}</p>
    </div>
  );
}

function TemplateCard({
  theme, index, color, items, active, recommended, loading, onSelect,
}: {
  theme: MenuTheme; index: number; color: string; items: MenuCardItem[];
  active: boolean; recommended: boolean; loading: boolean; onSelect: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0, scale: active ? 1.02 : 1 }}
      transition={{ delay: index * 0.05, type: "spring", stiffness: 260, damping: 26 }}
      whileHover={{ y: -6, scale: active ? 1.03 : 1.015 }}
      whileTap={{ scale: 0.985 }}
      className="group relative text-left rounded-3xl border bg-card/60 backdrop-blur-xl p-4 overflow-hidden transition-colors"
      style={{
        borderColor: active ? "#D4AF37" : "hsl(var(--border) / 0.6)",
        boxShadow: active
          ? "0 0 0 1px rgba(212,175,55,0.35), 0 0 34px -14px rgba(212,175,55,0.45), 0 24px 60px -44px rgba(0,0,0,0.9)"
          : "0 20px 50px -44px rgba(0,0,0,0.9)",
      }}
    >
      {/* brilho suave no hover */}
      <span
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: `radial-gradient(circle at 50% 0%, ${color}18, transparent 65%)` }}
        aria-hidden
      />

      {recommended && (
        <span className="absolute top-4 left-4 z-20 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/35">
          <Sparkles className="w-3 h-3" /> Recomendado
        </span>
      )}

      <AnimatePresence>
        {active && (
          <motion.span
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: "spring", stiffness: 480, damping: 22 }}
            className="absolute top-4 right-4 z-20 w-7 h-7 rounded-full bg-[#D4AF37] flex items-center justify-center shadow-lg"
          >
            <Check className="w-4 h-4 text-black" strokeWidth={3} />
          </motion.span>
        )}
      </AnimatePresence>

      {/* mockup real do layout */}
      <div className="relative z-10 flex justify-center pt-2">
        <MiniPhone>
          {loading ? (
            <ThumbSkeleton />
          ) : (
            <div className="origin-top-left" style={{ width: 336, transform: "scale(0.5)" }}>
              <MiniMenu theme={theme} color={color} items={items} />
            </div>

          )}
        </MiniPhone>
      </div>

      <div className="relative z-10 mt-4">
        <div className="font-semibold text-sm">{theme.name}</div>
        <div className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{theme.description}</div>
      </div>
    </motion.button>
  );
}

function MiniPhone({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-[168px] h-[210px] rounded-[1.6rem] border border-white/10 bg-[#0B0B0B] overflow-hidden shadow-[0_18px_40px_-24px_rgba(0,0,0,0.95)]">
      <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-12 h-1.5 rounded-full bg-white/15 z-10" />
      <div className="pt-5 h-full overflow-hidden">{children}</div>
    </div>
  );
}

function ThumbSkeleton() {
  return (
    <div className="p-3 space-y-2.5">
      <div className="h-10 rounded-xl bg-muted/40 animate-pulse" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-12 rounded-xl bg-muted/30 animate-pulse" style={{ animationDelay: `${i * 120}ms` }} />
      ))}
    </div>
  );
}

/** Cardápio miniatura — usa o mesmo renderizador do cardápio público */
function MiniMenu({ theme, color, items }: { theme: MenuTheme; color: string; items: MenuCardItem[] }) {
  return (
    <div className="px-3 pb-3">
      <div className="h-14 rounded-xl mb-3 flex items-end p-2" style={{ background: `linear-gradient(135deg, ${color}55, ${color}0d)` }}>
        <div className="h-2 w-20 rounded-full bg-white/40" />
      </div>
      <div className="flex gap-1.5 mb-3">
        <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold text-white" style={{ backgroundColor: color }}>Destaques</span>
        <span className="px-2.5 py-1 rounded-full text-[10px] bg-secondary/60">Combos</span>
      </div>
      <div className={`${theme.categoryTitleClass} mb-2`} style={{ color }}>Mais pedidos</div>
      <div className={theme.listClass}>
        {items.slice(0, 3).map((item, i) => (
          <MenuItemCard key={item.id} item={item} theme={theme} accentColor={color} index={i} animate={false} />
        ))}
      </div>
    </div>
  );
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto w-full max-w-[390px] rounded-[3rem] p-3 bg-gradient-to-b from-[#232323] to-[#0d0d0d] border border-white/10 shadow-[0_50px_100px_-50px_rgba(0,0,0,1)]">
      <div className="relative rounded-[2.3rem] overflow-hidden bg-background border border-white/5">
        {/* dynamic island */}
        <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-30 w-24 h-6 rounded-full bg-black border border-white/10" />
        {children}
      </div>
    </div>
  );
}

function PhonePreview({
  theme, color, items, restaurantName, loading, logoUrl, bannerUrl, description,
}: { theme: MenuTheme; color: string; items: MenuCardItem[]; restaurantName?: string | null; loading: boolean; logoUrl?: string | null; bannerUrl?: string | null; description?: string }) {
  return (
    <div className="flex flex-col h-[660px]">
      {/* status bar */}
      <div className="h-10 shrink-0" />

      {/* header */}
      <div className="h-28 relative shrink-0 overflow-hidden" style={{ background: `linear-gradient(135deg, ${color}55, ${color}0a)` }}>
        {bannerUrl && <img src={bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-70" />}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 px-4 pb-3 flex items-end gap-2.5">
          {logoUrl && <img src={logoUrl} alt="" className="w-10 h-10 rounded-xl object-cover border border-white/20 shrink-0" />}
          <div className="min-w-0">
            <div className="font-display font-bold text-lg truncate">{restaurantName || "Seu restaurante"}</div>
            <div className="text-[11px] text-muted-foreground truncate">{description?.trim() || "Aberto agora · Entrega 30-45 min"}</div>
          </div>
        </div>
      </div>


      {/* busca */}
      <div className="px-4 py-3 shrink-0">
        <div className="flex items-center gap-2 h-10 rounded-xl bg-secondary/50 border border-border/60 px-3">
          <Search className="w-4 h-4" style={{ color }} />
          <span className="text-xs text-muted-foreground">Buscar no cardápio…</span>
        </div>
      </div>

      {/* conteúdo */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="flex gap-2 mb-4">
          <span className="px-3 py-1.5 rounded-full text-[11px] font-semibold text-white" style={{ backgroundColor: color }}>Destaques</span>
          <span className="px-3 py-1.5 rounded-full text-[11px] bg-secondary/60">Combos</span>
          <span className="px-3 py-1.5 rounded-full text-[11px] bg-secondary/60">Bebidas</span>
        </div>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="sk" exit={{ opacity: 0 }} className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-24 rounded-2xl bg-muted/30 animate-pulse" style={{ animationDelay: `${i * 120}ms` }} />
              ))}
            </motion.div>
          ) : (
            <motion.div
              key={theme.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.28 }}
            >
              <div className={`${theme.categoryTitleClass} mb-3`} style={{ color }}>Mais pedidos</div>
              <div className={theme.listClass}>
                {items.map((item, i) => (
                  <MenuItemCard key={item.id} item={item} theme={theme} accentColor={color} index={i} animate={false} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* carrinho */}
      <div className="p-4 border-t border-border/60 shrink-0">
        <motion.div
          key={color}
          initial={{ scale: 0.98, opacity: 0.85 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full py-3 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold text-white"
          style={{ backgroundColor: color, boxShadow: `0 14px 34px -18px ${color}` }}
        >
          <ShoppingBag className="w-4 h-4" /> Ver carrinho
        </motion.div>
      </div>
    </div>
  );
}

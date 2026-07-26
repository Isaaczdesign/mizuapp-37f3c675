import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Check, ExternalLink, Palette, Smartphone } from "lucide-react";
import { MENU_THEMES, ACCENT_PRESETS, resolveMenuTheme, type MenuThemeId } from "@/lib/menuThemes";
import MenuItemCard, { type MenuCardItem } from "@/components/public-menu/MenuItemCard";

interface Props {
  restaurantId: string | undefined;
  currentTheme: string | null | undefined;
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

export default function MenuThemeTab({ restaurantId, currentTheme, currentColor, restaurantName, publicMenuUrl, previewItems }: Props) {
  const queryClient = useQueryClient();
  const [themeId, setThemeId] = useState<MenuThemeId>(resolveMenuTheme(currentTheme).id);
  const [color, setColor] = useState(currentColor || "#FF6B35");

  useEffect(() => { setThemeId(resolveMenuTheme(currentTheme).id); }, [currentTheme]);
  useEffect(() => { setColor(currentColor || "#FF6B35"); }, [currentColor]);

  const theme = useMemo(() => resolveMenuTheme(themeId), [themeId]);
  const items = previewItems && previewItems.length > 0 ? previewItems.slice(0, 3) : FALLBACK_ITEMS;
  const dirty = themeId !== resolveMenuTheme(currentTheme).id || color !== (currentColor || "#FF6B35");

  const save = useMutation({
    mutationFn: async () => {
      if (!restaurantId) throw new Error("Restaurante não encontrado");
      const { error } = await supabase
        .from("restaurants")
        .update({ menu_theme: themeId, primary_color: color })
        .eq("id", restaurantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant"] });
      queryClient.invalidateQueries({ queryKey: ["menu-restaurant"] });
      queryClient.invalidateQueries({ queryKey: ["settings-restaurant"] });
      toast.success("Layout do cardápio atualizado!");
    },
    onError: (e: any) => toast.error(e.message || "Não foi possível salvar"),
  });

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-6">
      <div className="space-y-6">
        {/* Templates */}
        <div>
          <h2 className="font-display font-bold mb-1 flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-primary" /> Templates de layout
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Escolha como os itens aparecem para o cliente no cardápio público.
          </p>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {MENU_THEMES.map((t) => {
              const active = t.id === themeId;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setThemeId(t.id)}
                  aria-pressed={active}
                  className={`relative text-left p-4 rounded-2xl border transition-all ${
                    active ? "border-primary bg-primary/10" : "border-border bg-card/50 hover:border-primary/40"
                  }`}
                >
                  {active && (
                    <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </span>
                  )}
                  <ThemeWireframe id={t.id} color={color} />
                  <div className="mt-3 font-semibold text-sm">{t.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{t.description}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Cor de destaque */}
        <div>
          <h2 className="font-display font-bold mb-1 flex items-center gap-2">
            <Palette className="w-4 h-4 text-primary" /> Cor de destaque
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Usada em preços, botões e destaques do cardápio.
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            {ACCENT_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                title={p.name}
                aria-label={p.name}
                onClick={() => setColor(p.value)}
                className={`w-10 h-10 rounded-xl border-2 transition-transform hover:scale-105 ${
                  color.toLowerCase() === p.value.toLowerCase() ? "border-foreground" : "border-transparent"
                }`}
                style={{ backgroundColor: p.value }}
              />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-12 h-10 rounded-lg bg-transparent border border-border cursor-pointer"
              aria-label="Cor personalizada"
            />
            <Input value={color} onChange={(e) => setColor(e.target.value)} className="w-32 font-mono text-sm" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending || !dirty}>
            {save.isPending ? "Salvando..." : dirty ? "Salvar personalização" : "Tudo salvo"}
          </Button>
          {publicMenuUrl && (
            <Button variant="outline" onClick={() => window.open(publicMenuUrl, "_blank")}>
              <ExternalLink className="w-4 h-4 mr-1" /> Ver cardápio virtual
            </Button>
          )}
        </div>
      </div>

      {/* Prévia */}
      <div className="lg:sticky lg:top-6 h-fit">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Prévia</p>
        <div className="mx-auto w-full max-w-[340px] rounded-[2rem] border-4 border-border bg-background overflow-hidden shadow-2xl">
          <div className="h-6 bg-card flex items-center justify-center">
            <div className="w-16 h-1.5 rounded-full bg-muted" />
          </div>
          <div className="h-20 relative" style={{ background: `linear-gradient(135deg, ${color}45, ${color}08)` }}>
            <div className="absolute inset-x-0 bottom-0 px-3 pb-2">
              <div className="font-display font-bold text-sm truncate">{restaurantName || "Seu restaurante"}</div>
            </div>
          </div>
          <div className="p-3 space-y-3 max-h-[520px] overflow-y-auto">
            <div className="flex gap-1.5">
              <span className="px-3 py-1 rounded-full text-[11px] font-medium text-white" style={{ backgroundColor: color }}>
                Destaques
              </span>
              <span className="px-3 py-1 rounded-full text-[11px] bg-secondary/60">Combos</span>
            </div>
            <div className={theme.categoryTitleClass}>Mais pedidos</div>
            <div className={theme.listClass}>
              {items.map((item, i) => (
                <MenuItemCard key={item.id} item={item} theme={theme} accentColor={color} index={i} animate={false} />
              ))}
            </div>
          </div>
          <div className="p-3 border-t border-border">
            <div className="w-full py-2.5 rounded-xl text-center text-sm font-bold text-white" style={{ backgroundColor: color }}>
              Ver carrinho
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ThemeWireframe({ id, color }: { id: MenuThemeId; color: string }) {
  const bar = (w: string, h = "h-1.5") => <div className={`${h} rounded-full bg-muted-foreground/30`} style={{ width: w }} />;
  const block = <div className="rounded bg-muted-foreground/20" />;

  if (id === "showcase") {
    return (
      <div className="h-24 rounded-xl bg-secondary/40 p-2 space-y-1.5">
        <div className="h-10 rounded" style={{ backgroundColor: color + "40" }} />
        <div className="space-y-1">{bar("70%")}{bar("40%")}</div>
        <div className="h-1.5 w-10 rounded-full" style={{ backgroundColor: color }} />
      </div>
    );
  }
  if (id === "compact") {
    return (
      <div className="h-24 rounded-xl bg-secondary/40 p-2 flex flex-col justify-center gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between gap-2">
            {bar("55%")}
            <div className="h-1.5 w-6 rounded-full" style={{ backgroundColor: color }} />
          </div>
        ))}
      </div>
    );
  }
  if (id === "grid") {
    return (
      <div className="h-24 rounded-xl bg-secondary/40 p-2 grid grid-cols-2 gap-2">
        {[0, 1].map((i) => (
          <div key={i} className="space-y-1">
            <div className="h-10 rounded" style={{ backgroundColor: color + "35" }} />
            {bar("80%")}
            <div className="h-1.5 w-6 rounded-full" style={{ backgroundColor: color }} />
          </div>
        ))}
      </div>
    );
  }
  if (id === "elegant") {
    return (
      <div className="h-24 rounded-xl bg-secondary/40 p-2 flex flex-col justify-center gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-2 pb-1.5 border-b border-muted-foreground/20">
            <div className="w-5 h-5 rounded-full bg-muted-foreground/25" />
            <div className="flex-1 space-y-1">{bar("70%")}</div>
            <div className="h-1.5 w-5 rounded-full bg-muted-foreground/40" />
          </div>
        ))}
      </div>
    );
  }
  if (id === "vibrant") {
    return (
      <div className="h-24 rounded-xl bg-secondary/40 p-2 space-y-2">
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center gap-2 p-1.5 rounded-2xl border-2" style={{ borderColor: color + "66", backgroundColor: color + "14" }}>
            <div className="flex-1 space-y-1">{bar("60%")}<div className="h-3 w-10 rounded-full" style={{ backgroundColor: color }} /></div>
            <div className="w-8 h-8 rounded-xl bg-muted-foreground/25" />
          </div>
        ))}
      </div>
    );
  }
  // classic
  return (
    <div className="h-24 rounded-xl bg-secondary/40 p-2 space-y-2">
      {[0, 1].map((i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex-1 space-y-1">{bar("75%")}{bar("45%")}<div className="h-1.5 w-8 rounded-full" style={{ backgroundColor: color }} /></div>
          <div className="w-9 h-9 rounded-lg bg-muted-foreground/25" />
        </div>
      ))}
    </div>
  );
}

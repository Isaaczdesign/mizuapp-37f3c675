import { useEffect, useMemo, useState } from "react";
import AdminMizuLayout from "@/components/admin-mizu/AdminMizuLayout";
import { supabase } from "@/integrations/supabase/client";
import { usePlatformRole, logPlatformAction } from "@/hooks/usePlatformRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Megaphone,
  Trash2,
  Users,
  Eye,
  CalendarClock,
  ChevronDown,
  MonitorPlay,
  Radio,
  Clock3,
  Sparkles,
  Search,
  PencilLine,
  Send,
  X,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import AnnouncementCard from "@/components/announcements/AnnouncementCard";
import AnnouncementModal from "@/components/announcements/AnnouncementModal";
import MediaUploader from "@/components/admin-mizu/MediaUploader";
import AnnouncementSlidesEditor, { AnnouncementSlide, emptySlide, loadSlidesDraft, clearSlidesDraft } from "@/components/admin-mizu/AnnouncementSlidesEditor";
import { Link } from "react-router-dom";
import { SectionCard, StatCard, StatusPill, EmptyState, SegmentedControl } from "@/components/admin-mizu/ui";

type Announcement = {
  id: string;
  title: string;
  body: string;
  variant: string;
  active: boolean;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
  target_scope: string;
  target_restaurant_ids: string[] | null;
  show_modal?: boolean | null;
  media_type?: string | null;
  media_url?: string | null;
  media_poster?: string | null;
  media_loop?: boolean | null;
  cta_label?: string | null;
  cta_url?: string | null;
  slides?: DbSlide[] | null;
};

type DbSlide = {
  title?: string | null;
  body?: string | null;
  media_type?: string | null;
  media_url?: string | null;
  media_poster?: string | null;
  media_loop?: boolean | null;
  cta_label?: string | null;
  cta_url?: string | null;
};

/** Converte uma data ISO para o formato aceito pelo input datetime-local. */
const toLocalInput = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

type RestaurantOption = { id: string; name: string; slug: string };

type ViewRow = {
  announcement_id: string;
  restaurant_id: string | null;
  viewed_at: string;
  dismissed_at: string | null;
};

const VARIANTS: { id: string; label: string }[] = [
  { id: "update", label: "Atualização" },
  { id: "info", label: "Informação" },
  { id: "warning", label: "Aviso" },
  { id: "maintenance", label: "Manutenção" },
];

// Atualizações têm página própria; aqui ficam apenas os demais avisos.
const PICKER_VARIANTS = VARIANTS.filter((v) => v.id !== "update");

const fmt = (v: string | null) => (v ? new Date(v).toLocaleString("pt-BR") : "—");

type StatusKey = "live" | "scheduled" | "expired" | "inactive";

function statusOf(item: Announcement): { key: StatusKey; label: string; tone: "success" | "info" | "neutral" } {
  const now = Date.now();
  if (!item.active) return { key: "inactive", label: "Inativo", tone: "neutral" };
  if (new Date(item.starts_at).getTime() > now) return { key: "scheduled", label: "Agendado", tone: "info" };
  if (item.ends_at && new Date(item.ends_at).getTime() <= now)
    return { key: "expired", label: "Expirado", tone: "neutral" };
  return { key: "live", label: "No ar", tone: "success" };
}

type Mode = "all" | "updates";

function AnnouncementTabs({ mode }: { mode: Mode }) {
  const tabs: { to: string; label: string; id: Mode }[] = [
    { to: "/admin-mizu/notificacoes", label: "Notificações", id: "all" },
    { to: "/admin-mizu/notificacoes/atualizacoes", label: "Atualizações", id: "updates" },
  ];
  return (
    <div className="mb-5 inline-flex items-center gap-0.5 rounded-xl border border-border bg-background/60 p-0.5">
      {tabs.map((t) => (
        <Link
          key={t.id}
          to={t.to}
          className={`rounded-[10px] px-3.5 py-1.5 text-xs font-medium transition-colors ${
            mode === t.id
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5">
      <p className="text-xs font-medium">{children}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function StepBlock({
  step,
  title,
  description,
  icon: Icon,
  children,
}: {
  step: number;
  title: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-4">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-[11px] font-semibold text-primary">
          {step}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5 text-primary" />
            <p className="text-xs font-semibold">{title}</p>
          </div>
          {description && <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{description}</p>}
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function ChipGroup<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
            value === o.id
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function AdminNotifications({ mode = "all" }: { mode?: Mode } = {}) {
  const updatesOnly = mode === "updates";
  const { isAdmin } = usePlatformRole();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [variant, setVariant] = useState("info");
  const effectiveVariant = updatesOnly ? "update" : variant;
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [scope, setScope] = useState<"all" | "restaurants">("all");
  const [restaurants, setRestaurants] = useState<RestaurantOption[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [views, setViews] = useState<ViewRow[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(true);
  const [mediaType, setMediaType] = useState<"none" | "image" | "video">("none");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaPoster, setMediaPoster] = useState("");
  const [mediaLoop, setMediaLoop] = useState(true);
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [previewModal, setPreviewModal] = useState(false);
  const [slides, setSlides] = useState<AnnouncementSlide[]>(() => loadSlidesDraft());
  const [historyFilter, setHistoryFilter] = useState<"all" | StatusKey>("all");
  const [historySearch, setHistorySearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  // Pop-up existe apenas para atualizações.
  const modalEnabled = updatesOnly && showModal;

  const load = async () => {
    const [{ data, error }, { data: viewData }] = await Promise.all([
      supabase.from("platform_announcements").select("*").order("created_at", { ascending: false }),
      supabase
        .from("platform_announcement_views")
        .select("announcement_id, restaurant_id, viewed_at, dismissed_at"),
    ]);
    if (error) toast.error("Não foi possível carregar os avisos.");
    setItems((data ?? []) as Announcement[]);
    setViews((viewData ?? []) as ViewRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const { data } = await supabase.from("restaurants").select("id, name, slug").order("name");
      setRestaurants((data ?? []) as RestaurantOption[]);
    })();
  }, [isAdmin]);

  const restaurantById = useMemo(
    () => Object.fromEntries(restaurants.map((r) => [r.id, r])),
    [restaurants]
  );

  const toggleRestaurant = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));

  const filteredRestaurants = restaurants.filter((r) =>
    `${r.name} ${r.slug}`.toLowerCase().includes(search.trim().toLowerCase())
  );

  const audienceFor = (item: Announcement): RestaurantOption[] =>
    item.target_scope === "restaurants"
      ? (item.target_restaurant_ids ?? []).map(
          (id) => restaurantById[id] ?? { id, name: "Restaurante removido", slug: "" }
        )
      : restaurants;

  const scopeItems = updatesOnly
    ? items.filter((i) => i.variant === "update")
    : items.filter((i) => i.variant !== "update");

  const visibleItems = scopeItems.filter((i) => {
    const matchStatus = historyFilter === "all" || statusOf(i).key === historyFilter;
    const q = historySearch.trim().toLowerCase();
    const matchSearch = !q || `${i.title} ${i.body}`.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const viewsFor = (id: string) => views.filter((v) => v.announcement_id === id);

  const stats = useMemo(() => {
    const counts = { live: 0, scheduled: 0, inactive: 0, expired: 0 };
    scopeItems.forEach((i) => { counts[statusOf(i).key] += 1; });
    const ids = new Set(scopeItems.map((i) => i.id));
    const seen = views.filter((v) => ids.has(v.announcement_id)).length;
    return { total: scopeItems.length, ...counts, seen };
  }, [scopeItems, views]);

  const resetForm = () => {
    setEditingId(null);
    setTitle(""); setBody(""); setStartsAt(""); setEndsAt(""); setVariant("info");
    setScope("all"); setSelected([]); setSearch("");
    setShowModal(true); setMediaType("none"); setMediaUrl(""); setMediaPoster(""); setMediaLoop(true);
    setCtaLabel(""); setCtaUrl(""); setSlides([]);
    clearSlidesDraft();
  };

  /** Carrega um aviso já publicado no formulário para editar e reenviar. */
  const startEdit = (item: Announcement) => {
    setEditingId(item.id);
    setTitle(item.title);
    setBody(item.body);
    setVariant(item.variant);
    setStartsAt(toLocalInput(item.starts_at));
    setEndsAt(toLocalInput(item.ends_at));
    setScope(item.target_scope === "restaurants" ? "restaurants" : "all");
    setSelected(item.target_restaurant_ids ?? []);
    setShowModal(item.show_modal ?? true);
    const mt = item.media_type === "image" || item.media_type === "video" ? item.media_type : "none";
    setMediaType(mt);
    setMediaUrl(item.media_url ?? "");
    setMediaPoster(item.media_poster ?? "");
    setMediaLoop(item.media_loop ?? true);
    setCtaLabel(item.cta_label ?? "");
    setCtaUrl(item.cta_url ?? "");
    setSlides(
      (item.slides ?? []).map((sl) => ({
        ...emptySlide(),
        title: sl.title ?? "",
        body: sl.body ?? "",
        media_type: sl.media_type === "image" || sl.media_type === "video" ? sl.media_type : "none",
        media_url: sl.media_url ?? "",
        media_poster: sl.media_poster ?? "",
        media_loop: sl.media_loop ?? true,
        cta_label: sl.cta_label ?? "",
        cta_url: sl.cta_url ?? "",
      }))
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const buildPayload = () => ({
    title: title.trim(),
    body: body.trim(),
    variant: effectiveVariant,
    starts_at: startsAt ? new Date(startsAt).toISOString() : new Date().toISOString(),
    ends_at: endsAt ? new Date(endsAt).toISOString() : null,
    target_scope: scope,
    target_restaurant_ids: scope === "restaurants" ? selected : [],
    show_modal: modalEnabled,
    media_type: modalEnabled ? mediaType : "none",
    media_url: modalEnabled ? mediaUrl.trim() || null : null,
    media_poster: modalEnabled && mediaType === "video" ? mediaPoster.trim() || null : null,
    media_loop: mediaLoop,
    cta_label: modalEnabled ? ctaLabel.trim() || null : null,
    cta_url: modalEnabled ? ctaUrl.trim() || null : null,
    slides: modalEnabled
      ? slides
          .filter((sl) => sl.title.trim() || sl.body.trim() || sl.media_url.trim())
          .map((sl) => ({
            title: sl.title.trim(),
            body: sl.body.trim(),
            media_type: sl.media_url.trim() ? sl.media_type : "none",
            media_url: sl.media_url.trim() || null,
            media_poster: sl.media_type === "video" ? sl.media_poster.trim() || null : null,
            media_loop: sl.media_loop,
            cta_label: sl.cta_label.trim() || null,
            cta_url: sl.cta_url.trim() || null,
          }))
      : [],
  });

  const create = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Preencha título e mensagem.");
      return;
    }
    if (scope === "restaurants" && selected.length === 0) {
      toast.error("Selecione ao menos um restaurante.");
      return;
    }
    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
      toast.error("A expiração precisa ser depois da publicação.");
      return;
    }
    setSaving(true);
    const payload = buildPayload();

    if (editingId) {
      const { data, error } = await supabase
        .from("platform_announcements")
        .update(payload)
        .eq("id", editingId)
        .select()
        .single();
      setSaving(false);
      if (error) { toast.error("Erro ao salvar as alterações."); return; }
      await logPlatformAction({ action: "announcement.update", entityType: "platform_announcement", entityId: editingId, newValue: data });
      toast.success("Aviso atualizado. As alterações já valem para os restaurantes.");
      resetForm();
      load();
      return;
    }

    const { data, error } = await supabase
      .from("platform_announcements")
      .insert(payload)
      .select()
      .single();
    setSaving(false);
    if (error) { toast.error("Erro ao publicar o aviso."); return; }
    await logPlatformAction({ action: "announcement.create", entityType: "platform_announcement", entityId: data.id, newValue: data });
    toast.success(
      startsAt && new Date(startsAt) > new Date()
        ? "Aviso agendado. Ele aparecerá automaticamente na data escolhida."
        : "Aviso publicado. Ele aparece na hora no painel dos restaurantes."
    );
    resetForm();
    load();
  };

  /** Reenvia: o pop-up volta a aparecer para quem já tinha visto. */
  const resend = async (item: Announcement) => {
    if (!confirm("Reenviar este aviso? Ele voltará a aparecer para todos os restaurantes do público-alvo.")) return;
    const startsNow = new Date().toISOString();
    const { error } = await supabase
      .from("platform_announcements")
      .update({ active: true, starts_at: startsNow, ends_at: null })
      .eq("id", item.id);
    if (error) { toast.error("Não foi possível reenviar."); return; }
    await supabase.from("platform_announcement_views").delete().eq("announcement_id", item.id);
    await logPlatformAction({ action: "announcement.resend", entityType: "platform_announcement", entityId: item.id, newValue: { starts_at: startsNow } });
    toast.success("Aviso reenviado. Ele reaparece no painel dos restaurantes.");
    load();
  };

  const toggle = async (item: Announcement, active: boolean) => {
    const { error } = await supabase.from("platform_announcements").update({ active }).eq("id", item.id);
    if (error) { toast.error("Erro ao atualizar."); return; }
    await logPlatformAction({ action: "announcement.toggle", entityType: "platform_announcement", entityId: item.id, newValue: { active } });
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, active } : i)));
  };

  const remove = async (item: Announcement) => {
    if (!confirm("Excluir este aviso definitivamente?")) return;
    const { error } = await supabase.from("platform_announcements").delete().eq("id", item.id);
    if (error) { toast.error("Erro ao excluir."); return; }
    await logPlatformAction({ action: "announcement.delete", entityType: "platform_announcement", entityId: item.id, oldValue: item });
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  };

  const canPublish = title.trim().length > 0 && body.trim().length > 0;

  return (
    <AdminMizuLayout
      title={updatesOnly ? "Atualizações do Mizu" : "Avisos e notificações"}
      description={
        updatesOnly
          ? "Comunique novidades e melhorias da plataforma em pop-up para os restaurantes."
          : "Publique, agende e acompanhe os comunicados exibidos no painel dos restaurantes."
      }
    >
      <AnnouncementTabs mode={mode} />

      {/* Resumo */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Publicados" value={String(stats.total)} icon={Megaphone} hint={updatesOnly ? "Atualizações criadas" : "Avisos criados"} />
        <StatCard label="No ar agora" value={String(stats.live)} icon={Radio} accent hint="Visíveis nos painéis" />
        <StatCard label="Agendados" value={String(stats.scheduled)} icon={Clock3} hint="Aguardando data" />
        <StatCard label="Visualizações" value={String(stats.seen)} icon={Eye} hint="Registros de leitura" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,440px)_minmax(0,1fr)] xl:items-start">
        {/* Composer */}
        {isAdmin && (
          <SectionCard
            className="xl:sticky xl:top-4"
            title={updatesOnly ? "Nova atualização" : "Novo aviso"}
            description="Preencha as etapas abaixo e publique."
            bodyClassName="space-y-3"
          >
            <StepBlock
              step={1}
              title="Conteúdo"
              icon={PencilLine}
              description="O que o dono do restaurante vai ler."
            >
              <div>
                <FieldLabel>Título</FieldLabel>
                <Input placeholder="Ex.: Nova atualização do Mizu" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
              </div>
              <div>
                <FieldLabel hint={`${body.length}/600 caracteres`}>Mensagem</FieldLabel>
                <Textarea placeholder="Descreva a novidade em poucas linhas" value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={600} />
              </div>
              {!updatesOnly && (
                <div>
                  <FieldLabel hint="Define a cor e o ícone do aviso no painel.">Tipo do aviso</FieldLabel>
                  <ChipGroup value={variant} onChange={setVariant} options={PICKER_VARIANTS} />
                </div>
              )}
            </StepBlock>

            {updatesOnly && (
              <StepBlock
                step={2}
                title="Pop-up e mídia"
                icon={MonitorPlay}
                description="A atualização abre em tela cheia para o restaurante."
              >
                <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <p className="text-xs">Exibir como pop-up</p>
                  <Switch checked={showModal} onCheckedChange={setShowModal} aria-label="Exibir pop-up" />
                </div>
                {showModal && (
                  <>
                    <div>
                      <FieldLabel>Mídia principal</FieldLabel>
                      <ChipGroup<"none" | "image" | "video">
                        value={mediaType}
                        onChange={setMediaType}
                        options={[
                          { id: "none", label: "Sem mídia" },
                          { id: "image", label: "Imagem" },
                          { id: "video", label: "Vídeo" },
                        ]}
                      />
                    </div>
                    {mediaType !== "none" && (
                      <div className="space-y-2">
                        <MediaUploader
                          kind={mediaType}
                          value={mediaUrl}
                          onChange={setMediaUrl}
                          label={mediaType === "video" ? "Vídeo do pop-up" : "Imagem do pop-up"}
                        />
                        <Input
                          placeholder={mediaType === "video" ? "Ou cole a URL do vídeo (.mp4)" : "Ou cole a URL da imagem"}
                          value={mediaUrl}
                          onChange={(e) => setMediaUrl(e.target.value)}
                        />
                        {mediaType === "video" && (
                          <>
                            <MediaUploader
                              kind="image"
                              value={mediaPoster}
                              onChange={setMediaPoster}
                              label="Miniatura do vídeo (opcional)"
                              hint="Aparece antes do play — JPG/PNG"
                            />
                            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                              <p className="text-xs text-muted-foreground">Repetir vídeo (loop)</p>
                              <Switch checked={mediaLoop} onCheckedChange={setMediaLoop} aria-label="Loop do vídeo" />
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    <div>
                      <FieldLabel hint="Opcional — leva o restaurante para uma página.">Botão de ação</FieldLabel>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input placeholder="Texto do botão" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} maxLength={40} />
                        <Input placeholder="Link do botão" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} />
                      </div>
                    </div>
                    <AnnouncementSlidesEditor slides={slides} onChange={setSlides} />
                  </>
                )}
              </StepBlock>
            )}

            <StepBlock
              step={updatesOnly ? 3 : 2}
              title="Público-alvo"
              icon={Users}
              description="Escolha quais restaurantes recebem."
            >
              <ChipGroup<"all" | "restaurants">
                value={scope}
                onChange={setScope}
                options={[
                  { id: "all", label: "Todos os restaurantes" },
                  { id: "restaurants", label: "Selecionar restaurantes" },
                ]}
              />
              {scope === "restaurants" && (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-8"
                      placeholder="Buscar por nome ou link"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                    {filteredRestaurants.length === 0 ? (
                      <p className="p-2 text-xs text-muted-foreground">Nenhum restaurante encontrado.</p>
                    ) : (
                      filteredRestaurants.map((r) => (
                        <label
                          key={r.id}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/60"
                        >
                          <Checkbox checked={selected.includes(r.id)} onCheckedChange={() => toggleRestaurant(r.id)} />
                          <span className="min-w-0 flex-1 truncate">{r.name}</span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">/{r.slug}</span>
                        </label>
                      ))
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{selected.length} restaurante(s) selecionado(s).</p>
                </div>
              )}
            </StepBlock>

            <StepBlock
              step={updatesOnly ? 4 : 3}
              title="Agendamento"
              icon={CalendarClock}
              description="O aviso aparece e some sozinho conforme as datas."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel>Publicar em</FieldLabel>
                  <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
                  <p className="mt-1 text-[11px] text-muted-foreground">Vazio = agora</p>
                </div>
                <div>
                  <FieldLabel>Expira em</FieldLabel>
                  <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
                  <p className="mt-1 text-[11px] text-muted-foreground">Opcional</p>
                </div>
              </div>
            </StepBlock>

            {/* Prévia + publicar */}
            <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
              <div className="flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-primary" />
                <p className="text-xs font-semibold">{updatesOnly ? "Prévia do pop-up" : "Prévia no painel"}</p>
              </div>
              {updatesOnly ? (
                <Button variant="outline" size="sm" disabled={!showModal || !canPublish} onClick={() => setPreviewModal(true)}>
                  Ver prévia do pop-up
                </Button>
              ) : (
                <AnnouncementCard title={title || "Título do aviso"} body={body || "Mensagem exibida ao restaurante."} variant={effectiveVariant} />
              )}
              <Button className="w-full" onClick={create} disabled={saving || !canPublish}>
                {saving ? "Publicando..." : updatesOnly ? "Publicar atualização" : "Publicar aviso"}
              </Button>
              {!canPublish && (
                <p className="text-center text-[11px] text-muted-foreground">Preencha título e mensagem para publicar.</p>
              )}
            </div>

            <AnnouncementModal
              open={previewModal}
              onOpenChange={setPreviewModal}
              items={[
                {
                  title,
                  body,
                  variant: effectiveVariant,
                  media_url: mediaUrl,
                  media_type: mediaType,
                  media_poster: mediaPoster,
                  media_loop: mediaLoop,
                  cta_label: ctaLabel,
                  cta_url: ctaUrl,
                },
                ...slides
                  .filter((sl) => sl.title.trim() || sl.body.trim() || sl.media_url.trim())
                  .map((sl) => ({ ...sl, variant: effectiveVariant })),
              ]}
            />
          </SectionCard>
        )}

        {/* Histórico */}
        <SectionCard
          title={updatesOnly ? "Histórico de atualizações" : "Histórico de avisos"}
          description={`${visibleItems.length} de ${scopeItems.length} exibidos`}
          bodyClassName="space-y-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl<"all" | StatusKey>
              value={historyFilter}
              onChange={setHistoryFilter}
              options={[
                { id: "all", label: "Todos" },
                { id: "live", label: "No ar" },
                { id: "scheduled", label: "Agendados" },
                { id: "expired", label: "Expirados" },
                { id: "inactive", label: "Inativos" },
              ]}
            />
            <div className="relative min-w-[180px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar no histórico"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-muted/20" />
              ))}
            </div>
          ) : visibleItems.length === 0 ? (
            <EmptyState
              icon={updatesOnly ? Sparkles : Megaphone}
              title={scopeItems.length === 0 ? "Nada publicado ainda" : "Nenhum resultado"}
              description={
                scopeItems.length === 0
                  ? "Crie o primeiro comunicado no formulário ao lado."
                  : "Ajuste a busca ou o filtro de status."
              }
            />
          ) : (
            <div className="space-y-2.5">
              {visibleItems.map((item) => {
                const st = statusOf(item);
                const audience = audienceFor(item);
                const itemViews = viewsFor(item.id);
                const seenIds = new Set(itemViews.map((v) => v.restaurant_id));
                const seenCount = audience.filter((r) => seenIds.has(r.id)).length;
                const pct = audience.length ? Math.round((seenCount / audience.length) * 100) : 0;
                const isOpen = expanded === item.id;
                return (
                  <div key={item.id} className="rounded-xl border border-border bg-background/40 p-4 transition-colors hover:border-primary/30">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold">{item.title}</p>
                          <StatusPill tone={st.tone}>{st.label}</StatusPill>
                          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                            {VARIANTS.find((v) => v.id === item.variant)?.label ?? item.variant}
                          </span>
                          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                            {item.target_scope === "restaurants"
                              ? `${item.target_restaurant_ids?.length ?? 0} restaurante(s)`
                              : "Todos"}
                          </span>
                        </div>
                        <p className="mt-1.5 line-clamp-3 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                          {item.body}
                        </p>
                        <dl className="mt-3 grid gap-x-4 gap-y-1 text-[11px] text-muted-foreground sm:grid-cols-3">
                          <div><dt className="inline font-medium text-foreground/70">Publicação: </dt><dd className="inline">{fmt(item.starts_at)}</dd></div>
                          <div><dt className="inline font-medium text-foreground/70">Expira: </dt><dd className="inline">{fmt(item.ends_at)}</dd></div>
                          <div><dt className="inline font-medium text-foreground/70">Criado: </dt><dd className="inline">{fmt(item.created_at)}</dd></div>
                        </dl>
                      </div>
                      {isAdmin && (
                        <div className="flex shrink-0 items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2.5 text-[11px]"
                            onClick={() => startEdit(item)}
                          >
                            <PencilLine className="mr-1 h-3.5 w-3.5" />
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2.5 text-[11px]"
                            onClick={() => resend(item)}
                          >
                            <Send className="mr-1 h-3.5 w-3.5" />
                            Reenviar
                          </Button>
                          <Switch checked={item.active} onCheckedChange={(v) => toggle(item, v)} aria-label="Ativar aviso" />
                          <Button variant="ghost" size="icon" onClick={() => remove(item)} aria-label="Excluir aviso">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 rounded-lg border border-border/70 bg-muted/20 p-2.5">
                      <button
                        onClick={() => setExpanded(isOpen ? null : item.id)}
                        className="flex w-full items-center gap-2 text-[11px] font-medium text-primary"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Visualizações: {seenCount}/{audience.length} ({pct}%)
                        <ChevronDown className={`ml-auto h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </button>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      {isOpen && (
                        <div className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border bg-background/60 p-2">
                          {audience.length === 0 ? (
                            <p className="p-2 text-xs text-muted-foreground">Nenhum restaurante no público-alvo.</p>
                          ) : (
                            audience.map((r) => {
                              const v = itemViews.find((x) => x.restaurant_id === r.id);
                              return (
                                <div key={r.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs">
                                  <span className="min-w-0 flex-1 truncate">{r.name}</span>
                                  {v ? (
                                    <span className="shrink-0 text-[10px] text-primary">
                                      Visualizou em {fmt(v.viewed_at)}
                                      {v.dismissed_at ? " · dispensado" : ""}
                                    </span>
                                  ) : (
                                    <span className="shrink-0 text-[10px] text-muted-foreground">Ainda não recarregou</span>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>
    </AdminMizuLayout>
  );
}

export default AdminNotifications;

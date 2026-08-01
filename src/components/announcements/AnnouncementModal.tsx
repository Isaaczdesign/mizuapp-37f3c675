import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ANNOUNCEMENT_ICONS } from "@/components/announcements/AnnouncementCard";
import { Megaphone, ArrowUpRight, ArrowRight } from "lucide-react";
import logoMark from "@/assets/mizu-logo-mark.png";
import AnnouncementVideo from "@/components/announcements/AnnouncementVideo";
import { usePlatformMediaUrl } from "@/lib/platformMedia";

export type AnnouncementModalData = {
  id?: string;
  title: string;
  body: string;
  variant: string;
  media_url?: string | null;
  media_type?: string | null;
  media_poster?: string | null;
  media_loop?: boolean | null;
  cta_label?: string | null;
  cta_url?: string | null;
  starts_at?: string | null;
  created_at?: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Um único aviso. */
  data?: AnnouncementModalData;
  /** Vários avisos exibidos em sequência no mesmo pop-up. */
  items?: AnnouncementModalData[];
};

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export default function AnnouncementModal({ open, onOpenChange, data, items }: Props) {
  const list = items && items.length > 0 ? items : data ? [data] : [];
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<"next" | "prev">("next");
  const [mediaRatio, setMediaRatio] = useState<number | null>(null);
  const handleAspectRatio = useCallback((ratio: number) => setMediaRatio(ratio), []);

  useEffect(() => {
    if (open) {
      setIndex(0);
      setDir("next");
      setMediaRatio(null);
    }
  }, [open]);

  const total = list.length;
  const safeIndex = Math.min(index, Math.max(total - 1, 0));
  const current = list[safeIndex];

  const rawMedia = current?.media_url?.trim() || null;
  const media = usePlatformMediaUrl(rawMedia);
  const poster = usePlatformMediaUrl(current?.media_poster ?? null);

  useEffect(() => {
    setMediaRatio(null);
  }, [current?.id, safeIndex]);

  if (!current) return null;

  const goTo = (i: number) => {
    setDir(i > safeIndex ? "next" : "prev");
    setIndex(i);
    setMediaRatio(null);
  };
  const enterAnim = dir === "next" ? "animate-slide-next" : "animate-slide-prev";

  const Icon = ANNOUNCEMENT_ICONS[current.variant] ?? Megaphone;
  const rawType = current.media_type ?? "none";
  const type = rawType === "image" || rawType === "video" ? rawType : rawMedia ? "image" : "none";
  const hasMedia = !!media && type !== "none";
  const isPortrait = mediaRatio ? mediaRatio < 1 : type === "video";
  const isWideLandscape = mediaRatio !== null && mediaRatio >= 1.6;
  const publishedAt = formatDate(current.starts_at ?? current.created_at);
  const isLast = safeIndex >= total - 1;
  const hasCta = !!current.cta_url?.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`max-h-[92vh] overflow-hidden border-border/70 bg-card/95 p-0 backdrop-blur-xl [&>button]:z-20 [&>button]:rounded-full [&>button]:bg-background/60 [&>button]:p-1.5 [&>button]:backdrop-blur ${
          hasMedia
            ? isWideLandscape
              ? "w-[calc(100%-1rem)] max-w-[1024px] sm:w-[calc(100%-2rem)] sm:max-w-[1024px]"
              : "w-[calc(100%-2rem)] max-w-[880px] sm:max-w-[880px]"
            : "w-[calc(100%-2rem)] max-w-[440px] sm:max-w-[440px]"
        }`}
      >
        {/* Brilho da marca */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full blur-3xl"
          style={{ background: "var(--gradient-orange)", opacity: 0.18 }}
        />

        <div
          className={`relative grid min-w-0 grid-cols-1 overflow-y-auto max-h-full ${
            hasMedia
              ? isPortrait
                ? "md:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] md:items-stretch"
                : isWideLandscape
                  ? "md:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] md:items-stretch"
                  : "md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-stretch"
              : ""
          }`}
        >
          {/* Conteúdo — topo no mobile (abaixo do vídeo widescreen), esquerda no desktop */}
          <div
            className={`relative flex min-w-0 flex-col justify-center space-y-4 px-6 py-6 md:order-1 md:px-9 md:py-9 ${
              hasMedia && isWideLandscape ? "order-2" : "order-1"
            }`}
          >
            <div key={current.id ?? safeIndex} className={`${enterAnim} space-y-2`}>
              <div className="flex items-center gap-2">
                <img src={logoMark} alt="Mizu" className="h-3.5 w-auto opacity-70" draggable={false} />
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Novidade Mizu
                </span>
                {total > 1 && (
                  <span className="ml-auto rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {safeIndex + 1} de {total}
                  </span>
                )}
              </div>

              <div className="flex items-start gap-3 pt-1">
                <div className="relative shrink-0">
                  <div
                    aria-hidden
                    className="absolute inset-0 rounded-xl blur-md"
                    style={{ background: "var(--gradient-orange)", opacity: 0.35 }}
                  />
                  <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-accent/30 bg-background/90 shadow-[var(--shadow-glass)]">
                    <Icon className="h-5 w-5 text-accent" />
                  </div>
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <h2 className="font-display text-xl font-semibold leading-snug">
                    {current.title || "Título do aviso"}
                  </h2>
                  <p className="break-words [overflow-wrap:anywhere] whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {current.body || "Mensagem que o dono do restaurante vai ler."}
                  </p>
                  {publishedAt && (
                    <p className="pt-1 text-[11px] font-medium text-muted-foreground/80">
                      Publicado em {publishedAt}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div
              className={`flex animate-fade-up flex-col gap-3 pt-2 sm:flex-row sm:gap-2 ${
                !hasCta ? "ml-[calc(2.5rem+0.75rem)]" : ""
              }`}
              style={{ animationDelay: "140ms", opacity: 0 }}
            >
              {hasCta && (
                <Button
                  asChild
                  className="h-11 rounded-xl border-0 font-semibold text-primary-foreground transition-all hover:scale-[1.02] hover:brightness-110"
                  style={{ backgroundImage: "var(--gradient-orange)", boxShadow: "var(--shadow-orange)" }}
                >
                  <a href={current.cta_url!} target="_blank" rel="noopener noreferrer">
                    {current.cta_label?.trim() || "Saiba mais"}
                    <ArrowUpRight className="ml-1 h-4 w-4" />
                  </a>
                </Button>
              )}
              {isLast ? (
                <Button
                  variant="outline"
                  className="h-11 rounded-xl border-border bg-transparent text-muted-foreground transition-colors hover:border-accent/40 hover:bg-secondary hover:text-foreground"
                  onClick={() => onOpenChange(false)}
                >
                  {hasCta ? "Agora não" : "Entendi"}
                </Button>
              ) : (
                <Button
                  variant={hasCta ? "outline" : "default"}
                  className={
                    hasCta
                      ? "h-11 rounded-xl border-border bg-transparent text-muted-foreground transition-colors hover:border-accent/40 hover:bg-secondary hover:text-foreground"
                      : "h-11 rounded-xl border-0 font-semibold text-primary-foreground transition-all hover:scale-[1.02] hover:brightness-110"
                  }
                  style={
                    hasCta
                      ? undefined
                      : { backgroundImage: "var(--gradient-orange)", boxShadow: "var(--shadow-orange)" }
                  }
                  onClick={() => goTo(safeIndex + 1)}
                >
                  Próxima novidade
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              )}
            </div>

            {total > 1 && (
              <div className="flex items-center gap-1.5 pt-1">
                {list.map((item, i) => (
                  <button
                    key={item.id ?? i}
                    aria-label={`Ver novidade ${i + 1}`}
                    onClick={() => goTo(i)}
                    className={`h-1.5 rounded-full transition-all ${
                      i === safeIndex ? "w-6 bg-accent" : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Mídia — topo no mobile (widescreen) / base, direita no desktop */}
          {hasMedia && (
            <div
              key={`${current.id ?? safeIndex}-media`}
              className={`relative flex min-w-0 ${enterAnim} items-center justify-center overflow-hidden bg-brand-ink md:order-2 ${
                isPortrait
                  ? "order-2 min-h-[55vh] max-h-[70vh] md:max-h-[85vh]"
                  : isWideLandscape
                    ? "order-1 max-h-[45vh] md:order-2 md:min-h-[50vh] md:max-h-[78vh]"
                    : "order-2 min-h-48 max-h-[55vh] md:max-h-[62vh]"
              }`}
            >
              {type === "image" ? (
                <img
                  key={media}
                  src={media}
                  alt={current.title}
                  className={`block w-full object-contain object-center ${
                    isPortrait
                      ? "max-h-[70vh] min-h-[55vh] md:max-h-[80vh]"
                      : isWideLandscape
                        ? "max-h-[45vh] md:min-h-[50vh] md:max-h-[78vh]"
                        : "max-h-[55vh] min-h-48 md:max-h-[62vh]"
                  }`}
                  decoding="async"
                  onLoad={(e) => {
                    const t = e.currentTarget;
                    if (t.naturalWidth && t.naturalHeight) {
                      setMediaRatio(t.naturalWidth / t.naturalHeight);
                    }
                  }}
                />
              ) : (
                <AnnouncementVideo
                  key={media}
                  src={media!}
                  poster={poster}
                  loop={current.media_loop ?? true}
                  title={current.title}
                  className={
                    isPortrait
                      ? "max-h-[70vh] min-h-[55vh] md:max-h-[85vh]"
                      : isWideLandscape
                        ? "max-h-[45vh] md:min-h-[50vh] md:max-h-[78vh]"
                        : "max-h-[55vh] md:max-h-[62vh]"
                  }
                  onAspectRatio={handleAspectRatio}
                />
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

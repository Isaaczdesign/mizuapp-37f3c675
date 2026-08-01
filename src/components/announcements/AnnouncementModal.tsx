import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ANNOUNCEMENT_ICONS } from "@/components/announcements/AnnouncementCard";
import { Megaphone, ArrowUpRight } from "lucide-react";
import logoMark from "@/assets/mizu-logo-mark.png";
import AnnouncementVideo from "@/components/announcements/AnnouncementVideo";

export type AnnouncementModalData = {
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
  data: AnnouncementModalData;
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

export default function AnnouncementModal({ open, onOpenChange, data }: Props) {
  const Icon = ANNOUNCEMENT_ICONS[data.variant] ?? Megaphone;
  const media = data.media_url?.trim();
  const type = data.media_type ?? "none";
  const hasMedia = !!media && (type === "image" || type === "video");
  const publishedAt = formatDate(data.starts_at ?? data.created_at);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`overflow-hidden border-border/70 bg-card/95 p-0 backdrop-blur-xl [&>button]:z-20 [&>button]:rounded-full [&>button]:bg-background/60 [&>button]:p-1.5 [&>button]:backdrop-blur ${
          hasMedia ? "max-w-[880px]" : "max-w-[440px]"
        }`}
      >
        {/* Brilho da marca */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full blur-3xl"
          style={{ background: "var(--gradient-orange)", opacity: 0.18 }}
        />

        <div
          className={`relative grid grid-cols-1 ${hasMedia ? "md:grid-cols-[1fr_1.1fr] md:items-stretch" : ""}`}
        >
          {/* Conteúdo — topo no mobile, esquerda no desktop */}
          <div className="relative order-1 flex flex-col justify-center space-y-4 px-5 py-5 md:order-1 md:px-6 md:py-8">
            <div className="animate-fade-up space-y-2">
              <div className="flex items-center gap-2">
                <img src={logoMark} alt="Mizu" className="h-3.5 w-auto opacity-70" draggable={false} />
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Novidade Mizu
                </span>
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
                <h2 className="font-display text-xl font-semibold leading-snug">
                  {data.title || "Título do aviso"}
                </h2>
              </div>

              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {data.body || "Mensagem que o dono do restaurante vai ler."}
              </p>

              {publishedAt && (
                <p className="pt-1 text-[11px] font-medium text-muted-foreground/80">
                  Publicado em {publishedAt}
                </p>
              )}
            </div>

            <div
              className="flex animate-fade-up flex-col gap-3 pt-2 sm:flex-row sm:gap-2"
              style={{ animationDelay: "140ms", opacity: 0 }}
            >
              {data.cta_url?.trim() && (
                <Button
                  asChild
                  className="h-11 rounded-xl border-0 font-semibold text-primary-foreground transition-all hover:scale-[1.02] hover:brightness-110"
                  style={{ backgroundImage: "var(--gradient-orange)", boxShadow: "var(--shadow-orange)" }}
                >
                  <a href={data.cta_url} target="_blank" rel="noopener noreferrer">
                    {data.cta_label?.trim() || "Saiba mais"}
                    <ArrowUpRight className="ml-1 h-4 w-4" />
                  </a>
                </Button>
              )}
              <Button
                variant="outline"
                className="h-11 rounded-xl border-border bg-transparent text-muted-foreground transition-colors hover:border-accent/40 hover:bg-secondary hover:text-foreground"
                onClick={() => onOpenChange(false)}
              >
                {data.cta_url?.trim() ? "Agora não" : "Entendi"}
              </Button>
            </div>
          </div>

          {/* Mídia — base no mobile, direita no desktop */}
          {hasMedia && (
            <div className="relative order-2 flex animate-fade-in items-center justify-center overflow-hidden bg-brand-ink md:order-2">
              {type === "image" ? (
                <img
                  src={media}
                  alt={data.title}
                  className="max-h-[55vh] w-full object-contain object-center md:max-h-[62vh]"
                  loading="lazy"
                />
              ) : (
                <AnnouncementVideo
                  src={media!}
                  poster={data.media_poster}
                  loop={data.media_loop ?? true}
                  title={data.title}
                />
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ANNOUNCEMENT_ICONS } from "@/components/announcements/AnnouncementCard";
import { Megaphone, ArrowUpRight } from "lucide-react";
import logoMark from "@/assets/mizu-logo-mark.png";

export type AnnouncementModalData = {
  title: string;
  body: string;
  variant: string;
  media_url?: string | null;
  media_type?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: AnnouncementModalData;
};

export default function AnnouncementModal({ open, onOpenChange, data }: Props) {
  const Icon = ANNOUNCEMENT_ICONS[data.variant] ?? Megaphone;
  const media = data.media_url?.trim();
  const type = data.media_type ?? "none";
  const hasMedia = !!media && (type === "image" || type === "video");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px] overflow-hidden border-border/70 bg-card/95 p-0 backdrop-blur-xl [&>button]:z-20 [&>button]:rounded-full [&>button]:bg-background/60 [&>button]:p-1.5 [&>button]:backdrop-blur">
        {/* Brilho da marca */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full blur-3xl"
          style={{ background: "var(--gradient-orange)", opacity: 0.18 }}
        />

        <div className="relative">
          {hasMedia && (
            <div className="relative animate-fade-in overflow-hidden">
              {type === "image" ? (
                <img
                  src={media}
                  alt={data.title}
                  className="aspect-square w-full object-cover object-center"
                  loading="lazy"
                />
              ) : (
                <video
                  src={media}
                  className="aspect-square w-full bg-brand-ink object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                  controls
                />
              )}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-card to-transparent" />
            </div>
          )}

          <div className={`relative space-y-4 px-6 pb-6 text-center ${hasMedia ? "-mt-8 pt-0" : "pt-8"}`}>
            <div className="flex justify-center">
              <div className="relative animate-fade-up">
                <div
                  aria-hidden
                  className="absolute inset-0 rounded-2xl blur-md"
                  style={{ background: "var(--gradient-orange)", opacity: 0.35 }}
                />
                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/30 bg-background/90 shadow-[var(--shadow-glass)]">
                  <Icon className="h-6 w-6 text-accent" />
                </div>
              </div>
            </div>

            <div className="animate-fade-up space-y-2" style={{ animationDelay: "60ms", opacity: 0 }}>
              <div className="flex items-center justify-center gap-2">
                <img src={logoMark} alt="Mizu" className="h-3.5 w-auto opacity-70" draggable={false} />
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Novidade Mizu
                </span>
              </div>
              <h2 className="font-display text-xl font-semibold leading-snug">
                {data.title || "Título do aviso"}
              </h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {data.body || "Mensagem que o dono do restaurante vai ler."}
              </p>
            </div>

            <div
              className="flex animate-fade-up flex-col gap-2 pt-1"
              style={{ animationDelay: "140ms", opacity: 0 }}
            >
              {data.cta_url?.trim() && (
                <Button
                  asChild
                  className="h-11 rounded-xl border-0 font-semibold text-primary-foreground transition-transform hover:scale-[1.02]"
                  style={{ backgroundImage: "var(--gradient-orange)", boxShadow: "var(--shadow-orange)" }}
                >
                  <a href={data.cta_url} target="_blank" rel="noopener noreferrer">
                    {data.cta_label?.trim() || "Saiba mais"}
                    <ArrowUpRight className="ml-1 h-4 w-4" />
                  </a>
                </Button>
              )}
              <Button
                variant="ghost"
                className="h-10 rounded-xl text-muted-foreground hover:text-foreground"
                onClick={() => onOpenChange(false)}
              >
                {data.cta_url?.trim() ? "Agora não" : "Entendi"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

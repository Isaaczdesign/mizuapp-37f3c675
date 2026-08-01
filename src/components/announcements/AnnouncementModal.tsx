import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ANNOUNCEMENT_ICONS } from "@/components/announcements/AnnouncementCard";
import { Megaphone } from "lucide-react";

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden p-0">
        {media && type === "image" && (
          <img
            src={media}
            alt={data.title}
            className="aspect-square w-full object-cover object-center"
            loading="lazy"
          />
        )}
        {media && type === "video" && (
          <video
            src={media}
            className="aspect-square w-full bg-black object-cover"
            autoPlay
            muted
            loop
            playsInline
            controls
          />
        )}

        <div className="space-y-3 p-6 pt-4 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10">
            <Icon className="h-5 w-5 text-accent" />
          </div>
          <h2 className="text-lg font-semibold">{data.title || "Título do aviso"}</h2>
          <p className="whitespace-pre-line text-sm text-muted-foreground">
            {data.body || "Mensagem que o dono do restaurante vai ler."}
          </p>
          <div className="flex flex-col gap-2 pt-1">
            {data.cta_url?.trim() && (
              <Button asChild>
                <a href={data.cta_url} target="_blank" rel="noopener noreferrer">
                  {data.cta_label?.trim() || "Saiba mais"}
                </a>
              </Button>
            )}
            <Button variant={data.cta_url?.trim() ? "ghost" : "default"} onClick={() => onOpenChange(false)}>
              Entendi
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

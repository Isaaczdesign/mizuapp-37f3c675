import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, ArrowUp, ArrowDown, Layers } from "lucide-react";
import MediaUploader from "@/components/admin-mizu/MediaUploader";

export type AnnouncementSlide = {
  title: string;
  body: string;
  media_type: "none" | "image" | "video";
  media_url: string;
  media_poster: string;
  media_loop: boolean;
  cta_label: string;
  cta_url: string;
};

export const emptySlide = (): AnnouncementSlide => ({
  title: "",
  body: "",
  media_type: "none",
  media_url: "",
  media_poster: "",
  media_loop: true,
  cta_label: "",
  cta_url: "",
});

type Props = {
  slides: AnnouncementSlide[];
  onChange: (slides: AnnouncementSlide[]) => void;
};

export default function AnnouncementSlidesEditor({ slides, onChange }: Props) {
  const update = (index: number, patch: Partial<AnnouncementSlide>) =>
    onChange(slides.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= slides.length) return;
    const next = [...slides];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <p className="text-xs font-semibold">
            Novidades extras neste mesmo pop-up{slides.length > 0 ? ` (${slides.length})` : ""}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => onChange([...slides, emptySlide()])}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Adicionar novidade
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        A novidade principal acima é a tela 1. Cada novidade extra vira uma tela seguinte no mesmo pop-up.
      </p>

      {slides.map((slide, index) => (
        <div key={index} className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-muted-foreground">Tela {index + 2}</p>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Mover para cima" onClick={() => move(index, -1)}>
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Mover para baixo" onClick={() => move(index, 1)}>
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                aria-label="Remover novidade"
                onClick={() => onChange(slides.filter((_, i) => i !== index))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <Input
            placeholder="Título desta novidade"
            value={slide.title}
            maxLength={120}
            onChange={(e) => update(index, { title: e.target.value })}
          />
          <Textarea
            placeholder="Mensagem desta novidade"
            value={slide.body}
            rows={3}
            maxLength={600}
            onChange={(e) => update(index, { body: e.target.value })}
          />

          <div className="flex flex-wrap gap-2">
            {([
              { id: "none", label: "Sem mídia" },
              { id: "image", label: "Imagem" },
              { id: "video", label: "Vídeo" },
            ] as const).map((o) => (
              <button
                key={o.id}
                onClick={() => update(index, { media_type: o.id })}
                className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                  slide.media_type === o.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted/60"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          {slide.media_type !== "none" && (
            <div className="space-y-2">
              <MediaUploader
                kind={slide.media_type}
                value={slide.media_url}
                onChange={(url) => update(index, { media_url: url })}
                label={slide.media_type === "video" ? "Vídeo desta novidade" : "Imagem desta novidade"}
              />
              <Input
                placeholder={slide.media_type === "video" ? "Ou cole a URL do vídeo (.mp4)" : "Ou cole a URL da imagem"}
                value={slide.media_url}
                onChange={(e) => update(index, { media_url: e.target.value })}
              />
              {slide.media_type === "video" && (
                <>
                  <MediaUploader
                    kind="image"
                    value={slide.media_poster}
                    onChange={(url) => update(index, { media_poster: url })}
                    label="Miniatura do vídeo (opcional)"
                  />
                  <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <p className="text-xs text-muted-foreground">Repetir vídeo automaticamente (loop)</p>
                    <Switch
                      checked={slide.media_loop}
                      onCheckedChange={(v) => update(index, { media_loop: v })}
                      aria-label="Loop do vídeo"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              placeholder="Texto do botão (opcional)"
              value={slide.cta_label}
              maxLength={40}
              onChange={(e) => update(index, { cta_label: e.target.value })}
            />
            <Input
              placeholder="Link do botão (opcional)"
              value={slide.cta_url}
              onChange={(e) => update(index, { cta_url: e.target.value })}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

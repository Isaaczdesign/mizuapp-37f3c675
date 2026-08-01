import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, ArrowUp, ArrowDown, Layers, GripVertical, Check } from "lucide-react";
import MediaUploader from "@/components/admin-mizu/MediaUploader";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";

export type AnnouncementSlide = {
  id: string;
  title: string;
  body: string;
  media_type: "none" | "image" | "video";
  media_url: string;
  media_poster: string;
  media_loop: boolean;
  cta_label: string;
  cta_url: string;
};

export const SLIDES_DRAFT_KEY = "mizu:announcement-slides-draft";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `slide-${Math.random().toString(36).slice(2)}`;

export const emptySlide = (): AnnouncementSlide => ({
  id: newId(),
  title: "",
  body: "",
  media_type: "none",
  media_url: "",
  media_poster: "",
  media_loop: true,
  cta_label: "",
  cta_url: "",
});

/** Recupera o rascunho salvo automaticamente (inclui a ordem das novidades). */
export function loadSlidesDraft(): AnnouncementSlide[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SLIDES_DRAFT_KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw.map((s: Partial<AnnouncementSlide>) => ({ ...emptySlide(), ...s, id: s.id ?? newId() }));
  } catch {
    return [];
  }
}

export function clearSlidesDraft() {
  localStorage.removeItem(SLIDES_DRAFT_KEY);
}

type Props = {
  slides: AnnouncementSlide[];
  onChange: (slides: AnnouncementSlide[]) => void;
};

function SortableSlide({
  slide,
  index,
  total,
  update,
  move,
  remove,
}: {
  slide: AnnouncementSlide;
  index: number;
  total: number;
  update: (index: number, patch: Partial<AnnouncementSlide>) => void;
  move: (index: number, dir: -1 | 1) => void;
  remove: (index: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: slide.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`space-y-2 rounded-lg border bg-muted/20 p-3 ${
        isDragging ? "z-10 border-primary/60 shadow-[var(--shadow-glass)] opacity-90" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Arrastar para reordenar"
            className="cursor-grab touch-none rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <p className="text-xs font-semibold text-muted-foreground">Tela {index + 2}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Mover para cima" onClick={() => move(index, -1)} disabled={index === 0}>
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Mover para baixo" onClick={() => move(index, 1)} disabled={index === total - 1}>
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            aria-label="Remover novidade"
            onClick={() => remove(index)}
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
  );
}

export default function AnnouncementSlidesEditor({ slides, onChange }: Props) {
  const firstRender = useRef(true);

  // Salva automaticamente (inclusive a ordem) enquanto o aviso não é publicado.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      if (slides.length === 0) return;
    }
    try {
      localStorage.setItem(SLIDES_DRAFT_KEY, JSON.stringify(slides));
    } catch {
      /* ignora quota */
    }
  }, [slides]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const update = (index: number, patch: Partial<AnnouncementSlide>) =>
    onChange(slides.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= slides.length) return;
    onChange(arrayMove(slides, index, target));
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = slides.findIndex((s) => s.id === active.id);
    const to = slides.findIndex((s) => s.id === over.id);
    if (from < 0 || to < 0) return;
    onChange(arrayMove(slides, from, to));
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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-[11px] text-muted-foreground">
          A novidade principal acima é a tela 1. Arraste pelo ícone <GripVertical className="inline h-3 w-3 align-text-bottom" /> para reordenar.
        </p>
        {slides.length > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/80">
            <Check className="h-3 w-3 text-primary" />
            Ordem salva automaticamente
          </span>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={slides.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {slides.map((slide, index) => (
              <SortableSlide
                key={slide.id}
                slide={slide}
                index={index}
                total={slides.length}
                update={update}
                move={move}
                remove={(i) => onChange(slides.filter((_, idx) => idx !== i))}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

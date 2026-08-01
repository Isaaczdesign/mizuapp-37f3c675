import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UploadCloud, Loader2, X, ImageIcon, Film } from "lucide-react";

const BUCKET = "platform-media";
const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

type Kind = "image" | "video";

type Props = {
  kind: Kind;
  value: string;
  onChange: (url: string) => void;
  label?: string;
  hint?: string;
  maxMb?: number;
};

const sanitize = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .toLowerCase();

/** Upload de imagem/vídeo para os avisos da plataforma (arraste ou selecione). */
export default function MediaUploader({ kind, value, onChange, label, hint, maxMb }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const limitMb = maxMb ?? (kind === "video" ? 200 : 25);
  const accept = kind === "video" ? "video/mp4,video/webm,video/quicktime" : "image/*";
  const Icon = kind === "video" ? Film : ImageIcon;

  const upload = async (file: File) => {
    if (!file.type.startsWith(kind === "video" ? "video/" : "image/")) {
      toast.error(kind === "video" ? "Selecione um arquivo de vídeo." : "Selecione um arquivo de imagem.");
      return;
    }
    if (file.size > limitMb * 1024 * 1024) {
      toast.error(`Arquivo muito grande. Limite de ${limitMb}MB.`);
      return;
    }
    setUploading(true);
    const path = `announcements/${Date.now()}-${sanitize(file.name)}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      setUploading(false);
      toast.error("Não foi possível enviar o arquivo.");
      return;
    }
    const { data, error: signErr } = await supabase.storage.from(BUCKET).createSignedUrl(path, TEN_YEARS);
    setUploading(false);
    if (signErr || !data?.signedUrl) {
      toast.error("Arquivo enviado, mas não foi possível gerar o link.");
      return;
    }
    onChange(data.signedUrl);
    toast.success(kind === "video" ? "Vídeo enviado." : "Imagem enviada.");
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void upload(file);
  };

  return (
    <div className="space-y-2">
      {label && <p className="text-xs font-medium text-muted-foreground">{label}</p>}

      {value ? (
        <div className="relative overflow-hidden rounded-xl border border-border bg-muted/20">
          {kind === "image" ? (
            <img src={value} alt="Prévia da mídia" className="max-h-56 w-full bg-brand-ink object-contain object-center" />
          ) : (
            <video src={value} className="max-h-56 w-full bg-brand-ink object-contain" muted playsInline controls />
          )}
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Remover mídia"
            className="absolute right-2 top-2 rounded-full bg-background/80 p-1.5 text-foreground backdrop-blur transition-colors hover:bg-background"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          disabled={uploading}
          className={`flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed p-6 text-center transition-colors ${
            dragging ? "border-primary bg-primary/10" : "border-border bg-muted/20 hover:border-accent/40 hover:bg-muted/40"
          }`}
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (
            <UploadCloud className="h-5 w-5 text-accent" />
          )}
          <span className="text-xs font-medium">
            {uploading ? "Enviando..." : `Arraste ou clique para enviar ${kind === "video" ? "um vídeo" : "uma imagem"}`}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Icon className="h-3 w-3" />
            {hint ?? (kind === "video" ? `MP4 ou WebM, qualquer proporção, até ${limitMb}MB` : `JPG/PNG/WebP, qualquer proporção, até ${limitMb}MB`)}
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

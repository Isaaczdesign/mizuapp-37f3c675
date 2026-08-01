import { Megaphone, Info, AlertTriangle, Wrench, X } from "lucide-react";

export const ANNOUNCEMENT_ICONS: Record<string, typeof Info> = {
  info: Info,
  update: Megaphone,
  warning: AlertTriangle,
  maintenance: Wrench,
};

export const ANNOUNCEMENT_STYLES: Record<string, string> = {
  info: "border-border bg-secondary/50",
  update: "border-accent/30 bg-accent/10",
  warning: "border-primary/30 bg-primary/10",
  maintenance: "border-border bg-muted/50",
};

type Props = {
  title: string;
  body: string;
  variant: string;
  onDismiss?: () => void;
};

export default function AnnouncementCard({ title, body, variant, onDismiss }: Props) {
  const Icon = ANNOUNCEMENT_ICONS[variant] ?? Megaphone;
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border p-3.5 ${
        ANNOUNCEMENT_STYLES[variant] ?? ANNOUNCEMENT_STYLES.update
      }`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title || "Título do aviso"}</p>
        <p className="mt-0.5 whitespace-pre-line text-xs text-muted-foreground">
          {body || "Mensagem que o dono do restaurante vai ler no topo do painel."}
        </p>
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dispensar aviso"
        className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

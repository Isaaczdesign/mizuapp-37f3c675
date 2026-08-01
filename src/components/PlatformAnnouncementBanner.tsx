import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Megaphone, Info, AlertTriangle, Wrench, X } from "lucide-react";

type Announcement = {
  id: string;
  title: string;
  body: string;
  variant: string;
};

const ICONS: Record<string, typeof Info> = {
  info: Info,
  update: Megaphone,
  warning: AlertTriangle,
  maintenance: Wrench,
};

const STYLES: Record<string, string> = {
  info: "border-border bg-secondary/50",
  update: "border-accent/30 bg-accent/10",
  warning: "border-primary/30 bg-primary/10",
  maintenance: "border-border bg-muted/50",
};

const DISMISS_KEY = "mizu:dismissed-announcements";

function readDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export default function PlatformAnnouncementBanner() {
  const { user } = useAuth();
  const [items, setItems] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<string[]>(() => readDismissed());

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("platform_announcements")
        .select("id, title, body, variant")
        .eq("active", true)
        .lte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: false })
        .limit(3);
      setItems((data ?? []) as Announcement[]);
    })();
  }, [user]);

  const dismiss = (id: string) => {
    const next = [...new Set([...readDismissed(), id])];
    localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
    setDismissed(next);
  };

  const visible = items.filter((a) => !dismissed.includes(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2 px-4 pt-4 md:px-6">
      {visible.map((a) => {
        const Icon = ICONS[a.variant] ?? Megaphone;
        return (
          <div
            key={a.id}
            className={`flex items-start gap-3 rounded-2xl border p-3.5 ${STYLES[a.variant] ?? STYLES.update}`}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{a.title}</p>
              <p className="mt-0.5 whitespace-pre-line text-xs text-muted-foreground">{a.body}</p>
            </div>
            <button
              onClick={() => dismiss(a.id)}
              aria-label="Dispensar aviso"
              className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

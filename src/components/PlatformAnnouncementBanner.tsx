import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AnnouncementCard from "@/components/announcements/AnnouncementCard";

type Announcement = {
  id: string;
  title: string;
  body: string;
  variant: string;
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
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("platform_announcements")
        .select("id, title, body, variant")
        .eq("active", true)
        .lte("starts_at", now)
        .or(`ends_at.is.null,ends_at.gt.${now}`)
        .order("starts_at", { ascending: false })
        .limit(3);

      const list = (data ?? []) as Announcement[];
      setItems(list);

      if (list.length > 0) {
        const { data: rid } = await supabase.rpc("get_user_restaurant_id", { _user_id: user.id });
        await supabase.from("platform_announcement_views").upsert(
          list.map((a) => ({
            announcement_id: a.id,
            user_id: user.id,
            restaurant_id: (rid as string | null) ?? null,
          })),
          { onConflict: "announcement_id,user_id", ignoreDuplicates: true }
        );
      }
    })();
  }, [user]);

  const dismiss = async (id: string) => {
    const next = [...new Set([...readDismissed(), id])];
    localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
    setDismissed(next);
    if (user) {
      await supabase
        .from("platform_announcement_views")
        .update({ dismissed_at: new Date().toISOString() })
        .eq("announcement_id", id)
        .eq("user_id", user.id);
    }
  };

  const visible = items.filter((a) => !dismissed.includes(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2 px-4 pt-4 md:px-6">
      {visible.map((a) => (
        <AnnouncementCard
          key={a.id}
          title={a.title}
          body={a.body}
          variant={a.variant}
          onDismiss={() => dismiss(a.id)}
        />
      ))}
    </div>
  );
}

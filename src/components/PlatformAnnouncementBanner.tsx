import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AnnouncementCard from "@/components/announcements/AnnouncementCard";
import AnnouncementModal from "@/components/announcements/AnnouncementModal";

type Announcement = {
  id: string;
  title: string;
  body: string;
  variant: string;
  media_url: string | null;
  media_type: string | null;
  media_poster: string | null;
  media_loop: boolean | null;
  show_modal: boolean;
  cta_label: string | null;
  cta_url: string | null;
  starts_at: string | null;
  created_at: string | null;
};

const DISMISS_KEY = "mizu:dismissed-announcements";
const MODAL_KEY = "mizu:seen-announcement-modals";

function readList(key: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]");
  } catch {
    return [];
  }
}

export default function PlatformAnnouncementBanner() {
  const { user } = useAuth();
  const [items, setItems] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<string[]>(() => readList(DISMISS_KEY));
  const [modalItems, setModalItems] = useState<Announcement[]>([]);
  const restaurantIdRef = useRef<string | null>(null);

  const fetchAnnouncements = useCallback(async () => {
    if (!user) return;
    const now = new Date().toISOString();
    const { data } = await supabase
      .from("platform_announcements")
      .select(
        "id, title, body, variant, media_url, media_type, media_poster, media_loop, show_modal, cta_label, cta_url, starts_at, created_at"
      )
      .eq("active", true)
      .lte("starts_at", now)
      .or(`ends_at.is.null,ends_at.gt.${now}`)
      .order("starts_at", { ascending: false })
      .limit(3);

    const list = (data ?? []) as Announcement[];
    setItems(list);
    if (list.length === 0) return;

    if (restaurantIdRef.current === null) {
      const { data: rid } = await supabase.rpc("get_user_restaurant_id", { _user_id: user.id });
      restaurantIdRef.current = (rid as string | null) ?? null;
    }
    await supabase.from("platform_announcement_views").upsert(
      list.map((a) => ({
        announcement_id: a.id,
        user_id: user.id,
        restaurant_id: restaurantIdRef.current,
      })),
      { onConflict: "announcement_id,user_id", ignoreDuplicates: true }
    );

    const seenModals = readList(MODAL_KEY);
    const next = list.find((a) => a.show_modal && !seenModals.includes(a.id));
    if (next) setModalItem(next);
  }, [user]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("platform-announcements")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "platform_announcements" },
        () => fetchAnnouncements()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchAnnouncements]);

  const closeModal = () => {
    if (modalItem) {
      const next = [...new Set([...readList(MODAL_KEY), modalItem.id])];
      localStorage.setItem(MODAL_KEY, JSON.stringify(next));
    }
    setModalItem(null);
  };

  const dismiss = async (id: string) => {
    const next = [...new Set([...readList(DISMISS_KEY), id])];
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

  // Avisos de atualização aparecem só no pop-up, não no topo do painel.
  const visible = items.filter((a) => !dismissed.includes(a.id) && a.variant !== "update");

  return (
    <>
      {modalItem && (
        <AnnouncementModal
          open={!!modalItem}
          onOpenChange={(o) => !o && closeModal()}
          data={modalItem}
        />
      )}
      {visible.length > 0 && (
        <div className="space-y-2 px-4 pt-4 md:px-6">
          {visible.map((a) => (
            <div key={a.id} className="animate-fade-in">
              <AnnouncementCard
                title={a.title}
                body={a.body}
                variant={a.variant}
                onDismiss={() => dismiss(a.id)}
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

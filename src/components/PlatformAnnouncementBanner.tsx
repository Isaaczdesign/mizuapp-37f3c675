import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AnnouncementCard from "@/components/announcements/AnnouncementCard";
import AnnouncementModal from "@/components/announcements/AnnouncementModal";
import { resolvePlatformMediaUrl } from "@/lib/platformMedia";

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
  slides: AnnouncementSlide[] | null;
};

type AnnouncementSlide = {
  title?: string | null;
  body?: string | null;
  media_url?: string | null;
  media_type?: string | null;
  media_poster?: string | null;
  media_loop?: boolean | null;
  cta_label?: string | null;
  cta_url?: string | null;
};

/** Um aviso pode conter várias novidades — vira uma sequência de telas no pop-up. */
function toModalItems(a: Announcement) {
  const base = {
    id: a.id,
    title: a.title,
    body: a.body,
    variant: a.variant,
    media_url: a.media_url,
    media_type: a.media_type,
    media_poster: a.media_poster,
    media_loop: a.media_loop,
    cta_label: a.cta_label,
    cta_url: a.cta_url,
    starts_at: a.starts_at,
    created_at: a.created_at,
  };
  const extras = (a.slides ?? []).map((s, i) => {
    const url = s.media_url?.trim() || null;
    return {
      ...base,
      id: `${a.id}:${i}`,
      title: s.title ?? "",
      body: s.body ?? "",
      media_url: url,
      media_type: s.media_type && s.media_type !== "none" ? s.media_type : url ? "image" : "none",
      media_poster: s.media_poster ?? null,
      media_loop: s.media_loop ?? true,
      cta_label: s.cta_label ?? null,
      cta_url: s.cta_url ?? null,
    };
  });
  return [base, ...extras];
}

async function preloadModalItems(items: ReturnType<typeof toModalItems>) {
  const resolved = await Promise.all(
    items.map(async (item) => ({
      ...item,
      media_url: await resolvePlatformMediaUrl(item.media_url),
      media_poster: await resolvePlatformMediaUrl(item.media_poster),
    }))
  );

  await Promise.all(
    resolved.map(
      (item) =>
        new Promise<void>((done) => {
          if (item.media_type !== "image" || !item.media_url) {
            done();
            return;
          }
          const image = new Image();
          image.onload = () => done();
          image.onerror = () => done();
          image.src = item.media_url;
          if (image.complete) done();
        })
    )
  );

  return resolved;
}

const DISMISS_KEY = "mizu:dismissed-announcements";
const MODAL_KEY = "mizu:seen-announcement-modals";

/** Identidade do pop-up por publicação — muda quando o aviso é reenviado ou editado. */
const modalKey = (a: Announcement) => `${a.id}@${a.starts_at ?? ""}`;

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
  const [modalItems, setModalItems] = useState<ReturnType<typeof toModalItems>>([]);
  const [modalIds, setModalIds] = useState<string[]>([]);
  const restaurantIdRef = useRef<string | null>(null);

  const fetchAnnouncements = useCallback(async () => {
    if (!user) return;
    const now = new Date().toISOString();
    const { data } = await supabase
      .from("platform_announcements")
      .select(
        "id, title, body, variant, media_url, media_type, media_poster, media_loop, show_modal, cta_label, cta_url, starts_at, created_at, slides"
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
    // A chave inclui a data de publicação: ao reenviar/editar, o pop-up volta a aparecer.
    const pending = list.filter((a) => a.show_modal && !seenModals.includes(modalKey(a)));
    if (pending.length > 0) {
      const nextModalIds = pending.map(modalKey);
      const nextModalItems = await preloadModalItems(pending.flatMap(toModalItems));
      setModalIds(nextModalIds);
      setModalItems(nextModalItems);
    }
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
    if (modalIds.length > 0) {
      const next = [...new Set([...readList(MODAL_KEY), ...modalIds])];
      localStorage.setItem(MODAL_KEY, JSON.stringify(next));
    }
    setModalIds([]);
    setModalItems([]);
  };

  const dismiss = async (a: Announcement) => {
    const next = [...new Set([...readList(DISMISS_KEY), modalKey(a)])];
    localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
    setDismissed(next);
    if (user) {
      await supabase
        .from("platform_announcement_views")
        .update({ dismissed_at: new Date().toISOString() })
        .eq("announcement_id", a.id)
        .eq("user_id", user.id);
    }
  };

  // Avisos de atualização aparecem só no pop-up, não no topo do painel.
  const visible = items.filter((a) => !dismissed.includes(modalKey(a)) && a.variant !== "update");

  return (
    <>
      {modalItems.length > 0 && (
        <AnnouncementModal
          open={modalItems.length > 0}
          onOpenChange={(o) => !o && closeModal()}
          items={modalItems}
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
                onDismiss={() => dismiss(a)}
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

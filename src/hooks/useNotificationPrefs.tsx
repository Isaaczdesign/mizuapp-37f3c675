import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type PopupPosition = "top-right" | "top-left" | "bottom-right" | "bottom-left" | "top-center";

export interface NotificationPrefs {
  sound_enabled: boolean;
  browser_push_enabled: boolean;
  popup_enabled: boolean;
  popup_position: PopupPosition;
}

const DEFAULTS: NotificationPrefs = {
  sound_enabled: true,
  browser_push_enabled: true,
  popup_enabled: true,
  popup_position: "top-right",
};

const LOCAL_KEY = "notification_prefs_cache";

export function useNotificationPrefs() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_KEY);
      if (cached) return { ...DEFAULTS, ...JSON.parse(cached) };
    } catch {}
    return DEFAULTS;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from("notification_preferences")
        .select("sound_enabled, browser_push_enabled, popup_enabled, popup_position")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        const next = { ...DEFAULTS, ...data } as NotificationPrefs;
        setPrefs(next);
        localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
      }
      setLoading(false);
    })();
  }, [user]);

  const save = useCallback(async (patch: Partial<NotificationPrefs>) => {
    if (!user) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
    await supabase.from("notification_preferences").upsert(
      { user_id: user.id, ...next },
      { onConflict: "user_id" }
    );
  }, [user, prefs]);

  return { prefs, save, loading };
}

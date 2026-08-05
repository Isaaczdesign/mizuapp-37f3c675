import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { menuPath } from "@/lib/publicMenuUrl";

const ShortLink = () => {
  const { code } = useParams<{ code: string }>();
  const [slug, setSlug] = useState<string | null | undefined>(undefined); // undefined = loading

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!code) { setSlug(null); return; }
      const { data } = await (supabase as any).rpc("resolve_short_code", { _code: code });
      if (cancelled) return;
      const row = Array.isArray(data) ? data[0] : data;
      setSlug(row?.slug ?? null);
    })();
    return () => { cancelled = true; };
  }, [code]);

  if (slug === undefined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!slug) return <Navigate to="/" replace />;
  return <Navigate to={menuPath(slug)} replace />;
};

export default ShortLink;

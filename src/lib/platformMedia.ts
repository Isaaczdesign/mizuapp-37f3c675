import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "platform-media";
const ONE_DAY = 60 * 60 * 24;

/** Extrai o caminho do arquivo a partir de uma URL assinada/pública do bucket de mídias. */
export function extractPlatformMediaPath(url?: string | null): string | null {
  if (!url) return null;
  const match = url.match(new RegExp(`/storage/v1/object/(?:sign|public|authenticated)/${BUCKET}/([^?]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Gera um link novo para a mídia sempre que ela é exibida.
 * Links assinados antigos podem expirar/invalidar — assim a imagem nunca some.
 */
export function usePlatformMediaUrl(url?: string | null): string | null {
  const [resolved, setResolved] = useState<string | null>(url ?? null);

  useEffect(() => {
    let active = true;
    setResolved(url ?? null);
    const path = extractPlatformMediaPath(url);
    if (!path) return;
    (async () => {
      const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, ONE_DAY);
      if (active && data?.signedUrl) setResolved(data.signedUrl);
    })();
    return () => {
      active = false;
    };
  }, [url]);

  return resolved;
}

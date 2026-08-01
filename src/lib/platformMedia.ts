import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "platform-media";
const ONE_DAY = 60 * 60 * 24;
const resolvedMediaCache = new Map<string, Promise<string>>();

/** Extrai o caminho do arquivo a partir de uma URL assinada/pública do bucket de mídias. */
export function extractPlatformMediaPath(url?: string | null): string | null {
  if (!url) return null;
  const match = url.match(new RegExp(`/storage/v1/object/(?:sign|public|authenticated)/${BUCKET}/([^?]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Resolve uma URL uma única vez por sessão para evitar troca de src e recarregamento visual. */
export function resolvePlatformMediaUrl(url?: string | null): Promise<string | null> {
  if (!url) return Promise.resolve(null);
  const path = extractPlatformMediaPath(url);
  if (!path) return Promise.resolve(url);

  const cached = resolvedMediaCache.get(path);
  if (cached) return cached;

  const request = supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, ONE_DAY)
    .then(({ data }) => data?.signedUrl ?? url)
    .catch(() => url);
  resolvedMediaCache.set(path, request);
  return request;
}

/**
 * Gera um link novo para a mídia sempre que ela é exibida.
 * Links assinados antigos podem expirar/invalidar — assim a imagem nunca some.
 */
export function usePlatformMediaUrl(url?: string | null): string | null {
  const path = extractPlatformMediaPath(url);
  const [resolved, setResolved] = useState<string | null>(path ? null : (url ?? null));

  useEffect(() => {
    let active = true;
    if (!path) {
      setResolved(url ?? null);
      return;
    }
    setResolved(null);
    resolvePlatformMediaUrl(url).then((next) => {
      if (active) setResolved(next);
    });
    return () => {
      active = false;
    };
  }, [path, url]);

  return resolved;
}

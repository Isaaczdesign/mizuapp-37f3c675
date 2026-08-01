import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";

type Props = {
  src: string;
  poster?: string | null;
  loop?: boolean;
  title?: string;
};

const isCoarsePointer = () =>
  typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const saveData = () => {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } })
    .connection;
  return !!c?.saveData || /2g/.test(c?.effectiveType ?? "");
};

/** Vídeo do pop-up: thumbnail, autoplay controlado, loop opcional e reprodução estável no iOS. */
export default function AnnouncementVideo({ src, poster, loop = true, title }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  // Autoplay só quando faz sentido: desktop, sem economia de dados e sem "reduzir animações".
  const shouldAutoplay = useRef(false);
  if (shouldAutoplay.current === false && typeof window !== "undefined") {
    shouldAutoplay.current = !isCoarsePointer() && !prefersReducedMotion() && !saveData();
  }

  /**
   * iOS/Safari só inicia a reprodução se o elemento estiver mudo, inline e com
   * metadata carregada. Também precisamos reagir à promessa de play() e a
   * interrupções (AbortError ao trocar de aba / fechar o modal).
   */
  const safePlay = useCallback(async (fromUserGesture: boolean) => {
    const video = videoRef.current;
    if (!video) return false;
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    if (!fromUserGesture) video.muted = true;

    const attempt = async () => {
      try {
        await video.play();
        return true;
      } catch {
        // Última tentativa: forçar mudo (regra de autoplay do iOS).
        if (!video.muted) {
          video.muted = true;
          setMuted(true);
          try {
            await video.play();
            return true;
          } catch {
            return false;
          }
        }
        return false;
      }
    };

    if (video.readyState < 1) {
      video.load();
      await new Promise<void>((resolve) => {
        const done = () => resolve();
        video.addEventListener("loadedmetadata", done, { once: true });
        window.setTimeout(done, 1200);
      });
    }

    const ok = await attempt();
    if (ok) {
      setStarted(true);
      setPlaying(true);
    }
    return ok;
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    setStarted(false);
    setPlaying(false);
    if (!video) return;
    if (shouldAutoplay.current) void safePlay(false);
    return () => {
      video.pause();
    };
  }, [src, safePlay]);

  // iOS pausa o vídeo ao sair da aba; retoma quando ela volta a ficar visível.
  useEffect(() => {
    const onVisible = () => {
      const video = videoRef.current;
      if (!video) return;
      if (document.hidden) {
        video.pause();
      } else if (started && playing) {
        void video.play().catch(() => undefined);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [started, playing]);

  const toggle = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void safePlay(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  };

  const toggleSound = () => {
    const video = videoRef.current;
    if (!video) return;
    const next = !video.muted;
    video.muted = next;
    setMuted(next);
    // Ativar som no iOS exige que o play parta do gesto do usuário.
    if (!next && video.paused) void safePlay(true);
  };

  return (
    <div className="group relative w-full overflow-hidden bg-brand-ink aspect-[4/3] max-h-[52vh] sm:aspect-square sm:max-h-none">
      <video
        ref={videoRef}
        src={src}
        poster={poster ?? undefined}
        className="h-full w-full object-cover object-center"
        playsInline
        {...({ "webkit-playsinline": "true", "x5-playsinline": "true" } as Record<string, string>)}
        disablePictureInPicture
        controls={false}
        muted={muted}
        loop={loop}
        preload={shouldAutoplay.current ? "auto" : "metadata"}
        onPlay={() => {
          setStarted(true);
          setPlaying(true);
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />

      {/* Thumbnail com play — some assim que o vídeo começa */}
      {!started && (
        <button
          type="button"
          onClick={toggle}
          aria-label={`Reproduzir vídeo${title ? `: ${title}` : ""}`}
          className="absolute inset-0 flex items-center justify-center bg-brand-ink/35 backdrop-blur-[1px] transition-colors hover:bg-brand-ink/25"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full border border-accent/40 bg-background/80 shadow-[var(--shadow-orange)] transition-transform duration-300 hover:scale-105">
            <Play className="ml-0.5 h-6 w-6 fill-accent text-accent" />
          </span>
        </button>
      )}

      {/* Controles mínimos */}
      {started && (
        <div className="absolute bottom-3 left-3 flex gap-2 opacity-0 transition-opacity duration-200 focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100">
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? "Pausar vídeo" : "Reproduzir vídeo"}
            className="rounded-full bg-background/70 p-2 text-foreground backdrop-blur transition-colors hover:bg-background"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={toggleSound}
            aria-label={muted ? "Ativar som" : "Desativar som"}
            className="rounded-full bg-background/70 p-2 text-foreground backdrop-blur transition-colors hover:bg-background"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      )}
    </div>
  );
}

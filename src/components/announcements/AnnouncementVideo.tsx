import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize } from "lucide-react";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const wasPlayingRef = useRef(false);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [ratio, setRatio] = useState<number | null>(null);

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

  // Tela cheia: usa a API padrão no container e o modo nativo do iOS no vídeo.
  const openFullscreen = async () => {
    const video = videoRef.current as (HTMLVideoElement & {
      webkitEnterFullscreen?: () => void;
      webkitSupportsFullscreen?: boolean;
    }) | null;
    const container = containerRef.current as (HTMLDivElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    }) | null;
    if (!video) return;

    wasPlayingRef.current = !video.paused;
    if (video.paused) await safePlay(true);

    try {
      if (container?.requestFullscreen) {
        await container.requestFullscreen();
        setFullscreen(true);
      } else if (container?.webkitRequestFullscreen) {
        await container.webkitRequestFullscreen();
        setFullscreen(true);
      } else if (video.webkitEnterFullscreen) {
        // iPhone: só o elemento <video> entra em tela cheia (player nativo).
        video.webkitEnterFullscreen();
        setFullscreen(true);
      }
    } catch {
      /* usuário/navegador recusou — segue no pop-up */
    }
  };

  const exitFullscreen = async () => {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        /* noop */
      }
    }
    setFullscreen(false);
  };

  const toggleFullscreen = () => {
    if (fullscreen || document.fullscreenElement) void exitFullscreen();
    else void openFullscreen();
  };

  // Ao sair da tela cheia (gesto, ESC ou player nativo do iOS) volta ao estado do pop-up.
  useEffect(() => {
    const video = videoRef.current;

    const restore = () => {
      setFullscreen(false);
      const v = videoRef.current;
      if (!v) return;
      v.setAttribute("playsinline", "");
      if (wasPlayingRef.current) {
        void v.play().catch(() => undefined);
      } else {
        v.pause();
      }
    };

    const onChange = () => {
      if (document.fullscreenElement) setFullscreen(true);
      else restore();
    };

    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    video?.addEventListener("webkitendfullscreen", restore);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
      video?.removeEventListener("webkitendfullscreen", restore);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`group relative w-full overflow-hidden bg-brand-ink ${
        fullscreen
          ? "flex h-full max-h-none items-center justify-center aspect-auto"
          : "max-h-[55vh] md:max-h-[62vh]"
      }`}
      style={fullscreen ? undefined : { aspectRatio: ratio ?? 4 / 3 }}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster ?? undefined}
        className="h-full w-full object-contain object-center"
        playsInline
        {...({ "webkit-playsinline": "true", "x5-playsinline": "true" } as Record<string, string>)}
        controls={false}
        muted={muted}
        loop={loop}
        preload={shouldAutoplay.current ? "auto" : "metadata"}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          if (v.videoWidth && v.videoHeight) setRatio(v.videoWidth / v.videoHeight);
        }}
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
          className="absolute inset-0 z-10 flex items-center justify-center bg-brand-ink/35 backdrop-blur-[1px] transition-colors hover:bg-brand-ink/25"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full border border-accent/40 bg-background/80 shadow-[var(--shadow-orange)] transition-transform duration-300 hover:scale-105">
            <Play className="ml-0.5 h-6 w-6 fill-accent text-accent" />
          </span>
        </button>
      )}

      {/* Toque na área do vídeo abre em tela cheia */}
      {started && (
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={fullscreen ? "Sair da tela cheia" : "Abrir vídeo em tela cheia"}
          className="absolute inset-0 z-0 cursor-zoom-in"
        />
      )}

      {/* Controles mínimos */}
      {started && (
        <div className="absolute bottom-3 left-3 z-20 flex gap-2 opacity-0 transition-opacity duration-200 focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100">
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
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? "Sair da tela cheia" : "Tela cheia"}
            className="rounded-full bg-background/70 p-2 text-foreground backdrop-blur transition-colors hover:bg-background"
          >
            {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        </div>
      )}
    </div>
  );
}

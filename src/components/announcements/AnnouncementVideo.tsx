import { useEffect, useRef, useState } from "react";
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

/** Vídeo do pop-up: thumbnail, autoplay controlado e loop opcional — leve no mobile. */
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

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !shouldAutoplay.current) return;
    video.muted = true;
    video
      .play()
      .then(() => {
        setStarted(true);
        setPlaying(true);
      })
      .catch(() => setPlaying(false));
    return () => {
      video.pause();
    };
  }, [src]);

  const toggle = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => {
        setStarted(true);
        setPlaying(true);
      }).catch(() => undefined);
    } else {
      video.pause();
      setPlaying(false);
    }
  };

  const toggleSound = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  };

  return (
    <div className="group relative aspect-square w-full overflow-hidden bg-brand-ink">
      <video
        ref={videoRef}
        src={src}
        poster={poster ?? undefined}
        className="h-full w-full object-cover object-center"
        playsInline
        muted={muted}
        loop={loop}
        preload={shouldAutoplay.current ? "auto" : "metadata"}
        onPlay={() => setPlaying(true)}
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
          <span
            className="flex h-16 w-16 items-center justify-center rounded-full border border-accent/40 bg-background/80 shadow-[var(--shadow-orange)] transition-transform duration-300 hover:scale-105"
          >
            <Play className="ml-0.5 h-6 w-6 fill-accent text-accent" />
          </span>
        </button>
      )}

      {/* Controles mínimos */}
      {started && (
        <div className="absolute bottom-3 left-3 flex gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100 max-md:opacity-100">
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

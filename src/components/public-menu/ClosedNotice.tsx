import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock } from "lucide-react";
import { isOpenNow, nextOpenAt, DEFAULT_TZ, type OperatingHours } from "@/lib/operatingHours";

type Parts = { days: number; hours: number; minutes: number; seconds: number; total: number };

function diffParts(target: Date, now: Date): Parts {
  const ms = Math.max(0, target.getTime() - now.getTime());
  const totalSec = Math.floor(ms / 1000);
  return {
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
    total: totalSec,
  };
}

function Unit({ value, label }: { value: number; label: string }) {
  const text = String(value).padStart(2, "0");
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-9 min-w-[42px] px-2 rounded-xl bg-white/[0.05] border border-white/[0.08] overflow-hidden flex items-center justify-center">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={text}
            initial={{ y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -14, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="font-display text-[16px] font-bold tabular-nums text-amber-200"
          >
            {text}
          </motion.span>
        </AnimatePresence>
      </div>
      <span className="mt-1 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

export function ClosedNotice({
  operatingHours,
  acceptingOff,
  closedMessage,
  onReopen,
  timezone = DEFAULT_TZ,
}: {
  operatingHours: OperatingHours | null | undefined;
  acceptingOff: boolean;
  closedMessage?: string | null;
  onReopen?: () => void;
  timezone?: string;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const outsideHours = !!operatingHours && !isOpenNow(operatingHours, now, timezone);
  const nextOpen = useMemo(
    () => (outsideHours ? nextOpenAt(operatingHours, now, timezone) : null),
    // recalcula a cada minuto para não recriar o objeto a cada segundo
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [operatingHours, outsideHours, timezone, Math.floor(now.getTime() / 60_000)],
  );

  // Reabriu enquanto a página estava aberta → avisa o pai para recarregar o estado
  useEffect(() => {
    if (!acceptingOff && !outsideHours && operatingHours) onReopen?.();
  }, [outsideHours, acceptingOff, operatingHours, onReopen]);

  if (!acceptingOff && !outsideHours) return null;

  const parts = nextOpen ? diffParts(nextOpen, now) : null;
  const showDays = !!parts && parts.days > 0;
  const openLabel = nextOpen
    ? nextOpen.toLocaleString("pt-BR", {
        timeZone: timezone,
        weekday: "long",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 mt-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-[24px] border border-white/[0.07] bg-[#141414]/80 backdrop-blur-xl p-4 sm:p-5 shadow-[0_22px_60px_-44px_rgba(0,0,0,1)]"
      >
        <span
          className="absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-amber-400/70 to-amber-400/10"
          aria-hidden
        />
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-2xl shrink-0 flex items-center justify-center bg-amber-400/10 border border-amber-400/20">
            <Clock className="w-[18px] h-[18px] text-amber-300" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-[15px] font-bold tracking-tight">Estabelecimento fechado</h3>
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] px-2 py-1 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/20">
                Fora do horário
              </span>
            </div>
            <p className="text-[13px] leading-relaxed text-muted-foreground mt-1.5">
              {acceptingOff
                ? closedMessage ||
                  "O estabelecimento encerrou o atendimento e não está aceitando novos pedidos no momento."
                : parts
                  ? "Você pode navegar pelo cardápio, mas novos pedidos só serão aceitos na reabertura."
                  : "Você pode navegar pelo cardápio. Novos pedidos serão aceitos no próximo horário de abertura."}
            </p>

            {!acceptingOff && parts && (
              <div className="mt-3.5">
                <span
                  className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground"
                  aria-live="polite"
                >
                  Reabre em
                </span>
                <div className="mt-2 flex items-end gap-1.5">
                  {showDays && <Unit value={parts.days} label="dias" />}
                  {showDays && <span className="pb-5 text-muted-foreground/50">:</span>}
                  <Unit value={parts.hours} label="horas" />
                  <span className="pb-5 text-muted-foreground/50">:</span>
                  <Unit value={parts.minutes} label="min" />
                  <span className="pb-5 text-muted-foreground/50">:</span>
                  <Unit value={parts.seconds} label="seg" />
                </div>
                {openLabel && (
                  <span className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-muted-foreground px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06]">
                    <Clock className="w-3 h-3" />
                    Abre {openLabel}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

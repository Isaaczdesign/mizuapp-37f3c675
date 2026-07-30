export type OperatingHours = Record<string, { open: string; close: string; closed: boolean }>;

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** Fuso padrão do restaurante (pode ser sobrescrito por parâmetro). */
export const DEFAULT_TZ = "America/Sao_Paulo";

const toMin = (s: string) => {
  const [h, m] = (s || "0:0").split(":").map((n) => parseInt(n, 10) || 0);
  return h * 60 + m;
};

type ZonedNow = { wd: string; idx: number; minutes: number; year: number; month: number; day: number };

/** Data/hora local ("wall clock") no fuso do restaurante. */
function zonedNow(now: Date, tz: string): ZonedNow {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  const wd = get("weekday").toLowerCase().slice(0, 3);
  const hour = parseInt(get("hour"), 10) % 24; // "24" em alguns runtimes
  return {
    wd,
    idx: DAY_KEYS.indexOf(wd),
    minutes: hour * 60 + (parseInt(get("minute"), 10) || 0),
    year: parseInt(get("year"), 10),
    month: parseInt(get("month"), 10),
    day: parseInt(get("day"), 10),
  };
}

/** Offset (em minutos) do fuso em um instante específico — respeita horário de verão. */
function tzOffsetMinutes(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value || "0", 10);
  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return (asUTC - Math.floor(date.getTime() / 1000) * 1000) / 60_000;
}

/**
 * Converte um horário local do fuso do restaurante (y/m/d hh:mm) para o instante real (UTC).
 * DST-safe: resolve o offset iterativamente.
 */
function zonedWallClockToUtc(
  year: number,
  month: number,
  day: number,
  minutesOfDay: number,
  tz: string,
): Date {
  const hour = Math.floor(minutesOfDay / 60);
  const minute = minutesOfDay % 60;
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0);
  let ts = naive - tzOffsetMinutes(new Date(naive), tz) * 60_000;
  // segunda passada corrige transições de horário de verão
  ts = naive - tzOffsetMinutes(new Date(ts), tz) * 60_000;
  return new Date(ts);
}

/** Returns true if restaurant is currently open per operating_hours (no fuso do restaurante). */
export function isOpenNow(
  hours: OperatingHours | null | undefined,
  now: Date = new Date(),
  tz: string = DEFAULT_TZ,
): boolean {
  if (!hours || typeof hours !== "object") return true; // no config = always open
  const { wd, idx, minutes: cur } = zonedNow(now, tz);

  const check = (key: string) => {
    const d = hours[key];
    if (!d || d.closed) return false;
    const o = toMin(d.open);
    const c = toMin(d.close);
    if (c > o) return cur >= o && cur < c;
    // overnight (e.g. 18:00-02:00) — open until close on the next day
    return cur >= o || cur < c;
  };

  if (check(wd)) return true;
  // check if previous day's overnight window still applies
  if (idx >= 0) {
    const prev = DAY_KEYS[(idx + 6) % 7];
    const d = hours[prev];
    if (d && !d.closed) {
      const o = toMin(d.open);
      const c = toMin(d.close);
      if (c <= o && cur < c) return true;
    }
  }
  return false;
}

/**
 * Returns the next opening Date (instante real) or null if never/always open.
 * O horário semanal é interpretado no fuso do restaurante e convertido para UTC
 * respeitando horário de verão.
 */
export function nextOpenAt(
  hours: OperatingHours | null | undefined,
  now: Date = new Date(),
  tz: string = DEFAULT_TZ,
): Date | null {
  if (!hours || typeof hours !== "object") return null;
  if (isOpenNow(hours, now, tz)) return null;

  const { idx, minutes: cur, year, month, day } = zonedNow(now, tz);
  if (idx < 0) return null;

  for (let offset = 0; offset < 8; offset++) {
    const key = DAY_KEYS[(idx + offset) % 7];
    const d = hours[key];
    if (!d || d.closed) continue;
    const o = toMin(d.open);
    if (offset === 0 && cur >= o) continue; // today's opening already passed
    // dia-calendário local do restaurante + offset de dias
    const target = zonedWallClockToUtc(year, month, day + offset, o, tz);
    if (target.getTime() <= now.getTime()) continue;
    return target;
  }
  return null;
}

/** Formats a countdown like "2h 15min" or "45min" or "30s". */
export function formatCountdown(target: Date, now: Date = new Date()): string {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return "0min";
  const totalMin = Math.floor(ms / 60_000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}min`;
  if (totalMin > 0) return `${totalMin}min`;
  const secs = Math.max(0, Math.floor(ms / 1000));
  return `${secs}s`;
}

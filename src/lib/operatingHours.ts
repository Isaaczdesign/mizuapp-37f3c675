export type OperatingHours = Record<string, { open: string; close: string; closed: boolean }>;

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const toMin = (s: string) => {
  const [h, m] = (s || "0:0").split(":").map((n) => parseInt(n, 10) || 0);
  return h * 60 + m;
};

/** Returns true if restaurant is currently open per operating_hours (America/Sao_Paulo). */
export function isOpenNow(hours: OperatingHours | null | undefined, now: Date = new Date()): boolean {
  if (!hours || typeof hours !== "object") return true; // no config = always open
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const wd = parts.find((p) => p.type === "weekday")?.value.toLowerCase().slice(0, 3) || "";
  const hh = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
  const mm = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
  const cur = hh * 60 + mm;

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
  const idx = DAY_KEYS.indexOf(wd);
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
 * Returns the next opening Date (in real time) or null if never/always open.
 * Uses America/Sao_Paulo semantics for the weekly schedule.
 */
export function nextOpenAt(hours: OperatingHours | null | undefined, now: Date = new Date()): Date | null {
  if (!hours || typeof hours !== "object") return null;
  if (isOpenNow(hours, now)) return null;

  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const wd = parts.find((p) => p.type === "weekday")?.value.toLowerCase().slice(0, 3) || "";
  const hh = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
  const mm = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
  const cur = hh * 60 + mm;
  const idx = DAY_KEYS.indexOf(wd);
  if (idx < 0) return null;

  for (let offset = 0; offset < 8; offset++) {
    const key = DAY_KEYS[(idx + offset) % 7];
    const d = hours[key];
    if (!d || d.closed) continue;
    const o = toMin(d.open);
    if (offset === 0 && cur >= o) continue; // today's opening already passed
    const diffMin = offset * 24 * 60 + o - cur;
    if (diffMin <= 0) continue;
    return new Date(now.getTime() + diffMin * 60_000);
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

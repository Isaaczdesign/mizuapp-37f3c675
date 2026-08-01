// Estado do tour guiado pós-onboarding (por usuário)

const DONE_PREFIX = "mizu_tour_done_";
const PENDING_PREFIX = "mizu_tour_pending_";

export function markTourPending(userId?: string | null) {
  if (!userId) return;
  try {
    localStorage.setItem(`${PENDING_PREFIX}${userId}`, "1");
    localStorage.removeItem(`${DONE_PREFIX}${userId}`);
  } catch { /* noop */ }
}

export function isTourPending(userId?: string | null) {
  if (!userId) return false;
  try {
    return localStorage.getItem(`${PENDING_PREFIX}${userId}`) === "1"
      && localStorage.getItem(`${DONE_PREFIX}${userId}`) !== "1";
  } catch { return false; }
}

const STEP_PREFIX = "mizu_tour_step_";

export function getTourStep(userId?: string | null) {
  if (!userId) return 0;
  try {
    const raw = localStorage.getItem(`${STEP_PREFIX}${userId}`);
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch { return 0; }
}

export function setTourStep(userId: string | null | undefined, step: number) {
  if (!userId) return;
  try { localStorage.setItem(`${STEP_PREFIX}${userId}`, String(step)); } catch { /* noop */ }
}

export function finishTour(userId?: string | null) {
  if (!userId) return;
  try {
    localStorage.removeItem(`${PENDING_PREFIX}${userId}`);
    localStorage.removeItem(`${STEP_PREFIX}${userId}`);
    localStorage.setItem(`${DONE_PREFIX}${userId}`, "1");
  } catch { /* noop */ }
}

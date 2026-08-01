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

export function finishTour(userId?: string | null) {
  if (!userId) return;
  try {
    localStorage.removeItem(`${PENDING_PREFIX}${userId}`);
    localStorage.setItem(`${DONE_PREFIX}${userId}`, "1");
  } catch { /* noop */ }
}

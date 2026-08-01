// Salvamento automático do progresso do onboarding (por usuário, com expiração)

const PREFIX = "mizu_onboarding_draft_";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

export type OnboardingDraft = {
  step: number;
  name: string;
  primaryColor: string;
  hours: unknown;
  pickupEnabled: boolean;
  dineInEnabled: boolean;
  deliveryEnabled: boolean;
  deliveryFee: string;
  menuChoice: "import" | "manual" | null;
  menuImported: boolean;
  paymentMethods: string[];
  testComplete: boolean;
  savedAt: number;
};

const key = (userId: string) => `${PREFIX}${userId}`;

export function loadOnboardingDraft(userId?: string | null): Partial<OnboardingDraft> | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OnboardingDraft>;
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(key(userId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveOnboardingDraft(userId: string | null | undefined, draft: Omit<OnboardingDraft, "savedAt">) {
  if (!userId) return;
  try {
    localStorage.setItem(key(userId), JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch {
    /* storage indisponível — segue sem rascunho */
  }
}

export function clearOnboardingDraft(userId?: string | null) {
  if (!userId) return;
  try {
    localStorage.removeItem(key(userId));
  } catch {
    /* noop */
  }
}

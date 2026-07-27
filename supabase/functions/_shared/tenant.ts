// Shared tenant resolution + audit helpers for edge functions.
// Rule: NEVER trust a restaurant_id sent by the client — always resolve it from the
// authenticated user's profile (the tenant bound to the JWT).
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export interface Tenant {
  userId: string;
  restaurantId: string;
}

/**
 * Validates the caller's JWT and returns the tenant bound to it.
 * Returns null when there is no valid user session or no restaurant linked.
 */
export async function resolveTenant(req: Request, admin: SupabaseClient): Promise<Tenant | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );

  const { data, error } = await userClient.auth.getUser(token);
  const userId = data?.user?.id;
  if (error || !userId) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("restaurant_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!profile?.restaurant_id) return null;
  return { userId, restaurantId: profile.restaurant_id as string };
}

export interface AuditEntry {
  restaurantId: string | null;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

/** Best-effort audit write — never blocks or fails the caller. */
export async function audit(admin: SupabaseClient, entry: AuditEntry): Promise<void> {
  try {
    await admin.from("audit_logs").insert({
      restaurant_id: entry.restaurantId,
      user_id: entry.userId ?? null,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      metadata: entry.metadata ?? {},
    });
  } catch (_) {
    // auditing must never break the request
  }
}

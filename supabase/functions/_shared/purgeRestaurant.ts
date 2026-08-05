// Shared hard-delete logic for a restaurant workspace (data + members).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

/** Deletes every row belonging to a restaurant. Returns the member user ids. */
export async function purgeRestaurantData(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<string[]> {
  const { data: orders } = await admin.from("orders").select("id").eq("restaurant_id", restaurantId);
  const orderIds = (orders ?? []).map((o: { id: string }) => o.id);
  if (orderIds.length) {
    const { data: oitems } = await admin.from("order_items").select("id").in("order_id", orderIds);

    const itemRowIds = (oitems ?? []).map((i: { id: string }) => i.id);
    if (itemRowIds.length) await admin.from("order_item_reviews").delete().in("order_item_id", itemRowIds);
    await admin.from("order_reviews").delete().in("order_id", orderIds);
    await admin.from("order_items").delete().in("order_id", orderIds);
    await admin.from("coupon_usages").delete().in("order_id", orderIds);
  }

  const { data: items } = await admin.from("menu_items").select("id").eq("restaurant_id", restaurantId);
  const itemIds = (items ?? []).map((i: { id: string }) => i.id);
  if (itemIds.length) {
    await admin.from("menu_item_addons").delete().in("menu_item_id", itemIds);
    await admin.from("menu_item_variations").delete().in("menu_item_id", itemIds);
  }

  const { data: customers } = await admin.from("customers").select("id").eq("restaurant_id", restaurantId);
  const customerIds = (customers ?? []).map((c: { id: string }) => c.id);
  if (customerIds.length) await admin.from("coupon_usages").delete().in("customer_id", customerIds);

  for (
    const table of [
      "order_item_reviews", "order_reviews", "message_logs", "appointments", "orders",
      "menu_items", "menu_categories", "menu_import_jobs", "coupons", "customers",
      "automation_rules", "restaurant_tables", "shift_cash_counts", "shift_cash_movements",
      "shift_audit_logs", "work_shifts", "settings", "subscriptions", "audit_logs",
      "platform_notes", "platform_announcement_views",
    ]
  ) {
    const { error } = await admin.from(table).delete().eq("restaurant_id", restaurantId);
    if (error) console.error(`delete ${table} failed:`, error.message);
  }

  const { data: members } = await admin.from("profiles").select("user_id").eq("restaurant_id", restaurantId);
  const memberIds = (members ?? []).map((m: { user_id: string }) => m.user_id);

  await admin.from("user_roles").delete().eq("restaurant_id", restaurantId);
  await admin.from("profiles").delete().eq("restaurant_id", restaurantId);
  await admin.from("restaurants").delete().eq("id", restaurantId);

  return memberIds;
}

/** Removes a single user's own records and auth account. */
export async function purgeUser(admin: SupabaseClient, userId: string): Promise<void> {
  await admin.from("notification_preferences").delete().eq("user_id", userId);
  await admin.from("user_roles").delete().eq("user_id", userId);
  await admin.from("profiles").delete().eq("user_id", userId);
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) console.error(`deleteUser ${userId} failed:`, error.message);
}

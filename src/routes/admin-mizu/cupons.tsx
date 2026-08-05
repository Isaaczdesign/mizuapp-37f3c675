import { createFileRoute } from "@tanstack/react-router";
import { AdminCoupons } from "@/pages/admin-mizu/Placeholders";

export const Route = createFileRoute("/admin-mizu/cupons")({
  component: AdminCoupons,
});

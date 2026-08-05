import { createFileRoute } from "@tanstack/react-router";
import AdminPlans from "@/pages/admin-mizu/Plans";

export const Route = createFileRoute("/admin-mizu/planos")({
  component: AdminPlans,
});

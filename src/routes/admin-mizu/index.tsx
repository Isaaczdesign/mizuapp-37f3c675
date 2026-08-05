import { createFileRoute } from "@tanstack/react-router";
import AdminOverview from "@/pages/admin-mizu/Overview";

export const Route = createFileRoute("/admin-mizu/")({
  component: AdminOverview,
});

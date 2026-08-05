import { createFileRoute } from "@tanstack/react-router";
import AdminLogs from "@/pages/admin-mizu/Logs";

export const Route = createFileRoute("/admin-mizu/logs")({
  component: AdminLogs,
});

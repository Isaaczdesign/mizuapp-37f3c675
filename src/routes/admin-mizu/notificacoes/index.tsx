import { createFileRoute } from "@tanstack/react-router";
import { AdminNotifications } from "@/pages/admin-mizu/Placeholders";

export const Route = createFileRoute("/admin-mizu/notificacoes/")({
  component: AdminNotifications,
});

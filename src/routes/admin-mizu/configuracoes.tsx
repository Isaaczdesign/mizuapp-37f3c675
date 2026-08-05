import { createFileRoute } from "@tanstack/react-router";
import AdminPlatformSettings from "@/pages/admin-mizu/PlatformSettings";

export const Route = createFileRoute("/admin-mizu/configuracoes")({
  component: AdminPlatformSettings,
});

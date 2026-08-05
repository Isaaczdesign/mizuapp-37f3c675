import { createFileRoute } from "@tanstack/react-router";
import AdminSupport from "@/pages/admin-mizu/Support";

export const Route = createFileRoute("/admin-mizu/suporte")({
  component: AdminSupport,
});

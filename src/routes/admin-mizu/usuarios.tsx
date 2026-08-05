import { createFileRoute } from "@tanstack/react-router";
import AdminUsers from "@/pages/admin-mizu/Users";

export const Route = createFileRoute("/admin-mizu/usuarios")({
  component: AdminUsers,
});

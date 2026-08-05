import { createFileRoute } from "@tanstack/react-router";
import MenuAdmin from "@/pages/MenuAdmin";
import ProtectedRoute from "@/components/ProtectedRoute";

export const Route = createFileRoute("/menu-admin")({
  component: () => (
    <ProtectedRoute allowedRoles={["owner", "manager"]}>
      <MenuAdmin />
    </ProtectedRoute>
  ),
});

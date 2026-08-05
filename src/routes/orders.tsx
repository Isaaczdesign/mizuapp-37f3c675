import { createFileRoute } from "@tanstack/react-router";
import Orders from "@/pages/Orders";
import ProtectedRoute from "@/components/ProtectedRoute";

export const Route = createFileRoute("/orders")({
  component: () => (
    <ProtectedRoute allowedRoles={["owner", "manager", "staff"]}>
      <Orders />
    </ProtectedRoute>
  ),
});

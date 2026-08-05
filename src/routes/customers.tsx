import { createFileRoute } from "@tanstack/react-router";
import Customers from "@/pages/Customers";
import ProtectedRoute from "@/components/ProtectedRoute";

export const Route = createFileRoute("/customers")({
  component: () => (
    <ProtectedRoute allowedRoles={["owner", "manager", "staff"]}>
      <Customers />
    </ProtectedRoute>
  ),
});

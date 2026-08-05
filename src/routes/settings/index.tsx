import { createFileRoute } from "@tanstack/react-router";
import Settings from "@/pages/Settings";
import ProtectedRoute from "@/components/ProtectedRoute";

export const Route = createFileRoute("/settings/")({
  component: () => (
    <ProtectedRoute allowedRoles={["owner", "manager"]}>
      <Settings />
    </ProtectedRoute>
  ),
});

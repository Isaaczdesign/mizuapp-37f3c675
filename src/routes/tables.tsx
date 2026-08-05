import { createFileRoute } from "@tanstack/react-router";
import Tables from "@/pages/Tables";
import ProtectedRoute from "@/components/ProtectedRoute";

export const Route = createFileRoute("/tables")({
  component: () => (
    <ProtectedRoute allowedRoles={["owner", "manager"]}>
      <Tables />
    </ProtectedRoute>
  ),
});

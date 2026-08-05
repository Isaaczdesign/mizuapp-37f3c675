import { createFileRoute } from "@tanstack/react-router";
import Expediente from "@/pages/Expediente";
import ProtectedRoute from "@/components/ProtectedRoute";

export const Route = createFileRoute("/expediente/")({
  component: () => (
    <ProtectedRoute allowedRoles={["owner", "manager"]}>
      <Expediente />
    </ProtectedRoute>
  ),
});

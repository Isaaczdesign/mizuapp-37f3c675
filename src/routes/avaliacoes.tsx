import { createFileRoute } from "@tanstack/react-router";
import Reviews from "@/pages/Reviews";
import ProtectedRoute from "@/components/ProtectedRoute";

export const Route = createFileRoute("/avaliacoes")({
  component: () => (
    <ProtectedRoute allowedRoles={["owner", "manager"]}>
      <Reviews />
    </ProtectedRoute>
  ),
});

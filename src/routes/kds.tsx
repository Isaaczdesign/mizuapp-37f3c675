import { createFileRoute } from "@tanstack/react-router";
import KDS from "@/pages/KDS";
import ProtectedRoute from "@/components/ProtectedRoute";

export const Route = createFileRoute("/kds")({
  component: () => (
    <ProtectedRoute>
      <KDS />
    </ProtectedRoute>
  ),
});

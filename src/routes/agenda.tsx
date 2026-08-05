import { createFileRoute } from "@tanstack/react-router";
import Agenda from "@/pages/Agenda";
import ProtectedRoute from "@/components/ProtectedRoute";

export const Route = createFileRoute("/agenda")({
  component: () => (
    <ProtectedRoute allowedRoles={["owner", "manager", "staff"]}>
      <Agenda />
    </ProtectedRoute>
  ),
});

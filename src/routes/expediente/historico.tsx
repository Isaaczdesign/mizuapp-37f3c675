import { createFileRoute } from "@tanstack/react-router";
import ExpedienteHistorico from "@/pages/ExpedienteHistorico";
import ProtectedRoute from "@/components/ProtectedRoute";

export const Route = createFileRoute("/expediente/historico")({
  component: () => (
    <ProtectedRoute allowedRoles={["owner", "manager"]}>
      <ExpedienteHistorico />
    </ProtectedRoute>
  ),
});

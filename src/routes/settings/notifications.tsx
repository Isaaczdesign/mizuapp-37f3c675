import { createFileRoute } from "@tanstack/react-router";
import NotificationSettings from "@/pages/NotificationSettings";
import ProtectedRoute from "@/components/ProtectedRoute";

export const Route = createFileRoute("/settings/notifications")({
  component: () => (
    <ProtectedRoute>
      <NotificationSettings />
    </ProtectedRoute>
  ),
});

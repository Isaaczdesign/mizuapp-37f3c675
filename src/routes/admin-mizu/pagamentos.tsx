import { createFileRoute } from "@tanstack/react-router";
import AdminSubscriptions from "@/pages/admin-mizu/Subscriptions";

export const Route = createFileRoute("/admin-mizu/pagamentos")({
  component: () => <AdminSubscriptions mode="payments" />,
});

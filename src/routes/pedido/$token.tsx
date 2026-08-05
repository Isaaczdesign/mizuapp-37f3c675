import { createFileRoute } from "@tanstack/react-router";
import OrderTracking from "@/pages/OrderTracking";

export const Route = createFileRoute("/pedido/$token")({
  component: OrderTracking,
});

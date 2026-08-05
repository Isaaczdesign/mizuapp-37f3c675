import { createFileRoute } from "@tanstack/react-router";
import AdminRestaurantDetail from "@/pages/admin-mizu/RestaurantDetail";

export const Route = createFileRoute("/admin-mizu/restaurantes/$id")({
  component: AdminRestaurantDetail,
});

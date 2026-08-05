import { createFileRoute } from "@tanstack/react-router";
import AdminRestaurants from "@/pages/admin-mizu/Restaurants";

export const Route = createFileRoute("/admin-mizu/restaurantes/")({
  component: AdminRestaurants,
});

import { createFileRoute } from "@tanstack/react-router";
import PublicMenu from "@/pages/PublicMenu";

export const Route = createFileRoute("/r/$slug")({
  component: PublicMenu,
});

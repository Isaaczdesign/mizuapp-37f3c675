import { createFileRoute } from "@tanstack/react-router";
import PublicMenu from "@/pages/PublicMenu";

export const Route = createFileRoute("/m/$slug")({
  component: PublicMenu,
});

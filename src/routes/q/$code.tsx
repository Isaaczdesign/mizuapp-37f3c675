import { createFileRoute } from "@tanstack/react-router";
import ShortLink from "@/pages/ShortLink";

export const Route = createFileRoute("/q/$code")({
  component: ShortLink,
});

import { createFileRoute } from "@tanstack/react-router";
import Demonstracao from "@/pages/Demonstracao";

export const Route = createFileRoute("/demonstracao")({
  component: Demonstracao,
});

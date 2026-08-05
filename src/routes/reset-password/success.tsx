import { createFileRoute } from "@tanstack/react-router";
import PasswordResetSuccess from "@/pages/PasswordResetSuccess";

export const Route = createFileRoute("/reset-password/success")({
  component: PasswordResetSuccess,
});

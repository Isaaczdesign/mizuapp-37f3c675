import { createFileRoute } from "@tanstack/react-router";
import AdminDeletedNotes from "@/pages/admin-mizu/DeletedNotes";

export const Route = createFileRoute("/admin-mizu/observacoes-excluidas")({
  component: AdminDeletedNotes,
});

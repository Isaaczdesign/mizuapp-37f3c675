import { useState } from "react";
import AnnouncementModal from "@/components/announcements/AnnouncementModal";

export default function TestAnnouncement() {
  const [open, setOpen] = useState(true);

  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="mb-4 text-lg font-semibold text-foreground">Preview do modal de novidades</h1>
      <button
        className="rounded-lg bg-primary px-4 py-2 text-primary-foreground"
        onClick={() => setOpen(true)}
      >
        Reabrir modal
      </button>

      <AnnouncementModal
        open={open}
        onOpenChange={setOpen}
        items={[
          {
            id: "test-1",
            title: "Nova funcionalidade de avaliações",
            body: "Agora seus clientes podem avaliar cada item do pedido com até 5 estrelas. Use o feedback para ajustar o cardápio e melhorar a experiência.",
            variant: "info",
            media_type: "none",
            starts_at: new Date().toISOString(),
          },
          {
            id: "test-2",
            title: "Melhorias no dashboard",
            body: "Organizamos os pedidos por status e adicionamos filtros de busca para você encontrar tudo mais rápido.",
            variant: "feature",
            media_type: "none",
            cta_label: "Ver dashboard",
            cta_url: "https://mizu.lovable.app/dashboard",
            starts_at: new Date().toISOString(),
          },
        ]}
      />
    </div>
  );
}

import AdminMizuLayout from "@/components/admin-mizu/AdminMizuLayout";
import { Ticket } from "lucide-react";
import { EmptyState, Notice } from "@/components/admin-mizu/ui";

export function AdminCoupons() {
  return (
    <AdminMizuLayout title="Cupons da plataforma" description="Descontos comerciais aplicados às assinaturas dos restaurantes.">
      <EmptyState
        icon={Ticket}
        title="Nenhum cupom de plataforma criado"
        description="Cupons comerciais dependem da integração de cobrança — a estrutura de planos e assinaturas já está pronta para recebê-los."
      />
      <div className="mt-4">
        <Notice>
          Os cupons usados pelos clientes finais no cardápio continuam sendo gerenciados por cada restaurante.
        </Notice>
      </div>
    </AdminMizuLayout>
  );
}

export { AdminNotifications } from "./Announcements";

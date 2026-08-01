import AdminMizuLayout from "@/components/admin-mizu/AdminMizuLayout";
import { Bell, Ticket } from "lucide-react";

export function AdminCoupons() {
  return (
    <AdminMizuLayout title="Cupons da plataforma" description="Descontos comerciais aplicados às assinaturas dos restaurantes.">
      <div className="rounded-xl border border-dashed border-border p-10 text-center">
        <Ticket className="mx-auto h-6 w-6 text-primary" />
        <p className="mt-3 text-sm text-muted-foreground">
          Nenhum cupom de plataforma criado. Cupons comerciais dependem da integração de cobrança —
          a estrutura de planos e assinaturas já está pronta para recebê-los.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Os cupons usados pelos clientes finais no cardápio continuam sendo gerenciados por cada restaurante.
        </p>
      </div>
    </AdminMizuLayout>
  );
}

export { AdminNotifications } from "./Announcements";


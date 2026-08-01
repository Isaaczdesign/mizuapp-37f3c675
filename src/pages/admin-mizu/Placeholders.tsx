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

export function AdminNotifications() {
  return (
    <AdminMizuLayout title="Notificações administrativas" description="Alertas gerados a partir de dados reais da plataforma.">
      <div className="rounded-xl border border-dashed border-border p-10 text-center">
        <Bell className="mx-auto h-6 w-6 text-primary" />
        <p className="mt-3 text-sm text-muted-foreground">
          Nenhuma notificação no momento. Assim que houver eventos elegíveis (novo restaurante, teste próximo do fim,
          assinatura cancelada), eles aparecerão aqui — sem alertas fictícios.
        </p>
      </div>
    </AdminMizuLayout>
  );
}

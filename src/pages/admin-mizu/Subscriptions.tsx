import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminMizuLayout from "@/components/admin-mizu/AdminMizuLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, Row, Cell, StatusPill, EmptyState, Notice } from "@/components/admin-mizu/ui";
import { CreditCard } from "lucide-react";

type Sub = {
  id: string; restaurant_id: string; plan: string; status: string;
  started_at: string; expires_at: string | null;
};

const toneFor = (status: string) => {
  const s = status.toLowerCase();
  if (["active", "ativa", "ativo", "paid"].includes(s)) return "success" as const;
  if (["trial", "trialing", "pending", "pendente"].includes(s)) return "warning" as const;
  if (["canceled", "cancelled", "cancelada", "past_due", "inadimplente"].includes(s)) return "danger" as const;
  return "neutral" as const;
};

export default function AdminSubscriptions({ mode = "subscriptions" }: { mode?: "subscriptions" | "payments" }) {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [s, r] = await Promise.all([
        supabase.from("subscriptions").select("*").order("started_at", { ascending: false }).limit(200),
        supabase.from("restaurants").select("id, name"),
      ]);
      setSubs((s.data ?? []) as Sub[]);
      setNames(Object.fromEntries((r.data ?? []).map((x) => [x.id, x.name])));
      setLoading(false);
    })();
  }, []);

  const isPayments = mode === "payments";
  const date = (v: string | null) => (v ? new Date(v).toLocaleDateString("pt-BR") : "—");

  return (
    <AdminMizuLayout
      title={isPayments ? "Pagamentos" : "Assinaturas"}
      description={
        isPayments
          ? "A integração de cobrança da plataforma ainda não está conectada — nenhum pagamento é simulado aqui."
          : "Plano, status e vencimento de cada restaurante."
      }
      actions={
        !loading && (
          <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
            {subs.length} registro(s)
          </span>
        )
      }
    >
      {isPayments && (
        <div className="mb-5">
          <Notice tone="info">
            Estrutura pronta para receber os eventos de cobrança (aprovado, pendente, recusado, cancelado, inadimplência).
            Nenhum dado sensível de cartão é ou será armazenado.
          </Notice>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-2xl" />)}</div>
      ) : subs.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="Nenhuma assinatura registrada"
          description="Assim que os restaurantes contratarem um plano, os registros aparecerão aqui."
        />
      ) : (
        <>
          <DataTable head={["Restaurante", "Plano", "Início", "Vencimento", "Status"]}>
            {subs.map((s) => (
              <Row key={s.id}>
                <Cell><p className="font-medium">{names[s.restaurant_id] ?? "Restaurante removido"}</p></Cell>
                <Cell muted className="capitalize">{s.plan}</Cell>
                <Cell muted className="tabular-nums">{date(s.started_at)}</Cell>
                <Cell muted className="tabular-nums">{date(s.expires_at)}</Cell>
                <Cell className="text-right">
                  <StatusPill tone={toneFor(s.status)}>{s.status}</StatusPill>
                </Cell>
              </Row>
            ))}
          </DataTable>

          <div className="space-y-2 md:hidden">
            {subs.map((s) => (
              <div key={s.id} className="rounded-2xl border border-border bg-card/40 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate font-medium">{names[s.restaurant_id] ?? "Restaurante removido"}</p>
                  <StatusPill tone={toneFor(s.status)}>{s.status}</StatusPill>
                </div>
                <p className="mt-1.5 text-xs capitalize text-muted-foreground">
                  Plano {s.plan} · início {date(s.started_at)}
                  {s.expires_at ? ` · vence ${date(s.expires_at)}` : ""}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </AdminMizuLayout>
  );
}

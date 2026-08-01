import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminMizuLayout from "@/components/admin-mizu/AdminMizuLayout";
import { Skeleton } from "@/components/ui/skeleton";

type Sub = {
  id: string; restaurant_id: string; plan: string; status: string;
  started_at: string; expires_at: string | null;
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

  return (
    <AdminMizuLayout
      title={isPayments ? "Pagamentos" : "Assinaturas"}
      description={
        isPayments
          ? "A integração de cobrança da plataforma ainda não está conectada — nenhum pagamento é simulado aqui."
          : "Plano, status e vencimento de cada restaurante."
      }
    >
      {isPayments && (
        <p className="mb-4 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          Estrutura pronta para receber os eventos de cobrança (aprovado, pendente, recusado, cancelado, inadimplência).
          Nenhum dado sensível de cartão é ou será armazenado.
        </p>
      )}

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : subs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nenhuma assinatura registrada.
        </p>
      ) : (
        <div className="space-y-2">
          {subs.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3 text-sm">
              <div>
                <p className="font-medium">{names[s.restaurant_id] ?? "Restaurante removido"}</p>
                <p className="text-xs text-muted-foreground">
                  Plano {s.plan} · início {new Date(s.started_at).toLocaleDateString("pt-BR")}
                  {s.expires_at ? ` · vence ${new Date(s.expires_at).toLocaleDateString("pt-BR")}` : ""}
                </p>
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{s.status}</span>
            </div>
          ))}
        </div>
      )}
    </AdminMizuLayout>
  );
}

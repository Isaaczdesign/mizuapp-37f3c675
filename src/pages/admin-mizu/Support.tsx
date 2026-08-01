import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminMizuLayout from "@/components/admin-mizu/AdminMizuLayout";
import { Skeleton } from "@/components/ui/skeleton";

type Note = { id: string; body: string; status: string; created_at: string; restaurant_id: string | null };

export default function AdminSupport() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [n, r] = await Promise.all([
        supabase.from("platform_notes").select("id, body, status, created_at, restaurant_id").order("created_at", { ascending: false }).limit(100),
        supabase.from("restaurants").select("id, name"),
      ]);
      setNotes((n.data ?? []) as Note[]);
      setNames(Object.fromEntries((r.data ?? []).map((x) => [x.id, x.name])));
      setLoading(false);
    })();
  }, []);

  return (
    <AdminMizuLayout title="Suporte" description="Observações internas e pendências por conta — invisíveis para os restaurantes.">
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : notes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nenhum registro de suporte. As observações criadas na página de um restaurante aparecem aqui.
        </p>
      ) : (
        <div className="space-y-2">
          {notes.map((n) => (
            <div key={n.id} className="rounded-xl border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{n.restaurant_id ? names[n.restaurant_id] ?? "Restaurante removido" : "Geral"}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{n.status}</span>
              </div>
              <p className="mt-1 text-muted-foreground">{n.body}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleString("pt-BR")}</p>
            </div>
          ))}
        </div>
      )}
    </AdminMizuLayout>
  );
}

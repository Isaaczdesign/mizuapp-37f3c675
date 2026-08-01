import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminMizuLayout from "@/components/admin-mizu/AdminMizuLayout";
import NoteActions from "@/components/admin-mizu/NoteActions";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, StatusPill } from "@/components/admin-mizu/ui";
import { LifeBuoy } from "lucide-react";

type Note = { id: string; body: string; status: string; created_at: string; restaurant_id: string | null };

const toneFor = (s: string) =>
  s.toLowerCase().includes("resolv") ? ("success" as const) : s.toLowerCase().includes("aberto") ? ("warning" as const) : ("neutral" as const);

export default function AdminSupport() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [n, r] = await Promise.all([
      supabase
        .from("platform_notes")
        .select("id, body, status, created_at, restaurant_id")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("restaurants").select("id, name"),
    ]);
    setNotes((n.data ?? []) as Note[]);
    setNames(Object.fromEntries((r.data ?? []).map((x) => [x.id, x.name])));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <AdminMizuLayout
      title="Suporte"
      description="Observações internas e pendências por conta — invisíveis para os restaurantes."
      actions={
        !loading && (
          <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
            {notes.length} registro(s)
          </span>
        )
      }
    >
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      ) : notes.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title="Nenhum registro de suporte"
          description="As observações criadas na página de um restaurante aparecem aqui."
        />
      ) : (
        <div className="space-y-2.5">
          {notes.map((n) => (
            <article key={n.id} className="rounded-2xl border border-border bg-card/40 p-4 transition-colors hover:border-primary/30">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {n.restaurant_id ? names[n.restaurant_id] ?? "Restaurante removido" : "Geral"}
                  </span>
                  <StatusPill tone={toneFor(n.status)}>{n.status}</StatusPill>
                </div>
                <NoteActions noteId={n.id} body={n.body} onDone={load} />
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{n.body}</p>
              <p className="mt-2.5 text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleString("pt-BR")}</p>
            </article>
          ))}
        </div>
      )}
    </AdminMizuLayout>
  );
}

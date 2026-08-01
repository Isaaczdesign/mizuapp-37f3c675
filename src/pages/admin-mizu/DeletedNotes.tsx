import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import AdminMizuLayout from "@/components/admin-mizu/AdminMizuLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { usePlatformRole } from "@/hooks/usePlatformRole";

type DeletedNote = {
  id: string; body: string; created_at: string; restaurant_id: string | null;
  deleted_at: string; deleted_by: string | null; deletion_reason: string | null;
};

const PURGE_PHRASE = "EXCLUIR DEFINITIVAMENTE";

/** Área restrita ao super_admin: consulta, restauração e exclusão permanente de observações. */
export default function AdminDeletedNotes() {
  const { loading: roleLoading, isSuperAdmin } = usePlatformRole();
  const [notes, setNotes] = useState<DeletedNote[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [admins, setAdmins] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [purge, setPurge] = useState<DeletedNote | null>(null);
  const [phrase, setPhrase] = useState("");
  const [purgeReason, setPurgeReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [n, r, p] = await Promise.all([
      supabase
        .from("platform_notes")
        .select("id, body, created_at, restaurant_id, deleted_at, deleted_by, deletion_reason")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
        .limit(200),
      supabase.from("restaurants").select("id, name"),
      supabase.from("profiles").select("user_id, display_name"),
    ]);
    setNotes((n.data ?? []) as DeletedNote[]);
    setNames(Object.fromEntries((r.data ?? []).map((x) => [x.id, x.name])));
    setAdmins(Object.fromEntries((p.data ?? []).map((x) => [x.user_id, x.display_name ?? "—"])));
    setLoading(false);
  }, []);

  useEffect(() => { if (isSuperAdmin) void load(); else setLoading(false); }, [isSuperAdmin, load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return notes;
    return notes.filter((n) =>
      n.body.toLowerCase().includes(term) ||
      (n.deletion_reason ?? "").toLowerCase().includes(term) ||
      (n.restaurant_id ? (names[n.restaurant_id] ?? "").toLowerCase().includes(term) : false) ||
      (n.deleted_by ? (admins[n.deleted_by] ?? "").toLowerCase().includes(term) : false));
  }, [notes, q, names, admins]);

  const restore = async (note: DeletedNote) => {
    setBusy(true);
    const { error } = await supabase.rpc("admin_restore_platform_note", { _note_id: note.id, _reason: "Restaurada pelo super admin" });
    setBusy(false);
    if (error) return toast.error("Não foi possível restaurar a observação.");
    toast.success("Observação restaurada.");
    void load();
  };

  const runPurge = async () => {
    if (!purge || busy) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_purge_platform_note", {
      _note_id: purge.id, _reason: purgeReason.trim(), _confirmation: phrase.trim(),
    });
    setBusy(false);
    if (error) return toast.error("Não foi possível concluir a exclusão permanente.");
    setPurge(null); setPhrase(""); setPurgeReason("");
    toast.success("Observação excluída permanentemente.");
    void load();
  };

  if (!roleLoading && !isSuperAdmin) {
    return (
      <AdminMizuLayout title="Observações excluídas">
        <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Você não tem permissão para acessar esta área.
        </p>
      </AdminMizuLayout>
    );
  }

  return (
    <AdminMizuLayout
      title="Observações excluídas"
      description="Histórico de observações internas removidas — visível apenas para super administradores."
    >
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por conteúdo, restaurante, administrador ou motivo"
        className="mb-4 max-w-md"
      />

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nenhuma observação excluída.
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => (
            <div key={n.id} className="rounded-xl border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  {n.restaurant_id ? names[n.restaurant_id] ?? "Restaurante removido" : "Geral"}
                </span>
                <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] text-destructive">excluída</span>
              </div>
              <p className="mt-1 text-muted-foreground">{n.body}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Excluída por {n.deleted_by ? admins[n.deleted_by] ?? "administrador" : "—"} em{" "}
                {new Date(n.deleted_at).toLocaleString("pt-BR")} · Motivo: {n.deletion_reason ?? "—"}
              </p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="outline" disabled={busy} onClick={() => restore(n)}>Restaurar</Button>
                <Button size="sm" variant="destructive" onClick={() => setPurge(n)}>Excluir permanentemente</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!purge} onOpenChange={(o) => { if (!o) { setPurge(null); setPhrase(""); setPurgeReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir permanentemente?</DialogTitle>
            <DialogDescription>
              O conteúdo será apagado do banco de dados e não poderá ser recuperado. O registro da ação
              permanecerá no histórico de auditoria. Não faça isso em observações ligadas a investigações,
              pagamentos, disputas ou incidentes de segurança.
            </DialogDescription>
          </DialogHeader>
          <p className="rounded-lg border border-border p-2.5 text-xs text-muted-foreground">{purge?.body}</p>
          <Textarea rows={2} placeholder="Motivo" value={purgeReason} onChange={(e) => setPurgeReason(e.target.value)} maxLength={500} />
          <div>
            <label className="text-xs text-muted-foreground">Digite <strong>{PURGE_PHRASE}</strong> para confirmar</label>
            <Input value={phrase} onChange={(e) => setPhrase(e.target.value)} className="mt-1" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPurge(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={busy || phrase.trim().toUpperCase() !== PURGE_PHRASE || purgeReason.trim().length < 3}
              onClick={runPurge}
            >
              {busy ? "Excluindo…" : "Excluir permanentemente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminMizuLayout>
  );
}

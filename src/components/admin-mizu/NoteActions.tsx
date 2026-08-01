import { useState } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { usePlatformRole } from "@/hooks/usePlatformRole";

const REASONS = [
  "Informação incorreta",
  "Observação duplicada",
  "Informação adicionada ao cadastro errado",
  "Conteúdo inadequado",
  "Outro",
];

/**
 * Menu de ações de uma observação interna.
 * A permissão real é validada no backend (admin_delete_platform_note) — aqui só escondemos a UI.
 */
export default function NoteActions({
  noteId, body, onDone,
}: { noteId: string; body: string; onDone: () => void }) {
  const { isAdmin } = usePlatformRole();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [draft, setDraft] = useState(body);
  const [reason, setReason] = useState(REASONS[0]);
  const [otherReason, setOtherReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (!isAdmin) return null;

  const finalReason = reason === "Outro" ? otherReason.trim() : reason;

  const saveEdit = async () => {
    if (!draft.trim() || busy) return;
    setBusy(true);
    const { error } = await supabase.from("platform_notes").update({ body: draft.trim() }).eq("id", noteId);
    setBusy(false);
    if (error) return toast.error("Não foi possível salvar a observação.");
    setEditOpen(false);
    toast.success("Observação atualizada.");
    onDone();
  };

  const runDelete = async () => {
    if (busy || finalReason.length < 3) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_delete_platform_note", {
      _note_id: noteId,
      _reason: finalReason,
    });
    setBusy(false);
    if (error) return toast.error("Não foi possível excluir a observação.");
    setDeleteOpen(false);
    toast.success("Observação excluída.");
    onDone();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label="Ações da observação">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => { setDraft(body); setEditOpen(true); }}>
            <Pencil className="mr-2 h-3.5 w-3.5" /> Editar observação
          </DropdownMenuItem>
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="mr-2 h-3.5 w-3.5" /> Excluir observação
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar observação</DialogTitle></DialogHeader>
          <Textarea rows={4} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={2000} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button variant="hero" onClick={saveEdit} disabled={busy || !draft.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir esta observação?</DialogTitle>
            <DialogDescription>
              Esta ação removerá a observação da visualização administrativa. O registro da exclusão
              continuará disponível no histórico de auditoria.
            </DialogDescription>
          </DialogHeader>

          <p className="rounded-lg border border-border p-2.5 text-xs text-muted-foreground">{body}</p>

          <div className="space-y-2">
            <label className="text-xs font-medium">Motivo da exclusão</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            {reason === "Outro" && (
              <Textarea
                rows={2}
                placeholder="Descreva o motivo"
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                maxLength={500}
              />
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={runDelete} disabled={busy || finalReason.length < 3}>
              {busy ? "Excluindo…" : "Excluir observação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

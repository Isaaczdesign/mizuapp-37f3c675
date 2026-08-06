import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Ban, MoreVertical, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { usePlatformRole } from "@/hooks/usePlatformRole";

type Action = "ban" | "reactivate" | "delete";

const CONFIRM_WORD = "EXCLUIR";

const COPY: Record<Action, { title: string; body: string; cta: string }> = {
  ban: {
    title: "Banir restaurante",
    body: "Todos os usuários vinculados ficarão impedidos de entrar e o cardápio público será desativado.",
    cta: "Banir",
  },
  reactivate: {
    title: "Reativar restaurante",
    body: "O banimento (se houver) será removido, os usuários voltam a acessar o painel e o QR menu volta a aceitar pedidos.",
    cta: "Reativar restaurante",
  },
  delete: {
    title: "Excluir restaurante e contas",
    body: "Restaurante, cardápio, pedidos, clientes e as contas dos usuários vinculados serão apagados para sempre. Não há como desfazer.",
    cta: "Excluir definitivamente",
  },
};

export default function ModerationMenu({
  restaurant, onDone, align = "end",
}: {
  restaurant: { id: string; name: string; is_active: boolean };
  onDone?: (action: Action) => void;
  align?: "start" | "end";
}) {
  const { isAdmin } = usePlatformRole();
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [confirmWord, setConfirmWord] = useState("");
  const [busy, setBusy] = useState(false);

  if (!isAdmin) return null;

  const open = (a: Action) => { setReason(""); setConfirmWord(""); setAction(a); };

  const canRun =
    !!action &&
    (action === "reactivate" || reason.trim().length >= 3) &&
    (action !== "delete" || confirmWord.trim().toUpperCase() === CONFIRM_WORD);

  async function run() {
    if (!action || !canRun) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-account-action", {
        body: { action, restaurant_id: restaurant.id, reason: reason.trim() },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      toast.success(
        action === "delete" ? "Restaurante e contas excluídos."
          : action === "ban" ? "Restaurante banido." : "Restaurante reativado — painel e QR menu liberados.",
      );
      const done = action;
      setAction(null);
      onDone?.(done);
    } catch (e) {
      toast.error((e as Error).message || "Não foi possível concluir a ação.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="glass" aria-label={`Moderar ${restaurant.name}`}>
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="w-52">
          {restaurant.is_active && (
            <DropdownMenuItem onSelect={() => open("ban")}>
              <Ban className="mr-2 h-4 w-4" /> Banir restaurante
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => open("reactivate")}>
            <ShieldCheck className="mr-2 h-4 w-4" /> Reativar restaurante
          </DropdownMenuItem>
          <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => open("delete")}>
            <Trash2 className="mr-2 h-4 w-4" /> Excluir conta + restaurante
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={!!action} onOpenChange={(o) => !busy && !o && setAction(null)}>
        <DialogContent className="max-w-md">
          {action && (
            <>
              <DialogHeader>
                <DialogTitle className={action === "delete" ? "text-destructive" : undefined}>
                  {COPY[action].title}
                </DialogTitle>
                <DialogDescription>
                  <span className="font-medium text-foreground">{restaurant.name}</span> — {COPY[action].body}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Motivo {action === "reactivate" ? "(opcional)" : "(obrigatório)"}</Label>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Descreva o motivo desta ação (fica registrado em auditoria)"
                    rows={3}
                  />
                </div>
                {action === "delete" && (
                  <div className="space-y-1.5">
                    <Label>
                      Digite <span className="font-mono font-bold text-destructive">{CONFIRM_WORD}</span> para confirmar
                    </Label>
                    <Input value={confirmWord} onChange={(e) => setConfirmWord(e.target.value)} autoComplete="off" />
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setAction(null)} disabled={busy}>Cancelar</Button>
                <Button
                  variant={action === "reactivate" ? "default" : "destructive"}
                  onClick={run}
                  disabled={busy || !canRun}
                >
                  {busy ? "Processando..." : COPY[action].cta}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";

const CONFIRM_WORD = "EXCLUIR";

export default function DangerZone() {
  const { roles, signOut } = useAuth();
  const isOwner = roles.includes("owner");
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (confirm.trim().toUpperCase() !== CONFIRM_WORD) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-account");
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Conta excluída. Sentiremos sua falta!");
      await signOut();
      window.location.href = "/";
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível excluir a conta. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass-card p-6 border-destructive/40">
      <div className="flex items-center gap-3 mb-2">
        <AlertTriangle className="w-5 h-5 text-destructive" />
        <h2 className="font-display font-bold text-destructive">Zona de risco</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Excluir a conta remove permanentemente o restaurante, cardápio, pedidos, clientes e todos os acessos da equipe.
        Esta ação não pode ser desfeita.
      </p>

      <Button variant="destructive" className="w-full" onClick={() => { setConfirm(""); setOpen(true); }}>
        <Trash2 className="w-4 h-4 mr-2" /> Excluir minha conta
      </Button>

      <Dialog open={open} onOpenChange={(o) => !loading && setOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Excluir conta permanentemente</DialogTitle>
            <DialogDescription>
              Todos os dados do restaurante (cardápio, pedidos, clientes, expedientes e cupons) e as contas da equipe
              serão apagados para sempre.
            </DialogDescription>

          </DialogHeader>
          <div className="space-y-2">
            <Label>
              Digite <span className="font-mono font-bold text-destructive">{CONFIRM_WORD}</span> para confirmar
            </Label>
            <Input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={CONFIRM_WORD}
              autoComplete="off"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading || confirm.trim().toUpperCase() !== CONFIRM_WORD}
            >
              {loading ? "Excluindo..." : "Excluir definitivamente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { KeyRound, Eye, EyeOff, ShieldCheck } from "lucide-react";

const rules = [
  { label: "Mínimo 6 caracteres", test: (v: string) => v.length >= 6 },
  { label: "Uma letra maiúscula", test: (v: string) => /[A-Z]/.test(v) },
  { label: "Uma letra minúscula", test: (v: string) => /[a-z]/.test(v) },
];

export default function ChangePassword({ email }: { email?: string | null }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const allValid = rules.every((r) => r.test(next));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return toast.error("Sessão expirada. Faça login novamente.");
    if (!allValid) return toast.error("A nova senha não atende aos requisitos.");
    if (next !== confirm) return toast.error("As senhas não coincidem.");
    if (next === current) return toast.error("A nova senha deve ser diferente da atual.");

    setLoading(true);
    try {
      // Reautenticação: confirma que é mesmo o dono da conta
      const { error: authErr } = await supabase.auth.signInWithPassword({ email, password: current });
      if (authErr) throw new Error("Senha atual incorreta.");

      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;

      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("Senha alterada com sucesso!");
    } catch (err: any) {
      toast.error(err.message ?? "Não foi possível alterar a senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="glass-card p-6 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <KeyRound className="w-5 h-5 text-primary" />
        <h2 className="font-display font-bold">Alterar senha</h2>
      </div>
      <p className="text-sm text-muted-foreground -mt-2">
        Por segurança, confirme sua senha atual antes de definir uma nova.
      </p>

      <div>
        <Label>Senha atual</Label>
        <Input
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className="mt-1"
          placeholder="••••••"
        />
      </div>

      <div>
        <Label>Nova senha</Label>
        <div className="relative mt-1">
          <Input
            type={show ? "text" : "password"}
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className="pr-10"
            placeholder="••••••"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-label={show ? "Ocultar senha" : "Mostrar senha"}
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {next.length > 0 && (
          <ul className="mt-2 space-y-1">
            {rules.map((r) => {
              const ok = r.test(next);
              return (
                <li key={r.label} className={`text-[11px] flex items-center gap-1.5 ${ok ? "text-green-500" : "text-muted-foreground"}`}>
                  <ShieldCheck className="w-3 h-3" /> {r.label}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <Label>Confirmar nova senha</Label>
        <Input
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="mt-1"
          placeholder="••••••"
        />
        {confirm.length > 0 && confirm !== next && (
          <p className="text-[11px] text-destructive mt-1">As senhas não coincidem.</p>
        )}
      </div>

      <Button type="submit" variant="outline" className="w-full" disabled={loading || !current || !allValid || next !== confirm}>
        {loading ? "Alterando..." : "Alterar senha"}
      </Button>
    </form>
  );
}

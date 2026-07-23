import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const ResetPassword = () => {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const finish = () => { if (!cancelled) setReady(true); };
    const fail = (msg: string) => {
      if (cancelled) return;
      toast.error(msg);
      setTimeout(() => navigate("/auth", { replace: true }), 1500);
    };

    (async () => {
      const url = new URL(window.location.href);
      const qs = url.searchParams;
      const hash = new URLSearchParams(url.hash.replace(/^#/, ""));

      const errDesc = qs.get("error_description") || hash.get("error_description");
      if (errDesc) return fail(decodeURIComponent(errDesc));

      // 1) PKCE / newer emails: ?code=...
      const code = qs.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) return fail("Link inválido ou expirado. Solicite um novo e-mail de recuperação.");
        window.history.replaceState({}, "", "/reset-password");
        return finish();
      }

      // 2) OTP links: ?token_hash=...&type=recovery
      const tokenHash = qs.get("token_hash") || hash.get("token_hash");
      const type = (qs.get("type") || hash.get("type")) as any;
      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        if (error) return fail("Link inválido ou expirado. Solicite um novo e-mail de recuperação.");
        window.history.replaceState({}, "", "/reset-password");
        return finish();
      }

      // 3) Legacy hash tokens (#access_token=...&refresh_token=...)
      const access_token = hash.get("access_token");
      const refresh_token = hash.get("refresh_token");
      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) return fail("Link inválido ou expirado. Solicite um novo e-mail de recuperação.");
        window.history.replaceState({}, "", "/reset-password");
        return finish();
      }

      // 4) Already has a session (e.g. PASSWORD_RECOVERY handled elsewhere)
      const { data } = await supabase.auth.getSession();
      if (data.session) return finish();
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") finish();
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, [navigate]);

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 6) return "A senha deve ter pelo menos 6 caracteres.";
    if (!/[a-z]/.test(pwd)) return "A senha deve conter pelo menos uma letra minúscula.";
    if (!/[A-Z]/.test(pwd)) return "A senha deve conter pelo menos uma letra maiúscula.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pwdError = validatePassword(password);
    if (pwdError) return toast.error(pwdError);
    if (password !== confirmPassword) return toast.error("As senhas não coincidem.");

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Senha redefinida com sucesso!");
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      toast.error(err?.message || "Erro ao redefinir a senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <a href="/" className="font-display text-2xl font-bold gradient-text">Kōban</a>
          <p className="text-muted-foreground mt-2">Redefinir sua senha</p>
        </div>

        <div className="glass-card p-6">
          {!ready ? (
            <p className="text-sm text-muted-foreground text-center">
              Abra o link enviado ao seu e-mail para redefinir a senha.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="password">Nova senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Mín. 6 caracteres, com maiúscula e minúscula"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Repita a nova senha"
                  className="mt-1"
                />
              </div>
              <Button variant="hero" className="w-full" disabled={loading}>
                {loading ? "Salvando..." : "Redefinir senha"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;

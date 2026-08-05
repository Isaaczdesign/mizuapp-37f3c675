import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, LayoutDashboard, LogIn, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";

const PasswordResetSuccess = () => {
  const navigate = useNavigate();
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [seconds, setSeconds] = useState(6);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session));
  }, []);

  useEffect(() => {
    if (hasSession === null) return;
    if (seconds <= 0) {
      navigate(hasSession ? "/dashboard" : "/auth", { replace: true });
      return;
    }
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds, hasSession, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" aria-label="Mizu" className="inline-block">
            <Logo className="h-10 mx-auto" />
          </Link>
        </div>

        <div className="glass-card p-8 text-center space-y-6">
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse" />
              <div className="relative w-20 h-20 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                <CheckCircle2 className="w-12 h-12 text-primary" strokeWidth={2} />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-display font-bold">Senha redefinida!</h1>
            <p className="text-muted-foreground">
              Sua nova senha já está ativa. Guarde-a em um lugar seguro.
            </p>
          </div>

          <div className="rounded-lg border border-border/50 bg-muted/30 p-4 text-left space-y-3">
            <p className="text-sm font-medium flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              Próximos passos
            </p>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
              {hasSession ? (
                <>
                  <li>Você já está logado — pode ir direto ao painel.</li>
                  <li>Se acessar de outro dispositivo, use a nova senha.</li>
                </>
              ) : (
                <>
                  <li>Faça login com seu e-mail e a nova senha.</li>
                  <li>Se não reconhecer essa alteração, redefina novamente.</li>
                </>
              )}
              <li>Nunca compartilhe sua senha com terceiros.</li>
            </ul>
          </div>

          {hasSession ? (
            <Button variant="hero" className="w-full" onClick={() => navigate("/dashboard", { replace: true })}>
              <LayoutDashboard className="w-4 h-4 mr-2" />
              Ir para o painel
            </Button>
          ) : (
            <Button variant="hero" className="w-full" onClick={() => navigate("/auth", { replace: true })}>
              <LogIn className="w-4 h-4 mr-2" />
              Entrar agora
            </Button>
          )}

          <p className="text-xs text-muted-foreground">
            Redirecionando automaticamente em {seconds}s…
          </p>
        </div>
      </div>
    </div>
  );
};

export default PasswordResetSuccess;

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_RESET_REDIRECT_URL } from "@/lib/authRecoveryEmail";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import authSushi from "@/assets/auth-sushi.jpg";

const RESET_COOLDOWN_SECONDS = 60;
const RESET_STORAGE_KEY = "koban_reset_last_sent";

const fieldClass =
  "mt-2 h-12 rounded-xl bg-[#151515] border border-white/10 px-4 text-[#efeae1] placeholder:text-white/25 transition-all duration-300 focus-visible:ring-0 focus-visible:border-[#D4AF37]/70 focus-visible:shadow-[0_0_0_4px_rgba(212,175,55,0.12)]";
const labelClass = "text-xs font-medium uppercase tracking-[0.14em] text-white/40";


const Auth = () => {
  const [searchParams] = useSearchParams();
  const [isSignup, setIsSignup] = useState(searchParams.get("mode") === "signup");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [resetSentTo, setResetSentTo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const navigate = useNavigate();

  // Hydrate cooldown from localStorage so refreshes don't bypass the limit
  useEffect(() => {
    try {
      const raw = localStorage.getItem(RESET_STORAGE_KEY);
      if (!raw) return;
      const { at, to } = JSON.parse(raw) as { at: number; to: string };
      const elapsed = Math.floor((Date.now() - at) / 1000);
      const remaining = RESET_COOLDOWN_SECONDS - elapsed;
      if (remaining > 0) {
        setCooldown(remaining);
        setResetSentTo(to);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const sendResetEmail = async (isResend: boolean) => {
    const target = (resetSentTo || email).trim();
    if (!target) {
      toast.error("Informe seu e-mail acima para recuperar a senha.");
      return;
    }
    if (cooldown > 0) {
      toast.error(`Aguarde ${cooldown}s antes de reenviar.`);
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(target, {
        redirectTo: PASSWORD_RESET_REDIRECT_URL,
      });
      if (error) throw error;
      const now = Date.now();
      try {
        localStorage.setItem(RESET_STORAGE_KEY, JSON.stringify({ at: now, to: target }));
      } catch {}
      setResetSentTo(target);
      setCooldown(RESET_COOLDOWN_SECONDS);
      toast.success(isResend ? "E-mail reenviado. Verifique sua caixa de entrada e o spam." : "Enviamos um e-mail com o link para redefinir sua senha.");
    } catch (err: any) {
      const msg = err?.message || "Não foi possível enviar o e-mail.";
      if (msg.toLowerCase().includes("rate") || msg.toLowerCase().includes("429")) {
        toast.error("Muitas tentativas. Aguarde um momento e tente novamente.");
        setCooldown(RESET_COOLDOWN_SECONDS);
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 6) return "A senha deve ter pelo menos 6 caracteres.";
    if (!/[a-z]/.test(pwd)) return "A senha deve conter pelo menos uma letra minúscula.";
    if (!/[A-Z]/.test(pwd)) return "A senha deve conter pelo menos uma letra maiúscula.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSignup) {
      const pwdError = validatePassword(password);
      if (pwdError) {
        toast.error(pwdError);
        return;
      }
      if (password !== confirmPassword) {
        toast.error("As senhas não coincidem.");
        return;
      }
    }

    setLoading(true);

    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) throw error;

        // If email confirmation is required, no session is returned
        if (!data.session) {
          toast.success("Conta criada! Verifique seu e-mail para confirmar antes de entrar.");
          setIsSignup(false);
          return;
        }

        // Persist name so onboarding can hydrate immediately
        if (restaurantName.trim()) {
          try { localStorage.setItem("koban_signup_restaurant_name", restaurantName.trim()); } catch {}
        }

        // Session exists — create the restaurant now (function needs the JWT)
        if (restaurantName.trim()) {
          const { data: restData, error: restError } = await supabase.functions.invoke("create-restaurant", {
            body: { restaurant_name: restaurantName },
          });
          // Treat "already has a restaurant" as success (idempotent retry)
          const alreadyExists =
            (restError as any)?.context?.status === 400 ||
            (restData as any)?.restaurant_id ||
            (restData as any)?.error === "User already has a restaurant";
          if (restError && !alreadyExists) {
            console.error("Restaurant creation error:", restError);
            toast.error("Conta criada, mas houve erro ao criar o restaurante. Complete o onboarding.");
          } else {
            toast.success("Conta e restaurante criados!");
          }
        }

        navigate("/dashboard", { replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vindo de volta!");
        navigate("/dashboard", { replace: true });
      }
    } catch (err: any) {
      const msg = err?.message || "Erro ao processar";
      if (msg.toLowerCase().includes("invalid login")) {
        toast.error("E-mail ou senha incorretos.");
      } else if (msg.toLowerCase().includes("email not confirmed")) {
        toast.error("Confirme seu e-mail antes de entrar.");
      } else if (msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("user already")) {
        toast.error("Este e-mail já está cadastrado. Faça login.");
        setIsSignup(false);
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <a href="/" aria-label="Mizu" className="inline-block"><Logo className="h-10 mx-auto" /></a>
          <p className="text-muted-foreground mt-2">
            {isSignup ? "Crie sua conta e seu restaurante" : "Entre na sua conta"}
          </p>
        </div>

        <div className="glass-card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="seu@email.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder={isSignup ? "Mín. 6 caracteres, com maiúscula e minúscula" : "Sua senha"}
                className="mt-1"
              />
            </div>
            {isSignup && (
              <>
                <div>
                  <Label htmlFor="confirmPassword">Confirmar senha</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Repita a senha"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="restaurant">Nome do Restaurante</Label>
                  <Input
                    id="restaurant"
                    value={restaurantName}
                    onChange={(e) => setRestaurantName(e.target.value)}
                    required
                    placeholder="Ex: Sushi Katana"
                    className="mt-1"
                  />
                </div>
              </>
            )}
            <Button variant="hero" className="w-full" disabled={loading}>
              {loading ? "Processando..." : isSignup ? "Criar Conta" : "Entrar"}
            </Button>
          </form>

          <div className="mt-4 text-center space-y-2">
            {!isSignup && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => sendResetEmail(false)}
                  disabled={loading || cooldown > 0}
                  className="block w-full text-sm text-primary hover:underline disabled:opacity-60 disabled:cursor-not-allowed disabled:no-underline"
                >
                  {cooldown > 0 && resetSentTo
                    ? `E-mail enviado para ${resetSentTo}`
                    : "Esqueceu a senha?"}
                </button>
                {resetSentTo && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => sendResetEmail(true)}
                    disabled={loading || cooldown > 0}
                    className="w-full"
                  >
                    {cooldown > 0
                      ? `Reenviar em ${cooldown}s`
                      : "Reenviar e-mail de recuperação"}
                  </Button>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => setIsSignup(!isSignup)}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {isSignup ? "Já tem conta? Entrar" : "Não tem conta? Cadastrar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;

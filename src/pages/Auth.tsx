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
  "mt-1.5 lg:mt-2 h-11 lg:h-12 rounded-xl bg-[#151515] border border-white/10 px-4 text-[#efeae1] placeholder:text-white/25 transition-all duration-300 focus-visible:ring-0 focus-visible:border-[#D4AF37]/70 focus-visible:shadow-[0_0_0_4px_rgba(212,175,55,0.12)]";
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
    <div className="h-screen w-full overflow-x-hidden bg-[#0B0B0B] flex">
      {/* Coluna esquerda — formulário */}
      <div className="relative flex h-full w-full lg:w-[35%] items-center justify-center px-6 py-8 sm:px-10 lg:py-6 overflow-y-auto">

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[380px]"
        >
          <a href="/" aria-label="Mizu" className="inline-block">
            <Logo className="h-8 lg:h-9" />
          </a>

          <h1 className="mt-6 lg:mt-8 text-[1.75rem] lg:text-[2rem] leading-tight font-semibold tracking-tight text-[#efeae1]">
            {isSignup ? "Crie sua conta" : "Bem-vindo de volta"}
          </h1>
          <p className="mt-2 lg:mt-3 text-sm leading-relaxed text-white/40">
            {isSignup
              ? "Configure seu restaurante em poucos minutos."
              : "Acesse o painel para gerenciar seu restaurante."}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 lg:mt-8 space-y-4 lg:space-y-5">
            <div>
              <Label htmlFor="email" className={labelClass}>E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="seu@email.com"
                className={fieldClass}
              />
            </div>
            <div>
              <Label htmlFor="password" className={labelClass}>Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder={isSignup ? "Mín. 6 caracteres, com maiúscula e minúscula" : "Sua senha"}
                className={fieldClass}
              />
            </div>
            {isSignup && (
              <>
                <div>
                  <Label htmlFor="confirmPassword" className={labelClass}>Confirmar senha</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Repita a senha"
                    className={fieldClass}
                  />
                </div>
                <div>
                  <Label htmlFor="restaurant" className={labelClass}>Nome do Restaurante</Label>
                  <Input
                    id="restaurant"
                    value={restaurantName}
                    onChange={(e) => setRestaurantName(e.target.value)}
                    required
                    placeholder="Ex: Sushi Katana"
                    className={fieldClass}
                  />
                </div>
              </>
            )}

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.015 }}
              whileTap={{ scale: loading ? 1 : 0.985 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="flex h-11 lg:h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#D4AF37] text-sm font-semibold tracking-wide text-[#0B0B0B] shadow-[0_8px_30px_-10px_rgba(212,175,55,0.6)] transition-colors duration-300 hover:bg-[#e0c256] disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Processando…" : isSignup ? "Criar conta" : "Entrar"}
            </motion.button>
          </form>

          <div className="mt-6 lg:mt-8 space-y-2 lg:space-y-3 text-center">
            {!isSignup && (
              <div className="space-y-2 lg:space-y-3">
                <button
                  type="button"
                  onClick={() => sendResetEmail(false)}
                  disabled={loading || cooldown > 0}
                  className="block w-full text-sm text-white/50 transition-colors hover:text-[#D4AF37] disabled:opacity-50"
                >
                  {cooldown > 0 && resetSentTo
                    ? `E-mail enviado para ${resetSentTo}`
                    : "Esqueceu a senha?"}
                </button>
                {resetSentTo && (
                  <button
                    type="button"
                    onClick={() => sendResetEmail(true)}
                    disabled={loading || cooldown > 0}
                    className="h-11 w-full rounded-xl border border-white/10 bg-transparent text-sm text-white/60 transition-colors hover:border-white/20 hover:text-[#efeae1] disabled:opacity-50"
                  >
                    {cooldown > 0 ? `Reenviar em ${cooldown}s` : "Reenviar e-mail de recuperação"}
                  </button>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => setIsSignup(!isSignup)}
              className="text-sm text-white/40 transition-colors hover:text-[#D4AF37]"
            >
              {isSignup ? "Já tem conta? Entrar" : "Não tem conta? Criar conta"}
            </button>
          </div>
        </motion.div>
      </div>

      {/* Coluna direita — fotografia */}
      <div className="relative hidden lg:block lg:w-[65%] p-3">
        <motion.div
          initial={{ opacity: 0, scale: 1.03 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          className="relative h-full w-full overflow-hidden rounded-3xl"
        >
          <img
            src={authSushi}
            alt="Sushi gourmet"
            width={1024}
            height={1536}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0B]/70 via-[#0B0B0B]/10 to-transparent" />
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;

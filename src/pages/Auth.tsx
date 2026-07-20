import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const [isSignup, setIsSignup] = useState(searchParams.get("mode") === "signup");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const navigate = useNavigate();

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

        // Session exists — create the restaurant now (function needs the JWT)
        if (restaurantName.trim()) {
          const { error: restError } = await supabase.functions.invoke("create-restaurant", {
            body: { restaurant_name: restaurantName },
          });
          if (restError) {
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
          <a href="/" className="font-display text-2xl font-bold gradient-text">Kōban</a>
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
            )}
            <Button variant="hero" className="w-full" disabled={loading}>
              {loading ? "Processando..." : isSignup ? "Criar Conta" : "Entrar"}
            </Button>
          </form>

          <div className="mt-4 text-center">
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

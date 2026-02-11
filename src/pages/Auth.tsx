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
  const [restaurantName, setRestaurantName] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;

        if (data.user && restaurantName.trim()) {
          const { error: restError } = await supabase.functions.invoke("create-restaurant", {
            body: { restaurant_name: restaurantName },
          });
          if (restError) {
            console.error("Restaurant creation error:", restError);
            toast.error("Conta criada, mas houve erro ao criar o restaurante. Tente novamente.");
          }
        }

        toast.success("Verifique seu e-mail para confirmar a conta!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/dashboard");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar");
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
                placeholder="Mínimo 6 caracteres"
                className="mt-1"
              />
            </div>
            {isSignup && (
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

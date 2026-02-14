import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Store } from "lucide-react";

export default function Onboarding() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name.trim().length < 2) {
      toast.error("Nome do restaurante deve ter no mínimo 2 caracteres.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-restaurant", {
        body: { restaurant_name: name.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Restaurante criado com sucesso!");
      // Reload to pick up new profile
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar restaurante");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Store className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-display text-2xl font-bold">Bem-vindo ao <span className="gradient-text">Kōban</span></h1>
          <p className="text-muted-foreground mt-2">Configure seu restaurante para começar</p>
        </div>

        <div className="glass-card p-6">
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label htmlFor="restaurant-name">Nome do Restaurante</Label>
              <Input
                id="restaurant-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Sushi Katana"
                required
                minLength={2}
                className="mt-1"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Criando..." : "Criar Restaurante"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

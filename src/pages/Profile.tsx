import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Save, Crown, User, IdCard, Bell, Settings as SettingsIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageShell, PageHeader } from "@/components/dashboard/ui";
import DangerZone from "@/components/settings/DangerZone";
import ChangePassword from "@/components/settings/ChangePassword";


const planLabels: Record<string, string> = { free: "Gratuito", starter: "Starter", pro: "Profissional", enterprise: "Enterprise" };
const statusLabels: Record<string, string> = { active: "Ativo", inactive: "Inativo", trial: "Trial", expired: "Expirado" };

export default function Profile() {
  const { profile, user, roles } = useAuth();
  const rid = profile?.restaurant_id;
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");

  const isOwner = (roles.length > 0 ? roles : ["owner"]).some((r) => r === "owner" || r === "manager");

  const { data: restaurant } = useQuery({
    queryKey: ["restaurant", rid],
    enabled: !!rid,
    queryFn: async () => {
      const { data } = await supabase.from("restaurants").select("*").eq("id", rid!).single();
      return data;
    },
  });

  const { data: subscription } = useQuery({
    queryKey: ["subscription", rid],
    enabled: !!rid,
    queryFn: async () => {
      const { data } = await supabase.from("subscriptions").select("*").eq("restaurant_id", rid!).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    setDisplayName(profile?.display_name ?? "");
  }, [profile?.display_name]);

  useEffect(() => {
    if (restaurant) {
      setOwnerName((restaurant as any).owner_name ?? "");
      setOwnerPhone((restaurant as any).owner_phone ?? "");
      setOwnerEmail((restaurant as any).owner_email ?? "");
    }
  }, [restaurant]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessão expirada");
      const { error: pErr } = await supabase
        .from("profiles")
        .update({ display_name: displayName.trim() || null })
        .eq("user_id", user.id);
      if (pErr) throw pErr;

      if (isOwner && rid) {
        const { error } = await supabase
          .from("restaurants")
          .update({ owner_name: ownerName, owner_phone: ownerPhone, owner_email: ownerEmail })
          .eq("id", rid);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["restaurant", rid] });
      toast.success("Perfil atualizado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AdminLayout>
      <PageShell className="max-w-2xl">
        <PageHeader emoji="👤" title="Meu perfil" subtitle="Seus dados pessoais, plano e conta." />

        <div className="space-y-8">
          {/* Conta */}
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <User className="w-5 h-5 text-primary" />
              <h2 className="font-display font-bold">Conta</h2>
            </div>
            <div>
              <Label>Nome de exibição</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1" placeholder="Como devemos te chamar" />
            </div>
            <div>
              <Label>E-mail de acesso</Label>
              <Input value={user?.email ?? ""} readOnly disabled className="mt-1" />
              <p className="text-[11px] text-muted-foreground mt-1">O e-mail de login não pode ser alterado por aqui.</p>
            </div>
          </div>

          <ChangePassword email={user?.email} />


          {/* Responsável pelo estabelecimento */}
          {isOwner && (
            <div className="glass-card p-6 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <IdCard className="w-5 h-5 text-primary" />
                <h2 className="font-display font-bold">Responsável pelo estabelecimento</h2>
              </div>
              <p className="text-sm text-muted-foreground -mt-2">Contato usado para suporte e comunicações da Mizu.</p>
              <div>
                <Label>Nome do responsável</Label>
                <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className="mt-1" placeholder="Nome completo" />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} className="mt-1" placeholder="(11) 99999-9999" />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} className="mt-1" placeholder="responsavel@email.com" />
              </div>
            </div>
          )}

          {/* Plano */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <Crown className="w-5 h-5 text-primary" />
              <h2 className="font-display font-bold">Plano</h2>
            </div>
            <p className="text-lg font-bold">{planLabels[subscription?.plan ?? "free"] ?? subscription?.plan ?? "Gratuito"}</p>
            <p className="text-sm text-muted-foreground">
              Status:{" "}
              <span className={`font-medium ${subscription?.status === "active" ? "text-green-500" : "text-destructive"}`}>
                {statusLabels[subscription?.status ?? "active"] ?? subscription?.status ?? "Ativo"}
              </span>
            </p>
            {subscription?.expires_at && (
              <p className="text-xs text-muted-foreground mt-1">Expira em: {new Date(subscription.expires_at).toLocaleDateString("pt-BR")}</p>
            )}
            {subscription?.started_at && (
              <p className="text-xs text-muted-foreground">Início: {new Date(subscription.started_at).toLocaleDateString("pt-BR")}</p>
            )}
          </div>

          {/* Atalhos */}
          <div className="glass-card p-6 space-y-3">
            <h2 className="font-display font-bold">Atalhos</h2>
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/settings/notifications")}>
              <Bell className="w-4 h-4 mr-2" /> Preferências de notificação
            </Button>
            {isOwner && (
              <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/settings")}>
                <SettingsIcon className="w-4 h-4 mr-2" /> Configurações do estabelecimento
              </Button>
            )}
          </div>

          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full">
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? "Salvando..." : "Salvar perfil"}
          </Button>

          <DangerZone />
        </div>
      </PageShell>
    </AdminLayout>
  );
}

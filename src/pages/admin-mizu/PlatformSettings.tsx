import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminMizuLayout from "@/components/admin-mizu/AdminMizuLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { usePlatformRole, logPlatformAction } from "@/hooks/usePlatformRole";

type Settings = {
  id?: string; platform_name: string; support_email: string | null; support_whatsapp: string | null;
  terms_url: string | null; privacy_url: string | null; default_trial_days: number;
  signups_enabled: boolean; maintenance_enabled: boolean; maintenance_message: string | null;
};

const EMPTY: Settings = {
  platform_name: "Mizu", support_email: "", support_whatsapp: "", terms_url: "", privacy_url: "",
  default_trial_days: 7, signups_enabled: true, maintenance_enabled: false, maintenance_message: "",
};

export default function AdminSettings() {
  const { isAdmin } = usePlatformRole();
  const [data, setData] = useState<Settings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("platform_settings").select("*").limit(1).maybeSingle().then(({ data }) => {
      if (data) setData({ ...EMPTY, ...(data as Partial<Settings>) });
      setLoading(false);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    const payload = { ...data };
    const res = data.id
      ? await supabase.from("platform_settings").update(payload).eq("id", data.id).select().maybeSingle()
      : await supabase.from("platform_settings").insert(payload).select().maybeSingle();
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    if (res.data) setData({ ...EMPTY, ...(res.data as Partial<Settings>) });
    await logPlatformAction({ action: "platform_settings.updated", entityType: "platform_settings", newValue: payload });
    toast.success("Configurações salvas.");
  };

  if (loading) {
    return <AdminMizuLayout title="Configurações da plataforma"><Skeleton className="h-72 rounded-xl" /></AdminMizuLayout>;
  }

  return (
    <AdminMizuLayout title="Configurações da plataforma" description="Dados institucionais, cadastro e modo manutenção.">
      <div className="grid max-w-3xl gap-4">
        <div className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2">
          <div><Label>Nome da plataforma</Label><Input value={data.platform_name} onChange={(e) => setData({ ...data, platform_name: e.target.value })} /></div>
          <div><Label>Dias de teste padrão</Label><Input type="number" min={0} value={data.default_trial_days} onChange={(e) => setData({ ...data, default_trial_days: Number(e.target.value) })} /></div>
          <div><Label>E-mail de suporte</Label><Input value={data.support_email ?? ""} onChange={(e) => setData({ ...data, support_email: e.target.value })} /></div>
          <div><Label>WhatsApp de suporte</Label><Input value={data.support_whatsapp ?? ""} onChange={(e) => setData({ ...data, support_whatsapp: e.target.value })} /></div>
          <div><Label>Termos de uso (URL)</Label><Input value={data.terms_url ?? ""} onChange={(e) => setData({ ...data, terms_url: e.target.value })} /></div>
          <div><Label>Política de privacidade (URL)</Label><Input value={data.privacy_url ?? ""} onChange={(e) => setData({ ...data, privacy_url: e.target.value })} /></div>
        </div>

        <div className="space-y-4 rounded-xl border border-border p-4">
          <div className="flex items-center justify-between gap-4">
            <div><p className="text-sm font-medium">Cadastro de novos restaurantes</p><p className="text-xs text-muted-foreground">Desative para pausar novas contas.</p></div>
            <Switch checked={data.signups_enabled} onCheckedChange={(v) => setData({ ...data, signups_enabled: v })} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div><p className="text-sm font-medium">Modo manutenção</p><p className="text-xs text-muted-foreground">Administradores continuam acessando normalmente.</p></div>
            <Switch checked={data.maintenance_enabled} onCheckedChange={(v) => setData({ ...data, maintenance_enabled: v })} />
          </div>
          <div>
            <Label>Mensagem de manutenção</Label>
            <Textarea rows={3} value={data.maintenance_message ?? ""} onChange={(e) => setData({ ...data, maintenance_message: e.target.value })} />
          </div>
        </div>

        {isAdmin ? (
          <Button variant="hero" onClick={save} disabled={saving} className="w-fit">{saving ? "Salvando..." : "Salvar configurações"}</Button>
        ) : (
          <p className="text-sm text-muted-foreground">Seu papel permite apenas consulta destas configurações.</p>
        )}
      </div>
    </AdminMizuLayout>
  );
}

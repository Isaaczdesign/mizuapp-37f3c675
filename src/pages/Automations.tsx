import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, Zap, Clock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageShell, PageHeader } from "@/components/dashboard/ui";

const TRIGGERS = [
  { value: "post_purchase_d1", label: "Pós-compra (D+1)", desc: "Enviado 1 dia após a compra" },
  { value: "inactive_7d", label: "Inativo 7 dias", desc: "Cliente sem pedidos há 7 dias" },
  { value: "inactive_30d", label: "Inativo 30 dias", desc: "Cliente sem pedidos há 30 dias" },
] as const;

const Automations = () => {
  const { profile } = useAuth();
  const rid = profile?.restaurant_id;
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [trigger, setTrigger] = useState<string>("post_purchase_d1");
  const [template, setTemplate] = useState("Olá {{name}}, obrigado por pedir no {{restaurant}}! 🍣");
  const [sendStart, setSendStart] = useState("11:00");
  const [sendEnd, setSendEnd] = useState("20:00");

  const { data: rules = [] } = useQuery({
    queryKey: ["automation-rules", rid],
    enabled: !!rid,
    queryFn: async () => {
      const { data } = await supabase.from("automation_rules").select("*").eq("restaurant_id", rid!).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["message-logs", rid],
    enabled: !!rid,
    queryFn: async () => {
      const { data } = await supabase.from("message_logs").select("*, customers(name)")
        .eq("restaurant_id", rid!).order("sent_at", { ascending: false }).limit(20);
      return data ?? [];
    },
  });

  const createRule = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("automation_rules").insert({
        restaurant_id: rid!, trigger: trigger as any, message_template: template,
        is_active: true, send_window_start: sendStart, send_window_end: sendEnd,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automation-rules", rid] });
      setShowForm(false);
      setTemplate("Olá {{name}}, obrigado por pedir no {{restaurant}}! 🍣");
      toast.success("Regra criada!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleRule = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("automation_rules").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation-rules", rid] }),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("automation_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automation-rules", rid] });
      toast.success("Regra removida.");
    },
  });

  const triggerLabel = (t: string) => TRIGGERS.find((tr) => tr.value === t)?.label ?? t;

  return (
    <AdminLayout>
      <PageShell className="max-w-3xl">
        <PageHeader
          emoji="⚡"
          title="Automações"
          subtitle="Mensagens automáticas de pós-venda e reativação via WhatsApp."
          actions={
            <Button size="sm" className="rounded-xl" onClick={() => setShowForm(!showForm)}>
              <Plus className="w-4 h-4 mr-1" /> Nova Regra
            </Button>
          }
        />

        {showForm && (
          <div className="glass-card p-6 mb-6 space-y-4">
            <h2 className="font-display font-bold">Nova Automação</h2>
            <div>
              <Label>Gatilho</Label>
              <Select value={trigger} onValueChange={setTrigger}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRIGGERS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label} — {t.desc}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Mensagem</Label>
              <Textarea value={template} onChange={(e) => setTemplate(e.target.value)} className="mt-1" rows={3}
                placeholder="Use {{name}}, {{restaurant}}, {{days}}, {{coupon}}" />
              <p className="text-xs text-muted-foreground mt-1">Variáveis: {"{{name}}"}, {"{{restaurant}}"}, {"{{days}}"}, {"{{coupon}}"}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="flex items-center gap-1"><Clock className="w-3 h-3" /> Janela de Envio (Início)</Label>
                <Input type="time" value={sendStart} onChange={(e) => setSendStart(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="flex items-center gap-1"><Clock className="w-3 h-3" /> Janela de Envio (Fim)</Label>
                <Input type="time" value={sendEnd} onChange={(e) => setSendEnd(e.target.value)} className="mt-1" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">⚠️ Máximo 1 mensagem por cliente por dia. Apenas clientes com consentimento de marketing.</p>
            <div className="flex gap-2">
              <Button onClick={() => createRule.mutate()} disabled={createRule.isPending}>
                {createRule.isPending ? "Criando..." : "Criar Regra"}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            </div>
          </div>
        )}

        {/* Rules list */}
        <div className="space-y-3 mb-8">
          {rules.length === 0 && !showForm && (
            <div className="glass-card p-8 text-center">
              <Zap className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhuma automação configurada.</p>
              <p className="text-xs text-muted-foreground mt-1">Crie regras para enviar mensagens automáticas pelo WhatsApp.</p>
            </div>
          )}
          {rules.map((rule) => (
            <div key={rule.id} className="glass-card p-4 flex items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">{triggerLabel(rule.trigger)}</span>
                  <span className={`text-xs ${rule.is_active ? "text-green-500" : "text-muted-foreground"}`}>
                    {rule.is_active ? "Ativa" : "Inativa"}
                  </span>
                </div>
                <p className="text-sm">{rule.message_template}</p>
                {((rule as any).send_window_start || (rule as any).send_window_end) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    🕐 Envio: {(rule as any).send_window_start ?? "11:00"} — {(rule as any).send_window_end ?? "20:00"}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch checked={rule.is_active} onCheckedChange={(v) => toggleRule.mutate({ id: rule.id, is_active: v })} />
                <Button variant="ghost" size="icon" onClick={() => deleteRule.mutate(rule.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Logs */}
        <div className="glass-card p-6">
          <h2 className="font-display font-bold mb-4">Últimas Mensagens Enviadas</h2>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma mensagem enviada ainda.</p>
          ) : (
            <div className="space-y-2">
              {logs.map((log: any) => (
                <div key={log.id} className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0">
                  <div className="flex-1">
                    <span className="font-medium">{log.customers?.name ?? "—"}</span>
                    <span className="text-muted-foreground ml-2">{triggerLabel(log.trigger)}</span>
                    {(log as any).status && (
                      <span className={`ml-2 text-xs ${(log as any).status === "sent" ? "text-green-400" : "text-destructive"}`}>
                        {(log as any).status === "sent" ? "✓ Enviado" : "✗ Falhou"}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(log.sent_at).toLocaleDateString("pt-BR")}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </PageShell>
    </AdminLayout>
  );
};

export default Automations;

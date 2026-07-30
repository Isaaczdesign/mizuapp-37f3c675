import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import { useNotificationPrefs, PopupPosition } from "@/hooks/useNotificationPrefs";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Volume2, Monitor, MapPin } from "lucide-react";
import { toast } from "sonner";
import { PageShell, PageHeader } from "@/components/dashboard/ui";

const POSITIONS: { id: PopupPosition; label: string }[] = [
  { id: "top-left", label: "Superior esquerda" },
  { id: "top-center", label: "Superior centro" },
  { id: "top-right", label: "Superior direita" },
  { id: "bottom-left", label: "Inferior esquerda" },
  { id: "bottom-right", label: "Inferior direita" },
];

export default function NotificationSettings() {
  const { prefs, save, loading } = useNotificationPrefs();
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [inIframe, setInIframe] = useState(false);

  useEffect(() => {
    if ("Notification" in window) setPermission(Notification.permission);
    try {
      setInIframe(window.self !== window.top);
    } catch {
      setInIframe(true);
    }
  }, []);

  const requestPermission = async () => {
    if (!("Notification" in window)) {
      toast.error("Seu navegador não suporta notificações");
      return;
    }

    // Dentro de um iframe (preview do editor) o navegador bloqueia o pedido
    // de permissão automaticamente. Abrimos o app em uma aba nova.
    if (inIframe) {
      toast.info("Abrindo o app em uma nova aba para ativar as notificações...");
      window.open(window.location.href, "_blank", "noopener,noreferrer");
      return;
    }

    if (Notification.permission === "denied") {
      toast.error("Notificações bloqueadas para este site. Clique no cadeado 🔒 na barra de endereço e permita 'Notificações'.");
      return;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === "granted") {
        toast.success("Notificações ativadas!");
        new Notification("Mizu", { body: "Você receberá alertas de novos pedidos aqui." });
        save({ browser_push_enabled: true });
      } else if (result === "denied") {
        toast.error("Permissão negada. Clique no cadeado 🔒 na barra de endereço do navegador e permita 'Notificações'.");
      } else {
        toast.info("Permissão não concedida. Tente novamente e escolha 'Permitir'.");
      }
    } catch {
      toast.error("Não foi possível solicitar a permissão neste contexto. Abra o app em uma aba própria.");
    }
  };


  const testPopup = () => {
    toast.success("🔔 Teste: Novo pedido #ABC123", {
      description: "R$ 89,90 — Mesa 5",
      duration: 5000,
    });
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <PageShell className="max-w-2xl">
        <PageHeader emoji="🔔" title="Notificações" subtitle="Gerencie como você recebe alertas de novos pedidos." />

        {/* Browser permission */}
        <div className="glass-card p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Permissão do navegador</h3>
                <p className="text-xs text-muted-foreground">
                  Status: {permission === "granted" ? "✅ Concedida" : permission === "denied" ? "❌ Bloqueada" : "⏳ Não solicitada"}
                </p>
              </div>
            </div>
            {permission !== "granted" && (
              <Button size="sm" variant="hero" onClick={requestPermission}>
                {inIframe ? "Abrir em nova aba" : "Ativar"}
              </Button>
            )}
          </div>
          {inIframe && permission !== "granted" && (
            <p className="text-xs text-muted-foreground">
              Você está vendo o app dentro do editor. O navegador só permite ativar notificações em uma aba própria — clique no botão para abrir o app e ativar por lá.
            </p>
          )}
          {permission === "denied" && !inIframe && (
            <p className="text-xs text-destructive">
              As notificações estão bloqueadas para este site. Clique no cadeado 🔒 ao lado do endereço, escolha "Notificações" → "Permitir" e recarregue a página.
            </p>
          )}

        </div>

        {/* Preferences */}
        <div className="glass-card p-4 space-y-4">
          <h3 className="font-semibold text-sm">Preferências</h3>

          <label className="flex items-center justify-between gap-3">
            <div className="flex gap-3">
              <Volume2 className="w-5 h-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-medium">Som de alerta</p>
                <p className="text-xs text-muted-foreground">Toca um beep quando chega pedido novo.</p>
              </div>
            </div>
            <Switch
              checked={prefs.sound_enabled}
              onCheckedChange={(v) => save({ sound_enabled: v })}
            />
          </label>

          <label className="flex items-center justify-between gap-3">
            <div className="flex gap-3">
              <Bell className="w-5 h-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-medium">Notificação do navegador (push)</p>
                <p className="text-xs text-muted-foreground">Alerta o sistema mesmo com a aba em segundo plano.</p>
              </div>
            </div>
            <Switch
              checked={prefs.browser_push_enabled}
              onCheckedChange={(v) => save({ browser_push_enabled: v })}
            />
          </label>

          <label className="flex items-center justify-between gap-3">
            <div className="flex gap-3">
              <Monitor className="w-5 h-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-medium">Pop-up no dashboard</p>
                <p className="text-xs text-muted-foreground">Mostra um card flutuante em qualquer aba.</p>
              </div>
            </div>
            <Switch
              checked={prefs.popup_enabled}
              onCheckedChange={(v) => save({ popup_enabled: v })}
            />
          </label>
        </div>

        {/* Position */}
        <div className="glass-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Posição do pop-up</h3>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {POSITIONS.map((p) => (
              <button
                key={p.id}
                onClick={() => save({ popup_position: p.id })}
                className={`p-2 rounded-lg text-xs border transition-colors ${
                  prefs.popup_position === p.id
                    ? "bg-primary/10 border-primary text-primary font-medium"
                    : "border-border hover:bg-secondary text-muted-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <Button variant="outline" onClick={testPopup} className="w-full gap-2">
          <Bell className="w-4 h-4" />
          Testar notificação
        </Button>
      </PageShell>
    </AdminLayout>
  );
}

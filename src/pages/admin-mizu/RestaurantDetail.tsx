import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AdminMizuLayout from "@/components/admin-mizu/AdminMizuLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { usePlatformRole, logPlatformAction } from "@/hooks/usePlatformRole";

type Restaurant = {
  id: string; name: string; slug: string; owner_name: string | null; owner_email: string | null;
  owner_phone: string | null; address: string | null; is_active: boolean; created_at: string;
};

export default function AdminRestaurantDetail() {
  const { id = "" } = useParams();
  const { isAdmin, user } = usePlatformRole();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [subscription, setSubscription] = useState<Record<string, unknown> | null>(null);
  const [members, setMembers] = useState<{ user_id: string; display_name: string | null }[]>([]);
  const [counts, setCounts] = useState({ orders: 0, items: 0 });
  const [notes, setNotes] = useState<{ id: string; body: string; created_at: string }[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [logs, setLogs] = useState<{ id: string; action: string; created_at: string; reason: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<null | { title: string; body: string; run: () => Promise<unknown> }>(null);

  const load = async () => {
    setLoading(true);
    const [r, sub, prof, ord, mi, nt, lg] = await Promise.all([
      supabase.from("restaurants").select("*").eq("id", id).maybeSingle(),
      supabase.from("subscriptions").select("*").eq("restaurant_id", id).maybeSingle(),
      supabase.from("profiles").select("user_id, display_name").eq("restaurant_id", id),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("restaurant_id", id),
      supabase.from("menu_items").select("id", { count: "exact", head: true }).eq("restaurant_id", id),
      supabase.from("platform_notes").select("id, body, created_at").eq("restaurant_id", id).is("deleted_at", null).order("created_at", { ascending: false }),
      supabase.from("platform_admin_logs").select("id, action, created_at, reason").eq("entity_id", id).order("created_at", { ascending: false }).limit(20),
    ]);
    setRestaurant((r.data as Restaurant) ?? null);
    setSubscription((sub.data as Record<string, unknown>) ?? null);
    setMembers(prof.data ?? []);
    setCounts({ orders: ord.count ?? 0, items: mi.count ?? 0 });
    setNotes(nt.data ?? []);
    setLogs(lg.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const setActive = async (next: boolean) => {
    const { error } = await supabase.from("restaurants").update({ is_active: next }).eq("id", id);
    if (error) return toast.error("Não foi possível atualizar: " + error.message);
    await logPlatformAction({
      action: next ? "restaurant.reactivated" : "restaurant.suspended",
      entityType: "restaurant", entityId: id,
      oldValue: { is_active: !next }, newValue: { is_active: next },
    });
    toast.success(next ? "Restaurante reativado." : "Restaurante suspenso.");
    load();
  };

  const changePlan = async (plan: string) => {
    if (!subscription) return toast.error("Este restaurante ainda não possui assinatura registrada.");
    const { error } = await supabase.from("subscriptions").update({ plan }).eq("restaurant_id", id);
    if (error) return toast.error(error.message);
    await logPlatformAction({
      action: "subscription.plan_changed", entityType: "subscription", entityId: id,
      oldValue: { plan: subscription.plan }, newValue: { plan },
    });
    toast.success("Plano atualizado.");
    load();
  };

  const extendTrial = async (days: number) => {
    if (!subscription) return toast.error("Sem assinatura registrada para este restaurante.");
    const base = subscription.expires_at ? new Date(String(subscription.expires_at)) : new Date();
    const next = new Date(base.getTime() + days * 86400000).toISOString();
    const { error } = await supabase.from("subscriptions").update({ expires_at: next }).eq("restaurant_id", id);
    if (error) return toast.error(error.message);
    await logPlatformAction({
      action: "subscription.trial_extended", entityType: "subscription", entityId: id,
      oldValue: { expires_at: subscription.expires_at }, newValue: { expires_at: next }, reason: `${days} dias`,
    });
    toast.success(`Vencimento estendido em ${days} dias.`);
    load();
  };

  const addNote = async () => {
    if (!noteDraft.trim() || !user) return;
    const { error } = await supabase.from("platform_notes").insert({ restaurant_id: id, body: noteDraft.trim(), author_id: user.id });
    if (error) return toast.error(error.message);
    setNoteDraft("");
    toast.success("Observação interna registrada.");
    load();
  };

  if (loading) {
    return (
      <AdminMizuLayout title="Restaurante">
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      </AdminMizuLayout>
    );
  }

  if (!restaurant) {
    return (
      <AdminMizuLayout title="Restaurante não encontrado">
        <p className="text-sm text-muted-foreground">O registro não existe ou você não tem permissão para vê-lo.</p>
        <Button className="mt-4" variant="glass" asChild><Link to="/admin-mizu/restaurantes">Voltar</Link></Button>
      </AdminMizuLayout>
    );
  }

  return (
    <AdminMizuLayout
      title={restaurant.name}
      description={`/${restaurant.slug} · cadastrado em ${new Date(restaurant.created_at).toLocaleDateString("pt-BR")}`}
      actions={<Button variant="glass" size="sm" asChild><Link to="/admin-mizu/restaurantes"><ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar</Link></Button>}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border p-4">
          <h2 className="text-sm font-semibold">Dados do estabelecimento</h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Responsável</dt><dd>{restaurant.owner_name || "—"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">E-mail</dt><dd className="truncate">{restaurant.owner_email || "—"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">WhatsApp</dt><dd>{restaurant.owner_phone || "—"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Endereço</dt><dd className="text-right">{restaurant.address || "—"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Status</dt><dd>{restaurant.is_active ? "Ativo" : "Suspenso"}</dd></div>
          </dl>
        </section>

        <section className="rounded-xl border border-border p-4">
          <h2 className="text-sm font-semibold">Uso da plataforma</h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Pedidos</dt><dd>{counts.orders}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Produtos</dt><dd>{counts.items}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Usuários vinculados</dt><dd>{members.length}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Plano</dt><dd>{String(subscription?.plan ?? "—")}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Status da assinatura</dt><dd>{String(subscription?.status ?? "—")}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Vencimento</dt>
              <dd>{subscription?.expires_at ? new Date(String(subscription.expires_at)).toLocaleDateString("pt-BR") : "—"}</dd></div>
          </dl>
        </section>

        <section className="rounded-xl border border-border p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold">Ações administrativas</h2>
          {!isAdmin ? (
            <p className="mt-2 text-sm text-muted-foreground">Seu papel permite apenas consulta.</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={restaurant.is_active ? "glass" : "hero"}
                onClick={() =>
                  setConfirm({
                    title: restaurant.is_active ? "Suspender restaurante?" : "Reativar restaurante?",
                    body: restaurant.is_active
                      ? "O cardápio público deixará de aceitar pedidos. Nenhum dado é apagado."
                      : "O cardápio público voltará a ficar disponível.",
                    run: () => setActive(!restaurant.is_active),
                  })
                }
              >
                {restaurant.is_active ? "Suspender" : "Reativar"}
              </Button>
              <Button size="sm" variant="glass" onClick={() => setConfirm({ title: "Estender vencimento em 7 dias?", body: "A data de expiração da assinatura será adiada.", run: () => extendTrial(7) })}>
                Estender 7 dias
              </Button>
              {["trial", "basic", "pro"].map((p) => (
                <Button
                  key={p}
                  size="sm"
                  variant="glass"
                  onClick={() => setConfirm({ title: `Alterar plano para "${p}"?`, body: "A mudança impacta imediatamente os limites deste cliente.", run: () => changePlan(p) })}
                >
                  Plano {p}
                </Button>
              ))}
              <Button size="sm" variant="glass" asChild>
                <a href={`/r/${restaurant.slug}`} target="_blank" rel="noopener noreferrer">Ver cardápio público</a>
              </Button>
            </div>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">
            Exclusão definitiva não é permitida pelo painel — utilizamos suspensão e arquivamento para preservar histórico.
          </p>
        </section>

        <section className="rounded-xl border border-border p-4">
          <h2 className="text-sm font-semibold">Observações internas</h2>
          <p className="text-[11px] text-muted-foreground">Não visível para o restaurante.</p>
          <Textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} rows={3} className="mt-3" placeholder="Registrar pendência, contato ou problema técnico" />
          <Button size="sm" className="mt-2" variant="hero" onClick={addNote} disabled={!noteDraft.trim()}>Salvar observação</Button>
          <ul className="mt-4 space-y-2 text-sm">
            {notes.length === 0 && <li className="text-muted-foreground">Nenhuma observação registrada.</li>}
            {notes.map((n) => (
              <li key={n.id} className="rounded-lg border border-border p-2.5">
                <p>{n.body}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleString("pt-BR")}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-border p-4">
          <h2 className="text-sm font-semibold">Histórico administrativo</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {logs.length === 0 && <li className="text-muted-foreground">Nenhuma alteração administrativa registrada.</li>}
            {logs.map((l) => (
              <li key={l.id} className="flex justify-between gap-3 border-b border-border pb-2 last:border-0">
                <span>{l.action}{l.reason ? ` · ${l.reason}` : ""}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { const c = confirm; setConfirm(null); await c?.run(); }}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminMizuLayout>
  );
}

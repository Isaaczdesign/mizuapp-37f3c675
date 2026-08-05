import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AdminMizuLayout from "@/components/admin-mizu/AdminMizuLayout";
import NoteActions from "@/components/admin-mizu/NoteActions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowLeft, Store, ShoppingBag, UtensilsCrossed, Users, CreditCard, ExternalLink } from "lucide-react";
import { SectionCard, StatCard, StatusPill, EmptyState, Notice } from "@/components/admin-mizu/ui";
import { usePlatformRole, logPlatformAction } from "@/hooks/usePlatformRole";
import { menuPath } from "@/lib/publicMenuUrl";

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
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      </AdminMizuLayout>
    );
  }

  if (!restaurant) {
    return (
      <AdminMizuLayout title="Restaurante não encontrado">
        <EmptyState
          icon={Store}
          title="Registro indisponível"
          description="O registro não existe ou você não tem permissão para vê-lo."
          action={<Button variant="glass" asChild><Link to="/admin-mizu/restaurantes">Voltar à lista</Link></Button>}
        />
      </AdminMizuLayout>
    );
  }

  const Item = ({ label, value }: { label: string; value: ReactNode }) => (
    <div className="flex items-start justify-between gap-4 border-b border-border/50 py-2 last:border-0">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-sm">{value}</dd>
    </div>
  );

  return (
    <AdminMizuLayout
      title={restaurant.name}
      description={`/${restaurant.slug} · cadastrado em ${new Date(restaurant.created_at).toLocaleDateString("pt-BR")}`}
      actions={
        <>
          <StatusPill tone={restaurant.is_active ? "success" : "danger"}>
            {restaurant.is_active ? "Ativo" : "Suspenso"}
          </StatusPill>
          <Button variant="glass" size="sm" asChild>
            <Link to="/admin-mizu/restaurantes"><ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar</Link>
          </Button>
        </>
      }
    >
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={ShoppingBag} label="Pedidos" value={String(counts.orders)} />
        <StatCard icon={UtensilsCrossed} label="Produtos" value={String(counts.items)} />
        <StatCard icon={Users} label="Usuários vinculados" value={String(members.length)} />
        <StatCard
          accent
          icon={CreditCard}
          label="Plano"
          value={String(subscription?.plan ?? "—")}
          hint={
            subscription?.expires_at
              ? `Vence em ${new Date(String(subscription.expires_at)).toLocaleDateString("pt-BR")}`
              : "Sem vencimento definido"
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Dados do estabelecimento" bodyClassName="pt-1">
          <dl>
            <Item label="Responsável" value={restaurant.owner_name || "—"} />
            <Item label="E-mail" value={<span className="break-all">{restaurant.owner_email || "—"}</span>} />
            <Item label="WhatsApp" value={restaurant.owner_phone || "—"} />
            <Item label="Endereço" value={restaurant.address || "—"} />
            <Item
              label="Status"
              value={<StatusPill tone={restaurant.is_active ? "success" : "danger"}>{restaurant.is_active ? "Ativo" : "Suspenso"}</StatusPill>}
            />
          </dl>
        </SectionCard>

        <SectionCard title="Assinatura" bodyClassName="pt-1">
          <dl>
            <Item label="Plano" value={String(subscription?.plan ?? "—")} />
            <Item label="Status" value={String(subscription?.status ?? "—")} />
            <Item
              label="Vencimento"
              value={subscription?.expires_at ? new Date(String(subscription.expires_at)).toLocaleDateString("pt-BR") : "—"}
            />
            <Item label="Pedidos processados" value={counts.orders} />
            <Item label="Produtos no cardápio" value={counts.items} />
          </dl>
        </SectionCard>

        <SectionCard
          title="Ações administrativas"
          description="Toda ação é registrada em auditoria."
          className="lg:col-span-2"
        >
          {!isAdmin ? (
            <Notice>Seu papel permite apenas consulta.</Notice>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
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
                <Button size="sm" variant="glass" asChild>
                  <a href={menuPath(restaurant.slug)} target="_blank" rel="noopener noreferrer">
                    Ver cardápio público <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>

              <div className="mt-4 border-t border-destructive/40 pt-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-destructive">Zona de risco</p>
                <p className="mb-3 text-xs text-muted-foreground">
                  Banir bloqueia o login de todos os usuários vinculados e desativa o cardápio. Excluir apaga
                  definitivamente o restaurante, todos os dados e as contas dos usuários vinculados.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    placeholder="Motivo (obrigatório)"
                    className="h-9 w-full max-w-xs"
                  />
                  <Button size="sm" variant="glass" disabled={busy} onClick={() => runAdminAction("ban")}>
                    <Ban className="mr-1.5 h-3.5 w-3.5" /> Banir
                  </Button>
                  <Button size="sm" variant="glass" disabled={busy} onClick={() => runAdminAction("unban")}>
                    Remover banimento
                  </Button>
                  <Button size="sm" variant="destructive" disabled={busy} onClick={() => runAdminAction("delete")}>
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Excluir conta + restaurante
                  </Button>
                </div>
              </div>
            </>
          )}
        </SectionCard>


        <SectionCard title="Observações internas" description="Não visível para o restaurante.">
          <Textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} rows={3} placeholder="Registrar pendência, contato ou problema técnico" />
          <Button size="sm" className="mt-2" variant="hero" onClick={addNote} disabled={!noteDraft.trim()}>Salvar observação</Button>
          <ul className="mt-4 space-y-2 text-sm">
            {notes.length === 0 && <li className="text-xs text-muted-foreground">Nenhuma observação registrada.</li>}
            {notes.map((n) => (
              <li key={n.id} className="rounded-xl border border-border bg-background/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 break-words leading-relaxed">{n.body}</p>
                  <NoteActions noteId={n.id} body={n.body} onDone={load} />
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleString("pt-BR")}</p>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Histórico administrativo" description="Últimas 20 ações nesta conta.">
          <ul className="space-y-2 text-sm">
            {logs.length === 0 && <li className="text-xs text-muted-foreground">Nenhuma alteração administrativa registrada.</li>}
            {logs.map((l) => (
              <li key={l.id} className="flex items-start justify-between gap-3 border-b border-border/50 pb-2 last:border-0">
                <span className="min-w-0 break-words">{l.action}{l.reason ? ` · ${l.reason}` : ""}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
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

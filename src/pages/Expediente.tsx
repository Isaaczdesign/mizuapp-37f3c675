import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { orderRef } from "@/lib/orderNumber";
import { broadcastMenuUpdate } from "@/lib/menuRealtime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft, ArrowRight, DoorClosed, ListChecks, BarChart3, Wallet,
  CheckCircle2, AlertTriangle, Plus, Trash2, ExternalLink, History,
} from "lucide-react";
import {
  PAYMENT_METHODS, PAYMENT_LABEL, STATUS_LABEL, TERMINAL_STATUSES,
  fmtBRL, computeShiftTotals, expectedByPaymentMethod, type OrderRow, type ShiftRow,
} from "@/lib/shiftUtils";
import { orderTypeLabel } from "@/lib/orderTypes";
import { PageShell, PageHeader } from "@/components/dashboard/ui";

type Step = 0 | 1 | 2 | 3 | 4;
const STEPS = [
  { key: 0, label: "Recebimento", icon: DoorClosed },
  { key: 1, label: "Pedidos", icon: ListChecks },
  { key: 2, label: "Resumo", icon: BarChart3 },
  { key: 3, label: "Caixa", icon: Wallet },
  { key: 4, label: "Confirmar", icon: CheckCircle2 },
] as const;

export default function Expediente() {
  const { profile, user, roles } = useAuth();
  const rid = profile?.restaurant_id!;
  const nav = useNavigate();
  const canManage = roles.includes("owner") || roles.includes("manager") || roles.length === 0;

  const [step, setStep] = useState<Step>(0);
  const [restaurant, setRestaurant] = useState<{ accepting_orders: boolean; closed_message: string | null } | null>(null);
  const [shift, setShift] = useState<ShiftRow | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [cashCounts, setCashCounts] = useState<Record<string, { informed: string; justification: string }>>({});

  const [newMov, setNewMov] = useState({ type: "sangria", amount: "", description: "" });
  const [responsibleName, setResponsibleName] = useState(profile?.display_name || "");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notes, setNotes] = useState("");
  const [divergenceJustification, setDivergenceJustification] = useState("");
  const [pendingJustification, setPendingJustification] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (rid) load(); }, [rid]);

  async function load() {
    const [rRes, sRes] = await Promise.all([
      supabase.from("restaurants").select("accepting_orders, closed_message").eq("id", rid).single(),
      (supabase as any).rpc("get_current_shift", { _restaurant_id: rid }),
    ]);
    setRestaurant(rRes.data as any);
    const cur = Array.isArray(sRes.data) ? sRes.data[0] : sRes.data;
    let shiftRow = cur as ShiftRow | null;
    if (!shiftRow) {
      const { data: created } = await supabase.from("work_shifts").insert({
        restaurant_id: rid, opened_by: user?.id, opened_at: new Date().toISOString(),
      }).select().single();
      shiftRow = created as ShiftRow;
    }
    setShift(shiftRow);
    await loadShiftData(shiftRow!);
  }

  async function loadShiftData(s: ShiftRow) {
    const [oRes, mRes, cRes] = await Promise.all([
      supabase.from("orders").select("*").eq("restaurant_id", rid).gte("created_at", s.opened_at).order("created_at", { ascending: false }),
      supabase.from("shift_cash_movements").select("*").eq("shift_id", s.id).order("created_at", { ascending: false }),
      supabase.from("shift_cash_counts").select("*").eq("shift_id", s.id),
    ]);
    const os = (oRes.data ?? []) as OrderRow[];
    setOrders(os);
    setMovements(mRes.data ?? []);
    const existing = cRes.data ?? [];
    const cc: Record<string, { informed: string; justification: string }> = {};
    existing.forEach((r: any) => { cc[r.payment_method] = { informed: String(r.informed ?? ""), justification: r.justification ?? "" }; });
    setCashCounts(cc);
  }

  const totals = useMemo(() => computeShiftTotals(orders), [orders]);
  const expectedByPay = useMemo(() => expectedByPaymentMethod(orders), [orders]);
  const pendingOrders = useMemo(() => orders.filter((o) => !TERMINAL_STATUSES.has(o.status as string)), [orders]);

  const movementSum = useMemo(() => {
    let sangria = 0, suprimento = 0, retirada = 0, despesa = 0, ajuste = 0;
    for (const m of movements) {
      const a = Number(m.amount || 0);
      if (m.movement_type === "sangria") sangria += a;
      else if (m.movement_type === "suprimento") suprimento += a;
      else if (m.movement_type === "retirada") retirada += a;
      else if (m.movement_type === "despesa") despesa += a;
      else if (m.movement_type === "ajuste") ajuste += a;
    }
    return { sangria, suprimento, retirada, despesa, ajuste };
  }, [movements]);

  const cashSummary = useMemo(() => {
    let expected = 0, informed = 0;
    for (const pm of PAYMENT_METHODS) {
      const exp = expectedByPay[pm.key]?.total || 0;
      const inf = Number(cashCounts[pm.key]?.informed || 0);
      expected += exp;
      informed += inf;
    }
    const expectedFinal = expected + movementSum.suprimento - movementSum.sangria - movementSum.retirada - movementSum.despesa + movementSum.ajuste;
    const diff = informed - expectedFinal;
    return { expected, informed, expectedFinal, diff };
  }, [expectedByPay, cashCounts, movementSum]);

  const hasDivergence = Math.abs(cashSummary.diff) > 0.009;

  async function toggleAccepting(next: boolean) {
    if (!canManage) return;
    const { error } = await supabase.from("restaurants").update({ accepting_orders: next }).eq("id", rid);
    if (error) return toast.error("Erro ao atualizar status");
    setRestaurant((r) => (r ? { ...r, accepting_orders: next } : r));
    await broadcastMenuUpdate(rid, "accepting_orders");
    if (shift) {
      await supabase.from("shift_audit_logs").insert({
        restaurant_id: rid, shift_id: shift.id, user_id: user?.id,
        action: next ? "reopen_orders" : "close_orders", metadata: {},
      });
    }
    toast.success(next ? "Restaurante aberto para novos pedidos" : "Restaurante fechado para novos pedidos");
  }

  async function advanceOrder(o: OrderRow, next: string) {
    const { error } = await supabase.from("orders").update({ status: next as any }).eq("id", o.id);
    if (error) return toast.error("Erro ao atualizar pedido");
    await loadShiftData(shift!);
  }

  async function addMovement() {
    const amt = Number(newMov.amount);
    if (!amt || amt <= 0) return toast.error("Informe um valor válido");
    const { error } = await supabase.from("shift_cash_movements").insert({
      shift_id: shift!.id, restaurant_id: rid, user_id: user?.id,
      movement_type: newMov.type as any, amount: amt, description: newMov.description || null,
    });
    if (error) return toast.error("Erro ao registrar movimentação");
    setNewMov({ type: "sangria", amount: "", description: "" });
    await loadShiftData(shift!);
  }

  async function removeMovement(id: string) {
    await supabase.from("shift_cash_movements").delete().eq("id", id);
    await loadShiftData(shift!);
  }

  async function saveShiftServiceClose() {
    if (!shift) return;
    await supabase.from("work_shifts").update({
      status: "service_closed", service_closed_at: new Date().toISOString(), service_closed_by: user?.id,
    }).eq("id", shift.id);
    await supabase.from("shift_audit_logs").insert({
      restaurant_id: rid, shift_id: shift.id, user_id: user?.id, action: "service_closed", metadata: {},
    });
  }

  async function confirmFinancialClose() {
    if (!shift) return;
    if (hasDivergence && !divergenceJustification.trim()) return toast.error("Justificativa obrigatória para divergência de caixa");
    if (pendingOrders.length > 0 && !pendingJustification.trim()) return toast.error("Justificativa obrigatória para pedidos em andamento");
    if (!responsibleName.trim()) return toast.error("Informe o nome do responsável");
    if (!confirmPassword) return toast.error("Confirme sua senha");

    setSaving(true);
    try {
      // reauth
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: user?.email!, password: confirmPassword,
      });
      if (authErr) { toast.error("Senha inválida"); return; }

      // upsert cash counts
      const rows = PAYMENT_METHODS.map((pm) => {
        const exp = expectedByPay[pm.key]?.total || 0;
        const cnt = expectedByPay[pm.key]?.count || 0;
        const inf = Number(cashCounts[pm.key]?.informed || 0);
        return {
          shift_id: shift.id, restaurant_id: rid, payment_method: pm.key,
          expected: exp, informed: inf, diff: inf - exp, orders_count: cnt,
          justification: cashCounts[pm.key]?.justification || null,
        };
      });
      await supabase.from("shift_cash_counts").delete().eq("shift_id", shift.id);
      await supabase.from("shift_cash_counts").insert(rows);

      // close shift
      if (shift.status === "open") await saveShiftServiceClose();
      await supabase.from("work_shifts").update({
        status: "financial_closed",
        financial_closed_at: new Date().toISOString(),
        financial_closed_by: user?.id,
        responsible_name: responsibleName,
        notes: notes || null,
        divergence_justification: hasDivergence ? divergenceJustification : null,
        pending_orders_justification: pendingOrders.length > 0 ? pendingJustification : null,
        totals: totals as any,
        expected_cash: cashSummary.expectedFinal,
        informed_cash: cashSummary.informed,
        cash_diff: cashSummary.diff,
      }).eq("id", shift.id);

      await supabase.from("shift_audit_logs").insert({
        restaurant_id: rid, shift_id: shift.id, user_id: user?.id,
        action: "financial_closed",
        metadata: { totals, cashSummary, hasDivergence, pendingCount: pendingOrders.length } as any,
      });

      toast.success("Expediente encerrado com sucesso");
      nav("/expediente/historico");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao encerrar");
    } finally {
      setSaving(false);
    }
  }

  if (!canManage) {
    return (
      <AdminLayout>
        <div className="p-6"><div className="glass-card p-6 max-w-lg">Você não tem permissão para encerrar o expediente.</div></div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <PageShell className="max-w-5xl gap-6">
        <PageHeader
          emoji="🔒"
          title="Encerrar expediente"
          subtitle={`Aberto em ${shift ? format(new Date(shift.opened_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "—"}`}
          actions={
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => nav("/expediente/historico")}>
              <History className="w-4 h-4 mr-1" /> Histórico
            </Button>
          }
        />

        {/* Stepper */}
        <div className="glass-card p-4">
          <Progress value={((step + 1) / STEPS.length) * 100} className="h-2 mb-3" />
          <div className="grid grid-cols-5 gap-2">
            {STEPS.map((s) => {
              const Icon = s.icon;
              const active = s.key === step;
              const done = s.key < step;
              return (
                <button key={s.key} onClick={() => setStep(s.key as Step)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl text-xs transition-colors ${
                    active ? "bg-primary/10 text-primary" : done ? "text-emerald-400" : "text-muted-foreground hover:text-foreground"
                  }`}>
                  <Icon className="w-4 h-4" />
                  <span className="truncate">{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* STEP 0: recebimento */}
        {step === 0 && (
          <div className="glass-card p-5 space-y-4">
            <h2 className="font-display text-lg font-bold">Encerrar recebimento de novos pedidos?</h2>
            <p className="text-sm text-muted-foreground">
              Se você fechar agora, o cardápio público mostrará que o estabelecimento está fechado e nenhum novo pedido será aceito.
              Pedidos já feitos continuam normalmente.
            </p>
            <div className={`p-4 rounded-xl border ${restaurant?.accepting_orders ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">Status atual</div>
                  <div className="text-sm text-muted-foreground">{restaurant?.accepting_orders ? "Aceitando novos pedidos" : "Fechado — não aceita novos pedidos"}</div>
                </div>
                <Button variant={restaurant?.accepting_orders ? "destructive" : "default"} onClick={() => toggleAccepting(!restaurant?.accepting_orders)}>
                  {restaurant?.accepting_orders ? "Fechar agora" : "Reabrir"}
                </Button>
              </div>
            </div>
            <div>
              <Label>Mensagem exibida no cardápio quando fechado (opcional)</Label>
              <Textarea value={restaurant?.closed_message ?? ""} onChange={(e) => setRestaurant((r) => r ? { ...r, closed_message: e.target.value } : r)}
                onBlur={() => supabase.from("restaurants").update({ closed_message: restaurant?.closed_message ?? null }).eq("id", rid)}
                placeholder="Ex: Estamos fechados. Voltamos amanhã às 18h." />
            </div>
          </div>
        )}

        {/* STEP 1: pedidos pendentes */}
        {step === 1 && (
          <div className="glass-card p-5 space-y-4">
            <h2 className="font-display text-lg font-bold flex items-center gap-2">
              <ListChecks className="w-5 h-5" /> Pedidos em andamento ({pendingOrders.length})
            </h2>
            {pendingOrders.length === 0 ? (
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-sm">
                Nenhum pedido pendente. Pode seguir.
              </div>
            ) : (
              <>
                <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 text-sm flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <span>Revise cada pedido abaixo antes de continuar. Nenhum pedido será finalizado automaticamente.</span>
                </div>
                <div className="space-y-2">
                  {pendingOrders.map((o) => (
                    <div key={o.id} className="p-3 rounded-xl border border-border bg-secondary/30">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <div className="font-medium">{orderRef(o)} — {orderTypeLabel(o.order_type)}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(o.created_at), "HH:mm", { locale: ptBR })} · {fmtBRL(Number(o.total))} · {STATUS_LABEL[o.status as string] ?? o.status}
                          </div>
                        </div>
                        <div className="flex gap-1 flex-wrap">
                          <Button size="sm" variant="outline" onClick={() => window.open(`/orders?id=${o.id}`, "_blank")}>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                          {o.status !== "completed" && o.status !== "delivered" && (
                            <Button size="sm" onClick={() => advanceOrder(o, o.order_type === "delivery" ? "delivered" : "completed")}>
                              Finalizar
                            </Button>
                          )}
                          <Button size="sm" variant="destructive" onClick={() => advanceOrder(o, "canceled")}>Cancelar</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* STEP 2: resumo */}
        {step === 2 && (
          <div className="grid gap-4 md:grid-cols-2">
            <SummaryCard title="Pedidos" rows={[
              ["Total", totals.total],
              ["Concluídos", totals.completed],
              ["Cancelados", totals.canceled],
              ["Recusados", totals.refused],
              ["Em andamento", totals.pending],
            ]} />
            <SummaryCard title="Por tipo" rows={[
              ["No local", totals.byType.dine_in],
              ["Retirada", totals.byType.pickup],
              ["Delivery", totals.byType.delivery],
            ]} />
            <SummaryCard title="Financeiro" rows={[
              ["Bruto", fmtBRL(totals.gross)],
              ["Taxas de entrega", fmtBRL(totals.deliveryFees)],
              ["Cancelamentos", fmtBRL(totals.canceledSum)],
              ["Líquido", fmtBRL(totals.net)],
              ["Ticket médio", fmtBRL(totals.ticket)],
              ["Clientes atendidos", totals.customers],
            ]} />
            <SummaryCard title="Status" rows={Object.entries(totals.byStatus).map(([k, v]) => [STATUS_LABEL[k] ?? k, v])} />
          </div>
        )}

        {/* STEP 3: caixa */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="glass-card p-5">
              <h2 className="font-display text-lg font-bold mb-3">Conferência por forma de pagamento</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="py-2 pr-2">Forma</th>
                      <th className="py-2 px-2 text-right">Esperado</th>
                      <th className="py-2 px-2 text-right">Pedidos</th>
                      <th className="py-2 px-2">Informado</th>
                      <th className="py-2 pl-2 text-right">Diferença</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PAYMENT_METHODS.map((pm) => {
                      const exp = expectedByPay[pm.key]?.total || 0;
                      const cnt = expectedByPay[pm.key]?.count || 0;
                      const inf = Number(cashCounts[pm.key]?.informed || 0);
                      const d = inf - exp;
                      return (
                        <tr key={pm.key} className="border-b border-border/50">
                          <td className="py-2 pr-2">{pm.label}</td>
                          <td className="py-2 px-2 text-right">{fmtBRL(exp)}</td>
                          <td className="py-2 px-2 text-right text-muted-foreground">{cnt}</td>
                          <td className="py-2 px-2">
                            <Input type="number" step="0.01" className="h-8"
                              value={cashCounts[pm.key]?.informed ?? ""}
                              onChange={(e) => setCashCounts((c) => ({ ...c, [pm.key]: { ...(c[pm.key] || { informed: "", justification: "" }), informed: e.target.value } }))} />
                          </td>
                          <td className={`py-2 pl-2 text-right ${Math.abs(d) < 0.01 ? "text-muted-foreground" : d < 0 ? "text-red-400" : "text-emerald-400"}`}>
                            {fmtBRL(d)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="glass-card p-5">
              <h2 className="font-display text-lg font-bold mb-3">Sangrias, suprimentos e retiradas</h2>
              <div className="grid gap-2 md:grid-cols-4 mb-3">
                <select className="bg-secondary rounded-lg px-3 py-2 text-sm" value={newMov.type}
                  onChange={(e) => setNewMov((m) => ({ ...m, type: e.target.value }))}>
                  <option value="sangria">Sangria</option>
                  <option value="suprimento">Suprimento</option>
                  <option value="retirada">Retirada</option>
                  <option value="despesa">Despesa</option>
                  <option value="ajuste">Ajuste</option>
                </select>
                <Input type="number" step="0.01" placeholder="Valor" value={newMov.amount}
                  onChange={(e) => setNewMov((m) => ({ ...m, amount: e.target.value }))} />
                <Input placeholder="Descrição" value={newMov.description}
                  onChange={(e) => setNewMov((m) => ({ ...m, description: e.target.value }))} />
                <Button onClick={addMovement}><Plus className="w-4 h-4 mr-1" />Adicionar</Button>
              </div>
              <div className="space-y-1.5">
                {movements.length === 0 && <div className="text-xs text-muted-foreground">Nenhuma movimentação registrada.</div>}
                {movements.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-3 text-sm p-2 rounded-lg bg-secondary/40">
                    <div>
                      <span className="font-medium capitalize">{m.movement_type}</span>
                      {m.description && <span className="text-muted-foreground"> — {m.description}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span>{fmtBRL(Number(m.amount))}</span>
                      <button onClick={() => removeMovement(m.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card p-5 space-y-2 text-sm">
              <Row label="Esperado (vendas)">{fmtBRL(cashSummary.expected)}</Row>
              <Row label="+ Suprimentos">{fmtBRL(movementSum.suprimento)}</Row>
              <Row label="− Sangrias/Retiradas/Despesas">{fmtBRL(movementSum.sangria + movementSum.retirada + movementSum.despesa)}</Row>
              <Row label="± Ajustes">{fmtBRL(movementSum.ajuste)}</Row>
              <div className="border-t border-border pt-2" />
              <Row label="Total esperado em caixa" strong>{fmtBRL(cashSummary.expectedFinal)}</Row>
              <Row label="Total informado" strong>{fmtBRL(cashSummary.informed)}</Row>
              <Row label="Diferença" strong>
                <span className={hasDivergence ? (cashSummary.diff < 0 ? "text-red-400" : "text-amber-400") : "text-emerald-400"}>
                  {fmtBRL(cashSummary.diff)}
                </span>
              </Row>
              {hasDivergence && (
                <div className="pt-2">
                  <Label>Justificativa da divergência (obrigatória)</Label>
                  <Textarea value={divergenceJustification} onChange={(e) => setDivergenceJustification(e.target.value)} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 4: confirm */}
        {step === 4 && (
          <div className="glass-card p-5 space-y-4 max-w-2xl">
            <h2 className="font-display text-lg font-bold">Confirmar encerramento do expediente</h2>
            <p className="text-sm text-muted-foreground">
              O restaurante continuará fechado para novos pedidos. O fechamento será salvo no histórico e alterações posteriores dependerão de permissão administrativa.
            </p>
            {pendingOrders.length > 0 && (
              <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 text-sm">
                Existem <strong>{pendingOrders.length}</strong> pedidos em andamento. Informe uma justificativa para mantê-los.
                <Textarea className="mt-2" value={pendingJustification} onChange={(e) => setPendingJustification(e.target.value)} />
              </div>
            )}
            <div>
              <Label>Responsável</Label>
              <Input value={responsibleName} onChange={(e) => setResponsibleName(e.target.value)} />
            </div>
            <div>
              <Label>Sua senha (confirmação de segurança)</Label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <div>
              <Label>Observações (opcional)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(3)}><ArrowLeft className="w-4 h-4 mr-1" />Voltar</Button>
              <Button className="flex-1" onClick={confirmFinancialClose} disabled={saving}>
                {saving ? "Encerrando..." : "Confirmar encerramento"}
              </Button>
            </div>
          </div>
        )}

        {/* nav */}
        {step < 4 && (
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(Math.max(0, step - 1) as Step)} disabled={step === 0}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            <Button onClick={() => setStep(((step + 1) as Step))}>
              Avançar <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </PageShell>
    </AdminLayout>
  );
}

function Row({ label, children, strong }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "font-semibold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span>{children}</span>
    </div>
  );
}

function SummaryCard({ title, rows }: { title: string; rows: [string, string | number][] }) {
  return (
    <div className="glass-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{title}</div>
      <div className="space-y-1 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between">
            <span className="text-muted-foreground">{k}</span>
            <span className="font-medium">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

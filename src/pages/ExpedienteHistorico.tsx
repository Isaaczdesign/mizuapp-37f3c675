import { useEffect, useState } from "react";
import { Link } from "@/lib/router-compat";
import { useAuth } from "@/hooks/useAuth";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { broadcastMenuUpdate } from "@/lib/menuRealtime";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Download, FileText, RefreshCw, ListOrdered, ArrowLeft } from "lucide-react";
import { fmtBRL, PAYMENT_LABEL, type ShiftRow } from "@/lib/shiftUtils";
import { generateShiftReportPDF } from "@/lib/shiftReport";
import { toast } from "sonner";
import { PageShell, PageHeader } from "@/components/dashboard/ui";

export default function ExpedienteHistorico() {
  const { profile, user, roles } = useAuth();
  const rid = profile?.restaurant_id!;
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [detail, setDetail] = useState<any | null>(null);
  const isOwner = roles.includes("owner");

  useEffect(() => { if (rid) load(); }, [rid]);
  async function load() {
    const { data } = await supabase.from("work_shifts").select("*").eq("restaurant_id", rid).order("opened_at", { ascending: false }).limit(50);
    setShifts((data ?? []) as ShiftRow[]);
  }

  async function openDetail(s: ShiftRow) {
    const [c, m, r] = await Promise.all([
      supabase.from("shift_cash_counts").select("*").eq("shift_id", s.id),
      supabase.from("shift_cash_movements").select("*").eq("shift_id", s.id).order("created_at"),
      supabase.from("restaurants").select("name, slug, address").eq("id", rid).single(),
    ]);
    setDetail({ shift: s, counts: c.data ?? [], movements: m.data ?? [], restaurant: r.data });
  }

  async function reopen(s: ShiftRow) {
    const reason = window.prompt("Justifique a reabertura do expediente:");
    if (!reason) return;
    await supabase.from("work_shifts").update({
      status: "reopened", reopened_at: new Date().toISOString(), reopened_by: user?.id, reopen_reason: reason,
    }).eq("id", s.id);
    await supabase.from("shift_audit_logs").insert({
      restaurant_id: rid, shift_id: s.id, user_id: user?.id, action: "reopened", metadata: { reason },
    });
    await supabase.from("restaurants").update({ accepting_orders: true }).eq("id", rid);
    await broadcastMenuUpdate(rid, "shift");
    toast.success("Expediente reaberto");
    load();
  }

  // Excel pt-BR: separador ";", decimal com vírgula e BOM UTF-8 para acentuação.
  const csvNum = (v: unknown) => Number(v ?? 0).toFixed(2).replace(".", ",");
  const csvDate = (v?: string | null) => (v ? format(new Date(v), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—");
  const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;

  async function exportCSV(s: ShiftRow) {
    const [c, m, r] = await Promise.all([
      supabase.from("shift_cash_counts").select("*").eq("shift_id", s.id),
      supabase.from("shift_cash_movements").select("*").eq("shift_id", s.id).order("created_at"),
      supabase.from("restaurants").select("name").eq("id", rid).single(),
    ]);
    const t = (s.totals as any) || {};
    const statusLabel = s.status === "open" ? "Aberto" : s.status === "service_closed" ? "Atendimento encerrado"
      : s.status === "financial_closed" ? "Fechado" : "Reaberto";

    const rows: (string | number)[][] = [
      ["Relatório de encerramento de expediente"],
      ["Restaurante", r.data?.name ?? ""],
      ["Abertura", csvDate(s.opened_at)],
      ["Encerramento atendimento", csvDate(s.service_closed_at)],
      ["Fechamento financeiro", csvDate(s.financial_closed_at)],
      ["Responsável", s.responsible_name ?? "—"],
      ["Status", statusLabel],
      [],
      ["Resumo de pedidos"],
      ["Total", Number(t.total ?? 0)],
      ["Concluídos", Number(t.completed ?? 0)],
      ["Cancelados", Number(t.canceled ?? 0)],
      ["Recusados", Number(t.refused ?? 0)],
      ["No local", Number(t.byType?.dine_in ?? 0)],
      ["Retirada", Number(t.byType?.pickup ?? 0)],
      ["Delivery", Number(t.byType?.delivery ?? 0)],
      ["Clientes atendidos", Number(t.customers ?? 0)],
      [],
      ["Financeiro (R$)"],
      ["Bruto", csvNum(t.gross)],
      ["Taxas de entrega", csvNum(t.deliveryFees)],
      ["Cancelamentos", csvNum(t.canceledSum)],
      ["Líquido", csvNum(t.net)],
      ["Ticket médio", csvNum(t.ticket)],
      [],
      ["Formas de pagamento", "Esperado (R$)", "Informado (R$)", "Diferença (R$)", "Pedidos"],
      ...(c.data ?? []).map((p: any) => [
        PAYMENT_LABEL[p.payment_method] ?? p.payment_method,
        csvNum(p.expected), csvNum(p.informed), csvNum(p.diff), Number(p.orders_count ?? 0),
      ]),
    ];

    if ((m.data ?? []).length > 0) {
      rows.push([], ["Movimentações", "Tipo", "Valor (R$)", "Descrição"]);
      (m.data ?? []).forEach((mv: any) =>
        rows.push([csvDate(mv.created_at), mv.movement_type, csvNum(mv.amount), mv.description ?? ""]),
      );
    }

    rows.push(
      [],
      ["Caixa (R$)"],
      ["Esperado", csvNum(s.expected_cash)],
      ["Informado", csvNum(s.informed_cash)],
      ["Diferença", csvNum(s.cash_diff)],
    );
    if (s.divergence_justification) rows.push([], ["Justificativa da divergência", s.divergence_justification]);
    if (s.pending_orders_justification) rows.push([], ["Pedidos em andamento", s.pending_orders_justification]);
    if (s.notes) rows.push([], ["Observações", s.notes]);

    const csv = "\uFEFF" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expediente-${format(new Date(s.opened_at), "yyyy-MM-dd")}-${s.id.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AdminLayout>
      <PageShell className="max-w-5xl">
        <Button variant="ghost" size="sm" asChild className="w-fit -ml-2 rounded-xl">
          <Link to="/expediente"><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Link>
        </Button>
        <PageHeader emoji="📚" title="Histórico de expedientes" subtitle="Consulte fechamentos anteriores e seus resultados." />

        <div className="glass-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="p-3">Data</th>
                <th className="p-3">Abertura</th>
                <th className="p-3">Encerramento</th>
                <th className="p-3">Responsável</th>
                <th className="p-3 text-right">Líquido</th>
                <th className="p-3 text-right">Diferença</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {shifts.length === 0 && (
                <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Nenhum expediente registrado ainda.</td></tr>
              )}
              {shifts.map((s) => {
                const totals = (s.totals as any) || {};
                const hasDiv = Math.abs(Number(s.cash_diff || 0)) > 0.01;
                return (
                  <tr key={s.id} className="border-b border-border/40 hover:bg-secondary/30">
                    <td className="p-3">{format(new Date(s.opened_at), "dd/MM/yyyy", { locale: ptBR })}</td>
                    <td className="p-3">{format(new Date(s.opened_at), "HH:mm")}</td>
                    <td className="p-3">{s.financial_closed_at ? format(new Date(s.financial_closed_at), "HH:mm") : "—"}</td>
                    <td className="p-3">{s.responsible_name ?? "—"}</td>
                    <td className="p-3 text-right">{fmtBRL(Number(totals.net ?? 0))}</td>
                    <td className={`p-3 text-right ${hasDiv ? "text-amber-400" : "text-emerald-400"}`}>{fmtBRL(Number(s.cash_diff ?? 0))}</td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        s.status === "financial_closed" ? "bg-emerald-500/15 text-emerald-400"
                        : s.status === "reopened" ? "bg-amber-500/15 text-amber-400"
                        : s.status === "service_closed" ? "bg-blue-500/15 text-blue-400"
                        : "bg-secondary text-muted-foreground"}`}>
                        {s.status === "open" ? "Aberto" : s.status === "service_closed" ? "Atendimento encerrado"
                          : s.status === "financial_closed" ? "Fechado" : "Reaberto"}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-1 whitespace-nowrap">
                      <Button size="sm" variant="ghost" asChild title="Ver pedidos deste expediente">
                        <Link to={`/orders?shift=${s.id}`}><ListOrdered className="w-4 h-4" /></Link>
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openDetail(s)}><FileText className="w-4 h-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => exportCSV(s)}><Download className="w-4 h-4" /></Button>
                      {isOwner && s.status === "financial_closed" && (
                        <Button size="sm" variant="ghost" onClick={() => reopen(s)}><RefreshCw className="w-4 h-4" /></Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </PageShell>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Relatório do expediente</DialogTitle></DialogHeader>
          {detail && (() => {
            const s: ShiftRow = detail.shift;
            const t = (s.totals as any) || {};
            return (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <Info label="Abertura" value={format(new Date(s.opened_at), "dd/MM/yyyy HH:mm", { locale: ptBR })} />
                  <Info label="Encerramento atendimento" value={s.service_closed_at ? format(new Date(s.service_closed_at), "dd/MM HH:mm") : "—"} />
                  <Info label="Fechamento financeiro" value={s.financial_closed_at ? format(new Date(s.financial_closed_at), "dd/MM HH:mm") : "—"} />
                  <Info label="Responsável" value={s.responsible_name ?? "—"} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Info label="Total de pedidos" value={String(t.total ?? 0)} />
                  <Info label="Concluídos" value={String(t.completed ?? 0)} />
                  <Info label="Cancelados" value={String(t.canceled ?? 0)} />
                  <Info label="Bruto" value={fmtBRL(Number(t.gross ?? 0))} />
                  <Info label="Taxas de entrega" value={fmtBRL(Number(t.deliveryFees ?? 0))} />
                  <Info label="Ticket médio" value={fmtBRL(Number(t.ticket ?? 0))} />
                </div>
                <div>
                  <div className="font-semibold mb-1">Por forma de pagamento</div>
                  <div className="space-y-1">
                    {detail.counts.map((c: any) => (
                      <div key={c.id} className="flex justify-between">
                        <span>{PAYMENT_LABEL[c.payment_method] ?? c.payment_method}</span>
                        <span className="tabular-nums">{fmtBRL(Number(c.informed))} <span className="text-muted-foreground text-xs">(esp. {fmtBRL(Number(c.expected))})</span></span>
                      </div>
                    ))}
                  </div>
                </div>
                {detail.movements.length > 0 && (
                  <div>
                    <div className="font-semibold mb-1">Movimentações</div>
                    {detail.movements.map((m: any) => (
                      <div key={m.id} className="flex justify-between">
                        <span className="capitalize">{m.movement_type} — {m.description ?? ""}</span>
                        <span>{fmtBRL(Number(m.amount))}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2 border-t border-border pt-3">
                  <Info label="Esperado" value={fmtBRL(Number(s.expected_cash))} />
                  <Info label="Informado" value={fmtBRL(Number(s.informed_cash))} />
                  <Info label="Diferença" value={fmtBRL(Number(s.cash_diff))} />
                </div>
                {s.divergence_justification && <Info label="Justificativa da divergência" value={s.divergence_justification} />}
                {s.pending_orders_justification && <Info label="Pedidos em andamento" value={s.pending_orders_justification} />}
                {s.notes && <Info label="Observações" value={s.notes} />}
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => window.print()}>Imprimir</Button>
                  <Button className="flex-1" onClick={() => generateShiftReportPDF(detail)}>Baixar PDF</Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

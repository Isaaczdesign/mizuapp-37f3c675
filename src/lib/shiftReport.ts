import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { fmtBRL, PAYMENT_LABEL, type ShiftRow } from "./shiftUtils";

interface ReportData {
  shift: ShiftRow;
  counts: any[];
  movements: any[];
  restaurant?: { name?: string; address?: string | null; slug?: string | null } | null;
}

export function generateShiftReportPDF(data: ReportData) {
  const s = data.shift;
  const t = (s.totals as any) || {};
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  let y = 15;
  const line = (h = 6) => { y += h; };
  const h1 = (txt: string) => { doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.text(txt, 15, y); line(7); };
  const h2 = (txt: string) => { doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text(txt, 15, y); line(6); };
  const row = (l: string, r: string) => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    doc.text(l, 15, y); doc.text(r, W - 15, y, { align: "right" }); line(5);
  };
  const sep = () => { doc.setLineDashPattern([0.5, 0.5], 0); doc.line(15, y, W - 15, y); doc.setLineDashPattern([], 0); line(3); };

  h1(`Relatório de Encerramento — ${data.restaurant?.name ?? ""}`);
  row("Abertura", format(new Date(s.opened_at), "dd/MM/yyyy HH:mm", { locale: ptBR }));
  row("Encerramento atendimento", s.service_closed_at ? format(new Date(s.service_closed_at), "dd/MM/yyyy HH:mm") : "—");
  row("Fechamento financeiro", s.financial_closed_at ? format(new Date(s.financial_closed_at), "dd/MM/yyyy HH:mm") : "—");
  row("Responsável", s.responsible_name ?? "—");
  sep();

  h2("Resumo de pedidos");
  row("Total", String(t.total ?? 0));
  row("Concluídos", String(t.completed ?? 0));
  row("Cancelados", String(t.canceled ?? 0));
  row("Recusados", String(t.refused ?? 0));
  row("No local / Retirada / Delivery", `${t.byType?.dine_in ?? 0} / ${t.byType?.pickup ?? 0} / ${t.byType?.delivery ?? 0}`);
  sep();

  h2("Financeiro");
  row("Bruto", fmtBRL(Number(t.gross ?? 0)));
  row("Taxas de entrega", fmtBRL(Number(t.deliveryFees ?? 0)));
  row("Cancelamentos", fmtBRL(Number(t.canceledSum ?? 0)));
  row("Líquido", fmtBRL(Number(t.net ?? 0)));
  row("Ticket médio", fmtBRL(Number(t.ticket ?? 0)));
  row("Clientes atendidos", String(t.customers ?? 0));
  sep();

  h2("Por forma de pagamento");
  data.counts.forEach((c) => {
    row(PAYMENT_LABEL[c.payment_method] ?? c.payment_method, `${fmtBRL(Number(c.informed))} (esp. ${fmtBRL(Number(c.expected))})`);
  });
  sep();

  if (data.movements.length > 0) {
    h2("Movimentações");
    data.movements.forEach((m) => row(`${m.movement_type} — ${m.description ?? ""}`, fmtBRL(Number(m.amount))));
    sep();
  }

  h2("Caixa");
  row("Esperado", fmtBRL(Number(s.expected_cash)));
  row("Informado", fmtBRL(Number(s.informed_cash)));
  row("Diferença", fmtBRL(Number(s.cash_diff)));

  if (s.divergence_justification) { line(3); h2("Justificativa da divergência"); doc.setFontSize(9); doc.text(doc.splitTextToSize(s.divergence_justification, W - 30), 15, y); }
  if (s.pending_orders_justification) { line(6); h2("Pedidos em andamento"); doc.setFontSize(9); doc.text(doc.splitTextToSize(s.pending_orders_justification, W - 30), 15, y); }
  if (s.notes) { line(6); h2("Observações"); doc.setFontSize(9); doc.text(doc.splitTextToSize(s.notes, W - 30), 15, y); }

  doc.save(`expediente-${s.id.slice(0, 8)}.pdf`);
}

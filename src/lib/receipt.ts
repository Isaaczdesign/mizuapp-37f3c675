import { jsPDF } from "jspdf";

export interface ReceiptOrder {
  id: string;
  total: number;
  created_at: string;
  notes: string | null;
  order_items: { name: string; quantity: number; unit_price: number; notes: string | null }[];
  restaurant_tables?: { number: number } | null;
  customers?: { name: string; whatsapp: string } | null;
}

export interface ReceiptRestaurant {
  name: string;
  slug?: string | null;
  address?: string | null;
  phone?: string | null;
}

export function generateReceiptPDF(order: ReceiptOrder, restaurant: ReceiptRestaurant) {
  // 80mm thermal-style page (80mm x dynamic height)
  const width = 80;
  const doc = new jsPDF({ unit: "mm", format: [width, 200] });
  let y = 8;
  const line = (h = 5) => { y += h; };
  const center = (txt: string, size = 10, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.text(txt, width / 2, y, { align: "center" });
  };
  const row = (l: string, r: string, size = 9) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.text(l, 4, y);
    doc.text(r, width - 4, y, { align: "right" });
  };
  const sep = () => {
    doc.setLineDashPattern([0.5, 0.5], 0);
    doc.line(4, y, width - 4, y);
    doc.setLineDashPattern([], 0);
    line(2);
  };

  center(restaurant.name, 12, true); line();
  if (restaurant.address) { center(restaurant.address, 8); line(4); }
  if (restaurant.phone) { center(restaurant.phone, 8); line(4); }
  center("RECIBO NÃO FISCAL", 8, true); line(4);
  sep();

  row("Pedido:", `#${order.id.slice(0, 8)}`); line();
  row("Data:", new Date(order.created_at).toLocaleString("pt-BR")); line();
  if (order.restaurant_tables) { row("Mesa:", String(order.restaurant_tables.number)); line(); }
  if (order.customers) {
    row("Cliente:", order.customers.name); line();
    row("WhatsApp:", order.customers.whatsapp); line();
  }
  sep();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Item", 4, y);
  doc.text("Total", width - 4, y, { align: "right" });
  line(1); sep();

  order.order_items.forEach((it) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const name = `${it.quantity}x ${it.name}`;
    const total = (it.quantity * Number(it.unit_price)).toFixed(2);
    const wrapped = doc.splitTextToSize(name, width - 22);
    doc.text(wrapped, 4, y);
    doc.text(`R$ ${total}`, width - 4, y, { align: "right" });
    y += wrapped.length * 4;
    if (it.notes) {
      doc.setFontSize(7);
      doc.setTextColor(100);
      doc.text(`  obs: ${it.notes}`, 4, y);
      doc.setTextColor(0);
      line(3);
    }
  });
  line(1); sep();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  row("TOTAL", `R$ ${Number(order.total).toFixed(2)}`, 11); line(6);

  if (order.notes) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    const notes = doc.splitTextToSize(`Obs: ${order.notes}`, width - 8);
    doc.text(notes, 4, y);
    y += notes.length * 4;
  }

  line(4);
  center("Obrigado pela preferência!", 8); line();
  center("Documento sem valor fiscal", 7);

  doc.save(`recibo-${order.id.slice(0, 8)}.pdf`);
}

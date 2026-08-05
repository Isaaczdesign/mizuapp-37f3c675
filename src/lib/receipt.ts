import type { jsPDF } from "jspdf";
import { paymentMethodLabel } from "@/lib/paymentMethods";
import { orderRef } from "@/lib/orderNumber";

export interface ReceiptOrder {
  id: string;
  order_number?: number | null;
  total: number;
  created_at: string;
  notes: string | null;
  order_items: { name: string; quantity: number; unit_price: number; notes: string | null }[];
  restaurant_tables?: { number: number } | null;
  customers?: { name: string; whatsapp: string } | null;
  order_type?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  delivery_fee?: number | null;
  delivery_address?: any;
}

export interface ReceiptRestaurant {
  name: string;
  slug?: string | null;
  address?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
}

const ORDER_TYPE_LABEL: Record<string, string> = {
  dine_in: "No local",
  pickup: "Retirada",
  delivery: "Delivery",
};

/** Carrega uma imagem remota como dataURL (para embutir no PDF). */
async function loadImage(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const data = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
    const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = reject;
      img.src = data;
    });
    return { data, ...dims };
  } catch {
    return null;
  }
}

const W = 80; // largura térmica 80mm
const M = 5; // margem
const INNER = W - M * 2;

type Logo = { data: string; w: number; h: number } | null;

/** Desenha o cupom e devolve a altura final usada (mm). */
function render(doc: jsPDF, order: ReceiptOrder, restaurant: ReceiptRestaurant, logo: Logo): number {
  let y = M;

  const setF = (size: number, style: "normal" | "bold" | "italic" = "normal") => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
  };

  const center = (txt: string, size = 9, style: "normal" | "bold" | "italic" = "normal", lh = 4) => {
    setF(size, style);
    const lines = doc.splitTextToSize(txt, INNER) as string[];
    lines.forEach((l) => {
      doc.text(l, W / 2, y, { align: "center" });
      y += lh;
    });
  };

  const row = (l: string, r: string, size = 8, style: "normal" | "bold" = "normal", lh = 4) => {
    setF(size, style);
    const rw = doc.getTextWidth(r);
    const lines = doc.splitTextToSize(l, INNER - rw - 3) as string[];
    doc.text(lines[0], M, y);
    doc.text(r, W - M, y, { align: "right" });
    y += lh;
    lines.slice(1).forEach((l2) => {
      doc.text(l2, M, y);
      y += lh;
    });
  };

  const wrapped = (txt: string, size = 7, style: "normal" | "italic" = "normal", lh = 3.4) => {
    setF(size, style);
    const lines = doc.splitTextToSize(txt, INNER) as string[];
    lines.forEach((l) => {
      doc.text(l, M, y);
      y += lh;
    });
  };

  const sep = (dashed = true, gap = 3) => {
    y += 1;
    doc.setDrawColor(150);
    doc.setLineWidth(0.2);
    if (dashed) doc.setLineDashPattern([0.6, 0.6], 0);
    doc.line(M, y, W - M, y);
    doc.setLineDashPattern([], 0);
    doc.setDrawColor(0);
    y += gap;
  };

  // ---------- Cabeçalho ----------
  if (logo) {
    const maxW = 28;
    const maxH = 20;
    const ratio = logo.w / logo.h;
    let lw = maxW;
    let lh = lw / ratio;
    if (lh > maxH) {
      lh = maxH;
      lw = lh * ratio;
    }
    try {
      doc.addImage(logo.data, (W - lw) / 2, y, lw, lh);
      y += lh + 3;
    } catch {
      /* ignora logo inválida */
    }
  }

  center(restaurant.name, 12, "bold", 5);
  if (restaurant.address) center(restaurant.address, 7, "normal", 3.4);
  if (restaurant.phone) center(`Tel: ${restaurant.phone}`, 7, "normal", 3.4);
  y += 1;
  center("DOCUMENTO AUXILIAR DE VENDA", 7.5, "bold", 3.6);
  center("Sem valor fiscal", 6.5, "normal", 3.4);
  sep();

  // ---------- Dados do pedido ----------
  row("Pedido", orderRef(order), 8, "bold");
  row("Data", new Date(order.created_at).toLocaleString("pt-BR"));
  if (order.order_type) row("Modalidade", ORDER_TYPE_LABEL[order.order_type] ?? order.order_type);
  if (order.restaurant_tables) row("Mesa", String(order.restaurant_tables.number));
  if (order.customers) {
    row("Cliente", order.customers.name);
    row("WhatsApp", order.customers.whatsapp);
  }
  if (order.delivery_address) {
    const a = order.delivery_address as any;
    const parts = [a.street, a.number, a.complement, a.neighborhood, a.city, a.cep].filter(Boolean);
    if (parts.length) {
      setF(8, "bold");
      doc.text("Entrega", M, y);
      y += 4;
      wrapped(parts.join(", "), 7);
    }
  }
  sep();

  // ---------- Itens ----------
  setF(8, "bold");
  doc.text("QTD  ITEM", M, y);
  doc.text("VALOR", W - M, y, { align: "right" });
  y += 3.5;
  sep(true, 2.5);

  let subtotal = 0;
  order.order_items.forEach((it) => {
    const qty = Number(it.quantity) || 0;
    const unit = Number(it.unit_price) || 0;
    const lineTotal = qty * unit;
    subtotal += lineTotal;

    const price = `R$ ${lineTotal.toFixed(2)}`;
    setF(8, "normal");
    const pw = doc.getTextWidth(price);
    const nameLines = doc.splitTextToSize(`${qty}x ${it.name}`, INNER - pw - 3) as string[];
    doc.text(nameLines[0], M, y);
    doc.text(price, W - M, y, { align: "right" });
    y += 3.8;
    nameLines.slice(1).forEach((l) => {
      doc.text(l, M, y);
      y += 3.8;
    });

    if (qty > 1) {
      setF(6.5, "italic");
      doc.setTextColor(110);
      doc.text(`   un. R$ ${unit.toFixed(2)}`, M, y);
      doc.setTextColor(0);
      y += 3.2;
    }
    if (it.notes) {
      setF(6.5, "italic");
      doc.setTextColor(110);
      const obs = doc.splitTextToSize(`   obs: ${it.notes}`, INNER) as string[];
      obs.forEach((l) => {
        doc.text(l, M, y);
        y += 3.2;
      });
      doc.setTextColor(0);
    }
    y += 1;
  });

  sep();

  // ---------- Totais ----------
  const fee = Number(order.delivery_fee ?? 0);
  const total = Number(order.total) || 0;
  const discount = Math.max(0, subtotal + fee - total);

  row("Subtotal", `R$ ${subtotal.toFixed(2)}`, 8);
  if (fee > 0) row("Taxa de entrega", `R$ ${fee.toFixed(2)}`, 8);
  if (discount > 0.009) row("Desconto", `- R$ ${discount.toFixed(2)}`, 8);
  y += 1;
  row("TOTAL", `R$ ${total.toFixed(2)}`, 11, "bold", 6);

  if (order.payment_method) {
    row("Pagamento", paymentMethodLabel(order.payment_method, order.order_type), 8);
  }
  if (order.payment_status) {
    row("Status", order.payment_status === "paid" ? "Pago" : order.payment_status === "pending" ? "Pendente" : order.payment_status, 8);
  }

  if (order.notes) {
    sep();
    setF(8, "bold");
    doc.text("Observações", M, y);
    y += 4;
    wrapped(order.notes, 7, "italic");
  }

  sep();
  y += 1;
  center("Obrigado pela preferência!", 8, "bold", 4);
  if (restaurant.slug) center(`Peça de novo: /${restaurant.slug}`, 6.5, "normal", 3.4);
  center("Documento sem valor fiscal", 6, "normal", 3.4);

  return y + M;
}

async function build(order: ReceiptOrder, restaurant: ReceiptRestaurant): Promise<jsPDF> {
  const { jsPDF } = await import("jspdf");
  const logo = restaurant.logoUrl ? await loadImage(restaurant.logoUrl) : null;

  // 1ª passada: medir a altura necessária
  const probe = new jsPDF({ unit: "mm", format: [W, 600] });
  const height = render(probe, order, restaurant, logo);

  // 2ª passada: documento no tamanho exato
  const doc = new jsPDF({ unit: "mm", format: [W, Math.max(60, height)] });
  render(doc, order, restaurant, logo);
  return doc;
}

export async function generateReceiptPDF(order: ReceiptOrder, restaurant: ReceiptRestaurant) {
  const doc = await build(order, restaurant);
  doc.save(`nota-${orderRef(order).replace("#", "")}.pdf`);
}

/** Abre a caixa de impressão do navegador com o cupom pronto. */
export async function printReceiptPDF(order: ReceiptOrder, restaurant: ReceiptRestaurant) {
  const doc = await build(order, restaurant);
  const url = doc.output("bloburl") as unknown as string;
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  frame.src = url;
  document.body.appendChild(frame);
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      window.open(url, "_blank");
    }
    setTimeout(() => frame.remove(), 60000);
  };
}

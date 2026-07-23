import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { X, Plus, Minus, Search, UtensilsCrossed, ShoppingBag, Truck } from "lucide-react";

interface OrderItemRow {
  id?: string;
  menu_item_id?: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  notes?: string | null;
}

interface EditingOrder {
  id: string;
  restaurant_id?: string;
  order_type: string;
  notes: string | null;
  payment_method: string | null;
  delivery_fee: number;
  delivery_address: any;
  table_id: string | null;
  order_items: OrderItemRow[];
}

interface Props {
  restaurantId: string;
  order: EditingOrder;
  onClose: () => void;
  onSaved: () => void;
}

interface MenuItem { id: string; name: string; price: number; category_id: string | null }
interface Category { id: string; name: string }
interface TableRow { id: string; number: number }

type OrderType = "dine_in" | "pickup" | "delivery";

export default function EditOrderModal({ restaurantId, order, onClose, onSaved }: Props) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [cart, setCart] = useState<OrderItemRow[]>(
    order.order_items.map((oi) => ({ ...oi }))
  );
  const [orderType, setOrderType] = useState<OrderType>((order.order_type as OrderType) || "dine_in");
  const [tableId, setTableId] = useState<string>(order.table_id ?? "");
  const [payment, setPayment] = useState(order.payment_method ?? "cash");
  const [notes, setNotes] = useState(order.notes ?? "");
  const [deliveryFee, setDeliveryFee] = useState<number>(Number(order.delivery_fee ?? 0));
  const initialAddress = (() => {
    const a = order.delivery_address;
    if (!a) return { street: "", number: "", neighborhood: "", city: "", cep: "", complement: "" };
    if (typeof a === "string") {
      try { return { street: "", number: "", neighborhood: "", city: "", cep: "", complement: "", ...JSON.parse(a) }; }
      catch { return { street: a, number: "", neighborhood: "", city: "", cep: "", complement: "" }; }
    }
    return { street: "", number: "", neighborhood: "", city: "", cep: "", complement: "", ...a };
  })();
  const [address, setAddress] = useState(initialAddress);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const [mi, mc, tb] = await Promise.all([
        supabase.from("menu_items").select("id, name, price, category_id").eq("restaurant_id", restaurantId).eq("is_active", true).order("sort_order"),
        supabase.from("menu_categories").select("id, name").eq("restaurant_id", restaurantId).order("sort_order"),
        supabase.from("restaurant_tables").select("id, number").eq("restaurant_id", restaurantId).eq("is_active", true).order("number"),
      ]);
      setItems((mi.data ?? []) as MenuItem[]);
      setCats((mc.data ?? []) as Category[]);
      setTables((tb.data ?? []) as TableRow[]);
    })();
  }, [restaurantId]);

  const filtered = useMemo(() => items.filter(i =>
    (activeCat === "all" || i.category_id === activeCat) &&
    (!search || i.name.toLowerCase().includes(search.toLowerCase()))
  ), [items, activeCat, search]);

  const subtotal = cart.reduce((s, i) => s + Number(i.unit_price) * i.quantity, 0);
  const total = subtotal + (orderType === "delivery" ? Number(deliveryFee) : 0);

  function addMenu(mi: MenuItem) {
    setCart((c) => {
      const idx = c.findIndex((x) => x.menu_item_id === mi.id);
      if (idx >= 0) {
        const next = [...c];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...c, { menu_item_id: mi.id, name: mi.name, quantity: 1, unit_price: Number(mi.price) }];
    });
  }
  function changeQty(i: number, delta: number) {
    setCart((c) => {
      const next = [...c];
      const q = next[i].quantity + delta;
      if (q <= 0) next.splice(i, 1); else next[i] = { ...next[i], quantity: q };
      return next;
    });
  }
  function removeLine(i: number) {
    setCart((c) => c.filter((_, idx) => idx !== i));
  }

  async function save() {
    if (cart.length === 0) { toast.error("O pedido precisa ter pelo menos 1 item"); return; }
    if (orderType === "dine_in" && !tableId) { toast.error("Selecione a mesa antes de salvar"); return; }
    if (orderType === "delivery") {
      const missing: string[] = [];
      if (!address.street) missing.push("Rua");
      if (!address.number) missing.push("Número");
      if (!address.neighborhood) missing.push("Bairro");
      if (!address.city) missing.push("Cidade");
      if (missing.length) { toast.error(`Endereço incompleto: ${missing.join(", ")}`); return; }
    }
    if (!payment) { toast.error("Selecione a forma de pagamento"); return; }

    const summary = `Confirmar alterações no pedido?\n\n• ${cart.length} item(ns)\n• Total: R$${total.toFixed(2)}\n• Tipo: ${orderType === "dine_in" ? "No local" : orderType === "pickup" ? "Retirada" : "Delivery"}\n• Pagamento: ${payment}\n\nO cliente será notificado no WhatsApp.`;
    if (!window.confirm(summary)) return;

    setSubmitting(true);
    try {
      const patch: any = {
        order_type: orderType,
        notes: notes || null,
        payment_method: payment,
        delivery_fee: orderType === "delivery" ? Number(deliveryFee) : 0,
        delivery_address: orderType === "delivery" ? address : null,
        table_id: orderType === "dine_in" ? tableId : null,
        total,
      };
      const { error: uErr } = await supabase.from("orders").update(patch).eq("id", order.id);
      if (uErr) throw uErr;

      // Replace order_items: delete existing then insert current cart.
      const { error: dErr } = await supabase.from("order_items").delete().eq("order_id", order.id);
      if (dErr) throw dErr;
      const rows = cart.map((it) => ({
        order_id: order.id,
        menu_item_id: it.menu_item_id ?? null,
        name: it.name,
        quantity: it.quantity,
        unit_price: it.unit_price,
        notes: it.notes ?? null,
      }));
      const { error: iErr } = await supabase.from("order_items").insert(rows);
      if (iErr) throw iErr;

      toast.success("Pedido atualizado!");

      // Notify customer via WhatsApp about the edit (non-blocking)
      supabase.functions.invoke("send-order-whatsapp", {
        body: { order_id: order.id, event: "edited" },
      }).then(({ error: fnErr }) => {
        if (fnErr) toast.error("Falha ao notificar cliente no WhatsApp");
        else toast.success("📱 Cliente notificado no WhatsApp");
      });

      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar pedido");
    } finally {
      setSubmitting(false);
    }
  }

  const typeOptions: { key: OrderType; label: string; icon: any }[] = [
    { key: "dine_in", label: "No local", icon: UtensilsCrossed },
    { key: "pickup", label: "Retirada", icon: ShoppingBag },
    { key: "delivery", label: "Delivery", icon: Truck },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-card w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-display text-lg font-bold">✏️ Editar pedido #{order.id.slice(0, 6)}</h2>
          <button onClick={onClose} className="p-1"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 grid md:grid-cols-[1fr_360px] gap-0 overflow-hidden">
          {/* Menu picker */}
          <div className="flex flex-col overflow-hidden border-r border-border">
            <div className="p-3 space-y-2 border-b border-border">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  className="w-full bg-secondary rounded-lg pl-9 pr-3 py-2 text-sm"
                  placeholder="Adicionar item ao pedido..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-1.5 overflow-x-auto">
                <button onClick={() => setActiveCat("all")} className={`px-3 py-1 rounded-full text-xs whitespace-nowrap ${activeCat === "all" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>Todos</button>
                {cats.map(c => (
                  <button key={c.id} onClick={() => setActiveCat(c.id)} className={`px-3 py-1 rounded-full text-xs whitespace-nowrap ${activeCat === c.id ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{c.name}</button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 content-start">
              {filtered.map(it => (
                <div key={it.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{it.name}</p>
                    <p className="text-xs text-primary">R${Number(it.price).toFixed(2)}</p>
                  </div>
                  <button onClick={() => addMenu(it)} className="p-1.5 rounded-lg bg-primary text-primary-foreground"><Plus className="w-4 h-4" /></button>
                </div>
              ))}
              {filtered.length === 0 && <p className="text-xs text-muted-foreground col-span-full text-center py-6">Nenhum item</p>}
            </div>
          </div>

          {/* Sidebar: config + cart */}
          <div className="flex flex-col overflow-y-auto p-3 gap-3 max-h-[50vh] md:max-h-none">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Itens do pedido</label>
              <div className="mt-1 space-y-1">
                {cart.length === 0 && <p className="text-xs text-muted-foreground">Nenhum item</p>}
                {cart.map((line, i) => (
                  <div key={i} className="flex items-center gap-1 p-1.5 rounded-lg bg-secondary/40">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{line.name}</p>
                      <p className="text-[10px] text-muted-foreground">R${Number(line.unit_price).toFixed(2)} · {line.quantity}x</p>
                    </div>
                    <button onClick={() => changeQty(i, -1)} className="p-1 rounded bg-background"><Minus className="w-3 h-3" /></button>
                    <span className="text-xs w-5 text-center">{line.quantity}</span>
                    <button onClick={() => changeQty(i, +1)} className="p-1 rounded bg-primary text-primary-foreground"><Plus className="w-3 h-3" /></button>
                    <button onClick={() => removeLine(i)} className="p-1 rounded bg-destructive/20 text-destructive"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Tipo</label>
              <div className="grid grid-cols-3 gap-1 mt-1">
                {typeOptions.map(t => {
                  const Icon = t.icon;
                  return (
                    <button key={t.key} onClick={() => setOrderType(t.key)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-[11px] ${orderType === t.key ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary"}`}>
                      <Icon className="w-4 h-4" />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {orderType === "dine_in" && (
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Mesa</label>
                <select value={tableId} onChange={e => setTableId(e.target.value)} className="w-full bg-secondary rounded-lg px-2 py-2 text-sm mt-1">
                  <option value="">Selecione…</option>
                  {tables.map(t => <option key={t.id} value={t.id}>Mesa {t.number}</option>)}
                </select>
              </div>
            )}

            {orderType === "delivery" && (
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Endereço</label>
                <div className="grid grid-cols-3 gap-1">
                  <input className="col-span-2 bg-secondary rounded-lg px-2 py-1.5 text-sm" placeholder="Rua" value={address.street ?? ""} onChange={e => setAddress({ ...address, street: e.target.value })} />
                  <input className="bg-secondary rounded-lg px-2 py-1.5 text-sm" placeholder="Nº" value={address.number ?? ""} onChange={e => setAddress({ ...address, number: e.target.value })} />
                </div>
                <input className="w-full bg-secondary rounded-lg px-2 py-1.5 text-sm" placeholder="Complemento" value={address.complement ?? ""} onChange={e => setAddress({ ...address, complement: e.target.value })} />
                <div className="grid grid-cols-2 gap-1">
                  <input className="bg-secondary rounded-lg px-2 py-1.5 text-sm" placeholder="Bairro" value={address.neighborhood ?? ""} onChange={e => setAddress({ ...address, neighborhood: e.target.value })} />
                  <input className="bg-secondary rounded-lg px-2 py-1.5 text-sm" placeholder="Cidade" value={address.city ?? ""} onChange={e => setAddress({ ...address, city: e.target.value })} />
                </div>
                <input className="w-full bg-secondary rounded-lg px-2 py-1.5 text-sm" placeholder="CEP" value={address.cep ?? ""} onChange={e => setAddress({ ...address, cep: e.target.value })} />
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Taxa de entrega (R$)</label>
                  <input type="number" step="0.01" min={0} className="w-full bg-secondary rounded-lg px-2 py-1.5 text-sm mt-1" value={deliveryFee} onChange={e => setDeliveryFee(Number(e.target.value) || 0)} />
                </div>
              </div>
            )}

            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Pagamento</label>
              <select value={payment ?? "cash"} onChange={e => setPayment(e.target.value)} className="w-full bg-secondary rounded-lg px-2 py-2 text-sm mt-1">
                <option value="cash">Dinheiro</option>
                <option value="card">Cartão (maquininha)</option>
                <option value="pix">PIX</option>
                <option value="other">Outro</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Observações</label>
              <textarea className="w-full bg-secondary rounded-lg px-2 py-1.5 text-sm mt-1" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
            </div>

            <div className="border-t border-border pt-2 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>R${subtotal.toFixed(2)}</span></div>
              {orderType === "delivery" && (
                <div className="flex justify-between"><span className="text-muted-foreground">Entrega</span><span>R${Number(deliveryFee).toFixed(2)}</span></div>
              )}
              <div className="flex justify-between font-display font-bold text-base">
                <span>Total</span><span className="gradient-text">R${total.toFixed(2)}</span>
              </div>
            </div>

            <Button variant="hero" className="w-full" disabled={submitting} onClick={save}>
              {submitting ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

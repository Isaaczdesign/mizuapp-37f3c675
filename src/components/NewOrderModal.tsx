import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { X, Plus, Minus, Search, UtensilsCrossed, ShoppingBag, Truck } from "lucide-react";

interface Props {
  restaurantId: string;
  onClose: () => void;
  onCreated: () => void;
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category_id: string | null;
  is_active: boolean;
}
interface Category { id: string; name: string }
interface TableRow { id: string; number: number }

type OrderType = "dine_in" | "pickup" | "delivery";

export default function NewOrderModal({ restaurantId, onClose, onCreated }: Props) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [orderType, setOrderType] = useState<OrderType>("dine_in");
  const [tableId, setTableId] = useState<string>("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [payment, setPayment] = useState("cash");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");
  const [submitting, setSubmitting] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [address, setAddress] = useState({ street: "", number: "", neighborhood: "", city: "", cep: "", complement: "" });

  useEffect(() => {
    (async () => {
      const [mi, mc, tb, rs] = await Promise.all([
        supabase.from("menu_items").select("id, name, price, category_id, is_active").eq("restaurant_id", restaurantId).eq("is_active", true).order("sort_order"),
        supabase.from("menu_categories").select("id, name").eq("restaurant_id", restaurantId).order("sort_order"),
        supabase.from("restaurant_tables").select("id, number").eq("restaurant_id", restaurantId).eq("is_active", true).order("number"),
        supabase.from("restaurants").select("delivery_fee").eq("id", restaurantId).maybeSingle(),
      ]);
      setItems((mi.data ?? []) as MenuItem[]);
      setCats((mc.data ?? []) as Category[]);
      setTables((tb.data ?? []) as TableRow[]);
      setDeliveryFee(Number((rs.data as any)?.delivery_fee ?? 0));
    })();
  }, [restaurantId]);

  const filtered = useMemo(() => {
    return items.filter(i =>
      (activeCat === "all" || i.category_id === activeCat) &&
      (!search || i.name.toLowerCase().includes(search.toLowerCase()))
    );
  }, [items, activeCat, search]);

  const subtotal = useMemo(() =>
    Object.entries(cart).reduce((sum, [id, qty]) => {
      const it = items.find(x => x.id === id);
      return sum + (it ? Number(it.price) * qty : 0);
    }, 0), [cart, items]);

  const total = subtotal + (orderType === "delivery" ? deliveryFee : 0);

  function add(id: string) { setCart(c => ({ ...c, [id]: (c[id] ?? 0) + 1 })); }
  function sub(id: string) {
    setCart(c => {
      const q = (c[id] ?? 0) - 1;
      const next = { ...c };
      if (q <= 0) delete next[id]; else next[id] = q;
      return next;
    });
  }

  async function submit() {
    if (Object.keys(cart).length === 0) { toast.error("Adicione ao menos um item"); return; }
    if (orderType === "dine_in" && !tableId) { toast.error("Selecione a mesa"); return; }
    if (orderType === "delivery" && (!address.street || !address.number)) { toast.error("Preencha o endereço"); return; }

    setSubmitting(true);
    try {
      let customerId: string | null = null;
      if (customerName.trim() && customerPhone.replace(/\D/g, "").length >= 8) {
        const { data: existing } = await supabase.from("customers")
          .select("id").eq("restaurant_id", restaurantId).eq("whatsapp", customerPhone).maybeSingle();
        if (existing) customerId = existing.id;
        else {
          const { data: nc } = await supabase.from("customers")
            .insert({ restaurant_id: restaurantId, name: customerName, whatsapp: customerPhone })
            .select("id").single();
          customerId = nc?.id ?? null;
        }
      }

      const orderPayload: any = {
        restaurant_id: restaurantId,
        customer_id: customerId,
        total,
        notes: notes || null,
        order_type: orderType,
        payment_method: payment,
        payment_status: null,
        status: "new",
        delivery_fee: orderType === "delivery" ? deliveryFee : 0,
        delivery_address: orderType === "delivery" ? address : null,
        table_id: orderType === "dine_in" ? tableId : null,
      };
      const { data: ord, error } = await supabase.from("orders").insert(orderPayload).select("id").single();
      if (error) throw error;

      const rows = Object.entries(cart).map(([id, qty]) => {
        const it = items.find(x => x.id === id)!;
        return { order_id: ord.id, menu_item_id: id, name: it.name, quantity: qty, unit_price: it.price };
      });
      const { error: iErr } = await supabase.from("order_items").insert(rows);
      if (iErr) throw iErr;

      toast.success("Pedido criado!");
      onCreated();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao criar pedido");
    } finally {
      setSubmitting(false);
    }
  }

  const typeOptions: { key: OrderType; label: string; icon: any }[] = [
    { key: "dine_in", label: "Mesa", icon: UtensilsCrossed },
    { key: "pickup", label: "Balcão/Retirada", icon: ShoppingBag },
    { key: "delivery", label: "Delivery", icon: Truck },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-card w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-display text-lg font-bold">➕ Novo pedido (balcão)</h2>
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
                  placeholder="Buscar item..."
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
              {filtered.map(it => {
                const qty = cart[it.id] ?? 0;
                return (
                  <div key={it.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{it.name}</p>
                      <p className="text-xs text-primary">R${Number(it.price).toFixed(2)}</p>
                    </div>
                    {qty === 0 ? (
                      <button onClick={() => add(it.id)} className="p-1.5 rounded-lg bg-primary text-primary-foreground"><Plus className="w-4 h-4" /></button>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button onClick={() => sub(it.id)} className="p-1 rounded-lg bg-background"><Minus className="w-3.5 h-3.5" /></button>
                        <span className="text-sm font-semibold w-6 text-center">{qty}</span>
                        <button onClick={() => add(it.id)} className="p-1 rounded-lg bg-primary text-primary-foreground"><Plus className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                  </div>
                );
              })}
              {filtered.length === 0 && <p className="text-xs text-muted-foreground col-span-full text-center py-6">Nenhum item</p>}
            </div>
          </div>

          {/* Sidebar: config + cart */}
          <div className="flex flex-col overflow-y-auto p-3 gap-3 max-h-[50vh] md:max-h-none">
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
                  <input className="col-span-2 bg-secondary rounded-lg px-2 py-1.5 text-sm" placeholder="Rua" value={address.street} onChange={e => setAddress({ ...address, street: e.target.value })} />
                  <input className="bg-secondary rounded-lg px-2 py-1.5 text-sm" placeholder="Nº" value={address.number} onChange={e => setAddress({ ...address, number: e.target.value })} />
                </div>
                <input className="w-full bg-secondary rounded-lg px-2 py-1.5 text-sm" placeholder="Complemento" value={address.complement} onChange={e => setAddress({ ...address, complement: e.target.value })} />
                <div className="grid grid-cols-2 gap-1">
                  <input className="bg-secondary rounded-lg px-2 py-1.5 text-sm" placeholder="Bairro" value={address.neighborhood} onChange={e => setAddress({ ...address, neighborhood: e.target.value })} />
                  <input className="bg-secondary rounded-lg px-2 py-1.5 text-sm" placeholder="Cidade" value={address.city} onChange={e => setAddress({ ...address, city: e.target.value })} />
                </div>
                <input className="w-full bg-secondary rounded-lg px-2 py-1.5 text-sm" placeholder="CEP" value={address.cep} onChange={e => setAddress({ ...address, cep: e.target.value })} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Cliente (opcional)</label>
                <input className="w-full bg-secondary rounded-lg px-2 py-1.5 text-sm mt-1" placeholder="Nome" value={customerName} onChange={e => setCustomerName(e.target.value)} />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">WhatsApp</label>
                <input className="w-full bg-secondary rounded-lg px-2 py-1.5 text-sm mt-1" placeholder="(11) 99999-9999" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Pagamento</label>
              <select value={payment} onChange={e => setPayment(e.target.value)} className="w-full bg-secondary rounded-lg px-2 py-2 text-sm mt-1">
                <option value="cash">Dinheiro</option>
                <option value="card">Cartão (maquininha)</option>
                <option value="pix">PIX (no local)</option>
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
                <div className="flex justify-between"><span className="text-muted-foreground">Entrega</span><span>R${deliveryFee.toFixed(2)}</span></div>
              )}
              <div className="flex justify-between font-display font-bold text-base">
                <span>Total</span><span className="gradient-text">R${total.toFixed(2)}</span>
              </div>
            </div>

            <Button variant="hero" className="w-full" disabled={submitting} onClick={submit}>
              {submitting ? "Criando..." : "Criar pedido"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

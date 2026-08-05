import { useMemo, useState } from "react";
import {
  Minus, Plus, ShoppingBag, Bike, Store, Utensils, CreditCard, QrCode, Check, Clock,
  Search, Star, Ticket, MapPin, Banknote, RotateCcw, ChefHat, PackageCheck, Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Demonstração 100% fictícia do cardápio digital (restaurante "Sushi Mizu").
 * Nenhum dado é lido ou gravado no banco — a simulação vive apenas em memória.
 */
const RESTAURANT = {
  name: "Sushi Mizu",
  category: "Japonês · Sushi & Temaki",
  open: true,
  hours: "Ter a Dom · 18h às 23h30",
  eta: "35–50 min",
  minOrder: 40,
  deliveryFee: 8.9,
};

const CATEGORIES = ["Destaques", "Combinados", "Temaki", "Hot Roll", "Bebidas"] as const;

type DemoItem = {
  name: string; desc: string; price: number; emoji: string;
  category: (typeof CATEGORIES)[number]; tag?: string; addons?: { name: string; price: number }[];
};

const ITEMS: DemoItem[] = [
  {
    name: "Combinado Mizu 20 peças", desc: "Salmão, atum, skin e uramaki especial", price: 89.9,
    emoji: "🍣", category: "Combinados", tag: "Mais vendido",
    addons: [{ name: "Cream cheese extra", price: 6 }, { name: "Shoyu premium", price: 5 }, { name: "Gengibre extra", price: 3 }],
  },
  {
    name: "Temaki Salmão Grelhado", desc: "Cone de alga, arroz e salmão maçaricado", price: 34.9,
    emoji: "🌯", category: "Temaki", tag: "Combo",
    addons: [{ name: "Cebolinha", price: 3 }, { name: "Cream cheese", price: 6 }],
  },
  { name: "Hot Filadélfia 8un", desc: "Empanado, cream cheese e cebolinha", price: 39.9, emoji: "🍤", category: "Hot Roll" },
  { name: "Guioza de camarão 6un", desc: "Massa artesanal e molho ponzu", price: 32.0, emoji: "🥟", category: "Hot Roll" },
  { name: "Chá gelado de jasmim", desc: "500 ml, sem açúcar", price: 12.0, emoji: "🍹", category: "Bebidas" },
];

const COUPON = { code: "MIZU10", discount: 0.1 };

const STEPS = ["Cardápio", "Produto", "Carrinho", "Modalidade", "Pagamento", "Confirmação", "Acompanhar"] as const;

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function PhoneDemo({ onReset }: { onReset?: () => void }) {
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState<string>("Destaques");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<DemoItem>(ITEMS[0]);
  const [qty, setQty] = useState(1);
  const [addons, setAddons] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [coupon, setCoupon] = useState<string | null>(null);
  const [mode, setMode] = useState("delivery");
  const [table, setTable] = useState("07");
  const [payment, setPayment] = useState("pix");
  const [changeFor, setChangeFor] = useState("100");

  const visibleItems = useMemo(() => {
    const base = query
      ? ITEMS.filter((i) => i.name.toLowerCase().includes(query.toLowerCase()))
      : category === "Destaques"
        ? ITEMS.filter((i) => i.tag)
        : ITEMS.filter((i) => i.category === category);
    return base;
  }, [category, query]);

  const addonsTotal = (selected.addons ?? []).filter((a) => addons.includes(a.name)).reduce((s, a) => s + a.price, 0);
  const subtotal = (selected.price + addonsTotal) * qty;
  const fee = mode === "delivery" ? RESTAURANT.deliveryFee : 0;
  const discount = coupon ? subtotal * COUPON.discount : 0;
  const total = subtotal - discount + fee;

  const reset = () => {
    setStep(0); setCategory("Destaques"); setQuery(""); setSelected(ITEMS[0]);
    setQty(1); setAddons([]); setNote(""); setCoupon(null); setMode("delivery");
    setPayment("pix"); onReset?.();
  };

  const next = () => (step === STEPS.length - 1 ? reset() : setStep((s) => s + 1));

  return (
    <div className="flex w-full flex-col items-center gap-5">
      {/* Progresso */}
      <div className="w-full max-w-[420px]">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Etapa {step + 1} de {STEPS.length}</span>
          <span>{STEPS[step]}</span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Moldura do smartphone */}
      <div className="relative w-[300px] sm:w-[330px] rounded-[2.5rem] border border-border bg-card p-3 shadow-2xl">
        <div className="mx-auto mb-2 h-1.5 w-16 rounded-full bg-muted" aria-hidden="true" />
        <div className="h-[560px] overflow-hidden rounded-[1.9rem] bg-background">
          <div className="flex h-full flex-col">
            <header className="border-b border-border px-4 pb-3 pt-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-display text-base font-semibold leading-tight">{RESTAURANT.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{RESTAURANT.category}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${RESTAURANT.open ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {RESTAURANT.open ? "Aberto agora" : "Fechado"}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {RESTAURANT.hours}</span>
                <span>Entrega {RESTAURANT.eta}</span>
                <span>Mínimo {brl(RESTAURANT.minOrder)}</span>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-3 text-sm">
              {step === 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 rounded-xl border border-border px-3 py-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Buscar no cardápio"
                      aria-label="Buscar produto na demonstração"
                      className="w-full bg-transparent text-xs outline-hidden placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => { setCategory(c); setQuery(""); }}
                        className={`shrink-0 rounded-full px-3 py-1 text-xs transition-colors ${category === c && !query ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  {visibleItems.length === 0 && (
                    <p className="py-6 text-center text-xs text-muted-foreground">Nenhum item encontrado nesta demonstração.</p>
                  )}
                  {visibleItems.map((it) => (
                    <button
                      key={it.name}
                      type="button"
                      onClick={() => { setSelected(it); setAddons([]); setQty(1); setStep(1); }}
                      className="flex w-full gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:border-primary/60"
                    >
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-muted text-2xl" aria-hidden="true">{it.emoji}</div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate font-medium">{it.name}</p>
                          {it.tag && (
                            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
                              <Star className="h-2.5 w-2.5" /> {it.tag}
                            </span>
                          )}
                        </div>
                        <p className="line-clamp-2 text-xs text-muted-foreground">{it.desc}</p>
                        <p className="mt-1 text-sm font-semibold text-primary">{brl(it.price)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <div className="flex h-28 items-center justify-center rounded-xl bg-muted text-4xl" aria-hidden="true">{selected.emoji}</div>
                  <div>
                    <p className="font-medium">{selected.name}</p>
                    <p className="text-xs text-muted-foreground">{selected.desc}</p>
                  </div>
                  {selected.addons ? (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Adicionais</p>
                      <div className="space-y-2">
                        {selected.addons.map((a) => {
                          const active = addons.includes(a.name);
                          return (
                            <button
                              key={a.name}
                              type="button"
                              onClick={() => setAddons((p) => (active ? p.filter((x) => x !== a.name) : [...p, a.name]))}
                              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors ${active ? "border-primary bg-primary/10" : "border-border"}`}
                            >
                              <span className="text-xs">{a.name}</span>
                              <span className="text-xs text-muted-foreground">+ {brl(a.price)}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                      Este produto não possui adicionais.
                    </p>
                  )}
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Observações</p>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={2}
                      placeholder="Ex.: sem cebolinha"
                      aria-label="Observações do item"
                      className="w-full resize-none rounded-lg border border-border bg-transparent px-3 py-2 text-xs outline-hidden focus:border-primary"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 rounded-full border border-border px-3 py-1.5">
                      <button type="button" aria-label="Diminuir quantidade" onClick={() => setQty((q) => Math.max(1, q - 1))}><Minus className="h-4 w-4" /></button>
                      <span className="w-4 text-center text-sm">{qty}</span>
                      <button type="button" aria-label="Aumentar quantidade" onClick={() => setQty((q) => Math.min(9, q + 1))}><Plus className="h-4 w-4" /></button>
                    </div>
                    <span className="text-sm font-semibold">{brl(subtotal)}</span>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <ShoppingBag className="h-4 w-4" /><span className="text-xs">Seu carrinho</span>
                  </div>
                  <div className="rounded-xl border border-border p-3">
                    <p className="text-sm font-medium">{qty}× {selected.name}</p>
                    {addons.length > 0 && <p className="text-xs text-muted-foreground">+ {addons.join(", ")}</p>}
                    {note && <p className="text-xs italic text-muted-foreground">“{note}”</p>}
                    <p className="mt-2 text-sm font-semibold text-primary">{brl(subtotal)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCoupon(coupon ? null : COUPON.code)}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-colors ${coupon ? "border-primary bg-primary/10" : "border-dashed border-border"}`}
                  >
                    <span className="inline-flex items-center gap-2 text-xs"><Ticket className="h-4 w-4 text-primary" /> Cupom {COUPON.code} (10%)</span>
                    <span className="text-[10px] text-muted-foreground">{coupon ? "Remover" : "Aplicar"}</span>
                  </button>
                  <dl className="space-y-1.5 border-t border-border pt-3 text-xs">
                    <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>{brl(subtotal)}</dd></div>
                    {coupon && <div className="flex justify-between text-primary"><dt>Desconto</dt><dd>- {brl(discount)}</dd></div>}
                    <div className="flex justify-between"><dt className="text-muted-foreground">Taxa de entrega</dt><dd>{fee ? brl(fee) : "Grátis"}</dd></div>
                    <div className="flex justify-between border-t border-border pt-2 text-sm font-semibold"><dt>Total</dt><dd>{brl(total)}</dd></div>
                  </dl>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    {[
                      { id: "delivery", label: "Delivery", icon: Bike, hint: `Entrega ${RESTAURANT.eta} · ${brl(RESTAURANT.deliveryFee)}` },
                      { id: "pickup", label: "Retirada", icon: Store, hint: "Retirar no balcão em 20 min" },
                      { id: "dine_in", label: "No local", icon: Utensils, hint: "Pedido pela mesa via QR Code" },
                    ].map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => setMode(o.id)}
                        className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${mode === o.id ? "border-primary bg-primary/10" : "border-border"}`}
                      >
                        <o.icon className="h-4 w-4 text-primary" />
                        <span>
                          <span className="block text-sm">{o.label}</span>
                          <span className="block text-xs text-muted-foreground">{o.hint}</span>
                        </span>
                      </button>
                    ))}
                  </div>

                  {mode === "delivery" && (
                    <div className="rounded-xl border border-border p-3 text-xs">
                      <p className="mb-2 inline-flex items-center gap-1.5 font-medium"><MapPin className="h-3.5 w-3.5 text-primary" /> Endereço de entrega</p>
                      <p className="text-muted-foreground">Rua das Cerejeiras, 128 — apto 92</p>
                      <p className="text-muted-foreground">Jardim Sakura · CEP 01234-000</p>
                    </div>
                  )}
                  {mode === "dine_in" && (
                    <div className="rounded-xl border border-border p-3 text-xs">
                      <p className="mb-2 font-medium">Identificação da mesa</p>
                      <div className="flex gap-2">
                        {["05", "07", "12"].map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setTable(t)}
                            className={`rounded-lg border px-3 py-1.5 transition-colors ${table === t ? "border-primary bg-primary/10" : "border-border"}`}
                          >
                            Mesa {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {mode === "pickup" && (
                    <p className="rounded-xl border border-border p-3 text-xs text-muted-foreground">
                      Retirada no balcão — avisaremos assim que o pedido estiver pronto.
                    </p>
                  )}
                </div>
              )}

              {step === 4 && (
                <div className="space-y-2">
                  {[
                    { id: "pix", label: "Pix", icon: QrCode },
                    { id: "card", label: "Cartão online", icon: CreditCard },
                    { id: "cash", label: "Dinheiro na entrega", icon: Banknote },
                  ].map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setPayment(o.id)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${payment === o.id ? "border-primary bg-primary/10" : "border-border"}`}
                    >
                      <o.icon className="h-4 w-4 text-primary" />
                      <span className="text-sm">{o.label}</span>
                    </button>
                  ))}
                  {payment === "cash" && (
                    <label className="block rounded-xl border border-border p-3 text-xs">
                      <span className="mb-1.5 block font-medium">Troco para</span>
                      <input
                        value={changeFor}
                        onChange={(e) => setChangeFor(e.target.value.replace(/\D/g, ""))}
                        inputMode="numeric"
                        className="w-full rounded-lg border border-border bg-transparent px-3 py-2 outline-hidden focus:border-primary"
                      />
                    </label>
                  )}
                  <p className="pt-2 text-xs text-muted-foreground">Demonstração — nenhum pagamento é processado.</p>
                </div>
              )}

              {step === 5 && (
                <div className="space-y-3">
                  <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 text-center">
                    <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-5 w-5" /></span>
                    <p className="mt-2 text-sm font-semibold">Pedido enviado ao restaurante</p>
                    <p className="text-xs text-muted-foreground">Pedido fictício #1045</p>
                  </div>
                  <dl className="space-y-1.5 rounded-xl border border-border p-3 text-xs">
                    <div className="flex justify-between"><dt className="text-muted-foreground">Modalidade</dt><dd>{mode === "delivery" ? "Delivery" : mode === "pickup" ? "Retirada" : `No local · Mesa ${table}`}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Pagamento</dt><dd>{payment === "pix" ? "Pix" : payment === "card" ? "Cartão online" : `Dinheiro (troco p/ ${brl(Number(changeFor) || 0)})`}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Itens</dt><dd>{qty}× {selected.name}</dd></div>
                    <div className="flex justify-between font-semibold"><dt>Total</dt><dd>{brl(total)}</dd></div>
                  </dl>
                </div>
              )}

              {step === 6 && (
                <ol className="space-y-3">
                  {[
                    { label: "Pedido enviado", time: "19:42", icon: Check, done: true },
                    { label: "Confirmado pelo restaurante", time: "19:43", icon: Check, done: true },
                    { label: "Em preparação", time: "19:45", icon: ChefHat, done: true },
                    mode === "delivery"
                      ? { label: "Saiu para entrega", time: "20:05", icon: Truck, done: false }
                      : { label: mode === "pickup" ? "Pronto para retirada" : "Pronto — servindo na mesa", time: "20:02", icon: PackageCheck, done: false },
                    { label: mode === "delivery" ? "Entregue" : "Concluído", time: "—", icon: Check, done: false },
                  ].map((s) => (
                    <li key={s.label} className="flex items-center gap-3">
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${s.done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        <s.icon className="h-4 w-4" />
                      </span>
                      <span className="flex-1">
                        <span className={`block text-sm ${s.done ? "" : "text-muted-foreground"}`}>{s.label}</span>
                        <span className="block text-[10px] text-muted-foreground">Hoje · {s.time}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="border-t border-border p-3">
              <Button variant="hero" className="w-full" onClick={next}>
                {step === STEPS.length - 1 ? "Reiniciar demonstração" : "Continuar"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-2" role="tablist" aria-label="Etapas da demonstração do cardápio">
        {STEPS.map((s, i) => (
          <button
            key={s}
            role="tab"
            aria-selected={step === i}
            onClick={() => setStep(i)}
            className={`min-h-9 rounded-full px-3 text-xs transition-colors ${step === i ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
          >
            {s}
          </button>
        ))}
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reiniciar
        </button>
      </div>
    </div>
  );
}

export default PhoneDemo;

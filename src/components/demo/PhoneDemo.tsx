import { useState } from "react";
import { Minus, Plus, ShoppingBag, Bike, Store, Utensils, CreditCard, QrCode, Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Dados 100% fictícios — nenhuma consulta ao banco é feita aqui. */
const CATEGORIES = ["Combinados", "Temaki", "Hot Roll", "Bebidas"];

const ITEMS = [
  { name: "Combinado Mizu 20 peças", desc: "Salmão, atum, skin e uramaki especial", price: 89.9, emoji: "🍣" },
  { name: "Temaki Salmão Grelhado", desc: "Cone de alga, arroz e salmão maçaricado", price: 34.9, emoji: "🌯" },
  { name: "Hot Filadélfia 8un", desc: "Empanado, cream cheese e cebolinha", price: 39.9, emoji: "🍤" },
];

const ADDONS = [
  { name: "Cream cheese extra", price: 6 },
  { name: "Cebolinha", price: 3 },
  { name: "Shoyu premium", price: 5 },
];

const steps = ["Cardápio", "Item", "Carrinho", "Entrega", "Pagamento", "Acompanhar"] as const;

export function PhoneDemo() {
  const [step, setStep] = useState(0);
  const [qty, setQty] = useState(1);
  const [addons, setAddons] = useState<string[]>([]);
  const [mode, setMode] = useState("delivery");
  const [payment, setPayment] = useState("pix");

  const item = ITEMS[0];
  const addonsTotal = ADDONS.filter((a) => addons.includes(a.name)).reduce((s, a) => s + a.price, 0);
  const total = (item.price + addonsTotal) * qty;
  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Moldura do smartphone */}
      <div className="relative w-[280px] sm:w-[300px] rounded-[2.5rem] border border-border bg-card p-3 shadow-2xl">
        <div className="mx-auto mb-2 h-1.5 w-16 rounded-full bg-muted" aria-hidden="true" />
        <div className="h-[520px] overflow-hidden rounded-[1.9rem] bg-background">
          <div className="flex h-full flex-col">
            <header className="px-4 pt-4 pb-3 border-b border-border">
              <p className="text-xs text-muted-foreground">Cardápio digital</p>
              <p className="font-display text-base font-semibold">Sushi Demonstração</p>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-3 text-sm">
              {step === 0 && (
                <div className="space-y-3">
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {CATEGORIES.map((c, i) => (
                      <span
                        key={c}
                        className={`shrink-0 rounded-full px-3 py-1 text-xs ${i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                  {ITEMS.map((it) => (
                    <div key={it.name} className="flex gap-3 rounded-xl border border-border p-3">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-muted text-2xl" aria-hidden="true">
                        {it.emoji}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{it.name}</p>
                        <p className="line-clamp-2 text-xs text-muted-foreground">{it.desc}</p>
                        <p className="mt-1 text-sm font-semibold text-primary">{brl(it.price)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <div className="flex h-28 items-center justify-center rounded-xl bg-muted text-4xl" aria-hidden="true">
                    {item.emoji}
                  </div>
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Adicionais</p>
                    <div className="space-y-2">
                      {ADDONS.map((a) => {
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 rounded-full border border-border px-3 py-1.5">
                      <button type="button" aria-label="Diminuir quantidade" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-4 text-center text-sm">{qty}</span>
                      <button type="button" aria-label="Aumentar quantidade" onClick={() => setQty((q) => Math.min(9, q + 1))}>
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <span className="text-sm font-semibold">{brl(total)}</span>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <ShoppingBag className="h-4 w-4" />
                    <span className="text-xs">Seu carrinho</span>
                  </div>
                  <div className="rounded-xl border border-border p-3">
                    <p className="text-sm font-medium">{qty}× {item.name}</p>
                    {addons.length > 0 && <p className="text-xs text-muted-foreground">+ {addons.join(", ")}</p>}
                    <p className="mt-2 text-sm font-semibold text-primary">{brl(total)}</p>
                  </div>
                  <div className="flex justify-between border-t border-border pt-3 text-sm">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-semibold">{brl(total)}</span>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-2">
                  {[
                    { id: "delivery", label: "Delivery", icon: Bike, hint: "Entrega no endereço" },
                    { id: "pickup", label: "Retirada", icon: Store, hint: "Retirar no balcão" },
                    { id: "dine_in", label: "No local", icon: Utensils, hint: "Pedido pela mesa" },
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
              )}

              {step === 4 && (
                <div className="space-y-2">
                  {[
                    { id: "pix", label: "Pix", icon: QrCode },
                    { id: "card", label: "Cartão online", icon: CreditCard },
                    { id: "on_delivery", label: "Pagar na entrega", icon: ShoppingBag },
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
                  <p className="pt-2 text-xs text-muted-foreground">Demonstração — nenhum pagamento é processado.</p>
                </div>
              )}

              {step === 5 && (
                <ol className="space-y-3">
                  {[
                    { label: "Pedido recebido", done: true },
                    { label: "Em preparo", done: true },
                    { label: "Saiu para entrega", done: false },
                    { label: "Entregue", done: false },
                  ].map((s) => (
                    <li key={s.label} className="flex items-center gap-3">
                      <span className={`flex h-7 w-7 items-center justify-center rounded-full ${s.done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        {s.done ? <Check className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                      </span>
                      <span className={s.done ? "text-sm" : "text-sm text-muted-foreground"}>{s.label}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="border-t border-border p-3">
              <Button
                variant="hero"
                className="w-full"
                onClick={() => setStep((s) => (s + 1) % steps.length)}
              >
                {step === steps.length - 1 ? "Recomeçar demonstração" : "Continuar"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-2" role="tablist" aria-label="Etapas da demonstração do cardápio">
        {steps.map((s, i) => (
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
      </div>
    </div>
  );
}

export default PhoneDemo;

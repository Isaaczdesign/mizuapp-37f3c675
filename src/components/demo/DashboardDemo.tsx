import { useMemo, useState } from "react";
import {
  LayoutDashboard, ClipboardList, UtensilsCrossed, BarChart3, Settings,
  Bike, Store, Utensils, RotateCcw, Plus, Copy, EyeOff, GripVertical, Star, QrCode,
} from "lucide-react";

/** Painel demonstrativo — dados fictícios em memória, sem qualquer acesso ao banco. */
const TABS = [
  { id: "visao", label: "Visão geral", icon: LayoutDashboard },
  { id: "pedidos", label: "Pedidos", icon: ClipboardList },
  { id: "cardapio", label: "Cardápio", icon: UtensilsCrossed },
  { id: "relatorios", label: "Relatórios", icon: BarChart3 },
  { id: "config", label: "Configurações", icon: Settings },
] as const;

const COLUMNS = [
  { id: "new", label: "Novos" },
  { id: "confirmed", label: "Confirmados" },
  { id: "preparing", label: "Em preparação" },
  { id: "ready", label: "Prontos" },
  { id: "delivering", label: "Em entrega" },
  { id: "done", label: "Concluídos" },
  { id: "canceled", label: "Cancelados" },
] as const;

type ColId = (typeof COLUMNS)[number]["id"];

type DemoOrder = {
  id: string; who: string; time: string; total: number; mode: "Delivery" | "Retirada" | "No local";
  payment: string; items: string[]; note?: string; address?: string; table?: string; status: ColId;
};

const INITIAL_ORDERS: DemoOrder[] = [
  { id: "#1042", who: "Ana P.", time: "19:42", total: 128.8, mode: "Delivery", payment: "Pix (pago)", items: ["1× Combinado Mizu 20", "1× Chá de jasmim"], address: "Rua das Cerejeiras, 128 — apto 92", note: "Sem gengibre", status: "new" },
  { id: "#1043", who: "Bruno L.", time: "19:48", total: 74.9, mode: "Retirada", payment: "Cartão online", items: ["2× Hot Filadélfia 8un"], status: "confirmed" },
  { id: "#1044", who: "Mesa 07", time: "19:51", total: 214.5, mode: "No local", payment: "Na mesa", table: "07", items: ["1× Combinado Mizu 20", "3× Temaki Salmão"], status: "preparing" },
  { id: "#1045", who: "Carla M.", time: "19:55", total: 62.0, mode: "Delivery", payment: "Dinheiro (troco R$ 100)", items: ["2× Guioza de camarão"], address: "Av. Sakura, 900", status: "ready" },
];

const NEXT_ACTION: Partial<Record<ColId, { label: string; to: ColId }>> = {
  new: { label: "Confirmar pedido", to: "confirmed" },
  confirmed: { label: "Iniciar preparação", to: "preparing" },
  preparing: { label: "Marcar como pronto", to: "ready" },
  ready: { label: "Enviar para entrega", to: "delivering" },
  delivering: { label: "Concluir pedido", to: "done" },
};

const modeIcon = { Delivery: Bike, Retirada: Store, "No local": Utensils } as const;
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const SALES = [
  { day: "Seg", value: 1240 }, { day: "Ter", value: 1980 }, { day: "Qua", value: 1610 },
  { day: "Qui", value: 2340 }, { day: "Sex", value: 3420 }, { day: "Sáb", value: 4180 }, { day: "Dom", value: 2960 },
];

const PRODUCTS = [
  { name: "Combinado Mizu 20 peças", category: "Combinados", price: 89.9, active: true, featured: true },
  { name: "Temaki Salmão Grelhado", category: "Temaki", price: 34.9, active: true, featured: false },
  { name: "Hot Filadélfia 8un", category: "Hot Roll", price: 39.9, active: false, featured: false },
  { name: "Chá gelado de jasmim", category: "Bebidas", price: 12.0, active: true, featured: false },
];

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-lg font-semibold">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function DashboardDemo() {
  const [tab, setTab] = useState<string>("visao");
  const [orders, setOrders] = useState<DemoOrder[]>(INITIAL_ORDERS);

  const totals = useMemo(() => {
    const done = orders.filter((o) => o.status === "done");
    const revenue = orders.filter((o) => o.status !== "canceled").reduce((s, o) => s + o.total, 0);
    return {
      count: orders.length,
      revenue,
      ticket: orders.length ? revenue / orders.length : 0,
      running: orders.filter((o) => !["done", "canceled"].includes(o.status)).length,
      done: done.length,
      canceled: orders.filter((o) => o.status === "canceled").length,
    };
  }, [orders]);

  const move = (id: string, to: ColId) =>
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: to } : o)));

  const maxSale = Math.max(...SALES.map((s) => s.value));

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-muted" aria-hidden="true" />
        <span className="h-2.5 w-2.5 rounded-full bg-muted" aria-hidden="true" />
        <span className="h-2.5 w-2.5 rounded-full bg-muted" aria-hidden="true" />
        <span className="ml-3 truncate rounded-md bg-muted px-3 py-1 text-xs text-muted-foreground">
          app.mizu.com.br/{tab} — demonstração
        </span>
        <button
          type="button"
          onClick={() => setOrders(INITIAL_ORDERS)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3 w-3" /> Reiniciar
        </button>
      </div>

      <div className="grid md:grid-cols-[188px_1fr]">
        <aside className="hidden border-r border-border p-3 md:block">
          <div className="mb-3 flex items-center gap-2 px-2 text-sm font-semibold">
            <LayoutDashboard className="h-4 w-4 text-primary" /> Painel
          </div>
          <nav className="space-y-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors ${tab === t.id ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <t.icon className="h-4 w-4" /> {t.label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="p-4">
          <div className="mb-4 flex gap-2 overflow-x-auto md:hidden">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs transition-colors ${tab === t.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "visao" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <Metric label="Pedidos hoje" value={String(totals.count)} hint="Todas as modalidades" />
                <Metric label="Faturamento" value={brl(totals.revenue)} hint="Exceto cancelados" />
                <Metric label="Ticket médio" value={brl(totals.ticket)} />
                <Metric label="Em andamento" value={String(totals.running)} />
                <Metric label="Concluídos" value={String(totals.done)} />
                <Metric label="Cancelados" value={String(totals.canceled)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs font-semibold">Modalidades de atendimento</p>
                  <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                    {[["Delivery", 54], ["Retirada", 21], ["No local", 25]].map(([label, pct]) => (
                      <li key={label as string}>
                        <div className="flex justify-between"><span>{label}</span><span>{pct}%</span></div>
                        <div className="mt-1 h-1.5 rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs font-semibold">Horários de maior movimento</p>
                  <div className="mt-3 flex h-24 items-end gap-1.5">
                    {[18, 34, 52, 78, 96, 70, 44].map((h, i) => (
                      <div key={i} className="flex-1 rounded-t bg-primary/70" style={{ height: `${h}%` }} aria-hidden="true" />
                    ))}
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">18h → 23h (dados ilustrativos)</p>
                </div>
              </div>
            </div>
          )}

          {tab === "pedidos" && (
            <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
              {COLUMNS.map((col) => {
                const list = orders.filter((o) => o.status === col.id);
                return (
                  <div key={col.id} className="w-[240px] shrink-0 snap-start rounded-xl border border-border bg-background/40 p-2">
                    <div className="mb-2 flex items-center justify-between px-1">
                      <span className="text-xs font-semibold">{col.label}</span>
                      <span className="rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">{list.length}</span>
                    </div>
                    <div className="space-y-2">
                      {list.length === 0 && (
                        <p className="rounded-lg border border-dashed border-border p-3 text-center text-[10px] text-muted-foreground">
                          Nenhum pedido
                        </p>
                      )}
                      {list.map((o) => {
                        const Icon = modeIcon[o.mode];
                        const action = NEXT_ACTION[o.status];
                        return (
                          <article key={o.id} className="rounded-lg border border-border bg-card p-2.5 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold">{o.id}</span>
                              <span className="text-[10px] text-muted-foreground">{o.time}</span>
                            </div>
                            <p className="mt-0.5 text-muted-foreground">{o.who}</p>
                            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px]">
                              <Icon className="h-3 w-3 text-primary" /> {o.mode}{o.table ? ` · Mesa ${o.table}` : ""}
                            </p>
                            <ul className="mt-1.5 space-y-0.5 text-[11px] text-muted-foreground">
                              {o.items.map((it) => <li key={it}>{it}</li>)}
                            </ul>
                            {o.note && <p className="mt-1 text-[10px] italic text-muted-foreground">“{o.note}”</p>}
                            {o.address && <p className="mt-1 text-[10px] text-muted-foreground">{o.address}</p>}
                            <p className="mt-1 text-[10px] text-muted-foreground">{o.payment}</p>
                            <p className="mt-1 font-semibold text-primary">{brl(o.total)}</p>
                            <div className="mt-2 flex gap-1.5">
                              {action && (
                                <button
                                  type="button"
                                  onClick={() => move(o.id, action.to)}
                                  className="flex-1 rounded-md bg-primary px-2 py-1.5 text-[10px] font-medium text-primary-foreground"
                                >
                                  {action.label}
                                </button>
                              )}
                              {!["done", "canceled"].includes(o.status) && (
                                <button
                                  type="button"
                                  onClick={() => move(o.id, "canceled")}
                                  className="rounded-md border border-border px-2 py-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                                >
                                  Cancelar
                                </button>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === "cardapio" && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {["Combinados", "Temaki", "Hot Roll", "Bebidas"].map((c) => (
                  <span key={c} className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">{c}</span>
                ))}
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                  <Plus className="h-3 w-3" /> Nova categoria
                </span>
              </div>
              <div className="space-y-2">
                {PRODUCTS.map((p) => (
                  <div key={p.name} className="flex items-center gap-3 rounded-xl border border-border p-3">
                    <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-lg" aria-hidden="true">🍣</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-sm font-medium">{p.name}</p>
                        {p.featured && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
                            <Star className="h-2.5 w-2.5" /> Destaque
                          </span>
                        )}
                        {!p.active && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">Indisponível</span>}
                      </div>
                      <p className="text-[11px] text-muted-foreground">{p.category} · {brl(p.price)} · adicionais configurados</p>
                    </div>
                    <div className="flex shrink-0 gap-1.5 text-muted-foreground">
                      <span className="rounded-md border border-border p-1.5" title="Duplicar"><Copy className="h-3.5 w-3.5" /></span>
                      <span className="rounded-md border border-border p-1.5" title="Indisponibilizar"><EyeOff className="h-3.5 w-3.5" /></span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Ordenação por arrastar, imagens, preços, adicionais, destaques e horários de disponibilidade — tudo editável no painel real.
              </p>
            </div>
          )}

          {tab === "relatorios" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Metric label="Vendas (7 dias)" value={brl(SALES.reduce((s, d) => s + d.value, 0))} hint="+18% vs. período anterior" />
                <Metric label="Pedidos" value="238" hint="+12%" />
                <Metric label="Ticket médio" value={brl(74.6)} hint="+4%" />
                <Metric label="Cancelamentos" value="3%" hint="-1%" />
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-xs font-semibold">Vendas por dia</p>
                <div className="mt-3 flex h-28 items-end gap-2">
                  {SALES.map((s) => (
                    <div key={s.day} className="flex flex-1 flex-col items-center gap-1">
                      <div className="w-full rounded-t bg-primary/70" style={{ height: `${(s.value / maxSale) * 100}%` }} aria-hidden="true" />
                      <span className="text-[10px] text-muted-foreground">{s.day}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs font-semibold">Produtos mais vendidos</p>
                  <ol className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <li>1. Combinado Mizu 20 peças — 84</li>
                    <li>2. Temaki Salmão Grelhado — 61</li>
                    <li>3. Hot Filadélfia 8un — 47</li>
                  </ol>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs font-semibold">Formas de pagamento</p>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <li>Pix — 48%</li><li>Cartão online — 31%</li><li>Dinheiro — 12%</li><li>Na mesa — 9%</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {tab === "config" && (
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { title: "Informações do restaurante", text: "Nome, descrição, logotipo, capa e endereço." },
                { title: "Horários de funcionamento", text: "Por dia da semana, com pausa e turnos noturnos." },
                { title: "Modalidades e pagamentos", text: "Delivery, retirada, mesa, Pix, cartão e dinheiro." },
                { title: "Entrega", text: "Taxa, bairros atendidos e tempo médio de preparo." },
                { title: "Mesas", text: "Cadastro de mesas e QR Code individual." },
                { title: "Pedido mínimo", text: "Valor mínimo por modalidade." },
                { title: "Aparência do cardápio", text: "Templates premium e cores da marca." },
                { title: "Link e QR Code", text: "Link personalizado + QR Code para impressão." },
              ].map((c) => (
                <div key={c.title} className="rounded-xl border border-border p-3">
                  <p className="text-xs font-semibold">{c.title}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{c.text}</p>
                </div>
              ))}
              <div className="rounded-xl border border-border p-3 sm:col-span-2">
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold"><QrCode className="h-3.5 w-3.5 text-primary" /> QR Code do cardápio</p>
                <p className="mt-1 text-[11px] text-muted-foreground">mizu.app/q/sushi-mizu — link curto fictício desta demonstração.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DashboardDemo;

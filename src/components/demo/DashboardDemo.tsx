import { useState } from "react";
import {
  LayoutDashboard, ClipboardList, UtensilsCrossed, Clock, BarChart3, Settings,
  Bike, Store, Utensils,
} from "lucide-react";

/** Painel demonstrativo — dados fictícios, somente leitura, sem acesso ao banco. */
const TABS = [
  { id: "pedidos", label: "Pedidos", icon: ClipboardList },
  { id: "cardapio", label: "Cardápio", icon: UtensilsCrossed },
  { id: "horarios", label: "Horários", icon: Clock },
  { id: "relatorios", label: "Relatórios", icon: BarChart3 },
  { id: "config", label: "Configurações", icon: Settings },
] as const;

const ORDERS = [
  { id: "#1042", type: "Delivery", icon: Bike, who: "Ana P.", status: "Em preparo", total: "R$ 128,80" },
  { id: "#1043", type: "Retirada", icon: Store, who: "Bruno L.", status: "Novo", total: "R$ 74,90" },
  { id: "#1044", type: "No local", icon: Utensils, who: "Mesa 07", status: "Pronto", total: "R$ 214,50" },
];

export function DashboardDemo() {
  const [tab, setTab] = useState<string>("pedidos");

  return (
    <div className="rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
      {/* Barra do navegador */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-muted" aria-hidden="true" />
        <span className="h-2.5 w-2.5 rounded-full bg-muted" aria-hidden="true" />
        <span className="h-2.5 w-2.5 rounded-full bg-muted" aria-hidden="true" />
        <span className="ml-3 truncate rounded-md bg-muted px-3 py-1 text-xs text-muted-foreground">
          app.mizu.com.br/pedidos — demonstração
        </span>
      </div>

      <div className="grid md:grid-cols-[180px_1fr]">
        {/* Sidebar */}
        <aside className="hidden md:block border-r border-border p-3">
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
          {/* Abas mobile */}
          <div className="mb-4 flex gap-2 overflow-x-auto md:hidden">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`shrink-0 rounded-full px-3 py-2 text-xs ${tab === t.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "pedidos" && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                {["Novos", "Em preparo", "Prontos"].map((col, i) => (
                  <div key={col} className="rounded-xl border border-border p-3">
                    <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">{col}</p>
                    {ORDERS.filter((_, idx) => idx % 3 === i).map((o) => (
                      <div key={o.id} className="mb-2 rounded-lg bg-muted/50 p-2.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium">{o.id}</span>
                          <span className="text-muted-foreground">{o.total}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <o.icon className="h-3.5 w-3.5" /> {o.type} · {o.who}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Pedidos chegam em tempo real e o status é alterado com um toque — delivery, retirada e mesas separados.
              </p>
            </div>
          )}

          {tab === "cardapio" && (
            <div className="space-y-2">
              {["Combinados", "Temaki", "Bebidas"].map((cat) => (
                <div key={cat} className="rounded-xl border border-border p-3">
                  <p className="text-sm font-medium">{cat}</p>
                  <p className="text-xs text-muted-foreground">3 itens · arraste para reordenar · editar preço e foto</p>
                </div>
              ))}
            </div>
          )}

          {tab === "horarios" && (
            <div className="space-y-2">
              {[["Seg — Qui", "18:00 – 23:00"], ["Sex — Sáb", "18:00 – 00:30"], ["Domingo", "Fechado"]].map(([d, h]) => (
                <div key={d} className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5 text-sm">
                  <span>{d}</span>
                  <span className="text-muted-foreground">{h}</span>
                </div>
              ))}
            </div>
          )}

          {tab === "relatorios" && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                {[["Vendas do dia", "R$ 2.418"], ["Pedidos", "37"], ["Ticket médio", "R$ 65,35"]].map(([l, v]) => (
                  <div key={l} className="rounded-xl border border-border p-3">
                    <p className="text-xs text-muted-foreground">{l}</p>
                    <p className="font-display text-lg font-semibold">{v}</p>
                  </div>
                ))}
              </div>
              <div className="flex h-24 items-end gap-1.5 rounded-xl border border-border p-3" aria-hidden="true">
                {[35, 52, 41, 68, 74, 60, 88].map((h, i) => (
                  <span key={i} className="flex-1 rounded-t bg-primary/60" style={{ height: `${h}%` }} />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Valores ilustrativos desta demonstração.</p>
            </div>
          )}

          {tab === "config" && (
            <div className="space-y-2">
              {["Identidade do cardápio", "Formas de pagamento", "Delivery e taxas", "Mesas e QR Codes"].map((c) => (
                <div key={c} className="rounded-xl border border-border px-3 py-2.5 text-sm">{c}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DashboardDemo;

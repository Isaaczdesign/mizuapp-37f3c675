import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminMizuLayout from "@/components/admin-mizu/AdminMizuLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { EmptyState, Toolbar, Notice } from "@/components/admin-mizu/ui";
import { ScrollText, Search, ChevronDown } from "lucide-react";

type Log = {
  id: string; actor_id: string | null; action: string; entity_type: string; entity_id: string | null;
  old_value: unknown; new_value: unknown; reason: string | null; created_at: string;
};

function LogItem({ l }: { l: Log }) {
  const [open, setOpen] = useState(false);
  const hasDiff = Boolean(l.old_value || l.new_value);
  const [verb, ...rest] = l.action.split(".");

  return (
    <li className="rounded-2xl border border-border bg-card/40 transition-colors hover:border-primary/30">
      <div className="flex flex-wrap items-start justify-between gap-2 p-4">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5 text-sm">
            <span className="rounded-md bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{verb}</span>
            <span className="font-medium">{rest.join(".") || l.action}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {l.entity_type}
            {l.entity_id ? ` · ${l.entity_id}` : ""}
            {l.reason ? ` · ${l.reason}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <time className="text-xs tabular-nums text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")}</time>
          {hasDiff && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              Detalhes <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>
      </div>
      {hasDiff && open && (
        <pre className="mx-4 mb-4 overflow-x-auto rounded-xl bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
{JSON.stringify({ antes: l.old_value, depois: l.new_value }, null, 2)}
        </pre>
      )}
    </li>
  );
}

export default function AdminLogs() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    supabase
      .from("platform_admin_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (!active) return;
        setLogs((data ?? []) as Log[]);
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const t = query.trim().toLowerCase();
    if (!t) return logs;
    return logs.filter((l) => `${l.action} ${l.entity_type} ${l.entity_id ?? ""} ${l.reason ?? ""}`.toLowerCase().includes(t));
  }, [logs, query]);

  return (
    <AdminMizuLayout
      title="Logs e auditoria"
      description="Registro imutável das ações administrativas da equipe Mizu — não podem ser apagadas pelo painel."
    >
      <Toolbar>
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por ação, entidade ou motivo"
            className="border-transparent bg-background/60 pl-9"
          />
        </div>
        <span className="px-2 text-xs text-muted-foreground">{filtered.length} evento(s)</span>
      </Toolbar>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={ScrollText} title="Nenhuma ação registrada" description="As ações administrativas aparecerão aqui automaticamente." />
      ) : (
        <ul className="space-y-2">
          {filtered.map((l) => <LogItem key={l.id} l={l} />)}
        </ul>
      )}

      <div className="mt-5">
        <Notice>Exibindo os 200 eventos mais recentes.</Notice>
      </div>
    </AdminMizuLayout>
  );
}

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminMizuLayout from "@/components/admin-mizu/AdminMizuLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, Row, Cell, StatusPill, EmptyState, Toolbar, SegmentedControl, Notice } from "@/components/admin-mizu/ui";
import { ShieldAlert, Search, RotateCcw } from "lucide-react";

const ACTIONS = ["restaurant.banned", "restaurant.unbanned", "restaurant.deleted"] as const;

type Log = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_id: string | null;
  old_value: { name?: string; slug?: string; members?: number } | null;
  reason: string | null;
  created_at: string;
};

const LABEL: Record<string, { text: string; tone: "danger" | "warning" | "success" }> = {
  "restaurant.banned": { text: "Banimento", tone: "warning" },
  "restaurant.unbanned": { text: "Reativação", tone: "success" },
  "restaurant.deleted": { text: "Exclusão", tone: "danger" },
};

export default function AdminModeration() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [actors, setActors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<"all" | "ban" | "unban" | "delete">("all");
  const [query, setQuery] = useState("");
  const [actorQuery, setActorQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    supabase
      .from("platform_admin_logs")
      .select("id, actor_id, action, entity_id, old_value, reason, created_at")
      .in("action", ACTIONS as unknown as string[])
      .order("created_at", { ascending: false })
      .limit(500)
      .then(async ({ data, error }) => {
        if (!active) return;
        if (error) setError(error.message);
        const rows = (data ?? []) as unknown as Log[];
        setLogs(rows);
        const ids = Array.from(new Set(rows.map((l) => l.actor_id).filter(Boolean))) as string[];
        if (ids.length) {
          const { data: profs } = await supabase
            .from("profiles").select("user_id, display_name").in("user_id", ids);
          if (!active) return;
          setActors(Object.fromEntries((profs ?? []).map((p) => [p.user_id, p.display_name ?? p.user_id])));
        }
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const t = query.trim().toLowerCase();
    const a = actorQuery.trim().toLowerCase();
    const fromTs = from ? new Date(`${from}T00:00:00`).getTime() : null;
    const toTs = to ? new Date(`${to}T23:59:59`).getTime() : null;
    return logs.filter((l) => {
      if (type !== "all" && l.action !== `restaurant.${type === "ban" ? "banned" : type === "unban" ? "unbanned" : "deleted"}`) return false;
      const created = new Date(l.created_at).getTime();
      if (fromTs && created < fromTs) return false;
      if (toTs && created > toTs) return false;
      if (t) {
        const hay = `${l.old_value?.name ?? ""} ${l.old_value?.slug ?? ""} ${l.entity_id ?? ""} ${l.reason ?? ""}`.toLowerCase();
        if (!hay.includes(t)) return false;
      }
      if (a) {
        const hay = `${actors[l.actor_id ?? ""] ?? ""} ${l.actor_id ?? ""}`.toLowerCase();
        if (!hay.includes(a)) return false;
      }
      return true;
    });
  }, [logs, type, query, actorQuery, from, to, actors]);

  const reset = () => { setType("all"); setQuery(""); setActorQuery(""); setFrom(""); setTo(""); };

  return (
    <AdminMizuLayout
      title="Auditoria de moderação"
      description="Histórico de banimentos, reativações e exclusões de restaurantes — filtre por estabelecimento, responsável e período."
    >
      <Toolbar>
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Restaurante, slug, ID ou motivo"
            className="border-transparent bg-background/60 pl-9"
          />
        </div>
        <SegmentedControl
          value={type}
          onChange={(v) => setType(v as typeof type)}
          options={[
            { id: "all", label: "Tudo" },
            { id: "ban", label: "Banimentos" },
            { id: "unban", label: "Reativações" },
            { id: "delete", label: "Exclusões" },
          ]}
        />
      </Toolbar>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Responsável</Label>
          <Input value={actorQuery} onChange={(e) => setActorQuery(e.target.value)} placeholder="Nome ou ID do admin" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">De</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Até</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="flex items-end">
          <Button variant="glass" onClick={reset} className="w-full">
            <RotateCcw className="mr-2 h-4 w-4" /> Limpar filtros
          </Button>
        </div>
      </div>

      {error && <div className="mb-4"><Notice tone="danger">{error}</Notice></div>}

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="Nenhuma ação de moderação"
          description="Banimentos, reativações e exclusões aparecerão aqui assim que forem executados."
        />
      ) : (
        <>
          <DataTable head={["Ação", "Restaurante", "Responsável", "Motivo", "Data"]}>
            {filtered.map((l) => (
              <Row key={l.id}>
                <Cell>
                  <StatusPill tone={LABEL[l.action]?.tone ?? "neutral"}>{LABEL[l.action]?.text ?? l.action}</StatusPill>
                </Cell>
                <Cell>
                  <p className="font-medium">{l.old_value?.name || "—"}</p>
                  <p className="text-xs text-muted-foreground">{l.old_value?.slug ? `/${l.old_value.slug}` : l.entity_id}</p>
                </Cell>
                <Cell muted>{actors[l.actor_id ?? ""] || l.actor_id || "—"}</Cell>
                <Cell muted className="max-w-[280px]">{l.reason || "—"}</Cell>
                <Cell muted className="tabular-nums">{new Date(l.created_at).toLocaleString("pt-BR")}</Cell>
              </Row>
            ))}
          </DataTable>

          {/* Mobile */}
          <div className="space-y-2 md:hidden">
            {filtered.map((l) => (
              <div key={l.id} className="rounded-2xl border border-border bg-card/40 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{l.old_value?.name || l.entity_id}</p>
                    <p className="truncate text-xs text-muted-foreground">{actors[l.actor_id ?? ""] || l.actor_id || "—"}</p>
                  </div>
                  <StatusPill tone={LABEL[l.action]?.tone ?? "neutral"}>{LABEL[l.action]?.text ?? l.action}</StatusPill>
                </div>
                {l.reason && <p className="mt-2 text-xs text-muted-foreground">{l.reason}</p>}
                <p className="mt-2 text-[11px] text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")}</p>
              </div>
            ))}
          </div>

          <div className="mt-5">
            <Notice>{filtered.length} registro(s) — exibindo os 500 eventos de moderação mais recentes.</Notice>
          </div>
        </>
      )}
    </AdminMizuLayout>
  );
}

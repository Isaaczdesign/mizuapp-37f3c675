import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminMizuLayout from "@/components/admin-mizu/AdminMizuLayout";
import { Skeleton } from "@/components/ui/skeleton";

type Log = {
  id: string; actor_id: string | null; action: string; entity_type: string; entity_id: string | null;
  old_value: unknown; new_value: unknown; reason: string | null; created_at: string;
};

export default function AdminLogs() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <AdminMizuLayout
      title="Logs e auditoria"
      description="Registro imutável das ações administrativas da equipe Mizu (não podem ser apagadas pelo painel)."
    >
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : logs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nenhuma ação administrativa registrada até o momento.
        </p>
      ) : (
        <div className="space-y-2">
          {logs.map((l) => (
            <div key={l.id} className="rounded-xl border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{l.action}</span>
                <span className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {l.entity_type}{l.entity_id ? ` · ${l.entity_id}` : ""}{l.reason ? ` · ${l.reason}` : ""}
              </p>
              {(l.old_value || l.new_value) && (
                <pre className="mt-2 overflow-x-auto rounded-lg bg-muted/40 p-2 text-[11px] text-muted-foreground">
{JSON.stringify({ antes: l.old_value, depois: l.new_value }, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </AdminMizuLayout>
  );
}

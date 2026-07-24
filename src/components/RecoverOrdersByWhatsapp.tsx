import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, Loader2, ChevronRight, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { saveRecentOrder } from "@/lib/publicMenuStorage";
import { toast } from "sonner";

type Found = { tracking_token: string; status: string; created_at: string; total: number; restaurant_slug: string | null };

const STATUS_LABELS: Record<string, string> = {
  new: "Pedido recebido",
  preparing: "Em preparo",
  ready: "Pronto",
  out_for_delivery: "A caminho",
};

/**
 * Ícone flutuante (canto superior direito) para recuperar pedidos em andamento
 * das últimas 24h pelo WhatsApp — funciona mesmo após limpar cache ou trocar de
 * navegador/aparelho.
 */
export default function RecoverOrdersByWhatsapp({
  restaurantId,
  accentColor = "#FF6B35",
}: {
  restaurantId: string;
  accentColor?: string;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Found[] | null>(null);

  async function search() {
    if (phone.replace(/\D/g, "").length < 8) {
      toast.error("Informe o WhatsApp usado no pedido");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc("get_active_orders_by_whatsapp", {
        _restaurant_id: restaurantId,
        _whatsapp: phone,
      });
      if (error) throw error;
      const rows = (data ?? []) as Found[];
      rows.forEach((r) =>
        saveRecentOrder({ token: r.tracking_token, status: r.status, slug: r.restaurant_slug }),
      );
      setResults(rows);
      if (rows.length === 1) navigate(`/pedido/${rows[0].tracking_token}`);
      if (rows.length === 0) toast.info("Nenhum pedido em andamento nas últimas 24h para este número.");
    } catch (e: any) {
      console.error(e);
      toast.error("Não foi possível buscar seus pedidos. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function close() {
    setOpen(false);
    setResults(null);
  }

  return (
    <>
      {/* Ícone flutuante */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Recuperar meu pedido"
        title="Recuperar meu pedido"
        className="fixed top-20 right-4 z-40 w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-white active:scale-95 transition-transform"
        style={{
          background: accentColor,
          boxShadow: `0 8px 24px ${accentColor}66, 0 0 0 4px ${accentColor}22`,
        }}
      >
        <History className="w-5 h-5" />
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={close}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">Recuperar meu pedido</span>
              <button aria-label="Fechar" onClick={close}>
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Informe o WhatsApp usado no pedido. Buscamos pedidos em andamento das últimas 24 horas.
            </p>
            <div className="flex gap-2">
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 99999-9999"
                inputMode="tel"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && search()}
              />
              <Button onClick={search} disabled={loading} style={{ background: accentColor }}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
            {results && results.length > 0 && (
              <div className="rounded-xl border border-border overflow-hidden">
                {results.map((r) => (
                  <button
                    key={r.tracking_token}
                    onClick={() => navigate(`/pedido/${r.tracking_token}`)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-secondary/60 border-b border-border last:border-0"
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium">{STATUS_LABELS[r.status] ?? "Em andamento"}</span>
                      <span className="block text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString("pt-BR")}
                      </span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

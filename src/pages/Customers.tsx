import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Segment = "all" | "new" | "frequent" | "inactive";

function getSegment(c: { total_orders: number; last_order_at: string | null }): string {
  if (c.total_orders <= 1) return "new";
  const last = c.last_order_at ? new Date(c.last_order_at) : null;
  if (last) {
    const days = (Date.now() - last.getTime()) / 86400000;
    if (days > 7) return "inactive";
  }
  return "frequent";
}

const segmentColors: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-400",
  frequent: "bg-green-500/20 text-green-400",
  inactive: "bg-yellow-500/20 text-yellow-400",
};

const Customers = () => {
  const { profile } = useAuth();
  const rid = profile?.restaurant_id;
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<Segment>("all");

  const { data: customers } = useQuery({
    queryKey: ["customers", rid],
    enabled: !!rid,
    queryFn: async () => {
      const { data } = await supabase
        .from("customers")
        .select("*")
        .eq("restaurant_id", rid!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const filtered = (customers ?? []).filter((c) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.whatsapp.includes(search)) return false;
    if (segment !== "all" && getSegment(c) !== segment) return false;
    return true;
  });

  const segments: { key: Segment; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "new", label: "Novos" },
    { key: "frequent", label: "Frequentes" },
    { key: "inactive", label: "Inativos" },
  ];

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <AdminLayout>
      <div className="p-6">
        <h1 className="font-display text-2xl md:text-3xl font-bold mb-6">
          👥 <span className="gradient-text">CRM — Clientes</span>
        </h1>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <Input
            placeholder="Buscar por nome ou WhatsApp..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs bg-card/60"
          />
          <div className="flex gap-2">
            {segments.map((s) => (
              <button
                key={s.key}
                onClick={() => setSegment(s.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  segment === s.key ? "bg-primary text-primary-foreground" : "bg-card/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="glass-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Pedidos</TableHead>
                <TableHead>Total Gasto</TableHead>
                <TableHead>Segmento</TableHead>
                <TableHead>Marketing</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhum cliente encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => {
                  const seg = getSegment(c);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="font-mono text-sm">{c.whatsapp}</TableCell>
                      <TableCell>{c.total_orders}</TableCell>
                      <TableCell>{fmt(Number(c.total_spent))}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${segmentColors[seg]}`}>
                          {seg === "new" ? "Novo" : seg === "frequent" ? "Frequente" : "Inativo"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {c.consent_marketing ? (
                          <Badge variant="outline" className="text-green-400 border-green-400/30">Sim</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">Não</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
};

export default Customers;

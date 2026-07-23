import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, MessageSquare, Users, Ticket, Plus, Tag } from "lucide-react";
import { toast } from "sonner";

type Segment = "all" | "new" | "frequent" | "inactive_7d" | "inactive_30d";

function getSegment(c: { total_orders: number; last_order_at: string | null }): string {
  if (c.total_orders <= 1) return "new";
  const last = c.last_order_at ? new Date(c.last_order_at) : null;
  if (last) {
    const days = (Date.now() - last.getTime()) / 86400000;
    if (days > 30) return "inactive_30d";
    if (days > 7) return "inactive_7d";
  }
  return "frequent";
}

const segmentLabels: Record<string, string> = {
  new: "Novo", frequent: "Frequente", inactive_7d: "Inativo 7d", inactive_30d: "Inativo 30d",
};
const segmentColors: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-400", frequent: "bg-green-500/20 text-green-400",
  inactive_7d: "bg-yellow-500/20 text-yellow-400", inactive_30d: "bg-red-500/20 text-red-400",
};

const Customers = () => {
  const { profile } = useAuth();
  const rid = profile?.restaurant_id;
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<Segment>("all");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [showCouponForm, setShowCouponForm] = useState(false);
  const [showApplyCoupon, setShowApplyCoupon] = useState(false);

  // Coupon form state
  const [couponCode, setCouponCode] = useState("");
  const [couponDesc, setCouponDesc] = useState("");
  const [couponType, setCouponType] = useState("percent");
  const [couponValue, setCouponValue] = useState("");
  const [couponMaxUses, setCouponMaxUses] = useState("");
  const [selectedCouponId, setSelectedCouponId] = useState("");

  const { data: customers } = useQuery({
    queryKey: ["customers", rid],
    enabled: !!rid,
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("*").eq("restaurant_id", rid!).order("created_at", { ascending: false });
      return data ?? [];
    },
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  });

  // Realtime: refresh CRM stats whenever orders change (trigger updates customer totals).
  useEffect(() => {
    if (!rid) return;
    const ch = supabase
      .channel(`crm-orders-${rid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${rid}` }, () => {
        qc.invalidateQueries({ queryKey: ["customers", rid] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "customers", filter: `restaurant_id=eq.${rid}` }, () => {
        qc.invalidateQueries({ queryKey: ["customers", rid] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [rid, qc]);

  const { data: customerOrders } = useQuery({
    queryKey: ["customer-orders", selectedCustomer?.id],
    enabled: !!selectedCustomer?.id,
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("id, total, status, created_at, order_items(name, quantity)")
        .eq("customer_id", selectedCustomer.id).order("created_at", { ascending: false }).limit(10);
      return data ?? [];
    },
  });

  const { data: customerLogs } = useQuery({
    queryKey: ["customer-logs", selectedCustomer?.id],
    enabled: !!selectedCustomer?.id && !!rid,
    queryFn: async () => {
      const { data } = await supabase.from("message_logs").select("*")
        .eq("customer_id", selectedCustomer.id).eq("restaurant_id", rid!).order("sent_at", { ascending: false }).limit(10);
      return data ?? [];
    },
  });

  const { data: coupons = [] } = useQuery({
    queryKey: ["coupons", rid],
    enabled: !!rid,
    queryFn: async () => {
      const { data } = await supabase.from("coupons").select("*").eq("restaurant_id", rid!).order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  const { data: customerCouponUsages = [] } = useQuery({
    queryKey: ["coupon-usages", selectedCustomer?.id],
    enabled: !!selectedCustomer?.id,
    queryFn: async () => {
      const { data } = await supabase.from("coupon_usages").select("*, coupons(code, discount_type, discount_value)")
        .eq("customer_id", selectedCustomer.id).order("used_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  const createCoupon = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("coupons").insert({
        restaurant_id: rid!,
        code: couponCode.toUpperCase(),
        description: couponDesc || null,
        discount_type: couponType,
        discount_value: Number(couponValue),
        max_uses: couponMaxUses ? Number(couponMaxUses) : null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coupons", rid] });
      setShowCouponForm(false);
      setCouponCode(""); setCouponDesc(""); setCouponValue(""); setCouponMaxUses("");
      toast.success("Cupom criado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const applyCoupon = useMutation({
    mutationFn: async () => {
      if (!selectedCouponId || !selectedCustomer?.id) throw new Error("Selecione um cupom");
      const { error } = await supabase.from("coupon_usages").insert({
        coupon_id: selectedCouponId,
        customer_id: selectedCustomer.id,
      } as any);
      if (error) throw error;
      // Increment uses_count
      const coupon = coupons.find((c: any) => c.id === selectedCouponId);
      if (coupon) {
        await supabase.from("coupons").update({ uses_count: (coupon.uses_count ?? 0) + 1 } as any).eq("id", selectedCouponId);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coupon-usages", selectedCustomer?.id] });
      qc.invalidateQueries({ queryKey: ["coupons", rid] });
      setShowApplyCoupon(false);
      setSelectedCouponId("");
      toast.success("Cupom aplicado ao cliente!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = (customers ?? []).filter((c) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.whatsapp.includes(search)) return false;
    if (segment !== "all") {
      const seg = getSegment(c);
      if (segment === "inactive_7d" && seg !== "inactive_7d" && seg !== "inactive_30d") return false;
      if (segment === "inactive_30d" && seg !== "inactive_30d") return false;
      if (segment === "new" && seg !== "new") return false;
      if (segment === "frequent" && seg !== "frequent") return false;
    }
    return true;
  });

  const segments: { key: Segment; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "new", label: "Novos" },
    { key: "frequent", label: "Frequentes" },
    { key: "inactive_7d", label: "Inativos 7d" },
    { key: "inactive_30d", label: "Inativos 30d" },
  ];

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-2xl md:text-3xl font-bold">👥 <span className="gradient-text">CRM — Clientes</span></h1>
          <Button size="sm" onClick={() => setShowCouponForm(true)}>
            <Ticket className="w-4 h-4 mr-1" /> Novo Cupom
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <Input placeholder="Buscar por nome ou WhatsApp..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs bg-card/60" />
          <div className="flex gap-2 flex-wrap">
            {segments.map((s) => (
              <button key={s.key} onClick={() => setSegment(s.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  segment === s.key ? "bg-primary text-primary-foreground" : "bg-card/60 text-muted-foreground hover:text-foreground"
                }`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Coupons summary */}
        {coupons.length > 0 && (
          <div className="glass-card p-4 mb-6">
            <h3 className="font-display font-bold text-sm mb-2 flex items-center gap-2"><Tag className="w-4 h-4 text-primary" /> Cupons Ativos</h3>
            <div className="flex flex-wrap gap-2">
              {coupons.filter((c: any) => c.is_active).map((c: any) => (
                <div key={c.id} className="bg-primary/10 text-primary px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-2">
                  <span className="font-bold">{c.code}</span>
                  <span className="text-muted-foreground">
                    {c.discount_type === "percent" ? `${c.discount_value}%` : fmt(Number(c.discount_value))}
                  </span>
                  <span className="text-muted-foreground">{c.uses_count}{c.max_uses ? `/${c.max_uses}` : ""} usos</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(customers ?? []).length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground mb-2">Nenhum cliente cadastrado ainda.</p>
            <p className="text-xs text-muted-foreground">Clientes são cadastrados automaticamente quando fazem pedidos pelo cardápio QR.</p>
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Pedidos</TableHead>
                  <TableHead>Total Gasto</TableHead>
                  <TableHead>Último Pedido</TableHead>
                  <TableHead>Segmento</TableHead>
                  <TableHead>Marketing</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const seg = getSegment(c);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="font-mono text-sm">{c.whatsapp}</TableCell>
                      <TableCell>{c.total_orders}</TableCell>
                      <TableCell>{fmt(Number(c.total_spent))}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {c.last_order_at ? new Date(c.last_order_at).toLocaleDateString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${segmentColors[seg]}`}>
                          {segmentLabels[seg]}
                        </span>
                      </TableCell>
                      <TableCell>
                        {c.consent_marketing ? (
                          <Badge variant="outline" className="text-green-400 border-green-400/30">Sim</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">Não</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => setSelectedCustomer(c)}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Create Coupon Dialog */}
        <Dialog open={showCouponForm} onOpenChange={setShowCouponForm}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Novo Cupom</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Código</Label>
                <Input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} className="mt-1 font-mono uppercase" placeholder="EX: BEMVINDO10" />
              </div>
              <div>
                <Label>Descrição (opcional)</Label>
                <Input value={couponDesc} onChange={(e) => setCouponDesc(e.target.value)} className="mt-1" placeholder="10% de desconto para novos clientes" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo</Label>
                  <Select value={couponType} onValueChange={setCouponType}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Porcentagem (%)</SelectItem>
                      <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Valor</Label>
                  <Input type="number" value={couponValue} onChange={(e) => setCouponValue(e.target.value)} className="mt-1" placeholder={couponType === "percent" ? "10" : "5.00"} />
                </div>
              </div>
              <div>
                <Label>Limite de Usos (opcional)</Label>
                <Input type="number" value={couponMaxUses} onChange={(e) => setCouponMaxUses(e.target.value)} className="mt-1" placeholder="Sem limite" />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => createCoupon.mutate()} disabled={createCoupon.isPending || !couponCode || !couponValue}>
                  {createCoupon.isPending ? "Criando..." : "Criar Cupom"}
                </Button>
                <Button variant="outline" onClick={() => setShowCouponForm(false)}>Cancelar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Customer Profile Dialog */}
        <Dialog open={!!selectedCustomer} onOpenChange={() => setSelectedCustomer(null)}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Perfil do Cliente</DialogTitle></DialogHeader>
            {selectedCustomer && (
              <div className="space-y-4">
                <div className="glass-card p-4">
                  <h3 className="font-display font-bold text-lg">{selectedCustomer.name}</h3>
                  <p className="text-sm text-muted-foreground font-mono">{selectedCustomer.whatsapp}</p>
                  <div className="grid grid-cols-3 gap-3 mt-3">
                    <div className="text-center">
                      <p className="font-bold text-lg">{selectedCustomer.total_orders}</p>
                      <p className="text-xs text-muted-foreground">Pedidos</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-lg">{fmt(Number(selectedCustomer.total_spent))}</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                    <div className="text-center">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${segmentColors[getSegment(selectedCustomer)]}`}>
                        {segmentLabels[getSegment(selectedCustomer)]}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => {
                    const phone = selectedCustomer.whatsapp.replace(/\D/g, "");
                    window.open(`https://wa.me/${phone}`, "_blank");
                  }}>
                    <MessageSquare className="w-3.5 h-3.5 mr-1" /> Enviar WhatsApp
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowApplyCoupon(true)}>
                    <Ticket className="w-3.5 h-3.5 mr-1" /> Aplicar Cupom
                  </Button>
                </div>

                {/* Apply Coupon inline */}
                {showApplyCoupon && (
                  <div className="glass-card p-4 space-y-3">
                    <Label>Selecione o Cupom</Label>
                    <Select value={selectedCouponId} onValueChange={setSelectedCouponId}>
                      <SelectTrigger><SelectValue placeholder="Escolha um cupom..." /></SelectTrigger>
                      <SelectContent>
                        {coupons.filter((c: any) => c.is_active).map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.code} — {c.discount_type === "percent" ? `${c.discount_value}%` : fmt(Number(c.discount_value))}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => applyCoupon.mutate()} disabled={applyCoupon.isPending || !selectedCouponId}>
                        {applyCoupon.isPending ? "Aplicando..." : "Confirmar"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowApplyCoupon(false)}>Cancelar</Button>
                    </div>
                  </div>
                )}

                {/* Coupon usages */}
                {customerCouponUsages.length > 0 && (
                  <div>
                    <h4 className="font-display font-bold text-sm mb-2 flex items-center gap-1"><Ticket className="w-3.5 h-3.5" /> Cupons Usados</h4>
                    <div className="space-y-1">
                      {customerCouponUsages.map((u: any) => (
                        <div key={u.id} className="flex items-center justify-between text-sm border-b border-border pb-1">
                          <span className="font-mono text-xs text-primary">{u.coupons?.code ?? "—"}</span>
                          <span className="text-xs text-muted-foreground">
                            {u.coupons?.discount_type === "percent" ? `${u.coupons.discount_value}%` : fmt(Number(u.coupons?.discount_value ?? 0))}
                          </span>
                          <span className="text-xs text-muted-foreground">{new Date(u.used_at).toLocaleDateString("pt-BR")}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Orders */}
                <div>
                  <h4 className="font-display font-bold text-sm mb-2">Últimos Pedidos</h4>
                  {(customerOrders ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum pedido encontrado.</p>
                  ) : (
                    <div className="space-y-2">
                      {(customerOrders ?? []).map((order: any) => (
                        <div key={order.id} className="flex items-center justify-between text-sm border-b border-border pb-2">
                          <div>
                            <span className="font-mono text-xs text-muted-foreground">#{order.id.slice(0, 6)}</span>
                            <span className="ml-2 text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString("pt-BR")}</span>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {(order.order_items ?? []).map((i: any) => `${i.quantity}x ${i.name}`).join(", ")}
                            </div>
                          </div>
                          <span className="font-bold text-primary">{fmt(Number(order.total))}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Message Logs */}
                <div>
                  <h4 className="font-display font-bold text-sm mb-2">Mensagens Enviadas</h4>
                  {(customerLogs ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma mensagem enviada.</p>
                  ) : (
                    <div className="space-y-2">
                      {(customerLogs ?? []).map((log: any) => (
                        <div key={log.id} className="text-sm border-b border-border pb-2">
                          <div className="flex justify-between">
                            <span className="text-xs text-primary">{log.trigger}</span>
                            <div className="flex items-center gap-2">
                              {log.status && (
                                <span className={`text-xs ${log.status === "sent" ? "text-green-400" : "text-destructive"}`}>
                                  {log.status === "sent" ? "✓ Enviado" : "✗ Falhou"}
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground">{new Date(log.sent_at).toLocaleDateString("pt-BR")}</span>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{log.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default Customers;

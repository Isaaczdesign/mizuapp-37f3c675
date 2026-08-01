import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";
import { Plus, QrCode, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageShell, PageHeader } from "@/components/dashboard/ui";
import { tableMenuUrl } from "@/lib/publicMenuUrl";


const Tables = () => {
  const { profile } = useAuth();
  const rid = profile?.restaurant_id;
  const qc = useQueryClient();
  const [newNumber, setNewNumber] = useState("");
  const [qrTable, setQrTable] = useState<{ number: number; token: string } | null>(null);

  const { data: restaurant } = useQuery({
    queryKey: ["restaurant", rid],
    enabled: !!rid,
    queryFn: async () => {
      const { data } = await supabase.from("restaurants").select("slug").eq("id", rid!).single();
      return data;
    },
  });

  const { data: tables } = useQuery({
    queryKey: ["tables", rid],
    enabled: !!rid,
    queryFn: async () => {
      const { data } = await supabase
        .from("restaurant_tables")
        .select("*")
        .eq("restaurant_id", rid!)
        .order("number");
      return data ?? [];
    },
  });

  const addTable = useMutation({
    mutationFn: async (num: number) => {
      const { error } = await supabase.from("restaurant_tables").insert({
        restaurant_id: rid!,
        number: num,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tables", rid] });
      setNewNumber("");
      toast.success("Mesa criada!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteTable = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("restaurant_tables").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tables", rid] });
      toast.success("Mesa removida!");
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("restaurant_tables").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tables", rid] }),
  });

  const getQrUrl = (token: string) => tableMenuUrl(restaurant?.slug ?? "", token);


  return (
    <AdminLayout>
      <PageShell>
        <PageHeader emoji="🪑" title="Mesas & QR Codes" subtitle="Gerencie as mesas do salão e gere QR Codes de pedido." />

        <div className="flex gap-2 mb-6">
          <Input
            type="number"
            placeholder="Nº da mesa"
            value={newNumber}
            onChange={(e) => setNewNumber(e.target.value)}
            className="w-32 bg-card/60"
          />
          <Button
            onClick={() => {
              const n = parseInt(newNumber);
              if (!n || n <= 0) return toast.error("Número inválido");
              addTable.mutate(n);
            }}
            disabled={addTable.isPending}
          >
            <Plus className="w-4 h-4 mr-1" /> Adicionar
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {(tables ?? []).map((t) => (
            <div key={t.id} className={`glass-card p-4 text-center ${!t.is_active ? "opacity-50" : ""}`}>
              <p className="font-display text-2xl font-bold mb-1">#{t.number}</p>
              <p className="text-xs text-muted-foreground mb-3">
                {t.is_active ? "Ativa" : "Inativa"}
              </p>
              <div className="flex gap-1 justify-center">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setQrTable({ number: t.number, token: t.token })}
                >
                  <QrCode className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toggleActive.mutate({ id: t.id, active: !t.is_active })}
                >
                  {t.is_active ? "Off" : "On"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  onClick={() => deleteTable.mutate(t.id)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <Dialog open={!!qrTable} onOpenChange={() => setQrTable(null)}>
          <DialogContent className="sm:max-w-sm text-center">
            <DialogHeader>
              <DialogTitle>Mesa #{qrTable?.number}</DialogTitle>
            </DialogHeader>
            {qrTable && (
              <div className="flex flex-col items-center gap-4">
                <div className="bg-white p-4 rounded-xl">
                  <QRCodeSVG value={getQrUrl(qrTable.token)} size={200} />
                </div>
                <p className="text-xs text-muted-foreground break-all">{getQrUrl(qrTable.token)}</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(getQrUrl(qrTable.token));
                    toast.success("Link copiado!");
                  }}
                >
                  Copiar Link
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </PageShell>
    </AdminLayout>
  );
};

export default Tables;

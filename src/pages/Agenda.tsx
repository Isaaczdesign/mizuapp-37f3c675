import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Calendar as CalIcon } from "lucide-react";
import { format, startOfMonth, endOfMonth, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageShell, PageHeader } from "@/components/dashboard/ui";

const Agenda = () => {
  const { profile } = useAuth();
  const rid = profile?.restaurant_id;
  const qc = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDialog, setShowDialog] = useState(false);
  const [title, setTitle] = useState("");
  const [dateTime, setDateTime] = useState("");
  const [notes, setNotes] = useState("");

  const { data: appointments = [] } = useQuery({
    queryKey: ["appointments", rid],
    enabled: !!rid,
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("*")
        .eq("restaurant_id", rid!)
        .order("date_time", { ascending: true });
      return data ?? [];
    },
  });

  const createAppt = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("appointments").insert({
        restaurant_id: rid!,
        title,
        date_time: dateTime,
        notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments", rid] });
      setShowDialog(false);
      setTitle("");
      setDateTime("");
      setNotes("");
      toast.success("Compromisso adicionado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteAppt = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments", rid] });
      toast.success("Compromisso removido.");
    },
  });

  const dayAppointments = appointments.filter((a) => isSameDay(new Date(a.date_time), selectedDate));
  const datesWithAppts = appointments.map((a) => new Date(a.date_time));

  return (
    <AdminLayout>
      <PageShell className="max-w-4xl">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <PageHeader emoji="📅" title="Agenda" subtitle="Compromissos, reservas e lembretes do restaurante." />
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Novo Compromisso</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Compromisso</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createAppt.mutate(); }} className="space-y-4">
                <div>
                  <Label>Título</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Ex: Reunião com fornecedor" className="mt-1" />
                </div>
                <div>
                  <Label>Data e Hora</Label>
                  <Input type="datetime-local" value={dateTime} onChange={(e) => setDateTime(e.target.value)} required className="mt-1" />
                </div>
                <div>
                  <Label>Observações</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas opcionais" className="mt-1" rows={2} />
                </div>
                <Button type="submit" className="w-full" disabled={createAppt.isPending}>
                  {createAppt.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid md:grid-cols-[auto_1fr] gap-6">
          <div className="glass-card p-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => d && setSelectedDate(d)}
              locale={ptBR}
              modifiers={{ hasAppointment: datesWithAppts }}
              modifiersStyles={{ hasAppointment: { fontWeight: "bold", textDecoration: "underline", color: "hsl(var(--primary))" } }}
            />
          </div>

          <div className="space-y-3">
            <h2 className="font-display font-bold text-lg">
              {format(selectedDate, "dd 'de' MMMM, yyyy", { locale: ptBR })}
            </h2>
            {dayAppointments.length === 0 ? (
              <div className="glass-card p-6 text-center">
                <CalIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">Nenhum compromisso neste dia.</p>
              </div>
            ) : (
              dayAppointments.map((appt) => (
                <div key={appt.id} className="glass-card p-4 flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground">
                        {format(new Date(appt.date_time), "HH:mm")}
                      </span>
                      <span className="font-medium text-sm">{appt.title}</span>
                    </div>
                    {appt.notes && <p className="text-xs text-muted-foreground mt-1">{appt.notes}</p>}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteAppt.mutate(appt.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </PageShell>
    </AdminLayout>
  );
};

export default Agenda;

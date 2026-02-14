import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Save, Upload } from "lucide-react";

const DAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

type OperatingHours = Record<string, { open: string; close: string; closed: boolean }>;

const defaultHours: OperatingHours = Object.fromEntries(
  DAY_KEYS.map((k) => [k, { open: "11:00", close: "23:00", closed: false }])
);

const Settings = () => {
  const { profile } = useAuth();
  const rid = profile?.restaurant_id;
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [hours, setHours] = useState<OperatingHours>(defaultHours);

  const { data: restaurant } = useQuery({
    queryKey: ["restaurant", rid],
    enabled: !!rid,
    queryFn: async () => {
      const { data } = await supabase.from("restaurants").select("*").eq("id", rid!).single();
      return data;
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["settings", rid],
    enabled: !!rid,
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("*").eq("restaurant_id", rid!).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (restaurant) {
      setName(restaurant.name);
      setLogoPreview(restaurant.logo_url);
    }
  }, [restaurant]);

  useEffect(() => {
    if (settings?.operating_hours && typeof settings.operating_hours === "object" && !Array.isArray(settings.operating_hours)) {
      setHours({ ...defaultHours, ...(settings.operating_hours as OperatingHours) });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      let logo_url = restaurant?.logo_url ?? null;

      if (logoFile) {
        const ext = logoFile.name.split(".").pop();
        const path = `${rid}/logo.${ext}`;
        const { error: uploadError } = await supabase.storage.from("menu-images").upload(path, logoFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("menu-images").getPublicUrl(path);
        logo_url = urlData.publicUrl;
      }

      const { error: restError } = await supabase.from("restaurants").update({ name, logo_url }).eq("id", rid!);
      if (restError) throw restError;

      // Upsert settings with operating hours
      if (settings?.id) {
        const { error } = await supabase.from("settings").update({ operating_hours: hours as any }).eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("settings").insert({ restaurant_id: rid!, operating_hours: hours as any });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["restaurant", rid] });
      qc.invalidateQueries({ queryKey: ["settings", rid] });
      toast.success("Configurações salvas!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const updateHour = (day: string, field: "open" | "close", value: string) => {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
  };

  const toggleDay = (day: string) => {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], closed: !prev[day].closed } }));
  };

  return (
    <AdminLayout>
      <div className="p-6 max-w-2xl">
        <h1 className="font-display text-2xl md:text-3xl font-bold mb-6">⚙️ <span className="gradient-text">Configurações</span></h1>

        <div className="space-y-8">
          {/* Restaurant info */}
          <div className="glass-card p-6 space-y-4">
            <h2 className="font-display font-bold">Informações do Restaurante</h2>
            <div>
              <Label htmlFor="name">Nome</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Logomarca</Label>
              <div className="flex items-center gap-4 mt-2">
                {logoPreview && (
                  <img src={logoPreview} alt="Logo" className="w-16 h-16 rounded-xl object-cover border border-border" />
                )}
                <label className="cursor-pointer">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary text-sm hover:bg-secondary/80 transition-colors">
                    <Upload className="w-4 h-4" /> Enviar logo
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                </label>
              </div>
            </div>
          </div>

          {/* Operating hours */}
          <div className="glass-card p-6 space-y-4">
            <h2 className="font-display font-bold">Horário de Funcionamento</h2>
            <div className="space-y-3">
              {DAY_KEYS.map((key, i) => (
                <div key={key} className="flex items-center gap-3">
                  <button
                    onClick={() => toggleDay(key)}
                    className={`w-20 text-left text-sm font-medium transition-colors ${hours[key]?.closed ? "text-muted-foreground line-through" : "text-foreground"}`}
                  >
                    {DAYS[i]}
                  </button>
                  {hours[key]?.closed ? (
                    <span className="text-sm text-muted-foreground">Fechado</span>
                  ) : (
                    <>
                      <Input
                        type="time"
                        value={hours[key]?.open ?? "11:00"}
                        onChange={(e) => updateHour(key, "open", e.target.value)}
                        className="w-28 text-sm"
                      />
                      <span className="text-muted-foreground text-sm">até</span>
                      <Input
                        type="time"
                        value={hours[key]?.close ?? "23:00"}
                        onChange={(e) => updateHour(key, "close", e.target.value)}
                        className="w-28 text-sm"
                      />
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full">
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
};

export default Settings;

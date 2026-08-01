import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Download, QrCode, Sparkles, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { menuUrl } from "@/lib/publicMenuUrl";

type Props = {
  slug: string;
  restaurantName: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  shortCode?: string | null;
  onShortCodeGenerated?: (code: string) => void;
};

/**
 * Botão + modal com QR estilizado (logo embutido, cor da marca),
 * link curto e download em PNG 1024px.
 */
export default function MenuLinkQR({
  slug, restaurantName, logoUrl, primaryColor, shortCode, onShortCodeGenerated,
}: Props) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<string | null>(shortCode ?? null);
  const [generating, setGenerating] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setCode(shortCode ?? null); }, [shortCode]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const fullUrl = menuUrl(slug, origin);
  const shortUrl = code ? `${origin}/q/${code}` : null;
  const primary = primaryColor && /^#[0-9A-Fa-f]{6}$/.test(primaryColor) ? primaryColor : "#E84310";

  const copy = async (text: string, label = "Link") => {
    try { await navigator.clipboard.writeText(text); toast.success(`${label} copiado!`); }
    catch { toast.error("Não foi possível copiar"); }
  };

  const generateShort = async () => {
    setGenerating(true);
    const { data, error } = await (supabase as any).rpc("generate_restaurant_short_code");
    setGenerating(false);
    if (error) { toast.error(error.message); return; }
    setCode(data as string);
    onShortCodeGenerated?.(data as string);
    toast.success("Link curto gerado!");
  };

  const downloadPng = async () => {
    // Render a high-res QR into an offscreen canvas + brand frame
    const url = shortUrl || fullUrl;
    const SIZE = 1024;
    const PADDING = 96;
    const canvas = document.createElement("canvas");
    canvas.width = SIZE; canvas.height = SIZE + 160;
    const ctx = canvas.getContext("2d")!;
    // Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Colored top strip
    ctx.fillStyle = primary;
    ctx.fillRect(0, 0, canvas.width, 24);
    // Title
    ctx.fillStyle = "#111111";
    ctx.font = "600 42px 'Space Grotesk', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(restaurantName || "Cardápio", SIZE / 2, 96);
    ctx.fillStyle = "#555";
    ctx.font = "400 24px 'Inter', system-ui, sans-serif";
    ctx.fillText("Aponte a câmera para ver o cardápio", SIZE / 2, 132);

    // QR onto temp canvas
    const qrCanvas = document.createElement("canvas");
    const qrSize = SIZE - PADDING * 2;
    // Use a temporary React QR by creating one via qrcode lib not available;
    // pull from the on-screen canvas instead.
    const src = previewRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    if (!src) { toast.error("Erro ao gerar QR"); return; }
    // Draw scaled-up QR
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, PADDING, 180, qrSize, qrSize);

    // Footer with URL
    ctx.fillStyle = "#111";
    ctx.font = "500 28px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    const label = (shortUrl || fullUrl).replace(/^https?:\/\//, "");
    ctx.fillText(label, SIZE / 2, SIZE + 130);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `cardapio-${slug}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    }, "image/png");
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <QrCode className="w-4 h-4 mr-1" /> QR Code & Link
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> Compartilhe seu cardápio
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* QR preview */}
            <div
              ref={previewRef}
              className="mx-auto w-fit rounded-2xl p-6 border-2"
              style={{ borderColor: primary, background: "#fff" }}
            >
              <QRCodeCanvas
                value={shortUrl || fullUrl}
                size={240}
                level="H"
                fgColor="#111111"
                bgColor="#ffffff"
                imageSettings={
                  logoUrl
                    ? { src: logoUrl, height: 48, width: 48, excavate: true, x: undefined, y: undefined }
                    : undefined
                }
              />
            </div>

            {/* Short link */}
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Link curto</Label>
              {shortUrl ? (
                <div className="mt-1 flex items-center gap-2 rounded-xl bg-secondary/50 border border-border p-2">
                  <LinkIcon className="w-4 h-4 text-primary shrink-0 ml-1" />
                  <span className="flex-1 font-mono text-sm truncate">{shortUrl.replace(/^https?:\/\//, "")}</span>
                  <Button variant="ghost" size="sm" onClick={() => copy(shortUrl, "Link curto")}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="secondary"
                  className="w-full mt-1"
                  onClick={generateShort}
                  disabled={generating}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  {generating ? "Gerando…" : "Gerar link curto (ex: /q/a4k7m)"}
                </Button>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Perfeito para colocar em mesas, panfletos e cartões de visita.
              </p>
            </div>

            {/* Full link */}
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Link completo</Label>
              <div className="mt-1 flex items-center gap-2 rounded-xl bg-secondary/50 border border-border p-2">
                <Input readOnly value={fullUrl} className="border-0 bg-transparent px-1 h-auto font-mono text-sm focus-visible:ring-0" />
                <Button variant="ghost" size="sm" onClick={() => copy(fullUrl, "Link")}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="default" className="flex-1" onClick={downloadPng}>
                <Download className="w-4 h-4 mr-2" /> Baixar QR (PNG)
              </Button>
              <Button variant="outline" onClick={() => window.open(fullUrl, "_blank")}>
                Abrir cardápio
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

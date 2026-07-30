import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AutoResizeTextarea } from "@/components/public-menu/AutoResizeTextarea";
import { useSheetViewport, useKeyboardFocusScroll } from "@/hooks/useSheetViewport";

/**
 * Página de harness usada apenas em desenvolvimento/E2E.
 * Reproduz o sheet do checkout (com animações + campo "Observações")
 * para validar expansão do textarea e retenção de foco nas transições.
 */
export default function DevSheetHarness() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [notes, setNotes] = useState("");
  const sheetViewport = useSheetViewport(open);
  useKeyboardFocusScroll(open);

  return (
    <div className="min-h-screen bg-background p-6">
      <h1 className="text-lg font-semibold mb-4">Sheet harness (dev)</h1>
      <button
        data-testid="open-sheet"
        className="px-4 py-3 rounded-xl bg-primary text-primary-foreground"
        onClick={() => setOpen(true)}
      >
        Abrir sheet
      </button>

      <div style={{ height: 2000 }} aria-hidden />

      <AnimatePresence>
        {open && (
          <motion.div className="z-50" style={sheetViewport} data-testid="sheet-root">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              className="absolute inset-x-0 bottom-0 max-h-full flex flex-col bg-card rounded-t-2xl overflow-hidden"
              data-testid="sheet-panel"
            >
              <div className="p-4 border-b border-border flex items-center justify-between">
                <span data-testid="sheet-step">Etapa {step + 1}</span>
                <button data-testid="next-step" onClick={() => setStep((s) => (s + 1) % 3)}>
                  Avançar
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4" data-testid="sheet-scroller">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-xl bg-muted" />
                ))}
                <label className="block text-sm" htmlFor="notes">
                  Observações
                </label>
                <AutoResizeTextarea
                  id="notes"
                  data-testid="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex.: sem cebola"
                  className="w-full rounded-xl bg-muted p-3 text-[16px]"
                />
                <div className="h-24" />
              </div>

              <div className="p-4 border-t border-border">
                <button data-testid="close-sheet" onClick={() => setOpen(false)}>
                  Fechar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

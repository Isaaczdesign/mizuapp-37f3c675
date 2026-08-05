import { MessageCircle } from "lucide-react";
import { whatsappUrl } from "@/lib/siteConfig";

/** Botão flutuante discreto de contato via WhatsApp. */
export function WhatsAppFab() {
  return (
    <a
      href={whatsappUrl()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar pelo WhatsApp"
      className="fixed z-40 right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] md:right-6 md:bottom-6 inline-flex items-center gap-2 h-12 px-4 rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-[1.03] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <MessageCircle className="h-5 w-5" aria-hidden="true" />
      <span className="hidden sm:inline text-sm font-medium">WhatsApp</span>
    </a>
  );
}

export default WhatsAppFab;

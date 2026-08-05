import type { ReactNode } from "react";
import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouter,
} from "@tanstack/react-router";
import { MotionConfig } from "framer-motion";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import ActiveOrderFab from "@/components/ActiveOrderFab";
import NotFound from "@/pages/NotFound";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import appCss from "../styles.css?url";

const DESCRIPTION =
  "Cardápio QR, KDS, CRM e WhatsApp automático para restaurantes japoneses. Aumente o ticket médio e fidelize clientes.";
const TITLE = "Mizu — Gestão de Restaurantes";
const OG_IMAGE =
  "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7f3e74a6-d531-4011-bdf3-c4182cd710aa/id-preview-6ef75c7d--331c0092-c0a8-486f-aedb-403279b01e76.lovable.app-1771119746740.png";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0" },
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "author", content: "Mizu" },
      { name: "theme-color", content: "#111111" },
      { httpEquiv: "Strict-Transport-Security", content: "max-age=63072000; includeSubDomains; preload" },
      { httpEquiv: "X-Content-Type-Options", content: "nosniff" },
      { name: "referrer", content: "strict-origin-when-cross-origin" },
      { httpEquiv: "Permissions-Policy", content: "camera=(), microphone=(), geolocation=(self)" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:image", content: OG_IMAGE },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: () => <NotFound />,
  errorComponent: RootErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      storageKey="mizu-theme"
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <MotionConfig reducedMotion="user">
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <AuthProvider>
              <ActiveOrderFab />
              <Outlet />
            </AuthProvider>
          </TooltipProvider>
        </MotionConfig>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

function RootErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  console.error(error);
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-xl font-semibold font-display">Esta página não carregou</h1>
        <p className="text-sm text-muted-foreground">
          Algo deu errado do nosso lado. Você pode tentar novamente ou voltar para o início.
        </p>
        <div className="flex items-center justify-center gap-2">
          <button
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Tentar novamente
          </button>
          <a
            className="px-4 py-2 rounded-lg border border-border text-sm font-medium"
            href="/"
          >
            Voltar ao início
          </a>
        </div>
      </div>
    </div>
  );
}

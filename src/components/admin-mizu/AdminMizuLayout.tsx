import { type ReactNode, useState } from "react";
import { Link, NavLink, Navigate, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Store, Users, Package, CreditCard, Receipt, Ticket, LifeBuoy,
  Bell, ScrollText, Settings, Menu, LogOut, ShieldAlert, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { usePlatformRole } from "@/hooks/usePlatformRole";

const NAV: { to: string; label: string; icon: any; end?: boolean; superAdminOnly?: boolean }[] = [
  { to: "/admin-mizu", label: "Visão geral", icon: LayoutDashboard, end: true },
  { to: "/admin-mizu/restaurantes", label: "Restaurantes", icon: Store },
  { to: "/admin-mizu/usuarios", label: "Usuários", icon: Users },
  { to: "/admin-mizu/planos", label: "Planos", icon: Package },
  { to: "/admin-mizu/assinaturas", label: "Assinaturas", icon: CreditCard },
  { to: "/admin-mizu/pagamentos", label: "Pagamentos", icon: Receipt },
  { to: "/admin-mizu/cupons", label: "Cupons", icon: Ticket },
  { to: "/admin-mizu/suporte", label: "Suporte", icon: LifeBuoy },
  { to: "/admin-mizu/notificacoes", label: "Notificações", icon: Bell },
  { to: "/admin-mizu/observacoes-excluidas", label: "Obs. excluídas", icon: Trash2, superAdminOnly: true },
  { to: "/admin-mizu/logs", label: "Logs", icon: ScrollText },
  { to: "/admin-mizu/configuracoes", label: "Configurações", icon: Settings },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { isSuperAdmin } = usePlatformRole();
  return (
    <nav className="space-y-1">
      {NAV.filter((item) => !item.superAdminOnly || isSuperAdmin).map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors ${
              isActive ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            }`
          }
        >
          <item.icon className="h-4 w-4" /> {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function AdminMizuLayout({ title, description, actions, children }: {
  title: string; description?: string; actions?: ReactNode; children: ReactNode;
}) {
  const { loading, isStaff, roles } = usePlatformRole();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isStaff) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="flex h-14 items-center gap-3 px-4">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu administrativo">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[84vw] max-w-xs overflow-y-auto">
              <p className="mb-4 mt-6 font-display text-sm font-semibold">Painel Mizu</p>
              <NavList onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>

          <Link to="/admin-mizu" className="font-display text-sm font-semibold">
            Mizu <span className="text-muted-foreground">· Administração</span>
          </Link>
          <span className="hidden rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground sm:inline">
            {roles.join(" · ")}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <LogOut className="mr-1.5 h-4 w-4" /> Sair do painel
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1400px] lg:grid-cols-[232px_1fr]">
        <aside className="hidden border-r border-border p-3 lg:block">
          <NavList />
          <p className="mt-6 flex items-start gap-2 rounded-lg border border-border p-3 text-[11px] text-muted-foreground">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            Todas as ações administrativas são registradas em auditoria.
          </p>
        </aside>

        <main className="min-w-0 p-4 md:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-xl font-bold md:text-2xl">{title}</h1>
              {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
            </div>
            {actions}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

export default AdminMizuLayout;

import { type ReactNode, useState } from "react";
import { Link, NavLink, Navigate, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Store, Users, Package, CreditCard, Receipt, Ticket, LifeBuoy,
  Bell, ScrollText, Settings, Menu, LogOut, ShieldAlert, Trash2, Megaphone, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { usePlatformRole } from "@/hooks/usePlatformRole";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: any; end?: boolean; superAdminOnly?: boolean };

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Operação",
    items: [
      { to: "/admin-mizu", label: "Visão geral", icon: LayoutDashboard, end: true },
      { to: "/admin-mizu/restaurantes", label: "Restaurantes", icon: Store },
      { to: "/admin-mizu/usuarios", label: "Usuários", icon: Users },
    ],
  },
  {
    title: "Comercial",
    items: [
      { to: "/admin-mizu/planos", label: "Planos", icon: Package },
      { to: "/admin-mizu/assinaturas", label: "Assinaturas", icon: CreditCard },
      { to: "/admin-mizu/pagamentos", label: "Pagamentos", icon: Receipt },
      { to: "/admin-mizu/cupons", label: "Cupons", icon: Ticket },
    ],
  },
  {
    title: "Comunicação",
    items: [
      { to: "/admin-mizu/notificacoes", label: "Notificações", icon: Bell, end: true },
      { to: "/admin-mizu/notificacoes/atualizacoes", label: "Atualizações", icon: Megaphone },
      { to: "/admin-mizu/suporte", label: "Suporte", icon: LifeBuoy },
    ],
  },
  {
    title: "Sistema",
    items: [
      { to: "/admin-mizu/observacoes-excluidas", label: "Obs. excluídas", icon: Trash2, superAdminOnly: true },
      { to: "/admin-mizu/moderacao", label: "Auditoria de moderação", icon: ShieldAlert },
      { to: "/admin-mizu/logs", label: "Logs e auditoria", icon: ScrollText },
      { to: "/admin-mizu/configuracoes", label: "Configurações", icon: Settings },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { isSuperAdmin } = usePlatformRole();
  return (
    <nav className="space-y-5">
      {NAV_GROUPS.map((group) => {
        const items = group.items.filter((i) => !i.superAdminOnly || isSuperAdmin);
        if (items.length === 0) return null;
        return (
          <div key={group.title}>
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
              {group.title}
            </p>
            <div className="space-y-0.5">
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-primary/10 font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={cn(
                          "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary transition-opacity",
                          isActive ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <item.icon className={cn("h-4 w-4 shrink-0", isActive && "text-primary")} />
                      <span className="truncate">{item.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

export function AdminMizuLayout({ title, description, actions, children }: {
  title: string; description?: string; actions?: ReactNode; children: ReactNode;
}) {
  const { loading, isStaff, roles } = usePlatformRole();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const current = ALL_ITEMS.filter((i) => (i.end ? pathname === i.to : pathname.startsWith(i.to)))
    .sort((a, b) => b.to.length - a.to.length)[0];
  const group = NAV_GROUPS.find((g) => g.items.some((i) => i === current));

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
        <div className="mx-auto flex h-14 max-w-[1500px] items-center gap-3 px-4">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu administrativo">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[86vw] max-w-xs overflow-y-auto">
              <p className="mb-5 mt-6 font-display text-sm font-semibold">
                Mizu <span className="text-muted-foreground">· Administração</span>
              </p>
              <NavList onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>

          <Link to="/admin-mizu" className="flex items-center gap-2 font-display text-sm font-semibold">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <ShieldAlert className="h-4 w-4" />
            </span>
            Mizu <span className="hidden text-muted-foreground sm:inline">· Administração</span>
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

      <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[236px_1fr]">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] overflow-y-auto border-r border-border p-3 lg:block">
          <NavList />
          <p className="mt-6 flex items-start gap-2 rounded-xl border border-border bg-card/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            Todas as ações administrativas são registradas em auditoria.
          </p>
        </aside>

        <main className="min-w-0 p-4 md:p-6 lg:p-8">
          <div className="mb-6 border-b border-border/60 pb-5">
            {group && (
              <nav aria-label="Trilha" className="mb-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                <span>{group.title}</span>
                <ChevronRight className="h-3 w-3" />
                <span className="text-foreground/80">{current?.label ?? title}</span>
              </nav>
            )}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="font-display text-2xl font-bold tracking-tight md:text-[28px]">{title}</h1>
                {description && (
                  <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
                )}
              </div>
              {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
            </div>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

export default AdminMizuLayout;

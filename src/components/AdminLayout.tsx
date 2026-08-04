import { useAuth } from "@/hooks/useAuth";
import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, ShoppingBag, ChefHat, UtensilsCrossed, Users, QrCode, Calendar, LogOut, Settings, Bell, Menu, X, Lock, UserRound, Star, LifeBuoy } from "lucide-react";
import { supportWhatsappUrl } from "@/lib/whatsappTemplates";
import { useEffect, useRef, useState, type ReactNode } from "react";
import OrderNotificationProvider from "@/components/OrderNotificationProvider";
import { usePendingOrdersCount } from "@/hooks/usePendingOrdersCount";
import { Logo } from "@/components/Logo";
import GuidedTour from "@/components/GuidedTour";
import PlatformAnnouncementBanner from "@/components/PlatformAnnouncementBanner";
import ThemeToggle from "@/components/ThemeToggle";


type NavItem = { to: string; icon: typeof LayoutDashboard; label: string; roles?: string[]; end?: boolean };

const allNavItems: NavItem[] = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", roles: ["owner", "manager"] },
  { to: "/orders", icon: ShoppingBag, label: "Pedidos", roles: ["owner", "manager", "staff"] },
  { to: "/kds", icon: ChefHat, label: "Cozinha" },
  { to: "/menu-admin", icon: UtensilsCrossed, label: "Cardápio", roles: ["owner", "manager"] },
  { to: "/customers", icon: Users, label: "CRM", roles: ["owner", "manager", "staff"] },
  { to: "/avaliacoes", icon: Star, label: "Avaliações", roles: ["owner", "manager"] },
  { to: "/tables", icon: QrCode, label: "Mesas", roles: ["owner", "manager"] },
  // { to: "/automations", icon: Zap, label: "Automações", roles: ["owner", "manager"] },
  { to: "/agenda", icon: Calendar, label: "Agenda", roles: ["owner", "manager", "staff"] },
  { to: "/expediente", icon: Lock, label: "Expediente", roles: ["owner", "manager"] },
];

const bottomItems: NavItem[] = [

  { to: "/perfil", icon: UserRound, label: "Meu perfil" },
  { to: "/settings/notifications", icon: Bell, label: "Notificações" },
  { to: "/settings", icon: Settings, label: "Configurações", roles: ["owner", "manager"], end: true },
];


function filterByRole(items: NavItem[], roles: string[]): NavItem[] {
  return items.filter((item) => {
    if (!item.roles) return true;
    return item.roles.some((r) => roles.includes(r));
  });
}

export default function AdminLayout({ children, collapsible = false }: { children: ReactNode; collapsible?: boolean }) {
  const { signOut, roles } = useAuth();
  const navigate = useNavigate();
  const userRoles = roles.length > 0 ? roles : ["owner"];
  const pendingOrders = usePendingOrdersCount();

  const navItems = filterByRole(allNavItems, userRoles);
  const bottomNav = filterByRole(bottomItems, userRoles);

  // Desktop hover-expand state
  const [expanded, setExpanded] = useState(false);
  const collapseTimer = useRef<number | null>(null);

  const openSidebar = () => {
    if (collapseTimer.current) window.clearTimeout(collapseTimer.current);
    setExpanded(true);
  };
  const closeSidebar = () => {
    if (collapseTimer.current) window.clearTimeout(collapseTimer.current);
    collapseTimer.current = window.setTimeout(() => setExpanded(false), 150);
  };
  useEffect(() => () => {
    if (collapseTimer.current) window.clearTimeout(collapseTimer.current);
  }, []);

  // Mobile drawer open state (session only)
  const [mobileOpen, setMobileOpen] = useState(false);

  // Lock scroll (html + body) when mobile drawer is open — avoids background scroll and layout jumps
  useEffect(() => {
    if (!mobileOpen) return;
    const html = document.documentElement;
    const body = document.body;
    // Compensate scrollbar width to prevent horizontal shift on desktops with visible scrollbar
    const scrollbarW = window.innerWidth - html.clientWidth;
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPaddingRight: body.style.paddingRight,
    };
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    if (scrollbarW > 0) body.style.paddingRight = `${scrollbarW}px`;
    return () => {
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      body.style.paddingRight = prev.bodyPaddingRight;
    };
  }, [mobileOpen]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const renderNav = (onNavigate?: () => void, isOpen = true) => {
    const labelCls = `truncate transition-[opacity,transform] duration-300 ease-in-out motion-reduce:transition-none ${
      isOpen ? "opacity-100 translate-x-0 delay-75" : "opacity-0 -translate-x-2"
    }`;
    const rowCls = `group relative flex items-center gap-3 py-2.5 rounded-2xl text-sm transition-all duration-200 ${
      isOpen ? "px-3" : "px-0 justify-center"
    }`;
    const tooltip = (label: string) =>
      !isOpen ? (
        <span className="pointer-events-none absolute left-[72px] z-50 whitespace-nowrap rounded-lg border border-border bg-popover px-2 py-1 text-xs text-popover-foreground opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
          {label}
        </span>
      ) : null;

    return (
    <>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto overflow-x-hidden">
        <p
          className={`px-3 pb-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70 font-semibold transition-[opacity,transform] duration-300 ease-in-out motion-reduce:transition-none ${
            isOpen ? "opacity-100 translate-x-0 delay-75" : "opacity-0 -translate-x-2"
          }`}
        >
          Operação
        </p>
        {navItems.map((item) => {
          const showBadge = item.to === "/orders" && pendingOrders > 0;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              title={!isOpen ? item.label : undefined}
              className={({ isActive }) =>
                `${rowCls} ${
                  isActive
                    ? "bg-accent/10 text-foreground font-medium border border-accent/20 shadow-[0_8px_24px_-16px_hsl(var(--accent)/0.8)]"
                    : "text-muted-foreground border border-transparent hover:text-foreground hover:bg-secondary/60"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-accent shadow-[0_0_12px_hsl(var(--accent)/0.8)]" />
                  )}
                  <span className="relative shrink-0">
                    <item.icon className={`w-4 h-4 transition-colors ${isActive ? "text-accent" : "group-hover:text-foreground"}`} />
                    {showBadge && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center animate-pulse">
                        {pendingOrders > 99 ? "99+" : pendingOrders}
                      </span>
                    )}
                  </span>
                  {isOpen && <span className={`${labelCls} flex-1`}>{item.label}</span>}
                  {showBadge && isOpen && (
                    <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center">
                      {pendingOrders > 99 ? "99+" : pendingOrders}
                    </span>
                  )}
                  {tooltip(item.label)}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
      <div className="p-3 border-t border-border/60 space-y-1">
        {bottomNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            title={!isOpen ? item.label : undefined}
            className={({ isActive }) =>
              `${rowCls} ${
                isActive
                  ? "bg-accent/10 text-foreground font-medium border border-accent/20"
                  : "text-muted-foreground border border-transparent hover:text-foreground hover:bg-secondary/60"
              }`
            }
          >
            <item.icon className="w-4 h-4 shrink-0" />
            {isOpen && <span className={labelCls}>{item.label}</span>}
            {tooltip(item.label)}
          </NavLink>
        ))}
        <a
          href={supportWhatsappUrl()}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onNavigate}
          title={!isOpen ? "Suporte" : undefined}
          className={`${rowCls} text-muted-foreground border border-transparent hover:text-foreground hover:bg-secondary/60`}
        >
          <LifeBuoy className="w-4 h-4 shrink-0" />
          {isOpen && <span className={labelCls}>Suporte</span>}
          {tooltip("Suporte")}
        </a>
        <button
          onClick={handleSignOut}
          title={!isOpen ? "Sair" : undefined}
          className={`${rowCls} w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10`}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {isOpen && <span className={labelCls}>Sair</span>}
          {tooltip("Sair")}
        </button>
      </div>
    </>
    );
  };



  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop hover-expand sidebar — overlays content, never pushes it */}
      <div className="hidden md:block shrink-0 w-[76px]" aria-hidden="true" />
      <aside
        onMouseEnter={openSidebar}
        onMouseLeave={closeSidebar}
        onFocusCapture={openSidebar}
        onBlurCapture={closeSidebar}
        className={`hidden md:flex fixed top-0 left-0 z-40 h-screen flex-col border-r border-border/60 bg-card/80 backdrop-blur-2xl overflow-hidden transition-[width,box-shadow] duration-300 ease-in-out motion-reduce:transition-none ${
          expanded ? "w-64 shadow-[8px_0_32px_-12px_hsl(0_0%_0%/0.45)]" : "w-[76px]"
        }`}
      >
        <div className="relative h-[76px] shrink-0 px-4 border-b border-border/60 flex items-center gap-2">
          <div className="pointer-events-none absolute -top-16 left-0 w-40 h-40 rounded-full bg-accent/10 blur-3xl" />
          <a
            href="/"
            aria-label="Mizu"
            className={`relative transition-transform duration-200 hover:scale-[1.03] ${expanded ? "" : "mx-auto"}`}
          >
            <Logo variant={expanded ? "full" : "mark"} className={expanded ? "h-9 shrink-0" : "h-8 w-8 shrink-0"} />
          </a>
          <div
            className={`relative ml-auto flex items-center gap-1 transition-opacity duration-200 motion-reduce:transition-none ${
              expanded ? "opacity-100 delay-100" : "opacity-0 pointer-events-none"
            }`}
          >
            <ThemeToggle />
          </div>
        </div>
        <div className="flex-1 flex flex-col min-h-0">
          {renderNav(undefined, expanded)}
        </div>
      </aside>


      {/* Mobile top bar with menu button (only when collapsible) */}
      {collapsible && (
        <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-12 flex items-center justify-between px-3 bg-card/80 backdrop-blur-xl border-b border-border">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-md hover:bg-secondary text-foreground"
            aria-label="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <a href="/" aria-label="Mizu"><Logo className="h-7" /></a>
          <ThemeToggle />
        </div>
      )}

      {/* Mobile drawer overlay — available in both modes */}
      <>
        {/* Backdrop */}
        <div
          onClick={() => setMobileOpen(false)}
          className={`md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
            mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
          aria-hidden="true"
        />
        {/* Drawer */}
        <aside
          className={`md:hidden fixed top-0 left-0 z-50 h-full w-[82vw] max-w-xs flex flex-col bg-card border-r border-border shadow-2xl transition-transform duration-300 ease-in-out ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          role="dialog"
          aria-modal="true"
          aria-label="Menu de navegação"
        >
          <div className="p-4 border-b border-border flex items-center justify-between">
            <a href="/" aria-label="Mizu" onClick={() => setMobileOpen(false)}><Logo className="h-8" /></a>
            <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              onClick={() => setMobileOpen(false)}
              className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
              aria-label="Fechar menu"
            >
              <X className="w-5 h-5" />
            </button>
            </div>
          </div>
          {renderNav(() => setMobileOpen(false))}
        </aside>
      </>

      {/* Mobile floating bottom nav — only when NOT collapsible (default behavior) */}
      {!collapsible && (
        <div className="md:hidden fixed bottom-3 left-3 right-3 z-40 safe-area-bottom pointer-events-none">
          <nav className="pointer-events-auto flex items-center justify-around gap-1 px-2 py-1.5 rounded-2xl bg-card/90 backdrop-blur-xl border border-border shadow-2xl">
            {navItems.slice(0, 4).map((item) => {
              const showBadge = item.to === "/orders" && pendingOrders > 0;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-xl text-[10px] transition-colors flex-1 min-w-0 ${
                      isActive ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                    }`
                  }
                >
                  <span className="relative shrink-0">
                    <item.icon className="w-5 h-5" />
                    {showBadge && (
                      <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center animate-pulse">
                        {pendingOrders > 99 ? "99+" : pendingOrders}
                      </span>
                    )}
                  </span>
                  <span className="truncate max-w-full">{item.label}</span>
                </NavLink>
              );
            })}
            <button
              onClick={() => setMobileOpen(true)}
              className="flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-xl text-[10px] text-muted-foreground hover:text-foreground transition-colors flex-1 min-w-0"
              aria-label="Abrir menu completo"
            >
              <Menu className="w-5 h-5 shrink-0" />
              <span className="truncate max-w-full">Menu</span>
            </button>
          </nav>
        </div>
      )}

      {/* Main */}
      <main
        className={`flex-1 min-w-0 transition-[padding] duration-300 ${
          collapsible ? "pt-12 md:pt-0" : "pb-24 md:pb-0"
        }`}
      >
        <PlatformAnnouncementBanner />
        {children}

      </main>

      <GuidedTour />



      {/* Global order notifications */}
      <OrderNotificationProvider />
    </div>
  );
}

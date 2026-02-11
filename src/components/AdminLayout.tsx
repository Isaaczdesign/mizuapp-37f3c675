import { useAuth } from "@/hooks/useAuth";
import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, ShoppingBag, ChefHat, UtensilsCrossed, Users, QrCode, Zap, Calendar, LogOut, Settings } from "lucide-react";
import type { ReactNode } from "react";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/orders", icon: ShoppingBag, label: "Pedidos" },
  { to: "/kds", icon: ChefHat, label: "Cozinha" },
  { to: "/menu-admin", icon: UtensilsCrossed, label: "Cardápio" },
  { to: "/customers", icon: Users, label: "CRM" },
  { to: "/tables", icon: QrCode, label: "Mesas" },
  { to: "/automations", icon: Zap, label: "Automações" },
  { to: "/agenda", icon: Calendar, label: "Agenda" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar - desktop */}
      <aside className="hidden md:flex w-56 flex-col border-r border-border bg-card/40 backdrop-blur-xl">
        <div className="p-4 border-b border-border">
          <a href="/" className="font-display text-xl font-bold gradient-text">Kōban</a>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors ${
                  isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-2 border-t border-border">
          <button onClick={handleSignOut} className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:text-destructive w-full transition-colors">
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/80 backdrop-blur-xl border-t border-border safe-area-bottom">
        <nav className="flex justify-around py-1">
          {navItems.slice(0, 5).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-1.5 px-2 text-[10px] transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Main */}
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        {children}
      </main>
    </div>
  );
}

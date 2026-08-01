import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

/**
 * Alternador de tema (claro/escuro) usado no dashboard e no cardápio público.
 * `variant="menu"` usa os tokens do cardápio; `variant="admin"` usa os do app.
 */
export default function ThemeToggle({
  variant = "admin",
  className = "",
}: {
  variant?: "admin" | "menu";
  className?: string;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted ? resolvedTheme === "dark" : true;
  const label = isDark ? "Ativar modo claro" : "Ativar modo escuro";

  const base =
    variant === "menu"
      ? "w-11 h-11 rounded-full flex items-center justify-center text-[hsl(var(--menu-ink))] bg-[hsl(var(--menu-card)/0.72)] backdrop-blur-xl border border-[hsl(var(--menu-ink)/0.12)]"
      : "w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={label}
      title={label}
      className={`${base} transition-colors ${className}`}
    >
      {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
    </button>
  );
}

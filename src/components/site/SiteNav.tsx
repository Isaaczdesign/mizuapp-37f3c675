import { useState } from "react";
import { Link, useLocation, useNavigate } from "@/lib/router-compat";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/Logo";

const links = [
  { label: "Recursos", href: "/#recursos" },
  { label: "Demonstração", href: "/demonstracao" },
  { label: "Planos", href: "/#planos" },
  { label: "Perguntas frequentes", href: "/#faq" },
];

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const goHome = () => {
    if (location.pathname === "/") window.scrollTo({ top: 0, behavior: "smooth" });
    else navigate("/");
  };

  const go = (href: string) => {
    setOpen(false);
    if (href.startsWith("/#")) {
      const id = href.slice(2);
      if (location.pathname === "/") {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      navigate("/", { state: { scrollTo: id } });
      return;
    }
    navigate(href);
  };

  return (
    <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="container mx-auto flex items-center justify-between h-16 px-4">
        <button
          type="button"
          onClick={goHome}
          aria-label="Voltar ao início"
          className="flex items-center rounded-md transition-opacity hover:opacity-80 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Logo className="h-9" />
        </button>

        <div className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <button
              key={l.href}
              type="button"
              onClick={() => go(l.href)}
              className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            >
              {l.label}
            </button>
          ))}
        </div>

        <div className="hidden md:flex gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/auth">Entrar</Link>
          </Button>
          <Button variant="hero" size="sm" asChild>
            <Link to="/auth?mode=signup">Começar agora</Link>
          </Button>
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden min-h-11 min-w-11" aria-label="Abrir menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[86vw] max-w-xs">
            <div className="mt-8 flex flex-col gap-1">
              {links.map((l) => (
                <button
                  key={l.href}
                  type="button"
                  onClick={() => go(l.href)}
                  className="text-left px-3 py-3 min-h-11 rounded-lg text-base text-foreground hover:bg-muted transition-colors"
                >
                  {l.label}
                </button>
              ))}
              <div className="mt-6 flex flex-col gap-3">
                <Button variant="glass" size="lg" asChild onClick={() => setOpen(false)}>
                  <Link to="/auth">Entrar</Link>
                </Button>
                <Button variant="hero" size="lg" asChild onClick={() => setOpen(false)}>
                  <Link to="/auth?mode=signup">Começar agora</Link>
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}

export default SiteNav;

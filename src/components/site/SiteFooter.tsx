import { Link, useLocation, useNavigate } from "@/lib/router-compat";
import { Logo } from "@/components/Logo";
import { whatsappUrl } from "@/lib/siteConfig";

const columns: { title: string; items: { label: string; href: string; external?: boolean }[] }[] = [
  {
    title: "Produto",
    items: [
      { label: "Recursos", href: "/#recursos" },
      { label: "Como funciona", href: "/#como-funciona" },
      { label: "Demonstração", href: "/demonstracao" },
    ],
  },
  {
    title: "Planos",
    items: [
      { label: "Ver planos", href: "/#planos" },
      { label: "Perguntas frequentes", href: "/#faq" },
      { label: "Começar agora", href: "/auth?mode=signup" },
    ],
  },
  {
    title: "Suporte",
    items: [
      { label: "Falar pelo WhatsApp", href: whatsappUrl(), external: true },
      { label: "Entrar na conta", href: "/auth" },
    ],
  },
  {
    title: "Legal",
    items: [
      { label: "Termos de uso", href: "/#termos" },
      { label: "Política de privacidade", href: "/#privacidade" },
    ],
  },
];

export function SiteFooter() {
  const location = useLocation();
  const navigate = useNavigate();

  const goHome = () => {
    if (location.pathname === "/") window.scrollTo({ top: 0, behavior: "smooth" });
    else navigate("/");
  };

  const go = (href: string) => {
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
    <footer className="border-t border-border pt-12 pb-10 px-4">
      <div className="container mx-auto">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div className="max-w-xs">
            <button
              type="button"
              onClick={goHome}
              aria-label="Voltar ao início"
              className="inline-flex rounded-md cursor-pointer transition-opacity hover:opacity-80 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Logo className="h-8" />
            </button>
            <p className="mt-4 text-sm text-muted-foreground">
              Cardápio digital e gestão de pedidos para restaurantes que querem vender mais e operar melhor.
            </p>
            {/* TODO: incluir razão social, CNPJ e endereço quando disponíveis. */}
          </div>

          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h3 className="text-sm font-semibold mb-3">{col.title}</h3>
              <ul className="space-y-2">
                {col.items.map((item) => (
                  <li key={item.label}>
                    {item.external ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {item.label}
                      </a>
                    ) : item.href.startsWith("/#") ? (
                      <button
                        type="button"
                        onClick={() => go(item.href)}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {item.label}
                      </button>
                    ) : (
                      <Link
                        to={item.href}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {item.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-border text-sm text-muted-foreground">
          © 2026 Mizu — Gestão de Restaurantes. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}

export default SiteFooter;

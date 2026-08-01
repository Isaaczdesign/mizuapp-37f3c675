import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight, UserPlus, Paintbrush, QrCode, ShoppingBag, ListChecks, BellRing,
  Smartphone, MonitorSmartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import WhatsAppFab from "@/components/site/WhatsAppFab";
import PhoneDemo from "@/components/demo/PhoneDemo";
import DashboardDemo from "@/components/demo/DashboardDemo";
import usePageMeta from "@/hooks/usePageMeta";
import { SITE_URL, whatsappUrl } from "@/lib/siteConfig";

const journey = [
  { icon: UserPlus, title: "Crie sua conta", text: "Cadastro rápido, sem instalar nada." },
  { icon: Paintbrush, title: "Personalize o cardápio", text: "Categorias, fotos, preços e adicionais." },
  { icon: QrCode, title: "Compartilhe link ou QR", text: "Mesas, bio do Instagram e WhatsApp." },
  { icon: ShoppingBag, title: "O cliente pede", text: "Delivery, retirada ou consumo no local." },
  { icon: ListChecks, title: "Você gerencia", text: "Pedidos em tempo real e status num toque." },
  { icon: BellRing, title: "O cliente acompanha", text: "Status atualizado do preparo à entrega." },
];

const scrollTo = (id: string) =>
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

const Demonstracao = () => {
  usePageMeta({
    title: "Demonstração Mizu | Cardápio Digital e Gestão de Pedidos",
    description:
      "Veja na prática o cardápio digital e o painel de gestão da Mizu: pedidos em tempo real, delivery, retirada, mesas e acompanhamento do cliente.",
    canonical: `${SITE_URL}/demonstracao`,
  });

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <SiteNav />

      <main>
        {/* Hero */}
        <section className="section-padding pt-28 md:pt-36">
          <div className="container mx-auto max-w-3xl text-center">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="font-display text-3xl md:text-5xl font-bold leading-tight"
            >
              Veja como a <span className="gradient-text">Mizu</span> funciona na prática
            </motion.h1>
            <p className="mt-5 text-base md:text-lg text-muted-foreground max-w-xl mx-auto">
              Conheça a experiência do cardápio digital para o seu cliente e o painel de gestão que organiza
              toda a operação do restaurante — tudo com dados fictícios, sem afetar nenhum estabelecimento real.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="hero" size="lg" className="text-base" onClick={() => scrollTo("cardapio-demo")}>
                Testar cardápio demonstrativo
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button variant="glass" size="lg" className="text-base" onClick={() => scrollTo("painel-demo")}>
                Conhecer o painel de gestão
              </Button>
            </div>
          </div>
        </section>

        {/* Cardápio */}
        <section id="cardapio-demo" className="section-padding scroll-mt-20">
          <div className="container mx-auto grid gap-10 lg:grid-cols-2 lg:items-center">
            <div className="max-w-lg">
              <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                <Smartphone className="h-3.5 w-3.5" /> Experiência do cliente
              </span>
              <h2 className="mt-4 font-display text-2xl md:text-3xl font-bold">Cardápio digital no celular</h2>
              <p className="mt-3 text-muted-foreground">
                Navegue pelas etapas do pedido como o seu cliente faria: categorias, fotos e preços, adicionais,
                carrinho, escolha entre entrega, retirada ou consumo no local, forma de pagamento e acompanhamento.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                {[
                  "Categorias e busca de produtos",
                  "Fotos, descrições e preços",
                  "Personalização de adicionais",
                  "Carrinho e revisão do pedido",
                  "Entrega, retirada ou mesa",
                  "Pagamento e acompanhamento em tempo real",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" /> {f}
                  </li>
                ))}
              </ul>
              <Button variant="hero" className="mt-6" onClick={() => scrollTo("cardapio-demo")}>
                Explorar cardápio demonstrativo
              </Button>
            </div>
            <div className="flex justify-center">
              <PhoneDemo />
            </div>
          </div>
        </section>

        {/* Painel */}
        <section id="painel-demo" className="section-padding scroll-mt-20">
          <div className="container mx-auto">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                <MonitorSmartphone className="h-3.5 w-3.5" /> Gestão do restaurante
              </span>
              <h2 className="mt-4 font-display text-2xl md:text-3xl font-bold">Painel de gestão demonstrativo</h2>
              <p className="mt-3 text-muted-foreground">
                Uma demonstração guiada e interativa do painel: pedidos em tempo real separados por delivery,
                retirada e consumo no local, identificação da mesa, mudança de status, cadastro de produtos,
                categorias, horários, relatórios e configurações. Nada aqui altera dados reais.
              </p>
            </div>
            <div className="mt-8">
              <DashboardDemo />
            </div>
            <div className="mt-6">
              <Button variant="glass" onClick={() => scrollTo("painel-demo")}>Visualizar painel demonstrativo</Button>
            </div>
          </div>
        </section>

        {/* Jornada */}
        <section className="section-padding">
          <div className="container mx-auto">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-center">Jornada de utilização</h2>
            <p className="mt-3 text-center text-muted-foreground max-w-md mx-auto">
              Do cadastro ao pedido entregue, em seis etapas.
            </p>
            <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {journey.map((s, i) => (
                <li key={s.title} className="rounded-2xl border border-border p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      <s.icon className="h-5 w-5 text-primary" />
                    </span>
                    <span className="text-xs text-muted-foreground">Etapa {i + 1}</span>
                  </div>
                  <h3 className="mt-4 font-display text-base font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Comparação */}
        <section className="section-padding">
          <div className="container mx-auto grid gap-6 md:grid-cols-2">
            {[
              {
                title: "Experiência do cliente",
                icon: Smartphone,
                items: [
                  "Abre o cardápio pelo QR Code, sem instalar app",
                  "Vê fotos, descrições e preços atualizados",
                  "Monta o pedido com adicionais em poucos toques",
                  "Escolhe entrega, retirada ou mesa",
                  "Acompanha o status até a entrega",
                ],
              },
              {
                title: "Gestão do restaurante",
                icon: MonitorSmartphone,
                items: [
                  "Todos os pedidos centralizados em um painel",
                  "Delivery, retirada e mesas organizados por coluna",
                  "Status alterado com um toque, sem papel",
                  "Cardápio editável a qualquer momento",
                  "Resumo de vendas e configurações num só lugar",
                ],
              },
            ].map((side) => (
              <div key={side.title} className="rounded-2xl border border-border p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <side.icon className="h-5 w-5 text-primary" />
                  </span>
                  <h2 className="font-display text-lg font-semibold">{side.title}</h2>
                </div>
                <ul className="mt-5 space-y-3 text-sm text-muted-foreground">
                  {side.items.map((it) => (
                    <li key={it} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" /> {it}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* CTA final */}
        <section className="section-padding">
          <div className="container mx-auto max-w-2xl rounded-2xl border border-border p-8 md:p-12 text-center">
            <h2 className="font-display text-2xl md:text-3xl font-bold">
              Pronto para modernizar o seu restaurante?
            </h2>
            <p className="mt-3 text-muted-foreground">
              Crie seu cardápio digital hoje e receba pedidos direto pelo seu link.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="hero" size="lg" asChild>
                <Link to="/auth?mode=signup">Começar agora <ArrowRight className="ml-2 h-5 w-5" /></Link>
              </Button>
              <Button variant="glass" size="lg" asChild>
                <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer">Falar pelo WhatsApp</a>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
      <WhatsAppFab />
    </div>
  );
};

export default Demonstracao;

import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import {
  ArrowRight, QrCode, ChefHat, BarChart3, MessageSquare, Bike, Printer,
  ShieldCheck, LayoutGrid, Sparkles, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import WhatsAppFab from "@/components/site/WhatsAppFab";
import PhoneDemo from "@/components/demo/PhoneDemo";
import DashboardDemo from "@/components/demo/DashboardDemo";
import { whatsappUrl } from "@/lib/siteConfig";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: Math.min(i, 4) * 0.08, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

const benefits = [
  { icon: ShieldCheck, title: "Pedidos sem marketplace", text: "Receba direto pelo seu link e sem comissão por pedido." },
  { icon: Bike, title: "Delivery, retirada e mesas", text: "Uma operação organizada para cada tipo de pedido." },
  { icon: Printer, title: "Cardápio sempre atualizado", text: "Mude preço, foto ou item sem reimprimir nada." },
  { icon: Sparkles, title: "Experiência moderna", text: "Um cardápio digital premium que valoriza a sua marca." },
  { icon: LayoutGrid, title: "Operação centralizada", text: "Pedidos, cozinha, clientes e relatórios num só painel." },
  { icon: ChefHat, title: "Menos erro no atendimento", text: "O pedido chega escrito, sem ruído entre salão e cozinha." },
];

const features = [
  { icon: QrCode, title: "Cardápio QR premium", text: "O cliente escaneia, pede pelo celular e o upsell aumenta o ticket médio." },
  { icon: ChefHat, title: "KDS para a cozinha", text: "Tela dedicada com pedidos em tempo real, sem papel e sem confusão." },
  { icon: BarChart3, title: "Dashboard de vendas", text: "Receita, ticket médio, horários de pico e margem, tudo num lugar." },
  { icon: MessageSquare, title: "WhatsApp automático", text: "Mensagens pós-venda e reativação de clientes inativos." },
];

const steps = [
  { n: "1", title: "Configure seu restaurante", text: "Dados, horários, formas de pagamento e mesas." },
  { n: "2", title: "Compartilhe seu cardápio", text: "Link curto e QR Code para mesas e redes sociais." },
  { n: "3", title: "Receba e gerencie pedidos", text: "Tudo em tempo real, do preparo à entrega." },
];

const planFeatures = [
  "Cardápio QR ilimitado",
  "Delivery, retirada e pedidos por mesa",
  "KDS para a cozinha",
  "Dashboard de vendas e margem",
  "CRM + WhatsApp automático",
  "Mesas, QR Codes e cupons",
  "Suporte prioritário",
];

const faq = [
  ["Preciso instalar algum aplicativo?", "Não. A Mizu funciona pelo navegador, tanto para você quanto para o seu cliente."],
  ["A Mizu funciona no celular e no computador?", "Sim. O cardápio é pensado primeiro para o celular e o painel funciona em celular, tablet e computador."],
  ["Posso personalizar meu cardápio?", "Sim. Você edita categorias, itens, fotos, preços, adicionais e ainda escolhe o template visual do cardápio."],
  ["Como recebo os pedidos?", "Os pedidos chegam em tempo real no painel, com alerta sonoro, notificação no navegador e pop-up."],
  ["É possível cadastrar mesas?", "Sim. Cada mesa tem seu próprio QR Code e o pedido chega identificado com o número da mesa."],
  ["Posso trabalhar com delivery e retirada?", "Sim. Você ativa entrega, retirada e consumo no local de forma independente."],
  ["A Mizu cobra comissão por pedido?", "Não. A assinatura é mensal e você não paga taxa por pedido recebido."],
  ["Posso cancelar o plano?", "Sim, o cancelamento pode ser feito quando quiser, sem multa."],
  ["Preciso ter conhecimento técnico?", "Não. O onboarding guiado configura o essencial em poucos minutos."],
];

const Index = () => {
  const location = useLocation();

  useEffect(() => {
    const id = (location.state as { scrollTo?: string } | null)?.scrollTo;
    if (id) {
      requestAnimationFrame(() =>
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  }, [location.state]);

  return (
    <div className="dark min-h-screen bg-background overflow-x-hidden">
      <SiteNav />

      <main>
        {/* Hero */}
        <section className="section-padding pt-28 md:pt-36">
          <div className="container mx-auto grid gap-12 lg:grid-cols-2 lg:items-center">
            <motion.div initial="hidden" animate="visible" className="text-center lg:text-left">
              <motion.h1 custom={0} variants={fadeUp} className="font-display text-3xl md:text-5xl font-bold leading-tight">
                Cardápio digital e gestão de pedidos para restaurantes que querem{" "}
                <span className="gradient-text">vender mais e operar melhor</span>.
              </motion.h1>
              <motion.p custom={1} variants={fadeUp} className="mt-5 text-base md:text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0">
                A Mizu reúne cardápio por QR Code, pedidos de delivery, retirada e mesa e um painel único de
                gestão — para acabar com o pedido no papel e com a dependência de marketplaces.
              </motion.p>
              <motion.div custom={2} variants={fadeUp} className="mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <Button variant="hero" size="lg" className="text-base" asChild>
                  <Link to="/auth?mode=signup">Começar agora <ArrowRight className="ml-2 h-5 w-5" /></Link>
                </Button>
                <Button variant="glass" size="lg" className="text-base" asChild>
                  <Link to="/demonstracao">Ver demonstração</Link>
                </Button>
              </motion.div>
              <motion.p custom={3} variants={fadeUp} className="mt-4 text-sm text-muted-foreground">
                Teste 7 dias. Sem cartão, cancele quando quiser.
              </motion.p>
            </motion.div>

            {/* Produto em destaque: celular + painel */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="hidden md:block">
                <DashboardDemo />
              </div>
              <div className="md:hidden">
                <PhoneDemo />
              </div>
              <div className="hidden md:flex absolute -bottom-10 -left-6 lg:-left-10 w-[180px] flex-col gap-2 rounded-2xl border border-border bg-card p-3 shadow-xl">
                <p className="text-xs text-muted-foreground">Novo pedido</p>
                <p className="text-sm font-medium">#1045 · Mesa 04</p>
                <p className="text-xs text-muted-foreground">2 itens · R$ 98,80</p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Benefícios */}
        <section id="beneficios" className="section-padding scroll-mt-20">
          <div className="container mx-auto">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-center">
              O que muda no seu <span className="gradient-text">dia a dia</span>
            </h2>
            <p className="mt-3 text-center text-muted-foreground max-w-md mx-auto">
              Benefícios reais para a operação e para o seu cliente.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {benefits.map((b, i) => (
                <motion.div
                  key={b.title}
                  custom={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.3 }}
                  variants={fadeUp}
                  className="rounded-2xl border border-border p-6"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                    <b.icon className="h-5 w-5 text-primary" />
                  </span>
                  <h3 className="mt-4 font-display text-base font-semibold">{b.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{b.text}</p>
                </motion.div>
              ))}
            </div>
            <div className="mt-8 text-center">
              <Button variant="glass" asChild><Link to="/demonstracao">Ver demonstração</Link></Button>
            </div>
          </div>
        </section>

        {/* Recursos */}
        <section id="recursos" className="section-padding scroll-mt-20">
          <div className="container mx-auto">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-center">
              Recursos que sustentam a <span className="gradient-text">operação</span>
            </h2>
            <div className="mt-10 grid gap-4 md:grid-cols-2 max-w-4xl mx-auto">
              {features.map((f, i) => (
                <motion.div
                  key={f.title}
                  custom={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.3 }}
                  variants={fadeUp}
                  className="flex gap-4 rounded-2xl border border-border p-6"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <f.icon className="h-5 w-5 text-primary" />
                  </span>
                  <div>
                    <h3 className="font-display text-base font-semibold">{f.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="mt-8 text-center">
              <Button variant="hero" asChild><Link to="/auth?mode=signup">Criar meu cardápio</Link></Button>
            </div>
          </div>
        </section>

        {/* Como funciona */}
        <section id="como-funciona" className="section-padding scroll-mt-20">
          <div className="container mx-auto">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-center">Como funciona</h2>
            <div className="mt-10 grid gap-4 md:grid-cols-3 max-w-4xl mx-auto">
              {steps.map((s, i) => (
                <motion.div
                  key={s.n}
                  custom={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.3 }}
                  variants={fadeUp}
                  className="rounded-2xl border border-border p-6"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 font-display text-sm font-semibold text-primary">
                    {s.n}
                  </span>
                  <h3 className="mt-4 font-display text-base font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Prova social — placeholders */}
        <section className="section-padding">
          <div className="container mx-auto">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-center">Prova social</h2>
            <p className="mt-3 text-center text-muted-foreground max-w-lg mx-auto">
              Espaço preparado para depoimentos e números reais da Mizu.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {["Restaurantes cadastrados", "Pedidos processados", "Cidades atendidas", "Avaliação média"].map((l) => (
                  <div key={l} className="rounded-2xl border border-dashed border-border p-6 text-center">
                  <p className="font-display text-2xl font-semibold text-muted-foreground">—</p>
                  <p className="mt-1 text-sm text-foreground/90">{l}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Placeholder para dado real</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl border border-dashed border-border p-6">
                  <p className="text-sm text-foreground/90">Depoimento de cliente (placeholder)</p>
                  <p className="mt-3 text-xs text-muted-foreground">Nome · Restaurante · Cidade</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Placeholders — substituir por depoimentos, logos e números reais antes da publicação.
            </p>
          </div>
        </section>

        {/* Planos */}
        <section id="planos" className="section-padding scroll-mt-20">
          <div className="container mx-auto">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-center">Planos</h2>
            <p className="mt-3 text-center text-muted-foreground max-w-md mx-auto">
              Sem comissão por pedido. Escolha pelo tamanho da sua operação.
            </p>

            <div className="mt-10 grid gap-6 md:grid-cols-2 max-w-4xl mx-auto items-start">
              <div className="rounded-2xl border border-border p-7">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Essencial</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Para quem está começando com cardápio digital e pedidos por link ou QR Code.
                </p>
                <p className="mt-5 font-display text-3xl font-bold">
                  R$197<span className="text-base font-normal text-muted-foreground">/mês</span>
                </p>
                <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
                  {planFeatures.slice(0, 4).map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {f}
                    </li>
                  ))}
                </ul>
                <Button variant="glass" size="lg" className="mt-7 w-full" asChild>
                  <Link to="/auth?mode=signup">Começar agora</Link>
                </Button>
              </div>

              <div className="relative rounded-2xl border border-primary p-7">
                <span className="absolute -top-3 left-7 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                  Recomendado
                </span>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Completo</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Para restaurantes com salão, delivery e cozinha que precisam de tudo integrado.
                </p>
                <p className="mt-5 font-display text-3xl font-bold">
                  R$197<span className="text-base font-normal text-muted-foreground">/mês</span>
                </p>
                <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
                  {planFeatures.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {f}
                    </li>
                  ))}
                </ul>
                <Button variant="hero" size="lg" className="mt-7 w-full" asChild>
                  <Link to="/auth?mode=signup">Testar 7 dias grátis</Link>
                </Button>
                <p className="mt-3 text-center text-xs text-muted-foreground">Sem cartão de crédito.</p>
              </div>
            </div>

            <div className="mt-8 text-center">
              <Button variant="ghost" asChild>
                <a href={whatsappUrl("Olá! Gostaria de falar com um especialista da Mizu sobre os planos.")} target="_blank" rel="noopener noreferrer">
                  Falar com um especialista
                </a>
              </Button>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="section-padding scroll-mt-20">
          <div className="container mx-auto max-w-2xl">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-center">Perguntas frequentes</h2>
            <Accordion type="single" collapsible className="mt-8">
              {faq.map(([q, a]) => (
                <AccordionItem key={q} value={q}>
                  <AccordionTrigger className="text-left text-sm md:text-base">{q}</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">{a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* CTA final */}
        <section className="section-padding">
          <div className="container mx-auto max-w-2xl rounded-2xl border border-border p-8 md:p-12 text-center">
            <h2 className="font-display text-2xl md:text-3xl font-bold">Pronto para modernizar o seu restaurante?</h2>
            <p className="mt-3 text-muted-foreground">
              Comece hoje e receba pedidos pelo seu próprio cardápio digital.
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

export default Index;

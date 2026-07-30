import { motion, type Variants } from "framer-motion";
import { ArrowRight, QrCode, ChefHat, BarChart3, MessageSquare, X, AlertTriangle, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroSushi from "@/assets/hero-sushi.jpg";
import phoneMockup from "@/assets/phone-mockup.jpg";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

const painPoints = [
  {
    icon: AlertTriangle,
    title: "Pedidos com erro",
    description: "Anotações manuais geram retrabalho, perda de insumos e clientes insatisfeitos.",
  },
  {
    icon: TrendingDown,
    title: "Cliente some depois da 1ª vez",
    description: "Sem CRM, você não sabe quem voltou, quem sumiu ou quando reativar.",
  },
  {
    icon: X,
    title: "Sem controle de lucro",
    description: "Faturamento alto não garante margem. Sem dados, você opera no escuro.",
  },
];

const features = [
  {
    icon: QrCode,
    title: "Cardápio QR Premium",
    description: "Seu cliente escaneia e faz o pedido direto do celular. Upsell automático aumenta o ticket médio.",
  },
  {
    icon: ChefHat,
    title: "KDS — Cozinha Organizada",
    description: "Tela dedicada para a cozinha. Pedidos em tempo real, sem papel, sem confusão.",
  },
  {
    icon: BarChart3,
    title: "Dashboard Inteligente",
    description: "Receita, ticket médio, horários de pico e margem de lucro. Tudo num só lugar.",
  },
  {
    icon: MessageSquare,
    title: "WhatsApp Automático",
    description: "Mensagens pós-venda e reativação de clientes inativos. CRM que trabalha sozinho.",
  },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-background/70 backdrop-blur-xl border-b border-border">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <a href="/" aria-label="Mizu — Gestão de Restaurantes" className="flex items-center">
            <Logo className="h-8" />
          </a>
          <div className="flex gap-3">
            <Button variant="ghost" size="sm" asChild>
              <a href="/auth">Entrar</a>
            </Button>
            <Button variant="hero" size="sm" asChild>
              <a href="/auth?mode=signup">Testar 7 dias</a>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-28 pb-20 md:pt-40 md:pb-32 section-padding overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src={heroSushi} alt="Sushi premium" className="w-full h-full object-cover opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-b from-background via-background/80 to-background" />
        </div>

        <div className="container mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial="hidden"
              animate="visible"
              className="text-center lg:text-left"
            >
              <motion.h1
                custom={0}
                variants={fadeUp}
                className="font-display text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6"
              >
                Pare de anotar pedido no papel.{" "}
                <span className="gradient-text">Aumente o ticket médio</span> com QR + Upsell.
              </motion.h1>
              <motion.p
                custom={1}
                variants={fadeUp}
                className="text-lg md:text-xl text-muted-foreground mb-8 max-w-lg mx-auto lg:mx-0"
              >
                Cardápio premium, cozinha organizada e WhatsApp automático. Tudo que seu restaurante japonês precisa.
              </motion.p>
              <motion.div custom={2} variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button variant="hero" size="lg" className="text-base px-8 py-6" asChild>
                  <a href="/auth?mode=signup">
                    Testar 7 dias grátis
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </a>
                </Button>
                <Button variant="glass" size="lg" className="text-base px-8 py-6" asChild>
                  <a href="/m/demo">Ver demonstração</a>
                </Button>
              </motion.div>
              <motion.p custom={3} variants={fadeUp} className="mt-4 text-sm text-muted-foreground">
                Sem cartão. Cancele quando quiser.
              </motion.p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="hidden lg:flex justify-center"
            >
              <div className="relative">
                <div className="absolute -inset-4 rounded-3xl bg-primary/10 blur-3xl" />
                <img
                  src={phoneMockup}
                  alt="Cardápio digital no celular"
                  className="relative w-72 rounded-3xl shadow-2xl animate-float"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Pain Points */}
      <section className="section-padding">
        <div className="container mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-display text-3xl md:text-4xl font-bold text-center mb-4"
          >
            O que está <span className="gradient-text">custando caro</span> pra você
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-muted-foreground text-center mb-12 max-w-md mx-auto"
          >
            Problemas invisíveis que drenam seu lucro todo mês.
          </motion.p>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {painPoints.map((point, i) => (
              <motion.div
                key={point.title}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="glass-card-hover p-6 text-center"
              >
                <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                  <point.icon className="h-6 w-6 text-destructive" />
                </div>
                <h3 className="font-display text-lg font-semibold mb-2">{point.title}</h3>
                <p className="text-sm text-muted-foreground">{point.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Solution */}
      <section className="section-padding">
        <div className="container mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-display text-3xl md:text-4xl font-bold text-center mb-4"
          >
            A solução <span className="gradient-text">completa</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-muted-foreground text-center mb-12 max-w-md mx-auto"
          >
            Tudo integrado. Do pedido à fidelização.
          </motion.p>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="glass-card-hover p-6 flex gap-4"
              >
                <div className="w-12 h-12 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-semibold mb-1">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="section-padding">
        <div className="container mx-auto max-w-lg text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass-card p-8 md:p-12"
          >
            <p className="text-sm text-primary font-semibold uppercase tracking-wider mb-2">Plano Único</p>
            <h2 className="font-display text-4xl md:text-5xl font-bold mb-2">
              R$197<span className="text-lg text-muted-foreground font-normal">/mês</span>
            </h2>
            <p className="text-muted-foreground mb-6">
              Tudo incluso. Sem taxa por pedido. Sem surpresas.
            </p>
            <ul className="text-sm text-muted-foreground space-y-2 mb-8 text-left max-w-xs mx-auto">
              {[
                "Cardápio QR ilimitado",
                "KDS para cozinha",
                "Dashboard de lucro",
                "CRM + WhatsApp automático",
                "Mesas e QR Codes",
                "Suporte prioritário",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <Button variant="hero" size="lg" className="w-full text-base py-6 animate-pulse-glow" asChild>
              <a href="/auth?mode=signup">
                Testar 7 dias grátis
                <ArrowRight className="ml-2 h-5 w-5" />
              </a>
            </Button>
            <p className="text-xs text-muted-foreground mt-3">Sem cartão de crédito.</p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <span className="font-display font-bold text-foreground">Kōban</span>
          <p>© 2026 Kōban. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;

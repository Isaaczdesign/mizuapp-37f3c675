import { useEffect } from "react";
import { Link } from "@/lib/router-compat";
import { motion } from "framer-motion";
import {
  ArrowRight, UserPlus, Paintbrush, QrCode, ShoppingBag, ListChecks, BellRing,
  Smartphone, MonitorSmartphone, FlaskConical, ArrowDown, Check, ChefHat, Truck,
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

const problems = [
  { title: "Pedido no papel", text: "Comandas perdidas e erros de anotação viram histórico digital rastreável." },
  { title: "Fila no WhatsApp", text: "O cliente monta o pedido sozinho no cardápio, sem ocupar seu atendente." },
  { title: "Cardápio desatualizado", text: "Preço e disponibilidade mudam em segundos, sem reimprimir nada." },
  { title: "Dependência de marketplace", text: "Link e QR próprios, sem comissão por pedido." },
];

const scrollTo = (id: string) =>
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

const Demonstracao = () => {
  usePageMeta({
    title: "Demonstração Mizu | Cardápio Digital e Gestão de Pedidos",
    description:
      "Veja a Mizu funcionando na prática: cardápio digital interativo, pedido completo, acompanhamento de status e painel de gestão do restaurante — com dados fictícios.",
    canonical: `${SITE_URL}/demonstracao`,
  });

  useEffect(() => { window.scrollTo({ top: 0, behavior: "auto" }); }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <SiteNav />

      <main>
        {/* Hero */}
        <section className="section-padding pt-28 md:pt-36">
          <div className="container mx-auto grid gap-10 lg:grid-cols-[1fr_1.05fr] lg:items-center">
            <div className="text-center lg:text-left">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs text-primary">
                <FlaskConical className="h-3.5 w-3.5" /> Ambiente de demonstração · dados fictícios
              </span>
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="mt-5 font-display text-3xl font-bold leading-tight md:text-5xl"
              >
                Veja a <span className="gradient-text">Mizu</span> funcionando na prática
              </motion.h1>
              <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground md:text-lg lg:mx-0">
                Conheça a experiência completa do cliente e a gestão do restaurante, desde a escolha do produto
                até a conclusão do pedido.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
                <Button variant="hero" size="lg" className="text-base" onClick={() => scrollTo("cardapio-demo")}>
                  Explorar cardápio <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button variant="glass" size="lg" className="text-base" onClick={() => scrollTo("painel-demo")}>
                  Conhecer painel de gestão
                </Button>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="relative"
            >
              <div className="hidden md:block"><DashboardDemo /></div>
              <div className="md:hidden"><PhoneDemo /></div>
              <div className="absolute -bottom-8 -left-4 hidden w-[180px] rounded-2xl border border-border bg-card p-3 shadow-xl lg:block">
                <p className="text-xs text-muted-foreground">Novo pedido</p>
                <p className="text-sm font-medium">#1046 · Mesa 04</p>
                <p className="text-xs text-muted-foreground">2 itens · R$ 98,80</p>
              </div>
              <div className="absolute -top-6 -right-2 hidden w-[168px] rounded-2xl border border-border bg-card p-3 shadow-xl lg:block">
                <p className="text-xs text-muted-foreground">Faturamento hoje</p>
                <p className="font-display text-lg font-semibold">R$ 4.180</p>
                <p className="text-xs text-primary">+18% vs. ontem</p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Cardápio */}
        <section id="cardapio-demo" className="section-padding scroll-mt-20">
          <div className="container mx-auto grid gap-10 lg:grid-cols-2 lg:items-center">
            <div className="max-w-lg">
              <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                <Smartphone className="h-3.5 w-3.5" /> Experiência do cliente
              </span>
              <h2 className="mt-4 font-display text-2xl font-bold md:text-3xl">Cardápio digital do Sushi Mizu</h2>
              <p className="mt-3 text-muted-foreground">
                Um restaurante fictício criado só para esta demonstração. Percorra as etapas exatamente como o
                seu cliente faria — nada é gravado e nenhum pedido real é criado.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                {[
                  "Cabeçalho com status aberto/fechado, horários, tempo estimado e pedido mínimo",
                  "Categorias, busca e produtos em destaque",
                  "Produto com adicionais, quantidade e observações",
                  "Carrinho com cupom, subtotal, taxa de entrega e total",
                  "Delivery com endereço, retirada ou mesa identificada",
                  "Pix, cartão online ou dinheiro com troco",
                  "Confirmação e acompanhamento do pedido em tempo real",
                ].map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" /> {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-center"><PhoneDemo /></div>
          </div>
        </section>

        {/* Acompanhamento */}
        <section className="section-padding">
          <div className="container mx-auto">
            <h2 className="text-center font-display text-2xl font-bold md:text-3xl">Acompanhamento do pedido</h2>
            <p className="mx-auto mt-3 max-w-lg text-center text-muted-foreground">
              O cliente vê cada mudança de status com data e horário — e a jornada se adapta à modalidade escolhida.
            </p>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {[
                { title: "Delivery", icon: Truck, steps: ["Pedido enviado · 19:42", "Aguardando confirmação", "Confirmado · 19:43", "Em preparação · 19:45", "Saiu para entrega · 20:05", "Entregue · 20:24"] },
                { title: "Retirada", icon: ShoppingBag, steps: ["Pedido enviado · 19:42", "Aguardando confirmação", "Confirmado · 19:43", "Em preparação · 19:45", "Pronto para retirada · 20:02", "Concluído · 20:11"] },
                { title: "No local (mesa)", icon: ChefHat, steps: ["Pedido da mesa 07 · 19:42", "Recebido pela cozinha", "Confirmado · 19:43", "Em preparação · 19:45", "Servido na mesa · 20:01", "Conta encerrada · 20:40"] },
              ].map((c) => (
                <div key={c.title} className="rounded-2xl border border-border p-5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10"><c.icon className="h-4 w-4 text-primary" /></span>
                    <h3 className="font-display text-base font-semibold">{c.title}</h3>
                  </div>
                  <ol className="mt-4 space-y-2.5 text-sm">
                    {c.steps.map((s, i) => (
                      <li key={s} className="flex items-center gap-2.5">
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] ${i < 4 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                          {i < 4 ? <Check className="h-3 w-3" /> : i + 1}
                        </span>
                        <span className={i < 4 ? "" : "text-muted-foreground"}>{s}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
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
              <h2 className="mt-4 font-display text-2xl font-bold md:text-3xl">Painel de gestão demonstrativo</h2>
              <p className="mt-3 text-muted-foreground">
                Resumo do dia, quadro de pedidos com ações reais de status, gestão de cardápio, relatórios e
                configurações. Tudo interativo, com dados fictícios e sem impacto em nenhum estabelecimento.
              </p>
            </div>
            <div className="mt-8"><DashboardDemo /></div>
          </div>
        </section>

        {/* Jornada integrada */}
        <section className="section-padding">
          <div className="container mx-auto">
            <h2 className="text-center font-display text-2xl font-bold md:text-3xl">Os dois lados, conectados</h2>
            <div className="mt-10 grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
              <div className="rounded-2xl border border-border p-6">
                <h3 className="font-display text-lg font-semibold">Cliente</h3>
                <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
                  {["Acessa o cardápio pelo QR ou link", "Escolhe os produtos e adicionais", "Faz o pedido e paga", "Acompanha o status até o fim"].map((s, i) => (
                    <li key={s} className="flex gap-2.5"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] text-primary">{i + 1}</span>{s}</li>
                  ))}
                </ol>
              </div>
              <div className="flex justify-center text-primary">
                <ArrowRight className="hidden h-6 w-6 md:block" />
                <ArrowDown className="h-6 w-6 md:hidden" />
              </div>
              <div className="rounded-2xl border border-border p-6">
                <h3 className="font-display text-lg font-semibold">Restaurante</h3>
                <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
                  {["Recebe o pedido com notificação", "Confirma e envia para a cozinha", "Atualiza o status a cada etapa", "Finaliza a venda e vê o relatório"].map((s, i) => (
                    <li key={s} className="flex gap-2.5"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] text-primary">{i + 1}</span>{s}</li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </section>

        {/* Jornada de utilização */}
        <section className="section-padding">
          <div className="container mx-auto">
            <h2 className="text-center font-display text-2xl font-bold md:text-3xl">Jornada de utilização</h2>
            <p className="mx-auto mt-3 max-w-md text-center text-muted-foreground">Do cadastro ao pedido entregue, em seis etapas.</p>
            <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {journey.map((s, i) => (
                <li key={s.title} className="rounded-2xl border border-border p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><s.icon className="h-5 w-5 text-primary" /></span>
                    <span className="text-xs text-muted-foreground">Etapa {i + 1}</span>
                  </div>
                  <h3 className="mt-4 font-display text-base font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Problemas resolvidos */}
        <section className="section-padding">
          <div className="container mx-auto">
            <h2 className="text-center font-display text-2xl font-bold md:text-3xl">O que a Mizu resolve</h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {problems.map((p) => (
                <div key={p.title} className="rounded-2xl border border-border p-5">
                  <h3 className="font-display text-base font-semibold">{p.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{p.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="section-padding">
          <div className="container mx-auto max-w-2xl rounded-2xl border border-border p-8 text-center md:p-12">
            <h2 className="font-display text-2xl font-bold md:text-3xl">Pronto para transformar a operação do seu restaurante?</h2>
            <p className="mt-3 text-muted-foreground">
              Crie seu cardápio digital, organize seus pedidos e ofereça uma experiência mais moderna aos seus clientes.
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Button variant="hero" size="lg" asChild>
                <Link to="/auth?mode=signup">Começar agora <ArrowRight className="ml-2 h-5 w-5" /></Link>
              </Button>
              <Button variant="glass" size="lg" asChild>
                <Link to="/#planos">Conhecer os planos</Link>
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

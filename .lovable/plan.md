
# Revisão de Segurança e Funcionalidades — Kōban

Escopo enorme. Vou dividir em **fases entregáveis**, começando por segurança. Peço sua aprovação antes de executar, e podemos re-priorizar.

## Diagnóstico rápido (já feito)

**RLS**: Todas as 19 tabelas do schema `public` já estão com RLS habilitado. Não existem tabelas expostas sem RLS.

**Políticas permissivas encontradas** (precisam correção):
- `menu_categories`, `menu_items`, `menu_item_addons`, `menu_item_variations`: têm política pública `USING (true)` de leitura — é necessária para o cardápio QR funcionar sem login, mas hoje qualquer um lista **todos os itens de todos os restaurantes**. Corrigir para exigir join com `restaurants` onde `is_public = true` (ou similar) e/ou filtrar por slug via SECURITY DEFINER function.
- `customers` `INSERT` público com `WITH CHECK (true)`: permite criar cliente em qualquer restaurante. Corrigir para exigir `restaurant_id` válido/ativo.
- `orders` / `order_items` (a confirmar na próxima leitura): precisam da mesma auditoria.
- `restaurants`: verificar se colunas sensíveis (owner_email, dados de assinatura, secrets de WhatsApp) estão expostas na policy pública.

**service_role**: Só está referenciada em `supabase/functions/` (server-side). Confirmado que **não vaza no bundle**.

**Onde estamos bem**: multi-tenancy via `get_user_restaurant_id(auth.uid())` + `has_role()` está consistente em quase todas as tabelas de admin.

---

## Fase 1 — SEGURANÇA (prioridade máxima) — vou começar por aqui

1. **Auditoria completa de policies**: ler todas as 30+ policies e produzir um relatório final "antes/depois". Já sei que preciso corrigir:
   - Restringir leitura pública de `menu_*` a restaurantes com `is_active/is_public = true`, expondo só via função `get_public_menu(slug)` SECURITY DEFINER.
   - Restringir `customers INSERT` público: exigir `restaurant_id` de restaurante ativo, limitar campos, sem sobrescrever cliente existente.
   - Auditar `orders`/`order_items` INSERT público (checkout) — mesmas restrições.
   - Restringir colunas sensíveis de `restaurants` na view pública (criar view `restaurants_public` só com nome, slug, logo, horário, métodos de pagamento; policy `USING (false)` na tabela base para anon).
   - Confirmar que `settings`, `subscriptions`, `message_logs`, `automation_rules`, `menu_import_jobs` **não têm** política pública alguma.
2. **RBAC por rota**: já existe. Vou revisar `App.tsx` e cada página para garantir que `staff` não acessa Financeiro/Configurações e `kitchen` só acessa KDS.
3. **Mover lógica sensível para Edge Function**:
   - Cancelamento de pedido, mudança de status, alteração de preço, criação/remoção de role → todas via Edge Function que valida `role` server-side.
   - Checkout público → Edge Function `place-order` que valida preços contra o banco (impede manipulação client-side de valor).
4. **Rate limiting** nos endpoints públicos (`place-order`, contato, `create-restaurant`, login): via tabela `rate_limit_events` + função SECURITY DEFINER, sem depender de infra extra.
5. **Proteção de login**: ativar HIBP (leaked password check) via `configure_auth`, e brute-force via bloqueio temporário por IP na Edge Function de login (opcional, o GoTrue já limita).
6. **Headers de segurança**: CSP, X-Frame-Options, HSTS, Referrer-Policy — Lovable hosting já força HTTPS e HSTS. CSP/XFO são configuráveis via meta tags no `index.html` (limitado) — CSP completo exige hosting próprio. Vou aplicar o que dá via `<meta http-equiv>` e documentar limitação.
7. **2FA (TOTP) opcional para admins**: habilitar MFA no Auth e criar UI em Configurações → Segurança. Enforce para role `owner/manager`.
8. **IDOR**: já mitigado por RLS + `get_user_restaurant_id`. Vou fazer varredura para garantir que nenhuma query no frontend passa `restaurant_id` vindo da URL.

## Fase 2 — LGPD / WhatsApp

- Coluna `whatsapp_opt_in`, `opt_in_at`, `opt_in_text_version` em `customers`.
- Checkbox **desmarcado** no checkout público, com texto explícito.
- Link `/opt-out?token=...` em cada mensagem automática (Edge Function seta `whatsapp_opt_in=false`).
- Página `/privacidade` (política) e `/meus-dados` (cliente solicita exclusão via formulário → cria `data_deletion_requests`).
- Automations checa `opt_in=true` antes de enviar.

## Fase 3 — Funcionalidades faltantes

- Cardápio: toggle "esgotado" rápido (`is_available`), campo observação por item no checkout.
- KDS: já existe fila realtime. Adicionar timer visível por pedido + som (já existe).
- CRM: segmento "inativos há X dias" + tela de fidelidade com pontos (`customer_points` já existe? confirmar).
- WhatsApp fallback: template "digite ATENDENTE" que notifica dashboard.

## Fase 4 — Gerais

- Relatório exportável CSV (período, top itens, ticket médio, hora de pico).
- PIX no checkout (QR code estático + campo copia-e-cola nas configurações).
- Auditoria responsiva tablet/celular do Dashboard/KDS.

---

## Como quero prosseguir

Cada fase = 1 ou 2 turnos com migrations + código. **Fase 1 sozinha** já são ~5 migrations, ~8 Edge Functions e várias telas.

**Sugiro executar assim:**
1. Executo **Fase 1 completa** agora (segurança + relatório final "antes/depois" que você pediu).
2. Você valida, e eu sigo para Fase 2, 3, 4.

Confirma que posso começar pela Fase 1 completa? Ou prefere que eu quebre ainda mais (ex: só policies primeiro, depois Edge Functions, depois 2FA)?

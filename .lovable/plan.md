## Objetivo

Nova aba **Personalizar** em Cardápio (`/menu-admin`) onde o dono escolhe entre **6 templates** de layout para o cardápio público e define a **cor de destaque**. A escolha é salva no banco e aplicada em `/r/:slug` (e `/m/:slug`) para os clientes.

## Os 6 templates

| Template | Estilo |
|---|---|
| Clássico | Layout atual: lista com foto pequena à direita |
| Vitrine | Cards grandes com foto no topo, 1 coluna |
| Compacto | Lista densa, sem foto (ideal cardápio grande) |
| Grade | Grid 2 colunas com foto quadrada |
| Elegante | Fundo escuro, tipografia serif, divisores finos, foto discreta |
| Vibrante | Cores fortes, cards arredondados, badges e preços em destaque |

Em todos: cabeçalho, busca, carrinho, checkout de 4 etapas e regras de negócio (horário, pagamento, cupom, upsell) permanecem exatamente os mesmos — muda só a apresentação das categorias e itens.

## Aba Personalizar

- Grid de 6 cartões de template com miniatura/wireframe, nome e descrição; o ativo fica marcado.
- Seletor de **cor de destaque**: paleta de presets + campo de cor livre (usa o `primary_color` já existente do restaurante).
- **Prévia ao vivo** em moldura de celular, com dados reais do cardápio, atualizando ao trocar template/cor.
- Botões "Salvar" e "Ver cardápio virtual" (abre em nova aba).

## Detalhes técnicos

- Migração: coluna `menu_theme text not null default 'classic'` em `restaurants`; incluir `menu_theme` no retorno de `get_public_restaurant_by_slug` (função `SECURITY DEFINER` já usada pelo público).
- Novo `src/lib/menuThemes.ts`: catálogo dos 6 temas (id, nome, descrição, classes/tokens de layout) — fonte única usada por admin e público.
- Novo `src/components/menu-admin/MenuThemeTab.tsx` (aba + seleção + cor + prévia) e componentes de renderização de item por tema, extraídos do `PublicMenu.tsx` para `src/components/public-menu/MenuItemCard.tsx`.
- `src/pages/PublicMenu.tsx`: lê `menu_theme` do restaurante e escolhe a variante de renderização; cor aplicada via variável CSS derivada de `primary_color` (sem cores hardcoded).
- Salvamento via update em `restaurants` (RLS de owner/manager já existe), com invalidação do cache do React Query.

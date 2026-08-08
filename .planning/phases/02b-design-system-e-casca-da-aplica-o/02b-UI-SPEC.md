---
phase: 2b
slug: design-system-e-casca-da-aplica-o
status: draft
shadcn_initialized: false
preset: none
created: 2026-08-08
---

# Fase 2b — Contrato de Design de UI

> Contrato visual e de interação para a fase "Design System e Casca da Aplicação". Gerado por
> `gsd-ui-researcher`, verificado por `gsd-ui-checker`. Todos os valores abaixo são **literais**,
> copiados de `amassa-plataforma/04-DESIGN-SYSTEM.md` e das decisões travadas em
> `02b-CONTEXT.md` (D-01 a D-16). Nada aqui foi reinventado — este documento traduz fontes já
> aprovadas em contrato pronto para o planejador e o executor, sem ambiguidade.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn/ui (a inicializar nesta fase — `components.json` ainda não existe) |
| Preset | não aplicável — nenhum preset de `ui.shadcn.com/create` é usado. Os tokens vêm literalmente de `04-DESIGN-SYSTEM.md` §2, escritos à mão em `app/globals.css` **antes** do primeiro `shadcn add` (D-08). Rodar `npx shadcn init` com: TypeScript = sim, estilo = `new-york`, cor base = `neutral` (irrelevante — todo token é sobrescrito a seguir), variáveis CSS = sim, alias `@/components`, `@/lib/utils`. |
| Component library | Radix UI (via shadcn) |
| Icon library | `lucide-react` |
| Font | Archivo Narrow (títulos) + Inter (corpo), via `next/font/google` (D-10) |

**Componentes shadcn a instalar nesta fase (D-06) — e só estes:**

`button`, `card`, `sidebar`, `sheet`, `skeleton`, `dropdown-menu`, `separator`

**Não entram nesta fase (D-07):** `alert-dialog`, `sonner`. Ver seção "Convenção adiada —
Confirmação Destrutiva" abaixo.

---

## Design Tokens — CSS literal para `app/globals.css`

Copiado **sem alteração** de `04-DESIGN-SYSTEM.md` §2. Este bloco entra primeiro; o `@theme
inline` de mapeamento para o shadcn vem logo depois, **antes** de qualquer `shadcn add` (D-08).
As cores marcadas "NÃO ALTERAR" abaixo não são usadas por nenhuma tela desta fase, mas entram no
arquivo mesmo assim — são as cores dos protótipos de Encomendas, Agenda e Fornos, que as fases 3
a 6 vão consumir sem precisar tocar em `globals.css` de novo.

```css
@theme {
  /* superfícies */
  --color-fundo:        #F6F3F0;
  --color-superficie:   #FFFFFF;
  --color-superficie-2: #EFEAE5;

  /* linhas */
  --color-borda:        #E8E2DC;
  --color-borda-forte:  #D8CFC7;

  /* texto */
  --color-tinta:        #1D2221;   /* 14.6:1 sobre o fundo */
  --color-tinta-media:  #5A4C44;   /*  7.4:1 — aprovado AA */
  --color-tinta-fraca:  #6E5F56;   /*  5.4:1 — aprovado AA (NÃO usar #8A7A70 — reprova AA) */

  /* ação — terracota AMASSA */
  --color-acento:       #894025;
  --color-acento-hover: #5B2916;
  --color-acento-fundo: #F3EDE9;
  --color-destaque:     #FFBD59;

  /* etapas da encomenda — NÃO ALTERAR (não usadas nesta fase) */
  --color-producao:     #8B6F47;
  --color-secagem:      #C9B896;
  --color-queima1:      #C2451B;
  --color-esmaltacao:   #2E7D8C;
  --color-queima2:      #7A3527;
  --color-entrega:      #5B7553;

  /* modalidades de aula — NÃO ALTERAR (não usadas nesta fase) */
  --color-modelagem:    #92400E;
  --color-torno:        #115E59;
  --color-pintura:      #1D4ED8;

  /* tipos de queima — NÃO ALTERAR (não usadas nesta fase) */
  --color-biscoito:     #9A3412;
  --color-esmalte:      #155E75;
  --color-ouro:         #CA8A04;

  /* níveis do contador de forno — NÃO ALTERAR (não usadas nesta fase) */
  --color-forno-ok:      #D97706;  --color-forno-ok-fundo:      #FFFBEB;  --color-forno-ok-texto:      #92400E;
  --color-forno-atencao: #CA8A04;  --color-forno-atencao-fundo: #FEF9C3;  --color-forno-atencao-texto: #854D0E;
  --color-forno-critico: #DC2626;  --color-forno-critico-fundo: #FEE2E2;  --color-forno-critico-texto: #991B1B;

  /* semânticas */
  --color-sucesso:      #15803D;   --color-sucesso-fundo: #DCFCE7;
  --color-atencao:      #B45309;   --color-atencao-fundo: #FEF3C7;
  --color-erro:         #B91C1C;   --color-erro-fundo:    #FEE2E2;

  /* raio — no Tailwind v4 o namespace É "--radius-*" */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 18px;   /* Card e Dialog do shadcn usam rounded-xl */
}

@theme inline {
  --color-background:         var(--color-fundo);
  --color-foreground:         var(--color-tinta);
  --color-card:               var(--color-superficie);
  --color-card-foreground:    var(--color-tinta);
  --color-popover:            var(--color-superficie);
  --color-popover-foreground: var(--color-tinta);
  --color-primary:            var(--color-acento);
  --color-primary-foreground: #FFFFFF;
  --color-secondary:          var(--color-superficie-2);
  --color-secondary-foreground: var(--color-tinta);
  --color-muted:              var(--color-superficie-2);
  --color-muted-foreground:   var(--color-tinta-fraca);
  --color-accent:             var(--color-acento-fundo);
  --color-accent-foreground:  var(--color-acento);
  --color-destructive:        var(--color-erro);
  --color-destructive-foreground: #FFFFFF;
  --color-border:             var(--color-borda);
  --color-input:              var(--color-borda-forte);
  --color-ring:               var(--color-acento);

  /* Namespace próprio do componente Sidebar do shadcn — as OITO variáveis abaixo são
     obrigatórias. Sem elas a barra lateral de 240px sai com a paleta padrão do Tailwind,
     mesmo com todo o resto do mapeamento correto (a armadilha de silêncio da D-09). */
  --color-sidebar:                    var(--color-superficie);
  --color-sidebar-foreground:         var(--color-tinta);
  --color-sidebar-primary:            var(--color-acento);
  --color-sidebar-primary-foreground: #FFFFFF;
  --color-sidebar-accent:             var(--color-acento-fundo);
  --color-sidebar-accent-foreground:  var(--color-acento);
  --color-sidebar-border:             var(--color-borda);
  --color-sidebar-ring:               var(--color-acento);
}
```

Cuidados registrados na fonte, válidos aqui:

- Texto sobre `--color-secagem` (`#C9B896`) é `#3A331F`, nunca branco.
- `--color-chart-1` a `--color-chart-5` **não entram nesta fase** (só fazem falta na Fase 4,
  com Recharts).

---

## Spacing Scale

Escala de 8 pontos, padrão Tailwind (múltiplos de 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Espaço entre ícone e rótulo, padding inline compacto |
| sm | 8px | Espaçamento entre elementos compactos (itens de lista, chips) |
| md | 16px | Espaçamento padrão entre elementos, padding de card |
| lg | 24px | Padding de seção, padding de página no celular |
| xl | 32px | Espaçamento entre blocos de layout, padding de página no desktop |
| 2xl | 48px | Quebras de seção maiores (ex.: entre o cabeçalho da página e o conteúdo) |
| 3xl | 64px | Espaçamento no nível da página, raramente usado nesta fase |

**Exceções desta fase (vêm de acessibilidade e do documento de design, não da escala):**

- **44px** — alvo de toque mínimo (UI-09): todo botão, item de navegação e ícone clicável.
- **56px** — altura mínima da barra inferior no celular e altura de cada item de navegação nela
  (`04-DESIGN-SYSTEM.md` §5).
- **240px** — largura fixa da barra lateral no desktop (D-12, UI-03).
- **16px** — tamanho mínimo de qualquer campo de formulário (senão o iOS dá zoom ao focar).

---

## Typography

> A escala tipográfica desta fase **não** segue o padrão genérico de "3–4 tamanhos, 2 pesos".
> `04-DESIGN-SYSTEM.md` §4 define **6 papéis com 4 pesos**, de forma explícita e travada — é a
> fonte única de verdade visual do projeto e não deve ser reinventada. A tabela abaixo é cópia
> literal dela.

| Papel | Tamanho/Altura | Peso | Uso |
|-------|-----------------|------|-----|
| display | 28px / 32px (1.14) | 700 | Títulos de página (`<h1>` de cada tela de módulo, painel inicial) |
| título | 20px / 28px (1.4) | 600 | Títulos de seção (nome do cartão do painel, cabeçalho de bloco) |
| corpo | 16px / 24px (1.5) | 400 | Texto padrão, todo campo de formulário — **nunca menor que isto em campo de formulário** |
| apoio | 14px / 20px (1.43) | 400 | Metadados (ex.: "Última atualização", rótulos secundários) |
| micro | 12px / 16px (1.33) | 500 | Rótulos em caixa alta com `letter-spacing: 0.06em` (ex.: rótulo de seção) |
| mono | 13px / 18px (1.38) | 400 | Números, datas, quantidades — usa Inter com `font-variant-numeric: tabular-nums`, não uma família monoespaçada separada (o projeto usa só duas famílias de fonte; ver "Fontes" abaixo) |

**Exceção desta fase — rótulos da barra inferior e da barra lateral:** usam o par
tamanho/altura do papel `micro` (12px/16px, peso 500), mas **sem** caixa alta e **sem**
`letter-spacing` — a caixa alta do papel `micro` é para rótulos de seção, não para rótulos de
navegação com ícone ao lado. Rótulo de navegação: `12px/16 500`, texto normal (ex.: "Início",
não "INÍCIO").

**Fontes (D-10):**

- **Archivo Narrow** — pesos `600` e `700` — usada nos papéis `título` e `display`, carregada via
  `next/font/google`.
- **Inter** — pesos `400` e `500` — usada nos papéis `corpo`, `apoio`, `micro`, `mono` e nos
  rótulos de navegação, carregada via `next/font/google`.
- Nenhum arquivo `.woff2` é versionado no repositório; nenhuma requisição a CDN do Google em
  produção — as duas fontes são baixadas no `next build` (que roda no GitHub Actions) e servidas
  pelo próprio domínio.
- A **Vinila Condensed** (fonte do mídia kit) nunca é carregada como fonte web — só existe como
  SVG do logo, quando o dono o fornecer (D-13).

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#F6F3F0` (`--color-fundo`) | Fundo de toda tela, fundo da barra inferior |
| Secondary (30%) | `#FFFFFF` (`--color-superficie`) e `#EFEAE5` (`--color-superficie-2`) | Cards, barra lateral (240px), superfícies elevadas, campos de formulário |
| Accent (10%) | `#894025` (`--color-acento`) | Ver lista fechada abaixo — nunca decoração |
| Destructive | `#B91C1C` (`--color-erro`) | Reservada para ações destrutivas e mensagens de erro — não usada em botão nesta fase (nenhuma exclusão existe ainda; ver convenção adiada) |

**Accent (`#894025`) reservado exatamente para:**

1. O único botão primário habilitado da fase — "Entrar" na tela de login.
2. Item ativo da navegação (barra inferior e barra lateral) — ícone + rótulo em `--color-acento`,
   fundo do item em `--color-acento-fundo`.
3. Foco de teclado (`--color-ring`) em todo elemento interativo.
4. Ícones dos botões de ação principal desabilitados (ex.: "Nova encomenda"), em opacidade
   reduzida — o botão comunica "isto é a ação principal, mas ainda não existe", não vira cinza
   genérico.

**Regra travada:** um botão terracota por tela, no máximo. Os botões desabilitados de cada
módulo (D-01) contam como o único botão terracota daquela tela — nenhuma tela desta fase tem
mais de um.

**Cores semânticas dos protótipos (etapa, modalidade, tipo de queima, nível do forno) não
aparecem em nenhuma tela desta fase** — ficam só nos tokens, para as Fases 3 a 6.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA (única ação real da fase) | "Entrar" (botão de login, já existe — só reestilizado) |
| Empty state heading | Ver tabela "Estados vazios por tela" abaixo — cada tela tem a sua |
| Empty state body | Ver tabela "Estados vazios por tela" abaixo |
| Error state | "Não deu para carregar esta página. Verifique a internet e tente de novo." + botão "Tentar de novo" |
| Destructive confirmation | Não implementada nesta fase (D-07). Convenção documentada abaixo para as Fases 3–6. |

### Estados vazios por tela (D-05 — só Encomendas vem pré-escrita; as demais são o trabalho desta pesquisa)

Estrutura do componente `EstadoVazio` (ver "Contrato do componente de estado vazio" abaixo):
título + corpo + botão principal desabilitado + nota junto do botão.

| Tela | Título | Corpo | Rótulo do botão (desabilitado) | Nota junto ao botão |
|------|--------|-------|-------------------------------|----------------------|
| `/` (painel, cartão Encomendas por etapa) | — | "Nenhuma encomenda em andamento." | — | — |
| `/` (painel, cartão Aulas de hoje) | — | "Nenhuma aula hoje." | — | — |
| `/` (painel, cartão Fornos em atenção) | — | "Nenhum forno em atenção." | — | — |
| `/` (painel, cartão Estoque baixo) | — | "Nenhum material em alerta." | — | — |
| `/encomendas` | "A roda ainda não gira." | "Quando a primeira encomenda entrar, o cronograma com as seis etapas aparece bem aqui." | "Nova encomenda" | "Chega na Fase 3." |
| `/agenda` | "Nenhuma turma na grade ainda." | "Cadastre a primeira turma e as aulas da semana aparecem aqui, com data e presença por aluna." | "Nova turma" | "Chega na Fase 5." |
| `/queimas` | "Nenhum forno cadastrado ainda." | "Cadastre o primeiro forno para começar a contar as queimas em dois toques." | "Novo forno" | "Chega na Fase 4." |
| `/estoque` | "Nada no estoque ainda." | "Cadastre o primeiro material — cerâmica, pintura ou bordado — para começar a controlar o saldo." | "Novo material" | "Chega na Fase 6." |

Os cartões do painel inicial usam só a linha de corpo, sem título nem botão — são compactos
(D-02); o cabeçalho do cartão já é o nome dele ("Encomendas por etapa" etc.), então repetir um
título dentro do cartão seria redundante.

### `/orcamentos` — tela "por vir" (D-04, distinta de estado vazio)

Não é um estado vazio (não existe uma "primeira coisa a cadastrar" nem data prevista) — é um
aviso definitivo sobre um módulo bloqueado. Sem botão desabilitado, para não sugerir uma ação
que vai existir em breve:

- **Título:** "A calculadora ainda não existe."
- **Corpo:** "Ela depende das planilhas de precificação do ateliê. Assim que estiverem prontas,
  o orçamento sai daqui."

### Convenção adiada — Confirmação Destrutiva (UI-08, D-07)

Nenhum `alert-dialog` é instalado nesta fase; não há nada para excluir ainda. Registrado aqui
como contrato obrigatório para quando as Fases 3–6 implementarem exclusão, seguindo
`04-DESIGN-SYSTEM.md` §7:

```
Excluir {item}? {o que é perdido, nomeado}.
```

Exemplo literal da fonte: *"Excluir a encomenda «Coleção Verão»? Os 3 itens dela serão
apagados."*

### Voz — regras que toda frase nova desta fase segue (§9)

- Afetiva, sensorial, direta — nunca corporativa. "Nada por aqui ainda" em vez de "Nenhum
  registro encontrado no sistema."
- Erro sempre diz o que fazer: "Verifique a internet e tente de novo", nunca "Erro 500".
- Feminino ao falar de alunas; forma neutra para quem usa o sistema (gestores).

---

## Navegação — Casca da Aplicação (UI-02, UI-03, UI-04, UI-05, D-12, D-15)

### Breakpoint

**768px** (`md` do Tailwind). Abaixo: barra inferior + cabeçalho móvel. A partir de 768px:
barra lateral fixa; nem barra inferior nem cabeçalho móvel são renderizados.

### Barra inferior (celular, < 768px)

- Fixa no rodapé (`position: fixed; bottom: 0`), fundo `--color-superficie`, borda superior
  `--color-borda`.
- Exatamente **5 itens**, nesta ordem: Início, Encomendas, Agenda, Queimas, Estoque. Orçamentos
  **nunca** entra aqui (UI-04) — vem só pelo menu do usuário.
- Altura mínima **56px** por item (`04-DESIGN-SYSTEM.md` §5); cada item ocupa 1/5 da largura.
- Cada item: ícone (20–24px) empilhado sobre rótulo (12px/16 500, texto normal — ver exceção
  tipográfica acima).
- Alvo de toque de cada item ≥ 44×44px mesmo com o rótulo (a área clicável é o item inteiro de
  56px de altura, não só o ícone).
- Item ativo: ícone + rótulo em `--color-acento`; itens inativos em `--color-tinta-media`.
- `padding-bottom: env(safe-area-inset-bottom)` no contêiner da barra, para não ficar sob a
  faixa de gestos do iOS.
- Ícones (`lucide-react`, escolha desta pesquisa — ver "Ícones" abaixo).

### Cabeçalho móvel (celular, < 768px)

- Barra fixa no topo, `position: sticky; top: 0`, fundo `--color-superficie`, borda inferior
  `--color-borda`, altura 56px.
- Conteúdo: título da página (papel `título`, à esquerda) + botão de avatar (à direita, círculo
  40px com alvo de toque de 44px, ícone `CircleUserRound` ou iniciais do nome).
- O botão de avatar abre o menu do usuário (D-15) — nome, Orçamentos, Sair — em um `Sheet` (o
  componente shadcn já instalado nesta fase) subindo do topo ou lateral, nunca da barra
  inferior.
- Não leva busca, filtro nem nada além disso nesta fase — os módulos ainda não têm conteúdo
  para filtrar.

### Barra lateral (desktop, ≥ 768px)

- Fixa em **240px**, **não recolhível** (D-12 — decisão consciente que simplifica a §5 da fonte,
  que sugeria recolhível).
- Topo: componente `Logo` (ver abaixo).
- Meio: os mesmos 5 itens da barra inferior, ícone + rótulo lado a lado, altura de item ≥ 44px.
  Item ativo: fundo `--color-sidebar-accent`, texto/ícone `--color-sidebar-accent-foreground`.
- Rodapé: menu do usuário (D-15) — nome de quem entrou, e um `DropdownMenu` (componente shadcn
  já instalado) com dois itens: "Orçamentos" (leva a `/orcamentos`) e "Sair" (aciona a Server
  Action `sair` já existente em `lib/auth/acoes.ts`).
- Usa o componente `Sidebar` do shadcn com o namespace de cor próprio (as 8 variáveis
  `--color-sidebar-*` do bloco de tokens acima).

### Detecção do item ativo

Discricionário (CONTEXT.md) — recomendação desta pesquisa para remover ambiguidade: comparar o
`pathname` atual (via `usePathname()`) com o `href` de cada item; `/` corresponde só a "Início"
(comparação exata), os demais usam `startsWith` do próprio caminho (ex.: `/encomendas` cobre
`/encomendas` e qualquer sub-rota futura).

### Ícones (`lucide-react`) — recomendação desta pesquisa

| Item | Ícone |
|------|-------|
| Início | `Home` |
| Encomendas | `Package` |
| Agenda | `CalendarDays` |
| Queimas | `Flame` |
| Estoque | `Archive` |
| Orçamentos (menu do usuário) | `Calculator` |
| Sair (menu do usuário) | `LogOut` |
| Avatar (cabeçalho móvel) | `CircleUserRound` |

### Componente `Logo` (D-13)

- Renderiza a palavra "AMASSA" em Archivo Narrow, peso 700, papel `display` ou próximo disso,
  cor `--color-tinta` (ou branco se o fundo for escuro — não é o caso nesta fase).
- Interface do componente já preparada para receber um SVG no lugar do texto quando o dono
  exportar a Vinila do mídia kit — troca de conteúdo interno, sem mudar onde o componente é
  usado (barra lateral, tela de login).
- O executor **não** desenha uma aproximação da Vinila em curvas.

---

## Cabeçalho de Página — padrão compartilhado (D-01)

Todo módulo (`/encomendas`, `/agenda`, `/queimas`, `/estoque`) segue a mesma moldura:

```
┌─────────────────────────────────────────────┐
│ {Título da página — papel display}           │
│                          [Botão principal ►] │ ← desabilitado, opacidade reduzida
├─────────────────────────────────────────────┤
│                                               │
│              {EstadoVazio}                   │
│                                               │
└─────────────────────────────────────────────┘
```

- Título: papel `display` (28px/32 700), texto exato do módulo ("Encomendas", "Agenda",
  "Queimas", "Estoque").
- Botão principal: rótulo por tela conforme a tabela de estados vazios acima, `disabled`,
  `aria-disabled="true"`, com a nota explicativa visível ao lado ou abaixo dele (não só em
  `title`/tooltip — precisa ser lido sem interação, inclusive por leitor de tela).
- Nesta fase, cabeçalho + botão inerte + estado vazio ocupam a tela inteira — não há mais nada
  abaixo.
- `/` (painel inicial) **não** segue este padrão de cabeçalho único — ver "Painel Inicial"
  abaixo.
- `/orcamentos` usa uma versão sem botão (ver seção de copywriting).

---

## Painel Inicial (D-02, D-16)

Substitui `app/(app)/page.tsx` provisório. Estrutura:

- Título da página (papel `display`): "Painel" ou "Olá, {nome}" — recomendação: "Olá, {nome}."
  como saudação (reaproveita `usuario.nome` de `exigirUsuario()`, sem consulta nova),
  subtítulo/rótulo de seção (papel `micro`, caixa alta) "SEU DIA HOJE" acima dos 4 cartões.
- Grade de **4 cartões nomeados**, cada um usando o componente `Card` do shadcn:
  1. **Encomendas por etapa**
  2. **Aulas de hoje**
  3. **Fornos em atenção**
  4. **Estoque baixo**
- Cada cartão: título do cartão (papel `título`) + corpo com o estado vazio dele (tabela acima)
  — sem botão, sem esqueleto (não há dado assíncrono real ainda; ver "Estado de carregamento"
  abaixo).
- Layout: 1 coluna no celular (empilhados), 2×2 no desktop (dentro da área de conteúdo, à
  direita da barra lateral de 240px).
- Nenhuma tela exige rolagem horizontal (UI-06) — a grade quebra para 1 coluna antes de
  qualquer cartão precisar encolher abaixo de um tamanho legível.

---

## Contrato do componente de estado vazio (`components/amassa/estado-vazio.tsx`)

Resolve UI-07 ("frase de contexto e botão") de forma reutilizável — decisão de discrição do
CONTEXT.md, especificada aqui para remover ambiguidade de implementação:

```tsx
type EstadoVazioProps = {
  titulo: string;
  corpo: string;
  rotuloBotao?: string;     // omitido = sem botão (caso /orcamentos)
  notaBotao?: string;       // texto abaixo do botão desabilitado
};
```

- Centralizado vertical e horizontalmente na área de conteúdo.
- Sem ícone decorativo — o texto carrega a voz do produto; um ícone genérico de "vazio" (caixa,
  lupa) seria decoração, contra a regra de "cor é informação, não decoração" estendida a ícone.
- Botão usa a variante `default` do `Button` do shadcn (que já resolve para `--color-acento` via
  `--color-primary`), com `disabled`.

---

## Contrato do componente de estado de erro (`components/amassa/estado-erro.tsx`)

Usado em `app/error.tsx` (novo — não existe hoje) e em qualquer falha de carregamento futura:

- Título: "Algo não funcionou." (papel `título`)
- Corpo: "Não deu para carregar esta página. Verifique a internet e tente de novo." (papel
  `corpo`)
- Botão: "Tentar de novo" — em `app/error.tsx` chama a função `reset()` que o Next.js injeta no
  boundary de erro; variante `default` do `Button`.
- Cor de fundo do ícone/selo (se houver) usa `--color-erro-fundo`, nunca vermelho puro de alerta
  genérico do navegador.
- `role="alert"` no contêiner, para leitor de tela anunciar sem exigir foco manual.

`app/not-found.tsx` (rota inexistente) segue o mesmo componente com copy própria:
"Esta página não existe." / "Verifique o endereço ou volte para o painel." + botão "Voltar para
o painel" (link para `/`, não `disabled`).

---

## Estado de carregamento — esqueletos (D-03)

- Esqueleto **nunca é placeholder permanente** — só aparece enquanto algo carrega de verdade.
  Nesta fase, o único carregamento real é `exigirUsuario()` (leitura de sessão), que o Next.js
  já resolve no servidor antes de renderizar — não há tela de carregamento "piscando" no
  cliente para as rotas desta fase.
- O componente `Skeleton` do shadcn (D-06) é instalado e usado no **formato do conteúdo que ele
  substitui** (nunca um "carregando..." solto), preparando o padrão que as Fases 3–6 vão
  precisar para consultas reais:
  - Esqueleto de cartão do painel: retângulo do tamanho do título do cartão + duas linhas do
    tamanho do corpo.
  - Esqueleto de item de lista/módulo: reservado para quando o módulo ganhar dado real.
- Verificação desta fase: existe pelo menos um `loading.tsx` de exemplo (recomendação: em
  `app/(app)/loading.tsx`, cobrindo a navegação entre módulos) usando o `Skeleton` no formato
  do cabeçalho de página + área de conteúdo, mesmo que raramente visível (a navegação é rápida).
  Fica como prova de padrão, não como tela seriamente testável até existir dado assíncrono de
  verdade — ver "UI Considerations" abaixo.

---

## Tela de Login — reestilizada (D-14)

Mantém a mecânica existente (`app/(auth)/login/page.tsx`, `botao-entrar.tsx`, a Server Action
`entrar`), troca só a aparência:

- Fundo: `--color-fundo`.
- Cartão de login centralizado: `Card` do shadcn, `--color-superficie`, `rounded-xl`
  (`--radius-xl`), sombra leve.
- `Logo` (componente, texto "AMASSA" em Archivo Narrow) acima do formulário, seguido da frase
  `FRASE_NO_AR` (já existe, não muda).
- Campos de e-mail e senha: no mínimo 16px de fonte (papel `corpo`), altura mínima 44px, borda
  `--color-borda-forte`, foco com anel `--color-ring`.
- Botão "Entrar": `Button` do shadcn, variante `default` (resolve para o único terracota desta
  tela).
- Mensagens de erro existentes (`mensagemDeErro`) mantêm o texto atual — só o estilo visual
  muda (usar `--color-erro` no texto em vez da classe utilitária `text-red-700` atual).

---

## Rotas e arquivos novos desta fase

```
app/(app)/
├─ layout.tsx              # NOVO — casca: sidebar (desktop) / bottom bar + header (mobile)
├─ page.tsx                # SUBSTITUÍDO — painel inicial real (D-16)
├─ error.tsx               # NOVO — estado de erro global do grupo (app)
├─ not-found.tsx           # NOVO — 404 dentro da casca
├─ loading.tsx             # NOVO — esqueleto de navegação entre módulos
├─ encomendas/page.tsx     # NOVO — cabeçalho + estado vazio
├─ agenda/page.tsx         # NOVO — cabeçalho + estado vazio
├─ queimas/page.tsx        # NOVO — cabeçalho + estado vazio
├─ estoque/page.tsx        # NOVO — cabeçalho + estado vazio
└─ orcamentos/page.tsx     # NOVO — tela "por vir" (D-04)

components/
├─ ui/                     # território do shadcn (D-11) — button, card, sidebar, sheet,
│                           # skeleton, dropdown-menu, separator
└─ amassa/                 # código nosso (D-11)
   ├─ logo.tsx
   ├─ barra-lateral.tsx    # ou nome equivalente — envolve o Sidebar do shadcn
   ├─ barra-inferior.tsx
   ├─ cabecalho-movel.tsx
   ├─ menu-usuario.tsx
   ├─ cabecalho-pagina.tsx
   ├─ estado-vazio.tsx
   ├─ estado-erro.tsx
   └─ cartao-painel.tsx
```

`middleware.ts` e `lib/auth/rotas-publicas.ts` não mudam — as rotas novas ficam protegidas
automaticamente por já estarem fora de `ROTAS_PUBLICAS`. `exigirUsuario()` entra na primeira
linha de toda página nova (o padrão que `app/(app)/page.tsx` provisório já demonstra).

---

## Acessibilidade (UI-09) — contrato de verificação

| Requisito | Como é garantido | Como é verificado |
|-----------|-------------------|---------------------|
| Alvo de toque ≥ 44px | Todo item da barra inferior (56px), botão de avatar (44px), itens da barra lateral (≥ 44px), botões principais (min-height 44px) | Teste Playwright mede a caixa (`boundingBox()`) dos elementos interativos da casca |
| Contraste AA | Tokens de `04-DESIGN-SYSTEM.md` §2 já corrigidos (`--color-tinta-fraca` escurecida) | Conferência com ferramenta de contraste (ex.: axe / Playwright + `axe-core`) sobre a casca renderizada, antes de fechar a fase — "parece legível" não é o teste |
| Navegação por teclado | Todo item de navegação e formulário (login) alcançável por Tab, foco visível via `--color-ring` | Teste Playwright navega com `Tab`/`Enter` até logar e até abrir o menu do usuário |
| `aria-label` em botão só com ícone | Botão de avatar, item de navegação se algum dia perder o rótulo visível (não é o caso — todos têm rótulo) | Revisão de código + asserção Playwright (`getByRole('button', { name: ... })`) |
| Botão desabilitado comunicado a leitor de tela | `disabled` + `aria-disabled="true"` + nota textual visível (não só tooltip) | Revisão de código |

**UI-05 (navegação confortável com o polegar) não é medível por teste automatizado** — fica
registrado como item de verificação humana da fase, no celular de verdade, em pé, como o
núcleo de valor do projeto descreve.

---

## Prova automatizada de UI-01 (D-09)

Teste Playwright (projeto desktop e projeto celular do `tests/e2e/`) que:

1. Abre a casca autenticada.
2. Lê `getComputedStyle` do botão primário (ex.: "Entrar" no login, ou o botão principal
   desabilitado de um módulo) e confere `background-color` resolvendo para `rgb(137, 64, 37)`
   (`#894025`).
3. Lê `getComputedStyle` do `<body>` ou contêiner principal e confere `background-color`
   resolvendo para `rgb(246, 243, 240)` (`#F6F3F0`).
4. Lê `getComputedStyle` de um título (papel `display` ou `título`) e confere que
   `font-family` contém `"Archivo Narrow"`.

Este teste é o portão contra a "armadilha de silêncio": alguém instalar um componente shadcn
sem o mapeamento `@theme inline` não quebra o build nem aparece no console — só o teste pega.

---

## UI Considerations

Cobertura de estado aplicável a uma fase que só entrega cascas e estados vazios (sem dado real
de produto ainda):

Applicable state considerations resolved: 8 covered, 2 backstop, 0 unresolved

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | Telas de módulo (`/encomendas`, `/agenda`, `/queimas`, `/estoque`) | ✅ covered | Cada tela renderiza o `EstadoVazio` com título/corpo/botão da tabela "Estados vazios por tela" |
| empty | Cartões do painel inicial (4) | ✅ covered | Cada cartão mostra a linha de corpo definida na mesma tabela, sem título nem botão (D-02) |
| empty | `/orcamentos` | ✅ covered | Copy definida na seção "tela por vir" — sem CTA, por ser bloqueio definitivo, não estado transitório |
| zero-one-many | Menu do usuário | ✅ covered | Sempre exatamente um usuário (o autenticado) — sem lista, sem plural a tratar |
| overflow | Barra inferior (5 itens fixos) | ✅ covered | Conjunto fixo e conhecido de 5 itens — não há lista dinâmica que possa transbordar |
| overflow | Barra lateral (240px fixo) | ✅ covered | Itens de navegação são rótulos curtos e fixos (Início, Encomendas, Agenda, Queimas, Estoque) — nenhum é longo o bastante para quebrar em 240px |
| error | `app/error.tsx`, `app/not-found.tsx` | ✅ covered | Copy definida em "Contrato do componente de estado de erro" |
| loading | Navegação entre módulos | ✅ covered | `Skeleton` no formato do cabeçalho + conteúdo, ver seção "Estado de carregamento" |
| long-text | Nome do usuário no menu/rodapé da barra lateral | 🧪 backstop | Truncar com `text-overflow: ellipsis` em uma linha; precisa de teste manual com um nome longo real antes de fechar a fase, já que nenhum usuário de teste hoje tem nome longo |
| loading | Estado de carregamento com dado assíncrono real | 🧪 backstop | O `Skeleton` existe e segue o formato do conteúdo, mas nenhuma tela desta fase tem consulta lenta o bastante para o esqueleto aparecer de forma confiável em teste automatizado — verificação visual fica pendente para quando as Fases 3–6 adicionarem dado real |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | button, card, sidebar, sheet, skeleton, dropdown-menu, separator | not required |

Nenhum registro de terceiros foi declarado nesta fase. Não se aplica portão de vetting de
terceiros.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending

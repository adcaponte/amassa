---
phase: 6
slug: estoque
status: approved
reviewed_at: 2026-09-29
shadcn_initialized: true
preset: radix-nova (baseColor neutral, CLI 3.8.5 fixada — decisões 02b-01/02b-02), lucide-react
created: 2026-09-29
---

# Phase 6 — Estoque — UI Design Contract

> A fonte de verdade visual é `prototipo.html` ("Estoque AMASSA Cerrado"), aprovado pelo dono em
> 18/09 e revisto por ele em 20/09. Este documento cobre quatro coisas que o protótipo, sozinho, não
> resolve: (1) o que um protótipo com `localStorage` não expressa (dado do Postgres, dois gestores ao
> mesmo tempo, Server Actions, carregando/erro de verdade); (2) o que o `ADENDO.md` e o
> `06-CONTEXT.md` mudaram por cima do protótipo; (3) as telas que o protótipo **não desenha** — a
> contagem geral, a primeira abertura, o aviso de saldo negativo fora do Estoque; (4) o mapeamento
> do protótipo para os tokens e componentes já em produção.
>
> **Precedência, a mesma de todas as fases:** o protótipo vence sobre a **interface**; o `ADENDO.md`
> e as decisões travadas do `06-CONTEXT.md` (D-01..D-12, D-15) vencem sobre **regra de dado**, e
> também sobre a interface onde a regra de dado a obriga a mudar. Cada ponto em que este contrato
> contraria o protótipo está dito em "Onde o protótipo não vale mais" — nunca em silêncio.
>
> **Todo dado do protótipo é inventado.** Nenhum nome, preço, quantidade, fornecedor ou legenda dele
> ("Argila de alta branca", "Turma de quarta, manhã", "Coleção Verão — Marina", "Cerâmica Pirineus")
> entra em copy, semente ou teste. Os exemplos deste documento são ilustração de formato.
>
> **Escrito sem o dono**, na noite de 29/09/2026, sob a instrução dele de seguir pela opção
> recomendada. As escolhas de interface que ficaram em aberto estão em "Decisões desta UI-SPEC"
> (UI-D1..UI-D16), cada uma com o porquê — o dono pode desfazer qualquer uma.

---

## Herdado do sistema de design — não redefinir aqui

- Tokens de cor, raio e tipografia de `app/globals.css` (02b + 04.4). **Esta fase não cria nenhum
  token novo** — nem de cor, nem de tamanho de fonte. Os pares de cor que ela passa a usar estão
  nomeados em "Color → Pares de contraste" para o planejador acrescentá-los a
  `tests/unit/contraste.test.ts`.
- Esqueleto no formato do conteúdo enquanto carrega; nunca "carregando..." solto; tela em branco é
  defeito.
- Erro em linguagem humana, dizendo o que fazer; formulário nunca perde o que foi digitado.
- Alvos de toque ≥ 44 px; campo de formulário nunca < 16 px; `aria-label` em botão só com ícone;
  foco visível pelo anel `--color-ring`; contraste AA medido; `prefers-reduced-motion` respeitado.
- Voz afetiva e direta, nunca corporativa; forma neutra para quem usa o sistema (gestores).
- **Um botão terracota por tela, no máximo** (`04-DESIGN-SYSTEM.md` §3).
- Toda "folha" do protótipo (`abrirFolha`) vira `components/ui/dialog.tsx`, no padrão já usado em
  `formulario-forno.tsx`: **no celular, folha de baixo de tela toda** (`h-[100dvh]`, desliza de
  baixo); **a partir de `md` (768px), modal centralizado** `md:max-w-lg`. Rodapé preso por flex,
  nunca `position: sticky` (G-03-1). `sheet.tsx` continua reservado ao menu do usuário.
- Toast (`sonner`) de 5 s; no celular, acima da barra inferior pela variável
  `--deslocamento-aviso` (ver UI-D6 para o acréscimo desta fase).
- Rotas sempre por `rotaDeGestao(...)` (`tests/unit/sem-rota-antiga.test.ts`).
- Dinheiro por `formatarReais` e quantidade por `formatarQuantidade` (`lib/financeiro/formato.ts`),
  sempre com `tabular-nums`; unidade exibida por `ROTULO_UNIDADE` (litro aparece como "L").

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (já inicializado — `components.json` presente, `registries: {}`) |
| Preset | `radix-nova`, `baseColor: neutral`, CLI fixada em 3.8.5 (não `@latest`) |
| Component library | Radix UI (via shadcn) |
| Icon library | lucide-react |
| Font | Archivo Narrow (papéis `display`/`titulo`) + Inter (corpo) — `next/font/google` |

---

## Spacing Scale

Nenhum token novo — a escala da 02b:

| Token | Value | Usage nesta fase |
|-------|-------|------------------|
| xs | 4px | Gap entre o ponto de área e o nome da área; padding vertical de chip; gap ícone–texto no banner |
| sm | 8px | Gap entre cartões de saldo, entre pílulas de filtro, entre atalhos de quantidade, entre botões de destino; padding vertical da barra de ação fixa |
| md | 16px | Padding de cartão, de linha do histórico, de linha da contagem, do banner; gap entre campos da folha |
| lg | 24px | Padding lateral da página no celular (`px-6`, igual ao `CabecalhoPagina`); padding da folha; padding interno do bloco "Material consumido" |
| xl | 32px | Padding lateral da página no desktop (`md:px-8`); espaço entre a barra de abas e o conteúdo |
| 2xl | 48px | Padding vertical de estado vazio e do painel da primeira contagem |
| 3xl | 64px | Não usado nesta fase |

Os valores "quebrados" do protótipo (10, 13, 14, 15, 17, 18px de padding/gap) arredondam para o
token mais próximo da tabela acima — 10→8, 13/14/15→16, 17/18→16 (folha: 24).

**Exceções (todas vêm de alvo de toque ou do protótipo, todas múltiplas de 4):**

- **44px** — altura mínima de todo botão, pílula, atalho, link de ação e do fechar da folha. O
  protótipo tem `.btn-sm` (38px), `.fpill` (40px), `.aba` e `.atalhos button` (42px) e o
  `select` de "Quem está aqui" (36px): **todos sobem para 44px** na implementação (`min-h-[44px]`),
  preservando o padding e a densidade visual — mesma correção que a 04.4 fez em `.btn.mini`.
- **52px** — controle segmentado Entrada · Saída · Ajuste, cada botão de destino, e o botão
  principal da barra de ação fixa (herdados do protótipo: `.segm button`, `.destinos button`,
  `.acao-fixa .btn`).
- **56px** — linha de material no seletor "Qual material?" (`.lista-mat button`, herdado).
- **60px** — campo grande de quantidade (`.grande`, herdado).
- **68px** — altura da barra de ação fixa do celular: 8 + 52 + 8. Vira a variável
  `--altura-acao-fixa` (UI-D6).
- **4px** — borda esquerda do cartão em alerta (herdada de `.cartao.baixo`).
- **2px — largura de borda, não espaçamento:** a linha-guia à esquerda da sanfona aberta
  (`.dentro`, `border-left: 2px`). Espessura de traço fica fora da escala de espaçamento, como o
  1px de toda `--color-borda` do projeto; não ocupa nem separa espaço de conteúdo (o recuo ao
  lado dela é 16px, da escala). Não sobe para 4px de propósito: 4px é a espessura reservada ao
  **alerta** (acabando/negativo) — uma guia de navegação com o mesmo peso seria lida como aviso.
- **8px — trilho das barras do "Para onde foi"** (o protótipo tinha 10px). 8px porque é o token
  `sm` da escala e mantém a barra fina como no protótipo; 12px dobraria o peso visual das seis
  barras numa tela em que o foco é o total em Display.

---

## Typography

**4 tamanhos (28, 20, 16, 14px), todos tokens existentes, zero tamanhos novos.** Mesmo teto e mesma
escolha da 04.4: `Micro` (12px) **não é usado** nesta fase — o protótipo tem textos de 11 a 13px
(chip 11, cabeçalho de tabela 11, rótulo de resumo 11, linha de autor 12, meta 12,5, dica 12,5,
sub da barra 12,5, contagem 13) e **todos sobem para `Apoio` (14px)**. Custa um pouco de largura
nos chips; ganha leitura em pé, com a mão suja, que é o valor central.

| Role | Size | Weight | Line Height | Uso nesta fase |
|------|------|--------|-------------|-----------------|
| **Display** | 28px | 700 (do token) | 32px | Título da página ("Estoque", "Contagem do estoque"); o **saldo** no cartão (protótipo 23px) e no resumo da folha do material; o **campo grande de quantidade** (protótipo 26px); o total "Material consumido no período" (protótipo 30px) |
| Título | 20px | 600 | 28px (1.4) | Título de folha/diálogo (protótipo `h2` 20px); título de estado vazio e do painel da primeira contagem (protótipo 17px); rótulo da sanfona de 1º nível — a área (protótipo 18px); título do bloco "Estoque acabando" no Início (já existe) |
| Corpo | 16px | 400 · 600 | 24px (1.5) | Texto corrido, todo campo de formulário, nome do material (600), texto de botão (600), valor na linha do histórico e da barra (600), texto do toast |
| Apoio | 14px | 400 · 600 | 20px (1.43) | Linha de metadados do cartão, dica de campo, linha de autor/data do histórico, sub-linha da barra, contagem "N de M", notas de rodapé, texto do banner, pílula de filtro e de aba (600 quando marcada) |
| Apoio (chip) | 14px | 600 | 20px | Chips "Acabando", "Saldo negativo", "Desativado", "Perda", "Venda", "do Financeiro", "Estorno", "Saldo inicial" — padding 4px × 8px, `rounded-full` |
| Apoio (rótulo em caixa alta) | 14px | 600, uppercase, tracking 0.06em | 20px | Cabeçalho de coluna da tabela de saldos (protótipo 11px), rótulo "MATERIAL CONSUMIDO NO PERÍODO" (protótipo 11px), cabeçalho de grupo de área na contagem e no resultado de busca do seletor (protótipo `.grupo-cat` 11px) |

**Pesos: 400 e 600.**

**Exceção documentada — o 700:** entra **só** pelo token travado `--text-display--font-weight: 700`
do papel Display (`04-DESIGN-SYSTEM.md` §4, travado pelo dono; `app/globals.css`), nunca como
escolha desta fase. Nenhum componente do Estoque escreve `font-bold` ou peso 700 à mão; onde
aparece 700, é porque o elemento usa `text-display`. Mesma leitura da 02b/04.4 (6 papéis com seus
pesos, desvio deliberado já aprovado). O peso 500 do protótipo (`.aba`, `.fpill`, `.destinos button`, `.lista-mat .n`) vira 400
quando não marcado e 600 quando marcado — o estado marcado não depende só de cor.

Todo número (saldo, quantidade, dinheiro, contagem, porcentagem) usa **`tabular-nums`**.

---

## Color

Os tokens de superfície, texto e ação do protótipo já são, byte a byte, os tokens da plataforma
(`--fundo`↔`--color-fundo`, `--acento`↔`--color-acento`, `--atencao`↔`--color-atencao`,
`--erro`↔`--color-erro`...). Os três hex **soltos** do protótipo não entram:

| Hex do protótipo | Onde | Vira |
|---|---|---|
| `#7A3A05` (texto do banner e do chip "Acabando") | `.banner b/p`, `.chip-alerta` | `--color-atencao` (#B45309) — o par que 10+ componentes do projeto já usam (`bg-atencao-fundo text-atencao`) |
| `#EBCF93`, `#C9A05C` (borda do banner e do botão dele) | `.banner`, `.banner button` | `--color-atencao` |
| `#FFFDF6` (fundo do cartão/linha em alerta) | `.cartao.baixo`, `tr.baixo` | `--color-superficie` — o alerta fica na borda esquerda de 4px, no número e no chip; nenhum fundo novo |
| `--acento-claro` #E0C8BB, `--acento-medio` #B9724F (não existem em `globals.css`) | borda do chip "do Financeiro", linha-guia da sanfona | `--color-acento` (borda tracejada do chip) e `--color-borda-forte` (linha-guia) |

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `--color-fundo` #F6F3F0 | Fundo da página, fundo da barra de ação fixa (com `backdrop-blur`, como o protótipo) |
| Secondary (30%) | `--color-superficie` #FFFFFF / `--color-superficie-2` #EFEAE5 | Cartões, painel do histórico, tabela, folhas; `superficie-2` no fundo dos atalhos de quantidade, do contador da sanfona, do trilho das barras, da caixa "escolhido" da folha de movimentação, da caixa de resumo da folha do material e das notas de rodapé |
| Accent (10%) | `--color-acento` #894025 | Lista fechada abaixo |
| Destructive | `--color-erro` #B91C1C | Lista fechada abaixo — **nenhum botão destrutivo existe nesta fase** (nada é apagado) |

**Accent reservado para (lista fechada):**
1. O **único** botão primário de cada tela: "Registrar movimentação" (Estoque — na barra fixa do
   celular, no cabeçalho do desktop); "Registrar baixa" / "Registrar entrada" / "Registrar
   ajuste" (folha de movimentação); "Cadastrar material" (folha "Novo material"); "Salvar
   material" (folha "Editar material"); "Começar a contagem" (painel da primeira
   abertura — e só nesse estado, em que a barra fixa some, UI-D3); "+ Novo material" **só** no
   estado vazio sem nenhum material (em todo outro lugar ele é `outline`); "Desativar material"
   (confirmação de desativar). A tela de contagem **não tem** botão terracota (cada linha confirma com botão
   `outline`).
2. Anel de foco de todo elemento interativo.
3. Segmento marcado de Entrada · Saída · Ajuste — fundo `--color-acento`, texto branco (herdado de
   `.segm button[aria-pressed=true]`; é **estado**, não ação — mesma leitura que a 04.4 fez para a
   pílula de filtro marcada).
4. Pílula de filtro marcada (área, "Acabando", tipo do histórico, período), botão de destino
   marcado e sanfona aberta — fundo `--color-acento-fundo`, borda e texto `--color-acento`
   (herdado de `.fpill[aria-pressed=true]`, `.destinos button[aria-pressed=true]`,
   `.sanfona[aria-expanded=true]`).
5. Chip "do Financeiro" (texto `--color-acento` sobre `--color-acento-fundo`, borda tracejada
   `--color-acento`) e o número de um **ajuste** no histórico (`.qtd.aj`).
6. Caixa de pré-visualização "o saldo passa de X para Y" — fundo `--color-acento-fundo`, texto
   `--color-acento-hover` (herdado de `.previa`).
7. Preenchimento das barras do "Para onde foi" (todas, exceto "Perda ou quebra").
8. Link de ação "abrir estoque" do bloco do Início (já existe) e os links de texto desta fase
   ("Continuar em Cadastros → Catálogo", "Ir para Compra de material").

**Destructive (`--color-erro`) reservado para:**
- **Saldo negativo**: borda esquerda de 4px do cartão, o número do saldo, e o chip "Saldo negativo"
  (texto `--color-erro` sobre `--color-erro-fundo`) — na lista, na folha do material, no bloco do
  Início e no aviso do painel de Venda (D-21).
- Chip "Perda" e a barra "Perda ou quebra" do "Para onde foi" (herdados de `.chip-perda` e do
  `background: var(--erro)` da barra).
- Mensagens de erro de campo e de carregamento.

**Atenção (`--color-atencao`) reservado para "acabando":** borda esquerda de 4px e número do cartão
abaixo do mínimo; chip "Acabando"; banner de alerta (fundo `--color-atencao-fundo`, borda e texto
`--color-atencao`, ícone `AlertTriangle`); a frase "Passa a ficar abaixo do mínimo" dentro da
pré-visualização. **Negativo nunca usa âmbar e acabando nunca usa vermelho** — são dois avisos
distintos (D-21), e a cor é a segunda pista, depois do texto do chip.

**Semânticas herdadas sem alteração:** `--color-sucesso` para o número de uma **entrada** no
histórico (`.qtd.mais`), para o chip "Venda" (`.chip-ok`) e para o "✓ Contado" da contagem.

**Área do Financeiro — decorativa, nunca texto.** O ponto de 8px antes do nome da área usa os
tokens `--color-area-*` da 04.4 (mesmo padrão de `linha-carrinho.tsx`/`lista-completa.tsx`). O nome
da área vem sempre escrito ao lado — a cor nunca carrega a informação sozinha.

### Pares de contraste — para `tests/unit/contraste.test.ts`

Medidos nesta pesquisa com a fórmula WCAG 2.1 de `lib/acessibilidade/contraste.ts`, lendo os hex de
`app/globals.css`. O planejador acrescenta cada par ao teste com `tokenDaPlataforma(...)` (nunca hex
repetido no teste), no molde do bloco "contraste das pílulas de etapa":

| # | Texto / elemento | Fundo | Razão | Mínimo | Onde |
|---|---|---|---|---|---|
| P1 | `atencao` | `atencao-fundo` | **4,51:1** | 4,5 | Banner, chip "Acabando" — **passa por 0,01**; qualquer ajuste de paleta reprova. É exatamente para isso que o par entra no teste |
| P2 | `atencao` | `superficie` | 5,02:1 | 4,5 | Número do saldo no cartão/linha abaixo do mínimo |
| P3 | `erro` | `superficie` | 6,47:1 | 4,5 | Número do saldo negativo |
| P4 | `erro` | `erro-fundo` | 5,30:1 | 4,5 | Chips "Saldo negativo" e "Perda" |
| P5 | `acento` | `acento-fundo` | 6,41:1 | 4,5 | Pílula marcada, destino marcado, sanfona aberta, chip "do Financeiro" |
| P6 | `acento-hover` | `acento-fundo` | 10,21:1 | 4,5 | Caixa "o saldo passa de X para Y" |
| P7 | `#FFFFFF` | `acento` | 7,44:1 | 4,5 | Segmento marcado, botão primário |
| P8 | `tinta-media` | `superficie-2` | 6,89:1 | 4,5 | Pré-visualização neutra ("O saldo já está certo"), atalhos de quantidade, notas de rodapé |
| P9 | `tinta-fraca` | `superficie-2` | 5,12:1 | 4,5 | Chip "Desativado", contador da sanfona |
| P10 | `sucesso` | `superficie` | 5,02:1 | 4,5 | Número de entrada no histórico, "✓ Contado" |
| P11 | `sucesso` | `sucesso-fundo` | 4,57:1 | 4,5 | Chip "Venda" — margem curta, por isso entra no teste |
| P12 | `acento` (preenchimento) | `superficie-2` (trilho) | 6,22:1 | 3,0 (não-texto) | Barra do "Para onde foi" |
| P13 | `erro` (preenchimento) | `superficie-2` (trilho) | 5,41:1 | 3,0 (não-texto) | Barra "Perda ou quebra" |
| P14 | `atencao` (borda 4px) | `superficie` | 5,02:1 | 3,0 (não-texto) | Borda esquerda do cartão acabando |
| P15 | `erro` (borda 4px) | `superficie` | 6,47:1 | 3,0 (não-texto) | Borda esquerda do cartão negativo |
| P16 | `erro` | `atencao-fundo` | 5,81:1 | 4,5 | Linha "Com saldo negativo: …" dentro do banner âmbar |
| P17a | `atencao` — **texto grande** (Display 28px/700) | `superficie-2` | **4,20:1** | 3,0 (texto grande, WCAG 1.4.3) | Saldo acabando na caixa de resumo da folha do material. **Reprovaria como texto normal** (< 4,5) — só passa porque é Display 28px/700; o teste deve afirmar ≥ 3,0 **e** o componente nunca pode usar essa cor nesse fundo abaixo de 24px (ou 18,66px em 700) |
| P17b | `erro` — **texto grande** (Display 28px/700) | `superficie-2` | 5,41:1 | 3,0 (texto grande) | Saldo negativo na caixa de resumo da folha do material |

**Margem quase nula:** **P1 (4,51:1)** e **P11 (4,57:1)** passam por menos de 0,1 — qualquer ajuste
de paleta em `--color-atencao`, `--color-atencao-fundo`, `--color-sucesso` ou `--color-sucesso-fundo`
os reprova. P17a só passa por ser texto grande. Os três são o motivo de os pares entrarem no teste.

---

## Foco Visual Principal

| Tela | Onde o olho pousa primeiro |
|---|---|
| **Estoque → Saldos (celular)** | O **número do saldo** à direita de cada cartão, em `display` 28px — é o maior texto da tela; os cartões em alerta ganham a borda colorida e sobem para o topo da lista. O banner âmbar, quando existe, é o primeiro bloco colorido acima de tudo |
| **Estoque → Saldos (primeira abertura)** | O painel "Antes de tudo, conte o que tem na prateleira." com o único botão terracota "Começar a contagem" |
| **Estoque → Histórico** | A coluna de quantidades com sinal à esquerda de cada linha (verde para entrada, tinta para saída, terracota para ajuste) |
| **Estoque → Para onde foi** | O total "Material consumido no período" em `display` |
| **Folha de movimentação** | O campo grande de quantidade (28px, centralizado) e, no rodapé preso, "O saldo passa de X para Y" logo acima do "Registrar baixa" / "Registrar entrada" / "Registrar ajuste" |
| **Contagem do estoque** | A coluna de campos "Contado" — a tela é uma lista de campos a preencher, sem nenhum botão terracota competindo |
| **Início → Estoque acabando** | O chip de cada linha ("Saldo negativo" em vermelho antes de "Acabando" em âmbar) |

---

## Copywriting Contract

### Ações

| Element | Copy |
|---------|------|
| Primary CTA — Estoque | "Registrar movimentação" (herdado) |
| CTA secundário — Estoque, novo material | "+ Novo material" no cabeçalho do desktop e no estado vazio; **"+ Material"** na barra fixa do celular (herdado — a 360px os dois botões não cabem com o rótulo longo; UI-D5) |
| CTA secundário — contagem | "Contar estoque" (`outline`, ícone `ClipboardCheck`, no cabeçalho da página) |
| CTA — primeira abertura | "Começar a contagem" |
| Ação do cartão/linha | "Dar baixa" · "Histórico" (herdados). Nome acessível inclui o material: `aria-label="Dar baixa em {nome}"`, `aria-label="Histórico de {nome}"` (o texto visível continua contido no nome — WCAG 2.5.3) |
| Botão do banner | "Ver só esses" (herdado) |
| Folha de movimentação — gravar | Segue o segmento marcado: **"Registrar baixa"** (Saída) · **"Registrar entrada"** (Entrada) · **"Registrar ajuste"** (Ajuste) — o protótipo dizia só "Registrar"; enquanto grava: "Registrando…" (`disabled`, `aria-busy="true"`) |
| Folha de movimentação — trocar material | **"Trocar material"** (o protótipo dizia só "Trocar") |
| Segmentos | "Entrada" · "Saída" · "Ajuste" (herdados) |
| Folha "Novo material" — gravar | **"Cadastrar material"** (o protótipo dizia "Cadastrar"); enquanto grava: "Cadastrando…" |
| Folha "Novo material" — sair sem gravar | **"Voltar ao estoque"** (`outline`) |
| Folha "Editar material" — gravar | **"Salvar material"**; enquanto grava: "Salvando…" |
| Folha do material — rodapé | "Editar" (`outline`) · "Registrar movimentação" (primário) — herdado ("Editar material" encurta para caber a 360px); material desativado: **"Reativar material"** (`outline`) no lugar de "Registrar movimentação"; enquanto reativa: "Reativando…" (`disabled`, `aria-busy="true"`) |
| Folha "Editar material" — desativar | "Desativar material" (`outline`, texto `--color-tinta` — é reversível, não é destrutivo) |
| Contagem — por linha | **"Confirmar contagem"** (`outline`, 44px); enquanto grava: **"Gravando…"** (`disabled`, `aria-busy="true"`); depois de gravada: link "Contar de novo" |
| Contagem — sair | "Voltar ao estoque" (`outline`, no fim da lista) e o voltar do cabeçalho (`aria-label="Voltar ao estoque"`) |
| Histórico — paginação | "Mostrar mais 50" (`outline`) |
| Fechar folha | botão 44×44 com `×` visível e `aria-label="Fechar"` (herdado de `.fechar`) — ver UI-D10 |

### Rótulos e dicas de campo (herdados do protótipo salvo onde marcado)

| Campo | Rótulo | Dica (Apoio, `--color-tinta-fraca`) |
|---|---|---|
| Quantidade (entrada/saída) | "Quantidade" | "em {unidade}" |
| Saldo contado (ajuste) | "Quanto tem na prateleira agora?" | "em {unidade} — conte, não calcule a diferença" |
| Custo (entrada) | "Quanto custou ao todo" | **novo:** "o valor da nota, em reais — é daí que sai o custo médio" (a frase do protótipo, "é o que alimenta o Financeiro", ficou falsa: a entrada manual não lança nada no Caixa) |
| Custo (entrada de peça pronta com ficha) | "Quanto custou ao todo" | **novo:** "Pela ficha de precificação: {R$ X} por peça. Pode mudar." |
| Destino | "Para onde foi?" | **mudado:** "obrigatório — é o que diz qual área pagou" (era "qual frente pagou", D-12) |
| Vínculo — aula | "Qual turma?" | "opcional" (texto livre, até 160 caracteres — D-15) |
| Vínculo — encomenda | "Qual encomenda?" | "opcional" — **seletor** das encomendas em andamento, não texto livre (D-15); primeira opção "Nenhuma" |
| Vínculo — perda | "O que aconteceu?" | "opcional" |
| Motivo do ajuste | "Por quê?" | "opcional, mas ajuda quem ler depois"; placeholder "Conferência da prateleira" |
| Busca da lista | placeholder "Buscar material ou categoria" (`aria-label="Buscar material"`) | — (o protótipo buscava também fornecedor, que não existe no catálogo) |
| Busca do seletor | placeholder "Buscar material" | — |
| Novo material — nome | "Nome" | — |
| Novo material — unidade | "Unidade" | "em que você conta este material" |
| Novo material — categoria | "Categoria da compra" | **novo:** "diz a área — {área da categoria escolhida}"; cada opção mostra "{categoria} · {área}" |
| Mínimo | "Estoque mínimo" | "zero = nunca avisa" (herdado) |
| Observações | "Observações" | "opcional — o que a próxima pessoa precisa saber" (herdado), até 500 caracteres |
| Contagem — campo | "Contado" (visível) · `aria-label="Contado de {nome}, em {unidade}"` | — |
| Contagem — custo (primeira contagem) | "Custou ao todo" · `aria-label="Quanto custou ao todo {nome}"` | "o que você pagou por {Δ} {unidade} — uma estimativa serve se não souber exato" |

Atalhos de quantidade (herdados, **somam** ao que já está no campo): `un` → +1 +2 +5 +10 ·
`g` e `ml` → +50 +100 +250 +500 · `kg` → +1 +5 +10 +25 · `L` e `m` → +1 +2 +5 +10. (O protótipo
mandava `ml` para a regra genérica; `ml` segue `g`, que é a mesma ordem de grandeza.) Nome
acessível: `aria-label="Somar {n} {unidade}"`.

Destinos da saída — **cinco**, nesta ordem, cada botão com o nome e, embaixo, a área que paga
(D-14, D-15):

| Destino | Linha de baixo (a área) | Vínculo |
|---|---|---|
| Consumo em aula | Espaço | "Qual turma?" (texto) |
| Consumo em encomenda | Peças | "Qual encomenda?" (seletor) |
| Consumo na cafeteria | Cafeteria | — (ao marcar, aparece a dica abaixo da grade: "Só o que não passa por venda — degustação, consumo interno. O que é vendido com ficha técnica já sai pela venda.") |
| Uso do ateliê | Peças | — |
| Perda ou quebra | Peças | "O que aconteceu?" (texto) |

"Venda na loja" **não existe**, nem o aviso provisório "Quando o Financeiro entrar, esta baixa vem
de lá" (D-15).

### Pré-visualização — "o saldo passa de X para Y" (rodapé da folha)

| Situação | Copy |
|---|---|
| Campo vazio | "Digite a quantidade para ver o saldo novo." (neutra — **novo**, UI-D8) |
| Saída | "O saldo passa de **{X}** para **{Y} {un}**. Vale **{R$}** ao custo médio." |
| Saída que fica abaixo do mínimo | + " Passa a ficar abaixo do mínimo ({mín} {un})." |
| Saída que deixa negativo | + " Isso deixa o saldo negativo — só registre se tiver certeza." (herdado; **não bloqueia**) |
| Entrada | "O saldo passa de **{X}** para **{Y} {un}**." + quando há custo: " Custo unitário: **{R$}/{un}**." |
| Ajuste com diferença | "Diferença de **{±d} {un}**. O saldo passa de **{X}** para **{Y} {un}**." |
| Ajuste sem diferença | "O saldo já está certo. Nada será gravado." (neutra, herdado) |

### Toasts

| Evento | Copy |
|---|---|
| Saída gravada | "Baixa de {q} {un} em {nome}." (herdado) · se ficou negativo: + " O saldo ficou em {−X} {un}." |
| Entrada gravada | "Entrada de {q} {un} em {nome}." (herdado) |
| Ajuste gravado | "Ajuste em {nome}: {±d} {un}." |
| Ajuste sem diferença | **"Conferido. O saldo já estava correto."** (literal do EST-08) |
| Material cadastrado | "{nome} cadastrado. Registre a entrada para dar saldo a ele." (herdado — e a folha de movimentação abre já em "Entrada" para ele, UI-D12) |
| Material editado | "Material atualizado." (herdado) |
| Desativado | "{nome} desativado. Continua no filtro Desativados." |
| Reativado | "{nome} reativado." |

### Estados vazios

| Onde | Título (Título 20px) | Corpo | Ação |
|---|---|---|---|
| Estoque sem nenhum item com estoque | "Nada no estoque ainda." | "Cadastre o primeiro material — argila, esmalte, café, embalagem — para acompanhar o que entra e o que sai. Item marcado com “Tem estoque próprio” em Cadastros → Catálogo aparece aqui sozinho." | "+ Novo material" (primário — nesse estado a barra fixa some e o cabeçalho fica sem "Registrar movimentação", "+ Novo material" e "Contar estoque": não há o que movimentar nem contar, e o único terracota é o do vazio, UI-D3) |
| Primeira abertura (itens existem, nenhum foi contado) | "Antes de tudo, conte o que tem na prateleira." | "O Estoque começa pela contagem: diga quanto tem de cada material e quanto custou. Vendas e compras lançadas antes de hoje não entram. Dá para parar no meio — cada item fica gravado quando você confirma." | "Começar a contagem" (primário) · "+ Novo material" (`outline`), com a linha "Falta algum material?" antes dele |
| Saldos — filtro/busca sem resultado | "Nada com esse filtro" (herdado) | "Tente outro nome, ou limpe os filtros." | "Limpar filtros" (`outline` — a barra fixa já tem o terracota) |
| Saldos — "Acabando" sem nenhum | "Nada acabando." | "Nenhum material está abaixo do mínimo nem com saldo negativo." | "Ver todos" (`outline`) |
| Saldos — "Desativados" sem nenhum | "Nenhum material desativado." | "Material desativado some da Venda e da Compra, mas continua aqui, com o histórico." | — |
| Histórico — nada | "Nada registrado ainda" (herdado) | "Toda entrada, saída e ajuste aparece aqui, com quem fez e quando — inclusive o que vem das vendas e compras do Financeiro." | — |
| Histórico — tipo sem linha | "Nada deste tipo ainda." | "Toque em Tudo para ver todas as movimentações." | "Ver tudo" (`outline`) |
| Para onde foi — período sem saída | "Nenhuma saída no período" (herdado) | "Quando você der baixa em algum material, ou quando uma venda tirar insumos do estoque, ele aparece aqui separado por destino." | "Ver tudo" (`outline`, só quando o período não é "Tudo") |
| Seletor — busca sem resultado | "Nenhum material com esse nome" (herdado) | "Confira a escrita, ou toque em Tudo." (herdado) | — |
| Folha do material — sem movimentação | "Nenhuma movimentação" (herdado) | "Este material foi cadastrado, mas ainda não entrou nem saiu nada." (herdado) | o rodapé já tem "Registrar movimentação" |
| Contagem — nenhum item | "Nada para contar." | "Cadastre o primeiro material e volte aqui." | "+ Novo material" (`outline`) |
| Contagem — área/busca sem item | "Nada com esse filtro" | "Tente outro nome, ou toque em Tudo." | — |
| Início — bloco sem alerta | — | "Nenhum material abaixo do mínimo." (**já existe**, `TEXTOS_DOS_BLOCOS.estoque.vazio`) | — |
| Início — estoque nunca contado | — | **novo:** "O estoque ainda não foi contado." + link "começar a contagem" | link, não botão |

### Erros

| Situação | Copy |
|---|---|
| Carregar a aba Saldos | "Não deu para carregar os saldos. Verifique a internet e tente de novo." + "Tentar de novo" |
| Carregar a aba Histórico | "Não deu para carregar o histórico. Verifique a internet e tente de novo." + "Tentar de novo" |
| Carregar a aba Para onde foi | "Não deu para carregar para onde foi o material. Verifique a internet e tente de novo." + "Tentar de novo" |
| Carregar a folha do material | "Não deu para carregar o histórico deste material. Verifique a internet e tente de novo." + "Tentar de novo" (dentro da folha) |
| Carregar a contagem | "Não deu para carregar a contagem. Verifique a internet e tente de novo." + "Tentar de novo" |
| Início — bloco | "Não deu para carregar o estoque." (**já existe**) + "Tentar de novo" |
| Gravar movimentação | "Não deu para registrar. Verifique a internet e tente de novo." (folha continua aberta e preenchida) |
| Gravar contagem de um item | "Não deu para gravar esta contagem. Verifique a internet e toque em Confirmar contagem de novo." (na própria linha; o número digitado fica) |
| Quantidade vazia/inválida | "Digite a quantidade em {unidade} — por exemplo, 2 ou 0,5." |
| Quantidade zero em entrada/saída | "A quantidade precisa ser maior que zero." (herdado) |
| Saldo contado vazio | "Diga quanto tem na prateleira — pode ser zero." (o protótipo dizia "Diga quanto tem na prateleira."; zero passou a valer, D-32) |
| Destino não escolhido | "Escolha para onde o material foi." (herdado) |
| Custo vazio na entrada | "Diga quanto custou ao todo — é daí que sai o custo médio." |
| Custo vazio na primeira contagem (Δ > 0) | "Diga quanto custou — uma estimativa serve." |
| Mínimo inválido | "O mínimo precisa ser zero ou mais." |
| Observações longas | "As observações cabem em até 500 letras." |
| Material desativado por outra pessoa enquanto a folha estava aberta | "{nome} foi desativado enquanto você registrava. Reative-o para movimentar." |
| Desativar insumo de ficha ativa | a frase que já existe, `fraseItemEhInsumoDe(produto)`: "Esse item é insumo de {produto} — tire da ficha técnica antes." + link "Abrir Cadastros → Catálogo" |
| Novo material — nome/unidade/categoria | as mensagens que o Cadastros já devolve para o mesmo esquema (EST-13 — mesma validação, mesmas frases) |

Erro de campo aparece **embaixo do campo**, em `--color-erro`, `role="alert"` — nunca como toast
(o protótipo usava o toast `avisar()` para tudo; UI-D9).

### Confirmação — a única desta fase

**Desativar material** (`AlertDialog`):
- Título: "Desativar {nome}?"
- Corpo: "Ele some da Venda, da Compra e da lista do Estoque. O histórico ({N} movimentações) e o
  saldo de {X} {un} continuam guardados — nada é apagado — e dá para reativar quando quiser."
  (sem movimentação: "Ele some da Venda, da Compra e da lista do Estoque. Nada é apagado, e dá para
  reativar quando quiser.")
- Botões: "Voltar" (`outline`) · **"Desativar material"** (primário); enquanto desativa:
  **"Desativando…"** (`disabled`, `aria-busy="true"`, e "Voltar" também desabilitado).

Nenhuma movimentação tem confirmação de exclusão porque **nenhuma pode ser apagada nem editada**
(EST-06) — não existe botão, menu ou gesto de apagar/editar em nenhuma linha do histórico. Saída
que deixa o saldo negativo **não** pede confirmação: avisa na pré-visualização e grava (D-06).
Também **não existe "Desfazer"** no toast desta fase: desfazer seria apagar a movimentação —
correção é um ajuste, como o próprio histórico explica.

### Notas de rodapé (as do protótipo, ajustadas)

| Aba | Copy |
|---|---|
| Saldos | "**O saldo não é digitado.** Ele é sempre a soma do histórico — entradas menos saídas, mais ajustes. Não existe campo para corrigir um saldo à mão: se a prateleira discorda do sistema, registre um *ajuste*, que fica no histórico com seu nome e a data." (herdado) |
| Histórico (1) | "**Nada aqui pode ser apagado nem editado.** O histórico é a única fonte do saldo — se ele pudesse ser reescrito, o saldo deixaria de ser confiável. Errou a quantidade? Registre um *ajuste*: os dois ficam visíveis, e dá para ver o que aconteceu." (herdado) |
| Histórico (2) | "**As linhas marcadas “do Financeiro” não foram digitadas aqui.** Vendas e compras são lançadas no Financeiro, que tira e põe no estoque sozinho. A regra vale igual para elas: ninguém edita nem apaga. Venda ou compra cancelada não some — o Financeiro registra um *estorno*, e as duas linhas ficam." (reescrito: agora vale para compra também, D-04) |
| Para onde foi (topo) | "Este número diz **qual área pagou cada grama de material**. Sem o destino na saída, tudo viraria um custo só, e a margem de cada área ficaria errada." (era "qual frente pagou", D-12) |
| Para onde foi (rodapé) | "**Como o valor é calculado.** Cada saída vale a quantidade vezes o custo médio do material **no instante da saída** — o custo médio vem das entradas, que é onde o preço de compra é registrado. Por isso a entrada pergunta quanto custou." (D-07) |
| Folha do material | "Somando de cima para baixo você chega ao saldo de **{X} {un}**. É assim que o sistema calcula — não há outra fonte." (herdado) |
| Novo material | "Não existe campo de saldo aqui. O saldo inicial entra pela **contagem**, com custo — assim ele nasce dentro do histórico." (herdado, "entrada" → "contagem", D-17) |

### Vocabulário

"Frente" **nunca** aparece na interface — é sempre **área**, com os cinco nomes do Financeiro
(Cafeteria · Espaço · Peças · Loja · Geral). "Material" é a palavra da tela (o protótipo e o dono
falam assim); no código é item do catálogo. Nunca aparecem: "movimento de estoque", "SKU", "custo
médio ponderado", "valoração", "inventário" como substantivo solto na tela (a tela diz "contagem").
Documento do Financeiro é sempre "venda nº {N}" / "compra nº {N}" (formato da 04.4).

---

## Onde o protótipo não vale mais

Cada linha é uma mudança de interface **obrigada** pelo ADENDO/CONTEXT, não preferência:

| No protótipo | Na plataforma | Por quê |
|---|---|---|
| Filtro "Tudo · Ateliê · Loja · Cafeteria" | "Tudo · Cafeteria · Espaço · Peças · Loja · Geral" (só as áreas com pelo menos um material aparecem) + "Acabando" | D-12, EST-12 |
| Meta do cartão "Ateliê · Cerâmica · mínimo 40 kg" | "● {Área} · {categoria da compra} · mínimo {m} {un}" / "· sem mínimo" | D-12 — a categoria é a do Financeiro |
| Pílula tracejada "Categorias" e a folha de gerenciar categorias | **Removidas.** Categoria se edita em Cadastros → Categorias | ADENDO §2 |
| Sanfona do seletor: frente → categoria do Estoque → material | **área → categoria da compra → material** | D-12 |
| Sub-linha da frente na sanfona ("material de produção") | Removida — a área não tem descrição | Nenhuma fonte aprovada para o texto |
| Destino "Venda na loja" e o aviso provisório | Removidos | D-15 |
| Destinos pagos por "Ateliê produtivo" | pagos por **Peças** | D-14 |
| Vínculo "Qual encomenda?" em texto livre | Seletor das encomendas em andamento, opcional | D-15 |
| "Para onde foi" com 6 destinos manuais | 5 destinos manuais + a barra **"Vendido · pelo Financeiro"** | D-15, D-31 |
| Custo médio = média simples de todas as entradas | Custo médio do instante, gravado em cada saída | D-07, D-25 |
| "Quem está aqui" (seletor Theo/Andressa) | Removido — o autor é quem entrou (`exigirUsuario()`) | Auth.js |
| Nota "Pode usar de verdade", "Backup dos dados", "Voltar ao exemplo" | Removidos — andaime do protótipo | — |
| "Editar material": frente, categoria, unidade, fornecedor, preço de venda | Só **mínimo** e **observações**; nome/unidade/categoria aparecem só para leitura com link para Cadastros → Catálogo; fornecedor não existe no catálogo | D-01, EST-02 |
| "Apagar" material e "Apagar mesmo assim" | **"Desativar material"**, com confirmação | D-20 (o banco proíbe apagar item do catálogo) |
| Cadastro de material com "Frente" segmentada | "Categoria da compra" (a área vem dela) | D-12, EST-13 |
| Nota do cadastro "O saldo inicial entra como uma entrada" | "…entra pela contagem" | D-17 |
| Abas terracota quando marcadas (`.aba[aria-selected]`) | Barra de abas **neutra**, no padrão de `abas-financeiro.tsx` | O acento é do CTA; mesma decisão da 04.3/04.4 (UI-D1) |
| Erros por toast (`avisar()`) | Erro embaixo do campo | UI-D9 |
| Folha até 94vh no celular | Folha de tela toda no celular | Padrão do projeto (UI-D10) |

---

## Layout & Navigation Contract

### Rotas

| Rota | Conteúdo |
|---|---|
| `/gestao/estoque` (`?aba=saldos` padrão · `?aba=historico` · `?aba=destino`) | Cabeçalho, banner, abas, conteúdo da aba, barra de ação fixa (celular). Aba inválida ou ausente → Saldos |
| `/gestao/estoque?aba=saldos&acabando=1` | Saldos já com a pílula "Acabando" marcada — destino do "e mais N" do Início e do "Ver só esses" do banner |
| `/gestao/estoque/contagem` | Contagem do estoque (tela nova, UI-D2) |

O Estoque **não está na barra de baixo** (Início · Financeiro · Produção · Agenda, Fase 04.6). Chega-se
a ele pela pílula "Estoque" e pelo índice do Início, e pela lateral do desktop. Nada muda na
navegação da casca.

### Página `/gestao/estoque`

De cima para baixo:

1. **`CabecalhoPagina` "Estoque"**. Filhos: celular — "Contar estoque" (`outline`); desktop (≥ 768px)
   — "Contar estoque" (`outline`) · "+ Novo material" (`outline`) · "Registrar movimentação"
   (primário), nessa ordem da esquerda para a direita. `flex-wrap` já resolve o transbordo.
2. **Banner de alerta** (só quando há algo; `null` quando não há — mesma disciplina de
   `banner-atencao.tsx`). `mx-6 md:mx-8`, padding 16px, `rounded-lg`, fundo
   `--color-atencao-fundo`, borda e texto `--color-atencao`, ícone `AlertTriangle` 20px
   `aria-hidden`. Conteúdo:
   - Linha forte (Corpo 600): "{N} material está acabando" / "{N} materiais estão acabando".
   - Linha de nomes (Apoio): até 3, "{nome} ({saldo} {un}) · {nome} ({saldo} {un}) · e mais {N}",
     `[overflow-wrap:anywhere]`.
   - Se houver saldo negativo: linha própria (Apoio 600, `--color-erro`): "Com saldo negativo:
     {nome} ({−X} {un})" — até 3 nomes, "e mais N". Se **só** houver negativos, a linha forte vira
     "{N} material com saldo negativo" / "{N} materiais com saldo negativo" em `--color-erro`.
   - Botão "Ver só esses" (`outline`, borda `--color-atencao`, 44px) → Saldos com "Acabando".
   - Some no estado de primeira abertura (UI-D3).
3. **Barra de abas** "Saldos · Histórico · Para onde foi" — `role="tablist"`, `aria-label="Ver"`,
   três `<Link>` `role="tab"` com `aria-selected`, no padrão visual exato de
   `abas-financeiro.tsx` (`bg-muted p-1`, pílula ativa `bg-background font-semibold shadow-sm`),
   `mx-6 md:mx-8 md:max-w-md`. A 320px cada pílula tem ~88px; "Para onde foi" quebra em duas linhas
   — permitido, nunca reticências, nunca rolagem horizontal (regra da 04.4).
4. **Conteúdo da aba** (`px-6 md:px-8`, 32px abaixo das abas), cada aba em seu próprio `Suspense`
   com esqueleto no formato dela.
5. **Barra de ação fixa — só no celular (< 768px).** `position: fixed`, `inset-x-0`, com `bottom`
   igual a `calc(var(--altura-barra-inferior) + env(safe-area-inset-bottom))` — **acima** da barra
   de navegação, nunca por cima dela. Fundo `--color-fundo` a 94% com `backdrop-blur`, borda
   superior `--color-borda`, padding 8px 24px, altura `--altura-acao-fixa` (68px). Dentro:
   "Registrar movimentação" (primário, `flex-1`, 52px, Corpo 600) · "+ Material" (`outline`, 52px).
   Atributo `data-acao-fixa` (ver UI-D6). A página reserva `padding-bottom` de
   `var(--altura-acao-fixa) + 16px` além do que o layout já reserva para a barra inferior — o
   último cartão e as notas nunca ficam escondidos atrás dela. **A partir de 768px a barra não
   existe**; as ações estão no cabeçalho.

### Responsivo

| Faixa | Saldos | Histórico | Para onde foi | Folhas |
|---|---|---|---|---|
| < 768px | Cartões, 1 coluna; barra de ação fixa | Lista, 1 coluna | Resumo + barras, 1 coluna | Tela toda, desliza de baixo |
| 768–979px | Cartões, 1 coluna; ações no cabeçalho | idem | idem | Modal centralizado `max-w-lg` |
| ≥ 980px | **Tabela** (`.so-desktop`) | Lista dentro de painel, `max-w-3xl` | Resumo e barras, `max-w-3xl` | idem |

Ponto de quebra da tabela em **980px**, não nos 860px do protótipo — o mesmo desvio deliberado da
04.4 (reaproveita o limite já fixado no app em vez de um terceiro valor). Entre 768 e 979px a
lateral de 240px deixa ~500px de conteúdo: sete colunas não cabem, cartões cabem.

**Nenhuma tela exige rolagem horizontal da página.** A única rolagem horizontal interna permitida é a
da tabela de saldos (`overflow-x: auto` dentro do painel), herdada de `.rolagem`.

---

## Estados e Comportamento

### Aba Saldos

**Barra de ferramentas** (de cima para baixo no celular; numa linha com `flex-wrap` no desktop):
busca (44px, ícone `Search` à esquerda, `aria-hidden`) · pílulas de área "Tudo" + as áreas com
pelo menos um material, com o ponto de 8px da cor da área antes do nome · pílula "Acabando" ·
contador à direita/embaixo: "{n} de {total} · {R$} em estoque" (Apoio, `tabular-nums`).

- Pílulas de área e "Acabando" usam `aria-pressed`; área é escolha única (Tudo desmarca as outras);
  "Acabando" é independente e combina com a área e a busca.
- "Acabando" mostra os abaixo do mínimo **e** os de saldo negativo — cada um com o **seu** chip
  (UI-D7). Material com mínimo zero e saldo positivo nunca aparece nela (EST-04).
- "{R$} em estoque" soma o valor dos materiais com saldo **positivo** (negativo não abate), no
  filtro de situação atual.
- Filtragem e busca rodam no cliente sobre a lista já carregada (dezenas de itens, não milhares);
  só `acabando=1` vem da URL. A busca casa nome do material e nome da categoria, sem acento e sem
  caixa.

**Ordem:** saldo negativo primeiro, depois acabando, depois o resto — cada grupo por nome
(`localeCompare` pt-BR). Herdado do protótipo (que subia os "baixo"), com o negativo acima.

**Cartão (< 980px)** — `.cartao` do protótipo: fundo `--color-superficie`, borda `--color-borda`,
`rounded-lg`, padding 16px, **borda esquerda de 4px** (`--color-borda` normal ·
`--color-atencao` acabando · `--color-erro` negativo). Grade de duas colunas:
- Esquerda, linha 1: nome (Corpo 600, quebra de linha livre — nunca truncado).
- Esquerda, linha 2 (Apoio, `--color-tinta-fraca`): "● {Área} · {categoria da compra} · mínimo
  {m} {un}" ou "· sem mínimo"; para peça pronta, "· peça pronta" no fim.
- Direita, ocupando as duas linhas: saldo em Display 28px (`--color-tinta`, `--color-atencao` ou
  `--color-erro`) e a unidade embaixo (Apoio). Negativo com o sinal de menos tipográfico "−".
- Rodapé (linha inteira, `flex-wrap`, gap 8px): chip "Saldo negativo" **ou** "Acabando" (nunca os
  dois — negativo vence) · "Dar baixa" (`outline`, 44px) · "Histórico" (`outline`, 44px) · à
  direita, custo médio "{R$}/{un}" (Apoio, `--color-tinta-fraca`); sem custo conhecido, "—".
- **Desativado:** borda esquerda `--color-borda`, chip "Desativado" (neutro), **sem** "Dar baixa"
  (material desativado não se movimenta — UI-D11); fica só "Histórico". Sem opacidade reduzida (o
  texto precisa manter o contraste).
- O cartão inteiro **não** é clicável — só os dois botões (evita toque acidental ao rolar com a mão
  suja).

**Tabela (≥ 980px)** — `.painel` + `table` do protótipo. Colunas: Material (nome 600 + chip) ·
Área ("● {Área}" e, embaixo em Apoio, a categoria) · Saldo (à direita, 600, cor do alerta) · Mínimo
(à direita, 400, "—" quando zero) · Custo médio (à direita) · Valor (à direita, 600) · ações ("Dar
baixa" · "Histórico", 44px). Cabeçalho em Apoio 600 caixa alta. Linha em alerta: sem fundo
colorido, a cor fica no número e no chip.

**Filtro de situação "Ativos · Desativados · Todos"** — cópia estrutural de `filtro-fornos.tsx`
(`role="radiogroup"`, `aria-label="Filtrar materiais por situação"`, `role="radio"` +
`aria-checked`, 44px, estado marcado por fundo + borda, nunca só cor), com o peso 400/600 desta
fase. **Fica no fim da lista**, antes da nota de rodapé, nas duas larguras (UI-D4). Padrão:
"Ativos".

**Painel da primeira abertura (UI-D3)** — quando existe pelo menos um material com estoque e
**nenhuma** movimentação `manual` foi gravada ainda, a aba Saldos mostra só este painel no lugar
da barra de ferramentas e da lista: título, corpo, "Começar a contagem" (primário, leva a
`/gestao/estoque/contagem`), e embaixo "Falta algum material?" + "+ Novo material" (`outline`).
Nesse estado: banner oculto, barra de ação fixa oculta, "Registrar movimentação", "+ Novo
material" e "Contar estoque" fora do cabeçalho (o único terracota é "Começar a contagem"; o
"+ Novo material" fica só dentro do painel). Histórico e Para onde foi
continuam acessíveis — podem já ter linhas vindas do Financeiro.

### Seletor "Qual material?" (folha)

Aberto por "Registrar movimentação". Título "Qual material?", sub "Filtre pela área ou busque pelo
nome" (era "pela frente"). Busca (44px) · pílulas de área com contagem ("Peças 12", o número em
`--color-tinta-fraca`) · lista rolável:

- **Sem busca:** sanfona. Com "Tudo": nível 1 = área (Título 20px, contador, selo "⚠ {n}" de
  acabando/negativo com texto oculto " acabando" para leitor de tela) → nível 2 = categoria da
  compra (Corpo) → materiais. Com uma área marcada, a sanfona começa no nível 2. **Tudo começa
  fechado** (herdado). Botões de sanfona: 52px (nível 1) e 48px (nível 2), `aria-expanded`,
  `aria-controls`, chevron `ChevronRight` que gira 90° (sem transição com `prefers-reduced-motion`).
- **Com busca:** a sanfona sai do caminho — lista plana "{N} materiais encontrados", em ordem
  alfabética (herdado).
- Linha de material: 56px, nome (Corpo) + chip de alerta + saldo "{X} {un}" à direita.
- Só materiais **ativos** aparecem.
- A área escolhida é **lembrada** enquanto a página estiver aberta (herdado de `escolhaFrente`).
- Foco inicial: a busca **só a partir de 768px**; no celular nada recebe foco ao abrir, para o
  teclado não cobrir a sanfona (UI-D13).

### Folha de movimentação

Aberta por "Dar baixa" (tipo **Saída**), por "Registrar movimentação" da folha do material
(**Saída**), pelo seletor (tipo que estava marcado — Saída na primeira vez) ou logo depois de
cadastrar um material (**Entrada**).

Estrutura, de cima para baixo:
1. Cabeçalho: "Registrar movimentação" (Título) + sub com o nome; fechar 44×44 (UI-D10).
2. Caixa "escolhido" (`superficie-2`): nome (600) + "saldo de agora: {X} {un}" (Apoio) + "Trocar
   material" (`outline`, 44px → volta ao seletor mantendo o tipo).
3. Área rolável: "O que aconteceu" + segmentado **Entrada · Saída · Ajuste** (3 colunas, 52px,
   `role="radiogroup"`, setas do teclado movem a escolha) · campo grande (60px, Display 28px,
   centralizado, `inputmode="decimal"`, `enterKeyHint="done"`) com rótulo e dica da tabela acima ·
   atalhos de quantidade (entrada e saída; não no ajuste) · por tipo:
   - **Saída:** "Para onde foi?" — grade de 2 colunas com os 5 destinos (52px, nome em Corpo + área
     em Apoio embaixo, `role="radiogroup"` com `aria-required="true"`; tocar de novo no marcado
     desmarca, herdado) · o campo de vínculo do destino marcado, se houver · a dica da cafeteria,
     se marcada.
   - **Entrada:** para material que **não** é peça pronta, uma nota neutra antes do campo de
     quantidade: "Comprou? Lance em Financeiro → Despesa → Compra de material — ela já dá entrada
     aqui sozinha." com o link "Ir para Compra de material" (UI-D14) · "Quanto custou ao todo" (R$,
     16px, `inputmode="decimal"`, obrigatório). **Peça pronta com ficha de precificação:** o custo
     vem preenchido com custo da ficha × quantidade e se recalcula a cada mudança de quantidade
     **até** a pessoa editar o custo à mão (daí em diante fica o que ela digitou); dica "Pela ficha
     de precificação: {R$ X} por peça. Pode mudar." **Sem ficha:** vazio e obrigatório (D-22).
   - **Ajuste:** o campo grande pergunta o **contado** (aceita 0) · "Por quê?" opcional.
4. **Rodapé preso** (fora da área rolável, sempre visível): a pré-visualização (caixa `.previa`,
   `aria-live="polite"`) e, embaixo, o botão primário (largura total, 52px) com o rótulo do
   segmento marcado: "Registrar baixa" · "Registrar entrada" · "Registrar ajuste".

Trocar de tipo **preserva** o que foi digitado em cada tipo (herdado de `lerCampos()`).
A pré-visualização usa o saldo carregado com a página; o servidor recalcula tudo sob trava no
instante da gravação, e o toast diz o resultado **gravado** (se outra pessoa mexeu no meio, o toast
é a verdade, não a prévia). Ajuste cuja diferença, no servidor, deu zero fecha a folha com
"Conferido. O saldo já estava correto."

Foco inicial: o campo de quantidade **só a partir de 768px**; no celular, nenhum (UI-D13).

**Orçamento de toques — EST-09.** Contado **a partir da aba Saldos** (Pitfall 12; do Início é +1,
a pílula "Estoque"):

| Toque | Onde | O que acontece |
|---|---|---|
| 1 | "Dar baixa" no cartão | Folha abre em **Saída**, material já escolhido, sem teclado |
| 2 | Atalho "+1" (ou "+5", "+50"…) | Quantidade preenchida; a prévia mostra "o saldo passa de X para Y" |
| 3 | Um dos 5 destinos | Destino marcado; a área aparece no botão |
| 4 | "Registrar baixa" (no rodapé, sempre visível) | Grava, fecha, toast "Baixa de…" |

A rolagem entre o toque 2 e o 3, se a tela for baixa, é um gesto, não um toque. Quantidade que não
é soma de atalhos pede digitação (um toque no campo + teclado numérico). A verificação de < 15 s é
humana, no celular, no fim da fase.

### Folha do material ("Histórico" do cartão)

- Cabeçalho: nome (Título) + sub "● {Área} · {categoria da compra}".
- Caixa de resumo — fundo **`--color-superficie-2`** (o `.escolhido` do protótipo), borda
  `--color-borda`: saldo em Display 28px/700 (`--color-tinta`, `--color-atencao` ou `--color-erro`
  — pares P17a/P17b, só válidos nesse tamanho) + "{R$}/{un} · {R$} em estoque · mínimo {m}
  {un}" ou "· sem mínimo" (Apoio, `--color-tinta-media`) + chip de situação.
- Observações, se houver: caixa neutra (`.previa.neutra`).
- **"Gasto por"** (EST-20, D-08), só quando o material é insumo de alguma ficha técnica: rótulo
  "Gasto por" (Apoio 600) e a lista "Café 200 ml (15 g) · Café refil (30 g)…" (Apoio,
  `[overflow-wrap:anywhere]`, todos os produtos, sem truncar) + link "Editar fichas em Cadastros →
  Catálogo". Só leitura. Material que não é insumo de nada: a seção não aparece (não é um vazio
  com frase).
- Lista das movimentações do material (anatomia abaixo, sem o nome do material na linha 1 — igual
  a `linhaMov(m, false)`), as 50 mais recentes + "Mostrar mais 50".
- Nota "Somando de cima para baixo…".
- Rodapé: "Editar" (`outline`) · "Registrar movimentação" (primário) — ou "Reativar material"
  (`outline`; "Reativando…" enquanto grava) se desativado.
- Carrega ao abrir: 3 linhas de esqueleto enquanto chega; erro dentro da folha com "Tentar de novo".

**Folha "Editar material"** — só leitura em cima (nome, unidade, categoria da compra com a área) e
o link "Nome, unidade e categoria mudam em Cadastros → Catálogo"; campos "Estoque mínimo" (em
{un}, decimal ≥ 0) e "Observações" (`textarea`, até 500); rodapé "Desativar material" (`outline`,
à esquerda) · "Salvar material" (primário; "Salvando…" enquanto grava). Desativar abre a confirmação acima; recusado se o material for
insumo de ficha de item ativo (frase acima, na própria folha).

**Folha "Novo material"** — "Nome" · "Unidade" (seletor: un, g, kg, ml, L, m) · "Categoria da
compra" (seletor das categorias de compra **ativas**, cada opção "{categoria} · {área}"; a dica
repete a área escolhida) · "Estoque mínimo" (padrão 0) · "Observações" · a nota "Não existe campo
de saldo aqui…" · e a linha "Preço de venda, atalhos e ficha técnica ficam em Cadastros →
Catálogo." Rodapé: "Voltar ao estoque" (`outline`, fecha sem gravar) · "Cadastrar material"
(primário; "Cadastrando…" enquanto grava). Cria o item com
`controla_estoque = true` pela mesma validação do Cadastros (EST-13). Ao gravar: toast e a folha
de movimentação abre em **Entrada** para ele (UI-D12).

### Aba Histórico

Pílulas "Tudo · Entradas · Saídas · Ajustes" (herdadas) + "{N} movimentações" (Apoio). Lista num
painel (`superficie`, `rounded-lg`), as **50 mais recentes** + "Mostrar mais 50" (UI-D15), mais
novas primeiro, pela ordem de gravação (`numero`, nunca `criado_em`).

**Anatomia da linha** (`.linha-mov`, padding 16px, divisória `--color-borda`):
- Coluna de quantidade (76px, à direita): "+{q}" em `--color-sucesso` (entrada) · "−{q}" em
  `--color-tinta` (saída) · "±{d}" em `--color-acento` (ajuste); unidade embaixo (Apoio).
- Linha 1: nome do material (Corpo 600) + chips.
- Linha 2 (Apoio, `--color-tinta-media`): título do tipo + detalhe.
- Linha 3 (Apoio, `--color-tinta-fraca`): "Hoje, 14:32 · {nome de quem registrou}" / "Ontem, …" /
  "28/09, …" (herdado de `quando()`, fuso `America/Sao_Paulo`).

| Movimentação | Linha 2 | Chips |
|---|---|---|
| Saída manual | "{Destino} · paga por {Área} · {vínculo} · {R$}" | "Perda" quando perda ou quebra |
| Baixa por venda | "Vendido · venda nº {N} · paga por {Área da linha} · {R$}" | "Venda" · "do Financeiro" |
| Entrada por compra | "Compra nº {N} · {R$ da nota} · {R$}/{un}" | "do Financeiro" |
| Entrada manual | "Entrada · {R$ informado} · {R$}/{un}" | — |
| Entrada de peça pronta | "Entrada · peça pronta · {R$} · {R$}/{un}" | — |
| Primeira contagem | "Saldo inicial · contado {X} {un} · {R$ informado}" | "Saldo inicial" |
| Ajuste | "Ajuste de conferência · contado {X} {un} na prateleira · {motivo}" (herdado) | — |
| Estorno | "Estorno · {venda/compra} nº {N} cancelada · {R$}" | "Estorno" · "do Financeiro" |
| Original que foi estornada | a linha dela, sem mudança de texto | + "Estornada" (neutro) |

O valor mostrado na entrada é o **da nota** (`valor_informado`) quando ele difere do valor gravado
(D-25). Nenhuma linha tem botão, menu, deslizar-para-apagar ou toque longo (EST-06).

### Aba Para onde foi

Pílulas "Últimos 30 dias · 90 dias · Tudo" (herdadas; padrão 30) + "{N} saídas no período".

- **Resumo** (`.resumo-topo`): "MATERIAL CONSUMIDO NO PERÍODO" (Apoio caixa alta) · total em
  Display · a nota do topo.
- **Barras** (`.barras`, HTML, sem Recharts): **seis, sempre**, em ordem decrescente de valor — os
  5 destinos manuais e "Vendido · pelo Financeiro". Cada uma: cabeçalho "{nome}" … "{R$}" (Corpo,
  valor 600, `tabular-nums`) · trilho de 8px `--color-superficie-2` com preenchimento
  `--color-acento` (ou `--color-erro` em "Perda ou quebra"), largura proporcional à maior barra,
  mínimo 2% quando o valor > 0 (herdado) · sub-linha (Apoio): "{Área} · {n} saída(s) · {p}% do
  período". Na barra de vendas a sub-linha é "{n} baixa(s) · {p}% do período" e, embaixo, uma
  linha por área que vendeu: "● {Área} {R$}" (D-31). Destino sem nada: barra vazia e "nenhuma
  saída".
- Saídas **estornadas** não entram na soma nem na contagem (Pitfall 15) — uma venda cancelada
  zera.
- Nota de rodapé "Como o valor é calculado".
- A barra tem `role="img"` e `aria-label="{nome}: {R$}, {p}% do período"`; o trilho é decorativo.

### Contagem do estoque — tela nova (D-16, D-17, D-18, D-32)

Rota própria, `CabecalhoPagina` "Contagem do estoque" com o voltar (`aria-label="Voltar ao
estoque"`). **A regra de modo é por material, não por visita (UI-D2):** material que ainda não
tem nenhuma movimentação `manual` está em **primeira contagem**; material que já tem, em
**conferência**. Na primeira abertura todos estão no primeiro grupo — é o "modo saldo inicial" do
D-17; depois, o "modo inventário" do D-18. Material novo cadastrado mais tarde entra sozinho no
primeiro grupo.

De cima para baixo:
1. Progresso (Apoio): "{c} de {t} contados hoje" — "contado hoje" é material com contagem ou
   ajuste gravado hoje (lido do banco: sobrevive a recarregar a página, sem rascunho).
2. Busca + pílulas de área (as mesmas da aba Saldos) — para dividir o trabalho por prateleira.
3. Grupo **"Ainda sem contagem"** (cabeçalho Apoio 600 caixa alta + contador), com a frase:
   "Conte o que tem na prateleira e diga quanto custou. É daqui que o Estoque começa — vendas e
   compras de antes não entram."
4. Grupo **"Conferência"**, com a frase: "Conte e confirme material por material. Só grava o que
   mudou; se já estava certo, nada é gravado."
5. Nota: "Dá para parar no meio: cada material fica gravado quando você confirma." + "Voltar ao
   estoque" (`outline`).

Dentro de cada grupo, materiais em ordem de área (Cafeteria · Espaço · Peças · Loja · Geral, com
cabeçalho de área Apoio 600 caixa alta e o ponto de cor) e, na área, por nome. Só ativos.

**Linha da contagem** (padding 16px, divisória):
- Nome (Corpo 600) + "em {un}" (Apoio). **O saldo do sistema não aparece antes de digitar** —
  contagem às cegas; ele só surge na prévia (UI-D16).
- Campo "Contado" (16px, 44px de altura, `inputmode="decimal"`, `enterKeyHint="next"`; aceita 0;
  vazio = não mexe).
- Só na primeira contagem e só quando o contado passa do saldo atual (Δ > 0): campo "Custou ao
  todo" (R$), obrigatório; peça pronta com ficha vem preenchida (D-22).
- Prévia (Apoio, `aria-live="polite"`), assim que há número: "o saldo passa de {X} para {Y} {un}"
  (D-17 refinado: "o saldo passa de −2 para 10"); diferença zero: "já está certo — nada será
  gravado".
- "Confirmar contagem" (`outline`, 44px; "Gravando…" com `disabled` e `aria-busy="true"` enquanto
  grava). **Enter no campo confirma** e leva o foco ao campo "Contado" da
  próxima linha (teclado do celular: "Próximo").
- Depois de gravar, a linha fica compacta: "✓ Contado: {Y} {un} · hoje {HH:MM}" em
  `--color-sucesso` (ou "✓ Conferido — já estava certo") + link "Contar de novo". O leitor de tela
  ouve "{nome}: o saldo passou de {X} para {Y} {un}." pela região `aria-live`.
- Semântica (D-17/D-18, refinada pela pesquisa): primeira contagem com Δ > 0 grava entrada com
  custo pela diferença; Δ < 0 grava ajuste (não pede custo); Δ = 0 não grava. Conferência grava
  ajuste com a diferença calculada **no servidor, sob trava, no instante da gravação**.
- Erro de gravação na própria linha, número mantido.

No desktop (≥ 980px) a linha vira uma fileira: nome · área · contado · custou ao todo (só quando
se aplica) · prévia · "Confirmar contagem".

### Bloco "Estoque acabando" do Início (D-10, D-21)

Troca o estado vazio estático de `bloco-estoque.tsx` pela consulta real, no molde de
`bloco-producao.tsx` (`async`, `try`/`catch` próprio, `EstadoErro` + `TentarDeNovo`, esqueleto já
montado no `Suspense` da página):
- Linhas (até **5**): saldo negativo primeiro, depois acabando, cada grupo por nome. Cada linha:
  nome (Corpo 600, `line-clamp-1`) e embaixo (Apoio): chip **"Saldo negativo"** (erro) + "{−X}
  {un}", ou chip **"Acabando"** (atenção) + "{X} {un} · mínimo {m} {un}". Rótulos diferentes para
  os dois avisos — o EST-04 continua literalmente verdadeiro.
- Mais de 5: última linha "e mais {N}" como link para `?aba=saldos&acabando=1`.
- Vazio: a frase que já existe. Estoque nunca contado (nenhuma movimentação manual e pelo menos um
  material): "O estoque ainda não foi contado." + link "começar a contagem" — em vez de listar
  negativos que só existem porque ninguém contou ainda.
- Link do cabeçalho "abrir estoque" — já existe, não muda.

### Painel de Venda e de Compra do Financeiro (D-21, Pitfall 16)

- Cada linha do efeito passa a dizer como o material fica: "−2 kg · {nome} · fica com 1 kg" /
  "+25 kg · {nome} · fica com 24 kg". Quando fica negativo, o trecho "fica com −1 kg" vai em
  `--color-erro`, 600.
- **Fora do `<details>` fechado** da Venda, logo acima dos botões, quando a venda deixa algum
  material negativo: caixa `--color-atencao-fundo`/`--color-atencao`, Apoio, `role="status"`:
  "Esta venda deixa {nome} com saldo negativo ({−X} {un}). Pode lançar — depois confira a
  prateleira." / "Esta venda deixa {N} materiais com saldo negativo. Pode lançar — depois confira a
  prateleira." **"Lançar venda" nunca fica desabilitado por isso** (D-06).
- As dicas mudam (a frase atual ficou falsa):
  - `DICA_EFEITO_ESTOQUE`: "Aparece aqui para validar a regra. Passa a valer quando o módulo
    Estoque estiver ligado." → **"Ao lançar a venda, isto sai do estoque."**
  - `DICA_EFEITO_ESTOQUE_COMPRA`: → **'O custo de cada unidade sai de "custou ao todo" ÷
    quantidade. Ao lançar, isto entra no estoque.'**
- Se os saldos não carregarem, as linhas voltam ao formato de hoje (sem "fica com") e nada avisa
  nem bloqueia — a venda nunca depende do Estoque para ser lançada.
- Os e2e de `financeiro-venda.spec.ts` e `cadastros-catalogo.spec.ts` que leem `venda-efeito`
  precisam acompanhar o formato novo (o planejador lista isso na tarefa).

### Cadastros → Catálogo (D-20, pesquisa Pergunta 6)

A única mudança de interface fora do Estoque além do painel de Venda: item desativado aparece na
lista do catálogo com o chip "Desativado" (neutro), depois dos ativos; o diálogo de editar item
ganha no rodapé "Desativar item" / "Reativar item" (`outline`), com a **mesma** confirmação do
Estoque (trocando "material" por "item"). Seletores de Venda e de Compra não mostram item
desativado — nenhuma copy nova.

---

## Component Inventory

**Reaproveitados sem mudança** (`components/ui/`): `dialog`, `alert-dialog`, `button`, `input`,
`select`, `textarea`, `field`, `label`, `skeleton`, `sonner`, `card` (bloco do Início),
`separator`. **Nenhum componente shadcn novo.** Não usar `Table`/`Badge`/`Tabs`/`Accordion`/
`ToggleGroup` do shadcn (não instalados; o projeto faz esses padrões em HTML semântico + Tailwind).

**Reaproveitados do projeto:** `CabecalhoPagina` (com `voltar`), `EstadoVazio` (com `aoClicar`/
`hrefBotao`/`botao`), `EstadoErro`, `TentarDeNovo`, `BlocoDoInicio`, `BlocoEsqueleto`, o molde de
`filtro-fornos.tsx`, o molde de `abas-financeiro.tsx`, o molde de diálogo de tela toda de
`formulario-forno.tsx`, o ponto de área de `linha-carrinho.tsx`, `EfeitoEstoque` (estendido).

**Novos em `components/amassa/estoque/`** (nomes são sugestão; o planejador decide o recorte):
abas do Estoque · banner de alerta · barra de ferramentas + filtro de situação · cartão e tabela de
saldos · painel da primeira abertura · linha de movimentação · lista do histórico · barras do "Para
onde foi" · seletor "Qual material?" · folha de movimentação · folha do material (com "Gasto por")
· folha de novo/editar material · confirmação de desativar · barra de ação fixa · lista e linha da
contagem.

**Ícones (lucide-react):** `Search` (busca), `AlertTriangle` (banner), `ChevronRight` (sanfona),
`ClipboardCheck` ("Contar estoque"), `Check` ("✓ Contado"), `ChevronLeft` (voltar — já no
`CabecalhoPagina`), `X` (fechar). Todos `aria-hidden` quando acompanham texto.

---

## Decisões desta UI-SPEC (tomadas sem o dono — cada uma reversível)

| # | Decisão | Por quê | Alternativa descartada |
|---|---|---|---|
| UI-D1 | Barra de abas **neutra** (padrão `abas-financeiro.tsx`), não terracota como no protótipo | Um terracota por tela: a barra fixa já tem "Registrar movimentação"; mesma decisão da 04.3/04.4 | Aba marcada em terracota |
| UI-D2 | Contagem em **rota própria**, com o modo decidido **por material** (sem contagem manual → primeira contagem; com → conferência) | Cumpre D-17 e D-18 sem precisar gravar uma bandeira de "primeira vez"; material novo entra sozinho; página própria tem espaço para uma lista longa e sobrevive a recarregar | Folha/diálogo; bandeira global de "estoque iniciado" |
| UI-D3 | **Primeira abertura** substitui a aba Saldos por um painel que conduz à contagem, e esconde banner, barra fixa e as ações do cabeçalho | "A primeira abertura não é uma tela vazia: conduz a contagem inicial" (CONTEXT, Specific Ideas); antes da contagem, saldos e alertas são artefato de venda sem contagem | Painel acima da lista, com a lista e os alertas visíveis |
| UI-D4 | Filtro **Ativos · Desativados · Todos no fim da lista** | No celular, busca + áreas + "Acabando" já ocupam o topo; desativado é consulta rara; o topo fica para o material do dia | No topo, como nas Queimas |
| UI-D5 | "+ Material" na barra fixa do celular, "+ Novo material" no resto | A 360px os dois botões lado a lado não cabem com o rótulo longo sem quebrar "Registrar movimentação" | Um rótulo só em todo lugar |
| UI-D6 | Nova variável `--altura-acao-fixa: 68px` e, abaixo de 768px, `:root:has([data-acao-fixa])` soma essa altura a `--deslocamento-aviso` | O toast não pode cobrir o "Registrar movimentação"; o `Toaster` é montado uma vez no layout e só lê a variável — trocar a variável é a mesma técnica da 04.4 | Toast por cima da barra; segundo `Toaster` |
| UI-D7 | "Acabando" (filtro e banner) **inclui** saldo negativo, com chip e linha **próprios** | Negativo é mais urgente que acabando e precisa aparecer quando se pede "o que precisa de atenção"; os rótulos separados mantêm o EST-04 verdadeiro (D-21) | Pílula "Saldo negativo" separada — mais um controle no topo do celular |
| UI-D8 | Prévia com frase neutra quando o campo está vazio | Rodapé com altura estável: o botão "Registrar baixa" não pula de lugar entre o toque 1 e o 2 | Prévia vazia (protótipo) |
| UI-D9 | Erros de validação embaixo do campo, não em toast | Padrão de todo formulário do projeto; toast some em 5 s e não diz qual campo | Toast como `avisar()` do protótipo |
| UI-D10 | Folha de tela toda no celular com fechar próprio de 44×44 e `aria-label="Fechar"` (`showCloseButton={false}`) | O fechar padrão do `dialog.tsx` tem nome acessível em inglês ("Close") e é menor que 44px — **achado desta pesquisa, vale para o projeto todo**; esta fase não o herda. A correção geral fica registrada para a Fase 7 | Usar o fechar padrão |
| UI-D11 | Material desativado não se movimenta (sem "Dar baixa", fora do seletor e da contagem); reativa-se pela folha dele | Desativado "some da lista padrão"; movimentar algo que não existe mais em Venda nem Compra confunde o saldo | Permitir baixa em desativado |
| UI-D12 | Depois de "Cadastrar material", a folha de movimentação abre em **Entrada** para o material novo | O toast herdado já manda "Registre a entrada"; abrir a folha poupa três toques | Só o toast |
| UI-D13 | No celular, nenhuma folha dá foco automático a campo de texto | O teclado cobriria a sanfona e os destinos e quebraria a baixa em 4 toques; no desktop o foco automático do protótipo continua | Foco automático sempre, como no protótipo |
| UI-D14 | Entrada manual de material comum mostra "Comprou? Lance em Financeiro → Despesa → Compra de material" | Compra lançada aqui não vai ao Caixa, e lançada nos dois lugares entra em dobro no estoque (D-03) | Nenhum aviso |
| UI-D15 | Histórico em páginas de 50 com "Mostrar mais 50" | O protótipo lista tudo; em meses a lista vira milhares de linhas no celular | Navegação por mês (como o extrato da 04.4) — o histórico do Estoque não tem "mês" como unidade de leitura |
| UI-D16 | Contagem às cegas: o saldo do sistema só aparece na prévia, depois de digitar | "Conte, não calcule" (protótipo): ver o número antes induz a copiar | Mostrar "o sistema diz X" ao lado do campo |

---

## UI Considerations

Applicable state considerations resolved: **74 — 65 covered, 9 backstop, 0 unresolved**, contados
como pares superfície × categoria (uma linha "E1, E3, E4" vale por três; par com linha coberta e
linha de conferência conta como coberto). A primeira versão desta seção listava 48 considerações e
cobria 41 dos 74 pares que a sondagem levanta com os tipos de cada superfície declarados (rodada de
novo em 29/09); os 33 que faltavam estão nas linhas do fim da tabela, depois da "overflow · E12",
cada uma citando a regra desta UI-SPEC de onde sai. Três linhas vão além da sondagem (E2
zero-one-many, E3 long-text, E11 partial) e ficam. Conferido com
o `ui-consideration-probe` sobre 12 superfícies: E1 aba Saldos (`list-collection`,
`interactive-control`) · E2 banner (`static-content`, `interactive-control`) · E3 aba Histórico
(`list-collection`) · E4 aba Para onde foi (`list-collection`, `static-content`) · E5 seletor
(`list-collection`, `nav`) · E6 folha de movimentação (`form`) · E7 folha do material
(`list-collection`, `static-content`) · E8 novo/editar material (`form`) · E9 contagem (`form`,
`list-collection`) · E10 bloco do Início (`list-collection`) · E11 painel de Venda/Compra
(`static-content`) · E12 barra de abas e barra fixa (`nav`, `interactive-control`). A copy de
vazio e erro está no Copywriting Contract; aqui só a cobertura.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | E1 — nenhum material com estoque | ✅ covered | `EstadoVazio` "Nada no estoque ainda." com "+ Novo material" |
| empty | E1 — materiais existem, nenhum contado | ✅ covered | Painel da primeira abertura (UI-D3) com "Começar a contagem" |
| empty | E1 — filtro/busca/"Acabando"/"Desativados" sem resultado | ✅ covered | Quatro vazios distintos nomeados, cada um com a sua saída |
| loading | E1, E3, E4 — cada aba | ✅ covered | `Suspense` por aba; esqueleto: 4 cartões (celular) ou 6 linhas de tabela (desktop) / 6 linhas de histórico / resumo + 6 barras |
| error | E1, E3, E4 — cada aba | ✅ covered | `EstadoErro` com a frase própria da aba + "Tentar de novo" (`router.refresh()`); a barra de abas e a barra fixa continuam utilizáveis |
| populated | E1 — 10 a 60 materiais | ✅ covered | Cartões com alerta no topo; contador "n de total · R$ em estoque" |
| partial | E1 — material sem custo conhecido (nenhuma entrada com preço) | ✅ covered | Custo médio "—", valor R$ 0,00; a saída grava custo zero (D-26) |
| partial | E1 — material sem mínimo | ✅ covered | "· sem mínimo"; nunca chip "Acabando" (EST-04) |
| partial | E1 — material com saldo negativo e mínimo zero | ✅ covered | Chip "Saldo negativo", borda e número vermelhos; nunca "Acabando" (D-21) |
| overflow | E1 — tabela ≥ 980px | ✅ covered | `overflow-x: auto` dentro do painel, nunca da página |
| overflow | E1 — pílulas de área + "Acabando" a 320px | ✅ covered | `flex-wrap`, só áreas com material; nunca rolagem horizontal |
| zero-one-many | E1 — contador e banner | ✅ covered | "1 material está acabando" / "N materiais estão acabando"; "1 de 1" nunca vira "1 de 1 materiais" |
| long-text | E1 — nome de material até 120 caracteres | ✅ covered | Quebra de linha livre no cartão e na tabela, nunca truncado; o saldo fica ancorado à direita |
| long-text | E2 — nomes no banner | ✅ covered | Até 3 nomes + "e mais N", `[overflow-wrap:anywhere]` |
| zero-one-many | E2 — banner | ✅ covered | 0 → banner não existe; 1 → singular; só negativos → título próprio em vermelho |
| empty | E3 — histórico vazio / tipo sem linha | ✅ covered | Duas frases nomeadas |
| populated | E3 — centenas de movimentações | ✅ covered | 50 por vez + "Mostrar mais 50" (UI-D15) |
| partial | E3 — venda/compra de antes do Estoque | ✅ covered | Não geram linha (D-05); nada a mostrar, nenhum aviso |
| partial | E3 — venda cancelada | ✅ covered | Original com "Estornada" + linha de estorno com "Estorno"; as duas ficam |
| long-text | E3 — vínculo de texto livre (turma, perda) até 160 | 🧪 backstop | Linha 2 quebra por palavra (`[overflow-wrap:anywhere]`); conferir com texto de 160 caracteres a 320px |
| empty | E4 — período sem saída | ✅ covered | Frase nomeada + "Ver tudo" |
| zero-one-many | E4 — barras | ✅ covered | Seis barras sempre; valor zero = trilho vazio e "nenhuma saída"; "1 saída"/"N saídas" |
| partial | E4 — vendas de várias áreas | ✅ covered | Linha por área embaixo da barra "Vendido · pelo Financeiro" |
| overflow | E4 — valor alto ("R$ 123.456,78") no cabeçalho da barra a 320px | 🧪 backstop | `whitespace-nowrap` no valor, nome quebra; conferir a 320px |
| empty | E5 — busca sem resultado no seletor | ✅ covered | Frase herdada |
| overflow | E5 — área com muitos materiais | ✅ covered | Área rolável da folha; rodapé e busca fixos |
| long-text | E5 — nome longo na linha de 56px | ✅ covered | Quebra em 2 linhas, a linha cresce; saldo `whitespace-nowrap` |
| error | E6 — gravar falhou | ✅ covered | Frase + folha continua aberta e preenchida |
| error | E6 — validação | ✅ covered | Erro embaixo do campo, `role="alert"`, foco vai ao primeiro campo com erro |
| partial | E6 — saldo mudou entre abrir e gravar | ✅ covered | Servidor recalcula sob trava; toast diz o gravado; ajuste que deu zero no servidor responde "Conferido…" |
| partial | E6 — peça pronta com/sem ficha | ✅ covered | Com ficha: custo preenchido e editável; sem: vazio e obrigatório (D-22) |
| loading | E6 — gravando | ✅ covered | "Registrando…", `disabled`, `aria-busy`; toque duplo não grava duas vezes |
| empty | E6 — nenhuma encomenda em andamento no vínculo | ✅ covered | Seletor só com "Nenhuma"; o campo é opcional |
| loading | E7 — folha do material | ✅ covered | 3 linhas de esqueleto dentro da folha |
| error | E7 — folha do material | ✅ covered | `EstadoErro` dentro da folha + "Tentar de novo" |
| long-text | E7 — "Gasto por" com muitos produtos | 🧪 backstop | Lista completa quebrando por palavra; conferir com um insumo em 8+ fichas |
| error | E8 — novo material inválido | ✅ covered | As frases do Cadastros (EST-13), embaixo do campo |
| partial | E8 — desativar insumo de ficha ativa | ✅ covered | Recusado com `fraseItemEhInsumoDe` + link para o Catálogo |
| empty | E9 — nada para contar | ✅ covered | Frase + "+ Novo material" |
| partial | E9 — contagem interrompida | ✅ covered | Sem rascunho: o que foi confirmado está gravado; "contados hoje" vem do banco |
| error | E9 — gravar uma linha falhou | ✅ covered | Erro na linha, número mantido, as outras linhas seguem |
| loading | E9 — tela | 🧪 backstop | Esqueleto de 6 linhas; conferir com 60+ materiais que a primeira pintura não passa de 1 s no celular |
| empty · error · loading | E10 — bloco do Início | ✅ covered | Frase existente · frase existente + "Tentar de novo" · `BlocoEsqueleto` já montado; estado "ainda não foi contado" próprio |
| zero-one-many | E10 — mais de 5 alertas | ✅ covered | 5 linhas + "e mais N" |
| partial | E11 — saldos não carregaram no painel de Venda | ✅ covered | Linhas no formato antigo, sem aviso, sem bloqueio |
| overflow | E12 — barra fixa a 320px | 🧪 backstop | "Registrar movimentação" pode quebrar em 2 linhas dentro dos 52px; conferir no iPhone SE que nada corta e que o toast aparece acima da barra (UI-D6) |
| loading | E2 — banner | ✅ covered | Derivado da mesma lista da aba Saldos: enquanto ela carrega, o banner não existe — sem esqueleto próprio, nada pisca |
| error | E2 — banner | ✅ covered | Se a lista da aba Saldos falhou, o banner não aparece; o `EstadoErro` da aba é a única mensagem |
| overflow | E2 — banner a 320px | ✅ covered | Mesma regra da linha long-text: até 3 nomes + "e mais N", `[overflow-wrap:anywhere]`; o link "Ver" quebra para baixo, nunca rola na horizontal |
| overflow | E3 — quantidade longa na coluna de 76px | 🧪 backstop | Coluna de quantidade com largura fixa e `tabular-nums`; conferir "−1.234,567" e unidade "kg" a 320px sem cortar nem empurrar o texto |
| zero-one-many | E3 — contador e "Mostrar mais 50" | ✅ covered | "1 movimentação" / "{N} movimentações"; "Mostrar mais 50" só aparece quando há mais linhas que as mostradas |
| populated | E4 — seis barras com valores | ✅ covered | Seis barras sempre, em ordem decrescente de valor, largura proporcional à maior, mínimo 2% quando > 0 |
| long-text | E4 — nomes das barras | ✅ covered | Os seis nomes são fixos (5 destinos + "Vendido · pelo Financeiro") e as linhas por área usam os 5 nomes de área; a aba não mostra texto digitado pelo usuário |
| loading | E5 — seletor | ✅ covered | Usa a lista já carregada com a página (a mesma da aba Saldos): abre sem consulta e sem esqueleto |
| error | E5 — lista da página não carregou | 🧪 backstop | A barra fixa segue utilizável quando a aba falha (linha error E1); o seletor aberto nesse caso mostra o `EstadoErro` da aba Saldos com "Tentar de novo", nunca uma lista vazia que pareça "nenhum material"; conferir forçando a falha da consulta |
| populated | E5 — dezenas de materiais | ✅ covered | Sanfona fechada área → categoria da compra → material; com busca, lista plana alfabética |
| partial | E5 — materiais desativados, negativos e acabando | ✅ covered | Só ativos aparecem (UI-D11); negativo e acabando com o seu chip e o selo "⚠ {n}" na área |
| zero-one-many | E5 — contadores | ✅ covered | "1 material encontrado" / "{N} materiais encontrados"; selo da área só quando {n} ≥ 1 |
| long-text | E6 — vínculo e "Por quê?" | ✅ covered | 0–160 caracteres pelo Zod no servidor (Assunções, item 7), erro embaixo do campo; o nome longo no sub do cabeçalho quebra por palavra |
| empty | E7 — material sem movimentação | ✅ covered | "Nenhuma movimentação" + a frase herdada; o rodapé já tem "Registrar movimentação" |
| populated | E7 — muitas movimentações | ✅ covered | As 50 mais recentes + "Mostrar mais 50", como a aba Histórico (UI-D15) |
| partial | E7 — sem observações, sem ficha, desativado | ✅ covered | Sem observações: a caixa não aparece; sem ficha técnica: "Gasto por" não aparece (não é vazio com frase); desativado: "Reativar material" no lugar de "Registrar movimentação" |
| overflow | E7 — resumo a 320px | 🧪 backstop | Saldo Display 28px + "{R$}/{un} · {R$} em estoque · mínimo" em Apoio, que quebra; conferir saldo "−1.234,5 kg" e valores de 6 dígitos a 320px |
| zero-one-many | E7 — "Gasto por" | ✅ covered | 1 produto: só ele, sem separador; vários: todos, separados por " · ", sem truncar |
| empty | E8 — formulário novo | ✅ covered | Nome, unidade e categoria da compra obrigatórios; mínimo começa em 0; observações vazias gravam nulo (Assunções, item 7) |
| empty | E8 — nenhuma categoria de compra ativa | 🧪 backstop | Sem categoria de compra ativa não há como cadastrar material; o seletor precisa dizer isso e apontar Cadastros → Categorias em vez de abrir vazio — conferir com a semente sem categoria de compra (ligado ao D-29) |
| loading | E8 — gravando | ✅ covered | "Cadastrando…" / "Salvando…" / "Reativando…" com `disabled` e `aria-busy`; toque duplo não grava duas vezes |
| long-text | E8 — nome e observações | ✅ covered | Nome 1–120 (o do Cadastros), observações até 500, pelo Zod no servidor; `textarea` cresce, erro embaixo do campo |
| populated | E9 — 60+ materiais | ✅ covered | Dois grupos ("Ainda sem contagem", "Conferência"), por área e por nome; busca e pílulas de área para dividir por prateleira |
| overflow | E9 — linha a 320px | 🧪 backstop | Abaixo de 980px a linha empilha (nome · campos · prévia · botão); conferir a 320px com "Custou ao todo" visível que nada corta e o botão mantém 44px |
| zero-one-many | E9 — progresso e grupos | ✅ covered | "{c} de {t} contados hoje"; grupo sem material não é mostrado; "1 material" / "{N} materiais" no contador do grupo |
| long-text | E9 — nome longo | ✅ covered | Nome quebra por palavra, nunca truncado; campos ficam embaixo dele no celular |
| populated | E10 — alertas | ✅ covered | Até 5 linhas, negativo primeiro, depois acabando, cada grupo por nome |
| partial | E10 — estoque nunca contado | ✅ covered | "O estoque ainda não foi contado." + link "começar a contagem", no lugar de listar negativos que só existem porque ninguém contou |
| overflow | E10 — nome no bloco | ✅ covered | Nome com `line-clamp-1`; chip e quantidade na linha de baixo |
| overflow | E11 — linha do efeito a 320px | 🧪 backstop | "−2 kg · {nome} · fica com −1 kg" quebra por palavra dentro do painel; conferir nome de 120 caracteres a 320px sem rolagem horizontal |
| long-text | E11 — aviso de saldo negativo | ✅ covered | Um material: o nome na frase; dois ou mais: "{N} materiais", nunca a lista de nomes |
| loading | E12 — barra de abas e barra fixa | ✅ covered | Não dependem de dado: renderizam no servidor na primeira pintura; a decisão de primeira abertura (UI-D3) é tomada no servidor antes de pintar, a barra fixa nunca aparece para depois sumir |
| error | E12 — consulta da aba falhou | ✅ covered | Barra de abas e barra fixa continuam utilizáveis (linha error E1) |
| long-text | E12 — rótulos | ✅ covered | Rótulos fixos e curtos, nenhum texto do usuário; o único que quebra é "Registrar movimentação" a 320px (linha overflow E12) |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | `dialog`, `alert-dialog`, `button`, `input`, `select`, `textarea`, `field`, `label`, `skeleton`, `sonner`, `card`, `separator` | not required — todos já instalados e aprovados em fases anteriores (02b, 04.2, 04.3, 04.4), mesma cadeia (radix-nova, CLI 3.8.5) |

Nenhum registro de terceiros declarado (`components.json` → `"registries": {}`). Nenhum bloco novo
instalado nesta fase.

---

## Assunções e Desvios Deliberados

1. **Breakpoint da tabela em 980px**, não os 860px do protótipo (mesmo motivo da 04.4).
2. **Alvos de 36–42px do protótipo sobem para 44px**; 52/56/60px do protótipo ficam.
3. **Micro (12px) não é usado**; tudo que era 11–13px vira Apoio 14px.
4. **Nenhum hex solto do protótipo entra** (#7A3A05, #EBCF93, #C9A05C, #FFFDF6, acento-claro,
   acento-médio) — tokens existentes no lugar, com os pares medidos.
5. **O saldo nunca é campo** em nenhuma folha (EST-02); a única forma de mudá-lo é registrar uma
   movimentação.
6. **Autor e hora** vêm do servidor (`exigirUsuario()`, `criado_em` em `America/Sao_Paulo`);
   nenhuma folha pergunta "quem" nem "quando" — movimentação é sempre "agora".
7. **Limites de campo** (Zod no servidor): vínculo de texto e motivo 0–160; observações 1–500 (vazio
   = nulo); nome de material 1–120 (o do Cadastros); quantidade até 3 casas decimais; dinheiro
   pelos conversores de `lib/financeiro/dinheiro.ts`, com a variante que aceita **zero** só no
   saldo contado (D-32).
8. **Filtros da lista rodam no cliente** sobre a lista carregada; se um dia passar de algumas
   centenas de materiais, a busca vai para o servidor — fora desta fase.
9. **Achado para o projeto, não corrigido aqui:** o fechar padrão de `components/ui/dialog.tsx` e
   `sheet.tsx` tem `sr-only` "Close" (inglês) e tamanho `icon-sm` (< 44px). Todo diálogo existente
   que usa `showCloseButton` herda isso. Esta fase contorna (UI-D10); a correção geral cabe na
   revisão de acessibilidade da Fase 7.

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-09-29 — `gsd-ui-checker`, revisão 1 (6/6 PASS), sem o dono (sessão noturna, `--auto`). Considerações de estado conferidas depois da aprovação pela sondagem com tipos declarados: 74 pares, 0 sem resolução.

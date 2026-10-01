---
phase: 05
slug: agenda
status: approved
reviewed_at: 2026-10-01
shadcn_initialized: true
preset: radix-nova (baseColor neutral, CLI 3.8.5 fixada — decisões 02b-01/02b-02), lucide-react
created: 2026-10-01
---

# Phase 05 — Agenda — UI Design Contract

> A fonte de verdade visual é `prototipo.html` ("Agenda AMASSA"), aprovado pelo dono em 26/09/2026
> junto com o `BRIEFING.md`. Este documento cobre o que o protótipo, sozinho, não resolve: (1) o que
> um protótipo com `localStorage` não expressa (Postgres, dois celulares ao mesmo tempo, Server
> Actions, carregando/erro de verdade, a Venda real do Financeiro, a baixa real do Estoque); (2) o
> que o `05-CONTEXT.md` (D-01..D-18) mudou por cima do protótipo e do briefing; (3) o que o
> protótipo **não desenha** — a folha da turma (D-03), "Dispensar" (D-09), o aviso de dia fechado
> (D-13), cobrar/gratuita da experimental (D-07), o aviso de homônimo (D-16), Cadastros → Clientes
> (D-01) e os itens do sistema (D-17), a Venda aberta "da Agenda", o bloco "Agenda de hoje" do
> Início (D-05/D-18) e o calendário vivo do site (AGE-18, D-10..D-12); (4) o mapeamento do protótipo
> para os tokens e componentes já em produção.
>
> **Precedência, a mesma de todas as fases:** o protótipo vence sobre a **interface**; o
> `BRIEFING.md` vence sobre **regra de dado**; o `05-CONTEXT.md` vence sobre os dois. Cada ponto em
> que este contrato contraria o protótipo está em "Onde o protótipo não vale mais" — nunca em
> silêncio.
>
> **Todo dado do protótipo é inventado.** Nenhum nome, telefone, turma, oficina, preço ou valor dele
> ("Marina Lopes", "Torno iniciante", "Oficina de Natal: enfeites de cerâmica", "R$ 35", "R$ 320",
> "(62) 9 0000-0010") entra em copy, placeholder, semente ou teste. Os exemplos deste documento são
> ilustração de **formato**, escritos aqui.
>
> **Escrito sem acesso direto ao dono**, em 01/10/2026, depois das respostas dele às perguntas da
> pesquisa (D-08..D-18). As escolhas de interface que ficaram em aberto estão em "Decisões desta
> UI-SPEC" (UI-D1..UI-D28), cada uma com o porquê — o dono pode desfazer qualquer uma. As quatro que
> mudam o que ele faz no celular estão em "Perguntas ao dono".
>
> **Duas aparências nesta fase.** Tudo em `/gestao` segue o sistema da plataforma (Archivo Narrow +
> Inter, tokens `--color-*`). O **calendário público** (`components/site/`, raiz do site e a aba "No
> site", que mostra o mesmo componente) segue o sistema **do site** da 04.6 (Fraunces + Inter,
> tokens `--color-site-*`, D-19 da 04.6). As duas partes têm tabelas próprias em Typography e Color.

---

## Herdado do sistema de design — não redefinir aqui

- Tokens de cor, raio e tipografia de `app/globals.css` (02b + 04.4 + 04.6 + 06 + 06.1). **A
  plataforma não ganha nenhum token novo.** O site ganha **uma referência**, sem hex
  (`--color-site-ambar: var(--color-atencao)`, UI-D17) — ver Color.
- As quatro cores de tipo de lançamento do protótipo **já existem**, byte a byte:
  `--espaco` → `--color-area-espaco` #2E7D8C (turma fixa) · `--ouro` → `--color-ouro` #CA8A04 (aula
  ou oficina avulsa) · `--loja` → `--color-area-loja` #5B7553 (uso livre) · `--geral` →
  `--color-area-geral` #6E5F56 (fechado). As tags do protótipo também: `--ok/--ok-f` →
  `sucesso/sucesso-fundo`, `--at/--at-f` → `atencao/atencao-fundo`, `--erro/--erro-fundo` →
  `erro/erro-fundo`, `.tag` sem classe → `tinta-media` sobre `superficie-2`.
- Esqueleto no formato do conteúdo enquanto carrega; nunca "carregando..." solto; tela em branco é
  defeito.
- Erro em linguagem humana, dizendo o que fazer; formulário nunca perde o que foi digitado; erro de
  campo **embaixo do campo**, nunca em toast (UI-D9 da 06).
- Alvos de toque ≥ 44 px; campo de formulário nunca < 16 px; `aria-label` em botão só com ícone;
  foco visível pelo anel `--color-ring`; contraste AA medido; `prefers-reduced-motion` respeitado.
- Voz afetiva e direta, nunca corporativa; forma neutra para quem usa o sistema (gestores).
- **Um botão terracota por tela, no máximo** (`04-DESIGN-SYSTEM.md` §3).
- Toda "folha" do protótipo (`abrirFolha`) vira `components/ui/dialog.tsx` no padrão de
  `folha-movimentacao.tsx`/`folha-nova-ordem.tsx`: **no celular, tela toda** (`h-[100dvh]`, desliza
  de baixo); **a partir de `md` (768px), modal centralizado `md:max-w-lg`**, `md:max-h-[85svh]`.
  Rodapé preso por flex, nunca `position: sticky` (G-03-1). Fechar próprio de 44×44 com
  `aria-label="Fechar"` e `showCloseButton={false}` (UI-D10 da 06). `sheet.tsx` continua reservado
  ao menu do usuário.
- Confirmação destrutiva = `components/ui/alert-dialog.tsx`.
- Toast (`sonner`) de 5 s; no celular acima da barra inferior por `--deslocamento-aviso` (já em
  `app/globals.css`).
- Rotas sempre por `rotaDeGestao(...)` (`tests/unit/sem-rota-antiga.test.ts`); Caixa por
  `hrefDoCaixa`; WhatsApp do site **só** por `hrefDoWhatsapp` + `CONTEUDO_SITE.zap` (D-17 da 04.6).
- Dinheiro por `formatarReais` ("R$ 1.234,56"), quantidade por `formatarQuantidade`, "hoje" por
  `hojeEmBrasilia`, "agora" por `agoraEmBrasilia` (irmã nova, pesquisa Pergunta 7), sempre com
  `tabular-nums`. Fuso `America/Sao_Paulo`. **"Hoje" nunca vem do relógio do celular.**
- Plural de verdade, nunca "(s)": "1 pessoa" / "3 pessoas", "1 aula a repor" / "2 aulas a repor",
  "1 hora cheia" / "3 horas cheias", "1 vaga" / "4 vagas", "1 visita" / "5 visitas". O protótipo
  escreve "hora(s) cheia(s)" e "aula{s}" — ver "Onde o protótipo não vale mais".
- O site público (04.6): nenhum hex literal em `components/site/`, nenhum `use server`, nenhuma
  string `/gestao`, nenhum `dangerouslySetInnerHTML` (`tests/unit/site-isolamento.test.ts`); a
  seção `#agenda` continua sendo o destino dos botões fixos do site (SIT-05).

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (já inicializado — `components.json` presente, `registries: {}`, conferido em 01/10/2026) |
| Preset | `radix-nova`, `baseColor: neutral`, CLI fixada em 3.8.5 (não `@latest`) |
| Component library | Radix UI (via shadcn) |
| Icon library | lucide-react |
| Font | Plataforma: Archivo Narrow (papéis `display`/`titulo`) + Inter (corpo). Site: Fraunces (títulos, `font-titulo-site`) + Inter (corpo). As três já carregadas por `next/font/google` em `app/layout.tsx` |

---

## Spacing Scale

Nenhum token novo — a escala da 02b:

| Token | Value | Usage nesta fase |
|-------|-------|------------------|
| xs | 4px | Gap entre ponto de tipo e texto; gap entre os pontos de uma célula do mês; gap entre células do mês; gap vertical entre as linhas de texto do cartão de evento; padding vertical de tag |
| sm | 8px | Gap entre cartões de evento de um dia, entre tags, entre botões de um rodapé, entre pílulas; padding vertical do cartão de evento e das linhas de pessoa; padding horizontal de tag |
| md | 16px | Padding de bloco (`.bloco`) e de folha; padding horizontal do cartão de evento; gap entre campos; gap entre grupos de dia na semana; gap entre os quadros de Números |
| lg | 24px | Padding lateral da página no celular (`px-6`, igual ao `CabecalhoPagina`); padding das folhas; gap entre blocos de uma aba |
| xl | 32px | Padding lateral da página no desktop (`md:px-8`); espaço entre a fileira de abas e o conteúdo |
| 2xl | 48px | Padding vertical dos estados vazios |
| 3xl | 64px | Não usado nesta fase |

Os valores "quebrados" do protótipo arredondam para o token mais próximo: 2/3→4, 5/6/7→8,
9/10→8, 12/13/14→16, 18→16 (folha: 24), 22→24.

**Exceções (todas múltiplas de 4; todas vêm de alvo de toque, do protótipo ou de desenho de dado):**

- **44px** — altura mínima de todo botão, pílula, aba, link de ação, segmento "Veio / Faltou",
  linha de caixa de marcar ("tem direito a repor esta aula", "Mostrar no calendário público", turmas
  da ficha), dos botões "‹ ›" de navegação (protótipo `.btn.mini` 38px → 44) e do "+ lançar" de cada
  dia (protótipo 36 → 44), do "tirar" / "tirar da lista" (protótipo `.vermini` 28 → 44), do fechar das
  folhas, dos botões "‹ ›" do calendário do site (protótipo do site 40 → 44).
- **52px** — altura mínima de cada célula do mês na plataforma (herdado, protótipo `.mes button`
  52px); os três botões de forma do "Recebi agora" ("Dinheiro", "Pix", "Cartão"); os segmentados de
  duas opções ("Cobrar · Gratuita" da experimental, "Cobrar · Incluso" do material).
- **48px** — altura mínima de cada célula do calendário do site (protótipo do site 46 → 48).
- **64px** — coluna da hora no cartão de evento da semana (protótipo `grid-template-columns: 62px`
  → 64) e altura mínima do cartão (protótipo 60 → 64).
- **Largura da célula do mês < 44px abaixo de 375px (UI-D21):** a grade tem sete colunas iguais
  dentro do conteúdo (`px-6`), gap 4px — a 360px cada célula tem ~41px de largura, a 320px ~35px; a
  altura fica em 52px. Atende o mínimo de 24px com espaçamento do WCAG 2.5.8, e o mesmo dia é
  alcançável pela vista Semana com "‹ ›" (caminho alternativo com alvos de 44px).
- **Desenho de dado (não espaçamento):** **4px** — borda esquerda colorida do cartão de evento e do
  cartão do site (protótipo 5px → 4; protótipo do site 5 → 4) e da linha de evento do Início (herdado
  da 04.6, 4px); **8px** — ponto de tipo no mês, na legenda, no título da folha e no calendário do site
  (protótipo 7/9px e 6/8px → 8); **16px** — altura da barra de "Em que dia o espaço é mais usado"
  (protótipo 14 → 16); **44px** — coluna do rótulo do dia nessa barra (herdado do protótipo `.bh`);
  **2px** — borda do dia de hoje no mês (herdado) e do dia escolhido no calendário do site (protótipo
  do site 1px → 2px, para não depender só da cor).
- **Espessura de traço, não espaçamento:** a borda de 1px de cartões, células e tags, e o
  **contorno de 1px** do ponto ouro (plataforma) e do ponto sol e do ponto "esgotado" (site) — Color →
  UI-D12.

---

## Typography

### Plataforma (`/gestao`)

**4 tamanhos (28, 20, 16, 14px), todos tokens existentes, zero tamanhos novos.** Mesmo teto e mesma
escolha da 04.4/06/06.1: **`Micro` (12px) não é usado**. O protótipo tem textos de 11 a 13,5px (tag
11,5, dica 13, sub-linha do cartão 12,5, cabeçalho dos dias do mês 11, rótulo de campo 12,5, pílula
13,5, segmentado 13, tile `small` 12, `.bh` 13,5) — **todos sobem para `Apoio` (14px)**. Custa
largura na grade do mês; ganha leitura em pé, com a mão suja, que é o valor central.

| Role | Size | Weight | Line Height | Uso nesta fase |
|------|------|--------|-------------|-----------------|
| **Display** | 28px | 700 (do token) | 32px | Título da página "Agenda" (protótipo 26px); o **número** dos quatro quadros de Números e dos dois quadros da ficha (protótipo 26px); o total de "A receber" **não** (é Corpo 600, protótipo) |
| **Heading** (Título) | 20px | 600 | 28px (1.4) | Título de folha ("Lançar na agenda", nome do evento, "Uso livre · {nome}", nome da turma, nome da pessoa, "Pessoa nova", "Recebi agora"); título de bloco ("Pessoas", "A receber pela agenda", "{mês}, até hoje", "Em que dia o espaço é mais usado" — protótipo 19px); título da semana "14/12 a 20/12" e do mês "dezembro de 2026" (protótipo 17px); título de estado vazio |
| **Body** (Corpo) | 16px | 400 · 600 | 24px (1.5) | Texto corrido, **todo campo de formulário**, título do cartão de evento (600, protótipo 15px), nome da pessoa nas listas (600, protótipo 15px), valor de "A receber" (600), número do dia na célula do mês, texto de botão (600), texto do toast |
| **Label** (Apoio) | 14px | 400 · 600 | 20px (1.43) | Hora do cartão (600, `tabular-nums`), sub-linha do cartão, "n / vagas" (600), cabeçalho de cada dia (600, caixa alta, tracking 0.06em), dicas, legenda, rótulos de campo (600), tags e chips (600, padding 4px × 8px, `rounded-full`), abas e pílulas (600 marcada, 400 não marcada), segmentados (600), cabeçalho dos dias do mês (600), rótulo dos quadros de Números (600, caixa alta, tracking 0.06em), linhas de "Em que dia…", "Agora no espaço" |

**Pesos: 400 e 600** — mais o 700 que vem **só** do token travado do Display (exceção abaixo); não é escolha desta fase e não conta como terceiro peso dela.

**Exceção documentada — o 700:** entra **só** pelo token travado `--text-display--font-weight: 700`
do papel Display (`04-DESIGN-SYSTEM.md` §4, travado pelo dono), nunca como escolha desta fase. O
`<b>` do protótipo ("**Valor**", "**Recebi agora**", o total) e o `font-weight:700` do total de "A
receber" viram `font-semibold` (600). O 500 do protótipo (`.pil`, rótulos de campo) vira 400 (não
marcado) e 600 (marcado/rótulo) — o estado marcado não depende só de cor.

Todo número (horas, datas, dinheiro, vagas, pessoas, porcentagem) usa **`tabular-nums`**.

### Site público (`components/site/` — calendário vivo e a aba "No site")

Os tamanhos que a seção `#agenda` **já tem** ficam como estão (eyebrow, `h2` 28/40px em Fraunces,
lead 18px, `CartaoDoSite` 22/15px, botões de WhatsApp 15px 600 — 04.6, não redefinir). Os
componentes **novos** desta fase usam **3 tamanhos**, todos com a família que o site já usa:

| Role | Size | Weight | Line Height | Uso |
|------|------|--------|-------------|-----|
| Título de cartão de evento | 22px (Fraunces, `font-titulo-site`) | 600 | 26px (1.2) | Nome da turma/oficina no cartão (protótipo do site 19px → 22, o mesmo `h3` de `CartaoDoSite`, para os cartões da seção serem da mesma família) |
| Corpo do site | 16px (Inter) | 400 · 600 | 24px (1.5) | "Turma fixa · toda terça, 19h às 21h"; "R$ {x} por mês · material incluso · 3 vagas" (vagas em 600); nome do mês na navegação (600); título da lista ("Em dezembro", "sábado, 19/12", 600); número do dia na célula; abas "Próximas · Calendário" (600 marcada) |
| Apoio do site | 14px (Inter) | 400 · 600 | 20px | Cabeçalho dos dias da semana (600), legenda, "Nada marcado neste mês ainda.", "Fechado neste dia.", "e mais {N} no calendário" |

Nenhum texto novo do site abaixo de 14px (o protótipo do site tem 11, 12,5 e 14,5px — sobem para 14 e
16). Pesos do site: 400 e 600.

---

## Color

### Plataforma

Os tokens de superfície, texto e ação do protótipo já são, byte a byte, os tokens da plataforma
(`--fundo`↔`--color-fundo`, `--sup`↔`--color-superficie`, `--sup2`↔`--color-superficie-2`,
`--borda`/`--borda-f`↔`--color-borda`/`--color-borda-forte`, `--acento`↔`--color-acento`,
`--acento-fundo`↔`--color-acento-fundo`, `--tinta*`↔`--color-tinta*`). O que **não** entra:

| No protótipo | Onde | Vira |
|---|---|---|
| `.mes button.fora{opacity:.4}` | dias fora do mês | fundo `superficie-2`, número `tinta-fraca` (5,12:1) — opacidade reprovaria o contraste do número |
| `.pil[aria-pressed=true]` terracota cheio | abas da Agenda e pílulas de tipo | abas neutras (UI-D1); pílula de tipo no estilo `classeDaPilula` da Fase 06 (`acento-fundo`, borda e texto `acento`, 600) |
| `.seg button[aria-pressed=true].sim` verde | "Semana · Mês", "Próximas · Calendário" na gestão | alternador neutro (UI-D2) |
| `.falta` (`erro-fundo`) na "lista cheia" | folha do evento | `atencao-fundo`/`atencao` — é aviso que não bloqueia, não erro (UI-D16) |
| `.vermini` (texto `acento`) em "tirar" / "tirar da lista" | listas das folhas | `tinta-media`, sublinhado — o terracota da folha é o primário |
| `.tile.saldo` (`--tinta` cheio, `small` `#D8CFC7`) | quadro "Pessoas no espaço" de Números | mantido: fundo `tinta`, número branco (16,12:1), rótulo e sub-linha `borda-forte` (10,47:1) — é o mesmo desenho do saldo do Caixa |
| `rgba(29,34,33,.45)` (véu da folha) | `#veu` | o `DialogOverlay` que já existe |
| `.site .c .wa` (`--loja` com texto branco) | cartão do site | o botão de WhatsApp que o site **já tem** (`bg-site-cerrado`, texto branco, 5,10:1) |

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `--color-fundo` #F6F3F0 | Fundo da página, fundo atrás dos grupos de dia da semana e da grade do mês |
| Secondary (30%) | `--color-superficie` #FFFFFF / `--color-superficie-2` #EFEAE5 | `superficie`: cartões de evento, células do mês, blocos (Pessoas, A receber, Números), folhas, quadros. `superficie-2`: dias fora do mês, tags neutras, trilho das barras de Números. (A faixa "Agora no espaço" do Início continua `acento-fundo`, herdada da 04.6) |
| Accent (10%) | `--color-acento` #894025 | Lista fechada abaixo |
| Destructive | `--color-erro` #B91C1C | Lista fechada abaixo |

**Accent reservado para (lista fechada):**
1. O **único** botão primário de cada tela:
   - Aba Agenda (semana e mês): **"+ Lançar na agenda"**.
   - Aba Pessoas: **nenhum** ("+ Pessoa" é `outline`, como o protótipo). No estado vazio total, o
     "+ Pessoa" do `EstadoVazio`.
   - Aba A receber: **"Lançar estas {N} na Venda · {R$}"** (o lote), só quando há mensalidade a
     receber; sem mensalidade, **nenhum** — "Recebi agora", "Lançar na Venda" e "Dispensar" de cada
     linha são `outline` (UI-D3).
   - Abas No site e Números: **nenhum**.
   - Folha "Lançar na agenda": **"Lançar turma"** / **"Lançar aula"** / **"Reservar uso livre"** /
     **"Fechar o dia"** (UI-D9).
   - Folha do evento (turma/avulsa): **"Pronto"** (herdado).
   - Folha do uso livre: **"Chegou"** (reservado) · **"Encerrar e cobrar"** (no espaço) · **"Lançar na
     Venda"** (encerrado a receber) — um por estado.
   - Folha do fechado: **nenhum**.
   - Folha da turma: **"Salvar turma"**.
   - Ficha da pessoa: **"Pronto"** (herdado). Pessoa nova: **"Salvar pessoa"**.
   - Folha "Recebi agora": **nenhum** (as três formas são `outline` de 52px — UI-D4).
   - Confirmação "Dispensar": **"Dispensar a cobrança"**.
   - Cadastros → Clientes: **"Novo cliente"**.
   - Venda aberta da Agenda: o "Lançar venda" que a tela da Venda **já tem** — nada muda.
2. Anel de foco de todo elemento interativo.
3. Pílula de tipo marcada na folha "Lançar na agenda" (`classeDaPilula`: fundo `acento-fundo`,
   borda e texto `acento`, 600).
4. **Hoje:** o cabeçalho do dia de hoje na semana (texto `acento`, herdado de `.dia.hoje>h3`) e a
   borda de 2px da célula de hoje no mês (herdado).
5. Célula do mês com foco de teclado/toque ativo: fundo `acento-fundo` (herdado de `.sel`).
6. "+ lançar" de cada dia (texto `acento`, 600, herdado).
7. Links de texto: "Abrir a turma", "ver no Caixa", "venda nº {N}", "Voltar à data", "Cadastrar
   "{nome}"", "e mais {N}" e "abrir agenda" (Início, já existe), "Voltar à Agenda" (Venda da Agenda).
8. Caixa de marcar marcada (`accent-color` / `Checkbox` do shadcn no tom `primary` = `acento`).
9. A faixa "Da Agenda" no topo da Venda aberta pela Agenda (texto `tinta` sobre `acento-fundo`,
   13,89:1; link `acento`, 6,41:1).

**Destructive (`--color-erro`) reservado para:**
- Botões `outline` de erro: **"Cancelar esta data"**, **"Cancelar reserva"**, **"Tirar o
  bloqueio"**, **"Desativar turma"** e o botão de confirmação de cada um (herdado de `.btn.perigo`).
- Tag **"cancelada"** e tag **"a receber"** / **"{n} a receber"** (herdado de `.tag.venc`:
  `erro`/`erro-fundo`).
- Segmento **"Faltou"** marcado (`erro`/`erro-fundo`, herdado de `.seg .nao`) e a tag "faltou" das
  últimas vindas.
- Mensagens de erro de campo e de carregamento.

**Atenção (`--color-atencao`) reservado para:** tags **"marcar presença"**, **"encerrar"** (D-18),
**"reposição"**, **"{n} a repor"**, **"repõe"**, **"dia fechado"** (D-13), **"venda nº {N}
cancelada"** (D-08); as caixas de aviso **"A lista já está cheia…"**, **"Este dia está fechado…"**
(D-13), **"Já existe {nome}…"** (D-16) e **"O preço da hora ainda não foi cadastrado…"**; o
cabeçalho do grupo "Tem aula a repor" no seletor de pessoa.

**Sucesso (`--color-sucesso`) reservado para:** segmento **"Veio"** marcado; tags **"pago"**,
**"está no espaço"**, **"veio"** (últimas vindas).

**Neutro (`--color-tinta-media` sobre `--color-superficie-2`):** tags **"no site"**, **"lançado na
Venda"**, **"experimental"**, **"gratuita"**, **"reservado"**, **"encerrado"**, **"dispensada"**,
**"proporcional"**; chip **"do sistema"** em Cadastros → Catálogo (D-17).

**Cores de tipo — decorativas, nunca a única pista (UI-D12).** Borda esquerda do cartão de evento,
ponto do mês, ponto da legenda, ponto do título da folha, borda da linha do Início:
`--color-area-espaco` (turma fixa) · `--color-ouro` (aula ou oficina avulsa) · `--color-area-loja`
(uso livre) · `--color-area-geral` (fechado). O **tipo está sempre escrito**: na sub-linha do cartão
("Turma fixa · até 21:00", "Oficina · até 17:00", "Uso livre · …", "Fechado · dia todo"), no
`aria-label` da célula do mês ("sábado, 19 de dezembro: 1 turma fixa, 1 oficina") e na legenda. O
**ouro reprova como objeto gráfico** (2,94:1 sobre `superficie`, 2,53:1 sobre `acento-fundo`, 2,46:1
sobre `superficie-2`): todo ponto ouro leva **contorno de 1px `--color-tinta-fraca`** (a mesma
solução da secagem, UI-D13 da 06.1). A borda esquerda ouro do cartão é decorativa (o tipo está
escrito ao lado) e não precisa do contorno.

### Site público

Neutros e acentos do bloco `@theme` do site (D-19 da 04.6), sem hex novo:

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `--color-site-papel` #FFFDFA | Fundo da seção `#agenda` (já é), fundo dos cartões de evento e do bloco "Uso livre do ateliê", fundo das células do calendário |
| Secondary (30%) | `--color-site-fundo` #F6F1EA / `--color-site-borda` #E3D8CC | `site-fundo`: o painel do calendário (protótipo do site `.cal`); `site-borda`: bordas de cartão, de célula e de aba não marcada |
| Accent (10%) | `--color-site-barro` (= `--color-acento`) | Aba marcada "Próximas · Calendário" (fundo `site-barro`, texto branco, 7,44:1); borda de 2px do dia escolhido; anel de foco. **O botão cheio da seção continua sendo o de WhatsApp em `site-cerrado`** (herdado da 04.6) |
| Destructive | — | O site não tem ação destrutiva |

**Vagas restantes — o texto diz, a cor reforça** (herdado do protótipo do site, sobre `site-papel`):
"{n} vagas" `site-cerrado` (5,03:1) · "últimas 2 vagas" / "última vaga" **`site-ambar`** (4,95:1) ·
"esgotado" `site-barro-claro` (4,97:1). O protótipo do site escrevia o âmbar como hex solto
(`#B45309` = `--color-atencao`) e os cartões sobre `site-fundo`, onde o âmbar dá 4,47:1 e o
barro-claro 4,49:1 — **reprovados**. Por isso: cartões sobre `site-papel` e **um token novo por
referência** no bloco do site, `--color-site-ambar: var(--color-atencao)` (a oitava referência;
`tests/unit/tokens.test.ts` ganha a linha) — UI-D17.

**Pontos do calendário do site:** turma fixa `site-folha` (4,67:1); oficina `site-sol` **com contorno
de 1px `site-tinta-fraca`** (o sol sozinho dá 1,63:1); **esgotado = ponto vazado** (só o contorno de
1px `site-tinta-fraca`, sem preenchimento — forma, não cor; o protótipo usava a cor da borda, 1,38:1);
fechado `site-tinta-fraca` cheio (5,28:1).

### Pares de contraste — para `tests/unit/contraste.test.ts`

Medidos nesta sessão com a fórmula WCAG 2.1 (a mesma de `lib/acessibilidade/contraste.ts`), lendo os
hex de `app/globals.css`. O planejador acrescenta um bloco **"contraste da Agenda (05-UI-SPEC.md)"**
com `tokenDaPlataforma(...)` (nunca hex repetido no teste). Pares que outras fases já provam entram
de novo com o uso da Agenda — o teste cobre o uso.

| # | Frente | Fundo | Razão | Mínimo | Onde |
|---|---|---|---|---|---|
| A1 | `atencao` | `atencao-fundo` | **4,51:1** | 4,5 | Tags "marcar presença", "encerrar", "reposição", "{n} a repor", "dia fechado", "venda nº N cancelada"; avisos de lista cheia, dia fechado, homônimo, preço da hora — **passa por 0,01** |
| A2 | `sucesso` | `sucesso-fundo` | **4,57:1** | 4,5 | "Veio" marcado, tags "pago", "está no espaço", "veio" — margem curta |
| A3 | `erro` | `erro-fundo` | 5,30:1 | 4,5 | "Faltou" marcado, tags "cancelada", "a receber", "faltou" |
| A4 | `tinta-media` | `superficie-2` | 6,89:1 | 4,5 | Tags neutras; chip "do sistema" |
| A5 | `tinta-fraca` | `superficie` | 6,11:1 | 4,5 | Sub-linha do cartão, dicas, legenda, "nada marcado" dentro de bloco |
| A6 | `tinta-fraca` | `fundo` | 5,53:1 | 4,5 | "nada marcado" de um dia vazio (sobre a página) |
| A7 | `tinta-media` | `fundo` | 7,44:1 | 4,5 | Cabeçalho de cada dia da semana |
| A8 | `acento` | `fundo` | 6,73:1 | 4,5 | Cabeçalho do dia de hoje; "+ lançar" |
| A9 | `acento` | `acento-fundo` | 6,41:1 | 4,5 | Pílula de tipo marcada; link da faixa "Da Agenda" |
| A10 | `tinta` | `acento-fundo` | 13,89:1 | 4,5 | Número da célula do mês escolhida; texto da faixa "Da Agenda"; "Agora no espaço" (herdado) |
| A11 | `tinta-fraca` | `superficie-2` | 5,12:1 | 4,5 | Número dos dias fora do mês |
| A12 | `acento` | `superficie` | 7,44:1 | 4,5 | Links de texto nas folhas |
| A13 | `erro` | `superficie` | 6,47:1 | 4,5 | Botões `outline` de erro |
| A14 | `area-espaco` · `area-loja` · `area-geral` | `superficie` / `acento-fundo` / `superficie-2` | 4,74 · 5,10 · 6,11 / 4,09 · 4,40 · 5,27 / 3,97 · 4,27 · 5,12 | 3,0 (não-texto) | Pontos do mês (célula normal, escolhida, fora do mês) e da legenda |
| A15 | `tinta-fraca` (contorno de 1px do ponto ouro) | `superficie` / `acento-fundo` / `superficie-2` | 6,11 / 5,27 / 5,12 | 3,0 (não-texto) | **Contorno do ponto ouro** — e o teste afirma que o ouro **sozinho** continua reprovado (`razaoDeContraste(ouro, superficie) < 3`, 2,94) |
| A16 | `#FFFFFF` / `borda-forte` | `tinta` | 16,12 / 10,47 | 4,5 | Quadro "Pessoas no espaço" de Números |
| A17 | `area-espaco` (barra) | `superficie-2` (trilho) | 3,97:1 | 3,0 (não-texto) | Barras de "Em que dia o espaço é mais usado" (o valor está escrito ao lado) |
| S1 | `site-cerrado` | `site-papel` | 5,03:1 | 4,5 | "{n} vagas" |
| S2 | `site-ambar` (= `atencao`) | `site-papel` | 4,95:1 | 4,5 | "últimas 2 vagas", "última vaga" |
| S3 | `site-barro-claro` | `site-papel` | 4,97:1 | 4,5 | "esgotado" |
| S4 | `site-tinta-fraca` | `site-papel` / `site-fundo` | 5,28 / 4,77 | 4,5 | Legenda, cabeçalho dos dias, "Fechado neste dia." (papel); legenda sob a grade (painel `site-fundo`) |
| S5 | `#FFFFFF` | `site-cerrado` | 5,10:1 | 4,5 | "Reservar pelo WhatsApp" |
| S6 | `#FFFFFF` | `site-barro` | 7,44:1 | 4,5 | Aba marcada "Próximas · Calendário" |
| S7 | `site-tinta` / `site-tinta-media` | `site-papel` | 16,54 / 8,10 | 4,5 | Título e linhas do cartão |
| S8 | `site-folha` / `site-tinta-fraca` (ponto cheio e contornos) / `site-barro` (borda do dia escolhido) | `site-papel` | 4,67 / 5,28 / 7,32 | 3,0 (não-texto) | Pontos do calendário e dia escolhido — e o teste afirma que `site-sol` sozinho (1,63) e `site-borda` (1,38) continuam reprovados, por isso o contorno e o ponto vazado |

---

## Foco Visual Principal

| Tela | Onde o olho pousa primeiro |
|---|---|
| **Agenda → Semana (celular)** | O cabeçalho **terracota do dia de hoje** e, embaixo dele, os cartões do dia com a **tag âmbar** ("marcar presença", "encerrar", "dia fechado") — é por ela que se acha o que pede ação; depois o "+ Lançar na agenda" |
| **Agenda → Mês** | A célula de hoje (borda terracota) e a densidade de pontos por dia |
| **Folha do evento (turma/avulsa)** | A coluna **Veio / Faltou** de cada nome — um toque por pessoa, sem rolar entre nomes |
| **Folha do uso livre** | O **valor** (Corpo 600) na última linha da conta e o botão do estado ("Chegou" / "Encerrar e cobrar") |
| **Pessoas** | O campo de busca e, na lista, as tags "{n} a repor" (âmbar) e "{n} a receber" (vermelho) |
| **A receber** | O **total** no cabeçalho e, logo abaixo, a sanfona do lote aberta com o botão terracota |
| **No site** | O primeiro cartão de evento, como o visitante o vê |
| **Números** | Os quatro números em Display; o quadro escuro "Pessoas no espaço" |
| **Início → Agenda de hoje** | A faixa "Agora no espaço: N pessoas" (herdada) e a primeira linha do dia |
| **Site → `#agenda`** | O primeiro cartão de "Próximas", com a cor das vagas e o "Reservar pelo WhatsApp" |

---

## Copywriting Contract

### Resumo (o que o verificador procura)

| Element | Copy |
|---------|------|
| Primary CTA | **"+ Lançar na agenda"** (aba Agenda); nas folhas, **"Lançar turma"** / **"Lançar aula"** / **"Reservar uso livre"** / **"Fechar o dia"**; em A receber, **"Lançar estas {N} na Venda · {R$}"** |
| Empty state heading | Semana: **"nada marcado"** em cada dia vazio (herdado). Pessoas sem ninguém: **"Ninguém cadastrado ainda."** A receber: **"Ninguém devendo."** (herdado) |
| Empty state body | Pessoas: "Cadastre a primeira pessoa — ela aparece também em Cadastros → Clientes." A receber: "Mensalidades, inscrições e usos livres encerrados aparecem aqui até virarem venda." |
| Error state | **"Não deu para carregar a agenda. Verifique a internet e tente de novo."** + "Tentar de novo" |
| Destructive confirmation | **Cancelar esta data**: "Cancelar a aula de {dia}, {dd/mm}?" — ver "Confirmações" (sete casos) |

### Ações

| Element | Copy |
|---------|------|
| Abas (`role="tablist"`, `aria-label="Partes da Agenda"`) | "Agenda" · "Pessoas" · "A receber" (+ " · {N}" quando N > 0, herdado) · "No site" · "Números" |
| Alternador de vista | "Semana" · "Mês" (herdados), `aria-label="Ver a agenda por"` |
| Navegação | botões "‹" e "›" só com ícone (`ChevronLeft`/`ChevronRight`), `aria-label` **"Semana anterior"** / **"Próxima semana"** — no mês, **"Mês anterior"** / **"Próximo mês"** (o protótipo dizia "anterior"/"próxima") |
| Lançar | **"+ Lançar na agenda"** (primário, herdado) · **"Hoje"** (`outline`, herdado) |
| Lançar num dia | **"+ lançar"** (herdado), `aria-label="Lançar em {dia da semana}, {dd/mm}"` |
| Folha Lançar — tipo | pílulas "Turma fixa" · "Aula ou oficina avulsa" · "Uso livre" · "Fechado / bloqueio" (herdadas), `role="radiogroup"`, `aria-label="O que lançar"` |
| Folha Lançar — gravar | **"Lançar turma"** · **"Lançar aula"** · **"Reservar uso livre"** · **"Fechar o dia"** (o protótipo dizia só "Lançar" — UI-D9); enquanto grava: "Lançando…" / "Reservando…" / "Fechando…" (`disabled`, `aria-busy="true"`) |
| Folha Lançar — sair | **"Voltar"** (`outline`; o protótipo dizia "Cancelar" — ao lado de "Cancelar esta data"/"Cancelar reserva" confunde, mesma razão da UI-D10 da 06.1) |
| Presença | **"Veio"** · **"Faltou"** (herdados), cada um `aria-pressed`, grupo `role="group"` `aria-label="Presença de {nome}"`; tocar no marcado desmarca |
| Direito a repor | caixa **"tem direito a repor esta aula"** (herdada) |
| Colocar alguém | campo de busca "Colocar alguém" (herdado, rótulo) com placeholder **"Buscar pelo nome"**; ao escolher: **"Colocar na lista"** (`outline`; o protótipo dizia "Colocar"); enquanto grava "Colocando…" |
| Colocar — pessoa nova | **"Cadastrar "{texto digitado}""** (link-botão no fim da lista) → **"Salvar e colocar"** |
| Experimental (D-07) | segmentado **"Cobrar"** · **"Gratuita"**, `role="radiogroup"`, `aria-label="Esta aula é cobrada?"`, nenhum marcado de início (UI-D6) |
| Tirar | **"tirar da lista"** (herdado) · **"tirar"** (material, herdado) — 44px, `tinta-media` sublinhado; `aria-label="Tirar {nome} da lista"` / `"Tirar {material} da lista de material"` |
| Turma (D-03) | **"Abrir a turma"** (link, na folha da data) · **"Salvar turma"** (primário) · **"Marcar mais semanas"** (`outline`) · **"Desativar turma"** (`outline` de erro) · **"Voltar à data"** (link, quando aberta de uma data) |
| Cancelar data | **"Cancelar esta data"** (`outline` de erro, herdado) · **"Desfazer cancelamento"** (`outline`, herdado) |
| Folha do evento — fechar | **"Pronto"** (primário, herdado) |
| Uso livre | **"Chegou"** (primário, herdado) · **"Cancelar reserva"** (`outline` de erro, herdado) · **"+ Material"** (`outline`, herdado) · **"Encerrar e cobrar"** (primário, herdado) · **"Recebi agora"** (`outline`) · **"Lançar na Venda"** (primário) — enquanto grava: "Marcando…", "Encerrando…" |
| Fechado | **"Tirar o bloqueio"** (`outline` de erro, herdado) · **"Voltar à agenda"** (`outline`; o protótipo dizia "Fechar", que ao lado de "Fechar o dia" se lê como fechar o dia) |
| Pessoas | **"+ Pessoa"** (`outline`, herdado) · **"Abrir"** (`outline`, herdado), `aria-label="Abrir a ficha de {nome}"` · **"Mostrar mais 50"** (`outline`) |
| Ficha | **"Editar"** (`outline`, UI-D24) · **"Pronto"** (primário, herdado) · caixa de cada turma (entrar/sair, herdado) · link **"ver turma"** em cada turma marcada |
| Pessoa nova | **"Salvar pessoa"** (o protótipo dizia "Salvar") · **"Voltar"** (`outline`); enquanto grava "Salvando…" |
| Homônimo (D-16) | **"Usar {nome} que já existe"** (`outline`) · **"Criar outra pessoa"** (`outline`) |
| A receber — linha | **"Recebi agora"** (`outline`) · **"Lançar na Venda"** (`outline` — UI-D3; o protótipo pintava de terracota) · **"Dispensar a cobrança"** (link-botão 44px, `tinta-media`, só mensalidade e inscrição — D-09) |
| A receber — lote | sanfona **"Lançar todas as mensalidades de uma vez ({N}) — ver quem entra"** (herdada, aberta por padrão) · **"Lançar estas {N} na Venda · {R$}"** (primário, herdado); enquanto grava "Lançando…" |
| Recebi agora — forma | **"Dinheiro"** · **"Pix"** · **"Cartão"** (três botões `outline` de 52px, cada um grava na hora — UI-D4); enquanto grava, o tocado vira "Registrando…" e os três ficam `disabled` · **"Voltar"** (`outline`) |
| Dispensadas | sanfona **"Dispensadas ({N})"** (fechada) · **"Desfazer"** (`outline`) em cada linha, `aria-label="Desfazer a dispensa de {descrição} de {nome}"` |
| No site | sem ação própria; os botões do site aparecem como no site |
| Cadastros → Clientes | **"Novo cliente"** (primário) · **"Editar"** (`outline`, mesmo rótulo do Catálogo), `aria-label="Editar {nome}"` |
| Venda da Agenda | **"Voltar à Agenda"** (link na faixa, sem lançar); o "Lançar venda" e o resto da tela da Venda não mudam |
| Fechar folha | botão 44×44 com `×` visível e `aria-label="Fechar"` |

### Rótulos e dicas de campo

| Campo | Rótulo | Dica / placeholder (Apoio, `tinta-fraca`) |
|---|---|---|
| Turma — nome | "Nome" | placeholder **"ex.: Torno à noite"** (formato, escrito aqui) |
| Turma — dia | "Dia da semana" | `Select` do shadcn, ordem segunda → domingo (herdada); padrão: o dia da semana da data tocada, ou segunda |
| Turma — início | **"Primeira aula a partir de"** (UI-D10) | `type="date"`, padrão hoje (ou o dia tocado em "+ lançar") |
| Turma/Aula — horário | "Começa" · "Termina" (herdados) | `type="time"`, `step="300"`, sem padrão de valor (o protótipo pré-enchia 14:00/16:00 — sai: nasce vazio e o erro pede) |
| Turma/Aula — vagas | "Vagas" (herdado) | `inputmode="numeric"`, padrão **8** (herdado) |
| Turma — valor | "Mensalidade (R$)" (herdado) | `inputmode="decimal"`, **vazio** (o protótipo pré-enchia "300" — preço no código, AGE-17) |
| Turma — semanas | "Marcar quantas semanas" (herdado) | padrão **8**, 1 a 52 |
| Turma — vencimento | "Mensalidade vence dia" (herdado) | padrão **10**, 1 a 28; dica "de 1 a 28 — todo mês tem esses dias" |
| Aula — nome | "Nome" | placeholder **"ex.: Oficina de pintura em biscoito"** |
| Aula — data | "Data" (herdado) | padrão: o dia tocado ou hoje |
| Aula — preço | "Preço por pessoa (R$)" (herdado) | **vazio** (o protótipo pré-enchia "120") |
| Turma/Aula — público | caixa **"Mostrar no calendário público do site"** (herdada) | marcada por padrão (herdado) |
| Uso livre — quem | "Quem" (herdado) | o seletor de pessoa (UI-D5) |
| Uso livre — data/hora | "Data" · "Chega às" (o protótipo dizia "Começa") | `type="time"`, `step="300"` |
| Uso livre — horas | "Horas previstas" (o protótipo dizia "Horas") | padrão **2** (herdado), 1 a 12 |
| Uso livre — pessoas | "Pessoas" (herdado) | padrão **1** (herdado), 1 a 50 |
| Fechado — motivo | "Motivo" (herdado) | placeholder **"ex.: feriado"** (herdado); dica "não aparece no site — lá o dia aparece só como fechado" |
| Experimental — valor (D-07) | "Valor desta aula (R$)" | já preenchido com o valor de uma aula; dica **"sugestão: mensalidade de {R$} ÷ {n} aulas em {mês}"** |
| Uso livre — chegada | "Chegou às" | já preenchido com a hora da reserva (AGE-13), editável até encerrar |
| Uso livre — saída | "Saiu às" (herdado) | já preenchido com **a hora de agora** quando o uso é de hoje; com a hora prevista de saída quando é de dia passado (UI-D7); `step="60"` |
| Material — item | "Item do estoque" (herdado) | o seletor **"Qual material?"** da Fase 06 (só ativos que controlam estoque) |
| Material — quantidade | "Quanto" (o protótipo dizia "Qtde") | `inputmode="decimal"`, dica "em {unidade do item}" |
| Material — cobrança | "Cobrar?" (herdado) | segmentado **"Cobrar · Incluso"** (o protótipo era `select`); item sem preço de venda: só "Incluso", com a dica **"Cadastre o preço de venda em Cadastros para poder cobrar."** (D-14) |
| Pessoa — nome | "Nome" (herdado) | até 160 caracteres |
| Pessoa — telefone | "Telefone (opcional)" (herdado) | `inputmode="tel"`, até 40 caracteres, texto livre |
| Dispensar — motivo | "Motivo (opcional)" | placeholder **"ex.: bolsa, saiu da turma no começo do mês"**; até 200 caracteres |
| Pessoas — busca | `aria-label="Buscar pessoa"` (herdado) | placeholder **"Buscar pelo nome"** (herdado); acha sem acento ("joao" acha "João") |

### Cartão de evento (semana)

Grade `64px 1fr auto` (herdada, 62 → 64):
- **Coluna 1:** hora de início (Apoio 600, `tabular-nums`, `tinta-media`); fechado: **"dia todo"**
  (herdado).
- **Coluna 2:** título (Corpo 600, quebra livre, nunca truncado): turma/aula = o nome; uso livre =
  **"Uso livre · {nome}"** (herdado); fechado = o motivo.
- **Coluna 3:** turma/aula **"{n} / {vagas}"** (Apoio 600, herdado); uso livre **"{n} pessoa"** /
  **"{n} pessoas"** (o protótipo dizia "lugar/lugares"); fechado: nada.
- **Linha de baixo** (coluna 2 até o fim, Apoio `tinta-fraca`, `flex-wrap`, gap 4px × 8px): o
  **tipo** + o fim — **"Turma fixa · até {hh:mm}"** · **"Oficina · até {hh:mm}"** · **"Uso livre · até
  {hh:mm}"** (o fim previsto; encerrado: o real) · **"Fechado · o dia todo"** (UI-D12; o protótipo
  dizia só "até {hh:mm}") — e as tags, nesta ordem: "cancelada" · "dia fechado" · "marcar presença"
  · "encerrar" · "{n} a receber" · "está no espaço" / "reservado" · "pago" / "lançado na Venda" / "a
  receber" (uso livre encerrado) · "no site".
- Cancelado: título riscado em `tinta-fraca` + tag "cancelada" (herdado).
- Nome acessível do botão = o texto do cartão inteiro (não sobrescrever).

### Folha do evento — linhas de leitura

| Onde | Copy |
|---|---|
| Sub-título | "{Turma fixa \| Aula ou oficina avulsa} · {dia da semana}, {dd/mm} · {hh:mm} às {hh:mm}" (herdado) + " · **cancelada**" + avulsa: " · {R$} por pessoa" |
| Turma | link **"Abrir a turma"** (D-03) |
| Dia fechado (D-13) | caixa atenção: **"Este dia está fechado: {motivo}. Se a aula não vai acontecer, cancele esta data."** + "Cancelar esta data" (`outline` de erro) dentro da caixa. **Nessa data o botão existe uma vez só:** ele sobe para a caixa (topo da folha, visível sem rolar) e o rodapé mostra só "Pronto" — dois botões iguais na mesma folha confundem (recomendação do verificador de UI, 01/10/2026) |
| Lista | título **"Quem vem · {n} de {vagas}"** (herdado) + tag "no site" |
| Pessoa — tags | "reposição" (herdado) · "experimental" (D-07) · a situação do pagamento: aluno → a da mensalidade do mês ("a receber" / "lançado na Venda" / "pago" / "venda nº {N} cancelada" / "dispensada"); experimental cobrada e oficina → a da inscrição; experimental gratuita → "gratuita"; reposição → nenhuma (herdado: "quem vem repor não paga de novo") |
| Venda ativa (D-08) | no lugar de "tirar da lista": **"Já virou a venda nº {N} — para devolver, cancele a venda no Caixa."** (Apoio `tinta-fraca`) + link "ver no Caixa" |
| Lista cheia | **"A lista já está cheia — dá para colocar mesmo assim, é só um aviso."** (herdado; caixa atenção) |
| Dica do fim — turma | **"Turma fixa: o pagamento é a mensalidade do mês (aparece ao lado do nome). Quem vem repor não paga de novo. Aula experimental é cobrada ou não na hora de colocar a pessoa."** (herdado + D-07) |
| Dica do fim — oficina | **"Oficina avulsa: cada inscrição é paga à parte — o que falta aparece em "A receber"."** (herdado) |
| Lista vazia | **"Ninguém inscrito ainda."** (herdado) |

### Seletor de pessoa ("Colocar alguém" e "Quem" do uso livre) — UI-D5

| Situação | Copy |
|---|---|
| Grupo 1 (só em data de turma ou oficina) | **"Tem aula a repor"** (herdado, cabeçalho Apoio 600 `atencao`); cada linha "{nome} — reposição · {n} a repor" |
| Grupo 2 | **"Aula experimental / avulsa"** (data de turma) · **"Inscrever"** (oficina) · **"Pessoas"** (uso livre) — herdados |
| Linha | "{nome}" (Corpo 600) + "{telefone}" (Apoio `tinta-fraca`; sem telefone: nada) |
| Busca vazia, sem ninguém a repor | **"Digite para buscar."** |
| Busca sem resultado | **"Ninguém com esse nome."** (herdado) + **"Cadastrar "{texto}""** |
| Ninguém cadastrado | **"Ninguém cadastrado ainda. Digite o nome para cadastrar."** |
| Escolhida — reposição | "{nome} entra como **reposição** e usa 1 das {n} aulas a repor." |
| Escolhida — oficina | "{nome} entra como inscrição de {R$} — vai para "A receber"." |
| Escolhida — experimental | "{nome} entra só nesta data." + o segmentado "Cobrar · Gratuita" e, em "Cobrar", o campo do valor |
| Já está na lista | a pessoa não aparece no seletor |

### Folha do uso livre — linhas de leitura

| Onde | Copy |
|---|---|
| Título | ponto `area-loja` + **"Uso livre · {nome}"** (herdado) |
| Sub-título | "Uso livre · {dia da semana}, {dd/mm} · {chegada} às {saída prevista \| saída}" + tag "reservado" / "está no espaço" / "encerrado" |
| Conta | "Pessoas" **{n}** · "Horas cheias" **"{h} h × {R$ hora}"** (1 pessoa) / **"{h} h × {n} pessoas × {R$ hora} = {R$}"** (o protótipo omitia as pessoas na linha) · "Material cobrado" **{R$}** (só se houver) · **"Valor"** **{R$}** (600). No espaço: as horas vêm da "Saiu às" do campo, `aria-live="polite"` |
| Reservado (dica) | **"Reservado. Quando a pessoa chegar, marque — é isso que vira registro de uso."** (herdado) |
| Material — título | **"Material usado"** (herdado) |
| Material — linha | "{q} {un} · {nome do item}" … "{R$}" ou "incluso" (herdados) |
| Material — vazio | **"nenhum"** (herdado) |
| Material — dica | **'Tudo o que entra aqui dá baixa no Estoque ao encerrar, como "Uso livre do espaço". "Cobrar" soma o material na conta da pessoa; "incluso" só baixa o estoque.'** (o protótipo dizia 'destino "uso do espaço"' — D-06) |
| Encerrar — dica | **"Cobrança por hora cheia: passou da hora, conta a próxima. Ferramentas e utensílios são sempre inclusos; matéria-prima é a lista acima."** (herdado) |
| Sem preço da hora | caixa atenção: **"O preço da hora ainda não foi cadastrado. Cadastre em Cadastros → Catálogo → "Uso livre (hora)" para poder encerrar e cobrar."** — "Encerrar e cobrar" `disabled` com essa frase como `aria-describedby` |
| Encerrado | "Encerrado · " + tag de pagamento + " · estoque baixado ({n} materiais)" quando houver (herdado, com a contagem) |
| Dia passado sem encerrar (D-18) | sub-título com a tag "encerrar"; o fluxo de encerrar é o mesmo |

### Folha da turma (D-03 — o protótipo não tem)

| Onde | Copy |
|---|---|
| Título | ponto `area-espaco` + "{nome da turma}" |
| Sub-título | **"Turma fixa · toda {dia da semana}, {hh:mm} às {hh:mm} · {a} alunos de {v} vagas"** (+ " · no site") |
| Dia da semana | linha só de leitura "Dia da semana: {dia}" + dica "Para mudar o dia, desative esta turma e lance outra." |
| Dica ao editar | **"Horário, vagas e público valem para as datas a partir de amanhã. A mensalidade nova vale a partir de {próximo mês} — a de {mês atual} já nasceu e não muda."** |
| Datas | **"Marcada até {dia da semana}, {dd/mm} · {n} datas daqui para frente"**; sem data futura: **"Nenhuma data marcada daqui para frente."** |
| Estender | campo "Marcar mais" [8] "semanas" + **"Marcar mais semanas"**; dica "Os alunos da turma entram nas datas novas." |
| Alunos | título **"Alunos ({n})"**; linha "{nome}" + tag "{n} a repor" quando houver; vazio: **"Nenhum aluno ainda. Os alunos entram pela ficha de cada pessoa, em Pessoas."** |
| Desativar | **"Desativar turma"** (`outline` de erro), no fim |

### Ficha da pessoa — linhas de leitura

| Onde | Copy |
|---|---|
| Sub-título | "{telefone}" ou **"sem telefone"** (herdado) |
| Quadros | "A REPOR" **{n}** "aula" / "aulas" (herdado) · "A RECEBER" **{R$}** (herdado) |
| Turmas fixas | título **"Turmas fixas"** (herdado); cada turma ativa: caixa + **"{nome} · {dia da semana} {hh:mm} · {R$}/mês, vence dia {d}"** (herdado) + link "ver turma" quando marcada; sem turma ativa no sistema: **"Nenhuma turma fixa lançada ainda."** |
| Últimas vindas | título **"Últimas vindas"** (herdado); linha "{dd/mm} · {título \| Uso livre {h} h}" + tag "veio" / "faltou" (+ "repõe") / tag de pagamento do uso livre (herdado); vazio **"Ainda não veio."** (herdado); até 8 (herdado) |

### Lote e A receber — linhas de leitura

| Onde | Copy |
|---|---|
| Cabeçalho | **"A receber pela agenda"** (herdado) + o total à direita (Corpo 600, `tabular-nums`) |
| Lote — linha | "{nome} · {turma} · {mês} · {R$}" + " (proporcional)" (herdados) |
| Lote — dica | **"Cria uma venda por mensalidade, com a parcela em aberto vencendo no dia da turma. Quem já pagou, você marca no Caixa."** (herdado do toast do protótipo) |
| Linha — mensalidade | título "{nome}"; à direita "{R$}"; sub **"Mensalidade · {turma}"** + " (proporcional)" + " · {mês} · vence dia {d}" (herdado) |
| Linha — inscrição | sub **"{título da oficina} · {dd/mm}"** (herdado) |
| Linha — experimental | sub **"Aula experimental · {turma} · {dd/mm}"** |
| Linha — uso livre | sub **"Uso livre · {h} h"** + " × {n} pessoas" + " · {dd/mm}" + " · material {R$}" (herdado) |
| Linha — venda cancelada (D-08) | + tag **"venda nº {N} cancelada"** |
| Dica do fim | **"Mensalidades, inscrições em oficina e horas de uso livre que ainda não viraram venda. Os dois botões criam a venda no Financeiro — o dinheiro só existe lá. "Recebi agora" pergunta a forma (dinheiro, pix, cartão) e cria a venda já paga, que entra no Caixa na hora. "Lançar na Venda" abre a venda preenchida para ajustar, e a parcela fica em "o que vence" do Caixa, no dia de vencimento da turma ou na data do evento. Quando o Caixa marcar "Recebi", o "pago" aparece sozinho. Devolução e cancelamento se resolvem no Caixa."** (herdado + AGE-15 "a tela diz isso") |
| Dispensadas — linha | "{nome} · {descrição}" + sub **"dispensada por {quem} em {dd/mm}"** + " · {motivo}" |
| Recebi agora — topo | **"{nome} · {descrição} · {R$}"** + **"Cria a venda já paga hoje, que entra no Caixa na hora."** |
| Recebi agora — cartão | embaixo do botão "Cartão": **"a maquininha fica com {x}%"** (a taxa de Cadastros → Taxas) |

### Números (herdado do protótipo, Apoio caixa alta nos rótulos)

| Quadro | Rótulo | Número | Sub-linha |
|---|---|---|---|
| 1 | "USO LIVRE" | **"{h} h"** (horas-pessoa) | "{n} visita" / "{n} visitas" |
| 2 | "PRESENÇA NAS AULAS" | **"{p}%"**; sem nenhuma presença marcada no mês: **"—"** (UI-D22) | "{n} falta" / "{n} faltas"; sem marcação: "nenhuma presença marcada" |
| 3 | "AULAS A REPOR" | **{n}** | "em aberto" |
| 4 (escuro) | "PESSOAS NO ESPAÇO" | **{n}** | "diferentes" |

Título do bloco: **"{mês}, até hoje"** (herdado). Segundo bloco: **"Em que dia o espaço é mais
usado"** (herdado), linhas "seg" … "dom" com "{v} h"; dica **"Horas-pessoa: cada pessoa presente
conta as horas que ficou. Serve para decidir em que dia abrir turma nova ou fechar o espaço."**
(herdado).

### Toasts

| Evento | Copy |
|---|---|
| Lançar turma | **"Turma lançada, com as próximas {N} aulas."** (o protótipo: "Turma criada, com as próximas N aulas.") + quando alguma cai em dia fechado (D-13): " {k} delas cai num dia fechado ({dd/mm}) e está marcada com "dia fechado"." |
| Lançar aula | **"Lançado na agenda."** (herdado) |
| Reservar uso livre | **"Uso livre reservado."** (herdado) |
| Fechar o dia | **"Dia {dd/mm} fechado."** |
| Colocar — reposição | **"Entrou como reposição — uma aula a repor foi usada."** (herdado) |
| Colocar — experimental | **"Entrou só nesta data (experimental). Para virar aluno fixo, é pela ficha da pessoa."** (herdado) + cobrada: " A aula de {R$} foi para "A receber"." |
| Colocar — oficina | **"Inscrito. A inscrição foi para "A receber"."** (herdado) |
| Tirar da lista | "{nome} saiu da lista." + reposição: " A aula a repor voltou para o crédito." |
| Cancelar data — turma | **"Data cancelada pelo ateliê: não conta falta para ninguém. Combine a reposição marcando uma data extra."** (herdado) + ação **"Desfazer"** |
| Cancelar data — oficina | **"Data cancelada. Quem já pagou continua no Financeiro — devolução se resolve lá."** (herdado) + ação "Desfazer" |
| Desfazer cancelamento | "A data voltou para a agenda." |
| Chegou | "Chegada marcada às {hh:mm}." |
| Encerrar | **"{h} hora cheia" / "{h} horas cheias"** + " + material" + ": {R$}." + " Estoque baixado." (herdado, com plural de verdade) |
| Entrar na turma | **"Entrou na turma. Mensalidade de {mês} proporcional: {r} de {n} aulas = {R$}."** / **"Entrou na turma: já está nas próximas aulas e a mensalidade do mês foi criada."** (herdados) |
| Sair da turma | **"Saiu da turma: sai das aulas futuras. O que já aconteceu fica."** (herdado) |
| Turma salva | "Turma salva." |
| Marcar mais semanas | "{N} datas novas marcadas, até {dd/mm}." |
| Desativar turma | "Turma desativada. As datas que já aconteceram continuam na agenda." |
| Pessoa nova | **"Pessoa cadastrada."** (forma neutra — nunca "cadastrado/cadastrada" concordando com o nome) |
| Recebi agora | **"Venda nº {N} lançada e paga em {forma}. Já está no Caixa de hoje."** + link "ver no Caixa" |
| Lançar na Venda (volta) | **"Lançado na venda nº {N}. A parcela está em "o que vence" do Caixa."** |
| Lote | **"{N} mensalidades lançadas na Venda. As parcelas estão em "o que vence" do Caixa."** / corrida: "{n} lançadas; {m} já estavam lançadas." |
| Dispensar | **"Dispensada. Ela não vai virar venda."** + ação **"Desfazer"** |
| Desfazer dispensa | "Voltou para "A receber"." |
| Tirar bloqueio | "Bloqueio de {dd/mm} tirado." |
| Cancelar reserva | "Reserva cancelada." |
| Presença, direito a repor, cobrar/incluso | **nenhum toast** — o estado muda na própria linha |

### Estados vazios

| Onde | Título (Título 20px) | Corpo | Ação |
|---|---|---|---|
| Semana — dia sem nada | — | **"nada marcado"** (herdado, Apoio `tinta-fraca`) | o "+ lançar" do dia |
| Mês sem nada | — | **"Nada marcado neste mês."** embaixo da legenda | — |
| Pessoas — ninguém cadastrado | **"Ninguém cadastrado ainda."** | "Cadastre a primeira pessoa — ela aparece também em Cadastros → Clientes." | **"+ Pessoa"** (primário só aqui; o do cabeçalho do bloco some — um terracota por tela) |
| Pessoas — busca sem resultado | — | **"Ninguém com esse nome."** (herdado) | **"Cadastrar "{busca}""** (`outline`) |
| A receber | **"Ninguém devendo."** (herdado) | "Mensalidades, inscrições e usos livres encerrados aparecem aqui até virarem venda." | — (o lote some; total "R$ 0,00") |
| Dispensadas | — | a sanfona não aparece com N = 0 | — |
| No site — nenhum evento público (D-11) | — | caixa neutra acima da prévia: **"Nenhuma aula ou oficina pública de hoje em diante — o site mostra o texto abaixo, sem calendário. Marque "Mostrar no calendário público do site" ao lançar para ela aparecer."** + a prévia do estado da 04.6 (três cartões) | — |
| Números — mês sem nada | — | quadros zerados ("0 h", "—", "0", "0") e barras "0 h"; nenhuma frase extra | — |
| Folha do evento sem inscrito | — | **"Ninguém inscrito ainda."** (herdado) | o "Colocar alguém" |
| Ficha — sem vinda | — | **"Ainda não veio."** (herdado) | — |
| Cadastros → Clientes | **"Nenhum cliente cadastrado ainda."** | "Clientes nascem aqui ou pela Agenda (Pessoas → + Pessoa) — é o mesmo cadastro." | **"Novo cliente"** |
| Início — dia sem nada | — | **"Nada marcado para hoje. O espaço está livre."** (já existe, `TEXTOS_DOS_BLOCOS.agenda.vazio`) + a faixa "Agora no espaço: 0 pessoas" (herdada) | — |
| Site — nenhum evento público, ou sem banco (D-11) | — | o estado aprovado da 04.6 (SIT-07), **sem mudança**: três cartões de texto, dois botões de WhatsApp e **"O calendário com as datas e vagas entra aqui em breve."** | — |
| Site — mês sem evento | — | **"Nada marcado neste mês ainda."** (herdado do protótipo do site) | — |
| Site — dia fechado escolhido | — | **"Fechado neste dia."** (herdado) | — |

### Erros

| Situação | Copy |
|---|---|
| Carregar a Agenda (qualquer aba) | **"Não deu para carregar a agenda. Verifique a internet e tente de novo."** + "Tentar de novo" |
| Carregar uma folha (evento, uso livre, turma, ficha, seletor de pessoa, material) | "Não deu para carregar {esta aula \| este uso livre \| esta turma \| esta ficha \| a lista de pessoas \| a lista de materiais}. Verifique a internet e tente de novo." + "Tentar de novo" — dentro da folha |
| Evento/uso/turma/pessoa que não existe mais (link velho, `?evento=`) | **"Esse lançamento não existe mais — talvez tenha sido removido em outro celular."** (toast) e a folha não abre |
| Início — bloco | **"Não deu para carregar a agenda de hoje."** (já existe) + "Tentar de novo" |
| Presença — falhou | **"Não deu para marcar a presença de {nome}. Toque de novo."** (embaixo da linha; o segmento volta ao estado anterior) |
| Lançar — nome vazio | "Dê um nome à turma." / "Dê um nome à aula ou oficina." |
| Lançar — motivo vazio | "Diga o motivo do fechamento." |
| Lançar — quem vazio | "Escolha quem vem." |
| Lançar — horário | "Diga a hora de começo e de fim." / **"O fim precisa ser depois do começo."** (herdado) |
| Lançar — valor | "Diga a mensalidade — por exemplo, 320 ou 320,50." / "Diga o preço por pessoa — por exemplo, 120 ou 37,50." |
| Lançar — números | "Vagas: um número inteiro de 1 a 999." · "Semanas: um número de 1 a 52." · "O vencimento precisa ser um dia de 1 a 28." · "Horas previstas: de 1 a 12." · "Pessoas: de 1 a 50." |
| Lançar — data | "Escolha a data." |
| Lançar — gravar falhou | **"Não deu para lançar. Nada foi gravado — verifique a internet e tente de novo."** (a folha continua aberta e preenchida) |
| Colocar — já na lista (outro celular) | "{nome} já está nesta lista — a tela foi atualizada." |
| Colocar — sem crédito (corrida) | **"{nome} não tem mais aula a repor — talvez tenha sido usada em outro celular. A tela foi atualizada."** |
| Experimental — sem escolha | "Diga se esta aula é cobrada ou gratuita." |
| Experimental — valor | "Diga o valor — por exemplo, 40 ou 37,50." |
| Tirar da lista — venda ativa (D-08, corrida) | **"Esta inscrição já virou a venda nº {N}. Para devolver, cancele a venda no Caixa."** (verbatim da D-08) |
| Uso livre — saída | **"A saída precisa ser depois da chegada."** (herdado) |
| Uso livre — já encerrado (outro celular) | "Este uso livre já foi encerrado — talvez em outro celular. A tela foi atualizada." |
| Material — item | "Escolha o material do estoque." |
| Material — quantidade | "Digite a quantidade em {unidade} — por exemplo, 2 ou 0,5." / "A quantidade precisa ser maior que zero." (frases da Fase 06) |
| Material — desativado no meio | "{material} foi desativado enquanto você registrava. Reative-o no Estoque para usar." (frase da 06.1) |
| Encerrar — gravar falhou | **"Não deu para encerrar. Nada foi gravado nem baixado — verifique a internet e tente de novo."** |
| Turma — salvar falhou | "Não deu para salvar a turma. Verifique a internet e tente de novo." |
| Pessoa — nome | "Diga o nome da pessoa." / "O nome pode ter até 160 caracteres." |
| Pessoa — telefone | "O telefone pode ter até 40 caracteres." |
| Recebi agora / Lançar na Venda — já lançado (corrida) | **"Este item já foi lançado (venda nº {N}). A tela foi atualizada."** |
| Recebi agora — falhou | "Não deu para registrar. Nenhuma venda foi criada — verifique a internet e tente de novo." |
| Lote — falhou | "Não deu para lançar as mensalidades. Nenhuma venda foi criada — verifique a internet e tente de novo." |
| Venda da Agenda — origem inválida | **"Este item da Agenda já virou a venda nº {N}."** + link "ver no Caixa" (no lugar do carrinho, pesquisa Pergunta 3) / "Não achei este item da Agenda. Volte à Agenda e toque em "Lançar na Venda" de novo." |
| Item do sistema (D-17) — tentar desativar | **"Este item é usado pela Agenda e não se desativa. Nome, preço e categoria podem mudar."** (a frase do gatilho chega à tela) |
| Ação genérica (qualquer outra) | "Não deu para {verbo}. Verifique a internet e tente de novo." |

Erro de campo aparece **embaixo do campo**, em `--color-erro`, `role="alert"`, e o foco vai ao
primeiro campo com erro — nunca como toast (o protótipo usava `toast()` para "Falta o nome.",
"Quantidade?" e "O fim precisa ser depois do começo.").

### Confirmações (`AlertDialog`)

Regra (CLAUDE.md, UI-D13): **toda remoção pede confirmação e diz o que será perdido**; o que é
desfazível **e** não perde nada grava direto, com "Desfazer" no toast.

**Cancelar esta data** — pede confirmação **só quando algo se perde**: presenças já marcadas (o
cancelamento as limpa, protótipo 352) ou inscrições de oficina ainda não lançadas (saem de "A
receber"). Sem nada disso, cancela direto com "Desfazer" no toast — é o "um toque" da D-13.
- Título: **"Cancelar a aula de {dia da semana}, {dd/mm}?"**
- Corpo turma: "Cancelada pelo ateliê não conta falta para ninguém. As {n} presenças já marcadas
  nesta data se perdem. A data fica riscada e dá para desfazer o cancelamento — mas as presenças não
  voltam."
- Corpo oficina: "A data fica riscada e sai do site. {k} inscrições ainda não lançadas saem de "A
  receber". Quem já pagou continua no Financeiro — devolução se resolve lá."
- Botões: **"Manter a data"** (`outline`) · **"Cancelar esta data"** (`outline` de erro); enquanto
  grava "Cancelando…".

**Cancelar reserva** (uso livre reservado — remove, AGE-05):
- Título: **"Cancelar a reserva de {nome} em {dd/mm}?"**
- Corpo: "A reserva sai da agenda. Nada foi cobrado nem baixado do estoque."
- Botões: **"Manter a reserva"** · **"Cancelar reserva"** (`outline` de erro).

**Tirar o bloqueio** (fechado — remove, AGE-05):
- Título: **"Tirar o bloqueio de {dd/mm}?"**
- Corpo: "O dia volta a aparecer aberto no site. O que está marcado nele não muda."
- Botões: **"Manter fechado"** · **"Tirar o bloqueio"** (`outline` de erro).

**Tirar da lista** (inscrição sem venda ativa):
- Título: **"Tirar {nome} da lista?"**
- Corpo oficina/experimental cobrada: "A inscrição sai desta data e de "A receber"." · reposição:
  "A reposição volta a ser crédito: {nome} fica com {n} aula a repor / {n} aulas a repor." ·
  experimental gratuita: "{nome} sai só desta data."
- Botões: **"Manter na lista"** · **"Tirar da lista"** (`outline` de erro).

**Tirar material** (uso livre no espaço):
- Título: **"Tirar {material} da lista?"**
- Corpo: "Ainda não saiu do estoque — some só desta lista."
- Botões: **"Manter o material"** · **"Tirar o material"** (`outline` de erro).

**Sair da turma** (desmarcar a caixa na ficha):
- Título: **"Tirar {nome} de {turma}?"**
- Corpo: "Sai das {n} aulas daqui para frente. O que já aconteceu fica, e a mensalidade de {mês}
  continua em "A receber" — dispense lá se não for cobrar."
- Botões: **"Manter na turma"** · **"Tirar da turma"** (`outline` de erro). Voltar = a caixa volta a
  ficar marcada.

**Desativar turma** (D-03):
- Título: **"Desativar {turma}?"**
- Corpo: "As {n} datas daqui para frente saem da agenda e do site, junto com as inscrições delas
  ({r} reposições marcadas voltam a ser crédito). O que já aconteceu fica, e as mensalidades já
  nascidas continuam em "A receber". Não dá para reativar." — sem reposição marcada, omite o
  parêntese.
- Botões: **"Manter turma"** · **"Desativar turma"** (`outline` de erro); enquanto grava
  "Desativando…".

**Dispensar** (D-09 — não é remoção, nunca apaga, mas tira de "A receber"):
- Título: **"Dispensar {a mensalidade \| a inscrição} de {nome}?"**
- Corpo: "Ela sai de "A receber" e não vira venda. Fica registrado quem dispensou e quando, e dá para
  desfazer em "Dispensadas", no fim da lista." + o campo "Motivo (opcional)".
- Botões: **"Voltar"** (`outline`) · **"Dispensar a cobrança"** (primário).

Nenhuma outra ação apaga dado: presença e direito a repor se desmarcam tocando de novo; "Recebi
agora", "Lançar na Venda" e o lote criam venda que se cancela **no Caixa** (D-08 a devolve a "A
receber" sozinha); encerrar o uso livre grava baixa no Estoque, imutável (EST-06); turma, pessoa,
uso encerrado e evento cancelado **nunca se apagam**.

### Vocabulário

- **Agenda** é o módulo. Os quatro tipos: **turma fixa**, **aula ou oficina avulsa** (no cartão e no
  site, só **"oficina"**), **uso livre**, **fechado** ("dia fechado", "bloqueio" só no botão "Tirar o
  bloqueio").
- Uma **data** de turma é o evento de um dia; **aula** é o que acontece nele. "Inscrição" é estar na
  lista de uma data; **reposição**, **aula a repor**, **experimental** (D-07).
- **Pessoas** (na Agenda) e **Clientes** (em Cadastros) são o mesmo cadastro (D-01) — a tela de
  Pessoas diz isso. Contagem de gente é sempre **"pessoa/pessoas"**, nunca "lugar/lugares" (decisão
  do dono de 29/09: o espaço não tem capacidade fixa).
- Documento do Financeiro: **"venda nº {N}"**.
- **Nunca aparecem:** "aluna" (o modelo antigo), "matrícula", "status", "slot", "lotação",
  "capacidade", "booking", "check-in", "crédito" sozinho (é "aula a repor"), "Erro 500".

---

## Onde o protótipo não vale mais

Cada linha é uma mudança de interface **obrigada** por decisão do dono, regra de dado ou regra do
projeto — não preferência. As que são escolha desta UI-SPEC apontam para a UI-D.

| No protótipo | Na plataforma | Por quê |
|---|---|---|
| Página única com `localStorage` | `/gestao/agenda?aba=…` com Postgres; folhas com estado na URL | Briefing; UI-D8 |
| Abas como pílulas terracota | Abas neutras (`abas-financeiro.tsx`), 3 + 2 abaixo de 768px | Um terracota por tela; UI-D1 |
| "Semana · Mês" com o marcado em verde | Alternador neutro | O verde é "veio"/"pago" nesta tela; UI-D2 |
| "Lançar na Venda" terracota em cada linha de "A receber" | `outline`; o terracota é o lote | Um terracota por tela; UI-D3 |
| "Recebi agora" marca "pago" na hora (toast "Na plataforma: …") | Folha com as três formas; cada uma cria a venda paga hoje | §5; UI-D4 |
| "Lançar na Venda" marca "lançado" (toast "Na plataforma: abre a Venda…") | Abre a tela de Venda do Financeiro preenchida, com a faixa "Da Agenda" | §5, pesquisa Pergunta 3 (mecanismo B); UI-D26 |
| Mensalidades vêm dos dados de exemplo | Nascem ao abrir a tela; nada muda na interface | D-02 |
| Colocar alguém por `select` com todas as pessoas | Seletor com busca, "Tem aula a repor" primeiro, "Cadastrar "{nome}"" no fim | AGE-10; UI-D5 |
| Experimental entra sem cobrança | Pergunta "Cobrar · Gratuita"; "Cobrar" sugere o valor de uma aula, editável, e vai a "A receber" | D-07; UI-D6 |
| "tirar da lista" sempre disponível na oficina | Some quando a inscrição virou venda não cancelada; no lugar, a frase da D-08 | D-08; UI-D14 |
| Nenhum jeito de tirar uma cobrança de "A receber" | "Dispensar" + "Dispensadas" com "Desfazer" | D-09; UI-D15 |
| Cobrança cuja venda foi cancelada some | Volta a "A receber" sozinha, com a tag "venda nº {N} cancelada" | D-08 |
| Folha do bloqueio "avisa se alguém lançar algo por cima", sem aviso nenhum | Aviso que não bloqueia na folha Lançar; tag "dia fechado" e caixa na data de turma; cancelar com um toque | D-13 |
| Material: "cobrar" para qualquer item | "Cobrar" só para item com preço de venda; sem preço, só "Incluso" e a dica | D-14 |
| Material dá baixa com destino "uso do espaço" | Destino **"Uso livre do espaço"** (área Espaço), com vínculo ao uso | D-06 |
| Seletor de material com 4 itens inventados e "Cobrar?" em `select` | O seletor "Qual material?" do Estoque; "Cobrar · Incluso" segmentado | Fase 06; UI-D5 |
| "Pessoa nova" sem conferir nome | Aviso de homônimo com "usar a que já existe / criar outra" | D-16 |
| Nenhuma tela de turma | Folha da turma: editar, "Marcar mais semanas", desativar | D-03 |
| Dica de Pessoas: "a mesma que compra na loja e pede orçamento" | "É o cadastro de clientes da AMASSA — o mesmo de Cadastros → Clientes. As vendas que a Agenda cria ficam ligadas à pessoa." | D-01 (Venda manual, Orçamento e Produção continuam com texto livre — a frase antiga seria falsa) |
| Lançar com valores pré-preenchidos (mensalidade "300", preço "120", horário 14:00–16:00) | Valor e preço **vazios**; horário vazio; vagas 8, semanas 8, vencimento 10, horas 2, pessoas 1 mantidos | AGE-17 ("nenhum preço no código") |
| Botão "Lançar" para os quatro tipos | "Lançar turma" · "Lançar aula" · "Reservar uso livre" · "Fechar o dia" | UI-D9 |
| Turma marcada sempre a partir de hoje | Campo "Primeira aula a partir de" (padrão hoje) | UI-D10 |
| Dica da turma: "Os alunos entram … pela própria aula" | "Os alunos entram depois, pela ficha de cada um, em Pessoas." | O próprio protótipo diz que colocar alguém na aula é **experimental** (toast da linha 350) e que aluno fixo é pela ficha |
| Uso livre conta "lugar/lugares" | "pessoa/pessoas" | Decisão do dono de 29/09 (`lib/agenda/espaco.ts`) |
| Linha "Horas cheias: {h} h × R$ = …" sem as pessoas | "{h} h × {n} pessoas × {R$ hora} = {R$}" | AGE-13 (a conta multiplica pelas pessoas uma vez) |
| "Saiu às" preenchido com a saída prevista | Hora de agora (uso de hoje) / saída prevista (dia passado) | UI-D7 |
| "Chegou" grava sem dizer a hora | Campo "Chegou às" com a hora da reserva, editável | AGE-13 ("proposta: a da reserva, editável") |
| Uso livre de ontem "no espaço" conta para sempre | Tag "encerrar" na semana; "Agora no espaço" só conta os de hoje | D-18 |
| Cancelar reserva e tirar bloqueio removem direto | `AlertDialog` dizendo o que se perde | AGE-05, CLAUDE.md; UI-D13 |
| Cancelar data sempre direto, limpando presenças | Direto (com "Desfazer") quando nada se perde; confirmação quando apaga presença ou tira inscrição de "A receber" | CLAUDE.md + D-13 ("um toque"); UI-D13 |
| Sair da turma desmarcando a caixa, sem perguntar | Confirmação dizendo as aulas futuras que saem | CLAUDE.md; UI-D13 |
| "tirar" material e "tirar da lista" sem perguntar | Confirmação | CLAUDE.md; UI-D13 |
| "Veio / Faltou" marcado só pela cor (verde/vermelho) | + ícone `Check`/`X` de 16px e peso 600 no marcado; grava na hora, otimista | WCAG 1.4.1; UI-D11 |
| Cartão de evento sem o tipo escrito | Sub-linha começa pelo tipo ("Turma fixa · até 21:00") | Cor nunca é a única pista; UI-D12 |
| Ponto ouro sem contorno | Contorno de 1px `tinta-fraca` | 2,94:1 reprova como objeto gráfico; UI-D12 |
| Dias fora do mês com `opacity:.4` | Fundo `superficie-2`, número `tinta-fraca` | Contraste do número |
| "Lista cheia" em vermelho (`.falta`) | Caixa âmbar (atenção) | É aviso que não bloqueia (AGE-11); UI-D16 |
| "tirar"/"tirar da lista" em terracota | `tinta-media` sublinhado | Um terracota por folha |
| Tags 11,5px, dica 13px, sub-linha 12,5px, segmentado 13px | Apoio 14px | Typography |
| Alvos de 28–38px (`.vermini`, `.btn.mini`, `.pil`, "+ lançar") | 44px | Acessibilidade |
| Erros por `toast()` ("Falta o nome.", "Quantidade?") | Erro embaixo do campo, frase completa | UI-D9 da 06 |
| Folha até 88% da altura no celular | Folha de tela toda | Padrão do projeto |
| Aviso "protótipo · hoje é sexta, 18/12/2026 · dados inventados", "Voltar aos dados de exemplo" | Removidos — andaime do protótipo | — |
| Barra de abas fixa própria (`nav.abas`, CSS não usado) | A casca da plataforma (Início · Financeiro · Produção · Agenda) | Fase 04.6 |
| "No site": botões de WhatsApp como `<span>` | Os botões reais do componente do site | UI-D18 |
| "No site": cartões em moldura de 420px | A seção do site na largura em que a gestão está | UI-D18 |
| Site: bloco de uso livre com "R$ 35 por hora" | Sem preço: o texto `agLivre` da 04.6 ("Consulte o valor pelo WhatsApp") | D-10 (mantém a D-18 da 04.6 só no uso livre) |
| Site: cartão de turma em "Próximas" conta a lista da próxima data | Vagas da turma − alunos ativos; no calendário, a lista de cada data | D-12 |
| Site sem evento público: calendário vazio | O estado aprovado da 04.6 (três cartões de texto) | D-11 |
| Site: pontos e cartões sobre `--fundo`, âmbar em hex, ponto "esgotado" na cor da borda | Cartões sobre `site-papel`, `site-ambar` por referência, ponto vazado com contorno | Contraste (S1–S8); UI-D17 |
| Início (04.6): aula com borda terracota, uso livre com borda `espaco`, "N de M lugares" | Cores de tipo da Agenda; "{n} de {vagas} inscritos" e "{n} pessoas" | Uma cor por tipo no sistema todo; decisão de 29/09; UI-D19 |

---

## Layout & Navigation Contract

### Rotas

| Rota | Conteúdo |
|---|---|
| `/gestao/agenda` | `CabecalhoPagina` "Agenda", abas, conteúdo da aba. Parâmetros (normalizados por `lib/agenda/abas.ts`, valor desconhecido → padrão): `aba` (`agenda`\|`pessoas`\|`receber`\|`site`\|`numeros`; padrão `agenda`), `vista` (`semana`\|`mes`; padrão `semana`), `semana` (AAAA-MM-DD, normalizada para a segunda-feira; padrão a de hoje), `mes` (AAAA-MM; padrão o de hoje), `busca` (Pessoas), `aviso`/`documento` (volta da Venda) |
| `/gestao/agenda?…&evento={id}` · `&uso={id}` · `&turma={id}` · `&pessoa={id}` · `&lancar=1[&dia=AAAA-MM-DD]` | A mesma página com a folha aberta (abrir/fechar por `pushState`, molde de `?nova=1` da 06.1) — o "voltar" do Android fecha a folha, e o Início abre a folha do evento direto (UI-D8) |
| `/gestao/financeiro?aba=venda&origem={mensalidade\|inscricao\|uso_livre}:{id}` | A Venda do Financeiro preenchida pela Agenda (pesquisa Pergunta 3, mecanismo B; UI-D26) |
| `/gestao/cadastros?sub=clientes` | Cadastros → Clientes (D-01) |
| `/` (`#agenda`) | O calendário público (AGE-18), ISR — sem rota nova |

**Menu:** nada muda — a Agenda já está na barra de baixo (Início · Financeiro · Produção · Agenda) e
na lateral, com o ícone `CalendarDays`.

### Página `/gestao/agenda`

De cima para baixo:

1. **`CabecalhoPagina` "Agenda"**, sem filhos (o "+ Lançar na agenda" mora na aba Agenda, junto da
   navegação — herdado).
2. **Abas** — `role="tablist"`, `aria-label="Partes da Agenda"`, molde visual e estrutural de
   `abas-financeiro.tsx`/`sub-abas-cadastros.tsx` (`mx-6 md:mx-8`, `bg-muted p-1 rounded-md`, aba
   marcada `bg-background font-semibold shadow-sm`, `<Link>` com `?aba=`, `aria-selected`), 44px, 16px
   abaixo do cabeçalho. **Abaixo de 768px:** 3 + 2 com o espaçador `basis-full` (Agenda · Pessoas · A
   receber | No site · Números); **a partir de 768px:** uma fileira, `md:max-w-xl` (UI-D1).
3. **Conteúdo da aba**, `px-6 md:px-8`, 24px abaixo das abas, **`max-w-3xl`** (768px) no desktop,
   alinhado à esquerda (UI-D28) — exceto "No site", que vai até `max-w-[1080px]` (a largura do site).

### Aba Agenda — Semana (padrão)

1. **Barra de navegação** (`flex-wrap`, gap 8px, `items-center`): "‹" (44×44, `outline`) · título
   (Título 20px, `whitespace-nowrap`, `tabular-nums`: **"{dd/mm} a {dd/mm}"**; semana que cruza o ano:
   "{dd/mm/aaaa} a {dd/mm/aaaa}") · "›" — e, à direita (desce para a linha de baixo a 320px), o
   alternador **"Semana · Mês"** (dois botões 44px, `role="tablist"`, molde de
   `alternador-vista.tsx` da 06.1).
2. **Fileira de ação** (16px abaixo, gap 8px): **"+ Lançar na agenda"** (primário, `flex-1`, 52px) ·
   **"Hoje"** (`outline`, 52px). "Hoje" leva à semana de hoje e **rola até o cabeçalho de hoje**.
3. **Sete grupos de dia**, segunda → domingo (herdado), gap 16px. Cada grupo:
   - **Cabeçalho** (`h3`, Apoio 600 caixa alta, tracking 0.06em, `tinta-media`; hoje: `acento`):
     **"{dia da semana} · {dd/mm}"** + " · hoje" (herdado) à esquerda; **"+ lançar"** à direita (44px,
     Apoio 600 `acento`, abre a folha Lançar com a data do dia).
   - **Cartões** (ordem: fechado primeiro, depois por início, depois por título): `<button>` de
     largura total, `min-h-[64px]`, fundo `superficie`, borda 1px `borda`, **borda esquerda 4px** da
     cor do tipo, `rounded-md`, padding 8px × 16px, gap 8px entre cartões. Conteúdo: "Cartão de
     evento" do Copywriting. `hover:bg-superficie-2` só no desktop. Tocar abre a folha do evento /
     uso livre / fechado.
   - Dia vazio: **"nada marcado"** (Apoio `tinta-fraca`, padding 4px 0 8px).
4. Ao abrir a aba sem `semana` na URL, a página **rola até hoje** (instantâneo — sem rolagem suave
   quando `prefers-reduced-motion`).

### Aba Agenda — Mês

1. A mesma barra de navegação (título **"{mês} de {aaaa}"**, "‹ ›" = mês anterior/próximo) e a mesma
   fileira de ação.
2. **Grade** num `.bloco` (`superficie`, borda, `rounded-lg`, padding 16px): cabeçalho
   "seg ter qua qui sex sáb dom" (Apoio 600 `tinta-fraca`, centrado); 7 colunas, gap 4px; 5 ou 6
   linhas (corta a 6ª quando ela é toda fora do mês — herdado). **Célula** = `<button>`,
   `min-h-[52px]`, `rounded-sm`, borda 1px `borda`, fundo `superficie`, coluna centrada, gap 4px:
   número do dia (Corpo, `tabular-nums`) + até **6 pontos** de 8px (`flex-wrap`, gap 4px, centrados;
   ponto ouro com contorno). Fora do mês: fundo `superficie-2`, número `tinta-fraca`. Hoje: borda 2px
   `acento`. Dia fechado: o ponto `area-geral` vem primeiro. Cancelados não têm ponto (herdado).
   `aria-label` **"{dia da semana}, {d} de {mês}: {resumo}"** — resumo: "nada marcado" / "1 turma
   fixa, 2 oficinas, 1 uso livre" / "dia fechado" (+ " · hoje").
3. **Legenda** (Apoio `tinta-media`, `flex-wrap`, gap 8px × 16px): os quatro pontos com o nome
   (herdado: "Turma fixa" · "Aula ou oficina avulsa" · "Uso livre" · "Fechado / bloqueio").
4. Dica **"Toque num dia para abrir a semana dele."** (herdada). Tocar → vista Semana daquela semana,
   rolada até o dia tocado.

### Folha "Lançar na agenda" (diálogo)

Aberta por "+ Lançar na agenda" (data = hoje) ou "+ lançar" de um dia (data = o dia). Cabeçalho
**"Lançar na agenda"** (Título) + fechar. Área rolável, gap 16px:
1. **Pílulas de tipo** (`role="radiogroup"`, `classeDaPilula`, 44px, `flex-wrap`, gap 8px). Padrão:
   **"Aula ou oficina avulsa"** (herdado); a última escolha vale enquanto a página estiver aberta
   (herdado).
2. **Campos** do tipo (Copywriting "Rótulos e dicas"), em grade `flex-wrap` (cada campo `basis-40`
   flexível; "Nome"/"Motivo"/"Quem" em largura total), gap 16px:
   - Turma: Nome · Dia da semana · Primeira aula a partir de · Começa · Termina · Vagas · Mensalidade
     (R$) · Marcar quantas semanas · Mensalidade vence dia · caixa "Mostrar no calendário público do
     site".
   - Aula: Nome · Data · Começa · Termina · Vagas · Preço por pessoa (R$) · caixa público.
   - Uso livre: Quem (seletor de pessoa, UI-D5) · Data · Chega às · Horas previstas · Pessoas.
   - Fechado: Data · Motivo.
3. **Aviso de dia fechado** (D-13; caixa atenção, `role="status"`), quando a data (ou, na turma,
   alguma das datas que vão ser marcadas) é um dia fechado: **"Este dia está fechado: {motivo}. Dá
   para lançar mesmo assim."** / turma: **"{k} das datas cai em dia fechado ({dd/mm}, …). Elas são
   marcadas mesmo assim, com a etiqueta "dia fechado"."**. No tipo Fechado, quando o dia já tem algo:
   **"Este dia já tem {1 lançamento | n lançamentos}. {Ele não é cancelado sozinho | Eles não são cancelados sozinhos} — as datas de turma aparecem
   com "dia fechado" para você cancelar com um toque."** O botão de gravar **não** muda.
4. **Dica do tipo** (Apoio `tinta-fraca`):
   - Turma: **"Cria a turma e já marca as próximas semanas (você escolhe quantas; dá para estender
     depois, na folha da turma). Os alunos entram depois, pela ficha de cada um, em Pessoas."**
   - Aula: **"Uma data, com vagas e preço por pessoa. Material incluso."** (herdada)
   - Uso livre: **"Hora cheia a {R$ hora}. Só vocês lançam — o cliente combina pelo WhatsApp."**
     (herdada; o preço vem do item "Uso livre (hora)"); sem preço cadastrado: **"O preço da hora ainda
     não foi cadastrado (Cadastros → Catálogo → "Uso livre (hora)"). Dá para reservar; para encerrar e
     cobrar, ele precisa estar lá."**
   - Fechado: **"Fecha o dia: feriado, viagem, queima grande. No site o dia aparece só como
     "fechado", sem o motivo."**
5. **Rodapé preso:** **"Voltar"** (`outline`) · o primário do tipo (UI-D9).

Ao gravar: fecha, a semana vai para a semana da data lançada (herdado) e o toast aparece. Foco
inicial: o primeiro campo **só a partir de 768px**; no celular, nenhum (UI-D13 da 06 — o teclado não
sobe sozinho tapando a folha).

### Folha do evento — turma ou avulsa (diálogo)

Cabeçalho: ponto 8px do tipo (`aria-hidden`) + título (Título) + fechar. Área rolável:
1. Sub-título (Apoio `tinta-fraca`) e, na turma, o link **"Abrir a turma"** (44px).
2. Caixa de dia fechado (D-13), quando for o caso.
3. Cabeçalho **"Quem vem · {n} de {vagas}"** (`h3`, Apoio 600 caixa alta `tinta-media`) + tag "no
   site".
4. **Lista de inscritos** — cada linha (`.pes`: grade `1fr auto`, padding 8px 0, divisória `borda`):
   - nome (Corpo 600, quebra livre) + tags (`flex-wrap`, gap 4px);
   - à direita, o segmentado **Veio · Faltou** (dois botões 44px, `px-4`, borda `borda-forte`,
     `rounded-sm`; marcado: Veio `sucesso-fundo`/`sucesso` + ícone `Check` 16px, Faltou
     `erro-fundo`/`erro` + ícone `X` 16px, os dois 600; não marcado: `superficie`, `tinta-media`,
     400). Grava na hora, **otimista** (UI-D11): o estado muda no toque; enquanto grava, `aria-busy`
     no grupo; falhou → volta ao anterior e a frase de erro aparece embaixo da linha. Toques em
     outras linhas **não** esperam;
   - linha de baixo (coluna inteira): turma + "Faltou" + não é reposição → caixa **"tem direito a
     repor esta aula"** (`Checkbox` 20px dentro de `label` de 44px; grava na hora; sair de "Faltou"
     desmarca — herdado); oficina, reposição ou experimental → **"tirar da lista"** (44px) ou, com venda
     ativa, a frase da D-08 (UI-D14).
   - Ordem da lista: alunos, reposições, experimentais, por nome.
5. **"Colocar alguém"** (só em data não cancelada): o seletor de pessoa (UI-D5) e, escolhida a
   pessoa, a faixa de confirmação (Copywriting "Seletor de pessoa") + **"Colocar na lista"**
   (`outline`). Lista cheia: a caixa âmbar acima do botão (não bloqueia).
6. Dica do fim (turma ou oficina).
7. **Rodapé preso** (`justify-between`): **"Cancelar esta data"** / **"Desfazer cancelamento"** à
   esquerda · **"Pronto"** (primário) à direita. Em data de turma que cai em dia fechado (D-13), o
   "Cancelar esta data" fica **só** na caixa de aviso do topo e o rodapé mostra apenas "Pronto".

Data **cancelada**: lista só de leitura (sem Veio/Faltou, sem colocar, sem tirar), sub-título com
"cancelada".

**Orçamento de toques — Valor central (presença da turma inteira no celular, de pé):**

| Toque | Onde | O que acontece |
|---|---|---|
| 1 | Cartão da aula na semana (ou a linha da aula no Início — UI-D19) | Abre a folha com a lista |
| 2..N+1 | "Veio" ou "Faltou" de cada pessoa | Grava na hora, um toque por pessoa, sem confirmação, sem esperar a anterior |
| (opcional) | "tem direito a repor esta aula" | Só para quem faltou |
| N+2 | "Pronto" ou fechar | Volta à semana; a tag "marcar presença" some quando ninguém ficou sem marcação |

Uma turma de 6 = 8 toques, sem teclado. A conferência "confortável de pé no celular" é humana, no fim
da fase.

### Folha do uso livre (diálogo)

Cabeçalho: ponto `area-loja` + **"Uso livre · {nome}"** + fechar. Área rolável, gap 16px:
1. Sub-título + tag de estado.
2. **Conta** (`.lista-simples`: linhas `justify-between`, Corpo, divisória): Pessoas · Horas cheias ·
   Material cobrado (se houver) · **Valor** (600). `tabular-nums`.
3. Por estado:
   - **Reservado:** campo **"Chegou às"** (hora da reserva) + dica do reservado. Rodapé: **"Cancelar
     reserva"** (`outline` de erro) · **"Chegou"** (primário).
   - **No espaço:** campo "Chegou às" (editável) · **"Material usado"** (`h3` Apoio 600 caixa alta): a
     lista e, embaixo, a linha de acrescentar — "Item do estoque" (botão largo 52px "Escolher material"
     que abre o seletor "Qual material?" da 06; escolhido, a caixa "escolhido" da 06) · "Quanto" (16px,
     `w-24`) · "Cobrar · Incluso" (segmentado 52px) · **"+ Material"** (`outline`) — a dica do material
     · campo **"Saiu às"** · a dica de hora cheia. Rodapé: **"Encerrar e cobrar"** (primário).
   - **Encerrado:** a linha "Encerrado · …" + a lista de material só de leitura. Rodapé: a receber →
     **"Recebi agora"** (`outline`) · **"Lançar na Venda"** (primário); lançado/pago → **"Voltar à agenda"**
     (`outline`) e a tag de pagamento.
   - Dia passado sem encerrar (D-18): igual a "No espaço"; "Saiu às" vem com a saída prevista.

**Orçamento de toques — encerrar:** cartão (1) → "Encerrar e cobrar" (2) quando não houve material
(o "Saiu às" já vem com a hora de agora — UI-D7). Com material: + "Escolher material" → item →
"Quanto" → "+ Material" por linha.

### Folha do fechado (diálogo)

Cabeçalho: ponto `area-geral` + motivo + fechar. Sub-título "Fechado · {dia da semana}, {dd/mm} · o
dia todo". Dica **"Dia fechado: aparece como "fechado" no site, sem o motivo. Quem lançar algo neste
dia vê um aviso."** (herdada, completada). Rodapé: **"Tirar o bloqueio"** (`outline` de erro) ·
**"Voltar à agenda"** (`outline`).

### Folha da turma (diálogo — D-03)

Aberta por "Abrir a turma" (folha da data) ou "ver turma" (ficha). Abre **no lugar** da folha de
onde veio (um diálogo por vez); quando veio de uma data, o cabeçalho tem o link **"Voltar à data"**
(UI-D25). Área rolável, gap 16px:
1. Sub-título (Copywriting).
2. **Editar:** Nome · (Dia da semana — só leitura, com a dica) · Começa · Termina · Vagas · Mensalidade
   (R$) · Mensalidade vence dia · caixa "Mostrar no calendário público do site" + a dica ao editar.
3. **Datas:** a linha "Marcada até…" + "Marcar mais [ 8 ] semanas" (`inputmode="numeric"`, 1 a 52,
   `w-20`) + **"Marcar mais semanas"** (`outline`) + dica.
4. **Alunos ({n}):** lista só de leitura (nome + tag "a repor").
5. **"Desativar turma"** (`outline` de erro), alinhado à esquerda, 24px abaixo.
6. **Rodapé preso:** **"Voltar"** (`outline`) · **"Salvar turma"** (primário, `disabled` sem mudança).

### Aba Pessoas

Bloco (`superficie`, borda, `rounded-lg`, padding 16px, gap 16px):
1. Cabeçalho: **"Pessoas"** (Título) · **"+ Pessoa"** (`outline`, 44px).
2. **Busca** (`type="search"`, 16px, 44px, largura total) — atualiza a lista enquanto digita (espera
   300 ms), sem acento, por pedaço do nome.
3. **Lista** em ordem alfabética, **50 por vez** + "Mostrar mais 50" (UI-D23). Linha (`.pes`): nome
   (Corpo 600) + tags "{n} a repor" (atenção) e "{n} a receber" (erro) · à direita **"Abrir"**
   (`outline`, 44px) · sub-linha (Apoio `tinta-fraca`, coluna inteira): **"{telefone} · {turma}
   ({dia abreviado}) · {turma} ({dia})"** / "sem turma fixa" (herdado + telefone, D-16).
4. Dica do fim (Copywriting, D-01).

### Ficha da pessoa (diálogo)

Cabeçalho: **"{nome}"** (Título) + **"Editar"** (`outline`, 44px — abre o formulário de pessoa no
lugar, UI-D24) + fechar. Área rolável, gap 16px: sub-título (telefone) · dois quadros lado a lado
(`grid-cols-2`, gap 8px; rótulo Apoio 600 caixa alta, número Display, sub Apoio) · **"Turmas fixas"**
(caixas de 44px, uma por turma **ativa**; marcar = entrar, na hora, com o toast do proporcional;
desmarcar = confirmação "Sair da turma") · **"Últimas vindas"** (`.lista-simples`, até 8). Rodapé:
**"Pronto"** (primário).

### Pessoa nova / editar pessoa (diálogo — o mesmo formulário de Cadastros → Clientes)

Título **"Pessoa nova"** (Agenda) / **"Novo cliente"** (Cadastros) / **"Editar {nome}"**. Campos Nome e
Telefone (opcional). Rodapé: "Voltar" · **"Salvar pessoa"** (Cadastros: **"Salvar cliente"**).
**Homônimo (D-16):** ao tocar em salvar, se já existe o mesmo nome (sem acento e sem maiúscula), a
folha **não fecha** e mostra a caixa atenção (`role="status"`) **"Já existe {nome} · {telefone \| sem
telefone}. É a mesma pessoa?"** — uma linha por homônimo, cada uma com **"Usar {nome} que já existe"**
— e embaixo **"Criar outra pessoa"**. "Usar" na aba Pessoas abre a ficha dela; no seletor de pessoa,
escolhe-a. Editar com nome de homônimo: só o aviso, salva com "Salvar mesmo assim".

### Aba A receber

Bloco (padding 16px, gap 16px):
1. Cabeçalho: **"A receber pela agenda"** (Título) + total à direita (Corpo 600).
2. **Sanfona do lote** (`<details open>`, borda tracejada `borda-forte`, `rounded-md`, padding 8px ×
   16px — herdado de `details.est`), só quando há mensalidade a receber: `summary` (Apoio 600, 44px)
   · lista (`ul`, Apoio) · **"Lançar estas {N} na Venda · {R$}"** (primário) à direita · a dica do
   lote.
3. **Linhas** (`.conta`: grade `1fr auto`, padding 8px 0, divisória), em ordem de vencimento/data
   (herdado): nome (Corpo 600) · valor (Corpo 600) · sub-linha + tags (Apoio, coluna inteira) ·
   fileira de ações (coluna inteira, `flex-wrap`, gap 8px): **"Dispensar a cobrança"** à esquerda (só mensalidade
   e inscrição) e, à direita, **"Recebi agora"** · **"Lançar na Venda"** (`outline`, 44px). A 320px os
   dois da direita descem um embaixo do outro, nunca rolam de lado.
4. **"Dispensadas ({N})"** (`<details>` fechado, só com N > 0), no fim: linhas com "Desfazer"; 20 por
   vez + "Mostrar mais 20", mais recentes primeiro.
5. Dica do fim (Copywriting).

**Folha "Recebi agora"** (diálogo pequeno — `md:max-w-sm`; no celular, a folha de tela toda do
padrão): título **"Recebi agora"** · o topo (Copywriting) · **três botões de 52px empilhados**,
largura total: "Dinheiro" · "Pix" · "Cartão" (+ linha da taxa embaixo do Cartão) · "Voltar". Tocar uma
forma grava (UI-D4). **Orçamento:** "Recebi agora" (1) → forma (2).

**Volta da Venda:** `?aba=receber&aviso=lancado&documento={id}` mostra o toast "Lançado na venda nº
{N}…" uma vez e limpa os parâmetros (`replaceState`).

### Aba No site

1. Dica (Apoio `tinta-fraca`): **"Assim a agenda aparece no site. Só aulas e oficinas marcadas como
   públicas, sem nome de ninguém e sem reserva pela internet. O uso livre é um texto com "consulte
   disponibilidade". O site se atualiza sozinho poucos minutos depois de cada mudança feita aqui."**
   (herdada + a revalidação).
2. Com evento público: a **moldura do site** (fundo `site-papel`, borda `site-borda`, `rounded-[14px]`,
   padding 16px / 24px a partir de 768px, `max-w-[1080px]`) com o `h2` "Agenda do ateliê"
   (Fraunces, 28px) e o **mesmo componente** do calendário público (abaixo), lido ao vivo, sem cache.
3. Sem evento público (D-11): a caixa neutra do Copywriting + a prévia do estado da 04.6 (o
   `AulasEOficinas` dentro da moldura).

### Aba Números

`.bloco` 1: título **"{mês}, até hoje"** · quatro quadros (`grid`, **2 × 2 abaixo de 640px**, 4
colunas a partir de 640px, gap 8px / 16px): rótulo Apoio 600 caixa alta `tinta-fraca`, número
Display, sub Apoio `tinta-fraca`; o quarto escuro (Color). Não clicáveis.
`.bloco` 2 (24px abaixo): título · sete linhas (grade `44px 1fr auto`, gap 8px, Apoio): "seg" … "dom"
· trilho `superficie-2` de 16px `rounded-sm` com a barra `area-espaco` (`aria-hidden`) · "{v} h"
(`tabular-nums`) · dica.

### Bloco "Agenda de hoje" do Início (D-05, D-18)

O envelope de hoje (`BlocoDoInicio`, link "abrir agenda"), com o `try`/`catch` próprio e `EstadoErro`
+ `TentarDeNovo` (molde de `bloco-producao.tsx`); o esqueleto já está no `Suspense` da página.
- **"Agora no espaço"** — a faixa que já existe (`acento-fundo`, Apoio), **sempre visível**, com
  `ocupacaoDoEspaco(n)` ("0 pessoas" / "1 pessoa" / "{n} pessoas") pela regra da D-05/D-18.
- **Linhas do dia** — até **6** (UI-D19), fechado primeiro, depois por início. Cada linha é um
  `<Link>` para `/gestao/agenda?semana={segunda}&{evento|uso}={id}` (abre a folha), `min-h-[44px]`,
  borda esquerda 4px da cor do tipo, padding 8px 0 8px 16px, divisória, grade `64px 1fr`: hora de
  início (Apoio 600 `tabular-nums`) e embaixo o fim (Apoio `tinta-fraca`) · título (Corpo 600,
  `line-clamp-1`) e embaixo a sub-linha (Apoio `tinta-fraca`):
  - turma/aula: **"{n} de {vagas} inscritos"** (+ tag "marcar presença" quando já passou do início e
    há alguém sem marcação);
  - uso livre: **"Uso livre · {nome}"** / **"{n} pessoas · reservado \| no espaço \| encerrado"**;
  - fechado: **"Fechado · {motivo}"** / **"o dia todo"** (a gestão é privada — o motivo aparece);
  - cancelada: título riscado `tinta-fraca` + tag "cancelada".
- Mais de 6: **"e mais {N}"** (link `acento`) → a semana de hoje.
- Vazio: a frase que já existe (+ a faixa com "0 pessoas").

### Cadastros → Clientes (D-01) e Catálogo (D-17)

- **Sub-aba "Clientes"** — terceira pílula da primeira fileira (Catálogo · Categorias · **Clientes** |
  Contas fixas · Taxas · Parâmetros), a mesma técnica de quebra; a partir de 768px uma fileira com
  `md:max-w-xl` (UI-D20). `?sub=clientes` em `subDaUrl`.
- Lista: cabeçalho com **"Novo cliente"** (primário) · busca igual à de Pessoas · linhas (padding 16px 0,
  divisória): nome (Corpo) · telefone (Apoio `tinta-fraca`) · **"Editar"** (`outline` 44px); 50 por vez
  + "Mostrar mais 50". Dica: **"É o mesmo cadastro das Pessoas da Agenda. As vendas que a Agenda cria
  ficam ligadas ao cliente; Venda manual, Orçamento e Produção ainda usam o nome escrito à mão."**
  Nenhum "desativar" e nenhum "apagar" (pessoa não se apaga — pesquisa, `revoke delete`).
- **Catálogo:** os três itens do sistema ("Mensalidade", "Inscrição em oficina", "Uso livre (hora)")
  ganham o chip neutro **"do sistema"**; no diálogo de editar, o "Desativar" e a caixa "Aparece na
  Venda" **não aparecem** e no lugar fica a linha (Apoio `tinta-fraca`) **"Usado pela Agenda — não se
  desativa nem sai da Venda. Nome, preço e categoria podem mudar."** "Mensalidade" e "Inscrição em
  oficina" mostram "valor na hora" (o que o Catálogo já mostra para preço nulo).

### Venda aberta pela Agenda (religamento do Financeiro — UI-D26)

Na tela de Venda com `origem`:
- **Faixa "Da Agenda"** no topo do painel (fundo `acento-fundo`, `rounded-md`, padding 8px × 16px,
  Apoio, `tinta`): **"Da Agenda · {descrição} · {nome}"** + link **"Voltar à Agenda"** (sem lançar).
  Quando havia uma venda em montagem: segunda linha **"A venda que estava em montagem continua
  guardada — ela volta quando você abrir a Venda de novo."**
- **Pessoa travada**: o campo mostra o nome, só leitura, com a dica "vem da Agenda".
- **Linha de origem**: sem o "tirar"; valor e quantidade editáveis; dá para acrescentar outras linhas,
  desconto, sinal e parcelas como em qualquer venda.
- **Pagamento**: à vista **em aberto** por padrão, "Vence em" = dia de vencimento da turma
  (mensalidade) ou data do evento/uso.
- Depois de lançar: volta a `/gestao/agenda?aba=receber&aviso=lancado&documento={id}`.

### Estoque (religamento, sem tela nova)

| Onde | Mudança de interface |
|---|---|
| "Para onde foi" | Sexta barra **"Uso livre do espaço"** (área Espaço, cor da área) |
| Histórico | Saída da Agenda: linha 2 **"Uso livre do espaço · {nome} · {dd/mm}"** no formato de saída manual que já existe |
| Folha de baixa | **Sem mudança**: continua com os cinco destinos ("Uso livre do espaço" só a Agenda grava) |

### Site — calendário público (`#agenda`, AGE-18, D-10..D-12)

Mesma `Secao` de hoje (`id="agenda"`, `bg-site-papel`, borda em cima e embaixo, a decoração): eyebrow
"Aulas e oficinas", `h2` "Agenda do ateliê", o lead de hoje. Abaixo, **com pelo menos um evento
público de hoje em diante**:

1. **Alternador "Próximas · Calendário"** (`role="tablist"`, `aria-label="Ver a agenda como"`, dois
   botões 44px, `rounded-full`, `flex`, gap 8px; marcado: fundo `site-barro`, texto branco, 600; não
   marcado: borda `site-borda`, fundo `site-papel`, `site-tinta-media`). Padrão: **"Próximas"**. Sem
   JavaScript, só "Próximas" (renderizada no servidor). 32px abaixo do lead.
2. **Próximas** — lista de **cartões de evento** (`flex-col`, gap 16px; a partir de 768px, **duas
   colunas**, gap 24px), até **10** + o botão **"e mais {N} no calendário"** (troca para
   Calendário). Ordem: data e hora; a turma aparece **uma vez**, na posição da próxima data (D-12).
3. **Calendário** — **< 880px:** painel + lista empilhados (gap 24px); **≥ 880px:** duas colunas
   (`1fr 1.15fr`, gap 32px, `items-start` — protótipo do site `.duas`, 40 → 32):
   - **Painel** (`site-fundo`, borda `site-borda`, `rounded-[14px]`, padding 16px): navegação — "‹"
     (44×44, `rounded-full`, borda `site-borda`, fundo `site-papel`, `aria-label="Mês anterior"`) ·
     **"{mês} de {aaaa}"** (Corpo 600) · "›" (`aria-label="Próximo mês"`); "‹" desabilitado no mês de
     hoje e "›" no 6º mês (`aria-disabled` + texto `sr-only` "a agenda do site vai até {mês}"). Cabeçalho
     "seg … dom" (Apoio 600 `site-tinta-fraca`). Grade 7 colunas, gap 4px; **célula com evento ou
     fechado** = `<button>` `min-h-[48px]`, `rounded-[8px]`, fundo `site-papel`, borda 1px
     transparente, número (Corpo) + pontos de 8px (gap 4px); **escolhida** = borda **2px**
     `site-barro`; **sem nada** = número `site-tinta-fraca` sem botão; fora do mês = vazia. `aria-label`
     "{dia da semana}, {d} de {mês}: {n} aulas e oficinas" / "fechado" / "+ esgotado". Legenda embaixo
     (Apoio `site-tinta-fraca`, `flex-wrap`, gap 8px × 16px): **"turma fixa"** · **"oficina"** ·
     **"esgotado"** · **"fechado"** (herdada do protótipo do site).
   - **Lista** ao lado/embaixo: título (Corpo 600 `site-tinta`) **"Em {mês}"** (os eventos do mês de
     hoje em diante, turma uma vez) ou **"{dia da semana}, {dd/mm}"** (dia escolhido; tocar de novo
     desmarca — herdado); cartões de evento; vazios do Copywriting.
4. **Cartão de evento** (`<article>`, fundo `site-papel`, borda `site-borda`, **borda esquerda 4px**
   da cor do tipo — turma `site-folha`, oficina `site-sol`, esgotado `site-borda` —, `rounded-[12px]`,
   padding 16px, `flex-col`, gap 4px):
   - título (Fraunces 22px 600 `site-tinta`);
   - **quando**: turma **"Turma fixa · toda {dia da semana}, {h}h às {h}h"** (meia hora: "19h30") ·
     oficina **"{dia da semana}, {dd/mm} · {h}h às {h}h"** (Corpo `site-tinta-media`);
   - **preço e vagas**: **"{R$} por mês"** / **"{R$} por pessoa"** (D-10) + " · material incluso · "
     + vagas (600, cor das vagas): **"{n} vagas"** · **"últimas 2 vagas"** · **"última vaga"** ·
     **"esgotado"**. Turma em "Próximas": vagas da turma − alunos ativos; no calendário, a lista da
     data (D-12);
   - **"Reservar pelo WhatsApp"** (o botão de WhatsApp do site: `bg-site-cerrado`, texto branco,
     `rounded-full`, 44px, 15px 600), alinhado à esquerda, 8px acima; mensagem **"Oi! Quero reservar:
     {nome} ({toda {dia} \| {dd/mm}})."** (herdada do protótipo do site — vira um modelo em
     `conteudo/site.ts`, nunca string montada no componente). **Esgotado: o botão não existe.**
   - **Sem nome de pessoa, sem telefone, sem motivo de fechado** — a consulta pública não os seleciona.
5. **Bloco "Uso livre do ateliê"** (24px abaixo): o `CartaoDoSite` de hoje (marcador `site-cerrado`,
   título "Uso livre do ateliê", corpo `agLivre` **sem preço** — D-10) + o botão **"Consulte
   disponibilidade no WhatsApp"** (o estilo de contorno `site-barro` que a seção já tem, mensagem
   `usoLivre`).

**Sem evento público, ou sem banco** (D-11, A10 da pesquisa): a seção é **exatamente** a de hoje
(`AulasEOficinas`). Nenhum calendário vazio, nenhuma lista vazia.

---

## Estados e Comportamento

### Carregando

| Tela | Esqueleto (`Skeleton`, formato do conteúdo) |
|---|---|
| `/gestao/agenda` (`loading.tsx`) | Cabeçalho real + abas reais + (Agenda/Semana) a barra de navegação + 3 grupos de dia com 2 cartões de 64px cada |
| Trocar de semana/mês/aba | A mesma navegação de página: o `loading.tsx`; nunca a tela vazia |
| Mês | Cabeçalho dos dias + 35 células de 52px |
| Pessoas | Busca + 6 linhas |
| A receber | Cabeçalho + sanfona + 4 linhas |
| Números | 4 quadros + 7 barras |
| No site | A moldura + 3 cartões |
| Folha do evento / uso livre / turma / ficha (quando carrega ao abrir) | O cabeçalho real (título já conhecido pelo cartão) + 4 linhas |
| Seletor de pessoa / de material | 3 linhas no lugar da lista |
| Início — bloco | `BlocoEsqueleto` (já existe) |
| Site | Nenhum: é ISR, chega pronto |
| Gravando (qualquer ação) | Rótulo "…ndo…", `disabled`, `aria-busy="true"`; toque duplo não grava duas vezes |

### Dois celulares ao mesmo tempo

Toda ação decide **sob a trava** no servidor, contra o estado lido lá (pesquisa, Patterns 1-3 e
Pitfalls 7-8), e a tela se atualiza depois de cada gravação. Presença, direito a repor, cobrar/incluso
e público mandam o **estado desejado** — dois toques iguais convergem. Quando o estado mudou por
outro celular, a ação responde com a frase "… — a tela foi atualizada" e a folha recarrega — nunca
grava por cima. Campos em edição (turma, material, "Saiu às", valor da experimental) **não** são
apagados pela atualização.

### Teclado e leitor de tela

- Abas e alternadores: `tablist`, setas trocam, `Home`/`End`.
- Pílulas de tipo e segmentados ("Cobrar · Gratuita", "Cobrar · Incluso"): `role="radiogroup"`, setas
  movem; "Veio · Faltou": dois `aria-pressed` num `role="group"` com o nome da pessoa.
- Seletor de pessoa: campo com `role="combobox"`, `aria-expanded`, `aria-controls` da lista
  (`role="listbox"`, grupos com `role="group"` + `aria-label`), setas percorrem, `Enter` escolhe,
  `Esc` fecha a lista sem fechar a folha.
- Célula do mês e do calendário do site: `aria-label` completo (o ponto é `aria-hidden`); a grade é
  navegável por `Tab`.
- Regiões `aria-live="polite"`: a conta do uso livre, a faixa de confirmação do seletor, o aviso de dia
  fechado e o de homônimo.
- Fechar uma folha devolve o foco ao cartão/linha que a abriu (Radix).
- `prefers-reduced-motion`: sem deslizar da folha, sem rolagem suave até hoje.

---

## Component Inventory

**Reaproveitados sem mudança** (`components/ui/`): `dialog`, `alert-dialog`, `button`, `input`,
`select`, `checkbox`, `field`, `label`, `skeleton`, `sonner`, `card` (bloco do Início), `separator`.
**Nenhum componente shadcn novo.** Não usar `Tabs`/`ToggleGroup`/`RadioGroup`/`Command`/`Popover`/
`Calendar`/`Badge` do shadcn (não instalados; o projeto faz esses padrões em HTML semântico +
Tailwind).

**Reaproveitados do projeto:** `CabecalhoPagina`, `EstadoVazio`, `EstadoErro`, `TentarDeNovo`,
`BlocoDoInicio`, `BlocoEsqueleto`; o molde de `abas-financeiro.tsx`/`sub-abas-cadastros.tsx` (abas),
`alternador-vista.tsx` da 06.1 (Semana · Mês), `classeDaPilula` de `barra-ferramentas-saldos.tsx`
(pílulas de tipo); o molde de diálogo de tela toda de `folha-movimentacao.tsx`/`folha-nova-ordem.tsx`;
o segmentado de 52px da folha de movimentação; o **seletor "Qual material?"** (`seletor-material.tsx`
+ `carregador-do-seletor.tsx`) e a caixa "escolhido" da Fase 06; do site, `Secao`, `CartaoDoSite`,
`BotaoWhatsapp` (ganha a mensagem de reserva por evento) e `AulasEOficinas` (vira a queda).

**Novos em `components/amassa/agenda/`** (nomes são sugestão; o planejador decide o recorte): abas da
agenda · barra de navegação (semana/mês) · grupo de dia + cartão de evento · grade do mês + legenda ·
folha Lançar (pílulas de tipo, campos por tipo, aviso de dia fechado) · folha do evento (linha de
inscrito com Veio/Faltou e "tem direito a repor", faixa de confirmação de colocar) · **seletor de
pessoa** (busca, grupos, "Cadastrar") · folha do uso livre (conta, material, chegou/saiu) · folha do
fechado · folha da turma · lista de Pessoas · ficha da pessoa · formulário de pessoa + aviso de
homônimo (compartilhado com Cadastros → Clientes) · A receber (sanfona do lote, linha, Dispensadas) ·
folha "Recebi agora" · confirmações (cancelar data, cancelar reserva, tirar bloqueio, tirar da lista,
tirar material, sair da turma, desativar turma, dispensar) · Números (quadros, barras) · moldura "No
site".

**Novos em `components/site/`:** o Server Component que lê a consulta pública com queda para
`AulasEOficinas` · o Client Component do calendário (alternador, Próximas, grade do mês, lista do dia)
· cartão de evento do site.

**Religados:** `components/amassa/inicio/bloco-agenda-de-hoje.tsx`; `components/amassa/cadastros/
sub-abas-cadastros.tsx`, `lista-catalogo.tsx`, `dialogo-item-catalogo.tsx` (D-17); a lista de Clientes
nova em `components/amassa/cadastros/`; `components/amassa/financeiro/painel-venda.tsx` (faixa "Da
Agenda", pessoa travada, linha de origem); `components/amassa/estoque/secao-para-onde-foi.tsx` (lê a
lista de seis destinos) e `linha-movimentacao.tsx` (vínculo do uso livre); `app/gestao/(app)/agenda/
page.tsx` (sai o "Chega na Fase 5").

**Ícones (lucide-react):** `ChevronLeft`/`ChevronRight` (navegação), `Plus` ("+ Lançar", "+ lançar",
"+ Pessoa", "+ Material" — `aria-hidden` ao lado do texto), `Check` (Veio marcado), `X` (Faltou
marcado; fechar), `AlertTriangle` (caixas de aviso), `Search` (busca), `CalendarDays` (menu, já existe).
Todos `aria-hidden` quando acompanham texto.

---

## Decisões desta UI-SPEC (tomadas sem o dono — cada uma reversível)

> *01/10/2026:* **UI-D4, UI-D5, UI-D6 e UI-D7 foram confirmadas pelo dono** (seção "Perguntas ao
> dono", abaixo). As outras 24 continuam escolhas desta UI-SPEC.

| # | Decisão | Por quê | Alternativa descartada |
|---|---|---|---|
| UI-D1 | Abas da Agenda **neutras** (molde `abas-financeiro.tsx`), 3 + 2 abaixo de 768px | O protótipo pinta a aba marcada de terracota cheio, competindo com "+ Lançar na agenda"; cinco abas numa fileira a 360px quebram dentro da pílula (o defeito que o dono viu em Cadastros em 27/09) | Pílulas terracota numa fileira, como o protótipo |
| UI-D2 | "Semana · Mês" como alternador neutro | No protótipo o marcado é **verde** — a mesma cor de "Veio" e "pago" na mesma tela | Verde, como o protótipo |
| UI-D3 | Em "A receber", **só o lote** é terracota; "Recebi agora", "Lançar na Venda" e "Dispensar" de cada linha são `outline` | Um terracota por tela; com dez linhas, dez botões terracota apagam a hierarquia | "Lançar na Venda" terracota por linha |
| UI-D4 | "Recebi agora": **tocar na forma já registra** (2 toques), sem botão de confirmar; a taxa do cartão aparece embaixo do botão | Valor central; o briefing chama de "o caminho de um toque"; engano se desfaz no Caixa (cancelar a venda devolve o item a "A receber", D-08) | Escolher a forma e confirmar (3 toques), como o "Recebi" do Caixa |
| UI-D5 | **Seletor de pessoa com busca** (sem acento), "Tem aula a repor" primeiro, "Cadastrar "{nome}"" no fim — no "Colocar alguém" e no "Quem" do uso livre; material pelo seletor da Fase 06 | Um `select` nativo com dezenas de nomes vira uma roda sem busca no celular; cadastrar sem sair da folha evita perder a aula | `select` com todos, como o protótipo |
| UI-D6 | Experimental: **"Cobrar · Gratuita" sem padrão marcado** — "Colocar na lista" só habilita depois da escolha | A D-07 diz "a folha pergunta"; um padrão marcado vira cobrança (ou gratuidade) por descuido | "Cobrar" já marcado |
| UI-D7 | "Saiu às" vem com **a hora de agora** quando o uso é de hoje; com a saída prevista quando é de dia passado | Quem encerra é quem vê a pessoa sair: encerrar vira um toque com a hora certa; a prevista só faz sentido para o esquecido de ontem (D-18) | A saída prevista sempre, como o protótipo |
| UI-D8 | Folhas com estado na URL (`?evento=`, `?uso=`, `?turma=`, `?pessoa=`, `?lancar=1`) por `pushState` | O "voltar" do Android fecha a folha em vez de sair da Agenda; o Início abre a lista de presença direto | Estado só no cliente |
| UI-D9 | Botão de gravar da folha Lançar com o verbo do tipo: "Lançar turma", "Lançar aula", "Reservar uso livre", "Fechar o dia" | O rótulo diz o que vai acontecer — "Lançar" com a pílula errada marcada é o engano mais provável | "Lançar" para tudo |
| UI-D10 | Campo **"Primeira aula a partir de"** na turma (padrão hoje) | Turma lançada em outubro para começar em dezembro marcaria oito semanas vazias de outubro e novembro | Sempre a partir de hoje |
| UI-D11 | Presença **otimista**, com ícone e peso no marcado | Um toque por pessoa só é confortável se o toque seguinte não espera o servidor; cor sozinha não basta (WCAG 1.4.1) | Esperar a resposta a cada toque |
| UI-D12 | Tipo **escrito** na sub-linha do cartão; ponto ouro com **contorno de 1px** `tinta-fraca` | O ouro dá 2,94:1 — reprova como objeto gráfico; com o tipo escrito, a borda colorida vira decoração | Só a cor, como o protótipo |
| UI-D13 | Confirmação (`AlertDialog`) para cancelar reserva, tirar bloqueio, tirar da lista, tirar material, sair da turma, desativar turma — e para **cancelar data só quando apaga presença ou tira inscrição de "A receber"**; senão grava direto com "Desfazer" no toast | Regra do projeto ("toda remoção pede confirmação e diz o que será perdido") sem quebrar o "cancela com um toque" da D-13 | Confirmar tudo / nada |
| UI-D14 | Com venda ativa, "tirar da lista" **não aparece**; no lugar, a frase da D-08 com "ver no Caixa" | Um botão que só existe para ser recusado é um toque perdido; o servidor continua recusando (corrida) | Botão que mostra o erro ao tocar |
| UI-D15 | Dispensa com "Desfazer" no toast **e** a sanfona "Dispensadas ({N})" no fim de "A receber" | A D-09 pede "desfazer"; o toast some em 5 s e a dispensa pode ser lembrada dias depois | Só o toast |
| UI-D16 | "Lista cheia" em âmbar | É aviso que não bloqueia (AGE-11); vermelho diz "não pode" | Vermelho, como o protótipo |
| UI-D17 | Site: alternador **"Próximas · Calendário"** (AGE-18 e o protótipo da Agenda) com o **visual do protótipo do site v11** (cartão com borda de tipo, grade, legenda; calendário e lista lado a lado a partir de 880px); cartões sobre `site-papel`; token por referência `--color-site-ambar` | O protótipo da Agenda desenha as duas vistas e o do site desenha o visual do site — este contrato junta os dois; os cartões sobre `site-fundo` reprovam o âmbar e o barro-claro (4,47/4,49) | Só a grade com lista ao lado (protótipo do site), ou o visual da gestão no site |
| UI-D18 | "No site" com o **mesmo componente** e os links reais de WhatsApp, na largura em que a gestão está | O gestor vê o que o visitante vê, no tamanho de tela dele, e pode testar a mensagem | Moldura de 420px com botões inertes, como o protótipo |
| UI-D19 | Início: **até 6 linhas**, cada uma abre a folha do evento; cores de tipo da Agenda; "{n} de {vagas} inscritos" | Do Início à presença em 2 toques; uma cor por tipo no sistema todo | Linhas sem link, cores do protótipo da 04.6 |
| UI-D20 | Cadastros: "Clientes" como **terceira pílula da primeira fileira**; desktop `md:max-w-xl` | Agrupa com o que se cadastra para vender; seis pílulas não cabem em `max-w-md` | Última da segunda fileira (quatro embaixo, quebra a 360px) |
| UI-D21 | Célula do mês com largura < 44px abaixo de 375px (altura 52px) | Sete colunas não cabem em 44px a 360px com a margem da página; a vista Semana é o caminho alternativo | Rolagem lateral da grade |
| UI-D22 | Números: presença **"—"** sem nenhuma marcação no mês | "0%" diria que ninguém veio | "0%", como o protótipo |
| UI-D23 | Pessoas: **50 por vez**, busca no servidor sem acento, telefone na sub-linha | A lista cresce com o tempo; o telefone distingue homônimos (D-16) | Lista inteira |
| UI-D24 | "Editar" (nome, telefone) dentro da ficha | Corrigir o telefone sem sair da Agenda para Cadastros | Só em Cadastros → Clientes |
| UI-D25 | A folha da turma abre **no lugar** da folha da data, com "Voltar à data" | Dois diálogos empilhados no celular perdem o "voltar" e o foco | Diálogo sobre diálogo |
| UI-D26 | Venda da Agenda: faixa "Da Agenda", pessoa travada, linha de origem sem "tirar", a venda em montagem guardada e avisada | Pitfall 10 da pesquisa (o carrinho do `sessionStorage`); o servidor sobrescreve pessoa e descrição de qualquer jeito | Misturar com o carrinho em montagem |
| UI-D27 | Ao abrir a aba Agenda, **rolar até hoje** e "Hoje" também rolar | Com a semana inteira no celular, hoje pode estar abaixo da dobra (sexta-feira) | Abrir no topo (segunda) |
| UI-D28 | Conteúdo das abas com **`max-w-3xl`** no desktop (No site até 1080px) | Cartões de 1000px de largura com três palavras ficam ilegíveis; o protótipo foi desenhado para celular | Largura total |

---

## Perguntas ao dono

> **Respondidas pelo dono em 01/10/2026, no chat, por formulário, durante o `/gsd-plan-phase 5` —
> as quatro na opção (a), a recomendada.** UI-D4, UI-D5, UI-D6 e UI-D7 deixam de ser "tomadas sem o
> dono": são escolha dele. O texto abaixo é o registro do que foi perguntado.

Só as quatro que mudam o que ele faz no celular. Todas têm padrão escolhido e são reversíveis por
código; o planejamento pode seguir com as recomendações.

1. **"Recebi agora": quantos toques?** (UI-D4)
   - (a) **Tocar em "Dinheiro", "Pix" ou "Cartão" já registra a venda paga** — 2 toques no total.
   - (b) Escolher a forma e tocar em "Registrar" — 3 toques, como o "Recebi" do Caixa.
   - **Recomendação: (a).** É o "caminho de um toque" do briefing; um toque errado se desfaz
     cancelando a venda no Caixa, e a cobrança volta a "A receber" sozinha (D-08).

2. **Aula experimental: a folha já vem com "Cobrar" marcado?** (UI-D6)
   - (a) **Nada marcado — escolher "Cobrar" ou "Gratuita" toda vez.**
   - (b) "Cobrar" já marcado, com o valor sugerido.
   - (c) "Gratuita" já marcado.
   - **Recomendação: (a).** A D-07 diz que a folha pergunta; um padrão vira cobrança (ou
     gratuidade) sem ninguém decidir. Custa um toque por experimental, que é rara.

3. **Encerrar o uso livre: a hora de saída vem preenchida com o quê?** (UI-D7)
   - (a) **Com a hora de agora**, quando o uso é de hoje (de dia passado: a saída prevista).
   - (b) Com a saída prevista na reserva, sempre (como o protótipo).
   - **Recomendação: (a).** Quem encerra normalmente está vendo a pessoa sair — encerrar vira um
     toque com a hora certa, e a hora cheia (que muda o valor) sai certa.

4. **"Colocar alguém" e "Quem" do uso livre: lista com busca ou lista de rolar?** (UI-D5)
   - (a) **Campo de busca pelo nome** (acha sem acento), "Tem aula a repor" primeiro e "Cadastrar
     {nome}" no fim, sem sair da folha.
   - (b) A lista de rolar do celular com todas as pessoas, como o protótipo.
   - **Recomendação: (a).** Com dezenas de pessoas a lista de rolar do celular não tem busca, e a
     pessoa nova que chegou para a aula experimental se cadastra ali mesmo.

Se quiser olhar mais alguma: **UI-D17** (o calendário do site junta as duas vistas do protótipo da
Agenda com o visual do protótipo do site) e **UI-D13** (o que pede confirmação).

---

## UI Considerations

Applicable state considerations resolved: **195 — 146 covered, 49 backstop, 0 unresolved**,
contados pelo motor `ui-consideration-probe` no passo 9.5 do `/gsd-ui-phase` (01/10/2026), um par
superfície × categoria por vez, depois da aprovação do `gsd-ui-checker`. Os tipos de cada superfície
foram **escritos à mão**: o classificador do motor só reconhece palavras em inglês e este contrato é em
português. `covered` só onde este UI-SPEC já especifica o comportamento (a coluna aponta a seção, a
UI-D ou a D-xx); `backstop` onde não especifica — com a checagem concreta a fazer na verificação (o
que abrir, em que largura, com que dado, o que olhar). Nenhum par descartado, nenhum em aberto. A copy
de vazio e de erro está no Copywriting Contract; aqui só a cobertura. Superfícies: E1 página
`/gestao/agenda` e abas (`nav`) · E2 vista Semana (`list-collection`, `nav`) · E3 vista Mês
(`list-collection`, `nav`) · E4 cartão de evento (`static-content`, `interactive-control`) · E5 folha
"Lançar na agenda" (`form`) · E6 folha do evento — lista de presença (`list-collection`,
`interactive-control`) · E7 folha do evento — colocar, experimental, tirar, cancelar (`form`,
`interactive-control`) · E8 seletor de pessoa (`form`, `list-collection`) · E9 folha do uso livre
(`form`, `list-collection`, `static-content`) · E10 folha do fechado (`static-content`,
`interactive-control`) · E11 folha da turma (`form`, `list-collection`) · E12 aba Pessoas
(`list-collection`, `form`) · E13 ficha da pessoa (`static-content`, `list-collection`,
`interactive-control`) · E14 formulário de pessoa + homônimo (`form`) · E15 aba A receber
(`list-collection`, `interactive-control`) · E16 sanfona do lote (`list-collection`,
`interactive-control`) · E17 Dispensar + Dispensadas (`form`, `list-collection`) · E18 folha "Recebi
agora" (`interactive-control`, `static-content`) · E19 aba No site (`static-content`,
`list-collection`) · E20 aba Números (`static-content`, `list-collection`) · E21 bloco "Agenda de hoje"
do Início (`list-collection`, `static-content`) · E22 Cadastros → Clientes (`list-collection`, `form`,
`nav`) · E23 Cadastros → Catálogo, itens do sistema (`static-content`, `interactive-control`) · E24
Venda aberta pela Agenda (`form`, `static-content`) · E25 site — Próximas (`list-collection`, `nav`,
`interactive-control`) · E26 site — Calendário (`list-collection`, `nav`) · E27 site — uso livre e
queda sem Agenda (`static-content`) · E28 confirmações (`interactive-control`, `static-content`) · E29
toasts (`static-content`, `interactive-control`) · E30 religamentos do Estoque (`static-content`,
`list-collection`). Os arquivos do motor (elementos e resoluções) ficaram no rascunho da sessão, fora do
repositório.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| loading | E1 — página /gestao/agenda e abas | ✅ covered | `loading.tsx` com o cabeçalho e as abas reais + esqueleto no formato da aba (Estados e Comportamento → Carregando); trocar de aba é navegação de página e mostra o mesmo esqueleto, nunca a tela vazia |
| error | E1 — página e abas | ✅ covered | `error.tsx` com "Não deu para carregar a agenda…" + "Tentar de novo" (Copywriting → Erros, linha "Carregar a Agenda"); parâmetro desconhecido na URL cai no padrão (`lib/agenda/abas.ts`), nunca em erro |
| overflow | E1 — abas a 320px | ✅ covered | 3 + 2 com o espaçador `basis-full` abaixo de 768px e uma fileira com `md:max-w-xl` acima (Layout → Página, item 2; UI-D1) — nunca rolagem lateral |
| long-text | E1 — "A receber · {N}" | 🧪 backstop | Abrir `/gestao/agenda` a 320px e a 360px com 120 cobranças a receber ("A receber · 120"): conferir que a primeira fileira (Agenda · Pessoas · A receber · 120) cabe sem a pílula quebrar o rótulo no meio de uma palavra e sem estourar a borda do contêiner (o defeito de Cadastros de 27/09) |
| empty | E2 — semana vazia | ✅ covered | Cada dia sem nada mostra "nada marcado" (Copywriting → Estados vazios); a semana vazia são sete "nada marcado" com o "+ lançar" de cada dia — é o vazio do protótipo, sem tela especial |
| loading | E2 — semana | ✅ covered | Esqueleto: barra de navegação + 3 grupos de dia com 2 cartões de 64px (Carregando); trocar de semana usa o mesmo `loading.tsx` |
| error | E2 — semana | ✅ covered | Mesmo `error.tsx` da página (E1) |
| populated | E2 — semana cheia | ✅ covered | Cartões em ordem fechado → início → título, gap 8px, a página rola até hoje ao abrir e no "Hoje" (Layout → Semana; UI-D27) |
| partial | E2 — dia só com fechado, data cancelada, semana que cruza o ano | ✅ covered | Fechado vem primeiro com "dia todo"; cancelada riscada com a tag; título "{dd/mm/aaaa} a {dd/mm/aaaa}" quando a semana cruza o ano (Layout → Semana, item 1) |
| overflow | E2 — barra de navegação a 320px | 🧪 backstop | Abrir a semana de 28/12/2026 a 03/01/2027 a 320px: o título "28/12/2026 a 03/01/2027" é `whitespace-nowrap` em Título 20px entre dois botões de 44px — conferir que "›" não sai da tela nem cria rolagem lateral; se sair, o título pode quebrar em duas linhas (nunca o botão) |
| zero-one-many | E2 — 0, 1 e muitos cartões no dia | ✅ covered | 0 = "nada marcado"; 1 ou muitos = cartões empilhados com gap 8px; contagem de gente com plural de verdade ("1 pessoa" / "3 pessoas", Herdado) |
| long-text | E2 — título do cartão | ✅ covered | Título do cartão com quebra livre, nunca truncado (Copywriting → Cartão de evento, coluna 2); cabeçalho do dia é formato fixo |
| empty | E3 — mês sem nada | ✅ covered | Grade sem pontos + "Nada marcado neste mês." embaixo da legenda (Estados vazios) |
| loading | E3 — mês | ✅ covered | Esqueleto: cabeçalho dos dias + 35 células de 52px (Carregando) |
| error | E3 — mês | ✅ covered | Mesmo `error.tsx` da página (E1) |
| populated | E3 — mês com vários lançamentos por dia | ✅ covered | Até 6 pontos de 8px por célula (`flex-wrap`, gap 4px), ponto ouro com contorno; `aria-label` com o resumo por tipo (Layout → Mês, item 2) |
| partial | E3 — fora do mês, fechado, cancelado | ✅ covered | Fora do mês `superficie-2` + número `tinta-fraca`; dia fechado com o ponto `area-geral` primeiro; cancelado sem ponto (Layout → Mês, item 2) |
| overflow | E3 — dia com 7+ lançamentos a 320px | 🧪 backstop | Semear um dia com 8 lançamentos e abrir o mês a 320px (célula ~35px, UI-D21): conferir que os 6 pontos quebram em duas linhas dentro dos 52px sem vazar da célula, e que o `aria-label` conta os 8, não os 6 desenhados |
| zero-one-many | E3 — resumo da célula | ✅ covered | `aria-label` "nada marcado" / "1 turma fixa, 2 oficinas, 1 uso livre" com plural de verdade (Layout → Mês, item 2) |
| long-text | E3 — título do mês e legenda | ✅ covered | "{mês} de {aaaa}" é formato fixo; legenda em `flex-wrap`, gap 8px × 16px (Layout → Mês, item 3) |
| loading | E4 — cartão | ✅ covered | O cartão abre a folha; folha que carrega ao abrir mostra o cabeçalho real + 4 linhas (Carregando) |
| error | E4 — cartão de lançamento que sumiu | ✅ covered | Link velho ou lançamento removido em outro celular: toast "Esse lançamento não existe mais…" e a folha não abre (Copywriting → Erros) |
| overflow | E4 — cartão com muitas tags a 320px | 🧪 backstop | Montar um cartão de oficina com "cancelada", "dia fechado", "marcar presença", "3 a receber", "no site" a 320px e conferir que as tags quebram na sub-linha e que "12 / 12" continua na coluna da direita, sem empurrar o título |
| long-text | E4 — título longo | ✅ covered | Título com quebra livre, nunca truncado; nome acessível do botão = o texto inteiro do cartão (Copywriting → Cartão de evento) |
| empty | E5 — folha Lançar recém-aberta | ✅ covered | Mensalidade, preço e horário nascem vazios; vagas 8, semanas 8, vencimento 10, horas 2, pessoas 1 (Rótulos e dicas de campo); o erro de cada campo vazio está em Copywriting → Erros |
| loading | E5 — gravando | ✅ covered | "Lançando…" / "Reservando…" / "Fechando…" com `disabled` e `aria-busy` (Copywriting → Ações, "Folha Lançar — gravar") |
| error | E5 — validação e falha | ✅ covered | Erros embaixo de cada campo com foco no primeiro; falha de gravação: "Não deu para lançar. Nada foi gravado…" com a folha aberta e preenchida (Copywriting → Erros) |
| partial | E5 — trocar de tipo com campos já digitados | 🧪 backstop | Abrir "Lançar na agenda", digitar nome, horário e vagas em "Aula ou oficina avulsa", trocar para "Turma fixa" e voltar: conferir que os campos comuns (nome, data, começa, termina, vagas) continuam preenchidos — o formulário nunca perde o que foi digitado |
| long-text | E5 — rótulos e nome longo a 320px | 🧪 backstop | Abrir o tipo Turma fixa a 320px: conferir que "Mensalidade vence dia" e "Marcar quantas semanas" quebram o rótulo sem espremer o campo abaixo de 16px; digitar um nome de 121 caracteres e conferir que o erro aparece embaixo do campo com o limite (1–120) |
| empty | E6 — data sem inscrito | ✅ covered | "Ninguém inscrito ainda." (Folha do evento — linhas de leitura) com o "Colocar alguém" logo abaixo |
| loading | E6 — presença gravando | ✅ covered | Otimista: o segmento muda no toque, `aria-busy` no grupo enquanto grava, toques em outras linhas não esperam (Layout → Folha do evento, item 4; UI-D11) |
| error | E6 — presença falhou | ✅ covered | O segmento volta ao estado anterior e "Não deu para marcar a presença de {nome}. Toque de novo." aparece embaixo da linha (Copywriting → Erros) |
| populated | E6 — turma cheia | ✅ covered | Uma linha por pessoa com Veio · Faltou à direita; ordem alunos, reposições, experimentais, por nome (Layout → Folha do evento, item 4) |
| partial | E6 — data passada, cancelada, reposição, venda ativa | ✅ covered | Sem marcação em data passada = tag "marcar presença"; cancelada = só leitura; reposição sem tag de pagamento; venda ativa = frase da D-08 no lugar de "tirar da lista" (UI-D14) |
| overflow | E6 — lista de 20 a 360×640 | 🧪 backstop | Semear uma oficina com 20 inscritos e abrir a folha num celular de 360×640: conferir que a lista rola dentro da folha e que o rodapé com "Pronto" (e "Cancelar esta data") continua preso e visível |
| zero-one-many | E6 — contagem | ✅ covered | "Quem vem · {n} de {vagas}" (0, 1, muitos); acima das vagas, o aviso de lista cheia que não bloqueia (UI-D16) |
| long-text | E6 — nome longo + tags a 320px | 🧪 backstop | Inscrever uma pessoa de nome com 160 caracteres, com as tags "reposição" e "venda nº 123 cancelada", e abrir a 320px: conferir que o nome quebra e o segmento Veio · Faltou continua inteiro à direita (dois botões de 44px), sem ir para fora da tela |
| empty | E7 — experimental sem escolha | ✅ covered | "Cobrar · Gratuita" nasce sem nada marcado e "Colocar na lista" só habilita depois da escolha (UI-D6, confirmada pelo dono); data cancelada não mostra "Colocar alguém" |
| loading | E7 — colocando, cancelando | ✅ covered | "Colocando…", "Cancelando…" com `disabled`/`aria-busy` (Copywriting → Ações; Carregando, "Gravando") |
| error | E7 — corrida e validação | ✅ covered | "já está nesta lista", "não tem mais aula a repor", a frase da D-08, "Diga se esta aula é cobrada ou gratuita.", "Diga o valor…" (Copywriting → Erros) |
| partial | E7 — lista cheia, dia fechado | ✅ covered | Lista cheia: caixa âmbar que não bloqueia; data de turma em dia fechado: "Cancelar esta data" só na caixa do topo, rodapé só com "Pronto" (Folha do evento — linhas de leitura; Layout, item 7) |
| long-text | E7 — caixa de dia fechado com motivo longo | 🧪 backstop | Fechar um dia com motivo de 120 caracteres e abrir uma data de turma desse dia a 320px: conferir que a caixa "Este dia está fechado: …" quebra o texto e que o "Cancelar esta data" dentro dela continua inteiro e com 44px |
| empty | E8 — busca vazia / ninguém cadastrado | ✅ covered | "Digite para buscar." / "Ninguém cadastrado ainda. Digite o nome para cadastrar." (Seletor de pessoa) |
| loading | E8 — carregando a lista | ✅ covered | 3 linhas de esqueleto no lugar da lista (Carregando) |
| error | E8 — lista não carregou | ✅ covered | "Não deu para carregar a lista de pessoas…" + "Tentar de novo" dentro da folha (Copywriting → Erros) |
| populated | E8 — resultados | ✅ covered | "Tem aula a repor" primeiro (cabeçalho âmbar), depois o grupo do contexto; cada linha nome + telefone (Seletor de pessoa; UI-D5) |
| partial | E8 — sem telefone, já na lista, sem crédito | ✅ covered | Sem telefone: só o nome; quem já está na lista não aparece; sem ninguém a repor o grupo 1 some (Seletor de pessoa) |
| overflow | E8 — busca de uma letra com 200 resultados | 🧪 backstop | Cadastrar 200 pessoas, digitar "a" no "Colocar alguém" a 360px: conferir que a lista de resultados tem um teto (ou rola dentro de uma área própria) e que a faixa de confirmação e o "Colocar na lista" continuam alcançáveis sem rolar a folha inteira — o UI-SPEC não fixa o teto; o planejador escolhe (ex.: 8 primeiros + "continue digitando") |
| zero-one-many | E8 — 0, 1 e muitos resultados | ✅ covered | 0 = "Ninguém com esse nome." + "Cadastrar "{texto}""; 1 ou muitos = linhas; "{n} a repor" com plural de verdade |
| long-text | E8 — nome longo no resultado e no "Cadastrar" | 🧪 backstop | Digitar 160 caracteres no campo a 320px: conferir que "Cadastrar "{texto}"" quebra sem estourar a lista, e que um resultado de nome com 160 caracteres quebra dentro da opção (nome acessível completo) |
| empty | E9 — sem material, campos de hora | ✅ covered | Material "nenhum"; "Chegou às" já vem com a hora da reserva e "Saiu às" com a hora de agora (UI-D7, confirmada pelo dono) |
| loading | E9 — gravando, seletor de material | ✅ covered | "Marcando…" / "Encerrando…"; o seletor de material usa o carregador da Fase 06 (Carregando) |
| error | E9 — saída, material, falha, corrida | ✅ covered | "A saída precisa ser depois da chegada.", erros de material da Fase 06, "Não deu para encerrar. Nada foi gravado nem baixado…", "Este uso livre já foi encerrado…" (Copywriting → Erros) |
| populated | E9 — conta e material | ✅ covered | Conta Pessoas · Horas cheias · Material cobrado · Valor (600) com `aria-live`; linhas de material com valor ou "incluso" (Folha do uso livre — linhas de leitura) |
| partial | E9 — sem preço da hora, item sem preço de venda, dia passado | ✅ covered | Caixa âmbar e "Encerrar e cobrar" `disabled` com `aria-describedby`; item sem preço só "Incluso" com a dica da D-14; dia passado com a tag "encerrar" (D-18) |
| overflow | E9 — 8 materiais a 320px | 🧪 backstop | Pôr 8 materiais num uso livre no espaço e abrir a 320px: conferir que a linha de acrescentar (Escolher material · Quanto · Cobrar · Incluso · + Material) quebra em linhas sem rolagem lateral e que "Encerrar e cobrar" continua preso no rodapé |
| zero-one-many | E9 — plurais da conta | 🧪 backstop | Encerrar com 1 pessoa, 1 hora e 1 material: conferir "1 h × R$ …" (sem "× 1 pessoas"), o toast "1 hora cheia" e a linha "estoque baixado (1 material)" — o UI-SPEC escreve "({n} materiais)" e o singular precisa sair certo |
| long-text | E9 — nome de material longo | 🧪 backstop | Usar um item do estoque de nome com 120 caracteres a 320px: conferir que "{q} {un} · {nome}" quebra e que o valor ou "incluso" e o "tirar" continuam à direita |
| loading | E10 — tirando o bloqueio | ✅ covered | Confirmação com "…ndo…", `disabled` e `aria-busy` (Carregando, "Gravando") |
| error | E10 — falha ou bloqueio já removido | ✅ covered | Ação genérica "Não deu para {verbo}…"; removido em outro celular = "Esse lançamento não existe mais…" (Copywriting → Erros) |
| overflow | E10 — rodapé a 320px | 🧪 backstop | Abrir a folha de um fechado a 320px: conferir que "Tirar o bloqueio" e "Voltar à agenda" cabem na linha ou quebram para duas linhas, cada um com 44px, sem rolagem lateral |
| long-text | E10 — motivo longo no título | 🧪 backstop | Fechar um dia com motivo de 120 caracteres e abrir a folha a 320px: conferir que o título (Título 20px) quebra ao lado do fechar de 44×44 sem empurrá-lo para fora |
| empty | E11 — turma sem aluno, sem data futura | ✅ covered | "Nenhum aluno ainda. Os alunos entram pela ficha…"; "Nenhuma data marcada daqui para frente." (Folha da turma) |
| loading | E11 — carregando, salvando | ✅ covered | Cabeçalho real + 4 linhas ao abrir; "…ndo…" ao salvar, marcar mais semanas e desativar (Carregando; "Desativando…") |
| error | E11 — salvar falhou, validação | ✅ covered | "Não deu para salvar a turma…"; os erros de campo do Lançar (vagas, semanas, vencimento, horário) embaixo de cada campo (Copywriting → Erros) |
| populated | E11 — turma com alunos | ✅ covered | Lista só de leitura com nome + tag "a repor"; "Marcada até…" com a contagem de datas (Folha da turma) |
| partial | E11 — dia da semana, sem mudança, aberta da ficha | ✅ covered | Dia da semana só leitura com a dica; "Salvar turma" `disabled` sem mudança; "Voltar à data" só quando veio de uma data (Layout → Folha da turma; UI-D25) |
| overflow | E11 — 30 alunos a 360×640 | 🧪 backstop | Abrir a folha de uma turma com 30 alunos num celular de 360×640: conferir que a área rola, que "Desativar turma" continua no fim da área rolável e que o rodapé com "Salvar turma" fica preso |
| zero-one-many | E11 — plural do sub-título | 🧪 backstop | Abrir uma turma com 1 aluno: conferir "1 aluno de {v} vagas" (o UI-SPEC escreve "{a} alunos de {v} vagas"), "Alunos (1)" e "1 data daqui para frente" |
| long-text | E11 — nome de turma longo | 🧪 backstop | Lançar uma turma com nome de 120 caracteres e abrir a folha a 320px: conferir que o título quebra ao lado do fechar e do "Voltar à data", e que o sub-título "Turma fixa · toda {dia}, … · no site" quebra sem cortar |
| empty | E12 — ninguém / busca sem resultado | ✅ covered | "Ninguém cadastrado ainda." com "+ Pessoa" primário; busca sem resultado "Ninguém com esse nome." + "Cadastrar "{busca}"" (Estados vazios) |
| loading | E12 — Pessoas | ✅ covered | Esqueleto: busca + 6 linhas; a busca espera 300 ms antes de buscar (Carregando; Layout → Aba Pessoas) |
| error | E12 — Pessoas | ✅ covered | Mesmo `error.tsx` da página (a busca é parâmetro da URL) |
| populated | E12 — lista | ✅ covered | Ordem alfabética, 50 por vez + "Mostrar mais 50", tags e sub-linha com telefone e turmas (Layout → Aba Pessoas; UI-D23) |
| partial | E12 — sem telefone, sem turma, sem pendência | ✅ covered | Sub-linha só com as turmas ou "sem turma fixa"; tags só quando n > 0 (Layout → Aba Pessoas, item 3) |
| overflow | E12 — muitas pessoas | ✅ covered | 50 por vez + "Mostrar mais 50"; a página rola, nunca de lado (UI-D23) |
| zero-one-many | E12 — 50 e 51 pessoas | 🧪 backstop | Semear 50 e depois 51 pessoas: conferir que "Mostrar mais 50" só aparece acima de 50, e as tags "1 a repor" / "2 a receber" com plural de verdade |
| long-text | E12 — nome longo a 320px | 🧪 backstop | Cadastrar uma pessoa de nome com 160 caracteres, com as duas tags, e abrir Pessoas a 320px: conferir que o nome quebra e o "Abrir" (44px) continua à direita, inteiro |
| empty | E13 — sem vinda, sem turma | ✅ covered | "Ainda não veio."; "Nenhuma turma fixa lançada ainda." (Ficha da pessoa — linhas de leitura) |
| loading | E13 — ficha | ✅ covered | Cabeçalho real + 4 linhas ao abrir; entrar/sair da turma com "…ndo…" (Carregando) |
| error | E13 — ficha | ✅ covered | "Não deu para carregar esta ficha…" + "Tentar de novo" dentro da folha (Copywriting → Erros) |
| populated | E13 — ficha completa | ✅ covered | Dois quadros, caixas das turmas ativas com "ver turma", até 8 últimas vindas com as tags (Layout → Ficha da pessoa) |
| partial | E13 — sem telefone, nada a receber | ✅ covered | "sem telefone"; "A RECEBER R$ 0,00"; turma desativada não aparece (Ficha da pessoa) |
| overflow | E13 — quadros a 320px | 🧪 backstop | Abrir a ficha de alguém com R$ 1.234,56 a receber e 12 aulas a repor a 320px: conferir que o número Display (28px) cabe no quadro de `grid-cols-2` sem cortar nem empurrar o outro quadro |
| zero-one-many | E13 — contagens | ✅ covered | "aula" / "aulas" no quadro A repor; até 8 vindas (Ficha da pessoa) |
| long-text | E13 — nome longo no título | 🧪 backstop | Abrir a ficha de alguém com nome de 160 caracteres a 320px: conferir que o título quebra e que "Editar" e o fechar continuam visíveis com 44px |
| empty | E14 — formulário vazio | ✅ covered | Nome obrigatório ("Diga o nome da pessoa."); telefone opcional (Copywriting → Erros) |
| loading | E14 — salvando | ✅ covered | "Salvando…" com `disabled` (Copywriting → Ações, "Pessoa nova") |
| error | E14 — validação | ✅ covered | "Diga o nome da pessoa." / "O nome pode ter até 160 caracteres." / "O telefone pode ter até 40 caracteres." embaixo do campo |
| partial | E14 — homônimo | ✅ covered | A folha não fecha e mostra a caixa "Já existe {nome} · {telefone}…" com "Usar … que já existe" por homônimo e "Criar outra pessoa"; editar com homônimo: "Salvar mesmo assim" (Layout → Pessoa nova; D-16) |
| long-text | E14 — nome e telefone longos | ✅ covered | Limites 160 e 40 pelo Zod no servidor, com as frases de erro embaixo do campo (Assunções, item 8) |
| empty | E15 — ninguém devendo | ✅ covered | "Ninguém devendo." + o corpo, o lote some, total "R$ 0,00" (Estados vazios) |
| loading | E15 — A receber | ✅ covered | Esqueleto: cabeçalho + sanfona + 4 linhas; "Registrando…" na forma tocada (Carregando) |
| error | E15 — corrida e falha | ✅ covered | "Este item já foi lançado (venda nº {N})…"; "Não deu para registrar. Nenhuma venda foi criada…" (Copywriting → Erros) |
| populated | E15 — linhas | ✅ covered | Ordem de vencimento/data; nome, valor, sub-linha com tags e a fileira de ações (Layout → Aba A receber, item 3) |
| partial | E15 — uso livre, proporcional, venda cancelada | ✅ covered | Uso livre sem "Dispensar a cobrança" (D-09); "(proporcional)"; tag "venda nº {N} cancelada" (D-08) |
| overflow | E15 — ações a 320px | ✅ covered | Os dois botões da direita descem um embaixo do outro a 320px, nunca rolam de lado (Layout → Aba A receber, item 3) |
| zero-one-many | E15 — contador da aba | ✅ covered | "A receber" sem contador com 0; " · {N}" com 1 ou mais (Copywriting → Ações, abas) |
| long-text | E15 — sub-linha longa a 320px | 🧪 backstop | Lançar uma turma de nome com 120 caracteres e abrir A receber a 320px: conferir que "Mensalidade · {turma} (proporcional) · {mês} · vence dia {d}" e a tag quebram sem empurrar o valor da coluna da direita |
| empty | E16 — sem mensalidade | ✅ covered | A sanfona não aparece sem mensalidade a receber; a aba fica sem primário (Color → Accent, item 1) |
| loading | E16 — lançando o lote | ✅ covered | "Lançando…" com `disabled` (Copywriting → Ações, "A receber — lote") |
| error | E16 — falha e corrida | ✅ covered | "Não deu para lançar as mensalidades. Nenhuma venda foi criada…"; corrida: "{n} lançadas; {m} já estavam lançadas." (Erros; Toasts) |
| populated | E16 — lista do lote | ✅ covered | Sanfona aberta por padrão com "{nome} · {turma} · {mês} · {R$}" e o total no botão (Lote e A receber — linhas de leitura) |
| partial | E16 — mensalidade com venda cancelada e dispensada | 🧪 backstop | Ter uma mensalidade com a venda cancelada no Caixa e outra dispensada: conferir que a de venda cancelada entra no lote (volta a ser livre, D-08) e que a dispensada não entra (D-09) — o UI-SPEC não diz isso da sanfona com todas as letras |
| overflow | E16 — 40 mensalidades a 360px | 🧪 backstop | Semear 40 mensalidades e abrir A receber a 360px: conferir que a sanfona aberta não esconde as linhas de baixo atrás de uma rolagem interna e que o botão do lote continua alcançável no fim da lista |
| zero-one-many | E16 — lote de uma mensalidade | 🧪 backstop | Deixar uma só mensalidade a receber: conferir o singular em "Lançar todas as mensalidades de uma vez (1)" e no botão ("Lançar esta 1 na Venda · R$", não "Lançar estas 1") e no toast ("1 mensalidade lançada na Venda") |
| long-text | E16 — linha longa do lote | 🧪 backstop | Pessoa de nome com 160 caracteres numa turma de nome com 120: conferir a 320px que o item da lista do lote quebra sem estourar a borda tracejada |
| empty | E17 — nada dispensado, motivo vazio | ✅ covered | A sanfona "Dispensadas" não aparece com N = 0; o motivo é opcional (Estados vazios; Confirmações → Dispensar) |
| loading | E17 — dispensando, desfazendo, mais 20 | ✅ covered | "…ndo…" com `disabled`; 20 por vez + "Mostrar mais 20" (Layout → Aba A receber, item 4) |
| error | E17 — falhou | ✅ covered | Frase genérica "Não deu para {verbo}. Verifique a internet e tente de novo." (Copywriting → Erros, última linha) |
| populated | E17 — dispensadas | ✅ covered | "{nome} · {descrição}" + "dispensada por {quem} em {dd/mm} · {motivo}" + "Desfazer" (Lote e A receber — linhas de leitura) |
| partial | E17 — sem motivo | ✅ covered | Sem motivo, a sub-linha termina na data (Lote e A receber, "Dispensadas — linha") |
| overflow | E17 — muitas dispensadas | ✅ covered | 20 por vez + "Mostrar mais 20", mais recentes primeiro (Layout → Aba A receber, item 4) |
| zero-one-many | E17 — contador | ✅ covered | "Dispensadas ({N})" com N ≥ 1; some com 0 |
| long-text | E17 — motivo de 200 caracteres | 🧪 backstop | Dispensar com motivo de 200 caracteres e abrir a sanfona a 320px: conferir que a sub-linha quebra e o "Desfazer" continua inteiro; digitar 201 caracteres e conferir que aparece um erro embaixo do campo (o UI-SPEC fixa o limite, não a frase — sugestão: "O motivo pode ter até 200 caracteres.") |
| loading | E18 — registrando | ✅ covered | O botão tocado vira "Registrando…" e os três ficam `disabled` — toque duplo não cria duas vendas (Copywriting → Ações, "Recebi agora — forma") |
| error | E18 — falha e corrida | ✅ covered | "Não deu para registrar. Nenhuma venda foi criada…"; "Este item já foi lançado (venda nº {N})…" (Erros) |
| overflow | E18 — botões | ✅ covered | Três botões de 52px empilhados, largura total (Layout → Aba A receber, "Folha Recebi agora") |
| long-text | E18 — topo longo | 🧪 backstop | Abrir "Recebi agora" de uma pessoa de nome com 160 caracteres a 320px: conferir que o topo quebra e que os três botões de forma continuam visíveis sem rolar além de um gesto |
| empty | E19 — nenhum evento público | ✅ covered | Caixa neutra + a prévia do estado da 04.6 (Estados vazios, "No site"; D-11) |
| loading | E19 — No site | ✅ covered | Esqueleto: a moldura + 3 cartões (Carregando) |
| error | E19 — leitura ao vivo falhou | 🧪 backstop | Derrubar o banco depois de abrir a gestão e trocar para "No site": conferir que aparece o erro da Agenda ("Não deu para carregar a agenda…" + "Tentar de novo") e **não** o estado da D-11 — o componente do site cai em `AulasEOficinas` no erro, e na gestão isso diria "nenhuma aula pública" sem ser verdade |
| populated | E19 — com eventos | ✅ covered | O mesmo componente do site, lido ao vivo, na moldura (Layout → Aba No site; UI-D18) |
| partial | E19 — só o que é público | ✅ covered | Só eventos públicos, não cancelados, de hoje em diante, e o bloco de uso livre sem preço (Layout → Site; D-10) |
| overflow | E19 — largura | ✅ covered | A moldura vai até 1080px e segue os mesmos pontos de quebra do site (768, 880) (UI-D18) |
| zero-one-many | E19 — 0 e 1 evento | ✅ covered | 0 = estado da D-11; 1 = o calendário aparece (D-11: "aparece com o primeiro evento público") |
| long-text | E19 — textos | ✅ covered | Dica com quebra livre; os cartões seguem a regra do site (E25) |
| empty | E20 — mês sem nada | ✅ covered | Quadros zerados ("0 h", "—", "0", "0") e barras "0 h" (Estados vazios) |
| loading | E20 — Números | ✅ covered | Esqueleto: 4 quadros + 7 barras (Carregando) |
| error | E20 — Números | ✅ covered | Mesmo `error.tsx` da página |
| populated | E20 — com dados | ✅ covered | Quatro números em Display e as sete barras com "{v} h" escrito ao lado (Layout → Aba Números) |
| partial | E20 — sem presença marcada | ✅ covered | Presença "—" e "nenhuma presença marcada" (UI-D22) |
| overflow | E20 — quadros a 360px | 🧪 backstop | Semear um mês com 1.234 horas-pessoa e abrir Números a 360px (2 × 2): conferir que "PRESENÇA NAS AULAS" quebra em duas linhas sem cortar e que "1.234 h" em Display cabe no quadro |
| zero-one-many | E20 — plurais | ✅ covered | "1 visita" / "n visitas", "1 falta" / "n faltas" (Números) |
| long-text | E20 — rótulos | ✅ covered | Rótulos fixos em caixa alta e títulos fixos; nada vem do usuário |
| empty | E21 — dia sem nada | ✅ covered | "Nada marcado para hoje. O espaço está livre." + a faixa "Agora no espaço: 0 pessoas" (Estados vazios, Início) |
| loading | E21 — bloco | ✅ covered | `BlocoEsqueleto` no `Suspense` da página (já existe) |
| error | E21 — bloco | ✅ covered | "Não deu para carregar a agenda de hoje." + "Tentar de novo" só no bloco (já existe; D-09 da 04.6) |
| populated | E21 — dia cheio | ✅ covered | Até 6 linhas, fechado primeiro, cada uma abre a folha do evento (UI-D19) |
| partial | E21 — cancelada, presença pendente, fechado | ✅ covered | Cancelada riscada com a tag; "marcar presença" depois do início; fechado com o motivo (Layout → Bloco do Início) |
| overflow | E21 — mais de 6 | ✅ covered | "e mais {N}" → a semana de hoje (Layout → Bloco do Início) |
| zero-one-many | E21 — "Agora no espaço" | ✅ covered | "0 pessoas" / "1 pessoa" / "{n} pessoas" por `ocupacaoDoEspaco` (já existe); 6 linhas ou 6 + "e mais 1" |
| long-text | E21 — título da linha | ✅ covered | `line-clamp-1` no título; a linha inteira é link e o nome acessível traz o texto todo (Layout → Bloco do Início) |
| empty | E22 — nenhum cliente | ✅ covered | "Nenhum cliente cadastrado ainda." + corpo + "Novo cliente" (Estados vazios) |
| loading | E22 — carregando Clientes | 🧪 backstop | Abrir `/gestao/cadastros?sub=clientes` com a rede lenta (DevTools "Slow 3G"): conferir que aparece esqueleto no formato da lista (busca + linhas), nunca a tela em branco — o UI-SPEC não desenha o esqueleto desta sub-aba |
| error | E22 — Clientes não carregou | 🧪 backstop | Derrubar o banco e abrir a sub-aba: conferir uma frase humana própria (sugestão: "Não deu para carregar os clientes. Verifique a internet e tente de novo.") + "Tentar de novo", e não a frase de outra sub-aba |
| populated | E22 — lista | ✅ covered | Nome, telefone e "Editar" por linha; 50 por vez + "Mostrar mais 50" (Layout → Cadastros) |
| partial | E22 — sem telefone | ✅ covered | A linha mostra só o nome (Layout → Cadastros) |
| overflow | E22 — sub-abas a 320px | ✅ covered | 3 + 3 com o espaçador e `md:max-w-xl` no desktop (UI-D20) |
| zero-one-many | E22 — 50 e 51 clientes | 🧪 backstop | Conferir que "Mostrar mais 50" só aparece acima de 50 |
| long-text | E22 — nome longo e pílula | 🧪 backstop | A 320px, conferir que "Clientes" cabe na primeira fileira (Catálogo · Categorias · Clientes) sem quebrar dentro da pílula, e que um cliente de nome com 160 caracteres quebra com o "Editar" inteiro à direita |
| loading | E23 — diálogo do item | ✅ covered | O diálogo de editar do Catálogo, sem mudança de carregamento (já existe) |
| error | E23 — tentar desativar | ✅ covered | "Este item é usado pela Agenda e não se desativa…" (a frase do gatilho chega à tela — Erros) |
| overflow | E23 — chips | ✅ covered | Chip "do sistema" no `flex-wrap` de chips que a lista já tem |
| long-text | E23 — nome editado longo | ✅ covered | Nome editável com o limite do Catálogo; a linha explicativa quebra livre (Layout → Cadastros, Catálogo) |
| empty | E24 — Venda preenchida | ✅ covered | Pessoa travada, linha de origem já no carrinho, à vista em aberto com o vencimento (Layout → Venda aberta pela Agenda) |
| loading | E24 — abrindo a Venda com origem | 🧪 backstop | Ter uma venda em montagem no `sessionStorage`, tocar "Lançar na Venda" na Agenda com a rede lenta: conferir que o carrinho da origem aparece direto, sem piscar o carrinho em montagem antes (Pitfall 10) |
| error | E24 — origem já lançada ou não achada | ✅ covered | "Este item da Agenda já virou a venda nº {N}." + "ver no Caixa" / "Não achei este item da Agenda…" (Erros) |
| partial | E24 — havia venda em montagem | ✅ covered | Segunda linha da faixa "A venda que estava em montagem continua guardada…" só quando havia (UI-D26) |
| overflow | E24 — faixa a 320px | 🧪 backstop | Abrir a Venda de uma mensalidade de turma com nome de 120 caracteres a 320px: conferir que a faixa "Da Agenda · …" quebra e o "Voltar à Agenda" continua com 44px |
| long-text | E24 — pessoa travada longa | 🧪 backstop | Pessoa de nome com 160 caracteres: conferir que o campo travado mostra o nome inteiro (quebra ou rola dentro do campo) e que a dica "vem da Agenda" continua visível |
| empty | E25 — nenhum evento público / sem banco | ✅ covered | A seção é exatamente o `AulasEOficinas` de hoje (D-11; Layout → Site, último parágrafo) |
| loading | E25 — Próximas | ✅ covered | É ISR: chega pronto, sem esqueleto; sem JavaScript só "Próximas" (Carregando; Layout → Site, item 1) |
| error | E25 — banco fora | ✅ covered | `try/catch` cai no estado da 04.6 (D-11; pesquisa A10) |
| populated | E25 — lista | ✅ covered | Até 10 cartões, turma uma vez na posição da próxima data, "e mais {N} no calendário" (Layout → Site, item 2) |
| partial | E25 — esgotado, turma, oficina | ✅ covered | Esgotado sem o botão; turma com vagas da turma − alunos ativos (D-12); preço por mês / por pessoa (D-10) |
| overflow | E25 — largura | ✅ covered | Uma coluna abaixo de 768px, duas a partir dele (Layout → Site, item 2) |
| zero-one-many | E25 — um evento só | 🧪 backstop | Deixar um único evento público e abrir o site a 1280px: conferir que o cartão sozinho na grade de duas colunas não fica esticado nem desalinhado, e os rótulos "1 vaga"/"última vaga" e "2 vagas"/"últimas 2 vagas" |
| long-text | E25 — título longo e mensagem | 🧪 backstop | Lançar uma oficina pública de nome com 120 caracteres e abrir o site a 320px: conferir que o título em Fraunces 22px quebra sem estourar o cartão, e que o link do WhatsApp leva a mensagem inteira ("Oi! Quero reservar: {nome} (…).") |
| empty | E26 — mês sem evento | ✅ covered | "Nada marcado neste mês ainda." (Estados vazios, site) |
| loading | E26 — trocar de mês | ✅ covered | Estado de cliente com os dados já recebidos: nenhuma requisição por mês (Layout → Site; pesquisa Pergunta 10) |
| error | E26 — banco fora | ✅ covered | A seção inteira cai no estado da 04.6 (D-11) |
| populated | E26 — grade e lista | ✅ covered | Pontos por tipo (oficina com contorno, esgotado vazado, fechado), legenda, lista "Em {mês}" ou do dia escolhido (Layout → Site, item 3) |
| partial | E26 — dia fechado, dia sem nada, limites | ✅ covered | "Fechado neste dia."; dia sem nada não é botão; "‹" desabilitado no mês de hoje e "›" no 6º mês com `sr-only` |
| overflow | E26 — célula do site a 320px | 🧪 backstop | Abrir o Calendário a 320px num dia com 4 eventos públicos: a célula fica com ~33px de largura (320 − margens − padding do painel); conferir que os pontos quebram dentro dos 48px e que o número não é coberto |
| zero-one-many | E26 — lista | ✅ covered | Turma uma vez na lista do mês; tocar de novo no dia desmarca (Layout → Site, item 3) |
| long-text | E26 — títulos | ✅ covered | "{mês} de {aaaa}" e "{dia da semana}, {dd/mm}" são formatos fixos; cartões como E25 |
| overflow | E27 — bloco de uso livre | ✅ covered | `CartaoDoSite` que já existe + botão de contorno com `flex-wrap` (Layout → Site, item 5) |
| long-text | E27 — textos | ✅ covered | Texto fixo `agLivre` do arquivo de conteúdo; nada vem do usuário |
| loading | E28 — confirmando | ✅ covered | "Cancelando…" / "Desativando…" / "…ndo…", os dois botões desabilitados (Confirmações; Carregando) |
| error | E28 — confirmação falhou | 🧪 backstop | Derrubar a rede e confirmar "Desativar turma": conferir que o diálogo continua aberto com a frase "Não deu para desativar…" dentro dele e que nada mudou na turma — o UI-SPEC não diz onde o erro de uma confirmação aparece |
| overflow | E28 — botões a 320px | 🧪 backstop | Abrir cada confirmação a 320px: conferir que os dois botões ("Manter a data" · "Cancelar esta data", "Manter na turma" · "Tirar da turma") empilham ou cabem, com 44px, sem rolagem lateral |
| long-text | E28 — nome longo no título | 🧪 backstop | "Desativar {turma}?" com turma de 120 caracteres e "Tirar {nome} de {turma}?" com nome de 160 a 320px: conferir que o título quebra e os botões continuam visíveis |
| loading | E29 — "Desfazer" do toast | 🧪 backstop | Cancelar uma data sem presença e tocar duas vezes rápido no "Desfazer" do toast: conferir que só um desfazer acontece e que o toast some (ou mostra o resultado) depois do primeiro toque |
| error | E29 — "Desfazer" falhou | 🧪 backstop | Cancelar uma data, derrubar a rede e tocar "Desfazer": conferir uma frase humana (sugestão: "Não deu para desfazer. A data continua cancelada — use "Desfazer cancelamento" na folha.") — o UI-SPEC não fixa essa frase |
| overflow | E29 — posição | ✅ covered | Toast acima da barra inferior por `--deslocamento-aviso` (Herdado) |
| long-text | E29 — toast longo | 🧪 backstop | Lançar uma turma de 8 semanas com 2 datas em dia fechado: conferir a 320px que "Turma lançada, com as próximas 8 aulas. 2 delas caem num dia fechado (…)" cabe no toast em 5 s legíveis e com concordância certa (o UI-SPEC escreve "{k} delas cai") |
| empty | E30 — sem consumo do uso livre | ✅ covered | "Para onde foi" e histórico do Estoque sem mudança de estado vazio (Fase 06); a barra nova aparece com o dado |
| loading | E30 — Estoque | ✅ covered | Carregamento do Estoque sem mudança (Fase 06) |
| error | E30 — Estoque | ✅ covered | Erros do Estoque sem mudança (Fase 06) |
| populated | E30 — sexta barra e linha | ✅ covered | "Uso livre do espaço" (área Espaço) no "Para onde foi"; linha 2 do histórico "Uso livre do espaço · {nome} · {dd/mm}" (Layout → Estoque) |
| partial | E30 — folha de baixa | ✅ covered | A folha de baixa continua com os cinco destinos — "Uso livre do espaço" só a Agenda grava (Layout → Estoque) |
| overflow | E30 — barras | ✅ covered | Mesmo desenho e mesma régua das barras da Fase 06 |
| zero-one-many | E30 — contagens | ✅ covered | Formatos de quantidade e dinheiro da Fase 06, sem mudança |
| long-text | E30 — nome longo no histórico | 🧪 backstop | Encerrar um uso livre de uma pessoa de nome com 160 caracteres e abrir o histórico do Estoque a 320px: conferir que "Uso livre do espaço · {nome} · {dd/mm}" quebra sem empurrar a quantidade da direita |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | `dialog`, `alert-dialog`, `button`, `input`, `select`, `checkbox`, `field`, `label`, `skeleton`, `sonner`, `card`, `separator` | not required — todos já instalados e aprovados em fases anteriores (02b, 04.2, 04.3, 04.4, 06, 06.1), mesma cadeia (radix-nova, CLI 3.8.5) |

Nenhum registro de terceiros declarado (`components.json` → `"registries": {}`, conferido em
01/10/2026). Nenhum bloco novo instalado nesta fase.

---

## Assunções e Desvios Deliberados

1. **Breakpoints:** 375px (célula do mês atinge 44px de largura), 640px (Números em 4 colunas),
   768px (folhas centralizadas; abas numa fileira; Próximas em duas colunas), 880px (calendário do
   site lado a lado — herdado do protótipo do site). Nenhum outro.
2. **Alvos de 28–38px do protótipo sobem para 44px**; 52px (células do mês, formas de pagamento,
   segmentados) e 64px (cartão) ficam.
3. **Micro (12px) não é usado** na plataforma; no site, nada novo abaixo de 14px.
4. **Nenhum hex solto entra** — nem na plataforma nem no site. A única mudança de token é a
   **referência** `--color-site-ambar: var(--color-atencao)` no bloco do site (UI-D17), com a linha
   nova em `tests/unit/tokens.test.ts`.
5. **"Hoje" e "agora" vêm do servidor** (`hojeEmBrasilia`, `agoraEmBrasilia`), nunca do relógio do
   celular; toda data exibida em `America/Sao_Paulo`. A semana começa na segunda (herdado).
6. **Aula/oficina avulsa não se edita** depois de lançada (o protótipo só cancela; pesquisa, "Também
   fora"). Erro de digitação = cancelar e lançar de novo. A turma se edita pela folha da turma (D-03).
7. **Formato de hora:** na gestão, "19:00" (`tabular-nums`, como o protótipo); no site, "19h às 21h" /
   "19h30" (AGE-18, "toda terça, 19h às 21h").
8. **Limites de campo** (Zod no servidor): nome de turma/aula e motivo 1–120; nome de pessoa 1–160;
   telefone até 40; motivo de dispensa até 200; vagas 1–999; semanas 1–52; vencimento 1–28; horas
   previstas 1–12; pessoas 1–50; valores pelos conversores de `lib/financeiro/dinheiro.ts` (maior que
   zero); quantidade de material por `converterQuantidade` (milésimos, maior que zero).
9. **A janela pública do site é de hoje até o fim do 6º mês** (A11 da pesquisa); a navegação do
   calendário do site fica dentro dela.
10. **"Agora no espaço"** segue a regra da D-05 refinada pela D-18; nada na linha muda de forma.
11. **A conferência humana do valor central** (presença de uma turma inteira em pé, no celular; encerrar
    um uso livre em dois toques; "Recebi agora" em dois toques) fica para o portão da fase.

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: FLAG → PASS (recomendações aplicadas pelo orquestrador em 01/10/2026: "Manter o material" / "Tirar o material", "Dispensar a cobrança", "Voltar à agenda" no lugar de "Fechar" nas folhas do fechado e do uso livre encerrado, um só "Cancelar esta data" em data de turma que cai em dia fechado, "Este dia" nos dois avisos da D-13, singular "1 lançamento")
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: FLAG aceito — o 700 vem só do token travado do Display (04-DESIGN-SYSTEM.md §4), registrado na linha dos pesos
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-10-01 — `gsd-ui-checker` (Opus), leitura declarada: UI-SPEC 1–1394 inteiro e CONTEXT 1–264 inteiro; RESEARCH só a Standard Stack (214–253) e o protótipo por grep de `toast(` e rótulos de botão. Decisões D-01..D-18 conferidas uma a uma, sem contradição.

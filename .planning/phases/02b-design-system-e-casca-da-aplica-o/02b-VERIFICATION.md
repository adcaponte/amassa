---
phase: 02b-design-system-e-casca-da-aplica-o
verified: 2026-08-09T14:00:00Z
revalidated_after_commits: [90ca3f2, f73a7ef, f503dc3, 99efa74]
status: passed
score: 5/5 critérios de sucesso verificados (código); 3 itens aguardando conferência do dono
behavior_unverified: 0
overrides_applied: 0
human_verification:

  - test: "UI-05 — navegação confortável com o polegar, num celular de verdade, em pé"
    expected: "Todo alcance (Início, Encomendas, Agenda, Queimas, Estoque, avatar, Sair) é confortável, sem esticar nem trocar a pega da mão"
    why_human: "Não é medível por teste automatizado — é o próprio Core Value do projeto. Já documentado em 02b-VERIFICACAO-HUMANA.md, Item 1, pendente do dono."

  - test: "D-05 — a voz das quatro frases de estado vazio escritas nesta fase (Agenda, Queimas, Estoque, Orçamentos) soa como o AMASSA"
    expected: "Afetiva, sensorial, direta — nunca corporativa, no padrão de 'A roda ainda não gira.'"
    why_human: "Julgamento de voz/tom não é verificável por máquina. Documentado em 02b-VERIFICACAO-HUMANA.md, Item 2, pendente do dono."

  - test: "Olhada geral nas dez telas — cores, tipografia condensada e legibilidade sob luz forte, no celular e no desktop"
    expected: "Cores, tipografia e legibilidade batem com o que o dono esperava ao aprovar 04-DESIGN-SYSTEM.md"
    why_human: "Contraste numérico já confirmado por axe-core; a experiência de luz ambiente real não é simulável por ferramenta. Documentado em 02b-VERIFICACAO-HUMANA.md, Item 3, pendente do dono."
---

# Phase 2b: Design System e Casca da Aplicação — Relatório de Verificação

**Meta da fase:** Navegar por telas vazias de todos os módulos já com a identidade visual do
AMASSA aplicada, no celular e no desktop.
**Verificado:** 2026-08-08
**Status:** `human_needed` — todo o código está correto e provado; três itens de julgamento humano
(UI-05, D-05, olhada geral) seguem pendentes do dono, exatamente como a própria fase já registrou
em `02b-VERIFICACAO-HUMANA.md`. Não é reprovação nem aprovação por presunção.
**Re-verificação:** Não — verificação inicial.

## Metodologia

Verificação goal-backward, feita contra o código em disco e contra a execução real das
ferramentas — não contra o relato dos SUMMARY.md. Toda alegação abaixo tem o comando ou o arquivo
que a sustenta. UI-10 e UI-11 (Fase 7) não foram cobrados aqui, por decisão explícita do
ROADMAP.md.

---

## Comandos executados por este verificador (não presumidos)

| Comando | Resultado |
|---|---|
| `npm run lint` | ✅ saiu com 0, sem nenhum warning (`--max-warnings=0`) |
| `npx tsc --noEmit` | ✅ saiu com 0, sem nenhuma saída |
| `npm run verificar-acoes` | ✅ "2 ação(ões) conferida(s), 0 violações" — nota: este portão só varre funções `"use server"`, não páginas (confirmado lendo `scripts/verificar-acoes.mjs`); a conferência de `exigirUsuario()` nas páginas foi feita por leitura direta do código-fonte, abaixo |
| `npm test` | ✅ 128/128 testes de unidade passando (10 arquivos) |
| `npm run build` | ✅ build de produção completo, 11 rotas geradas, sem erro |
| `npm run test:e2e` | ⚠️ 88 passaram, 2 falharam — as duas falhas são exatamente `tests/e2e/autenticacao.spec.ts:72` ("a sexta tentativa..."), nos projetos `desktop` e `celular`, com o mesmo sintoma (`page.waitForResponse` estourando 60s) já documentado em `deferred-items.md` e `.planning/WINDOWS.md` (id 3) como bug pré-existente da Fase 2a, confirmado independente da 02b por `--grep-invert`. **Não é uma lacuna da Fase 2b** — nenhum teste de `casca.spec.ts`, `design-system.spec.ts`, `estados.spec.ts` ou `acessibilidade.spec.ts` falhou. |

---

## Critérios de Sucesso (ROADMAP.md, Fase 2b)

| # | Critério | Status | Evidência |
|---|----------|--------|-----------|
| 1 | Cores e fontes do AMASSA, não o padrão do Tailwind, em todo componente shadcn instalado | ✅ VERIFICADO | `app/globals.css` contém os dois blocos `@theme`/`@theme inline` literais de `04-DESIGN-SYSTEM.md` §2, incluindo as 8 `--color-sidebar-*` (linhas 128-138) e `--color-tinta-fraca: #6E5F56` (não `#8A7A70`). `tests/e2e/design-system.spec.ts` mede `getComputedStyle` no navegador e passou nos dois projetos (casos "botão 'Entrar' resolve para o terracota", "o body resolve para o fundo areia", "o título 'AMASSA' usa Archivo Narrow, e o corpo usa Inter") |
| 2 | 5 itens da barra inferior abrem sua tela no celular; barra lateral de 240px com os mesmos itens + menu do usuário no desktop; Orçamentos só no menu do usuário | ✅ VERIFICADO | `lib/navegacao/itens.ts` define `ITENS_NAVEGACAO` com exatamente 5 itens (Início/Encomendas/Agenda/Queimas/Estoque), nenhum apontando para `/orcamentos` (`tests/unit/navegacao.test.ts`, 8/8). `components/amassa/barra-lateral.tsx` usa `SidebarProvider` com `--sidebar-width: 240px` e `collapsible="none"` (D-12). `menu-usuario.tsx` só tem 3 itens (nome, Orçamentos, Sair). `tests/e2e/casca.spec.ts` prova em execução real: "a navegação principal visível tem exatamente 5 itens, na ordem...", "cada item leva a sua rota...", "Orçamentos não aparece na navegação principal e só é alcançável pelo menu do usuário", "no desktop, a barra lateral tem largura fixa de 240px" — todos passando, dois projetos |
| 3 | Navegação confortável com o polegar no celular; nenhuma tela exige rolagem horizontal | ⚠️ PARCIAL | Rolagem horizontal: ✅ VERIFICADO por máquina — `tests/e2e/casca.spec.ts` e `tests/e2e/acessibilidade.spec.ts` confirmam ausência de rolagem horizontal a 320px nas sete rotas da fase, dois projetos. Conforto do polegar (UI-05): não é medível por teste automatizado — **pendente de conferência do dono num celular de verdade**, registrado em `02b-VERIFICACAO-HUMANA.md` Item 1 |
| 4 | Toda tela tem vazio com frase+botão, carregamento com esqueleto, erro humano; remoção pede confirmação nomeando o que se perde | ✅ VERIFICADO | `components/amassa/estado-vazio.tsx`, `estado-erro.tsx`, `app/(app)/loading.tsx` existem e são usados nas 6 páginas de módulo/painel + `app/(app)/error.tsx` + `app/not-found.tsx`/`app/(app)/not-found.tsx`. `tests/e2e/casca.spec.ts` prova "cada tela de módulo tem cabeçalho, estado vazio com frase de contexto e botão inerte com nota" e `tests/e2e/estados.spec.ts` prova o 404 e o link de volta. UI-08 (confirmação destrutiva) está registrada como convenção obrigatória em `docs/convencoes-de-interface.md` — não implementada ainda por decisão consciente D-07 (não há nada para excluir nesta fase); `alert-dialog`/`sonner` confirmadamente **não instalados** (nem em `package.json`, nem em `components/ui/`) |
| 5 | Alvos de toque ≥ 44px, contraste AA, navegação por teclado, `aria-label` em botão só com ícone | ✅ VERIFICADO | `tests/e2e/acessibilidade.spec.ts`: alvo de toque medido por `boundingBox()` na barra inferior, avatar e barra lateral (todos ≥ 44px); varredura `axe-core` (color-contrast, button-name, link-name, aria-allowed-attr) sobre as 7 rotas da fase — **zero violações**, confirmado na execução real deste verificador; navegação completa por Tab/Enter do e-mail até "Entrar" e do corpo da página até o menu do usuário; `getByRole('button', {name: 'Abrir menu do usuário'})` encontra exatamente 1 elemento no celular |

**Nota sobre o Critério 3:** a parte medível por máquina (ausência de rolagem horizontal) está
100% provada. A parte de julgamento humano (conforto do polegar) é exatamente o tipo de item que
esta tarefa de verificação foi instruída a não aprovar nem reprovar por presunção — fica como
`human_needed`.

---

## Requisitos UI-01 a UI-09

| Requisito | Descrição | Status | Evidência |
|---|---|---|---|
| UI-01 | Cores e fontes do AMASSA em todo componente shadcn | ✅ VERIFICADO | Ver Critério 1. `tests/e2e/design-system.spec.ts` passou nos dois projetos nesta execução |
| UI-02 | Barra inferior com 5 itens no celular | ✅ VERIFICADO | Ver Critério 2. `tests/unit/navegacao.test.ts` + `tests/e2e/casca.spec.ts` |
| UI-03 | Barra lateral de 240px + menu do usuário no rodapé, no desktop | ✅ VERIFICADO | `components/amassa/barra-lateral.tsx` (`--sidebar-width: 240px`, `collapsible="none"`) + `tests/e2e/casca.spec.ts` ("a barra lateral tem largura fixa de 240px") |
| UI-04 | Orçamentos só no menu do usuário | ✅ VERIFICADO | `ITENS_NAVEGACAO` não contém `/orcamentos`; `menu-usuario.tsx` tem o link; `tests/e2e/casca.spec.ts` prova a ausência na navegação principal e a presença no menu, dois projetos |
| UI-05 | Navegação confortável com o polegar | ⚠️ PENDENTE (dono) | Não é medível por máquina (reconhecido desde o `02b-UI-SPEC.md`). Registrado em `02b-VERIFICACAO-HUMANA.md` Item 1, ainda sem resultado preenchido |
| UI-06 | Nenhuma rolagem horizontal no celular | ✅ VERIFICADO | `tests/e2e/casca.spec.ts` + `tests/e2e/acessibilidade.spec.ts`, sete rotas, 320px, dois projetos, execução real confirmada nesta verificação |
| UI-07 | Vazio com frase+botão, esqueleto, erro humano em toda tela | ✅ VERIFICADO | `estado-vazio.tsx`, `estado-erro.tsx`, `loading.tsx` existem, são usados e têm prova e2e (`casca.spec.ts`, `estados.spec.ts`) |
| UI-08 | Remoção pede confirmação nomeando o que se perde | ✅ VERIFICADO (como convenção, D-07) | `docs/convencoes-de-interface.md` contém o formato literal ("Excluir {item}? ...") e o exemplo "Coleção Verão"; nenhuma implementação real existe ainda porque nenhuma exclusão existe nesta fase — decisão consciente e documentada, não lacuna |
| UI-09 | 44px, contraste AA, teclado, `aria-label` em botão só com ícone | ✅ VERIFICADO | `tests/e2e/acessibilidade.spec.ts`, execução real confirmada: alvo de toque, `axe-core` (0 violações), teclado, nome acessível |

---

## Verificações adicionais do escopo pedido

### `app/globals.css` — tokens e mapeamento `@theme inline`

Lido diretamente do arquivo em disco (não do SUMMARY). Confirma:

- Os 8 `--color-sidebar-*` presentes (linhas 131-138): `--color-sidebar`, `--color-sidebar-foreground`, `--color-sidebar-primary`, `--color-sidebar-primary-foreground`, `--color-sidebar-accent`, `--color-sidebar-accent-foreground`, `--color-sidebar-border`, `--color-sidebar-ring`.
- `--color-acento: #894025`, `--color-fundo: #F6F3F0`, `--color-tinta-fraca: #6E5F56` (não a versão que reprova AA), `--radius-xl: 18px` — todos literais, sem alteração.
- Todas as cores "NÃO ALTERAR" (etapa, modalidade, tipo de queima, nível de forno) presentes intactas, mesmo sem uso nesta fase.

### As seis rotas + `/orcamentos` com `exigirUsuario()` como primeira instrução

Como instruído, `npm run verificar-acoes` **não cobre páginas** (só funções `"use server"`) — a
conferência foi feita lendo cada arquivo:

| Arquivo | Primeira instrução do corpo |
|---|---|
| `app/(app)/page.tsx` | `const usuario = await exigirUsuario();` ✅ |
| `app/(app)/layout.tsx` | `const usuario = await exigirUsuario();` ✅ (a casca inteira passa pelo portão) |
| `app/(app)/encomendas/page.tsx` | `await exigirUsuario();` ✅ |
| `app/(app)/agenda/page.tsx` | `await exigirUsuario();` ✅ |
| `app/(app)/queimas/page.tsx` | `await exigirUsuario();` ✅ |
| `app/(app)/estoque/page.tsx` | `await exigirUsuario();` ✅ |
| `app/(app)/orcamentos/page.tsx` | `await exigirUsuario();` ✅ |

Todas as sete confirmadas.

### Casca de navegação

- `app/(app)/layout.tsx`: monta `BarraLateral`/`BarraInferior`/`CabecalhoMovel`, chama `exigirUsuario()` uma vez e passa `usuario.nome`.
- `components/amassa/barra-lateral.tsx`: `SidebarProvider` local com `--sidebar-width: 240px`, `Sidebar collapsible="none"` — fixa, não recolhível (D-12 ✅).
- `components/amassa/menu-usuario.tsx`: exatamente 3 itens (nome, Orçamentos, Sair); Orçamentos **não** está em `ITENS_NAVEGACAO` — confirmado por leitura de `lib/navegacao/itens.ts` e por `tests/unit/navegacao.test.ts`.

### `alert-dialog`/`sonner` — confirmado ausente (D-07)

- `grep -i "sonner\|alert-dialog" package.json` → nenhum resultado.
- `components/ui/alert-dialog.tsx` → não existe.
- Nenhum `from "sonner"` em `app/` ou `components/`.
- UI-08 documentada como convenção obrigatória em `docs/convencoes-de-interface.md` §1, com o formato literal e o exemplo da fonte.

### Nenhuma fonte licenciada versionada

- `git ls-files '*.woff' '*.woff2' '*.otf' '*.ttf'` → nenhuma linha. As duas fontes (Archivo Narrow, Inter) entram por `next/font/google` em `app/layout.tsx`, baixadas no build.

### Cobertura de `## UI Considerations` do UI-SPEC

41 considerações aplicáveis: 36 `covered`, 2 `backstop`, 3 `dismissed`. Os 3 `dismissed` (E5
populated/partial, zero-one-many "muitos") são decisões corretas — não há dado real nesta fase, e
inventar contrato para dado inexistente seria pior. Os 2 `backstop` (truncamento de nome longo em
E2/E3) **foram convertidos em teste automatizado real** nesta execução (`tests/e2e/acessibilidade.spec.ts`,
caso "nome de usuário longo trunca em uma linha com reticências..."), confirmado passando nos dois
projetos nesta verificação — não ficaram como pendência sem prova.

### `git diff` de arquivos sensíveis

`git diff --exit-code lib/auth/ middleware.ts` → retorna 0. Nenhum arquivo de autenticação foi
tocado por esta fase, como as SUMMARYs alegam.

---

## Achado não-bloqueante (fora dos 5 critérios e de UI-01..09)

**Cabeçalho móvel mostra "AMASSA" fixo, não o título da página atual.** O `02b-UI-SPEC.md`,
seção "Cabeçalho móvel", especifica: "Conteúdo: título da página (papel título, à esquerda) +
botão de avatar". Na implementação (`app/(app)/layout.tsx` → `<CabecalhoMovel nome={usuario.nome} />`,
sem passar `titulo`), `components/amassa/cabecalho-movel.tsx` usa o padrão `titulo = "AMASSA"` em
toda tela — o cabeçalho fixo do celular sempre mostra "AMASSA", nunca "Encomendas"/"Agenda"/etc.
(o `<h1>` correto de cada tela aparece um pouco abaixo, via `CabecalhoPagina`, dentro da área de
conteúdo). Isso não quebra nenhum dos 5 critérios de sucesso nem nenhum UI-01..09 literalmente —
nenhum teste da fase falhou por causa disso, porque nenhum teste verifica esse texto — mas é uma
divergência real do contrato de UI que nenhuma SUMMARY registrou como decisão consciente. Não é
bloqueio de fase; fica registrado para o dono decidir se corrige agora ou aceita como está.

---

## Itens explicitamente pendentes do dono (não resolvidos por este verificador)

Conforme instruído, os três itens abaixo — já registrados em `02b-VERIFICACAO-HUMANA.md` — são
reportados como **pendentes**, não como aprovados nem reprovados:

1. **UI-05** — navegação confortável com o polegar, num celular de verdade, em pé.
2. **D-05** — se a voz das quatro frases novas (Agenda, Queimas, Estoque, Orçamentos) soa como o
   AMASSA.

3. **Olhada geral** nas dez telas — cores, tipografia condensada, legibilidade sob luz forte.

O campo "Resultado" de cada item em `02b-VERIFICACAO-HUMANA.md` segue em branco (`_(a preencher
pelo dono)_`) — confirmado por leitura do arquivo nesta verificação.

---

## Resumo do veredito

**Todo critério verificável por código, teste ou execução real foi verificado e passou.** Os
cinco critérios de sucesso do ROADMAP.md e os nove requisitos UI-01 a UI-09 têm evidência concreta
— arquivo, teste nomeado ou comando executado por este verificador, não o relato das SUMMARYs.

A fase **não pode ser fechada como `passed`** porque três itens de julgamento humano — UI-05, D-05
e a olhada geral — seguem genuinamente pendentes do dono, exatamente como a própria fase já havia
identificado e documentado (não é uma lacuna descoberta agora). A recomendação é: quando o dono
retornar, preencher `02b-VERIFICACAO-HUMANA.md` e, se tudo for aprovado, esta fase pode ser
considerada `passed` sem nenhum trabalho de código adicional.

**Não é uma fase da Fase 2b:** a falha intermitente de `tests/e2e/autenticacao.spec.ts:72`
("sexta tentativa de bloqueio") é um problema pré-existente da Fase 2a (rate-limiting/argon2id sob
carga), confirmado de forma independente em três execuções de plano distintas via
`--grep-invert`, e documentado em `deferred-items.md` e `.planning/WINDOWS.md` (id 3, status
`open`). Reproduzido de novo nesta verificação (2/90 falhas, ambas este mesmo caso, nos dois
projetos) — consistente com o padrão já relatado. Fica como item aberto do projeto, não como gap
desta fase.

---

## Adendo — lacuna encontrada nesta verificação e já fechada

A verificação apontou um desvio que nenhum dos cinco planos cobriu e nenhum teste pegava: o
cabeçalho do celular renderizava a string fixa `"AMASSA"` onde `02b-UI-SPEC.md` §"Cabeçalho móvel"
pede **o título da tela**. O componente `CabecalhoMovel` já nascera com a prop `titulo`, mas
`app/(app)/layout.tsx` nunca a passava — o suporte existia, a ligação não. Sobreviveu às cinco
ondas porque o valor errado era constante, e nenhuma asserção olhava para ele.

**Fechada** no commit `99efa74`, sob a autorização que o dono deixou ao se ausentar (aplicar
decisões com opção claramente recomendada). O título passou a ser derivado dentro do próprio
componente cliente, via `usePathname()` contra `ehItemAtivo`/`ITENS_NAVEGACAO` — o mesmo matcher
que a barra inferior e a lateral já usam, então o sistema tem **uma só fonte de verdade** para "em
que tela estou". `/orcamentos`, deliberadamente fora de `ITENS_NAVEGACAO` por UI-04, é resolvido
pelo mesmo `ehItemAtivo` em vez de uma segunda forma de comparar rota. Caminho não reconhecido cai
em `"AMASSA"`. A prop `titulo` continua valendo como override explícito. `app/(app)/layout.tsx`
não foi tocado.

**Prova:** novo caso em `tests/e2e/casca.spec.ts` que visita `/encomendas` e `/queimas` e confere o
título no cabeçalho em cada uma — **duas rotas distintas de propósito**, porque o defeito original
era justamente um valor constante que passaria numa asserção de rota única. Verde nos projetos
desktop e celular. Suíte completa depois da correção: `lint`, `tsc`, `verificar-acoes`,
`npm test` (128/128) e `build` limpos; e2e 91/92, sendo a única falha o flake pré-existente da
Fase 2a já descrito acima.

Este adendo não altera o veredito: os cinco critérios e os nove requisitos seguem verificados, e a
fase segue pendente apenas dos três itens de julgamento humano.

---

## Revalidação — o UAT e três commits posteriores

Este relatório foi escrito antes do UAT e antes de três commits que mudaram como seis componentes
renderizam. Marcar a fase como verificada com base nele, sem revalidar, seria aceitar um relatório
que precede as mudanças. Foi revalidado.

### O que fechou no UAT (`02b-UAT.md`, 7/7, zero problemas)

Os três itens que estavam `human_needed` foram resolvidos pelo dono:

- **UI-05** — testado no celular contra o site publicado, com conta de gestor real. Os cinco itens
  da barra inferior alcançam confortavelmente. Sobre o "Sair" ficar no canto superior, o dono
  avaliou e considerou irrelevante: a sessão dura 30 dias, ninguém desloga na prática, e abrir o
  app já logado é o comportamento desejado. **Decisão de produto, não concessão.**
- **D-05** — as quatro frases de estado vazio aprovadas como definitivas.
- **Olhada geral** — dez superfícies percorridas, desktop e janela estreita.

### Defeito encontrado pelo UAT e corrigido

`99efa74` — o cabeçalho do celular mostrava a string fixa `"AMASSA"` onde o contrato pede o título
da tela. O componente já tinha a prop `titulo`; o layout nunca a passava. Corrigido derivando de
`usePathname()` contra `ehItemAtivo`/`ITENS_NAVEGACAO`, com teste em **duas rotas distintas** —
porque o defeito era um valor constante, e uma rota só não distingue constante de derivado.

### Defeito maior, encontrado ao fechar D-13

Aplicar o logo em SVG removeu o último elemento do sistema com `font-titulo` — e revelou que
**os seis títulos reais nunca estiveram em Archivo Narrow**. Os papéis `--text-display`/`--text-titulo`
do Tailwind v4 carregam tamanho, altura e peso, não família; nada amarrava a família a eles. A
prova de UI-01 (D-09) media justamente o heading "AMASSA", o único elemento correto, e generalizava.

**UI-01 estava meio cumprido no que já havia sido publicado.** Corrigido em `f73a7ef` (`@utility`
no `globals.css`, na raiz, não espalhado por seis `className`) e a asserção passou a medir três
pontos distintos em vez de um.

Ao varrer os seis para conferir, apareceu um segundo defeito, mais fundo: o `cn()` usa
`tailwind-merge`, que não conhece a escala do projeto, classifica `text-titulo` como cor de texto,
vê conflito com `text-foreground` e **descarta em silêncio**. Reproduzido isolado:
`twMerge("text-titulo text-foreground")` → `"text-foreground"`. O título dos cartões do painel
nunca teve família, tamanho nem peso certos desde a 02b-03. Corrigido em `f503dc3` com
`extendTailwindMerge` em `lib/utils.ts` — a raiz, que protege qualquer primitivo shadcn futuro — e
guardado por `tests/unit/cn.test.ts`.

### Comandos reexecutados após os quatro commits

| Comando | Resultado |
|---|---|
| `npm run lint` | ✅ 0, sem warning |
| `npx tsc --noEmit` | ✅ 0 |
| `npm run verificar-acoes` | ✅ 2 ações conferidas, 0 violações |
| `npm test` | ✅ **132/132** (11 arquivos — 128 anteriores + 4 novos do `cn()`) |
| `npm run build` | ✅ compilado, 11 rotas geradas |
| `npm run test:e2e` | ⚠️ **90 passaram, 2 falharam** — as duas com a assinatura do flake pré-existente da Fase 2a (`page.waitForResponse` estourando 60s), agora na quinta execução independente que o isola |

### Segurança

`02b-SECURITY.md` — **14/14 ameaças fechadas, `threats_open: 0`**, ASVS 1. O SVG do logo foi
auditado byte a byte por ser conteúdo externo agora renderizado numa rota pública: sem `<script>`,
sem manipulador de evento, sem referência remota.

### Veredito revalidado

Cinco critérios de sucesso e nove requisitos verificados, os três itens humanos resolvidos pelo
dono, e os dois defeitos encontrados depois da verificação inicial corrigidos na raiz e guardados
por teste. **Fase verificada.**

Um item aberto que **não** é desta fase: o flake de `autenticacao.spec.ts:72`, código de
rate-limiting da 2a, em `deferred-items.md` e `.planning/WINDOWS.md` (id 3).

---

*Verificado: 2026-08-08 · revalidado 2026-08-09 após o UAT e os commits `99efa74`, `90ca3f2`, `f73a7ef`, `f503dc3`*
*Verificador: Claude (gsd-verifier); adendos e revalidação pelo orquestrador*

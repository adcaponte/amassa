---
phase: 05-agenda
plan: 14
subsystem: agenda
status: complete
tags: [agenda, inicio, numeros, espaco, age-19, age-08, age-20, d-05, d-18, ges-09, ui-d19, ui-d22]
requires:
  - "05-09: usos livres (reservado → no espaço → encerrado), usoLivreDaSemana, precisaEncerrar (D-18)"
  - "05-08: creditosPorCliente (o saldo de reposição derivado das linhas)"
  - "05-13: garantirMensalidadesDoMes nas telas que “abrem a Agenda” (D-02)"
  - "04.6: BlocoAgendaDeHoje vazio, ocupacaoDoEspaco, a decisão do dono de 29/09 (sem capacidade)"
provides:
  - "lib/agenda/espaco.ts: pessoasAgoraNoEspaco, presencaPendenteAgora (ocupacaoDoEspaco mantida)"
  - "lib/agenda/numeros.ts: numerosDoMes, DIAS_DAS_BARRAS, QuadrosDoMes, BarrasDaSemana, DadosDosNumeros"
  - "lib/agenda/consultas.ts: agendaDeHoje(hoje, agora), LinhaDeHoje, LINHAS_DA_AGENDA_DE_HOJE, dadosDosNumeros(mes, hoje)"
  - "lib/agenda/abas.ts: a aba “numeros”"
  - "components: BlocoAgendaDeHoje (async), NumerosDaAgenda, EsqueletoDosNumeros; BORDA_DO_TIPO exportada de cartao-evento.tsx"
  - "data-testid: inicio-agenda-linha (data-tipo, data-id), inicio-agenda-mais, inicio-agenda-cancelada, inicio-agenda-marcar-presenca, aba-numeros, agenda-numeros, numeros-quadro-{uso|presenca|repor|pessoas}(-rotulo/-numero/-sub), numeros-barra-{seg..dom}(-valor), numeros-carregando"
  - "tests/e2e/apoio/semear-agenda.ts: agoraNoAtelie, apagarFechadoNoBanco, travarODiaDaAgenda, lancamentosDoDia, presencasDoPeriodo"
affects:
  - "O Início mostra a agenda de hoje de verdade e “Agora no espaço” conta gente (era o vazio fixo)"
  - "Abrir o Início faz nascer a mensalidade do mês (D-02), como as telas da Agenda"
  - "A Agenda ganha a quarta aba, Números"
tech-stack:
  added: []
  patterns:
    - "Bloco do Início = Server Component async + try/catch próprio que lê SÓ lib/agenda/consultas (molde bloco-producao)"
    - "Duas séries @vazio-historico que contam o banco inteiro se revezam por pg_advisory_lock e medem a partir do que acharam"
    - "Locator pelo papel acessível, não pelo data-testid, logo depois do goto: a cópia oculta do Suspense ainda não revelada também casa o testid"
key-files:
  created:
    - lib/agenda/numeros.ts
    - components/amassa/agenda/numeros-da-agenda.tsx
    - tests/unit/agenda-espaco.test.ts
    - tests/unit/agenda-numeros.test.ts
    - tests/e2e/inicio-agenda-de-hoje.spec.ts
    - tests/e2e/agenda-numeros.spec.ts
  modified:
    - lib/agenda/espaco.ts
    - lib/agenda/consultas.ts
    - lib/agenda/textos.ts
    - lib/agenda/abas.ts
    - app/gestao/(app)/page.tsx
    - app/gestao/(app)/agenda/page.tsx
    - app/gestao/(app)/agenda/loading.tsx
    - components/amassa/inicio/bloco-agenda-de-hoje.tsx
    - components/amassa/agenda/abas-da-agenda.tsx
    - components/amassa/agenda/a-receber.tsx
    - components/amassa/agenda/cartao-evento.tsx
    - tests/unit/agenda-abas.test.ts
    - tests/e2e/apoio/semear-agenda.ts
    - tests/e2e/inicio.spec.ts
    - tests/e2e/agenda-pessoas.spec.ts
decisions:
  - "A linha do fechado no Início mostra “dia todo” na coluna da hora (como o cartão da semana) e “o dia todo” na sub-linha"
  - "“e mais {N}” leva a ?semana={hoje}#dia-{hoje} (a semana de hoje, rolada até hoje)"
  - "Números não escreve nada — nem a mensalidade do mês (só leitura; não conta cobrança)"
  - "Números entra como quarta aba numa fileira só; a quebra 3 + 2 e a ordem final ficam para o plano 15"
  - "Título “{mês}, até hoje” com o mês em minúscula, verbatim do protótipo"
metrics:
  duration: "~28 min (23:19 → 23:47, 01/10/2026, relógio desta máquina)"
  completed: 2026-10-01
  tasks: 3
  files: 21
actuals:
  tokens: 23400
  tasks: 3
  commits: 5
---

# Phase 5 Plan 14: o Início lê a agenda de hoje e a aba Números — Summary

**O bloco “Agenda de hoje” do Início deixou de ser o vazio fixo: lê `agendaDeHoje` (que faz nascer a
mensalidade do mês antes), mostra até 6 linhas do dia — fechado primeiro, cada uma um link que abre a folha
do evento ou do uso livre (do Início à presença em 2 toques) — e “Agora no espaço: N pessoas” conta de
verdade: usos livres DE HOJE no espaço + inscritos das aulas que cobrem o agora, sem quem faltou, sem fração.
A Agenda ganhou a aba Números: do dia 1 até hoje, horas-pessoa e visitas do uso livre, presença (“—” sem
marcação), faltas, aulas a repor, pessoas diferentes e as sete barras de segunda a domingo — nenhum valor em
dinheiro.**

## O que foi feito

**Tarefa 1 — o módulo puro (TDD).** `pessoasAgoraNoEspaco({ usosLivres, aulas, agora })` em `espaco.ts`
(importa só `horario.ts` e `tipos.ts`): soma `pessoas` dos usos `no_espaco` com `data === agora.data` (o de
ontem esquecido não conta — D-18) e `inscritos − faltaram` das aulas de hoje, não canceladas, com
`inicio <= agora < fim`. `presencaPendenteAgora` decide a tag “marcar presença” da linha do Início (a aula de
hoje já começou e há alguém sem marcação — no Início o dia é sempre hoje, quem decide é o horário).
`numerosDoMes(dados, hoje)` em `numeros.ts` recorta do dia 1 a hoje e devolve os quadros e as barras; a
porcentagem é inteira com meio para cima sem ponto flutuante (`floor((200·veio + n) / 2n)`). O comentário de
`espaco.ts` foi reescrito para o presente (sem “AGD-02/03/04” nem “quando a Agenda existir”), mantendo
inteira a decisão do dono de 29/09 sobre a capacidade.

**Tarefa 2 — o bloco do Início.** `agendaDeHoje(hoje, agora)` em `consultas.ts`: `garantirMensalidadesDoMes`
→ eventos de hoje com `inscritos`, `sem_marcacao`, `faltaram` (uma subconsulta agrupada) + usos de hoje →
`ordenarNoDia` (fechado primeiro, depois início) → até 6 linhas + `restantes` + `agoraNoEspaco`. A página do
Início calcula `hoje` e `agora` do MESMO instante. `BlocoAgendaDeHoje` virou `async` no molde de
`bloco-producao.tsx` (falha → “Não deu para carregar a agenda de hoje.” + “Tentar de novo” só no bloco),
com a faixa “Agora no espaço” de sempre (`inicio-ocupacao`), as linhas (`min-h-[44px]`, borda de 4px na cor do
tipo — a mesma constante do cartão da semana —, grade `64px 1fr`, título `line-clamp-1` com o nome acessível
inteiro), a tag “cancelada” com o título riscado, “marcar presença”, e “e mais {N}”. O comentário que dizia
que o módulo de consultas “ainda não existe” foi reescrito para o presente.

**Tarefa 3 — a aba Números.** `abaDaAgendaDaUrl` aceita `numeros`; a aba “Números” entra por último.
`dadosDosNumeros(mes, hoje)`: os usos livres do período, as inscrições marcadas em datas do período com o
horário da data, e os saldos de reposição de hoje por `creditosPorCliente` (de quem tem falta com direito ou
reposição). `NumerosDaAgenda`: grade 2 × 2 abaixo de 640px e 4 colunas acima, rótulo Apoio 600 caixa alta,
número Display, o quarto quadro escuro (`tinta`, número branco, rótulo e sub `borda-forte` — par A16), as
barras com trilho `superficie-2` de 16px e barra `area-espaco` `aria-hidden` (A17) e o valor escrito; plural
de verdade em visita(s)/falta(s). O esqueleto (4 quadros + 7 barras) aparece no `Suspense` da página e no
`loading.tsx` (pelo `EsqueletoPelaAba`, que ganhou o ramo de Números).

## Comandos que rodei (e o resultado)

| Comando | Resultado |
|---|---|
| `npx vitest run tests/unit/agenda-espaco.test.ts tests/unit/agenda-numeros.test.ts` (RED) | 18 falharam, 1 passou — como devia |
| `npx vitest run tests/unit/agenda-espaco.test.ts tests/unit/agenda-numeros.test.ts tests/unit/inicio-saudacao.test.ts` (GREEN) | 53 passaram |
| `npm run verificar` (Tarefa 2) — duas vezes; a primeira só para ver a cauda (sem o código de saída), a segunda capturando | sai 0; 114 arquivos, 2250 testes |
| **e2e 1** — `npm run test:e2e -- --grep "inicio"` (Tarefa 2) | 72 passaram, **1 falhou**: `[celular] inicio › o atalho 'todos os módulos' rola até o índice` (desvio 1). Os 4 casos de `inicio agenda de hoje` e o `@vazio-global` do Início passaram |
| `npx vitest run tests/unit/agenda-abas.test.ts` | 29 passaram |
| `npm run verificar` (Tarefa 3) | sai 0; 114 arquivos, 2252 testes |
| **e2e 2** — `npm run test:e2e -- --grep "agenda numeros\|todos os módulos"` | **1 falhou** na cadeia: `[vazio-desktop] agenda pessoas (a)` (strict mode, desvio 2); 23 não rodaram (Números inclusive) |
| **e2e 3** — o mesmo comando, depois de trocar o localizador da aba em `agenda-numeros` | **mesma falha**, agora em `[vazio-celular]`; 44 não rodaram |
| **e2e 4** — o mesmo comando, depois do desvio 2 | **65 passaram, 0 falharam** — inclusive os 2 de Números, os 4 do Início (revezando pela trava) e o atalho em desktop e celular |
| `npm run verificar` (final) | sai 0; 114 arquivos, 2252 testes |

O orçamento do plano era UMA invocação de e2e por tarefa. A Tarefa 3 usou três: a cadeia `vazio-*` roda
inteira sob qualquer `--grep`, e uma falha nela (o desvio 2) impedia Números de rodar. O `--grep` da Tarefa 3
incluiu “todos os módulos” para validar a correção do desvio 1 na mesma invocação. Varredura completa sem
`--grep`: não rodei — é do último plano da fase.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] O atalho “todos os módulos” do Início falhava no celular**
- **Found during:** Tarefa 2 (e2e 1)
- **Issue:** o bloco da Agenda passou a ler o banco — chega por streaming e cresce de 3 linhas de esqueleto
  para até 6 linhas + “e mais N”. O teste tocava a âncora `#tudo` antes de os blocos chegarem; o conteúdo que
  entrava acima empurrava o índice para fora da tela (`viewport ratio 0`).
- **Fix:** o caso espera `inicio-bloco-esqueleto` sumir antes de tocar — o que se prova é o atalho com a
  página montada. Nada no produto mudou.
- **Files modified:** `tests/e2e/inicio.spec.ts`
- **Commit:** ebab99d

**2. [Rule 1 - Bug] `agenda pessoas (a)` caía em strict mode logo depois do `goto`**
- **Found during:** Tarefa 3 (e2e 2 e 3, nas duas pontas da cadeia `vazio-*`; passava na e2e 1)
- **Issue:** `getByTestId("aba-pessoas")` achava duas abas: a visível e a cópia ainda OCULTA do `Suspense`
  (o React 19 segura a revelação). A falha de strict mode não é retentada. Apareceu depois de entrar a aba
  Números; a causa exata do novo tempo não foi isolada.
- **Fix:** o caso localiza a aba pelo papel (`getByRole("tab", { name: "Pessoas" })`), que só acha a visível;
  a mesma escolha no `agenda-numeros`. A afirmação continua a mesma.
- **Files modified:** `tests/e2e/agenda-pessoas.spec.ts`, `tests/e2e/agenda-numeros.spec.ts`
- **Commit:** c76d0ea

**3. [Rule 3 - Blocking] As duas séries `@vazio-historico` do plano se atrapalhavam**
- **Found during:** Tarefa 3 (antes de rodar)
- **Issue:** o “Faltou” de hoje semeado pelo Início entra na presença do mês de Números, e o uso “no espaço”
  dele em “pessoas diferentes”; no dia 1 do mês, a data de turma de Números entra nas linhas de hoje do
  Início. As duas rodam ao mesmo tempo, em workers diferentes da mesma etapa.
- **Fix:** `travarODiaDaAgenda()` (`pg_advisory_lock`, o molde de `travarItemDaHora`) segura cada série do
  começo ao fim; o Início conta as linhas a partir de `lancamentosDoDia(hoje)` medido ao pegar a trava, e
  Números lê a presença de antes no banco (`presencasDoPeriodo`) — a porcentagem não se subtrai. A data de
  turma de Números nunca cobre o agora (senão contaria em “Agora no espaço”).
- **Files modified:** `tests/e2e/apoio/semear-agenda.ts`, as duas specs
- **Commit:** ebab99d, c76d0ea

**4. [Rule 2] O fechado de hoje é apagado no fim da série do Início**
- **Issue:** um dia fechado HOJE deixado no banco poria “dia fechado” nos casos de `desktop`/`celular` que
  lançam turma ou reserva em hoje (D-13).
- **Fix:** `apagarFechadoNoBanco` no `afterAll` (o mesmo efeito do “Tirar o bloqueio” da tela).
- **Commit:** ebab99d

**5. Arquivos fora de `files_modified`:** `components/amassa/agenda/cartao-evento.tsx` (só `export` de
`BORDA_DO_TIPO`, para as linhas do Início usarem as mesmas cores — UI-D19) e
`components/amassa/agenda/a-receber.tsx` (`EsqueletoPelaAba` ganhou o ramo de Números — o `loading.tsx` não
recebe a URL). `presencaPendenteAgora` em `espaco.ts` também não estava no plano: é a regra da tag “marcar
presença” do Início, que assim fica no módulo puro, testada, e não na consulta.

## Decidido sem o Theo

| Decisão | Por quê | Como desfazer |
|---|---|---|
| A linha do fechado no Início mostra “dia todo” na coluna da hora e “o dia todo” embaixo do título | É o que o cartão da semana faz; a coluna vazia desalinharia a grade | Em `bloco-agenda-de-hoje.tsx`, trocar `linha.inicio ?? ROTULO_DIA_TODO` por `linha.inicio` |
| “e mais {N}” leva a `?semana={hoje}#dia-{hoje}` | A UI-SPEC diz “a semana de hoje”; a âncora poupa a rolagem até hoje | Tirar o `#dia-${hoje}` do `href` |
| Números não chama `garantirMensalidadesDoMes` | Só leitura (AGE-19); a aba não conta cobrança nenhuma | Chamar antes de `dadosDosNumeros` em `NumerosCarregados` |
| Números entra como quarta aba numa fileira só | O plano manda “por último entre as que existem”; a quebra 3 + 2 depende da quinta (plano 15) | — (o plano 15 fecha) |
| Título “outubro, até hoje” com o mês em minúscula | Verbatim do protótipo (`MES[...]`, “, até hoje”), como o “dezembro de 2026” da barra do mês | `tituloDosNumeros` em `textos.ts` |
| Horas com ponto de milhar (“1.234 h”) | É o exemplo da própria UI-SPEC (E20·overflow) | `horasNosNumeros` em `textos.ts` |

## Para o dono olhar no portão (plano 16)

- **E20·overflow (backstop):** semear um mês com 1.234 horas-pessoa e abrir Números a 360px — “PRESENÇA NAS
  AULAS” quebra em duas linhas sem cortar e “1.234 h” cabe no quadro. O e2e prova o 2 × 2 e o rótulo sem
  corte a 360px, mas com os números pequenos do teste.
- Do Início à lista de presença em 2 toques: tocar a linha da aula de hoje abre a folha.
- “Agora no espaço” num dia de verdade: uma aula acontecendo + um uso livre com “Chegou”.

## Known Stubs

Nenhum.

## Threat Flags

Nenhuma superfície nova além do `<threat_model>`: duas leituras chamadas só por Server Components de
`/gestao` que já começam por `exigirUsuario()` (T-05-66); o `try/catch` próprio do bloco cumpre T-05-67;
nenhuma ação nova (o portão `verificar-acoes` continua igual).

## Self-Check: PASSED

- Arquivos criados existem: `lib/agenda/numeros.ts`, `components/amassa/agenda/numeros-da-agenda.tsx`,
  `tests/unit/agenda-espaco.test.ts`, `tests/unit/agenda-numeros.test.ts`,
  `tests/e2e/inicio-agenda-de-hoje.spec.ts`, `tests/e2e/agenda-numeros.spec.ts`.
- Commits existem: 65665c4, bfa866b, ebab99d, c76d0ea.
- Greps de aceite: nenhum import proibido em `espaco.ts`/`numeros.ts`; `AGD-0|quando a Agenda existir` = 0;
  `agendaDeHoje` = 3 e `catch` = 2 no bloco; “ainda não existe” = 0; `lugares|capacidade` em `textos.ts` = 0;
  `numeros` em `abas.ts` = 2; `formatarReais|centavos` em `numeros-da-agenda.tsx` = 0.
- `.planning/STATE.md`, `ROADMAP.md` e `REQUIREMENTS.md` não foram tocados.

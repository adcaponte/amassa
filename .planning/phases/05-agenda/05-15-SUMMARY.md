---
phase: 05-agenda
plan: 15
subsystem: agenda
status: complete
tags: [agenda, site, isr, age-18, d-10, d-11, d-12, sit-02, ui-d1, ui-d17, ui-d18]
requires:
  - "05-14: as quatro abas (agenda, pessoas, receber, numeros) e o padrão de esqueleto por aba"
  - "05-05/05-06: vagas (rotuloDeVagas), quandoDaTurmaNoSite, todoODia"
  - "04.6: AulasEOficinas, BotaoWhatsapp, hrefDoWhatsapp, CONTEUDO_SITE.zap, a cerca do site, test:site-sem-banco"
provides:
  - "lib/agenda/publico/agenda.ts: agendaPublica(dados, hoje), CartaoPublico, DiaPublico, MesPublico, AgendaPublicaPronta, gradeDoMes, fimDaJanela, tituloDoDia, LIMITE_DE_PROXIMAS, MESES_NO_SITE"
  - "lib/agenda/publico/consultas.ts: lerAgendaPublica(hoje) — a única leitura de banco alcançável pelo site"
  - "conteudo/site.ts: mensagemDeReserva(nome, quando)"
  - "app/globals.css: --color-site-ambar: var(--color-atencao)"
  - "components/site: AgendaPublica (Server, com queda), ConteudoDaAgendaViva, AgendaPublicaCalendario (Client), CartaoEventoSite, BotaoReservar"
  - "components/amassa/agenda/moldura-no-site.tsx: MolduraNoSite, EsqueletoDoNoSite"
  - "lib/agenda/abas.ts: a união completa (agenda, pessoas, receber, site, numeros)"
  - "data-testid: site-agenda-viva, site-alternador, site-proximas, site-calendario, site-dia (data-data), site-cartao-evento (data-tipo), site-reservar, site-uso-livre, aba-site (a aba), no-site (o conteúdo da aba), moldura-no-site, no-site-vazio, no-site-carregando, abas-espacador"
affects:
  - "A raiz do site passa a ser ISR (○ / · Revalidate 5m) e lê a agenda pública; sem evento público ou sem banco continua exatamente no estado da 04.6"
  - "A Agenda ganha a quinta aba, No site; abaixo de 768px as abas quebram em 3 + 2"
  - "A cerca tests/unit/site-isolamento.test.ts tem UMA exceção nomeada para o banco"
tech-stack:
  added: []
  patterns:
    - "Seção pública com dado de banco = Server Component com try/catch que cai no conteúdo estático aprovado, dentro de página force-static + revalidate"
    - "Cerca de import com exceção nomeada (lista de UM arquivo, com teste que afirma a lista) em vez de afrouxar o proibido"
    - "e2e de ISR: o dado semeado no banco só aparece depois de uma ação de TELA que revalida \"/\""
key-files:
  created:
    - lib/agenda/publico/agenda.ts
    - lib/agenda/publico/consultas.ts
    - components/site/agenda-publica.tsx
    - components/site/agenda-publica-calendario.tsx
    - components/site/cartao-evento-site.tsx
    - components/site/botao-reservar.tsx
    - components/amassa/agenda/moldura-no-site.tsx
    - tests/unit/agenda-publico.test.ts
    - tests/e2e/site-agenda.spec.ts
    - tests/e2e/agenda-no-site.spec.ts
  modified:
    - app/page.tsx
    - app/globals.css
    - conteudo/site.ts
    - components/site/aulas-e-oficinas.tsx
    - lib/agenda/turma.ts
    - lib/agenda/abas.ts
    - lib/agenda/textos.ts
    - app/gestao/(app)/agenda/page.tsx
    - app/gestao/(app)/agenda/loading.tsx
    - components/amassa/agenda/abas-da-agenda.tsx
    - components/amassa/agenda/a-receber.tsx
    - scripts/testar-site-sem-banco.mjs
    - tests/unit/site-isolamento.test.ts
    - tests/unit/tokens.test.ts
    - tests/unit/contraste.test.ts
    - tests/unit/agenda-abas.test.ts
    - tests/e2e/site-secoes.spec.ts
decisions:
  - "A aba No site lê lerAgendaPublica SEM try/catch: a falha sobe ao error.tsx da Agenda, nunca ao estado da D-11"
  - "Os e2e afirmam o próprio evento pelo dia no Calendário (lista do dia/do mês), não pela posição em Próximas — Próximas tem 10 cartões e outras specs também lançam eventos públicos"
  - "Na lista “Em {mês}” a turma usa as vagas da turma − alunos ativos (como Próximas); na lista do dia, a lista daquela data (D-12)"
metrics:
  duration: "~20 min (23:48 → 00:08, 01-02/10/2026)"
  completed: 2026-10-02
actuals:
  tokens: 26000
  tasks: 3
  commits: 4
---

# Phase 5 Plan 15: o calendário público do site e a aba “No site” Summary

**A seção `#agenda` da raiz passou a ser viva por ISR (`force-static` + `revalidate = 300`): mostra as
aulas e oficinas públicas de hoje até o fim do 6º mês, com preço por mês/por pessoa, vagas restantes
(D-12) e “Reservar pelo WhatsApp”, sem nome, telefone ou motivo de fechado; sem evento público ou sem
banco ela continua exatamente no estado da 04.6. O gestor vê o mesmo calendário, ao vivo, na quinta aba
da Agenda, “No site”.**

## O que foi entregue

**Tarefa 1 — o módulo puro (`3b23fdc`).** `agendaPublica(dados, hoje)` em `lib/agenda/publico/agenda.ts`:
filtra de novo (público, não cancelado, `data >= hoje`, até o fim do 6º mês contando o de hoje, turma
ativa), põe a turma UMA vez em “Próximas” na posição da próxima data com vagas da turma − alunos ativos,
e cada data do calendário com a contagem da lista dela; `{ temEventos: false }` com zero eventos (mesmo
havendo dia fechado). Cada objeto é montado campo a campo, e o teste afirma a lista branca exata de chaves
de `CartaoPublico`, `DiaPublico`, `MesPublico` e da agenda pronta (15 testes). `horaDoSite` passou a ser
exportado de `lib/agenda/turma.ts` para o “quando” da oficina (“Quinta, 03/12 · 14h às 17h30”).

**Tarefa 2 — a seção viva (`bc774e6`).**
- `lerAgendaPublica(hoje)`: três `select`s — eventos (`tipo, data, inicio, fim, titulo, vagas,
  preco_centavos, turma_id` + contagem de inscrições), turmas ativas (`nome, dia_semana, inicio, fim,
  vagas, mensalidade_centavos` + contagem de alunos com `saiu_em is null`) e só a DATA dos dias fechados.
  Nenhuma coluna de `clientes`, de presença nem o `titulo` do fechado (que é o motivo).
- `AgendaPublica` (Server) com `try/catch` → `AulasEOficinas`; `ConteudoDaAgendaViva` (o miolo,
  reaproveitado pela gestão); `AgendaPublicaCalendario` (Client: “Próximas · Calendário”, até 10 + “e
  mais {N} no calendário”, grade seg…dom com pontos por tipo, “‹/›” limitados, lista “Em {mês}” ou do
  dia, “Fechado neste dia.”, “Nada marcado neste mês ainda.”); `CartaoEventoSite`; `BotaoReservar`
  (`hrefDoWhatsapp(CONTEUDO_SITE.zap, mensagemDeReserva(...))`). Uso livre continua sem preço.
- Cerca reescrita: `EXCECOES_DE_BANCO = ["lib/agenda/publico/consultas.ts"]`, só `@/db` e `drizzle-orm`
  liberados nela; `ESPECIFICADORES_PROIBIDOS` intacto (inclui `"@/db"`); testes novos afirmam a lista
  e que a exceção não tem `use server`/`next/headers`/sessão; “components/site/ só importa de
  `@/lib/agenda/publico/`”.
- `--color-site-ambar: var(--color-atencao)` + linha no `tokens.test.ts`; `contraste.test.ts` com S1-S8
  (e `site-sol`/`site-borda` sozinhos reprovados abaixo de 3:1).
- `testar-site-sem-banco.mjs`: a etapa 5 afirma a frase da D-11 com o Postgres parado; cabeçalho no
  presente.
- `site-secoes` (c) e (f) viraram `@vazio-global`; `tests/e2e/site-agenda.spec.ts` novo.

**Tarefa 3 — a aba “No site” e as cinco abas (`bb89902`).** `ABAS_DA_AGENDA` completa; abas na ordem
Agenda · Pessoas · A receber | No site · Números, com o espaçador `basis-full md:hidden` antes de “No
site”. `?aba=site` → `NoSiteCarregado` (`app/gestao/(app)/agenda/page.tsx` linhas 209-216): `agendaPublica(await
lerAgendaPublica(hoje), hoje)` SEM `catch` → `MolduraNoSite` (dica + moldura `site-papel`
`rounded-[14px]` até 1080px com o mesmo componente do site, ou a caixa da D-11 + `AulasEOficinas`).
`loading.tsx` mostra a moldura + 3 cartões quando a aba é `site`.

### Auditoria das revalidações (verdade 1)

Nenhuma mudança em `lib/agenda/acoes.ts` foi necessária — todas as ações que mudam o que é público já
chamam `revalidarTelasDaAgenda`, que revalida `/` quando `publico` é verdadeiro:
`lancarAvulsa` (`dados.publico`), `lancarTurma` (`dados.publica`), `fecharDia` (sempre), `cancelarData`
(`evento.publico`), `tirarBloqueio` (sempre), `colocarNaData` (`evento.publico`), `tirarDaLista`
(`inscricao.publico`), `editarTurma` (`turma.publica || dados.publica` — cobre tornar privada),
`marcarMaisSemanas`, `desativarTurma`, `entrarNaTurma`, `sairDaTurma` (`turma.publica`).

## Comandos rodados (exatos)

| # | Comando | Resultado |
|---|---|---|
| 1 | `npx vitest run tests/unit/agenda-publico.test.ts tests/unit/agenda-turma.test.ts` (e reruns de `agenda-publico` ao acertar o espaço do `Intl`) | 15/15 |
| 2 | `npx vitest run tests/unit/site-isolamento.test.ts tests/unit/tokens.test.ts tests/unit/contraste.test.ts` | verde (após corrigir um regex que o script de edição desescapou) |
| 3 | `npm run verificar` (Tarefa 2) — rodado **duas** vezes: a primeira com só o fim da saída, a segunda para registrar o código de saída | EXIT 0 · 115 arquivos, 2284 testes |
| 4 | `npm run test:e2e -- --grep "site agenda\|site secoes"` | EXIT 0 · 85 passed (inclui (c)/(f) em `vazio-celular` e `vazio-desktop`; `site agenda` nos dois projetos) |
| 5 | `npm run test:site-sem-banco` | EXIT 0 · “Todas as etapas passaram”; tabela do build: `○ /  5m  1y` |
| 6 | `npx vitest run tests/unit/agenda-abas.test.ts` | 32/32 |
| 7 | `npm run verificar` (Tarefa 3) | EXIT 0 · 115 arquivos, 2287 testes |
| 8 | `npm run test:e2e -- --grep "agenda no site"` | EXIT 1 · (b) falhou nos dois projetos: `getByTestId('aba-agenda')` casou 3 elementos (esqueleto do `loading.tsx` + fallback do `Suspense`) — defeito do teste, não da tela |
| 9 | `npm run test:e2e -- --grep "agenda no site"` (locator só no elemento visível, esperando o esqueleto sumir) | EXIT 0 · 71 passed |

Foram **três** invocações de e2e (uma acima do orçamento da Tarefa 3, para diagnosticar a falha do item 8)
e **uma** de `test:site-sem-banco`. Nenhum `npm run build` separado.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `horaDoSite` exportado de `lib/agenda/turma.ts`** (fora da lista de arquivos)
- **Found during:** Tarefa 1 — o “quando” da oficina precisa do mesmo “19h30” da turma; duplicar a função
  criaria duas regras. Commit `3b23fdc`.

**2. [Rule 3 - Blocking] `EsqueletoPelaAba` (`components/amassa/agenda/a-receber.tsx`) ganhou a prop `site`**
- **Found during:** Tarefa 3 — é ele que escolhe o esqueleto pela aba no `loading.tsx`. Commit `bb89902`.

**3. [Rule 1 - Bug] testid duplicado `aba-site`**
- O plano lista `aba-site` como testid, mas ele já é o da própria aba (`aba-${valor}`); o conteúdo da aba
  ficou `no-site`. Commit `bb89902`.

**4. TDD da Tarefa 1 num commit só** — teste e implementação escritos juntos e commitados em `3b23fdc`
(sem o commit RED separado), pela janela de tempo da sessão.

## Decidido sem o Theo

1. **Os e2e conferem o próprio evento pelo dia no Calendário**, não pela posição em “Próximas” (só 10
   cartões, e outras specs também lançam eventos públicos para amanhã) — premissa global falsa evitada.
   *Desfazer:* afirmar em `site-proximas` com um banco dedicado (`@vazio-global`).
2. **Na lista “Em {mês}”, a turma usa vagas da turma − alunos ativos** (o mesmo número de “Próximas”); a
   lista de UM dia usa a lista daquela data. A UI-SPEC só fixava os dois extremos. *Desfazer:* em
   `agendaPublica`, trocar `umaVezPorTurma` dos meses para usar o `inscritos` da primeira data.
3. **Janela de 6 meses contando o mês de hoje** (out/26 → mar/27). *Desfazer:* `MESES_NO_SITE`.
4. **Dia da semana da oficina com maiúscula** (“Quinta, 03/12 · 14h às 17h”), igual ao título da lista do
   dia. *Desfazer:* `tituloDoDia` em `lib/agenda/publico/agenda.ts`.
5. **Revalidação de colocar/tirar/entrar/sair continua condicionada a evento/turma público** (o plano dizia
   “sempre”): mudança num evento privado não muda o site. *Desfazer:* passar `{ publico: true }` nessas
   quatro chamadas.
6. **Sem JavaScript, o alternador aparece mas não troca** (o HTML já traz “Próximas” inteira). *Desfazer:*
   esconder o `tablist` até a hidratação.

## Para o dono saber

- **O número do WhatsApp continua o placeholder `5562900000000`** (`conteudo/site.ts`, `CONTEUDO_SITE.zap`).
  Agora ele vai em todo “Reservar pelo WhatsApp” — confirme o número real no portão (plano 16).
- Os logs do e2e mostram `[WebServer] ⨯ Error: The destination stream closed early.` (25 vezes no item 4, 23
  no item 9) sem nenhum teste falhar. Não diagnostiquei se já existia antes deste plano — vale olhar no portão.
- No CI, `site agenda` passando contra a imagem Docker (construída sem banco) é a prova de que o contêiner
  grava o cache do ISR — o SUMMARY do portão deve citar o run (key_link do plano).

## Backstops para o portão (plano 16)

E1 long-text (“A receber · 120” a 320/360px), E19 error (derrubar o banco e abrir “No site”), E25
zero-one-many (um cartão só a 1280px), E25 long-text (título de 120 caracteres a 320px), E26 overflow
(célula com 4 eventos a 320px). E o caso “sem evento público” da aba “No site” (condição global).

## Known Stubs

Nenhum novo. O placeholder do número de WhatsApp é anterior (04.6, D-17) e espera o dono.

## Threat Flags

Nenhum além do registro do plano: a superfície nova (raiz → banco) é exatamente T-05-69..73, mitigada como
planejado (consulta sem coluna de pessoa, lista branca testada, cerca com exceção nomeada, `try/catch` +
`test:site-sem-banco`, filtros de público/cancelado/turma ativa na consulta e no puro).

## Self-Check: PASSED

- Arquivos criados conferidos no disco; commits `3b23fdc`, `bc774e6`, `bb89902` em `gsd/phase-05-agenda`.
- `grep -c "revalidate = 300" app/page.tsx` = 1; `grep -c force-static app/page.tsx` = 1.
- `grep -vE "^\s*//" lib/agenda/publico/consultas.ts | grep -cE "clientes|telefone|pessoa_nome|presenca"` = 0.
- `grep -rnE "#[0-9A-Fa-f]{6}" components/site` — nada.
- STATE.md, ROADMAP.md e REQUIREMENTS.md não foram tocados.

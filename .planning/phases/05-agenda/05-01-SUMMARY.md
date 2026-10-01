---
phase: 05-agenda
plan: 01
subsystem: agenda
status: complete
tags: [agenda, migracao, presenca, tracador, estoque, drizzle]
requires:
  - "Fase 06 (Estoque): destino_saida, movimentacoes_estoque, lib/estoque/destinos.ts"
  - "Fase 06.1 (Produção): molde de gravacao/acoes/consultas, calendario puro"
provides:
  - "db/migrations/0026_agenda.sql — o banco inteiro da fase (versionado, NÃO aplicado)"
  - "lib/agenda/{tipos,horario,semana,presenca,abas,textos,esquemas,consultas,gravacao,acoes}.ts"
  - "/gestao/agenda com a semana, a folha do evento por ?evento= e Veio/Faltou otimista"
  - "tests/e2e/apoio/semear-agenda.ts (semearCliente, semearOficina, semearInscricao, presencaNoBanco)"
  - "data-testid estáveis: agenda-semana, agenda-dia-{data}, agenda-cartao, folha-evento, inscrito, presenca-veio, presenca-faltou"
affects:
  - "Estoque: DESTINOS_DE_SAIDA com seis; a folha continua com cinco; Para onde foi com sete barras"
  - "Cadastros → Catálogo: num banco novo mostra os três itens do sistema (nunca mais vazio)"
  - "documentos e movimentacoes_estoque ganham coluna — Pitfall 2 (D-15): o código não pode ir ao ar sem a 0026"
tech-stack:
  added: []
  patterns:
    - "useOptimistic + useTransition por linha (presença otimista, cada linha com sua transição)"
    - "folha por URL que abre na hora com o cabeçalho do cartão e pede a lista ao servidor (router.push)"
    - "enum novo comparado como texto (::text) na mesma transação do ADD VALUE"
key-files:
  created:
    - db/migrations/0026_agenda.sql
    - db/migrations/meta/0026_snapshot.json
    - lib/agenda/tipos.ts
    - lib/agenda/horario.ts
    - lib/agenda/semana.ts
    - lib/agenda/presenca.ts
    - lib/agenda/abas.ts
    - lib/agenda/textos.ts
    - lib/agenda/esquemas.ts
    - lib/agenda/consultas.ts
    - lib/agenda/gravacao.ts
    - lib/agenda/acoes.ts
    - app/gestao/(app)/agenda/loading.tsx
    - app/gestao/(app)/agenda/error.tsx
    - components/amassa/agenda/semana-da-agenda.tsx
    - components/amassa/agenda/cartao-evento.tsx
    - components/amassa/agenda/folha-evento.tsx
    - components/amassa/agenda/linha-inscrito.tsx
    - tests/unit/agenda-paridade.test.ts
    - tests/unit/agenda-horario.test.ts
    - tests/unit/agenda-semana.test.ts
    - tests/unit/agenda-presenca.test.ts
    - tests/unit/agenda-abas.test.ts
    - tests/e2e/apoio/semear-agenda.ts
    - tests/e2e/agenda-tracador.spec.ts
  modified:
    - db/schema.ts
    - db/migrations/meta/_journal.json
    - scripts/testar-migracoes.mjs
    - lib/estoque/destinos.ts
    - lib/estoque/esquemas.ts
    - components/amassa/estoque/grade-destinos.tsx
    - components/amassa/estoque/folha-movimentacao.tsx
    - app/gestao/(app)/agenda/page.tsx
    - tests/unit/estoque-destinos.test.ts
    - tests/unit/estoque-historico.test.ts
    - tests/e2e/estoque-abas.spec.ts
    - tests/e2e/casca.spec.ts
    - tests/e2e/cadastros-catalogo.spec.ts
decisions:
  - "Branch local gsd/phase-05-agenda criado a partir de main (cfd0990); nada publicado (D-15)"
  - "Uma migração só (0026) com todo o banco da fase; uso_livre no FIM do enum destino_saida"
  - "Checks do livro com destino::text (Pitfall 1); nenhuma linha da 0026 grava o valor uso_livre"
  - "Horas de parede em time; valor do uso livre e do material congelados no encerramento"
  - "O @vazio-global do Catálogo passa a afirmar os três itens do sistema (consequência da semente D-17)"
metrics:
  duration: "25 min (07:02 → 07:27, 01/10/2026)"
  completed: 2026-10-01
  tasks: 2
  files: 38
actuals:
  tokens: 91653
  tasks: 2
  commits: 5
---

# Phase 5 Plan 01: O banco da Agenda e o traçador da presença — Summary

**A migração `0026_agenda` escreve o banco inteiro da fase (oito tabelas, quatro enums, o destino
`uso_livre` comparado como texto, `clientes` AO LADO de `pessoa_nome`, os três itens do sistema com
gatilho de trava), provada só no Postgres efêmero; e o traçador atravessa tudo: a oficina de hoje
na semana, a folha por `?evento=`, "Veio" num toque otimista, gravado sob `for no key update` e
relido do banco.**

## O que foi feito

### Tarefa 1 — o banco da fase (commits `3db116d` RED, `78f2dae` GREEN)

- `db/schema.ts`: enums `tipo_evento`, `tipo_inscricao`, `presenca` (`presencaDaInscricao`),
  `estado_uso_livre`; `uso_livre` no fim de `destino_saida`; tabelas `clientes`, `turmas`,
  `turma_alunos`, `eventos`, `inscricoes`, `mensalidades`, `usos_livres`, `usos_livres_material`
  com todos os checks, chaves únicas e índices da tabela de artefatos do plano;
  `documentos.cliente_id` + `documentos_cliente_exige_pessoa_nome` (D-01, comentário da decisão de
  identidade no schema e no cabeçalho da `0026`); `movimentacoes_estoque.uso_livre_id` + os dois
  checks em `::text` (D-06); `itens_catalogo.chave_do_sistema` + unique + check (D-17).
- `0026_agenda.sql`: saída do `npm run db:generate -- --name agenda` (rodou sem pergunta nenhuma;
  o kit gerou `ALTER TYPE … ADD VALUE 'uso_livre'` e os checks com `::text` direto do schema),
  completada à mão em sete blocos: cabeçalho "APLICADA À MÃO" + D-01 + nota do enum;
  `nome_normalizado()` antes do DDL (linha 45 < índice na linha 258); o DDL gerado; a semente das
  duas categorias (`where not exists`) e dos três itens (`on conflict (chave_do_sistema) do
  nothing`, preço nulo, na venda, sem estoque); `travar_item_do_sistema` (P0001, a frase da
  verdade 8); os oito `tocar_atualizado_em_*`; `revoke delete on clientes, turmas, turma_alunos,
  mensalidades from amassa_app`.
- `scripts/testar-migracoes.mjs` (mesmo commit do schema): as oito tabelas em `TABELAS_ESPERADAS`
  no bloco "Fase 5 — Agenda"; `conferirAgenda` confere a semente (chave, nome, categoria, preço
  nulo, flags), o gatilho (desativar "mensalidade" → P0001) e o `revoke` (`delete` de `clientes`
  como `amassa_app` → 42501).
- Estoque: `DestinoDeSaida`/`VinculoDoDestino` com o valor novo; `DESTINOS_DE_SAIDA` com seis;
  `DESTINOS_DA_FOLHA_DO_ESTOQUE` (cinco) e `ehDestinoDaFolha` na grade, na folha e no Zod da folha;
  o comentário "turma em texto livre até a Agenda existir" corrigido. O "Para onde foi" passa a ter
  sete barras (seis destinos + Vendido): `estoque-historico.test.ts` e `estoque-abas.spec.ts`
  ajustados.
- `lib/agenda/tipos.ts` puro + `agenda-paridade.test.ts` (as quatro uniões e os seis destinos contra
  os `enumValues`).

### Tarefa 2 — o traçador (commits `2f062ad` RED, `2bdacde` GREEN)

- Puros, com teste de pureza por leitura do arquivo: `horario.ts` (`minutosDe` aceita `19:00` e
  `19:00:00`, `horaDe`, `cobreOAgora` com fim exclusivo), `semana.ts` (`segundaDaSemana`,
  `diasDaSemana`, `agruparPorDia`, `ordenarNoDia` — fechado, início, tipo, id —, `tituloDaSemana`,
  `rotuloDoDia`, `diaDaSemanaPorExtenso`), `presenca.ts` (`planejarPresenca`, `ordenarInscritos`
  com `Intl.Collator` pt-BR), `abas.ts` (`semanaDaUrl`, `idDaUrl`), `textos.ts`.
- Servidor: `esquemas.ts` (`esquemaDefinirPresenca`); `gravacao.ts` sem a diretiva, com a ordem
  global de travas no topo, `travarInscricao` (`.for("no key update", { of: inscricoes })`) e
  `RecusaDaAgenda`; `consultas.ts` sem a diretiva (`lerSemana`, `obterEvento`, `EventoCarregado`,
  horas já em `HH:MM`); `acoes.ts` com `definirPresenca` (`exigirUsuario()` primeiro → Zod →
  transação: trava → recusa data cancelada → `planejarPresenca` → `update` de presença e direito
  na mesma instrução) e o ajudante não exportado `revalidarTelasDaAgenda({ publico })`.
- Tela: `page.tsx` (`exigirUsuario()` primeiro, "hoje" de Brasília na borda, `?semana=` e
  `?evento=`); `SemanaDaAgenda` (barra ‹ título ›, sete grupos, "nada marcado", toast do link
  velho uma vez); `CartaoEvento` (`<button>` 64px, borda 4px do tipo, grade `64px 1fr auto`);
  `FolhaEvento` (diálogo de tela toda no celular, `md:max-w-lg`, fechar 44×44, "Pronto" preso,
  esqueleto de 4 linhas enquanto a lista chega); `LinhaInscrito` (segmentado `role="group"`,
  `aria-pressed`, `aria-busy`, `useOptimistic`, frase de erro com `role="alert"`);
  `loading.tsx` e `error.tsx`.
- e2e `agenda tracador` (desktop e celular): Veio otimista → banco `veio` → recarregar mostra Veio →
  tocar de novo → banco nulo → Pronto fecha e tira o parâmetro; dois celulares (o último vence, a
  primeira tela recarregada mostra o banco); `?evento=` inexistente → toast, nenhuma folha.
- `casca.spec.ts`: a Agenda era a última tela inerte — a lista `TELAS_DE_MODULO` e o teste que a
  percorria saíram juntos (laço sobre lista vazia não prova nada); o 320px e o axe continuam
  cobrindo `/gestao/agenda`.

## Comandos que rodei (e o resultado)

| Comando | Resultado |
|---|---|
| `npx vitest run tests/unit/agenda-paridade.test.ts tests/unit/estoque-destinos.test.ts` (antes do schema) | RED: 5 falhas da paridade, como esperado |
| `npm run db:generate -- --name agenda` | gerou `0026_agenda.sql` + snapshot + diário (idx 26), sem pergunta |
| `npm run verificar` (1ª, Tarefa 1) | falhou: `estoque-historico.test.ts` "empate na ordem fixa" esperava seis barras — corrigido |
| `npm run verificar` (2ª, Tarefa 1) | **verde**: 97 arquivos / 1833 testes; `test:migracoes` com `conferirAgenda`, "Todas as afirmações passaram." |
| `npx vitest run` dos quatro testes da Tarefa 2 | RED (módulos inexistentes) → GREEN 32/32 |
| `npm run verificar` (Tarefa 2) | **verde**: 101 arquivos / 1865 testes; `verificar-acoes` 86 ações, 0 violações (`lib/agenda`: 1 ação, `definirPresenca`) |
| `npm run test:e2e -- --grep "agenda tracador\|casca\|/gestao/agenda não tem violação"` (1ª) | **falhou** em `[vazio-celular] cadastros-catalogo @vazio-global` — a semente da 0026 tirou o Catálogo do vazio; 17 passaram, 62 não rodaram |
| o mesmo comando (2ª, depois de ajustar o teste do Catálogo) | **80 passed (1.2m)** — `agenda tracador` 3 casos × desktop e celular, `casca`, o axe de `/gestao/agenda` nos dois projetos e a cadeia `vazio-*` inteira |
| `npm run lint` e `npx tsc --noEmit` depois do último ajuste | verdes |

Foram **duas** invocações de e2e na Tarefa 2 (o orçamento era uma): a primeira falhou num teste fora
do `--grep` que a minha semente quebrou, e a segunda era o diagnóstico necessário. Nenhuma
invocação na Tarefa 1, nenhum `npm run build` separado, nenhuma varredura sem `--grep` (é do
plano 16). Acrescentei ao `--grep` o axe de `/gestao/agenda` (`acessibilidade.spec.ts`), que o
plano manda continuar cobrindo a rota — ainda uma invocação só.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Teste de desempate do "Para onde foi" esperava seis barras**
- **Found during:** Tarefa 1 (`npm run verificar`)
- **Issue:** `tests/unit/estoque-historico.test.ts` "ordem decrescente de valor; empate na ordem
  fixa dos destinos" listava as seis chaves de antes; com o destino novo são sete.
- **Fix:** acrescentado `uso_livre` no fim da lista esperada (ele tem valor zero e cai na ordem fixa).
- **Commit:** `78f2dae`

**2. [Rule 1 - Bug] O `@vazio-global` do Catálogo afirmava um banco sem item nenhum**
- **Found during:** Tarefa 2 (1ª invocação de e2e)
- **Issue:** a semente D-17 da `0026` cria três itens que não se apagam; o estado vazio do Catálogo
  ("Nada no catálogo ainda.") não aparece mais num banco novo, e o caso `@vazio-global` de
  `cadastros-catalogo.spec.ts` falhava — bloqueando os 62 testes depois dele na cadeia.
- **Fix:** o caso passa a afirmar a verdade nova e global: nenhum "Nada no catálogo ainda.",
  exatamente três linhas (`catalogo-item`), uma para cada item do sistema, e o "+ Novo item" do
  cabeçalho abre o diálogo de verdade. Nenhum plano da fase previa este ajuste (lacuna do
  planejamento).
- **Files modified:** `tests/e2e/cadastros-catalogo.spec.ts`
- **Commit:** `2bdacde`

**3. [Rule 2 - extra pequeno] `conferirAgenda` também confere o gatilho do item do sistema**
- O plano pedia só a semente e o 42501; acrescentei o P0001 ao desativar "mensalidade" (rolado de
  volta), barato e é a única prova do bloco (5) da `0026` neste plano.

## Decidido sem o Theo

Cada item com o porquê e como desfazer. Nada aqui foi aplicado fora do Postgres efêmero.

1. **Branch `gsd/phase-05-agenda`** a partir de `main` (`cfd0990`), quatro commits de código + o do
   SUMMARY, nada publicado (D-15). *Desfazer:* `git branch -D gsd/phase-05-agenda` (nada saiu da máquina).
2. **Nomes do modelo de dados** — tabelas, colunas e checks exatamente os da tabela de artefatos do
   plano (proposta da pesquisa, `[ASSUMED]` lá). O enum `presenca` se chama `presencaDaInscricao`
   no código. *Desfazer:* antes de o dono aplicar a `0026`, mudar `db/schema.ts`, apagar a `0026` e
   o snapshot 0026, tirar a entrada idx 26 do diário e gerar de novo.
3. **`time` para horas de parede** (`turmas.inicio/fim`, `eventos.inicio/fim`, `usos_livres.chegada*`/
   `saida`); `timestamptz` fica para os carimbos. *Desfazer:* idem item 2, antes de aplicar.
4. **`valor_centavos` congelado no uso livre** (`usos_livres.valor_centavos` e
   `usos_livres_material.preco_unitario_centavos`/`valor_centavos`, só no encerramento). *Desfazer:* idem.
5. **Experimental com direito a repor** — o check `inscricoes_direito_so_com_falta` aceita `aluno`
   e `experimental`. *Desfazer:* trocar o `in ('aluno','experimental')` por `= 'aluno'` antes de aplicar.
6. **Uma migração só** para a fase inteira (dividir obrigaria o dono a aplicar várias e a regenerar).
7. **`uso_livre` no FIM do enum** `destino_saida` (o `drizzle-kit` gera `ADD VALUE` sem reescrever o
   tipo). Depois de aplicado, o enum não perde o valor sem recriar o tipo.
8. **A sexta barra de destino ("Uso livre do espaço") aparece com zero no "Para onde foi"** até o
   plano 10 gravar a primeira baixa — sete barras ao todo com o Vendido. *Desfazer:* tirar
   `uso_livre` de `DESTINOS_DE_SAIDA` (mas aí o consumo do uso livre some do gráfico — Pitfall 4).
9. **O teste `@vazio-global` do Catálogo reescrito** (Desvio 2). O estado vazio do Catálogo continua
   no código, mas deixa de ser alcançável depois da `0026`. *Desfazer:* reverter o trecho do teste
   (só faz sentido se a semente sair).
10. **`casca.spec.ts` perdeu a lista `TELAS_DE_MODULO` e o teste que a percorria** (era a última tela
    inerte). *Desfazer:* `git show cfd0990:tests/e2e/casca.spec.ts`.
11. **Desempate da ordem do dia por tipo e depois id** (o que o plano diz), e não "por título" (o que
    a UI-SPEC §"Aba Agenda — Semana" diz). *Desfazer:* trocar o terceiro critério de `comparar` em
    `lib/agenda/semana.ts`.
12. **Abrir a folha com `router.push`** (não `history.pushState` como na Abertura): a folha precisa
    da lista que só o servidor tem. Para não depender da transição, a folha abre NA HORA com o
    cabeçalho do cartão e o esqueleto, e a lista entra quando o servidor responde.
13. **Fora deste plano, de propósito:** as abas da Agenda, "+ Lançar na agenda", "Hoje" com rolagem
    até hoje, a vista Mês, as tags de pagamento na linha e o "tem direito a repor". A barra da semana
    tem só ‹ título ›.

## Para o dono olhar no portão (plano 16)

- **Itens com o mesmo nome no Catálogo de produção.** A semente da `0026` insere "Mensalidade",
  "Inscrição em oficina" e "Uso livre (hora)" pela chave, e `itens_catalogo` não tem nome único: se
  já houver um item com um desses nomes cadastrado à mão, ficarão dois. Conferir antes de aplicar:
  `select nome, ativo from itens_catalogo where lower(trim(nome)) in ('mensalidade','inscrição em oficina','uso livre (hora)');`
- **Categoria desativada.** Se "Aulas e oficinas" ou "Uso do espaço" estiver desativada em produção,
  os itens nascem apontando para ela (a semente só recria a categoria se ela não existir pelo nome).

## Known Stubs

Nenhum stub de dado: a semana, a folha e a presença leem e gravam o banco de verdade. O
`revalidarTelasDaAgenda({ publico })` hoje sempre recebe `false` (a presença não é pública) — o
ramo `publico: true` é para os planos que mexem no que o site mostra.

## Verificação não executada neste plano

- Os casos (e) e (h) de `tests/e2e/estoque-abas.spec.ts` (contagem de barras 6 → 7) foram ajustados
  mas **não rodaram** (fora do `--grep`); o caso unitário equivalente (`estoque-historico.test.ts`)
  passou. A varredura completa do plano 16 os cobre.

## Threat Flags

Nenhuma superfície nova além do `threat_model` do plano: uma Server Action (`definirPresenca`,
T-05-01/03/04/07), duas leituras sem diretiva (T-05-02) e a migração (T-05-05/06/08).

## TDD Gate Compliance

- Tarefa 1: `test(05-01)` `3db116d` (RED, 5 falhas) → `feat(05-01)` `78f2dae` (GREEN).
- Tarefa 2: `test(05-01)` `2f062ad` (RED, módulos inexistentes) → `feat(05-01)` `2bdacde` (GREEN).

## Self-Check: PASSED

- Arquivos: `db/migrations/0026_agenda.sql`, `lib/agenda/{tipos,horario,semana,presenca,abas,textos,esquemas,consultas,gravacao,acoes}.ts`,
  `app/gestao/(app)/agenda/{page,loading,error}.tsx`, `components/amassa/agenda/*.tsx` (4),
  `tests/e2e/agenda-tracador.spec.ts`, `tests/e2e/apoio/semear-agenda.ts` — presentes.
- Commits `3db116d`, `78f2dae`, `2f062ad`, `2bdacde` no branch `gsd/phase-05-agenda`; `git log
  main..HEAD` lista só eles; `main` intocado (`cfd0990`).
- Greps de aceite: "aplicada à mão" 1; `revoke delete on clientes, turmas, turma_alunos, mensalidades
  from amassa_app` 1; `tocar_atualizado_em_` 17; `travar_item_do_sistema` 5; `drop (table|column|type)`
  0; `ADD VALUE 'uso_livre'` 1; `::text = 'uso_livre'` 2; `"destino" (=|<>) 'uso_livre'` 0;
  `ALTER COLUMN "pessoa_nome"` 0; `no key update` em `gravacao.ts` 5; `"use server"` em
  `gravacao.ts`/`consultas.ts` 0; `for("update")` em `lib/agenda` 0; imports proibidos nos puros 0;
  `toISOString` no e2e da Agenda 0; "Chega na Fase 5" na página e no `casca.spec.ts` 0.
- `STATE.md`, `ROADMAP.md` e `REQUIREMENTS.md` não foram tocados.

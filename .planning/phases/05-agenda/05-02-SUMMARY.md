---
phase: 05-agenda
plan: 02
subsystem: agenda
status: complete
tags: [agenda, migracao, test-migracoes, cadastros, catalogo, d-17]
requires:
  - "05-01: migração 0026 (não aplicada), conferirAgenda mínima, semear-agenda.ts"
provides:
  - "conferirAgenda completa + apagarDadosDeProvaDaAgenda (scripts/testar-migracoes.mjs)"
  - "marcadores `-- >>> semente da Agenda` / `-- <<< semente da Agenda` na 0026"
  - "obterItensDoSistema / ItensDoSistema / ItemDoSistema (lib/agenda/consultas.ts) para os planos 09, 11, 12"
  - "chaveDoSistema em ItemDoCatalogoCompleto; chip-do-sistema; diálogo protegido; linha-item-do-sistema"
  - "CHIP_DO_SISTEMA, LINHA_ITEM_DO_SISTEMA, FRASE_ITEM_DO_SISTEMA (lib/cadastros/textos.ts); FRASE_ITENS_DA_AGENDA_SUMIRAM (lib/agenda/textos.ts)"
affects:
  - "0026: o check inscricoes_direito_so_com_falta foi corrigido (ver Desvio 1)"
tech-stack:
  added: []
  patterns:
    - "pg_advisory_lock num e2e para serializar entre projetos um caso que escreve dado global único"
    - "reexecutar um trecho da migração, entre marcadores, para provar idempotência"
key-files:
  created:
    - tests/e2e/cadastros-itens-da-agenda.spec.ts
  modified:
    - scripts/testar-migracoes.mjs
    - db/migrations/0026_agenda.sql
    - db/migrations/meta/0026_snapshot.json
    - db/schema.ts
    - lib/agenda/consultas.ts
    - lib/agenda/textos.ts
    - lib/cadastros/consultas.ts
    - lib/cadastros/acoes.ts
    - lib/cadastros/textos.ts
    - components/amassa/cadastros/lista-catalogo.tsx
    - components/amassa/cadastros/dialogo-item-catalogo.tsx
decisions:
  - "inscricoes_direito_so_com_falta passa a exigir presenca is not null (NULL deixava passar direito_a_repor sem falta)"
  - "amassa_app recebe 42501 (revoke da 0015) ao apagar item do sistema; o P0001 do delete é provado pelo dono"
  - "definirItemAtivo recusa item do sistema já sob a trava, antes do gatilho (mesma frase)"
metrics:
  duration: "11 min (07:28 → 07:39, 01/10/2026)"
  completed: 2026-10-01
  tasks: 2
  files: 12
actuals:
  tokens: 24000
  tasks: 2
  commits: 3
---

# Phase 5 Plan 02: As bordas do banco da Agenda e os itens do sistema em Cadastros — Summary

**`conferirAgenda` agora prova cada invariante da `0026` no Postgres efêmero (privilégio, quatro
chaves, ~40 checks, D-01, D-06 em texto, a FK do AGE-20, o gatilho D-17 pelo dono e por
`amassa_app`, a semente reexecutada e `nome_normalizado`). A prova achou e corrigiu um defeito real
na migração. Em Cadastros, os três itens aparecem com o chip “do sistema”, o diálogo não oferece
“Desativar” nem “Aparece na venda”, o dono cadastra o preço da hora, e o servidor não confia na tela.**

## O que foi feito

### Tarefa 1: `conferirAgenda` completa (commit `9ec2519`)

- Semente comitada pela conexão de dono (usuária, dois clientes `[prova]`, turma, data de turma,
  oficina, fechado, inscrição, matrícula, mensalidade, três usos livres, material, item de
  estoque com entrada). Cada caso que só testa roda entre `begin` e `rollback`. Tudo sai no fim por
  `apagarDadosDeProvaDaAgenda`, na ordem das FKs, e uma afirmação final confere que não sobrou
  `[prova]` em `clientes`, `turmas` e `eventos`. O CI roda o Playwright depois, no mesmo banco.
- Cada recusa confere o SQLSTATE **e** o nome da restrição (`erroDoBanco`).
  1. **42501** em `clientes`, `turmas`, `turma_alunos`, `mensalidades` como `amassa_app`. O
     `delete` é aceito em `eventos` (fechado), `inscricoes`, `usos_livres` (reservado) e
     `usos_livres_material`.
  2. **23505** em `eventos_turma_data_uk`, `inscricoes_evento_cliente_uk`,
     `mensalidades_turma_cliente_mes_uk` e `turma_alunos_ativo_uk`. O índice parcial aceita o
     aluno de novo depois de `saiu_em`. Duas avulsas no mesmo dia não colidem.
  3. **D-02:** dois `on conflict (turma_id, cliente_id, mes) do nothing` deixam uma linha.
  4. **23514:** 39 casos, um por check (eventos ×8, turmas ×5, mensalidades ×7, inscrições ×10,
     usos livres ×5, material ×3, `documentos_cliente_exige_pessoa_nome`).
  5. **D-01:** documento de venda sem `cliente_id`, com e sem `pessoa_nome`, entra.
  6. **D-06:** uma saída manual `uso_livre` com vínculo passa. Sem vínculo, ou com vínculo e
     destino `aula`, volta 23514 com o nome de cada check.
  7. **AGE-20:** apagar como `amassa_app` o uso livre com baixa dá **23503**
     (`movimentacoes_estoque_uso_livre_id_usos_livres_id_fk`), e a baixa continua no livro.
  8. **D-17:** desativar, tirar da venda e trocar a chave dão **P0001** com a frase do gatilho,
     pelo dono e por `amassa_app`. Apagar dá P0001 pelo dono e 42501 por `amassa_app` (ver
     Decidido 2). Renomear, pôr preço e trocar a categoria passam, e depois de tudo a semente
     continua intacta.
  9. **Semente:** três itens, preço nulo, na venda, sem estoque, ativos, categoria
     `receita`/`espaco`, as duas categorias uma vez cada. O trecho entre os marcadores da `0026`
     (5 instruções) é executado de novo e nada duplica.
  10. `nome_normalizado('  JOÃO  da  Silva ')` = `joao da silva`; `nome_normalizado('Ação')` = `acao`.

### Tarefa 2: os itens do sistema em Cadastros (commit `99ee4fe`)

- `obterItensDoSistema()` (sem a diretiva de Server Action) faz
  `where chave_do_sistema in (…)` e devolve `{ mensalidade, inscricaoOficina, usoLivreHora }`. Se
  faltar algum item, registra no log e lança `FRASE_ITENS_DA_AGENDA_SUMIRAM`. Nenhuma comparação
  por nome.
- `listarCatalogoCompleto` passa a devolver `chaveDoSistema`. A lista mostra o chip neutro
  (`bg-superficie-2 text-tinta-media`, Apoio semibold, `data-testid="chip-do-sistema"`) no
  `flex-wrap` de chips. “valor na hora” continua vindo do preço nulo.
- No diálogo, um item com chave não mostra “Desativar” nem a caixa “Aparece na venda”. No lugar
  aparece `LINHA_ITEM_DO_SISTEMA` (Apoio `tinta-fraca`, `break-words`). Nome, preço e categoria
  continuam iguais.
- `editarItem` lê a chave e o `aparece_na_venda` sob o `for update` que já usava. Para item do
  sistema, grava o valor que está no banco e ignora o pedido.
- `definirItemAtivo` recusa desativar item do sistema já sob a trava. `ehErroDoItemDoSistema`
  (raiz + `cause`, `where` com `travar_item_do_sistema` ou o começo da frase) transforma o P0001
  em `FRASE_ITEM_DO_SISTEMA` nas duas ações.

## Comandos que rodei (e o resultado)

| Comando | Resultado |
|---|---|
| `npm run test:migracoes` (1ª) | **falhou**: “direito a repor sem falta” passou. Defeito real da 0026, Desvio 1 |
| `npm run test:migracoes` (2ª, depois de corrigir a 0026) | **falhou**: apagar item do sistema como `amassa_app` deu 42501 em vez de P0001 (revoke da 0015), Decidido 2 |
| `npm run test:migracoes` (3ª) | **verde**, “Todas as afirmações passaram.” |
| `npx vitest run tests/unit/agenda-paridade.test.ts`, `eslint`, `tsc --noEmit` | verdes |
| `npm run verificar` (Tarefa 2) | **verde**: 101 arquivos / 1865 testes; `verificar-acoes` 86 ações, 0 violações; `test:migracoes` verde |
| `npm run test:e2e -- --grep "cadastros itens da agenda\|cadastros catalogo"` | **66 passed (1.0m)**: os 3 casos novos × desktop e celular, `cadastros catalogo` inteiro e a cadeia `vazio-*` |

Fiz **uma** invocação de e2e (Tarefa 2). Não rodei e2e na Tarefa 1, nem `npm run build` separado,
nem varredura sem `--grep`. O log do e2e traz várias vezes
`[WebServer] ⨯ Error: The destination stream closed early.` Nenhum teste falhou por isso. A
suspeita é que seja o streaming do servidor cancelado pela navegação; não investiguei.

Greps de aceite, comparados com o `main`: `"42501"` 4→7, `"23505"` 3→7, `"23514"` 14→17,
`"23503"` 2→3, `"P0001"` 2→3. A maior parte dos 23514 passa por um único `esperar(…, "23514", …)`
dentro do laço de 39 casos. `semente da Agenda` na 0026: 2. `nome_normalizado('  JOÃO  da  Silva ')`: 1.
Os cinco nomes de restrição pedidos: 7. `chave_do_sistema|chaveDoSistema` em `lib/agenda/consultas.ts`:
5. Comparação por nome: 0. `travar_item_do_sistema` em `acoes.ts`: 4. `FRASE_ITEM_DO_SISTEMA`: 4.
`chip-do-sistema`: 1.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `inscricoes_direito_so_com_falta` aceitava direito a repor sem falta**
- **Found during:** Tarefa 1 (1ª `test:migracoes`)
- **Issue:** o check era `not direito_a_repor or (presenca = 'faltou' and tipo in (…))`. Com
  `presenca` nula, a comparação dá NULL, e o Postgres aceita check NULL. Uma inscrição com
  `direito_a_repor = true` e presença nunca marcada entrava.
- **Fix:** passou a ser `… or (presenca is not null and presenca = 'faltou' and tipo in (…))`, nos
  três lugares, para o `drizzle-kit` não ver diferença: `db/schema.ts`, `0026_agenda.sql` e
  `meta/0026_snapshot.json`. A 0026 não está aplicada em lugar nenhum. Conferi os outros checks
  da 0026 atrás do mesmo buraco de NULL: os demais ou têm `is not null` antes da comparação, ou
  são cobertos por outro check (`proporcional_junto`, `chegada_por_estado`).
- **Commit:** `9ec2519`

**2. [Rule 2] `editarItem` e `definirItemAtivo` também recusam no código, não só pelo gatilho**
- O plano pedia converter o P0001. Além disso, `definirItemAtivo` recusa item com chave sob a
  trava, antes do `update`. O gatilho continua sendo a última camada, com a mesma frase.

## Decidido sem o Theo

Nada aqui saiu da máquina: o branch é `gsd/phase-05-agenda`, sem push.

1. **Correção do check `inscricoes_direito_so_com_falta`** (Desvio 1). *Desfazer:* tirar o
   `presenca is not null and` nos três arquivos. Mas aí volta o furo.
2. **Apagar um item do sistema como `amassa_app` dá 42501, não P0001.** O `revoke delete on …
   itens_catalogo` da 0015 barra antes de o gatilho rodar. A prova afirma 42501 para `amassa_app`
   e P0001 para o dono. As duas camadas valem, e a recusa por privilégio é a mais forte.
   *Desfazer:* não há o que desfazer; é o comportamento do banco.
3. **Os marcadores da semente são comentários na 0026.** Não mudam o SQL executado, só o hash do
   arquivo, que ainda não foi aplicado. *Desfazer:* apagar as três linhas de comentário e o caso 9
   da `conferirAgenda`.
4. **e2e com `pg_advisory_lock(5020017)`** no caso que grava o preço da hora. O preço é um só no
   banco e desktop e celular rodam ao mesmo tempo. Cada projeto grava um preço diferente (12,34 e
   43,21) e devolve o nulo no `finally`. *Desfazer:* tirar a trava, mas aí o caso fica instável
   sob `fullyParallel`.
5. **Rótulo da caixa:** o texto da tela é “Aparece na venda”, com v minúsculo
   (`ROTULO_APARECE_NA_VENDA`). O plano escreve “Aparece na Venda”. O teste usa a constante.

## Known Stubs

Nenhum. `obterItensDoSistema` ainda não tem quem a chame; os planos 09, 11 e 12 vão usá-la, como
o plano determina. Não é stub de tela.

## Threat Flags

Nenhuma superfície nova além do `threat_model`. T-05-09: `editarItem` ignora `aparecenaVenda` e o
gatilho foi provado. T-05-10: gatilho + frase de `obterItensDoSistema`. T-05-11: 42501 e 23503
provados. T-05-12: o P0001 é reconhecido pelo nome da função e trocado pela frase.

## Self-Check: PASSED

- Arquivos presentes: `tests/e2e/cadastros-itens-da-agenda.spec.ts`, `scripts/testar-migracoes.mjs`
  (com `conferirAgenda` e `apagarDadosDeProvaDaAgenda`), `lib/agenda/consultas.ts`
  (com `obterItensDoSistema`).
- Commits `9ec2519` e `99ee4fe` estão em `gsd/phase-05-agenda`.
- Não toquei em `STATE.md`, `ROADMAP.md` nem `REQUIREMENTS.md`.

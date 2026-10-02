---
quick_id: 261002-sdt
phase: quick-261002-sdt
plan: 1
subsystem: agenda
status: complete
tags: [agenda, dispensa, uso-livre, lote, site-publico, migracao-0027]
requires: [Fase 5 — Agenda no ar (0026 aplicada)]
provides:
  - caixa “Mostrar no calendário público do site” desmarcada por padrão
  - confirmação “Lançar N vendas?” no lote de mensalidades
  - dispensa do uso livre com a venda cancelada (migração 0027, versionada e não aplicada)
  - Roteiro 18 (docs/operacao/18-migracao-dispensa-do-uso-livre.md)
affects: [/api/health/agenda passa a exigir a 0027, próxima publicação vira o Roteiro 18]
tech-stack:
  added: []
  patterns: [AlertDialog de confirmação no molde dos confirmar-*.tsx da Agenda]
key-files:
  created:
    - components/amassa/agenda/confirmar-lancar-lote.tsx
    - db/migrations/0027_dispensa-do-uso-livre.sql
    - db/migrations/meta/0027_snapshot.json
    - docs/operacao/18-migracao-dispensa-do-uso-livre.md
  modified:
    - components/amassa/agenda/folha-lancar.tsx
    - components/amassa/agenda/lote-de-mensalidades.tsx
    - components/amassa/agenda/linha-a-receber.tsx
    - components/amassa/agenda/confirmar-dispensar.tsx
    - lib/agenda/textos.ts
    - lib/agenda/receber.ts
    - lib/agenda/gravacao.ts
    - lib/agenda/esquemas.ts
    - lib/agenda/acoes.ts
    - lib/agenda/consultas.ts
    - app/api/health/agenda/route.ts
    - db/schema.ts
    - db/migrations/meta/_journal.json
    - scripts/testar-migracoes.mjs
    - tests/unit/agenda-receber.test.ts
    - tests/unit/agenda-esquemas.test.ts
    - tests/e2e/agenda-lancamento.spec.ts
    - tests/e2e/agenda-turma.spec.ts
    - tests/e2e/agenda-no-site.spec.ts
    - tests/e2e/site-agenda.spec.ts
    - tests/e2e/agenda-mensalidades-lote.spec.ts
    - tests/e2e/agenda-dispensar.spec.ts
    - tests/e2e/apoio/semear-agenda.ts
    - .planning/phases/05-agenda/05-CONTEXT.md
    - .planning/phases/05-agenda/05-UI-SPEC.md
    - .planning/phases/05-agenda/05-VERIFICACAO-HUMANA.md
decisions:
  - "Decisão 1 do dono (02/10/2026): a caixa pública vem desmarcada; o Zod segue exigindo o booleano; sem migração para o default de turmas.publica"
  - "Decisão 2 do dono (02/10/2026): o uso livre encerrado só se dispensa com a venda cancelada; colunas na 0027 (checkpoint: migracao-0027)"
  - "Decisão 3 do dono (02/10/2026): o lote de mensalidades pede “Lançar N vendas?” antes de criar as vendas"
metrics:
  duration: "Tarefa 1 na sessão interrompida (commit 19:48 UTC); retomada das 20:11 às ~20:35 UTC de 02/10/2026"
  completed: 2026-10-02
actuals:
  tokens: 71795   # chars/4 sobre `git diff eac0203^ 60d16b3`; 21961 sem o 0027_snapshot.json gerado
  tasks: 3
  commits: 5
---

# Quick 261002-sdt: as três decisões do dono depois da verificação do Cowork, na Agenda

O dono tomou três decisões no chat, em 02/10/2026, depois da verificação do Cowork
(`Claude outputs/agenda/VERIFICACAO-COWORK-05.md` §2), e as três estão implementadas:

1. A caixa “Mostrar no calendário público do site” vem **desmarcada**.
2. O lote de mensalidades pede **“Lançar N vendas?”** antes de criar as vendas.
3. O **uso livre com a venda cancelada se dispensa**, com a mesma mecânica das outras cobranças.
   Para isso entrou a migração `0027`, versionada e **não aplicada**.

Os commits são locais, em `main`. Nada foi publicado.

## Decidido pelo dono

- **Checkpoint da migração 0027:** o dono (Theo) respondeu **`migracao-0027`** no chat, em
  02/10/2026. A Tarefa 2 foi executada inteira, e a próxima publicação é o Roteiro 18.
- As três decisões vêm do próprio chat, com as palavras dele registradas no `05-CONTEXT.md`:
  - item 1: “Inverter a marcação do calendario publico. de padrão vem desmarcado.”;
  - item 2: “seguir sugestão do cowork”;
  - item 3: a confirmação final do lote.

## Commits

| Tarefa | Hash | Mensagem |
|---|---|---|
| 1 | `eac0203` | feat(agenda): caixa pública desmarcada por padrão e confirmação do lote (quick 261002-sdt) |
| 2a | `c008b1d` | feat(agenda): migração 0027 — dispensa do uso livre (versionada, não aplicada) |
| 2b | `5e91ab3` | feat(agenda): dispensar uso livre com venda cancelada — regra e servidor |
| 3 | `534afd2` | feat(agenda): Dispensar do uso livre na tela e em Dispensadas; Roteiro 18 (quick 261002-sdt) |
| 3 | `60d16b3` | docs(agenda): decisões do dono de 02/10 registradas (quick 261002-sdt) |

A migração (`c008b1d`) está num commit próprio, antes do código que a usa (`5e91ab3`).

`git log origin/main..main --oneline` (medido às ~20:32 UTC) mostra os cinco commits acima e mais o
`3785f3c`, um commit de estado anterior a este quick. Nada foi publicado.

## O que foi feito

**Tarefa 1** (`eac0203`, feita pelo executor interrompido e conferida nesta retomada):

- Em `folha-lancar.tsx`, o estado da caixa nasce com `useState(false)`.
- Novo `confirmar-lancar-lote.tsx`, com `confirmar-lote`, `confirmar-lote-sim`, `confirmar-lote-nao` e
  o erro dentro do diálogo.
- Em `textos.ts`, os textos `tituloConfirmarLote`, `rotuloConfirmarLote` e `corpoConfirmarLote`.
- Testes de unidade dos textos e dos esquemas sem `publico`/`publica`.
- Cinco specs e2e editados.
- Conferido com os `grep` do `<verify>`, que acharam as três marcas.

**Tarefa 2** (`c008b1d` e `5e91ab3`):

- **Banco.** `usosLivres` ganhou `dispensadaEm`, `dispensadaPor` (FK para `usuarios`, sem
  `on delete`) e `motivoDispensa`, mais três checks. A `0027` só faz `ADD COLUMN` e `ADD CONSTRAINT`,
  sem nenhum `DROP`.
- **Snapshot.** `drizzle-kit generate` rodado de novo nesta retomada: “No schema changes”. O snapshot
  e o schema batem, e o `prevId` da 0027 é o `id` da 0026.
- **Prova em `test:migracoes`** (dentro de `conferirAgenda`):
  - cinco recusas 23514, cada uma conferindo o nome do check:
    - dispensa sem `dispensada_por`;
    - motivo sem dispensa;
    - motivo com 201 caracteres;
    - uso reservado dispensado;
    - uso encerrado sem venda dispensado;
  - um aceite: uso encerrado, com venda cancelada e dispensa completa, numa instrução só (CTE).
- **Regra.** `podeDispensar` passou a aceitar `uso_livre` só com `venda_cancelada`.
- **Leitura.** `lerUsosLivresCobrados` lê a dispensa real, no lugar do `null` fixo de antes, e o
  filtro `soLivres` passou a excluir os dispensados.
- **Gravação e validação.** `gravarDispensa` e `esquemaDefinirDispensa` aceitam `uso_livre`.
- **Ação.** `definirDispensa` recusa o uso livre sem venda com a nova
  `FRASE_USO_LIVRE_SEM_VENDA_CANCELADA`, conferida sob a trava. `exigirUsuario()` continua na primeira
  linha.
- **Saúde.** `/api/health/agenda` passa a consultar `usos_livres.dispensada_em`, e o motivo fixo
  agora fala em “0026 e 0027”.

**Tarefa 3** (`534afd2` e `60d16b3`):

- **`lerDispensadas`** ganhou uma terceira leitura e uma terceira contagem, para os usos livres.
- **`linha-a-receber.tsx`** mostra o botão conforme `linha.podeDispensar` e nada mais; saiu a
  exclusão por tipo.
- **`confirmar-dispensar.tsx`** aceita o uso livre:
  - título: “Dispensar o uso livre de {nome}?”;
  - corpo: `corpoConfirmarDispensar`, que diz que a venda cancelada continua no Caixa.
- **Folha do uso livre e ficha da pessoa** — conferidas, sem mudança. As duas leem a situação por
  `lerCobrancas` → `lerUsosLivresCobrados`, que agora traz a dispensa real, e `TagDePagamento` já
  mostra `TAG_DISPENSADA` para a situação `dispensada`.
- **E2e.** `dispensaNoBanco` aceita `uso_livre`, e o novo caso (f) em `agenda-dispensar.spec.ts`
  passa por dispensar, “Dispensadas”, banco e “Desfazer” com a etiqueta da venda cancelada.
- **Roteiro 18** escrito e copiado para `Claude outputs/agenda/`.
- **Notas datadas:**
  - `05-CONTEXT.md`: nota abaixo da D-09 e a subseção “Ajustes do dono depois da verificação do
    Cowork”;
  - `05-UI-SPEC.md`: notas nas linhas público, lote, A receber — linha e E15;
  - `05-VERIFICACAO-HUMANA.md`: nota na caixa marcada e no D.33, com o arquivo copiado para
    `Claude outputs/agenda/`.
  - Em todos, o texto antigo ficou intacto.

## Evidências pedidas pelo plano

- **`turmas.publica` mantém o default `true` no banco, e nenhum escritor depende dele.** O único
  `insert(turmas)` está em `lib/agenda/acoes.ts:411` e grava `dados.publica`. Esse valor é validado
  pelo Zod como booleano obrigatório, sem `.default`, e os dois testes de unidade de
  `agenda-esquemas.test.ts` provam que a ausência falha. Nenhuma migração foi feita para isso.
- **`TABELAS_ESPERADAS` não mudou**, porque a 0027 não cria tabela. O script não tem nenhum número
  fixo de “última migração = 0026” para atualizar: `aplicarMigracoesAte` usa índices fixos só até a
  25, e a contagem do journal é dinâmica.
- **A 0027 não foi aplicada em lugar nenhum fora dos bancos efêmeros.** Nenhum `db:migrate` rodou
  nesta sessão, a não ser os de dentro do `test:migracoes` e do e2e, os dois em contêiner descartável.

## Comandos de verificação rodados de fato

| Comando | Quando | Resultado |
|---|---|---|
| `npx drizzle-kit generate --name conferencia` | início da retomada | “No schema changes, nothing to migrate”; nenhum arquivo criado |
| `npm run verificar` | antes do commit `c008b1d` (com o código da Tarefa 1 e a 0027) | 0 — 2300 testes, `test:migracoes` “Todas as afirmações passaram” |
| `npm run verificar` | antes do commit `5e91ab3` | 0 — 2302 testes, 114 ações, 0 violações, `test:migracoes` verde |
| `npm run verificar` | antes do commit `534afd2` | 0 — 2303 testes, `test:migracoes` verde |
| `npm run test:e2e -- --grep "agenda-lancamento\|agenda-turma\|agenda-no-site\|agenda-mensalidades-lote\|agenda-dispensar\|agenda-saude\|site-agenda"` | 1ª invocação | **falhou fora do escopo** — detalhes logo abaixo |
| `npm run test:e2e -- --no-deps --grep "<o mesmo padrão>"` | 2ª invocação (a única nova tentativa) | 50 passaram, 1 falhou, 2 não rodaram — detalhes logo abaixo |

**1ª invocação.** 64 passaram, 1 falhou, 1 instável e 51 não rodaram. A falha e a instabilidade são
de `queimas-banner.spec.ts`, no projeto `vazio-historico` (Queimas, não tocado), e estão em
`deferred-items.md`. Nessa passada, `agenda-mensalidades-lote` **(a), (b) e (c) passaram** no slot
isolado `vazio-historico`. Como esse projeto falhou, os 51 testes de `desktop` e `celular` não
rodaram.

**2ª invocação.** Todos os specs de `desktop` e `celular` passaram, nos dois aparelhos:

- `agenda-dispensar` (a)–(f), com o caso novo (f) incluído;
- `agenda-lancamento`, `agenda-no-site`, `agenda-saude`, `agenda-turma` e `site-agenda`.

A única falha foi `agenda-mensalidades-lote` (a), que viu 9 mensalidades em vez de 4. A causa foi o
próprio `--no-deps`: ele fez esse spec `@vazio-historico`, que exige isolamento, rodar junto com os
outros. É a premissa global da regra do CLAUDE.md, e não defeito do código; o mesmo caso já tinha
passado isolado na 1ª invocação. Os casos (b) e (c) não rodaram nessa passada.

**Juntando as duas, cada spec tocado tem uma passada verde no seu contexto certo.** Não rodei uma
terceira vez. Nunca rodei `npm run build` separado.

## Desvios do plano

1. **[Regra 3 — bloqueio] Segunda invocação e2e com `--no-deps`.** Na primeira, a falha fora do
   escopo em `queimas-banner` impediu que qualquer spec do quick em `desktop`/`celular` rodasse. A
   segunda se limitou aos specs do quick. O efeito colateral (o lote rodar sem isolamento) está
   explicado acima.
2. **[Regra 2] Testes de unidade além do `<behavior>`.** Entraram `esquemaDefinirDispensa` (aceita os
   três tipos e recusa outro) e `tituloConfirmarDispensar`/`corpoConfirmarDispensar` para o uso
   livre. Eles protegem a validação no servidor e os textos novos.
3. **RED da regra pura não observado nesta sessão.** As mudanças de `podeDispensar` e do teste dela
   foram escritas pelo executor interrompido e estavam juntas, sem commit, na árvore de trabalho.
   Conferi que o código e o teste batem com o `<behavior>`, e o teste passa. Não posso afirmar que o
   RED foi visto.
4. **Revisão do trabalho parcial.** Depois da varredura do antivírus, conferi que os sete arquivos da
   Tarefa 2 deixados na árvore estavam coerentes:
   - SQL só aditivo;
   - snapshot com `prevId` certo e com as três colunas, os três checks e a FK;
   - journal com o idx 27;
   - `testar-migracoes` com cinco recusas e um aceite.
   Nenhum arquivo citado faltava, e `.git/index.lock` não existia (não precisei remover nada).
   **Faltavam** gravação, esquema, ação, textos, saúde e toda a Tarefa 3, e foram feitos aqui.

## Decidido sem o Theo

- **Textos dos diálogos:**
  - título do uso livre: “Dispensar o uso livre de {nome}?”;
  - corpo do uso livre: “A cobrança sai de “A receber”. A venda cancelada continua no Caixa, como
    está. Fica registrado quem dispensou e quando, e dá para desfazer em “Dispensadas”, no fim da
    lista.”;
  - recusa ao uso livre sem venda: “O uso livre só se dispensa depois que a venda dele for cancelada
    no Caixa. Sem venda, use “Recebi agora” ou “Lançar na Venda”.”
  - Os textos do lote (`tituloConfirmarLote`, `rotuloConfirmarLote` e `corpoConfirmarLote`) vêm da
    Tarefa 1, em `eac0203`.
- **Nomes dos checks:** `usos_livres_dispensada_por`, `usos_livres_motivo_so_com_dispensa` e
  `usos_livres_dispensa_so_com_venda`. A FK gerada se chama `usos_livres_dispensada_por_usuarios_id_fk`.
- **Número do roteiro:** 18 (`docs/operacao/18-migracao-dispensa-do-uso-livre.md`).
- **Prova do aceite** feita com um CTE (documento cancelado + uso livre numa instrução só, entre
  `begin` e `rollback`), em vez dos ajudantes de semente.

## O que o dono faz para publicar

**Roteiro 18**, não um push simples:

1. guarda e contagem (migrações = 27);
2. backup;
3. `git push` e esperar o `implantar` verde;
4. `db:migrate` logo em seguida (a imagem `ferramentas` tem de trazer a `0027`);
5. `/api/health/agenda` 200, SQL das três colunas e dos quatro constraints, migrações = 28.

Entre o `implantar` e o `db:migrate`, “A receber”, a semana com uso livre encerrado, a ficha e o uso
livre falham, e `/api/health/agenda` fica 503.

## O que o orquestrador precisa atualizar (não editado aqui, por instrução)

- **`.planning/STATE.md`**, em Pending Todos, no item “Decisões do dono antes de a Agenda virar real”
  (linha ~1474). Acrescentar no começo, sem apagar o texto antigo, com a evidência dos hashes acima e
  de `git log origin/main..main`:
  - decididas no chat em 02/10/2026;
  - itens 1 e 3 implementados (`eac0203`);
  - item 2 implementado com a 0027 versionada e não aplicada (`c008b1d`, `5e91ab3`, `534afd2`);
  - notas em `60d16b3`;
  - falta publicar pelo Roteiro 18.
- **`.planning/STATE.md`**, no frontmatter e no foco atual: “Agenda no ar; falta a caminhada” continua
  certo para produção. Acrescentar que há seis commits locais não publicados e que a próxima
  publicação é o Roteiro 18, com a `0027`.
- **`.planning/PROXIMA-SESSAO.md`**, linhas ~17 e ~19, que falam das “duas decisões do Theo” do
  Cowork como pendentes:
  - passam a “decididas em 02/10 (três, com o lote) e implementadas no quick 261002-sdt, não
    publicadas”, com “*Até 02/10/2026 esta linha dizia…*”;
  - o “Próximo” ganha “publicar pelo Roteiro 18 (backup, push, implantar, db:migrate)” antes da
    caminhada, ou junto com ela.
- **`ESTADO-ATUAL.md` e `Claude outputs/RETOMAR-AQUI.md`**: o mesmo conteúdo curto. Se houver item
  para isto em `Claude outputs/FILA-DO-CODE.md`, marcar ✅ com data.
- **`05-VERIFICACAO-HUMANA.md`**: a cópia de leitura em `Claude outputs/agenda/` já foi atualizada.

## Known Stubs

Nenhum.

## Threat Flags

Nenhuma superfície nova além do `<threat_model>`. As mitigações T-sdt-01..06 estão aplicadas:

- Zod sem default;
- `exigirUsuario()` na primeira linha e a situação relida sob `travarCobranca`;
- os três checks, provados em `test:migracoes`;
- a 0027 não aplicada, com o Roteiro 18 e o 503 da saúde;
- o lote com `useRef` e `disabled`.

## Self-Check: PASSED

- Os arquivos existem: `confirmar-lancar-lote.tsx`, `0027_dispensa-do-uso-livre.sql`,
  `0027_snapshot.json`, `18-migracao-dispensa-do-uso-livre.md`, e as cópias em
  `Claude outputs/agenda/`.
- Os commits existem em `main`: `eac0203`, `c008b1d`, `5e91ab3`, `534afd2` e `60d16b3`.

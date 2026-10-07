---
phase: quick-261007-shs
plan: 1
subsystem: financeiro, cadastros, ci
tags: [correcao, taxa-do-cartao, contas-fixas, ci, digest, revisao-06.5]
status: complete
requires:
  - "Fase 06.5 no ar e migrada (0031), revisão 06.5-REVIEW.md"
provides:
  - "BL-01: a parcela já recebida no cartão mantém a taxa na correção (servidor, núcleo e tela)"
  - "WR-01: rascunho e versão da correção de um retrato repeatable read"
  - "WR-02: cancelar uma correção avisa que a original fica cancelada"
  - "WR-03: Gerar as contas pergunta antes de recriar conta fixa cancelada no mês"
  - "WR-04: CI pelo digest; a ferramentas migra o efêmero e é conferida por hash"
  - "Roteiro 23"
affects:
  - "lib/financeiro (correcao, gravacao, acoes, consultas, taxa, textos, avisos)"
  - "lib/cadastros (contas-fixas, esquemas, acoes, textos, avisos)"
  - ".github/workflows/entrega.yml"
tech-stack:
  added: []
  patterns:
    - "herança da taxa congelada por regra pura + conferência pós-gravação no núcleo (duas camadas)"
    - "leitura de abertura numa transação repeatable read, read only"
    - "ação que pergunta antes de gravar (pergunta no ResultadoDaGeracao)"
    - "consumo de imagens pelo digest de construir"
key-files:
  created:
    - components/amassa/cadastros/geracao-de-contas.tsx
    - scripts/conferir-migracoes-da-imagem.mjs
    - tests/unit/conferir-migracoes-da-imagem.test.ts
    - tests/unit/entrega-digests.test.ts
    - docs/operacao/23-correcoes-da-revisao-06-5.md
  modified:
    - lib/financeiro/correcao.ts
    - lib/financeiro/gravacao.ts
    - lib/financeiro/acoes.ts
    - lib/financeiro/consultas.ts
    - lib/financeiro/taxa.ts
    - lib/financeiro/textos.ts
    - lib/financeiro/avisos.ts
    - components/amassa/financeiro/bloco-pagamento.tsx
    - components/amassa/financeiro/painel-venda.tsx
    - components/amassa/financeiro/aviso-contas-fixas.tsx
    - components/amassa/financeiro/aviso-financeiro.tsx
    - components/amassa/financeiro/confirmar-cancelar-documento.tsx
    - components/amassa/cadastros/botao-gerar-contas.tsx
    - components/amassa/cadastros/aviso-cadastros.tsx
    - app/gestao/(app)/financeiro/page.tsx
    - app/gestao/(app)/cadastros/page.tsx
    - lib/cadastros/contas-fixas.ts
    - lib/cadastros/esquemas.ts
    - lib/cadastros/acoes.ts
    - lib/cadastros/textos.ts
    - lib/cadastros/avisos.ts
    - scripts/provar-corridas-da-correcao.ts
    - .github/workflows/entrega.yml
    - tests/unit/financeiro-correcao.test.ts
    - tests/unit/financeiro-taxa.test.ts
    - tests/unit/cadastros-contas-fixas.test.ts
    - tests/unit/cadastros-textos.test.ts
    - tests/unit/cadastros-categorias.test.ts
    - tests/unit/financeiro-avisos.test.ts
    - tests/e2e/polimento-corrigir.spec.ts
    - tests/e2e/polimento-banco.spec.ts
    - tests/e2e/polimento-caixa.spec.ts
decisions:
  - "2ª passada da herança: mesmo dia e cartão com valor diferente herda a taxa"
  - "taxa null da original é herdada como null"
  - "conferência pós-gravação no núcleo da correção (erro desfaz tudo)"
  - "IN-01 (pagoPor) NÃO feito"
  - "WR-03: opções desmarcadas; pergunta antes de qualquer gravação; aba velha recebe frase"
  - "WR-04: banco migra pela imagem; e2e continua migrando pelo checkout"
metrics:
  duration: "~46 min de relógio (19:55–20:41 UTC de 07/10/2026)"
  completed: 2026-10-07
estimate:
  tokens: 140000
actuals:
  tokens: 73000
  tasks: 3
  commits: 4
---

# Quick 261007-shs: BL-01 e WR-01..WR-04 da revisão 06.5 — resumo

**Agora a parcela já recebida no cartão mantém, na venda corrigida, a taxa com que foi recebida.** Isso vale no
servidor, no núcleo da transação (que confere depois de gravar e desfaz tudo se a taxa mudaria) e no aviso da tela.
Provado contra Postgres com 4,99% × 3,49%: o líquido, o saldo e o Mês ficam idênticos.

Os quatro avisos também estão corrigidos:

- **WR-01:** a tela da correção lê o rascunho e a versão de um retrato só.
- **WR-02:** a confirmação de cancelar uma correção avisa que a original continua cancelada.
- **WR-03:** “Gerar as contas” pergunta antes de recriar uma conta fixa cancelada no mês.
- **WR-04:** a CI consome e promove as duas imagens pelo digest, e a `ferramentas` migra o banco efêmero e é
  conferida por hash.

Sem migração. **Não publicado.**

## Commits

| Tarefa | Hash | Mensagem |
|---|---|---|
| 1 | `5eaea39` | fix(financeiro): Corrigir mantém a taxa do cartão das parcelas já recebidas e lê rascunho e versão do mesmo retrato (quick 261007-shs, 06.5-BL-01/WR-01) |
| 2 | `80e09dc` | fix(cadastros,financeiro): Gerar pergunta antes de recriar conta fixa cancelada no mês e cancelar uma correção avisa que a original fica cancelada (quick 261007-shs, 06.5-WR-03/WR-02) |
| 3 (CI) | `4383076` | ci(entrega): imagens pelo digest testado e a ferramentas migra o banco efêmero antes de ser promovida (quick 261007-shs, 06.5-WR-04) |
| 3 (docs) | o commit `docs(estado)` deste quick | docs(estado): BL-01 e WR-01..04 da revisão 06.5 corrigidos no quick 261007-shs (não publicado) — leva este SUMMARY, o PLAN, a REVIEW, a UI-SPEC, o STATE e o PROXIMA-SESSAO |

**`TABELAS_ESPERADAS` não mudou; nenhuma migração.** `git diff 83c3837 --stat -- db/` sai vazio.

## O que foi feito

**Tarefa 1 — BL-01 + WR-01.**

- `taxasHerdadasDaCorrecao` (pura, em `lib/financeiro/correcao.ts`) casa as parcelas pagas no cartão da nova com as
  recebidas no cartão da original:
  - mesmo dia;
  - 1ª passada pelo mesmo valor, 2ª com qualquer valor;
  - cada original casa uma vez, na ordem do número;
  - o que casou herda a taxa, inclusive `null`;
  - vencimento vazio na tela não lança.
- `rascunhoDaCorrecao` devolve `pagasDaOriginal`.
- `gravarVenda` aplica a herança quando `contexto.pagasDaOriginal` vem. Sem ela, o comportamento é o de antes
  (Agenda, Queimas, lote e Venda comum).
- `lancarCorrecaoNaTransacao` ganhou dois passos:
  - **(4b)**: lê as pagas sob a trava, depois da versão;
  - **(6b)**: relê as parcelas gravadas da nova e lança `ERRO_TAXA_REESCRITA_NA_CORRECAO` se uma herdada diferir. A
    transação desfaz tudo.
- `lancarVenda` passa as pagas; `lancarDespesa` as ignora, com comentário.
- `obterDocumentoParaCorrecao` passou a ser `db.transaction(lerDocumentoParaCorrecao, { repeatable read, read only
  })`. Todas as leituras saem do mesmo `leitor`, inclusive os `unionAll` de `origensDaAgendaEDasQueimas`.
- O aviso do cartão na correção usa a taxa por parcela (`avisoDoCartao`) e escolhe entre três textos: o de sempre,
  `textoAvisoCartaoHerdado` e `textoAvisoCartaoMisto`.

**Tarefa 2 — WR-03 + WR-02.**

- `planejarGeracaoDoMes` (pura) decide entre “perguntar” e “gerar”.
- `esquemaGeracao` ganhou `canceladasVistas` e `recriar`:
  - uuid, no máximo 500, padrão `[]`;
  - `recriar` tem de estar dentro de `canceladasVistas`, com frase humana.
- `gerarContasDoMes`:
  - lê as contas ativas por `id` e faz UMA consulta agrupada com `bool_or`;
  - quando precisa perguntar, não grava nada e devolve `pergunta`, mais a frase para a aba velha;
  - quando gera, faz o MESMO `insert` com o mesmo `onConflictDoNothing` para `criar ∪ recriar`.
- `useGeracaoDeContas` é o fluxo e o diálogo compartilhados:
  - todas as opções abrem desmarcadas;
  - “Voltar” não grava;
  - se o servidor perguntar de novo, a lista é trocada, as marcas ficam, e `FRASE_CANCELADAS_MUDARAM` aparece com
    `role="alert"`.
  Os Cadastros e o Caixa usam o hook, e `mantidas` vai na URL do toast.
- `fraseCancelarCorrecao` aparece na confirmação, com o “Corrigir esta venda/despesa” como link.

**Tarefa 3 — WR-04, Roteiro 23 e documentos.**

- `construir` devolve `digest_app` e `digest_ferramentas`.
- `e2e` baixa e roda pelo digest.
- `banco`:
  - espera `construir`;
  - migra o efêmero pela `ferramentas` (`docker run … npx tsx db/migrate.ts`);
  - roda `conferir-migracoes-da-imagem.mjs`;
  - confere o atalho de migração da imagem por `node -e`;
  - só então roda `test:migracoes` e `test:backup`.
- `publicar` espera `construir`, `e2e` e `banco`, promove pelos digests e confere que as tags apontam para eles
  (linha `Digest:`).
- O cabeçalho do workflow foi reescrito, com a narrativa preservada.
- O Roteiro 23 foi escrito.

## Comandos rodados e resultados

**RED, antes de cada implementação:**

- **Tarefa 1:**
  - `npx vitest run tests/unit/financeiro-correcao.test.ts tests/unit/financeiro-taxa.test.ts` → 16 falharam;
  - `npm run test:migracoes` → exit 1, com a lista abaixo. O (f3) já passava, porque a despesa já gravava `null`;
    ele é guarda, não RED.
    ```
    4 caso(s) falharam:
      (f1) (f1): a 1/2 (recebida em 2026-08-28) deveria ter 499 e a 2/2 (recebida hoje) 349, veio [349,349].
      (f2) (f2): depende do (f1), que falhou.
      (f4) (f4): a correção deveria ser recusada pela taxa, veio passou.
      (g) (0 , import_consultas.lerDocumentoParaCorrecao) is not a function
    ```
- **Tarefa 2:** os 5 arquivos unitários do plano → 19 falharam.
- **Tarefa 3:**
  - `conferir-migracoes-da-imagem.test.ts` → não importa, porque o script não existia;
  - `entrega-digests.test.ts` → 9 falharam contra o workflow de antes. Os 2 de “só o banco efêmero” já passavam: são
    guardas.

**GREEN — `npm run test:migracoes` (Tarefa 1), saída das corridas:**
```
(f1) BL-01 — recebida a 4,99%, corrigida com a de hoje a 3,49%: a recebida mantém 4,99%...
  (f1) taxas da nova [499,349]; líquido 9501 → 9501; saldo antes de 2026-09-01 9501 → 9501; Mês 2026-08 entrou 9501 → 9501, vendeu 20000 → 20000 (resumo idêntico)
(f2) BL-01 — a cadeia: corrigir a corrigida com a de hoje a 3,00% mantém 4,99% e 3,49%...
  (f2) taxas da nova da nova [499,349] (a de hoje era 300)
(f3) BL-01 — a despesa paga no cartão corrigida continua sem taxa, o saldo igual...
(f4) BL-01 — o núcleo recusa a nova que reescreveria a taxa de uma parcela recebida...
(g) WR-01 — um “Recebi” no meio da leitura não separa o rascunho da versão...
Corridas da correção: todas as afirmações passaram (nenhum 40P01).
```
Em (f1), a nova grava 499 na parcela recebida em D1 = 2026-08-28 e 349 na recebida hoje. O resumo do Mês foi
comparado por `isDeepStrictEqual`.

**e2e — uma invocação por tarefa; a Tarefa 3 não tem e2e:**

| Tarefa | Comando | Resultado |
|---|---|---|
| 1 | `npm run test:e2e -- --grep "polimento corrigir\|financeiro-venda\|financeiro-pagamento"` | **175 passed, 1 failed** (2,7 min). O novo “venda (c)” passou nos dois projetos. A falha foi `[celular] financeiro-venda.spec.ts:496` (“a estrela na lista completa … depois de recarregar”: `aria-pressed` `false` depois do reload). É um spec e uma ação que esta tarefa não toca: o teste recarrega logo depois de um toque otimista. Para não gastar uma 2ª invocação, ele entrou no grep da Tarefa 2 |
| 2 | `npm run test:e2e -- --grep "polimento-banco\|polimento-caixa\|cadastros-contas-fixas\|polimento corrigir — detalhe\|a estrela na lista completa"` | **101 passed, 2 skipped, 0 failed** (1,8 min). Os 2 skipped são os pulos do próprio `cadastros-contas-fixas` no `celular`. A estrela passou nos dois projetos: era contenção sob carga, não defeito |

Nenhum `@parametro-global` entrou num grep, e não houve `npm run build` separado. Antes de cada e2e, `docker ps`
mostrava só `docker-postgres-1`, nenhum `amassa_app_e2e` velho. Antes de cada execução, `.next/types` foi apagado.

**`npm run verificar`:**

| Momento | Resultado |
|---|---|
| Fim da Tarefa 1 | exit 0 (3277 testes) |
| Fim da Tarefa 2 | exit 0 (3296 testes) |
| Fim da Tarefa 3, antes do commit de CI | **exit 0** — 125 ações / 0 violações, 147 arquivos / 3313 testes, `test:migracoes` “Todas as afirmações passaram” |

**A prova local da `ferramentas` (Tarefa 3, C.10):**

| Passo | Comando | Resultado |
|---|---|---|
| 1 | `docker build -f docker/Dockerfile --target ferramentas -t amassa-ferramentas-prova:local .` | exit 0 (55 s) |
| 2–3 | rede `amassa-prova-ferramentas` + `postgres:17-alpine` em `127.0.0.1:55432` | `accepting connections` |
| 4 | `docker run --rm --network amassa-prova-ferramentas -e DATABASE_URL=…@amassa-prova-pg:5432/amassa_prova amassa-ferramentas-prova:local npx tsx db/migrate.ts` | exit 0, “Migrações aplicadas com sucesso.” (e `node_modules/.bin/tsx` presente: o `npx` não baixa nada) |
| 5 | `DATABASE_URL=…@127.0.0.1:55432/amassa_prova node scripts/conferir-migracoes-da-imagem.mjs` | exit 0: **“32 migrações conferidas, iguais às do commit (última: 0031_polimento).”** |
| 6 (mordida) | `delete` da linha mais nova de `drizzle.__drizzle_migrations` e o conferidor de novo | **exit 1**: “A imagem não aplicou a migração 0031_polimento, que está no commit…” |
| 7 | o `node -e` do atalho contra a imagem | exit 0, “Atalho de migração da imagem: tsx db/migrate.ts.” |
| Limpeza | contêiner, rede e imagem `amassa-ferramentas-prova:local` removidos | 0 contêineres e 0 imagens restantes (`docker ps -a` / `docker images`). Nada foi empurrado |

**A extração do digest (C.11):**

- `docker buildx imagetools inspect ghcr.io/adcaponte/amassa:latest | awk '/^Digest:/ { print $2; exit }'` →
  `sha256:40c5d3aad8e2b3a44f05f409660abceee5f3c7e02aade4a5e513f7e31c819364`.
- `docker pull` da mesma tag → `Digest: sha256:40c5d3aad8e2b3a44f05f409660abceee5f3c7e02aade4a5e513f7e31c819364`.
- **Iguais.** A imagem baixada foi removida depois.

## O que só o primeiro push prova

- O GitHub aceitar os `outputs` de `construir` e os `needs` novos (`banco` e `publicar` com `construir`).
- O `docker run` da `ferramentas` no runner, com `--network host`, contra o service container.
- A conferência dos digests no `publicar`, com as tags de verdade.
- O tempo do run.

O dono vê os três passos novos do `banco` e a conferência do `publicar` no Roteiro 23, Passo 2.

## Decidido sem o Theo

| Item | O que ficou | Alternativa | Como desfazer |
|---|---|---|---|
| 2ª passada da herança | Mesmo dia e cartão, com valor diferente, herda a taxa da original | Casamento estrito da revisão (mesmo dia, forma **e** valor): mudar o valor de uma parcela recebida usaria a taxa de hoje | Tirar o `false` do laço `for (const mesmoValor of [true, false])` em `taxasHerdadasDaCorrecao` e o teste “segunda passada” |
| `null` herdado | Recebida no cartão sem taxa gravada continua sem taxa | Usar a taxa de hoje quando a original tem `null` | Em `gravarVenda`, `heranca.pontosBase ?? contexto.taxaCartaoPontosBase` |
| Conferência pós-gravação | O núcleo relê a nova e recusa (desfaz) se uma recebida mudaria de taxa; a ação cai na frase de rede | Confiar só em quem chama | Remover o passo (6b) de `lancarCorrecaoNaTransacao` e o caso (f4) |
| Dois textos novos do aviso | “ficou com X% — a taxa de quando a venda foi recebida…” (todas herdadas, mesma taxa) e o misto (total, sem percentual único) | Um texto só, sempre com o total | Trocar a escolha em `bloco-pagamento.tsx` |
| IN-01 (`pagoPor`) | **NÃO feito.** A parcela recebida da corrigida continua com `pago_por` = quem corrigiu | Herdar `pagoPor` da parcela casada | Fica para uma decisão do dono (fora do escopo dele em 07/10) |
| WR-01 | Retrato `repeatable read, read only`; a versão sai da mesma leitura e do mesmo normalizador da transação | Recalcular a versão a partir das linhas da página (sugestão da revisão) | `obterDocumentoParaCorrecao` volta ao `Promise.all` |
| WR-03, opções | Abrem desmarcadas (o lado seguro) | Abrir marcadas | O estado inicial `marcadas: []` em `useGeracaoDeContas` |
| WR-03, quando pergunta | Antes de qualquer gravação, numa chamada só (nem as outras contas são criadas antes da escolha) | Gerar as outras e perguntar só das canceladas | Mudar `planejarGeracaoDoMes` |
| WR-03, aba velha | A aba aberta antes da publicação recebe a frase (“… recarregue a página e gere de novo…”) num toast e não grava | Recriar como antes | — (é o lado seguro) |
| WR-03, `mantidas` | Vai na URL do toast (`&mantidas=`), validado 0..500 | Toast local | Tirar o parâmetro das duas navegações e dos `avisoDaUrl` |
| WR-03, corrida | Resíduo aceito: outra pessoa gerar **e** cancelar a mesma conta entre a leitura e o `insert` | Trava por conta | Comentado em `gerarContasDoMes` (T-shs-06) |
| WR-02 | O “Corrigir esta venda/despesa” é oferecido **dentro** da confirmação (contorno, ≥ 44 px), só quando o documento não tem origem que impeça corrigir | Só a frase | Tirar o `Button asChild` de `confirmar-cancelar-documento.tsx` |
| WR-04, `banco` | Migra pela imagem, não mais pelo checkout | Migrar pelos dois | Voltar o passo `npx tsx db/migrate.ts` do checkout |
| WR-04, comando | `npx tsx db/migrate.ts` no lugar do alias do npm (regra §8) e um `node -e` que confere o alias sem escrevê-lo | Citar o alias | — (a regra é do projeto) |
| WR-04, cancelamento | Resíduo do cancelamento no meio do `publicar` (tags de commits diferentes); o Roteiro 23 manda esperar o próximo run verde | Um `create` só com as duas tags | Comentado no job |
| WR-04, `e2e` | Continua migrando o efêmero dele pelo checkout | Migrar pela `ferramentas` também | — |
| Roteiro 23 | As consultas só leem; achado vai ao Code (correção de dados = outro quick, com backup; cadeia pede a taxa da raiz) | Correção à mão no `psql` | — |

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 3 — processo] Formatação revertida.** Um `npx prettier --write` nos arquivos da Tarefa 1 reformatou
   arquivos inteiros. O repositório não segue o `printWidth` 90 do `.prettierrc`; o diff de `consultas.ts` foi a
   406 linhas.
   - **Correção:** restaurei os nove arquivos do `HEAD` e reapliquei só as minhas edições, antes de qualquer
     commit.
   - **Efeito nos commits:** nenhum.
   - **Lição:** não rodar `prettier --write` neste repositório.
2. **[Rule 2] Guarda a mais na WR-02.** O “Corrigir” da confirmação só aparece quando `origemParaCorrecao ===
   null`. Uma correção nunca tem origem, mas a guarda evita oferecer um link que a página recusaria.
3. **[Rule 2] Frase própria para mais de 500 itens.** `FRASE_CANCELADAS_DEMAIS` (“Contas demais nesta escolha —
   recarregue…”) virou a mensagem do `.max(500)` de `esquemaGeracao`.
4. **`aviso-cadastros.tsx` limpa a URL inteira do aviso.** Tira `quantidade`, `mes` e `mantidas`, não só
   `mantidas`. Antes só tirava `aviso`. Nenhum e2e lê esses parâmetros: um grep por `quantidade=` em `tests/e2e`
   não acha nada.
5. **`ERRO_TAXA_REESCRITA_NA_CORRECAO` exportada.** A prova de corrida compara a mensagem pela constante, e não
   pelo texto copiado.
6. **Documentos de estado.**
   - **STATE:** o orquestrador pediu a linha na tabela “Quick Tasks Completed” à mão. O plano dizia para não
     tocar nela, e valeu o pedido do orquestrador.
   - **FILA-DO-CODE:** o título do item 9 ainda dizia “EXECUTADO, AGUARDANDO O DONO”, um presente velho desde o
     fechamento da 06.5 (`83c3837`). Foi corrigido para ✅ CONCLUÍDO em 07/10, com a evidência, e o título velho
     ficou preservado. A linha do quick entrou ali.
   - **RETOMAR-AQUI e PROXIMA-SESSAO:** os títulos estavam velhos desde 07/10 de manhã e ganharam nota datada.

### TDD Gate Compliance

O plano mandou **um commit por tarefa**, então não há commits `test(...)` separados.

- **RED:** registrado acima pelos comandos de cada tarefa, que falharam antes da implementação.
- **GREEN:** está nos commits `fix`/`ci`.

## Known Stubs

Nenhum.

## Threat Flags

Nenhuma superfície nova fora do `<threat_model>` do plano. Não há rota nova nem Server Action nova exportada:
`verificar-acoes` continua com 125. A única ação alterada é `gerarContasDoMes`, que segue com `exigirUsuario()` na
primeira linha.

## Self-Check: PASSED

- Arquivos criados, todos presentes:
  - `components/amassa/cadastros/geracao-de-contas.tsx`
  - `scripts/conferir-migracoes-da-imagem.mjs`
  - `tests/unit/conferir-migracoes-da-imagem.test.ts`
  - `tests/unit/entrega-digests.test.ts`
  - `docs/operacao/23-correcoes-da-revisao-06-5.md`
- Commits `5eaea39`, `80e09dc` e `4383076` presentes em `git log`.
- `git diff 83c3837 --stat -- db/` vazio.
- Os greps do `<verify>` acham as âncoras: `taxasHerdadasDaCorrecao`, `repeatable read`, `(f1)`/`(f4)`/`(g)`,
  `planejarGeracaoDoMes`, `useGeracaoDeContas`, `fraseCancelarCorrecao`, `needs.construir.outputs.digest_`,
  `conferir-migracoes-da-imagem` e `261007-shs`.

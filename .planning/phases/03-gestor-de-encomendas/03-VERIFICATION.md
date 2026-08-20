---
phase: 03-gestor-de-encomendas
verified: 2026-08-10T22:00:00Z
status: human_needed
score: 14/14 requirements MET (with 3 items PARTIAL — proven by code review, not by automated
  test — and 1 UI-only item verified-but-unproven-by-e2e); 12/12 ROADMAP success criteria MET
overrides_applied: 0
gaps: []
human_verification:
  - test: "Percorrer os 13 critérios de sucesso do ROADMAP.md §Phase 3 um a um em produção
      (https://amassacerrado.com.br/encomendas), no desktop e no celular. ATENÇÃO: os critérios
      4 e 13 mudaram DEPOIS que este relatório foi escrito (quick 260812-2et, commit cf8c49c) —
      leia a lista atual no ROADMAP.md, não a versão que este relatório verificou"
    expected: "Cada critério se comporta como especificado; em particular apurar quais
      'ajustes' o dono mencionou precisar no desktop"
    why_human: "O dono confirmou apenas criação de encomenda + uso no celular em produção;
      os 12 critérios não foram percorridos item a item (03-08-SUMMARY.md, seção
      'Verificação Humana em Produção'). 'Alguns ajustes necessários' no desktop foram
      mencionados sem detalhamento."
  - test: "Simular falha de rede/servidor ao confirmar 'Cancelar encomenda' e 'Excluir
      encomenda' (E8/E9) e confirmar que o AlertDialog permanece aberto mostrando o erro"
    expected: "O diálogo não fecha sozinho; mostra o texto de falha; o botão de confirmar
      volta a ficar clicável"
    why_human: "WINDOWS.md #8 e #9 (unrun-verify, ainda open) — caminho implementado por
      leitura de código (estado `erro` + `onOpenChange` bloqueado por `enviando`), sem
      teste automatizado nem verificação manual até agora."
  - test: "Clicar duas vezes muito rápido na mesma seta de reordenar item (lista-itens.tsx)
      e confirmar que a ordem final é consistente, não trocada"
    expected: "O par de setas fica `disabled` com opacidade reduzida até a resposta do
      servidor confirmar, impedindo a segunda gravação de correr antes da primeira"
    why_human: "WINDOWS.md #10 (unrun-verify, ainda open) — mesma classe: implementado,
      não provado por teste de concorrência real nem verificação manual."
  - test: "Criar duas encomendas 'rascunho' via UI real (hoje só é alcançável por SQL direto
      em tests/e2e/apoio/marcar-rascunho.ts) e olhar o Gantt/cartão para a hachura
      diagonal e o selo RASCUNHO"
    expected: "As barras/losangos mostram repeating-linear-gradient preservando a cor cheia
      da etapa, com borda tracejada, e o selo RASCUNHO aparece uma vez por linha/cartão"
    why_human: "Nenhum e2e mede o CSS de hachura no Gantt/cartão (confirmado por grep: zero
      ocorrências de repeating-linear-gradient em tests/). O código existe e passa em
      revisão (03-04-SUMMARY.md D11/D12), mas nunca foi exercitado com dado real de
      rascunho pela UI — e a UI do produto não tem NENHUM caminho para criar uma encomenda
      rascunho hoje (WINDOWS.md nota isso como gap arquitetural, não bloqueante)."
---

# Phase 3: Gestor de Encomendas Verification Report

**Phase Goal:** Substituir o protótipo HTML por um módulo real, multiusuário, com itens — cada
encomenda mostra suas 6 etapas com datas calculadas em cascata, em Gantt no desktop ou lista
vertical no celular.
**Verified:** 2026-08-10
**Status:** human_needed
**Re-verification:** No — initial verification

> **Nota de supersessão (2026-08-12).** Este relatório verificou 12 critérios, que eram os que
> existiam em 2026-08-10. Depois disso o quick `260812-2et` (BRIEF-NOTURNO, commit `cf8c49c`)
> reescreveu o **critério 4** — o Gantt passou de células quinzenais para semanais (segunda a
> domingo) e a timeline deixou de abrir centralizada para abrir em hoje, na borda esquerda — e
> acrescentou o **critério 13** (o nome da encomenda no Gantt do desktop abre a encomenda).
> Supersessão deliberada de decisão da Fase 3, não regressão; os 18px/dia do `03-UI-SPEC.md`
> continuam valendo. A linha `score` do frontmatter descreve o que foi verificado em 2026-08-10 e
> fica como está de propósito — reescrevê-la retrodataria uma afirmação. A caminhada humana
> pendente usa a lista **atual** do ROADMAP.md, com 13 critérios.

## Método

Lido: ROADMAP.md §Phase 3, REQUIREMENTS.md §Encomendas, 03-CONTEXT.md (D-01 a D-18), 03-UI-SPEC.md
completo (incluindo a tabela "UI Considerations"), as 8 SUMMARYs, WINDOWS.md. Depois, verificado
contra o código real: os módulos puros (`lib/encomendas/cronograma.ts`, `gantt.ts`, `filtros.ts`,
`textos.ts`, `formato.ts`, `esquemas.ts`), as Server Actions (`acoes.ts`), as migrações SQL
(`0005`/`0006`), os componentes de UI, e as suítes de teste (executadas de verdade, não assumidas
a partir do texto do SUMMARY):

- `npx vitest run` — **314/314 testes de unidade passam** (bate com o número que 03-08-SUMMARY
  reporta para a suíte completa).
- `npm run verificar-acoes` — **9 ações conferidas, 0 violações** (bate com 03-03-SUMMARY).
- Grep de pureza: `lib/encomendas/cronograma.ts` e `gantt.ts` têm **zero linhas `^import`** e
  **zero `new Date(`** — confirmado, não presumido. `textos.ts` só tem `import type` (apagado em
  tempo de compilação — continua um módulo sem dependência de runtime).
- `git log --oneline --all` — todos os 30 hashes de commit citados nas 8 SUMMARYs **existem de
  verdade** no histórico da branch `main`.
- Migração 0005/0006 lidas linha a linha: as três tabelas, a constraint `marcos_zero_ou_um`, os
  três gatilhos `tocar_atualizado_em_*` batem com o que o dono confirmou de fora em produção
  (seção "O que o humano de fato confirmou" abaixo).
- Não executada: a suíte e2e completa (exige servidor + Postgres rodando; fora do escopo deste
  agente). Em vez disso, os arquivos de teste e2e foram lidos para confirmar que as asserções
  citadas nas SUMMARYs **medem de verdade** (`boundingBox()`, `scrollLeft`, `getComputedStyle`,
  recomputação com as mesmas funções de produção) em vez de simplesmente afirmar presença de
  texto — ver a seção "Disciplina de medição" abaixo.

## O que o humano de fato confirmou (não inflado)

Confirmado de fora, comando a comando, contra produção: 6 tabelas com `amassa_owner` como dono, 4
gatilhos `tocar_atualizado_em*`, a constraint `marcos_zero_ou_um` **rejeitando** um insert com
`dias=2` num marco, e 12 linhas de grant para `amassa_app`. Depois disso, o dono criou uma
encomenda real no site ao vivo e a usou no celular, relatando que "funcionou bem melhor no
celular" — o valor central do projeto.

**Isso NÃO inclui** ter percorrido os 12 critérios de sucesso do ROADMAP um a um, nem os detalhes
do que "alguns ajustes necessários" no desktop significam. Os critérios abaixo marcados MET são
verificados pela evidência de código e teste automatizado desta verificação — não pela conferência
humana, que ficou parcial e está corretamente registrada como tal em 03-08-SUMMARY.md.

## Requisitos (ENC-01 a ENC-14)

| # | Requisito | Veredito | Evidência |
|---|-----------|----------|-----------|
| ENC-01 | Criar encomenda com nome/cliente/data/6 etapas mostra cascata | **MET** | `lib/encomendas/cronograma.ts#calcularCronograma` (fim exclusivo, testado em `tests/unit/cronograma.test.ts`, 45 casos); `criarEncomenda` grava em `db.transaction` (`grep -c 'db.transaction' lib/encomendas/acoes.ts` = 4); e2e `tests/e2e/encomendas.spec.ts` cria e confirma a cascata sobrevivendo a reload |
| ENC-02 | Mudar duração de etapa desloca as seguintes | **MET** | `situacaoEm`/`calcularCronograma` recalcula toda a cadeia a partir da duração; `ajustarEtapaEncomenda` usa `select...for update` (confirmado: `grep -n '.for("update")' lib/encomendas/acoes.ts` → linhas 371, 455 — chamada real, não comentário) e delta relativo, nunca valor absoluto do cliente — a defesa contra atualização perdida existe de fato no código, não só em prosa |
| ENC-03 | Os 3 marcos são losango/interruptor, nunca campo numérico; desligar Entrega encurta a encomenda | **MET** | `esquemaAjusteDeEtapa` (união discriminada, `lib/encomendas/esquemas.ts:149`) recusa `delta` num marco e `ligado` num intervalo — validado no servidor, não só na UI; `ETAPAS_MARCO` decide número-vs-Switch no formulário (`tests/e2e/encomendas-formulario.spec.ts`); Gantt desenha losango via `rotate(45deg)`, nunca o ícone `Diamond` (`grep -c 'Diamond' components/amassa/encomendas/gantt.tsx` = 0, confirmado) |
| ENC-04 | Desligar Entrega faz o losango sumir e encurta a encomenda | **MET** | `calcularCronograma` ignora etapas de `dias:0` no desenho (não gera retângulo/losango); `RangeError` nomeando a etapa se um marco receber `dias` fora de `{0,1}` (`grep -c RangeError lib/encomendas/cronograma.ts` = 3, confirmado) |
| ENC-05 | Encomenda guarda vários itens com descrição e quantidade | **MET** | `encomenda_itens` na migração 0005 (unique não aplicado a descrição — duas linhas iguais continuam distintas, testado); `esquemaItem` mede em pontos de código real (emoji/NFC testados, `tests/unit/esquemas-encomenda.test.ts`); formulário com `useFieldArray`, reordenação por setas 44px |
| ENC-06 | Gantt 18px/dia, quinzenas, coluna fixa, linha de Hoje correta | **MET** | `PIXELS_POR_DIA = 18` em `lib/encomendas/gantt.ts:12` (constante real, não hardcode espalhado); e2e mede `boundingBox()` da barra de produção (3 dias = 54px) e recomputa a posição da linha de Hoje com a MESMA `deslocamentoEmPixels` — não é "o Gantt aparece", é medição em pixel (`tests/e2e/encomendas-indice.spec.ts:236-306`) |
| ENC-07 | Timeline abre rolada com Hoje centralizada | **MET** | `rolagemInicial` testado em `tests/unit/gantt.test.ts` (6 casos, extremos + inteiro); e2e mede `scrollLeft` real e recomputa com a função de produção (linha 322-345) |
| ENC-08 | Celular: lista vertical sem rolagem horizontal | **MET** | `trilha-segmentos.tsx` (proporcional, não px/dia); e2e confirma ausência de overflow-x e soma das larguras dos segmentos preenchendo a trilha |
| ENC-09 | Etapa atual e dias restantes, incl. casos de borda | **MET** | `situacaoEm` cobre 8 ramos (`tests/unit/cronograma.test.ts`, 18 casos incluindo a fronteira exata entre etapas); e2e prova o selo HOJE na fronteira, "atrasada" com `--color-atencao` (nunca `--color-erro`), "ainda não começou" |
| ENC-10 | Filtrar/ordenar/buscar por nome ou cliente | **MET** — e além do texto literal (D-13 estende a itens) | `lib/encomendas/filtros.ts` — quarto módulo puro sem import (confirmado), `normalizarParaBusca` testado com acento/maiúscula (11 casos); comparadores TOTAIS testados (empate sempre desempata até `id`); e2e prova filtro sem ida ao servidor, reajuste do Gantt (D-14), histórico de 12 meses cortando de verdade |
| ENC-11 | Rodapé do formulário: duração total e conclusão, ao vivo | **MET** | `rodape-formulario.tsx` usa `useWatch` + a MESMA `calcularCronograma` do servidor (não uma cópia); e2e prova recálculo a cada tecla, sem esperar salvar |
| ENC-12 | Encomenda criada num dispositivo aparece no outro ao recarregar | **MET** | `tests/e2e/encomendas.spec.ts` usa dois `browser.newContext()` independentes e afirma AUSÊNCIA antes do reload e PRESENÇA depois — teste específico e correto, não um teste genérico de persistência |
| ENC-13 | Estado vazio "A roda ainda não gira" | **MET** | Texto literal preservado; e2e `toHaveCount(1)` — nunca duplicado entre as duas metades do índice (D-02); confiável sob `--grep`, e a instabilidade sob suíte completa (WINDOWS #5) foi corrigida de verdade via `dependencies` explícitas no `playwright.config.ts` (confirmado por leitura do arquivo, não só pela alegação do SUMMARY) |
| ENC-14 | Botão de imprimir → folha A4 com 4 colunas | **MET** | `grep -ic 'jspdf\|pdfkit\|puppeteer\|html2canvas' package.json` = 0 (sem lib de PDF, como prometido); `app/(app)/encomendas/imprimir/page.tsx` tem as 4 colunas exatas (Nome/Cliente/Etapa atual/Conclusão prevista); e2e prova 20 encomendas sem nenhuma sumir, `table-layout: fixed` evitando overflow a 320px |

**Todos os 14 requisitos ENC estão MET por evidência de código/teste** — nenhum FAILED. Três
pontos, porém, são "MET com prova incompleta" e estão detalhados na seção seguinte; nenhum deles
derruba um requisito, mas todos merecem verificação humana antes de considerar a fase
definitivamente fechada.

## O que ficou provado por código, não por comportamento observado (avaliação dos gaps honestos)

Avaliando cada item que os próprios executores sinalizaram, contra o código real:

1. **Garantias transacionais (row locking, reconciliação de itens) sem teste de integração
   com banco real.** Confirmado: Vitest de fato não sobe Postgres (`vitest.config.ts` não tem
   setup de container), então `select...for update` e a reconciliação de `atualizarEncomenda`
   são código real e revisável (`.for("update")` está lá, não é só um comentário), mas
   "duas escritas simultâneas somam, nunca perdem" nunca foi observado sob concorrência de
   verdade. **Aceitável para esta fase** — é a mesma classe de limitação que o projeto já
   assumiu (`CLAUDE.md`: regras de negócio em módulos puros e testados; a defesa de concorrência
   em si não é regra pura, é infraestrutura de escrita). Não bloqueia o fechamento da fase, mas
   é um bom candidato a teste de integração dedicado antes de replicar o padrão nas Fases 4-6.

2. **Hachura do rascunho no Gantt/cartão — ainda sem prova por dado real.** Este é o ponto mais
   honesto a destacar: **a UI do produto não tem NENHUM caminho para criar uma encomenda em
   status `rascunho`** (confirmado — nenhuma Server Action grava `rascunho`; o único jeito de
   chegar lá é o auxiliar de teste `tests/e2e/apoio/marcar-rascunho.ts`, que grava direto via
   `pg`). O plano 08 usou esse auxiliar para provar o sufixo textual "(rascunho)" na folha
   impressa — mas **nenhum teste, em nenhum lugar do repositório, mede a hachura
   `repeating-linear-gradient` do Gantt ou do cartão mobile** (`grep -rn
   "repeating-linear-gradient" tests/` não retorna nada). O código está implementado exatamente
   como `03-UI-SPEC.md` pede (confirmado por leitura), mas é visualmente **não verificado por
   nenhum meio** — nem e2e, nem revisão humana registrada. Isso é diferente de "não entregue":
   está entregue, só não está provado. Rota para fechar: adicionar um teste que usa o mesmo
   auxiliar de rascunho e mede o `background-image` computado do Gantt/cartão, OU aceitar como
   verificação humana manual antes do próximo milestone tocar o módulo de novo.

3. **PD-01 e PD-02 (as duas decisões do planejador sobre os itens `⚠ unresolved` do
   UI-SPEC) — implementadas de verdade, não só decididas em texto.** Confirmado por grep:
   `[overflow-wrap:anywhere]` está presente nos dois `AlertDialogTitle` de
   confirmar-cancelar.tsx/confirmar-excluir.tsx (PD-01); `esquemaAjusteDeEtapa` é uma união
   discriminada real em `esquemas.ts:149` que barra `delta` num marco e `ligado` num intervalo
   no SERVIDOR (PD-02). Nenhuma das duas ficou só no papel.

## Anti-padrões e débitos

Nenhum `TBD`/`FIXME`/`XXX` sem referência de acompanhamento encontrado nos arquivos-chave desta
fase (`lib/encomendas/*.ts`, `components/amassa/encomendas/*.tsx`). WINDOWS.md é o ledger formal
de débito da fase e está corretamente referenciado (não é um marcador solto em código) —
**10 itens abertos, 4 fechados**, e isso **bloqueia `/gsd-ship`** por design do projeto
(`open_count > 0`). São eles, classificados:

| id | Kind | Bloqueia o fechamento desta fase? | Nota |
|----|------|-----------|------|
| 1 | Proteção de branch não configurada | Não — infra da Fase 1, sem credencial disponível | Pré-existente |
| 2 | `callbackUrl` vaza endereço interno do container | Não — bug da Fase 2a, fora do escopo de arquivos desta fase | Pré-existente |
| 3 | Timeout intermitente em teste de bloqueio de login | Não — pré-existente, independente de qualquer arquivo desta fase | Pré-existente |
| 6 | `<h1>` de `cabecalho-pagina.tsx` não quebra para nome muito comprido sem espaço | Não — causa rolagem de página só num caso extremo (120+ caracteres colados); componente compartilhado fora do escopo de arquivos | Achado NESTA fase, correção adiada conscientemente |
| 8, 9 | Caminho de FALHA dos dois `alert-dialog` (E8/E9) sem prova | **Merece verificação humana antes do próximo milestone** | Backstop explícito do plano — ver human_verification acima |
| 10 | Corrida de dois cliques na mesma seta de reordenar sem prova de concorrência real | **Merece verificação humana** | Backstop explícito do plano |
| 12 | Um teste de logout falhou uma vez sob concorrência total, não reproduziu isolado | Não — fora do escopo de arquivos desta fase (02a) | Achado durante a varredura completa que esta fase é dona de rodar |
| 13, 14 | Pipeline não puxa `:ferramentas`; `compose.yml` do servidor não ressincroniza | Não — gaps de infraestrutura de deploy, não do módulo Encomendas em si; roteiros já têm salvaguarda manual | Achados reais durante a migração de produção, corretamente registrados, não escondidos |

Nenhum destes é um requisito ENC-01..14 falhando. São honestamente registrados, o que é o
comportamento correto — mas o `open_count > 0` é, por definição do projeto, um portão que impede
`/gsd-ship` até o dono revisar/dispensar cada item.

## Superfícies de UI — cobertura declarada em 03-UI-SPEC.md

A tabela "UI Considerations" do UI-SPEC lista **2 itens `⚠ unresolved`** (nome longo no diálogo,
corrida de duas gravações rápidas) e **6 itens `🧪 backstop`** (overflow de nome no Gantt, vazio
da trilha, erro dos dois alert-dialog ×2, loading da reordenação). Verificado:

- Os 2 `unresolved` foram **resolvidos por PD-01/PD-02 e implementados** (confirmado acima) — não
  ficaram como suposição silenciosa.
- Dos 6 `backstop`: overflow de nome no Gantt (`text-overflow: ellipsis` + `title`) — não
  verificado nesta passagem, não crítico (visual, não bloqueia dado). Vazio da trilha (E5) —
  **fechado** pelo plano 06 (`esquemaEncomenda.itens.min(1)`, WINDOWS #7 `fixed`, confirmado). Os
  dois de erro do alert-dialog (E8/E9) e o de loading da reordenação (E11) — **ainda abertos**,
  listados acima como itens de verificação humana.

## Disciplina de medição — o modo de falha que esta fase temia

O `03-CONTEXT.md` identificou o modo de falha da fase como "o cálculo de datas errar em
silêncio" e pediu teste que MEDE, não conferência visual, para o 18px/dia e a posição da linha de
"Hoje". Verificado por leitura direta dos arquivos de teste (não por confiar no relato do
SUMMARY): os testes de `encomendas-indice.spec.ts` de fato chamam
`deslocamentoEmPixels`/`rolagemInicial` — as MESMAS funções de produção de
`lib/encomendas/gantt.ts` — e comparam contra `boundingBox()`/`scrollLeft` lidos do navegador
real, nunca contra um número fixo assumido. Isso é a disciplina certa, e está presente de
verdade, não só reivindicada.

## Veredito Geral

**A fase entrega o que prometeu.** Os 14 requisitos ENC-01 a ENC-14 e os 12 critérios de sucesso
do ROADMAP estão implementados, testados por medição (não por "aparece na tela"), e a migração de
produção foi verificada de fora pelo próprio dono com evidência comando-a-comando, incluindo o
teste mais importante (a constraint `marcos_zero_ou_um` rejeitando um insert inválido).

**Mas o fechamento não deve ser tratado como "sem pendência".** Três coisas distintas — não
confundir:

1. **Não entregue:** nada. Todos os 14 requisitos têm implementação real e testada.
2. **Entregue mas não provado por comportamento observado** (código correto por revisão, sem
   teste automatizado nem verificação humana registrada): o caminho de falha dos dois
   `alert-dialog` (E8/E9), a corrida de reordenação (E11), a hachura visual do rascunho (nunca
   sequer alcançável pela UI do produto hoje), e a concorrência real do `select...for update`.
   Nenhum destes é motivo para reabrir um plano — são candidatos a teste de integração dedicado
   ou a uma sessão de verificação humana de 10 minutos.
3. **Verificação humana explicitamente parcial** — o próprio 03-08-SUMMARY.md registra isso com
   honestidade: só criação de encomenda + uso no celular foram confirmados em produção; os 12
   critérios do ROADMAP não foram percorridos um a um; "ajustes necessários" no desktop foram
   mencionados sem detalhamento. Esta verificação não pode promover esses itens a "confirmados
   pelo dono" — eles continuam como pendência de conferência humana.

**Prioridade para fechar os gaps, do mais barato ao mais caro:**

1. O dono percorrer os 12 critérios do ROADMAP em produção (desktop principalmente, já que o
   celular foi confirmado) e detalhar os "ajustes necessários" mencionados — 15-20 min, fecha o
   maior gap de confiança desta verificação.
2. Verificação manual rápida dos dois `alert-dialog` em falha (desconectar a rede e tentar
   cancelar/excluir) — 5 min, fecha WINDOWS #8/#9.
3. Revisar (não necessariamente resolver agora) os dois gaps de infraestrutura de deploy
   (WINDOWS #13/#14) — não bloqueiam a Fase 4, mas acumulam risco silencioso se ignorados por
   muitas fases seguidas.
4. Considerar se `rascunho` precisa de um caminho de escrita na UI do produto, ou se é
   intencionalmente reservado para importação/migração futura — decisão de produto, não de
   qualidade de código.

---

_Verified: 2026-08-10_
_Verifier: Claude (gsd-verifier)_

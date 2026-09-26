---
quick_id: 260926-qpv
description: Remove o atalho "Pagar conta que já existe" da Despesa (decisão do dono, 26/09/2026)
mode: quick
phase: quick-260926-qpv
plan: 1
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [FNC-06]
files_modified:
  - components/amassa/financeiro/painel-despesa.tsx
  - lib/financeiro/textos.ts
  - tests/e2e/financeiro-despesa.spec.ts
  - .planning/phases/04.4-financeiro-parte-1/BRIEFING.md
  - .planning/REQUIREMENTS.md
  - .planning/phases/04.4-financeiro-parte-1/04.4-UI-SPEC.md
  - .planning/phases/04.4-financeiro-parte-1/04.4-CONTEXT.md
estimate:
  tokens: 22000
  raw_tokens: 10000
  tasks: 3
  confidence: high

must_haves:
  truths:
    - "A Despesa mostra exatamente duas pílulas (\"Compra de material\"/\"Outra despesa\"); nenhum data-testid=\"despesa-modo-conta\" existe mais na árvore."
    - "ROTULO_PILULA_CONTA, o import de Link/ChevronRight em painel-despesa.tsx e qualquer comentário citando 'três pílulas'/'três caminhos' foram removidos ou corrigidos — nenhum resíduo do terceiro modo."
    - "tests/e2e/financeiro-despesa.spec.ts não afirma mais o atalho removido; a cobertura das duas pílulas restantes (grupo acessível, nome 'Tipo de despesa') continua intacta."
    - "npm run test:e2e -- --grep \"financeiro despesa|acessibilidade\" passa limpo (uma invocação para a tarefa)."
    - "BRIEFING.md §1, REQUIREMENTS.md (FNC-06), 04.4-UI-SPEC.md (seção Despesa) e 04.4-CONTEXT.md (se citar o terceiro caminho) registram a decisão do dono, datada 2026-09-26, com o motivo (\"o botão pareceu inútil e grande no uso real no celular\") e a consequência (quem quer pagar uma conta já existente vai por Caixa → \"A pagar\" → \"Paguei\")."
    - "npm run verificar passa limpo."
  artifacts: []
  key_links:
    - "type ModoDespesa em painel-despesa.tsx continua só \"compra\" | \"outra\" (já era assim antes desta tarefa — confirmar que nada precisa mudar em rascunho.ts/esquemas.ts, que já não tinham um terceiro membro)"
---

<objective>
O dono usou o módulo Financeiro no celular e decidiu, hoje (26/09/2026), tirar o atalho "Pagar
conta que já existe" da tela Despesa: achou o botão inútil e grande no uso real. Isso CONTRADIZ o
briefing/protótipo aprovados (que descrevem "três caminhos" para a Despesa) — o dono é a
autoridade e decidiu, então o código muda, e cada documento que descreve os "três caminhos" ganha
uma nota datada explicando a mudança e o porquê, sem reescrever a história (o briefing original
continua legível, só ganha uma nota abaixo).

Consequência que precisa ficar escrita onde alguém vai encontrar depois: sem o atalho, quem quer
pagar uma conta que já existe não acha mais nada na Despesa — o caminho passa a ser
Caixa → "A pagar" → "Paguei". Andressa (a outra usuária) ainda não aprendeu o layout; a nota evita
que ela procure em vão.

Purpose: remover o terceiro modo por completo (componente, textos, testes), sem tocar em nada do
servidor (o `modo` já era uma união fechada de dois membros em `lib/financeiro/esquemas.ts`/
`lib/financeiro/rascunho.ts` — o atalho sempre foi um `<Link>` client-side para `?aba=caixa`,
nunca um terceiro valor de `modo` no banco).

Output: Despesa com duas pílulas; e2e sem o caso do atalho, mas com a cobertura do que continua
existindo intacta; os quatro documentos de planejamento com a decisão registrada; `npm run
verificar` verde; nada pushado.
</objective>

<execution_context>
@C:/Users/Andre/amassa/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/Andre/amassa/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.claude/CLAUDE.md
@.planning/STATE.md
@components/amassa/financeiro/painel-despesa.tsx (o componente com o atalho a remover)
@lib/financeiro/textos.ts (ROTULO_PILULA_CONTA)
@lib/financeiro/rascunho.ts (RascunhoDeDespesa.modo já é só "compra"|"outra" — confirmar, não mudar)
@lib/financeiro/esquemas.ts (esquemaDespesaEntrada já é só "compra"|"outra" — confirmar, não mudar)
@tests/e2e/financeiro-despesa.spec.ts (os dois casos que exercitam o atalho)
@tests/e2e/acessibilidade.spec.ts (varredura genérica de /financeiro?aba=despesa)
@.planning/phases/04.4-financeiro-parte-1/BRIEFING.md §1
@.planning/REQUIREMENTS.md (FNC-06)
@.planning/phases/04.4-financeiro-parte-1/04.4-UI-SPEC.md (§Foco Visual Principal, linha da Despesa)
@.planning/phases/04.4-financeiro-parte-1/04.4-CONTEXT.md (§Phase Boundary)
</context>

<descoberta_de_projeto>
**O atalho nunca foi um terceiro valor de `modo` no servidor.** `lib/financeiro/rascunho.ts::RascunhoDeDespesa.modo`
e `lib/financeiro/esquemas.ts::esquemaDespesaEntrada` já eram uma união fechada de exatamente dois
membros ("compra"|"outra") — o "terceiro caminho" sempre foi um `<Link href="/financeiro?aba=caixa">`
puramente client-side dentro de `painel-despesa.tsx`, sem passar por Zod nem pelo banco. Isso
significa: **nenhuma mudança de schema, nenhuma migração, nada no servidor** — a remoção é
inteiramente de componente, texto e teste.

**O que sai de `painel-despesa.tsx`:**
- `import Link from "next/link"` e `import { ChevronRight } from "lucide-react"` (linhas 4-5) — só
  usados pelo atalho removido, confirmado por grep no arquivo inteiro.
- `ROTULO_PILULA_CONTA` do bloco de import de `lib/financeiro/textos.ts` (linha 36).
- O `<Link data-testid="despesa-modo-conta">...</Link>` inteiro (linhas 568-575) — o `<div
  role="group">` das duas pílulas reais fica, o `<Link>` que ficava DEPOIS dele (fora do grupo,
  por desenho do 04.4-13) sai.
- Os dois comentários que citam "as três pílulas"/"pagar conta que já existe" (linhas 96-102,
  cabeçalho da função; linhas 540-543, acima do grupo) — reescritos para descrever só as duas
  pílulas que restam.

**O que sai de `lib/financeiro/textos.ts`:** a constante `ROTULO_PILULA_CONTA` (linha 272) e a
palavra "três" no comentário da linha 265 ("as três pílulas do topo").

**e2e:** dois pontos em `tests/e2e/financeiro-despesa.spec.ts`:
1. O teste "a aba Despesa existe e abre nas três pílulas" (linha 40) afirma a VISIBILIDADE do
   atalho (linha 46) e a AUSÊNCIA dele dentro do grupo (linha 55) — a primeira asserção é do
   atalho removido (sai); a segunda prova que o grupo acessível tem só as duas pílulas reais
   (fica, continua válida, só muda de "afirma ausência DENTRO do grupo" para não precisar mais
   contrastar com uma presença FORA dele — mas a asserção em si permanece correta e útil: o grupo
   nunca deve conter o atalho, mesmo que ele nem exista mais). Renomear o teste (não é mais sobre
   três pílulas) e remover só a linha 46.
2. O teste "'Pagar conta que já existe' leva a ?aba=caixa" (linha 259) testa SÓ o atalho — sai
   inteiro, nenhuma outra asserção para preservar.

Nenhum outro caso do arquivo usa `despesa-modo-conta` ou o atalho.

**Documentos de planejamento — a decisão do dono, verbatim:** "o botão pareceu inútil e grande no
uso real no celular". Cada um dos quatro locais abaixo ganha uma nota datada 2026-09-26, sem
apagar a frase original que descreve os "três caminhos" (ela vira histórico, com a nota logo
abaixo dizendo o que mudou e por quê):
- `BRIEFING.md` §1 — a lista `Despesa — três caminhos: ...`
- `REQUIREMENTS.md` — FNC-06 (a linha da tabela de rastreabilidade não muda, "Complete" continua
  valendo; o texto do requisito em si ganha a nota)
- `04.4-UI-SPEC.md` — a linha da Despesa em §Foco Visual Principal (já cita o 04.4-13; esta nota
  acrescenta o 260926-qpv por cima)
- `04.4-CONTEXT.md` — §Phase Boundary, a frase que cita "pagar conta que já existe" entre parênteses

Cada nota inclui a consequência: quem quer pagar uma conta que já existe vai por
Caixa → "A pagar" → "Paguei".
</descoberta_de_projeto>

<orcamento_de_e2e>
Regra do CLAUDE.md §Conventions: no máximo UMA invocação de `npm run test:e2e -- --grep` por
tarefa. Este quick task usa uma única invocação, cobrindo `financeiro despesa` E
`acessibilidade` juntos (mesmo padrão do plano 04.4-13), na Tarefa 1.
</orcamento_de_e2e>

<tasks>

<task type="auto" number="1">
<description>Remover o terceiro modo do componente, dos textos e dos testes e2e</description>
<files>components/amassa/financeiro/painel-despesa.tsx, lib/financeiro/textos.ts, tests/e2e/financeiro-despesa.spec.ts</files>
<verify>npm run test:e2e -- --grep "financeiro despesa|acessibilidade"</verify>
<done>painel-despesa.tsx não importa mais Link/ChevronRight nem ROTULO_PILULA_CONTA, e não renderiza mais nenhum elemento com data-testid="despesa-modo-conta"; lib/financeiro/textos.ts não exporta mais ROTULO_PILULA_CONTA; tests/e2e/financeiro-despesa.spec.ts não afirma mais o atalho (teste dedicado removido, asserção de visibilidade removida do teste renomeado), mas continua provando o grupo acessível "Tipo de despesa" com as duas pílulas reais; grep -rn "ROTULO_PILULA_CONTA\|despesa-modo-conta" no repositório (fora .planning/) não encontra nada; o grep de "financeiro despesa|acessibilidade" passa limpo (desktop + celular).</done>
</task>

<task type="auto" number="2">
<description>Registrar a decisão datada do dono nos quatro documentos de planejamento (BRIEFING, REQUIREMENTS, UI-SPEC, CONTEXT)</description>
<files>.planning/phases/04.4-financeiro-parte-1/BRIEFING.md, .planning/REQUIREMENTS.md, .planning/phases/04.4-financeiro-parte-1/04.4-UI-SPEC.md, .planning/phases/04.4-financeiro-parte-1/04.4-CONTEXT.md</files>
<verify>grep -rn "260926-qpv\|26/09/2026" .planning/phases/04.4-financeiro-parte-1/BRIEFING.md .planning/REQUIREMENTS.md .planning/phases/04.4-financeiro-parte-1/04.4-UI-SPEC.md .planning/phases/04.4-financeiro-parte-1/04.4-CONTEXT.md</verify>
<done>Os quatro arquivos citam a data 2026-09-26, o motivo do dono ("pareceu inútil e grande no uso real no celular") e a consequência (Caixa → "A pagar" → "Paguei") — sem apagar a descrição original dos "três caminhos", só anotando por cima.</done>
</task>

<task type="auto" number="3">
<description>Verificação completa, SUMMARY.md e atualização de STATE.md</description>
<files>.planning/quick/260926-qpv-remove-atalho-pagar-conta-da-despesa/260926-qpv-PLAN.md, .planning/quick/260926-qpv-remove-atalho-pagar-conta-da-despesa/260926-qpv-SUMMARY.md, .planning/STATE.md</files>
<verify>npm run verificar</verify>
<done>lint, tsc --noEmit, verificar-acoes, testes unitários e test:migracoes passam limpo; SUMMARY.md registra os achados, os comandos rodados e a decisão de não pushar; STATE.md ganha a linha na tabela "Quick Tasks Completed".</done>
</task>

</tasks>

<verification>
`npm run verificar` verde. `grep -rn "ROTULO_PILULA_CONTA\|despesa-modo-conta" --include="*.ts" --include="*.tsx" .` (fora `node_modules`) não encontra nada. `npm run test:e2e -- --grep "financeiro despesa|acessibilidade"` passa 100%. Os quatro documentos de planejamento citam a data e o motivo da decisão.
</verification>

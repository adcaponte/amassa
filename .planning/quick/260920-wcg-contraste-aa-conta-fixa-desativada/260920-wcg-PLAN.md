---
quick_id: 260920-wcg
description: Corrigir a violação real de color-contrast (axe-core) que barrou o deploy — WCAG 1.4.3, UI-09 — e o mesmo achado onde quer que apareça
mode: quick
phase: quick-260920-wcg
plan: 1
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: []
files_modified:
  - components/amassa/cadastros/lista-contas-fixas.tsx
  - components/amassa/cadastros/lista-categorias.tsx
  - components/amassa/cotacoes/sub-abas-categorias.tsx
  - components/amassa/cotacoes/cartao-cotacao.tsx
  - components/amassa/cotacoes/linha-cotacao.tsx
  - components/amassa/cotacoes/comparacao-cotacoes.tsx
  - components/amassa/cotacoes/detalhe-cotacao.tsx
  - components/amassa/queimas/cartao-forno.tsx
  - components/amassa/abertura/lista-meses.tsx
  - tests/e2e/apoio/semear-conta-fixa.ts
  - tests/e2e/acessibilidade.spec.ts

estimate:
  tokens: 60000
  raw_tokens: 30000
  tasks: 4
  confidence: low

must_haves:
  truths:
    - "O span de metadado de uma conta fixa DESATIVADA (\"todo dia N · categoria\") mede pelo menos 4.5:1 de contraste sobre --color-fundo, medido por axe-core, com a linha de verdade em cena (não um estado vazio)."
    - "tests/e2e/acessibilidade.spec.ts foi visto FALHAR (RED, 2.99:1) com o código antes da correção e PASSAR (GREEN) depois, para a rota /cadastros?sub=fixas — não uma asserção escrita depois do fato e nunca vista falhar."
    - "Todo outro lugar do repositório com o mesmo padrão (opacity-NN condicional sobre um elemento que carrega texto em text-muted-foreground ou --color-tinta) foi encontrado por grep e corrigido ou justificado por escrito — nenhum ficou por falta de busca."
    - "npm run verificar (lint, tsc --noEmit, verificar-acoes, testes unitários, test:migracoes) passa limpo."
  artifacts:
    - tests/e2e/apoio/semear-conta-fixa.ts (novo — cria/apaga uma conta fixa inativa direto no banco de teste)
  key_links:
    - "lista-contas-fixas.tsx não tem mais `opacity-70` condicional na linha — o nome riscado (line-through) e o rótulo \"Reativar\" continuam comunicando \"desativada\" sem depender de composição alfa"
    - "cartao-forno.tsx e lista-meses.tsx trocam opacity-NN por bg-muted (cor sólida) — não removem a pista visual de \"esmaecido\", só tiram o texto da composição alfa que derrubava o contraste"
---

<objective>
CI run https://github.com/adcaponte/amassa/actions/runs/35508463753 reprovou "E2E contra a imagem
real" — `tests/e2e/acessibilidade.spec.ts:219`, rota `/cadastros?sub=fixas`, projeto `celular`,
determinístico nas 3 tentativas. GHCR publish e o deploy no VPS foram pulados: o código da fase
04.4-12 não está em produção.

O achado do axe: `<span class="text-apoio text-muted-foreground break-words">todo dia 10 ·
Contabilidade</span>` mede 2,99:1 (esperado 4,5:1) — foreground `#978b84`, fundo `#f6f3f0`. O
defeito está em código desde o plano `04.4-10`; nunca apareceu antes porque a lista de contas
fixas estava sempre vazia nas varreduras anteriores (produção só semeia categorias) até um teste
do plano `04.4-12` deixar, sem querer, uma conta fixa DESATIVADA no banco de teste compartilhado.

Purpose: entender a causa raiz de verdade (não só trocar a cor até o número bater), corrigir onde
ela aparece — e ela aparece em mais lugares do que o CI pegou, porque o padrão é estrutural, não
um valor de cor errado.

Output: o span de metadado (e todo equivalente do mesmo padrão) passa em 4.5:1 com a linha
desativada/descartada/passada de verdade em cena, provado por axe antes e depois; `npm run
verificar` verde; nada pushado.
</objective>

<execution_context>
@C:/Users/Andre/amassa/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/Andre/amassa/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.claude/CLAUDE.md
@.planning/STATE.md
@app/globals.css (tokens de cor — §"texto": --color-tinta/-media/-fraca)
@amassa-plataforma/04-DESIGN-SYSTEM.md (contraste conferido dos tokens de texto)
@components/amassa/cadastros/lista-contas-fixas.tsx (o componente do achado reportado)
@tests/e2e/acessibilidade.spec.ts (a varredura de contraste, REGRAS_AUDITADAS/ROTAS_DA_FASE)
@.planning/phases/04.4-financeiro-parte-1/04.4-UI-SPEC.md
@.planning/phases/04.4-financeiro-parte-1/04.4-12-SUMMARY.md
</context>

<descoberta_de_projeto>
**Causa raiz real, não superficial.** `--color-tinta-fraca` (#6E5F56, mapeado em
`--color-muted-foreground`) já é o token de texto secundário mais escuro disponível e passa
5.4:1 — acima do piso de 4.5:1 — quando renderizado em opacidade cheia. O defeito não é o TOKEN:
é que `lista-contas-fixas.tsx` aplica `opacity-70` na `<li>` INTEIRA quando `!conta.ativa`, e CSS
`opacity` cria um novo contexto de empilhamento — todo o subtree é composto num buffer e SÓ
DEPOIS tem o alfa aplicado, então nenhum filho consegue "desfazer" a diluição com `opacity-100`
próprio. Compondo `#6E5F56` a 70% sobre `#F6F3F0` dá exatamente `#978b84` — bate byte a byte com o
que o axe mediu.

**A matemática não perdoa um ajuste de opacidade.** Testado analiticamente (blend alfa em espaço
sRGB, a mesma fórmula que o navegador usa e que bateu com o valor medido pelo axe): mesmo
diluindo `--color-tinta` CHEIO — o token mais escuro do sistema, 14.6:1 sem diluir — a 60% de
opacidade o contraste cai para ~4.15:1 (ainda reprova 4.5:1); a 70% sobe para ~5.67:1 (passa,
por pouco); só a partir de ~92% de opacidade o texto secundário (`tinta-fraca`) volta a passar,
o que visualmente já não lê como "esmaecido". Não existe um valor de opacidade que preserve o
efeito visual pretendido (linha nitidamente mais apagada) e ainda passe AA para o texto
secundário — a técnica em si é a causa raiz, não um valor mal escolhido.

**Blast radius encontrado por grep** (`grep -rn "text-muted-foreground" components/ app/` cruzado
com todo `opacity-NN` condicional a um estado "inativo/descartado/passado"): o mesmo padrão
aparece em MAIS SEIS lugares, nenhum pego pela varredura de acessibilidade porque nenhuma rota
testada tem hoje uma linha nesse estado em cena:

| Arquivo | Estado | Opacidade | Mesmo achado? |
|---|---|---|---|
| `lista-contas-fixas.tsx` | conta fixa desativada | `opacity-70` | Sim — o achado reportado |
| `lista-categorias.tsx` | categoria desativada | `opacity-70` | Sim — padrão idêntico |
| `sub-abas-categorias.tsx` | contagem da pílula inativa | `opacity-70` | Sim — mesma diluição, incondicional |
| `cartao-cotacao.tsx` | cotação descartada | `opacity-60` | Sim — pior ainda (60% reprova até o token mais escuro) |
| `linha-cotacao.tsx` | cotação descartada | `opacity-60` | Sim — mesmo caso, forma de tabela |
| `comparacao-cotacoes.tsx` | cotação descartada | `opacity-60` | Sim — coluna de comparação |
| `detalhe-cotacao.tsx` | cotação descartada | `opacity-60` | Sim — diálogo de detalhe |
| `cartao-forno.tsx` | forno desativado | `opacity-75` | Sim — `04-04-SUMMARY.md` já registrava a alegação de contraste como NUNCA MEDIDA |
| `lista-meses.tsx` (Abertura) | mês passado | `opacity-60` | Sim — mesmo cálculo |

**Deixados de fora, por serem outro caso genuíno** (grep também encontrou, mas não são o mesmo
padrão): `caixa-marcacao.tsx`, `valor-conta-fixa.tsx`, `financeiro/lista-completa.tsx` usam
`disabled:opacity-NN` sobre CONTROLES INTERATIVOS desabilitados (`<button disabled>`/`<input
disabled>`) — WCAG 1.4.3 e o próprio axe-core tratam controle desabilitado como fora do escopo do
contraste de texto (não é operável); nenhum dos três é "texto secundário estático diluído", é
"controle temporariamente indisponível". Deixados como estão.

**Correção escolhida, por caso:**
- Onde já existe outra pista textual clara de "estado alterado" (nome riscado + rótulo
  "Reativar"/"Desativar" mudando, ou o SELO de situação com texto próprio "descartado"):
  `opacity-NN` removida sem substituto. A informação não se perde — só o reforço visual
  redundante.
- Onde a opacidade recai sobre um CONTAINER com fundo próprio (`cartao-forno.tsx`,
  `lista-meses.tsx`, a coluna de `comparacao-cotacoes.tsx`) e perder o "esmaecido" seria uma
  regressão visual maior: troca de `bg-card` (branco) por `bg-muted` (`--color-superficie-2`,
  cor SÓLIDA e mais escura) — nenhuma composição alfa envolvida, o texto nunca perde contraste
  (na verdade melhora, porque o fundo ficou mais escuro), e o elemento ainda lê como "menos em
  destaque".

Nenhum token de cor foi criado ou teve o valor alterado — só a técnica de aplicar o estado
"esmaecido" mudou, de opacidade composta (que arrasta o texto junto) para cor sólida ou remoção
pura e simples da diluição.
</descoberta_de_projeto>

<orcamento_de_e2e>
Regra do CLAUDE.md §Conventions: no máximo UMA invocação de `npm run test:e2e -- --grep` por
tarefa, sempre com `--grep`; a suíte completa sem `--grep` roda uma vez por fase, no último plano.
Este quick task é uma exceção justificada em dois pontos, ambos registrados no SUMMARY:
1. O par RED/GREEN da Tarefa 1 é a exceção explícita de diagnóstico (before/after).
2. Como o mesmo achado foi corrigido em NOVE arquivos ao todo (Tarefa 2), uma terceira invocação
   — a varredura completa de `tests/e2e/acessibilidade.spec.ts` (todas as rotas, sem `--grep` de
   rota específica) — roda UMA vez ao final da Tarefa 2 para confirmar que nenhuma das outras oito
   correções introduziu uma regressão de `button-name`/`link-name`/`aria-allowed-attr` nas rotas
   já cobertas, já que a maioria dos seis arquivos de cotações/queimas/abertura não tem hoje uma
   rota de varredura com o estado "descartado"/"desativado"/"passado" em cena para provar
   individualmente.
</orcamento_de_e2e>

<tasks>

<task type="auto" number="1">
<description>Corrigir o achado reportado (lista-contas-fixas.tsx) com prova RED/GREEN via axe-core</description>
<files>components/amassa/cadastros/lista-contas-fixas.tsx, tests/e2e/apoio/semear-conta-fixa.ts, tests/e2e/acessibilidade.spec.ts</files>
<verify>npm run test:e2e -- --grep "cadastros\?sub=fixas não tem violação" (RED antes da correção, GREEN depois)</verify>
<done>lista-contas-fixas.tsx não tem mais `opacity-70` condicional na `<li>`; tests/e2e/acessibilidade.spec.ts semeia uma conta fixa inativa direto no banco (tests/e2e/apoio/semear-conta-fixa.ts, novo) antes de varrer /cadastros?sub=fixas e apaga no finally; o par RED/GREEN foi visto rodar de verdade.</done>
</task>

<task type="auto" number="2">
<description>Corrigir o mesmo padrão nos outros oito lugares encontrados pelo grep (blast radius)</description>
<files>components/amassa/cadastros/lista-categorias.tsx, components/amassa/cotacoes/sub-abas-categorias.tsx, components/amassa/cotacoes/cartao-cotacao.tsx, components/amassa/cotacoes/linha-cotacao.tsx, components/amassa/cotacoes/comparacao-cotacoes.tsx, components/amassa/cotacoes/detalhe-cotacao.tsx, components/amassa/queimas/cartao-forno.tsx, components/amassa/abertura/lista-meses.tsx</files>
<verify>npx tsc --noEmit && npm run lint && npm run test:e2e -- --grep "acessibilidade" (varredura completa, sem regressão)</verify>
<done>Nenhum dos nove arquivos mantém `opacity-NN` condicional sobre um elemento carregando `text-muted-foreground`/`--color-tinta`; onde a pista visual "esmaecido" fazia sentido preservar, o container troca para `bg-muted` (cor sólida); os três usos de `disabled:opacity-NN` sobre controle interativo (caixa-marcacao.tsx, valor-conta-fixa.tsx, financeiro/lista-completa.tsx) ficam intactos, por serem outro caso.</done>
</task>

<task type="auto" number="3">
<description>Verificação completa e commit dos artefatos de planejamento</description>
<files>.planning/quick/260920-wcg-contraste-aa-conta-fixa-desativada/260920-wcg-PLAN.md, .planning/quick/260920-wcg-contraste-aa-conta-fixa-desativada/260920-wcg-SUMMARY.md, .planning/STATE.md</files>
<verify>npm run verificar</verify>
<done>lint, tsc --noEmit, verificar-acoes, testes unitários e test:migracoes passam limpo; SUMMARY.md e STATE.md registram os achados, os comandos rodados e a decisão de não pushar.</done>
</task>

</tasks>

<verification>
`npm run verificar` verde. `grep -rn "opacity-6[0-9]\|opacity-70\|opacity-75" components/ app/
--include="*.tsx"` só encontra os três usos de `disabled:opacity-NN` sobre controle interativo
(documentados como caso diferente) e comentários explicando a correção — nenhum uso residual do
padrão corrigido. O caso `/cadastros?sub=fixas` de `tests/e2e/acessibilidade.spec.ts` foi visto
falhar antes da correção e passar depois.
</verification>

---
quick_id: 260926-ijl
description: O toast (sonner) não tem fundo — pinta transparente sobre os cartões do Caixa, ilegível
mode: quick
phase: quick-260926-ijl
plan: 1
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: []
files_modified:
  - components/ui/sonner.tsx
  - tests/e2e/financeiro-caixa.spec.ts
estimate:
  tokens: 25000
  raw_tokens: 12000
  tasks: 3
  confidence: high

must_haves:
  truths:
    - "O aviso ([data-sonner-toast]) pinta background-color opaco (rgb(255, 255, 255), o mesmo branco de --color-superficie/--color-popover), nunca transparente, sobre qualquer cartão atrás dele."
    - "A asserção nova em tests/e2e/financeiro-caixa.spec.ts foi vista FALHAR (RED) com o código não corrigido e PASSAR (GREEN) depois — não escrita depois do fato."
    - "components/ui/sonner.tsx não referencia mais nenhuma variável CSS inexistente (--popover, --popover-foreground, --border, --radius sem prefixo --color-/--radius-)."
    - "A classe cn-toast morta (sem regra em nenhum CSS do repositório) foi removida ou definida, com o motivo escrito no SUMMARY."
    - "tests/e2e/queimas-registro.spec.ts ('Desfazer' remove a queima) continua passando — o mesmo Toaster único serve os dois módulos."
    - "npm run verificar passa limpo."
  artifacts: []
  key_links:
    - "components/ui/sonner.tsx mapeia --normal-bg/--normal-text/--normal-border/--border-radius para os tokens REAIS do projeto (--color-popover, --color-popover-foreground, --color-border, --radius-xl), nunca para nomes inventados"
---

<objective>
O dono fotografou o defeito no celular: o aviso (toast) com "Pago: R$ 1.200,00 / Desfazer" se
desenha por cima do cartão "Energia · outubro/2026 R$ 500,00" SEM NENHUM FUNDO — as duas ficam
ilegíveis, sobrepostas. Causa raiz já localizada: `components/ui/sonner.tsx` (arquivo padrão do
shadcn, nunca adaptado a este projeto) define `--normal-bg: var(--popover)`,
`--normal-text: var(--popover-foreground)`, `--normal-border: var(--border)`,
`--border-radius: var(--radius)` — nenhuma dessas quatro variáveis existe neste repositório.
`app/globals.css` usa o namespace `--color-*` do Tailwind v4 (`--color-popover`,
`--color-popover-foreground`, `--color-border`) e o namespace de raio é `--radius-sm/md/lg/xl`
(sem `--radius` puro). Um `var()` apontando para um nome inexistente, sem fallback, resolve para
nada — o CSS do próprio sonner (`node_modules/sonner/dist/styles.css`) então pinta
`background: var(--normal-bg)` como transparente.

Este defeito é PRÉ-EXISTENTE, não introduzido agora: o `<Toaster>` está montado desde a fase 02b
(`git log` confirma `components/ui/sonner.tsx` nunca foi tocado depois da instalação inicial do
shadcn) — só ficou óbvio agora porque o plano 04.4-13 moveu o aviso para cima da barra inferior,
diretamente sobre os cartões do Caixa, onde a transparência vira visível.

Purpose: mapear as quatro variáveis para os tokens que REALMENTE existem (nunca inventar um novo),
resolver a classe `cn-toast` morta, e escrever o teste que teria pego isso — uma asserção de estilo
computado, não só de geometria — provado RED antes / GREEN depois.

Output: aviso com fundo opaco e legível sobre qualquer cartão; teste de regressão visto falhar e
passar; `npm run verificar` verde; nada pushado.
</objective>

<execution_context>
@C:/Users/Andre/amassa/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/Andre/amassa/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.claude/CLAUDE.md
@.planning/STATE.md
@components/ui/sonner.tsx (o arquivo com o defeito)
@app/globals.css (tokens reais: --color-popover/-popover-foreground/-border, --radius-xl)
@app/(app)/layout.tsx (ponto de montagem único do Toaster — serve Financeiro, Queimas, Abertura, Cotações, Cadastros)
@tests/e2e/financeiro-caixa.spec.ts (o teste de geometria do plano 04.4-13, Tarefa 1, que só provou posição, não cor)
@tests/e2e/queimas-registro.spec.ts (o Desfazer de queima, mesmo Toaster — não pode regredir)
@amassa-plataforma/04-DESIGN-SYSTEM.md §7 (regras de toast)
@.planning/phases/04.4-financeiro-parte-1/04.4-UI-SPEC.md (aditivo do plano 04.4-13 sobre o toast)
</context>

<descoberta_de_projeto>
**Mapeamento correto, verificado token a token em `app/globals.css`:**

| Variável do sonner.tsx (quebrada) | Aponta para (inexistente) | Corrigida para | Valor real |
|---|---|---|---|
| `--normal-bg` | `var(--popover)` | `var(--color-popover)` | `--color-superficie` = `#FFFFFF` |
| `--normal-text` | `var(--popover-foreground)` | `var(--color-popover-foreground)` | `--color-tinta` = `#1D2221` |
| `--normal-border` | `var(--border)` | `var(--color-border)` | `--color-borda` = `#E8E2DC` |
| `--border-radius` | `var(--radius)` | `var(--radius-xl)` | `18px` (mesmo raio de Card/Dialog, `rounded-xl`) |

Nenhum token novo, nenhum valor inventado — os quatro já existem em `app/globals.css` (bloco
`@theme inline`, linhas 163-176, e `@theme`, linha 85) e já são consumidos por `dialog.tsx`,
`dropdown-menu.tsx` e `select.tsx` com o MESMO padrão (`bg-popover text-popover-foreground`).

**Shadow: não precisa de nada novo.** `node_modules/sonner/dist/styles.css` já aplica
`box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.1)` embutido no próprio `[data-sonner-toast][data-styled='true']`
— a mesma regra que desenha o `border: 1px solid var(--normal-border)`. Uma vez que
`--normal-border` aponte para um token real, o toast já sai com borda E sombra, igual a
`dialog.tsx`/`dropdown-menu.tsx` (que usam `ring-1 ring-foreground/10` + `shadow-md`/`shadow-lg`
— reforço equivalente, não idêntico, mas o próprio sonner já resolve isso sozinho). Nenhuma classe
nova é necessária.

**`cn-toast`: classe morta, será REMOVIDA.** `grep -rn "cn-toast" --include="*.css" --include="*.tsx"`
não encontra nenhuma regra `.cn-toast` em lugar nenhum do repositório (nem em `app/globals.css`,
nem em nenhum módulo CSS) — é um hook de estilização que nunca foi definido, presumivelmente
copiado do boilerplate de um projeto-modelo do shadcn que tinha essa classe em algum lugar. Como
não estiliza nada hoje e este projeto não usa CSS Modules para este componente, a decisão é
REMOVER a chave `classNames.toast` inteira do `toastOptions`, em vez de inventar uma regra CSS só
para justificar sua existência — menos código morto, e o `className="toaster group"` já presente
no componente `<Sonner>` continua disponível para qualquer seletor `.group` futuro (nenhum uso
atual).

**Blast radius: um único ponto de montagem.** `app/(app)/layout.tsx` é o ÚNICO `<Toaster>` do
sistema (confirmado por `grep -rn "<Toaster"`) — corrigir `sonner.tsx` conserta TODOS os
`toast()` do projeto de uma vez: Financeiro (Caixa, Venda, Despesa), Queimas (registro e
Desfazer), Abertura, Cotações, Cadastros. Nenhum outro arquivo precisa mudar.

**Pré-existência confirmada por `git log -p -- components/ui/sonner.tsx`:** o arquivo tem um único
commit desde a instalação do shadcn (fase 02b) — nunca foi tocado depois. O toast SEMPRE foi
transparente; só ficou visível sobre um cartão quando o 04.4-13 subiu o aviso acima da barra
inferior no celular, posicionando-o diretamente sobre os cartões do Caixa.
</descoberta_de_projeto>

<orcamento_de_e2e>
Regra do CLAUDE.md §Conventions: no máximo UMA invocação de `npm run test:e2e -- --grep` por
tarefa. Este quick task usa a exceção explícita de diagnóstico (par RED/GREEN) na Tarefa 1, e mais
uma invocação isolada na Tarefa 2 para confirmar que o Desfazer de queima não regrediu — ambas
registradas no SUMMARY com o resultado de cada rodada.
</orcamento_de_e2e>

<tasks>

<task type="auto" number="1">
<description>Escrever a asserção de fundo opaco (RED), corrigir sonner.tsx (GREEN), resolver cn-toast</description>
<files>tests/e2e/financeiro-caixa.spec.ts, components/ui/sonner.tsx</files>
<verify>npm run test:e2e -- --grep "fica inteiro acima da barra" (RED antes da correção de sonner.tsx, GREEN depois)</verify>
<done>tests/e2e/financeiro-caixa.spec.ts afirma que getComputedStyle(aviso).backgroundColor não é transparente e é exatamente rgb(255, 255, 255) (branco de --color-superficie/--color-popover); components/ui/sonner.tsx mapeia --normal-bg/--normal-text/--normal-border/--border-radius para --color-popover/--color-popover-foreground/--color-border/--radius-xl; a chave classNames.toast: "cn-toast" foi removida (classe morta, sem regra em nenhum CSS do repositório); o par RED/GREEN foi visto rodar de verdade, ambos os resultados registrados no SUMMARY.</done>
</task>

<task type="auto" number="2">
<description>Confirmar que o Desfazer de queima (outro consumidor do mesmo Toaster) não regrediu</description>
<files>tests/e2e/queimas-registro.spec.ts</files>
<verify>npm run test:e2e -- --grep "'Desfazer' remove a queima"</verify>
<done>O teste de Desfazer de queima passa sem alteração de código — prova de que a correção do Toaster único não quebrou nenhum outro consumidor.</done>
</task>

<task type="auto" number="3">
<description>Verificação completa e commit dos artefatos de planejamento</description>
<files>.planning/quick/260926-ijl-toast-do-sonner-sem-fundo-transparente-s/260926-ijl-PLAN.md, .planning/quick/260926-ijl-toast-do-sonner-sem-fundo-transparente-s/260926-ijl-SUMMARY.md, .planning/STATE.md</files>
<verify>npm run verificar</verify>
<done>lint, tsc --noEmit, verificar-acoes, testes unitários e test:migracoes passam limpo; SUMMARY.md e STATE.md registram os achados, os comandos rodados (incluindo o par RED/GREEN) e a decisão de não pushar.</done>
</task>

</tasks>

<verification>
`npm run verificar` verde. `grep -n "popover\|border\|radius" components/ui/sonner.tsx` só mostra
nomes com o prefixo real (`--color-popover`, `--color-border`, `--radius-xl`) — nenhuma variável
sem `--color-`/`--radius-`. `grep -rn "cn-toast" --include="*.tsx" --include="*.css" .` não
encontra nada (removida por completo). O par RED/GREEN de
`tests/e2e/financeiro-caixa.spec.ts` e a rodada isolada de
`tests/e2e/queimas-registro.spec.ts` foram vistos rodar, ambos registrados no SUMMARY.
</verification>
</output>

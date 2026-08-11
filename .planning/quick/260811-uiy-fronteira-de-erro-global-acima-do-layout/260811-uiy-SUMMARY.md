---
phase: quick
plan: 260811-uiy
subsystem: fronteiras-de-erro
tags: [error-boundary, app-router, next-js, acessibilidade, windows-ledger]
dependency-graph:
  requires: []
  provides:
    - "lib/erro/textos.ts — voz única de erro (título, corpo genérico, rótulo do botão)"
    - "app/error.tsx — fronteira acima de app/(app)/layout.tsx, corrige G-04-5"
    - "app/global-error.tsx — último recurso acima do layout raiz"
  affects:
    - "app/(app)/error.tsx — passou a consumir lib/erro/textos.ts, ganhou alvo de toque 44px"
    - ".planning/WINDOWS.md — id 23 fechado, ledger reconciliado"
    - ".planning/phases/04-contador-de-queima/04-UAT.md — gap G-04-5 resolved"
tech-stack:
  added: []
  patterns:
    - "Módulo puro de texto (zero import) reaproveitando a disciplina de lib/encomendas/textos.ts e lib/acessibilidade/rotulos.ts"
key-files:
  created:
    - lib/erro/textos.ts
    - tests/unit/textos-erro.test.ts
    - app/error.tsx
    - app/global-error.tsx
  modified:
    - "app/(app)/error.tsx"
    - .planning/WINDOWS.md
    - .planning/phases/04-contador-de-queima/04-UAT.md
decisions:
  - "app/error.tsx E app/global-error.tsx — os dois, com papéis distintos (correção real vs. último recurso), não apenas um dos dois. Ver <decisao_de_fronteira> do PLAN.md para o raciocínio completo."
  - "Prova comportamental automatizada (Postgres local parado + login real via Chromium) não pôde rodar nesta sessão — E2E_EMAIL_TESTE/E2E_SENHA_TESTE não estão definidos em .env.local para uso fora do pipeline de teste do Playwright (só existem dentro do globalSetup, contra o banco de teste efêmero). Escalada honestamente ao roteiro manual do dono em vez de fabricar prova ou mutar o banco de dev local com uma conta throwaway não autorizada pelo plano."
metrics:
  duration: "~1h"
  completed: 2026-08-11
actuals:
  tokens: 4800
  tasks: 3
  commits: 3
status: complete
---

# Quick Task 260811-uiy: Fronteira de erro global acima do layout Summary

Criadas as duas fronteiras de erro que faltavam ACIMA de `app/(app)/layout.tsx` — `app/error.tsx`
(a correção real de G-04-5) e `app/global-error.tsx` (último recurso) — consumindo uma voz única
de erro em `lib/erro/textos.ts`, com teste anti-deriva contra `lib/encomendas/textos.ts`.

## O que foi feito

**Tarefa 1 — `lib/erro/textos.ts` e teste anti-deriva.** Módulo puro (zero import) com
`FRASE_ERRO_TITULO`, `FRASE_ERRO_CORPO_GENERICO` e `ROTULO_TENTAR_DE_NOVO` — as três frases já
existiam como literais espalhados (`lib/encomendas/textos.ts` e `app/(app)/error.tsx`), nenhuma
frase nova foi inventada. `tests/unit/textos-erro.test.ts` falha se `FRASE_ERRO_TITULO` divergir
do homônimo de `lib/encomendas/textos.ts` (aquele módulo só aceita `import type`, então não pode
importar daqui — o teste é quem impede a divergência, não o compilador). `app/(app)/error.tsx`
passou a consumir as constantes e seu botão ganhou `min-h-[44px]` (estava em `h-8`/32px, abaixo
do alvo mínimo de toque do `CLAUDE.md`).

**Tarefa 2 — as duas fronteiras.** `app/error.tsx`: a fronteira mais próxima ACIMA de
`app/(app)/layout.tsx` — `app/(app)/` é grupo de rotas sem segmento de URL próprio, então esse
layout renderiza como filho direto do layout raiz, e é `app/error.tsx` (não
`app/(app)/error.tsx`, que é irmão do layout que falha) quem captura o `throw` de
`exigirUsuario()`. Renderiza dentro do layout raiz (fonte e `globals.css` continuam valendo),
funciona em `next dev` e produção, fica fora do grupo protegido (nunca renderiza dado de sessão).
`app/global-error.tsx`: último recurso — substitui o layout raiz inteiro (`<html>`/`<body>`
próprios, importa `globals.css` na primeira linha), cobre o caso em que `app/error.tsx` falha ao
renderizar (uma fronteira nunca captura o próprio erro). Nenhuma propriedade do objeto `error`
(mensagem, pilha, `digest`) é renderizada em nenhum dos dois — só `console.error` em `useEffect`.

**Tarefa 3 — prova e rastro de papel.**

- `npm run test:e2e -- --grep "UI-07"` — 34/34 passou (única invocação do orçamento do plano,
  cobrindo `tests/e2e/estados.spec.ts`, vizinho direto de `app/not-found.tsx`).
- `npm run verificar` — passou inteiro (lint, `tsc --noEmit`, `verificar-acoes`, 408 testes
  unitários, `test:migracoes`).
- `.planning/WINDOWS.md` estava inconsistente (defeito conhecido de antes deste plano): a linha
  23 da tabela markdown existia, mas o bloco JSON terminava em 22 e o frontmatter contava 22.
  Reconciliado à mão nas três partes: tabela (`status: open` → `fixed`, `resolved_at`
  preenchido), JSON (entrada 23 acrescentada espelhando a tabela), frontmatter (`total_count`
  22→23, `fixed_count` 6→7, `open_count` mantido em 16). `node .claude/gsd-core/bin/gsd-tools.cjs
  windows status` confirma `total_count: 23, fixed_count: 7, open_count: 16` com o id 23 em
  `fixed`.
- `.planning/phases/04-contador-de-queima/04-UAT.md`: gap `G-04-5` de `status: failed` para
  `status: resolved`, com `resolvido_em` apontando para este plano.  `root_cause`, `escopo`,
  `decisao_do_dono` e `nota_de_metodo` preservados intactos (histórico de diagnóstico). Os dois
  itens de `missing` marcados como respondidos em vez de deixados em aberto por omissão.
  **Nota de isolamento:** este arquivo tinha uma sessão de verificação humana concorrente em
  andamento (teste 18, "Backstop E3", `awaiting: user response`, `status: testing` no
  frontmatter) — uncommitted, de fora deste plano. A edição do gap G-04-5 foi aplicada como um
  patch isolado (só as linhas do bloco `gap_id: G-04-5`), commitada sozinha, e a sessão
  concorrente foi restaurada intacta e ainda não commitada no arquivo de trabalho — nada da
  verificação humana em curso foi perdido ou sobrescrito.

## Limite honesto de verificação (obrigatório declarar)

**`app/global-error.tsx` tem prova ESTRUTURAL, não comportamental**, exatamente como o PLAN.md
previu: o Next.js não usa este arquivo em `next dev` (a sobreposição de erro do modo de
desenvolvimento toma o lugar dele), então ele não é observável localmente. A prova aqui é: o
arquivo existe, passa lint e `tsc --noEmit`, renderiza `<html lang="pt-BR">` e importa
`./globals.css` como primeira linha de importação — confirmado pelos três `grep` estruturais do
`<verify>` da Tarefa 2, não por uma tela vista de verdade.

**A prova comportamental de `app/error.tsx` (o que este plano existe para consertar) NÃO foi
executada por observação real nesta sessão.** O plano previa um script Playwright descartável
logando com `E2E_EMAIL_TESTE`/`E2E_SENHA_TESTE` contra o servidor de desenvolvimento local
(`npm run dev` + Postgres de `docker/compose.dev.yml`). Ao rodar o script (no diretório de
rascunho da sessão, nunca no repositório — já removido), essas duas variáveis não estavam
definidas em `.env.local`: elas só existem dentro do `globalSetup` do Playwright
(`tests/e2e/apoio/preparar-usuario.ts`), escopadas ao banco de teste efêmero, não para uso
autônomo contra o ambiente de desenvolvimento local. Não tentei contornar isso criando uma conta
de teste avulsa no banco de desenvolvimento local — o plano não autorizou esse efeito colateral
persistente (o `desativar-usuario` existente não apaga, só marca `ativo = false`, deixando uma
5ª conta permanente onde hoje há 4), e o próprio `<verify>` da Tarefa 3 já previa esta saída:
*"Se a prova falhar por motivo de ambiente ..., NÃO declarar sucesso: registrar o motivo e
escalar o roteiro manual do `<human-check>`."* É exatamente o que este SUMMARY faz.

**A correção em si está sustentada por evidência estrutural forte, não por suposição cega:**
`app/error.tsx` reaproveita literalmente o mesmo componente (`EstadoErro`) e o mesmo padrão
(`"use client"`, `useEffect` + `console.error`, `reset()`) que `app/(app)/error.tsx` — e aquele
padrão JÁ foi provado funcionando por execução real no UAT da Fase 4 (teste 5, segunda metade, e
teste 13, método cirúrgico). `lint`, `tsc --noEmit` e os `grep`s estruturais confirmam que o
arquivo novo está sintaticamente correto e no lugar certo da árvore do App Router. O que falta é
só a última milha: ver a tela de verdade com o banco derrubado.

### Roteiro manual para o dono (escalado, idêntico ao `<human-check>` do PLAN.md)

1. `docker compose -f docker/compose.yml -f docker/compose.dev.yml up -d postgres` (já está
   rodando) e `npm run dev`.
2. Entrar no sistema normalmente pelo navegador (`theo@amassa.local`).
3. `docker compose -f docker/compose.yml -f docker/compose.dev.yml stop postgres`.
4. Recarregar qualquer rota autenticada (`/`, `/encomendas`, `/queimas`).
5. Confirmar: aparece a tela do AMASSA com "Algo não funcionou." e o botão "Tentar de novo"
   (alvo de toque de 44px), e NÃO a tela em inglês do Next.js com o número de digest.
6. `docker compose -f docker/compose.yml -f docker/compose.dev.yml start postgres` e recarregar
   — o sistema volta ao normal.

Os dados vivem no volume nomeado `docker_dados_postgres` e sobrevivem ao `stop`.

## Comandos de e2e efetivamente invocados

- `npm run test:e2e -- --grep "UI-07"` — uma única invocação, o orçamento inteiro do plano.
- Nenhum `npm run build` separado.

## Deviations from Plan

### Auto-fixed Issues

None além do escopo já previsto pelo próprio PLAN.md (a prova comportamental automatizada e o
escalonamento manual já estavam contemplados como caminho alternativo no `<verify>` da Tarefa 3).

### Desvio documentado — prova comportamental não executada por observação real

Ver seção "Limite honesto de verificação" acima. Não é um Rule 1/2/3 (bug ou funcionalidade
faltando) nem Rule 4 (mudança arquitetural) — é uma lacuna de ambiente local (variáveis de teste
não disponíveis fora do pipeline do Playwright) que o próprio plano já havia antecipado e para a
qual já definiu o caminho de escalonamento.

## Known Stubs

Nenhum stub introduzido. Os dois arquivos novos e o módulo de texto são implementações completas,
não placeholders.

## Threat Flags

Nenhum. O `<threat_model>` do PLAN.md (T-uiy-01, T-uiy-02, T-uiy-03, T-uiy-SC) já cobre a
superfície nova (`app/error.tsx`, `app/global-error.tsx`) e foi seguido à risca: nenhuma
propriedade do objeto `error` é renderizada, os dois arquivos ficam fora do grupo protegido, e
nenhum pacote novo foi instalado.

## Self-Check: PASSED

Todos os 7 artefatos declarados (`lib/erro/textos.ts`, `tests/unit/textos-erro.test.ts`,
`app/(app)/error.tsx`, `app/error.tsx`, `app/global-error.tsx`, `.planning/WINDOWS.md`,
`.planning/phases/04-contador-de-queima/04-UAT.md`) confirmados presentes no disco. Os três
commits (`d0b8ccb`, `6716962`, `b5bf62b`) confirmados em `git log --oneline --all`.

---

## Adendo — prova comportamental EXECUTADA (2026-08-11, pelo orquestrador com o dono)

O roteiro manual escalado acima **foi percorrido** logo depois desta execução, e passou. Registro
do que foi feito, para o item deixar de constar como pendente:

1. `next dev` no ar em localhost:3000, Postgres local de pé.
2. O dono entrou com `theo@amassa.local` e confirmou a sessão viva em `/queimas`.
3. `docker compose -f docker/compose.yml -f docker/compose.dev.yml stop postgres` — banco no chão,
   sessão do dono já estabelecida (a ORDEM importa: parar o banco antes do login torna o login
   impossível, porque a checagem de credenciais também consulta `usuarios`).
4. Recarga de `/queimas`: apareceu a tela do projeto — "Algo não funcionou.", o corpo dizendo o que
   fazer, e o botão "Tentar de novo", na tipografia e nas cores do AMASSA.
5. Banco religado; 4 usuários, 2 fornos, 0 queimas intactos.

**`app/error.tsx` está provado por observação**, não só por revisão de código. É a correção real de
G-04-5: antes deste arquivo, o mesmo cenário produzia "Application error: a server-side exception
has occurred / Digest: 743233016" (medido no teste 5 do UAT da Fase 4).

**`app/global-error.tsx` continua com prova apenas estrutural** — ele não é observável sob
`next dev`, por desenho do Next.js. Isso não mudou e não está sendo apresentado como verificado.

**Achado de passagem, não corrigido:** com o banco fora do ar, a tela de login responde "Confira o
e-mail e a senha e tente de novo". A mensagem anti-enumeração está funcionando como projetada — ela
não distingue e-mail inexistente de senha errada —, mas também não distingue indisponibilidade de
banco, e manda o gestor conferir uma senha que está certa. Mesma família do G-04-5 (falha de
infraestrutura vestida de erro do usuário). Registrado aqui para decisão posterior; mexer nisso
exige cuidado para não transformar a tela em oráculo de contas.

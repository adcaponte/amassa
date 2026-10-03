---
status: complete
quick_id: 261003-fot
date: 2026-10-03
---

# Quick 261003-fot — foto de orçamento de 10 a 15 MB chegava cortada

**Origem:** achado colateral da pesquisa da Fase 06.2 (Fornecedores), `06.2-RESEARCH.md` Achado 1 e
`06.2-CONTEXT.md` D-10 [deferred] — "foto de 10–15 MB truncada pelo mesmo mecanismo", a confirmar
por execução. Pedido do Theo no chat em 03/10/2026: "Confirm and fix quote-photo upload truncation".

## Confirmado por execução

- O `middleware.ts` roda em toda requisição sob `/gestao`, inclusive no POST da Server Action
  `anexarFotoDeOrcamento`. Para isso o Next 16.3.5 clona o corpo com `getCloneableBody`
  (`node_modules/next/dist/server/body-streams.js`), cujo teto padrão é
  `DEFAULT_BODY_CLONE_SIZE_LIMIT = 10 MB` (`experimental.proxyClientMaxBodySize` não estava no
  `next.config.ts`). Passou do teto: um `console.warn` e **o resto do corpo é descartado, sem erro**.
- **Medido** rodando o próprio `getCloneableBody` do projeto com um corpo de 12 MB: enviado
  12.582.912 bytes; o middleware viu 10.485.760; **a requisição que segue para a Server Action
  também ficou com 10.485.760** (o `finalize` substitui o corpo original pelo clone cortado).
- O navegador não reduz a foto antes de enviar (`fotos-de-referencia.tsx` manda o `File` cru), e o
  D-26 aceita até 15 MB (`TAMANHO_MAXIMO_BYTES`). Toda foto entre 10 e 15 MB chegava cortada — o
  multipart sem fim vira falha e a pessoa via "Não deu para enviar essa foto".

## Correção

- `next.config.ts`: `experimental.proxyClientMaxBodySize` = `serverActions.bodySizeLimit`, os dois
  lidos de uma constante `LIMITE_DO_CORPO = "20mb"`. A Server Action já bufferiza o corpo inteiro até
  20 MB, então o critério de memória da 06.2 (que tirou o PUT dos anexos do matcher) não muda aqui.
- Teste unitário `tests/unit/next-config-limites.test.ts`: os dois limites são o mesmo número e
  cabem 15 MB + 1 MB de envelope. **RED visto** (2 falhas com o `next.config.ts` antigo, via
  `git stash`) e GREEN com a correção.
- e2e novo `tests/e2e/orcamentos-fotos.spec.ts` caso **(h)**: JPEG sintético de ~12,4 MB (ruído,
  3400×2600, qualidade 100, gerado na hora) vira "Foto de referência anexada." e "1 de 3".

## Comandos rodados de fato (worktree `C:\Users\Andre\amassa-fotos`, branch `quick/fotos-orcamento-truncadas`, base `main` 0b6bdd4)

- `npm run test:e2e -- --grep "orcamentos fotos"` — **81 passed** (4,2 min); (h) ok no desktop e no
  celular; zero "Request body exceeded" no log. (Uma primeira tentativa nem subiu: o Turbopack recusa
  `node_modules` ligado por junção; trocado por `npm ci` no worktree.)
- O RED do e2e **não** foi rodado (a regra de uma invocação por tarefa); o RED está na medição do
  `getCloneableBody` e no unitário.
- `npm run lint` ✅, `npx tsc --noEmit` ✅, `npm run verificar-acoes` ✅ (114 ações), `npm test` ✅
  (117 arquivos, 2305 testes).
- **Não rodado:** `npm run test:migracoes` (nenhuma migração mudou; ele disputaria o Postgres de
  teste com o agente da Fase 06.3, que trabalhava no checkout principal na mesma hora).

## Fora desta tarefa (continua aberto)

- O falso positivo do teste de HEIC em `lib/orcamentos/fotos.ts` (outro item do D-10 da 06.2).

## Publicação

Nada publicado. Sem migração: sobe com qualquer push normal do `main` depois do merge deste branch.

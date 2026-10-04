---
status: resolved
trigger: "Teste e2e tests/e2e/queimas-medidor.spec.ts:121 falha sempre (local e CI, run 37209767592): na página de detalhe do forno, em viewport de 320 px, a barra do medidor fica escondida (hidden) embora a linha \"Contagem\" apareça."
created: 2026-10-04
updated: 2026-10-04
---

## Symptoms

- expected: no detalhe do forno a 320 px, medir as caixas do trilho e dos três rótulos.
- actual: `caixa(medidor-trilho)` lança "Sem caixa: o elemento não está visível." — `boundingBox()` devolve `null`.
- reproduction: sempre, nos projetos `desktop` e `celular`, com retries (CI run 37209767592, artefato `playwright-falhas`).
- the `toHaveText` de `contagem-forno` logo antes PASSA.

## Evidence

- Trace do CI (`celular-retry1/trace.zip`): a última imagem, tirada no instante do `Bounding box`, mostra o
  ESQUELETO de `app/gestao/(app)/queimas/[id]/loading.tsx`, não a página.
- O snapshot de acessibilidade do erro tem `main` vazio — o conteúdo existia, mas oculto.
- Rede do trace: depois do GET do documento do detalhe, só prefetches (`next-router-prefetch=1`); nenhuma
  navegação RSC que re-suspendesse a página. Logo não é refresh nem `router.replace` do produto.
- Ordem das ações: `goto` → `toHaveText(contagem-forno)` ✓ → `boundingBox(trilho)` = null, ~0,3 s depois do GET.

## Eliminated

- hypothesis: dois `data-testid="medidor"` na página (um oculto). Só `cartao-forno.tsx` e a página de detalhe
  montam `Medidor`, e o locator é estrito — daria violação de estrito, não `null`.
- hypothesis: o produto navega de novo e re-suspende. A rede não mostra navegação nenhuma.

## Resolution

- root_cause: DEFEITO DO TESTE. A rota tem `loading.tsx`, então o HTML chega por streaming: primeiro o
  esqueleto, depois o conteúdo num `<div hidden>` que o React troca de lugar. `toHaveText` não exige
  visibilidade e casa nesse intervalo; `boundingBox()` não espera nada e mede o elemento ainda oculto. O teste
  do cartão não sofria porque o `scrollIntoViewIfNeeded` dele já espera a visibilidade.
- fix: `caixa()` em `tests/e2e/queimas-medidor.spec.ts` passa a fazer `await expect(alvo).toBeVisible()` antes
  de medir. Mais estrito, não mais frouxo: exige que a pessoa VEJA o elemento; a geometria conferida é a mesma.
- verification: `npm run test:e2e -- --grep "medidor sem sobreposição"` (uma invocação) — 77 passed, os quatro
  do medidor verdes em `desktop` e `celular`; `npm run verificar` exit 0.
- files_changed: tests/e2e/queimas-medidor.spec.ts
- nota: o relatório de execução das Queimas dizia que nenhum teste das Queimas falhou na varredura completa;
  este falhava sempre.

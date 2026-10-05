// Auxiliar de teste: mede a caixa de um elemento SÓ DEPOIS de ele estar visível (D-23, Fase 06.5).
//
// Por que existir. `boundingBox()` não espera nada: mede o que houver no instante. As rotas com
// `loading.tsx` entregam o HTML por streaming — primeiro o esqueleto, depois o conteúdo num
// `<div hidden>` que o React troca de lugar. `toHaveText` não exige visibilidade e já casa nesse
// intervalo; um `boundingBox()` logo em seguida mede o elemento ainda oculto e devolve `null`. Foi o
// que derrubou o run 37209767592 (`queimas-medidor.spec.ts`, detalhe do forno a 320 px — ver
// `.planning/debug/resolved/queimas-medidor-detalhe-320.md`).
//
// Esperar a visibilidade primeiro mede o que a pessoa vê; não afrouxa nada — a geometria conferida é
// a mesma. Por isso `npm run lint` recusa `boundingBox()` direto em `tests/e2e/` (regra em
// `eslint.config.mjs`): toda medida de caixa nos e2e passa por aqui.
import { expect, type Locator } from "@playwright/test";

export type CaixaMedida = { x: number; y: number; width: number; height: number };

export async function medirCaixa(localizador: Locator, rotulo?: string): Promise<CaixaMedida> {
  await expect(localizador).toBeVisible();
  const medida = await localizador.boundingBox();
  if (medida === null) {
    throw new Error(
      `medirCaixa: ${rotulo ?? localizador.toString()} está visível mas sem caixa mensurável — confira se o elemento não está fora da árvore de layout`,
    );
  }
  return medida;
}

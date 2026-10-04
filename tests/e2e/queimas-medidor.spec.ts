import { test, expect, type Locator, type Page } from "@playwright/test";

import { idDoForno, semearQueimas } from "./apoio/semear-queimas";

// O medidor sem rótulos sobrepostos (D-04, UI-D2) e a linha “Contagem: …” do cartão e do detalhe
// (QMC-09, UI-D1) — 06.4-06-PLAN.md, Tarefa 2. A vistoria de 19/09 achou “atenção 90” em cima de
// “limite 100” no celular; o conserto pôs “atenção N” numa segunda fileira, ancorado na marca. Aqui a
// prova é GEOMÉTRICA, pelas `boundingBox` reais: a 320 px e a 1280 px, com limite 10, 100 e 1000, as
// caixas de `medidor-rotulo-zero`, `-atencao` e `-limite` não se cruzam duas a duas, nenhuma passa das
// bordas horizontais de `medidor-trilho`, e o cartão não rola de lado. Os três rótulos continuam lá
// (FOR-05). Cada forno é criado pelo formulário, com nome único; as queimas de fundo vêm do banco
// (`semearQueimas`). Sem etiqueta de vazio: roda em `desktop`/`celular` depois da cadeia `vazio-*`.

async function fazerLogin(page: Page) {
  await page.goto("/gestao/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/gestao$/);
}

function nomeUnico(rotulo: string): string {
  return `[e2e] ${rotulo} ${test.info().project.name} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function cadastrarForno(page: Page, nome: string, limite: number): Promise<void> {
  await page.goto("/gestao/queimas?novo");
  await page.getByLabel("Nome").fill(nome);
  await page.getByLabel("Limite").fill(String(limite));
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page).toHaveURL(/\/gestao\/queimas$/, { timeout: 10000 });
}

type Caixa = { x: number; y: number; width: number; height: number };

// `boundingBox()` não espera nada: mede o que houver no instante. O detalhe do forno tem
// `loading.tsx`, e o conteúdo chega por streaming num `<div hidden>` antes de o React trocá-lo pelo
// esqueleto — `toHaveText` já casa nesse intervalo (não exige visibilidade), e medir ali dá `null`.
// Esperar a visibilidade primeiro mede o que a pessoa vê; não afrouxa nada.
async function caixa(alvo: Locator): Promise<Caixa> {
  await expect(alvo).toBeVisible();
  const medida = await alvo.boundingBox();
  if (medida === null) {
    throw new Error("Sem caixa: o elemento não está visível.");
  }
  return medida;
}

function seCruzam(a: Caixa, b: Caixa): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

// Meio pixel de folga só para o arredondamento sub-pixel do layout (“0” em `left-0` e “limite N” em
// `right-0` coincidem com as bordas do trilho, e a medida vem em ponto flutuante).
const FOLGA_SUBPIXEL = 0.5;

// As três caixas não se cruzam duas a duas e cada uma fica entre as bordas horizontais do trilho.
async function conferirRotulos(medidor: Locator, contexto: string): Promise<void> {
  const trilho = await caixa(medidor.getByTestId("medidor-trilho"));
  const rotulos = {
    zero: await caixa(medidor.getByTestId("medidor-rotulo-zero")),
    atencao: await caixa(medidor.getByTestId("medidor-rotulo-atencao")),
    limite: await caixa(medidor.getByTestId("medidor-rotulo-limite")),
  };
  expect(seCruzam(rotulos.zero, rotulos.atencao), `${contexto}: “0” × “atenção”`).toBe(false);
  expect(seCruzam(rotulos.zero, rotulos.limite), `${contexto}: “0” × “limite”`).toBe(false);
  expect(seCruzam(rotulos.atencao, rotulos.limite), `${contexto}: “atenção” × “limite”`).toBe(false);
  for (const [nome, rotulo] of Object.entries(rotulos)) {
    expect(rotulo.x, `${contexto}: “${nome}” passa da borda esquerda do trilho`).toBeGreaterThanOrEqual(
      trilho.x - FOLGA_SUBPIXEL,
    );
    expect(
      rotulo.x + rotulo.width,
      `${contexto}: “${nome}” passa da borda direita do trilho`,
    ).toBeLessThanOrEqual(trilho.x + trilho.width + FOLGA_SUBPIXEL);
  }
}

const CASOS = [
  // limite 10 → atenção 1 (a colisão antiga com o “0”); 11 queimas = 1 além do limite.
  { limite: 10, queimas: 11, frase: "Contagem: 1 queima além do limite da manutenção." },
  // limite 100 → atenção 90 (a colisão antiga com “limite 100”, a da vistoria).
  { limite: 100, queimas: 92, frase: "Contagem: 8 queimas até a manutenção." },
  { limite: 1000, queimas: 5, frase: "Contagem: 995 queimas até a manutenção." },
] as const;

const LARGURAS = [320, 1280] as const;

test.describe("medidor sem sobreposição", () => {
  test("no cartão, a 320 e a 1280 px, com limite 10, 100 e 1000: rótulos sem cruzar, dentro do trilho, sem rolagem lateral, e a linha “Contagem”", async ({
    page,
  }) => {
    test.setTimeout(90000);
    const email = process.env.E2E_EMAIL_TESTE ?? "";
    await fazerLogin(page);

    const fornos: { nome: string; id: string; caso: (typeof CASOS)[number] }[] = [];
    for (const caso of CASOS) {
      const nome = nomeUnico(`Forno medidor ${caso.limite}`);
      await cadastrarForno(page, nome, caso.limite);
      await semearQueimas(nome, caso.queimas, email);
      fornos.push({ nome, id: await idDoForno(nome), caso });
    }

    await page.goto("/gestao/queimas");
    for (const largura of LARGURAS) {
      await page.setViewportSize({ width: largura, height: 800 });
      for (const { id, caso } of fornos) {
        const cartao = page.getByTestId(`cartao-forno-${id}`);
        await cartao.scrollIntoViewIfNeeded();
        await expect(cartao.getByTestId("medidor-contador")).toHaveText(`${caso.queimas} / ${caso.limite}`);
        // Os três rótulos continuam (FOR-05).
        await expect(cartao.getByTestId("medidor-rotulo-zero")).toHaveText("0");
        await expect(cartao.getByTestId("medidor-rotulo-atencao")).toHaveText(
          `atenção ${Math.max(1, caso.limite - 10)}`,
        );
        await expect(cartao.getByTestId("medidor-rotulo-limite")).toHaveText(`limite ${caso.limite}`);
        await conferirRotulos(cartao.getByTestId("medidor"), `limite ${caso.limite} a ${largura} px`);
        const rolaDeLado = await cartao.evaluate((elemento) => elemento.scrollWidth > elemento.clientWidth);
        expect(rolaDeLado, `cartão do limite ${caso.limite} a ${largura} px rola de lado`).toBe(false);
        await expect(cartao.getByTestId(`contagem-forno-${id}`)).toHaveText(caso.frase);
      }
    }
  });

  test("no detalhe: a linha “Contagem”, os rótulos sem cruzar a 320 px e “ver os números” salta para os Números", async ({
    page,
  }) => {
    const nome = nomeUnico("Forno medidor detalhe");
    await fazerLogin(page);
    await cadastrarForno(page, nome, 100);
    await semearQueimas(nome, 92, process.env.E2E_EMAIL_TESTE ?? "");
    const id = await idDoForno(nome);

    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(`/gestao/queimas/${id}`);
    await expect(page.getByTestId("contagem-forno")).toHaveText("Contagem: 8 queimas até a manutenção.");
    await conferirRotulos(page.getByTestId("medidor"), "detalhe a 320 px");

    const link = page.getByRole("link", { name: "ver os números" });
    await expect(link).toHaveAttribute("href", "#numeros-do-forno");
    const alturaDoLink = (await caixa(link)).height;
    expect(alturaDoLink).toBeGreaterThanOrEqual(44);
    await link.click();
    await expect(page).toHaveURL(/#numeros-do-forno$/);
    await expect(page.getByTestId("numeros-do-forno")).toBeInViewport();

    // O voltar do cabeçalho leva ao índice das Queimas (achado do dono na caminhada, 04/10/2026).
    const voltar = page.getByRole("link", { name: "Voltar às Queimas" });
    expect((await caixa(voltar)).height).toBeGreaterThanOrEqual(44);
    await voltar.click();
    await expect(page).toHaveURL(/\/gestao\/queimas$/);
    await expect(page.getByTestId(`cartao-forno-${id}`)).toBeVisible();
  });
});

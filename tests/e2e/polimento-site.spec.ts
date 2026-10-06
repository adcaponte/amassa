import { test, expect } from "@playwright/test";

import { medirCaixa } from "./apoio/medir-caixa";

// Fase 06.5, plano 21 (D-29, POL-14): o site público para a abertura. O link "Pular para o conteúdo"
// é o primeiro elemento focável de `/` e de `/privacidade` e leva o foco ao `<main id="conteudo">`.
// Sem sessão e sem dado semeado: as duas páginas são estáticas e iguais para qualquer visitante.

test.describe("polimento site — pular", () => {
  for (const caminho of ["/", "/privacidade"]) {
    test(`${caminho}: o primeiro Tab mostra "Pular para o conteúdo" e Enter leva o foco ao <main>`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop", "Navegação por Tab de teclado físico — só o projeto desktop.");

      await page.goto(caminho);

      // Exatamente um `<main>`, o alvo do link.
      await expect(page.locator("main")).toHaveCount(1);
      await expect(page.locator("main#conteudo")).toHaveAttribute("tabindex", "-1");

      const pular = page.getByTestId("site-pular");
      await expect(pular).toHaveText("Pular para o conteúdo");
      await expect(pular).toHaveAttribute("href", "#conteudo");

      await page.keyboard.press("Tab");
      await expect(pular).toBeFocused();

      // Focado, ele aparece inteiro dentro da janela e com o alvo de 44 px.
      const caixa = await medirCaixa(pular, "site-pular focado");
      const janela = page.viewportSize();
      expect(janela).not.toBeNull();
      expect(caixa.x).toBeGreaterThanOrEqual(0);
      expect(caixa.y).toBeGreaterThanOrEqual(0);
      expect(caixa.x + caixa.width).toBeLessThanOrEqual(janela!.width);
      expect(caixa.y + caixa.height).toBeLessThanOrEqual(janela!.height);
      expect(caixa.height).toBeGreaterThanOrEqual(44);

      // "Acima da barra fixa": no centro do link, o elemento de cima é o próprio link — não a barra
      // superior do site, que também é `fixed` e vem depois dele no documento.
      const noCentro = await page.evaluate(
        ({ x, y }) => document.elementFromPoint(x, y)?.closest("[data-testid]")?.getAttribute("data-testid") ?? null,
        { x: caixa.x + caixa.width / 2, y: caixa.y + caixa.height / 2 },
      );
      expect(noCentro).toBe("site-pular");

      await page.keyboard.press("Enter");
      await expect(page.locator("main#conteudo")).toBeFocused();
      await expect(pular).not.toBeFocused();
    });
  }
});

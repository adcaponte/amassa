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

// D-29: o que o Google e o WhatsApp leem. Os endereços absolutos saem do `metadataBase` das duas
// páginas (o domínio de produção), também quando o teste roda em localhost.
test.describe("polimento site — metadados", () => {
  const BASE = "https://amassacerrado.com.br";

  for (const [caminho, absoluto] of [
    ["/", `${BASE}/`],
    ["/privacidade", `${BASE}/privacidade`],
  ] as const) {
    test(`${caminho}: canonical e og:url apontam para ${absoluto}; og:image é o recorte 1200×630`, async ({
      page,
      request,
    }) => {
      await page.goto(caminho);

      // Comparados depois de `new URL(...).href`: para a raiz, o Next escreve "https://amassacerrado.com.br",
      // sem a barra final — a MESMA URL que "https://amassacerrado.com.br/" do sitemap (a forma
      // normalizada de uma origem sempre leva a barra).
      const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
      const ogUrl = await page.locator('meta[property="og:url"]').getAttribute("content");
      expect(canonical).not.toBeNull();
      expect(ogUrl).not.toBeNull();
      expect(new URL(canonical!).href).toBe(absoluto);
      expect(new URL(ogUrl!).href).toBe(absoluto);

      const ogImage = await page.locator('meta[property="og:image"]').getAttribute("content");
      expect(ogImage).toBe(`${BASE}/site/abertura-og.jpg`);
      await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute("content", "1200");
      await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute("content", "630");

      // O arquivo existe e é servido como imagem — pedido ao servidor de teste, pelo mesmo caminho.
      const resposta = await request.get(new URL(ogImage!).pathname);
      expect(resposta.status()).toBe(200);
      expect(resposta.headers()["content-type"]).toMatch(/^image\//);
    });
  }

  test("a foto de abertura carrega com prioridade e as flores sem preload", async ({ page }) => {
    await page.goto("/");

    // `preload` do next/image: a foto de abertura não é `lazy` e tem um `<link rel="preload">` no head.
    const fotoDeAbertura = page.getByTestId("site-abertura").locator("img:not([aria-hidden])");
    await expect(fotoDeAbertura).toHaveCount(1);
    await expect(fotoDeAbertura).not.toHaveAttribute("loading", "lazy");
    await expect(page.locator('link[rel="preload"][as="image"][imagesrcset*="abertura.jpg"]')).toHaveCount(1);

    // As flores: decorativas, `lazy` e `async`, nunca no preload.
    const flores = page.locator('img[src^="/site/decoracao/"]');
    expect(await flores.count()).toBeGreaterThan(0);
    for (const flor of await flores.all()) {
      await expect(flor).toHaveAttribute("loading", "lazy");
      await expect(flor).toHaveAttribute("decoding", "async");
    }
    await expect(page.locator('link[rel="preload"][href*="/site/decoracao/"]')).toHaveCount(0);
  });

  test("/sitemap.xml lista a raiz e /privacidade, com lastmod", async ({ request }) => {
    const resposta = await request.get("/sitemap.xml");
    expect(resposta.status()).toBe(200);

    const corpo = await resposta.text();
    expect(corpo).toContain(`<loc>${BASE}/</loc>`);
    expect(corpo).toContain(`<loc>${BASE}/privacidade</loc>`);
    expect(corpo.match(/<lastmod>/g)).toHaveLength(2);
    expect(corpo).not.toContain("gestao");
  });
});

import { test, expect, type APIResponse } from "@playwright/test";

import { CABECALHOS_DE_SEGURANCA } from "@/lib/seguranca/cabecalhos";

// D-19 (06.5-19-PLAN.md, POL-10): toda resposta — o site público, a plataforma e as rotas de saúde —
// sai com os cabeçalhos de segurança de `lib/seguranca/cabecalhos.ts` e sem `X-Powered-By`. Pedido sem
// sessão nenhuma (o `request` do Playwright não carrega cookie): é o que um visitante, ou quem sonda,
// recebe. A CSP é só report-only — o navegador registraria, não bloquearia — e a página da raiz abre
// sem nenhuma violação registrada, o que mede que a política, como escrita, não quebraria o site.

function conferirCabecalhos(resposta: APIResponse, caminho: string) {
  // O Playwright entrega os nomes em minúsculas.
  const recebidos = resposta.headers();
  for (const { key, value } of CABECALHOS_DE_SEGURANCA) {
    expect(recebidos[key.toLowerCase()], `${caminho}: ${key}`).toBe(value);
  }
  expect(recebidos["x-powered-by"], `${caminho}: x-powered-by`).toBeUndefined();
}

test.describe("polimento segurança — cabeçalhos", () => {
  for (const caminho of ["/", "/privacidade", "/gestao/login", "/api/health"]) {
    test(`${caminho} responde com os seis cabeçalhos de segurança e sem x-powered-by`, async ({ request }) => {
      const resposta = await request.get(caminho);
      expect(resposta.status(), caminho).toBe(200);
      conferirCabecalhos(resposta, caminho);
    });
  }

  test("o redirecionamento do middleware (/gestao sem sessão) também leva os cabeçalhos", async ({ request }) => {
    const resposta = await request.get("/gestao", { maxRedirects: 0 });
    expect(resposta.status()).toBe(307);
    expect(resposta.headers()["location"]).toContain("/gestao/login");
    conferirCabecalhos(resposta, "/gestao (307)");
  });

  test("a raiz abre inteira, sem erro de página e sem nenhuma violação da CSP no console", async ({ page }) => {
    const mensagensDaCsp: string[] = [];
    const errosDaPagina: string[] = [];
    page.on("console", (mensagem) => {
      const texto = mensagem.text();
      if (/content security policy|content-security-policy|refused to/i.test(texto)) {
        mensagensDaCsp.push(`${mensagem.type()}: ${texto}`);
      }
    });
    page.on("pageerror", (erro) => errosDaPagina.push(erro.message));

    await page.goto("/");
    await expect(page.getByTestId("site-abertura")).toBeVisible();
    // Até o fim do carregamento: fontes, imagens e o JavaScript da hidratação já pedidos.
    await page.waitForLoadState("load");

    expect(errosDaPagina).toEqual([]);
    expect(mensagensDaCsp).toEqual([]);
  });
});

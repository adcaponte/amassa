import { test, expect, type Page, type TestInfo } from "@playwright/test";

import { CONTEUDO_SITE } from "@/conteudo/site";
import { rotuloTelefoneDoZap } from "@/lib/site/whatsapp";

// A varredura da página INTEIRA do site público, nos dois viewports (SIT-01, SIT-04, SIT-07,
// SIT-08, SIT-09, SIT-10) — a continuação de tests/e2e/site-abertura.spec.ts (plano 03, o
// traçador), agora que #espaco, #agenda, #encomendas e #onde existem. O caso da âncora que
// aquele arquivo deixou para depois (comentário no fim dele) é o caso (b) abaixo.
test.describe("site secoes", () => {
  test.beforeEach(async ({ page }) => {
    // scroll-behavior: smooth só se aplica sem esta preferência (app/globals.css) — desligá-la
    // torna o salto de âncora instantâneo e o teste determinístico (mesmo padrão de
    // site-abertura.spec.ts).
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  function barraFixaAtual(page: Page, testInfo: TestInfo) {
    return testInfo.project.name === "celular"
      ? page.getByTestId("site-barra-inferior")
      : page.getByTestId("site-barra-superior");
  }

  async function alturaDaBarra(page: Page): Promise<number> {
    return page.evaluate(() =>
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--altura-barra-site")),
    );
  }

  test("(a) a ordem dos ids no DOM é topo, espaco, agenda, encomendas, onde", async ({ page }) => {
    await page.goto("/");

    const idsEsperados = ["topo", "espaco", "agenda", "encomendas", "onde"];
    const ordemNoDom = await page.evaluate((esperados: string[]) => {
      const todosComId = Array.from(document.querySelectorAll("[id]")).map((elemento) => elemento.id);
      return todosComId.filter((id) => esperados.includes(id));
    }, idsEsperados);

    expect(ordemNoDom).toEqual(idsEsperados);
  });

  test("(b) a âncora fica ABAIXO da barra fixa, para Agenda e para Encomendas — e param em seções diferentes", async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    const alturaDaBarraFixa = await alturaDaBarra(page);
    expect(alturaDaBarraFixa).toBeGreaterThan(0);

    const barra = barraFixaAtual(page, testInfo);

    await barra.getByTestId("site-botao-agenda").click();
    await expect(page).toHaveURL(/#agenda$/);
    const caixaAgenda = await page.getByTestId("site-agenda").locator("h2").boundingBox();
    expect(caixaAgenda).not.toBeNull();
    expect(caixaAgenda!.y).toBeGreaterThanOrEqual(alturaDaBarraFixa - 1);
    const rolagemNaAgenda = await page.evaluate(() => window.scrollY);

    await barra.getByTestId("site-botao-encomendas").click();
    await expect(page).toHaveURL(/#encomendas$/);
    const caixaEncomendas = await page.getByTestId("site-encomendas").locator("h2").boundingBox();
    expect(caixaEncomendas).not.toBeNull();
    expect(caixaEncomendas!.y).toBeGreaterThanOrEqual(alturaDaBarraFixa - 1);
    const rolagemNoEncomendas = await page.evaluate(() => window.scrollY);

    // As duas âncoras não param na MESMA seção: por design (scroll-margin-top compartilhado,
    // components/site/secao.tsx), qualquer alvo pousa na MESMA posição RELATIVA à barra fixa —
    // por isso não é o boundingBox() da viewport que prova seções diferentes, é a posição de
    // rolagem ABSOLUTA do documento, que necessariamente difere entre duas seções distintas.
    expect(rolagemNaAgenda).not.toBeCloseTo(rolagemNoEncomendas, 0);
  });

  test("(c) @vazio-global sem evento público, a seção de aulas mostra exatamente três cartões e o aviso, sem grade nem navegação de mês", async ({
    page,
  }) => {
    await page.goto("/");

    const secaoAgenda = page.getByTestId("site-agenda");
    await expect(secaoAgenda.getByTestId("site-agenda-cartao")).toHaveCount(3);
    await expect(secaoAgenda).toContainText("O calendário com as datas e vagas entra aqui em breve.");

    const textoDaSecao = (await secaoAgenda.innerText()).toLowerCase();
    for (const vocabularioProibido of [
      "esgotado",
      "vagas restantes",
      "calendário mensal",
      "mês anterior",
      "próximo mês",
    ]) {
      expect(textoDaSecao, `a seção de aulas não deveria mencionar "${vocabularioProibido}"`).not.toContain(
        vocabularioProibido,
      );
    }
  });

  test("(d) a faixa da fachada não existe no DOM, e nenhuma <img> de conteúdo tem src ou alt vazio", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.getByTestId("site-faixa-fachada")).toHaveCount(0);

    // As artes decorativas (components/site/decoracao.tsx) são aria-hidden e, DE PROPÓSITO, não
    // recebem alt (SIT-09) — excluídas aqui para não confundir "decoração sem alt, por design"
    // com "foto de conteúdo sem alt, por defeito".
    const imagensDeConteudo = await page
      .locator('img:not([aria-hidden="true"])')
      .evaluateAll((elementos) =>
        elementos.map((elemento) => ({
          src: elemento.getAttribute("src") ?? "",
          alt: elemento.getAttribute("alt") ?? "",
        })),
      );

    expect(imagensDeConteudo.length).toBeGreaterThan(0);
    for (const imagem of imagensDeConteudo) {
      expect(imagem.src.length, `imagem com src vazio: ${JSON.stringify(imagem)}`).toBeGreaterThan(0);
      expect(imagem.alt.length, `imagem com alt vazio: ${JSON.stringify(imagem)}`).toBeGreaterThan(0);
    }
  });

  // Fase 06.5 (D-32, 06/10/2026): o caso VIROU — até aqui exigia "Rua [nome da rua]" literal (D-14
  // da 04.6). Agora o endereço é slot do dono: vazio, o par "Endereço" não existe; preenchido,
  // aparece sem colchete. Nenhum colchete em "Onde fica" nem no rodapé.
  test("(e) o endereço vazio não aparece e nenhum colchete aparece em site-contato nem no rodapé", async ({ page }) => {
    await page.goto("/");

    const contato = page.getByTestId("site-contato");
    await expect(contato).toBeVisible();
    const textoDoContato = await contato.innerText();
    if (CONTEUDO_SITE.contato.endereco.trim().length === 0) {
      expect(textoDoContato.toLowerCase()).not.toContain("endereço");
    } else {
      expect(textoDoContato).toContain(CONTEUDO_SITE.contato.endereco);
    }
    expect(textoDoContato).not.toMatch(/[[\]]/);

    const rodape = page.getByTestId("site-rodape");
    await expect(rodape).toContainText(CONTEUDO_SITE.rodape.quemSomos);
    expect(await rodape.innerText()).not.toMatch(/[[\]]/);
  });

  // D-30 / UI-D16 (Fase 06.5): o horário de funcionamento saiu; no lugar, "Abertura · Abrimos em
  // dezembro.".
  test("(l) “Onde fica” mostra Abertura · Abrimos em dezembro. e nenhum Horário", async ({ page }) => {
    await page.goto("/");

    const abertura = page.getByTestId("site-abertura-data");
    await expect(abertura).toBeVisible();
    await expect(abertura).toContainText("Abertura");
    await expect(abertura).toContainText("Abrimos em dezembro.");

    const textoDoContato = (await page.getByTestId("site-contato").innerText()).toLowerCase();
    expect(textoDoContato).not.toContain("horário");
  });

  test("(f) @vazio-global sem evento público, nenhum valor em dinheiro aparece em nenhuma seção", async ({ page }) => {
    await page.goto("/");

    const textoDaPagina = await page.locator("body").innerText();
    expect(textoDaPagina).not.toMatch(/R\$/);
  });

  test("(g) a 320px de largura, a página inteira (rolada até o fim) não exige rolagem horizontal", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/");

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    const [scrollWidth, clientWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);

    expect(
      scrollWidth,
      `/ rola horizontalmente a 320px (scrollWidth ${scrollWidth} > clientWidth ${clientWidth})`,
    ).toBeLessThanOrEqual(clientWidth);
  });

  test("(h) todo alvo de toque das seções novas (botão, link de barra, link de contato) mede ao menos 44px", async ({
    page,
  }) => {
    await page.goto("/");

    // Escopo: as duas barras fixas (já cobertas por site-abertura.spec.ts, conferidas de novo
    // aqui por completude) e as quatro seções que este plano constrói. A abertura e o rodapé são
    // escopo do plano 03 — não redecididos aqui.
    const blocos = [
      page.getByTestId("site-barra-superior"),
      page.getByTestId("site-barra-inferior"),
      page.getByTestId("site-espaco"),
      page.getByTestId("site-agenda"),
      page.getByTestId("site-encomendas"),
      page.getByTestId("site-onde"),
    ];

    for (const bloco of blocos) {
      const alvos = bloco.locator("a, button");
      const total = await alvos.count();
      for (let indice = 0; indice < total; indice++) {
        const alvo = alvos.nth(indice);
        if (!(await alvo.isVisible())) continue; // barra inferior some no desktop, e vice-versa.
        const caixa = await alvo.boundingBox();
        expect(caixa, "alvo de toque visível sem boundingBox mensurável").not.toBeNull();
        expect(caixa!.height, `${await alvo.textContent()} mede menos de 44px`).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test("(i) GET /sitemap.xml responde 200, lista a raiz e não lista a plataforma interna", async ({
    request,
  }) => {
    const resposta = await request.get("/sitemap.xml");
    expect(resposta.status()).toBe(200);

    const corpo = await resposta.text();
    expect(corpo).toContain("<loc>https://amassacerrado.com.br/</loc>");
    expect(corpo).not.toContain("gestao");
  });

  test("(j) o <head> traz og:image da foto de abertura, e og:title/description com acento correto", async ({
    page,
  }) => {
    await page.goto("/");

    const ogImage = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(ogImage).toMatch(/\/site\/abertura\.jpg$/);

    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute("content");
    const ogDescription = await page.locator('meta[property="og:description"]').getAttribute("content");
    expect(ogTitle).toContain("AMASSA CERRADO");
    expect(ogTitle).toContain("cerâmica");
    expect(ogDescription).toContain("Pirenópolis");
  });

  // D-28 / UI-D19 (Fase 06.5): o telefone exibido é derivado do `zap` — o esperado sai da constante
  // e da mesma função, nunca escrito aqui (repositório público).
  test("(k) o telefone do contato é o do zap, formatado — em / e em /privacidade, sem 0000-0000", async ({ page }) => {
    const telefone = rotuloTelefoneDoZap(CONTEUDO_SITE.zap);
    expect(telefone).toMatch(/^\(\d{2}\) 9 \d{4}-\d{4}$/);

    await page.goto("/");
    const contato = page.getByTestId("site-contato");
    await expect(contato).toContainText(telefone);
    const linkDoTelefone = contato.getByRole("link", { name: telefone });
    await expect(linkDoTelefone).toHaveAttribute("href", new RegExp(`^https://wa\\.me/${CONTEUDO_SITE.zap}`));
    expect(await page.locator("body").innerText()).not.toContain("0000-0000");

    await page.goto("/privacidade");
    const textoDaPrivacidade = await page.locator("body").innerText();
    expect(textoDaPrivacidade).toContain(`ou pelo WhatsApp ${telefone}.`);
    expect(textoDaPrivacidade).toMatch(/\(\d{2}\) 9 \d{4}-\d{4}/);
    expect(textoDaPrivacidade).not.toContain("0000-0000");
  });
});

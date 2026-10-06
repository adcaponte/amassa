import { test, expect, type Page } from "@playwright/test";

import { semearCliente, semearOficina } from "./apoio/semear-agenda";
import { semearItem, somarDiasAoHoje } from "./apoio/semear-financeiro";

// Fase 06.5, plano 09 (D-17, POL-09; achado "Já anotado" do Cowork: "cowork Caneca" → "Nada
// encontrado"). A busca por palavras soltas, em qualquer ordem e sem acento. Cada teste semeia só o
// que é dele, com nome inventado e sufixo único, e põe o sufixo no termo: os dois projetos rodam ao
// mesmo tempo e semeiam nomes parecidos, então nenhuma afirmação depende do que mais existe no banco.

const DICA = "A busca acha cada palavra, em qualquer ordem e com ou sem acento. Tente uma palavra só.";

async function fazerLogin(page: Page) {
  await page.goto("/gestao/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/gestao$/);
}

function sufixoUnico(): string {
  return `${test.info().project.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

async function semearCanecaECafe(suf: string) {
  const caneca = `[e2e busca] Caneca grande ${suf}`;
  const cafe = `Café coado e2e ${suf}`;
  await semearItem({
    nome: caneca,
    categoriaVenda: "Peças prontas",
    precoCentavos: 7000,
    apareceNaVenda: true,
    atalhoVenda: false,
    controlaEstoque: false,
    atalhoCompra: false,
  });
  await semearItem({
    nome: cafe,
    categoriaVenda: "Bebidas e comidas",
    precoCentavos: 800,
    apareceNaVenda: true,
    atalhoVenda: false,
    controlaEstoque: false,
    atalhoCompra: false,
  });
  return { caneca, cafe };
}

test.describe("polimento busca — venda", () => {
  test("a grade da Venda acha por palavras soltas, em qualquer ordem e sem acento", async ({ page }) => {
    const suf = sufixoUnico();
    const { caneca, cafe } = await semearCanecaECafe(suf);

    await fazerLogin(page);
    await page.goto("/gestao/financeiro");
    const busca = page.getByTestId("venda-busca");
    const atalho = (nome: string) => page.getByTestId("venda-atalho").filter({ hasText: nome });

    // "caneca e2e busca" — três palavras, nenhuma na ordem do nome.
    await busca.fill(`caneca e2e busca ${suf}`);
    await expect(atalho(caneca)).toBeVisible();
    await expect(atalho(cafe)).toHaveCount(0);

    // "cafe" sem acento acha "Café".
    await busca.fill(`cafe coado ${suf}`);
    await expect(atalho(cafe)).toBeVisible();
    await expect(atalho(caneca)).toHaveCount(0);

    // A ordem trocada também acha.
    await busca.fill(`grande caneca ${suf}`);
    await expect(atalho(caneca)).toBeVisible();

    // Nada achado: o termo entre aspas e o que fazer.
    const termo = `xícara inexistente ${suf}`;
    await busca.fill(termo);
    const vazia = page.getByTestId("busca-vazia");
    await expect(vazia).toBeVisible();
    await expect(vazia).toHaveAttribute("data-termo", termo);
    await expect(vazia).toContainText(`Nada encontrado para “${termo}”.`);
    await expect(vazia).toContainText(DICA);
    await expect(page.getByTestId("venda-atalho")).toHaveCount(0);
  });

  test("“Tudo o que se vende” acha pela mesma regra", async ({ page }) => {
    const suf = sufixoUnico();
    const { caneca, cafe } = await semearCanecaECafe(suf);

    await fazerLogin(page);
    await page.goto("/gestao/financeiro");
    await page.getByRole("button", { name: "Lista completa e atalhos" }).click();
    const folha = page.getByRole("dialog", { name: "Tudo o que se vende" });
    await expect(folha).toBeVisible();
    const busca = folha.getByLabel("Buscar", { exact: true });
    const linha = (nome: string) => folha.getByRole("button", { name: `Atalho: ${nome}` });

    await busca.fill(`caneca e2e busca ${suf}`);
    await expect(linha(caneca)).toBeVisible();
    await expect(linha(cafe)).toHaveCount(0);

    await busca.fill(`CAFE COADO ${suf}`);
    await expect(linha(cafe)).toBeVisible();

    await busca.fill(`grande caneca ${suf}`);
    await expect(linha(caneca)).toBeVisible();

    const termo = `xícara inexistente ${suf}`;
    await busca.fill(termo);
    const vazia = folha.getByTestId("busca-vazia");
    await expect(vazia).toHaveAttribute("data-termo", termo);
    await expect(vazia).toContainText(`Nada encontrado para “${termo}”.`);
    await expect(vazia).toContainText(DICA);
  });
});

test.describe("polimento busca — compra e pessoas", () => {
  test("“Todo material de estoque” da Despesa acha por duas palavras fora de ordem", async ({ page }) => {
    const suf = sufixoUnico();
    const material = `[e2e busca] Esmalte azul cobalto ${suf}`;
    await semearItem({
      nome: material,
      apareceNaVenda: false,
      atalhoVenda: false,
      controlaEstoque: true,
      unidade: "kg",
      categoriaCompra: "Argila, esmalte e insumos",
      atalhoCompra: false,
    });

    await fazerLogin(page);
    await page.goto("/gestao/financeiro?aba=despesa");
    await page.getByTestId("despesa-modo-compra").click();
    await page.getByRole("button", { name: "Lista completa e atalhos" }).click();
    const folha = page.getByRole("dialog", { name: "Todo material de estoque" });
    await expect(folha).toBeVisible();
    const busca = folha.getByLabel("Buscar", { exact: true });

    // "cobalto esmalte" — a ordem trocada, e sem as palavras do meio.
    await busca.fill(`cobalto esmalte ${suf}`);
    await expect(folha.getByRole("button", { name: `Atalho: ${material}` })).toBeVisible();

    const termo = `pincel inexistente ${suf}`;
    await busca.fill(termo);
    const vazia = folha.getByTestId("busca-vazia");
    await expect(vazia).toHaveAttribute("data-termo", termo);
    await expect(vazia).toContainText(`Nada encontrado para “${termo}”.`);
    await expect(vazia).toContainText(DICA);
  });

  test("o seletor de pessoa da Agenda acha “Bruna e2e Teixeira” por “teixeira bruna”, e o vazio mantém o “Cadastrar”", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    // Dias 600+ — longe dos reservados por outras specs da Agenda (300+, 330+, 360+, 500+, 700+).
    const data = somarDiasAoHoje(600 + (test.info().project.name === "celular" ? 1 : 0));
    const eventoId = await semearOficina({
      titulo: `[e2e busca] Oficina ${suf}`,
      data,
      inicio: "14:00",
      fim: "16:00",
      vagas: 4,
      precoCentavos: 10000,
    });
    const bruna = `Bruna e2e Teixeira ${suf}`;
    await semearCliente({ nome: bruna });

    await fazerLogin(page);
    await page.goto(`/gestao/agenda?semana=${data}&evento=${eventoId}`);
    const folha = page.getByTestId("folha-evento");
    await expect(folha.getByTestId("quem-vem")).toBeVisible();
    const campo = folha.getByRole("combobox", { name: "Colocar alguém" });

    // O servidor (`listarClientes`) acha por palavra, em qualquer ordem e sem acento.
    await campo.fill(`téixeira bruna ${suf}`);
    await expect(folha.getByTestId("seletor-opcao").filter({ hasText: bruna })).toHaveCount(1);

    // Ninguém: o termo entre aspas, a regra da busca, e o "Cadastrar “…”" continua lá.
    const termo = `zzz inexistente ${suf}`;
    await campo.fill(termo);
    const vazia = folha.getByTestId("busca-vazia");
    await expect(vazia).toHaveAttribute("data-termo", termo);
    await expect(vazia).toContainText(`Nada encontrado para “${termo}”.`);
    await expect(vazia).toContainText(DICA);
    await expect(folha.getByTestId("seletor-cadastrar")).toHaveText(`Cadastrar “${termo}”`);
  });
});

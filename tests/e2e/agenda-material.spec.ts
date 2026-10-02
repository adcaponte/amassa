import { test, expect, type Page } from "@playwright/test";

import {
  CORPO_CONFIRMAR_TIRAR_MATERIAL,
  FRASE_MATERIAL_SEM_PRECO,
  TEXTO_INCLUSO,
  TEXTO_SEM_MATERIAL,
  linhaDoMaterial,
  linhaEncerrado,
  linhaHorasCheias,
  toastUsoEncerrado,
  tituloConfirmarTirarMaterial,
} from "@/lib/agenda/textos";
import { ROTULO_UNIDADE } from "@/lib/cadastros/catalogo";
import { formatarReais } from "@/lib/financeiro/formato";
import { formatarDiaMes } from "@/lib/producao/calendario";

import {
  definirPrecoDeVendaDoItem,
  materiaisDoUsoNoBanco,
  saidasDoUsoNoBanco,
  semearCliente,
  semearMaterialDoUso,
  semearMaterialNoUso,
  semearUsoLivre,
  travarItemDaHora,
  usoLivreNoBanco,
} from "./apoio/semear-agenda";
import { somarDiasAoHoje } from "./apoio/semear-financeiro";
import { saldoNoBanco } from "./apoio/semear-estoque";

// Plano 05-10 (AGE-14, D-06, D-14, AGE-20): o material do uso livre. O gestor lista o que a pessoa usou —
// "Cobrar" só para item com preço de venda —, e ao encerrar CADA linha vira uma saída no Estoque com o
// destino "Uso livre do espaço" (área Espaço), ligada ao uso, inclusive a "incluso"; o preço de venda
// fica congelado na linha cobrada. Cada caso usa a PRÓPRIA pessoa e os PRÓPRIOS itens com sufixo único e
// só afirma o que é deles; os dias são 1100+ (longe dos que as outras specs contam), um por caso e por
// projeto. O preço da hora é um só no banco: quem encerra segura a trava de `travarItemDaHora` e o
// devolve ao nulo no fim. Nomes `[e2e]`.

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

function diaDoCaso(caso: number): string {
  const projeto = test.info().project.name === "celular" ? 1 : 0;
  return somarDiasAoHoje(1100 + caso * 2 + projeto);
}

function precoDaHora(): number {
  return test.info().project.name === "celular" ? 3500 : 3000;
}

function folhaDoUso(page: Page) {
  return page.getByTestId("folha-uso-livre");
}

async function abrirUso(page: Page, data: string, usoId: string) {
  await page.goto(`/gestao/agenda?semana=${data}&uso=${usoId}`);
  await expect(folhaDoUso(page)).toBeVisible();
  await expect(folhaDoUso(page).getByTestId("uso-conta")).toBeVisible();
  return folhaDoUso(page);
}

// "Escolher material" → o seletor "Qual material?" da Fase 06 (por cima da folha) → a busca pelo nome.
async function escolherMaterial(page: Page, itemId: string, nome: string) {
  const acrescentar = folhaDoUso(page).getByTestId("material-acrescentar");
  await acrescentar.getByTestId("escolher-material").click();
  const seletor = page.getByTestId("seletor-material");
  await expect(seletor).toBeVisible();
  await seletor.getByTestId("seletor-busca").fill(nome);
  await seletor.locator(`[data-testid="seletor-linha"][data-item-id="${itemId}"]`).click();
  await expect(seletor).toBeHidden();
  await expect(acrescentar.getByTestId("material-escolhido")).toHaveAttribute("data-item-id", itemId);
}

function linhasDeMaterial(page: Page) {
  return folhaDoUso(page).getByTestId("material-linha");
}

test.describe("agenda material", () => {
  test("(a) acrescentar 1,2 kg cobrado e 0,5 kg incluso (item sem preço: só “Incluso”, com a dica) → a conta soma o material; encerrar baixa as DUAS linhas no Estoque, com o vínculo, e congela o preço", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const dia = diaDoCaso(0);
    const nomePessoa = `[e2e] Material Uso ${suf}`;
    const clienteId = await semearCliente({ nome: nomePessoa });
    const nomeArgila = `[e2e] Argila ${suf}`;
    const nomeEsmalte = `[e2e] Esmalte ${suf}`;
    // Custo médio conhecido: argila R$ 5,00/kg, esmalte R$ 20,00/kg.
    const argilaId = await semearMaterialDoUso({
      nome: nomeArgila,
      unidade: "kg",
      precoVendaCentavos: 1800,
      saldo: { milesimos: 10_000, custoCentavos: 5000 },
    });
    const esmalteId = await semearMaterialDoUso({
      nome: nomeEsmalte,
      unidade: "kg",
      precoVendaCentavos: null,
      saldo: { milesimos: 2000, custoCentavos: 4000 },
    });
    const usoId = await semearUsoLivre({
      clienteId,
      data: dia,
      chegadaPrevista: "10:00",
      horasPrevistas: 2,
      pessoas: 2,
      estado: "no_espaco",
    });
    const preco = precoDaHora();
    const horas = 2 * 2 * preco;
    const materialCobrado = 2160; // 1,2 × R$ 18,00
    const total = horas + materialCobrado;

    const trava = await travarItemDaHora();
    try {
      await trava.definirPreco(preco);
      await fazerLogin(page);
      const folha = await abrirUso(page, dia, usoId);
      await expect(folha.getByTestId("material-nenhum")).toHaveText(TEXTO_SEM_MATERIAL);

      // 1,2 kg de argila, "Cobrar".
      await escolherMaterial(page, argilaId, nomeArgila);
      const acrescentar = folha.getByTestId("material-acrescentar");
      await acrescentar.getByTestId("material-quanto").fill("1,2");
      await acrescentar.getByTestId("material-cobrar").click();
      await expect(acrescentar.getByTestId("material-cobrar")).toHaveAttribute("aria-checked", "true");
      await acrescentar.getByTestId("mais-material").click();
      await expect(linhasDeMaterial(page)).toHaveCount(1);
      const argila = linhasDeMaterial(page).first();
      await expect(argila).toContainText(linhaDoMaterial("1,2", ROTULO_UNIDADE.kg, nomeArgila));
      await expect(argila.getByTestId("material-valor")).toHaveText(formatarReais(materialCobrado));

      // 0,5 kg de esmalte: sem preço de venda, só "Incluso", com a dica da D-14.
      await escolherMaterial(page, esmalteId, nomeEsmalte);
      await expect(acrescentar.getByTestId("material-cobrar")).toHaveCount(0);
      await expect(acrescentar.getByTestId("material-incluso")).toHaveAttribute("aria-checked", "true");
      await expect(acrescentar.getByTestId("material-sem-preco")).toHaveText(FRASE_MATERIAL_SEM_PRECO);
      await acrescentar.getByTestId("material-quanto").fill("0,5");
      await acrescentar.getByTestId("mais-material").click();
      await expect(linhasDeMaterial(page)).toHaveCount(2);
      const esmalte = linhasDeMaterial(page).nth(1);
      await expect(esmalte).toContainText(linhaDoMaterial("0,5", ROTULO_UNIDADE.kg, nomeEsmalte));
      await expect(esmalte.getByTestId("material-valor")).toHaveText(TEXTO_INCLUSO);

      // Nada saiu do Estoque antes de encerrar.
      expect(await saidasDoUsoNoBanco(usoId)).toEqual([]);

      // A conta: horas (pessoas uma vez) + material cobrado.
      await expect(folha.getByTestId("uso-saiu-as")).toHaveValue("12:00");
      await expect(folha.getByTestId("uso-conta-horas")).toHaveText(
        linhaHorasCheias(2, 2, formatarReais(preco), formatarReais(horas)),
      );
      await expect(folha.getByTestId("uso-conta-material")).toHaveText(formatarReais(materialCobrado));
      await expect(folha.getByTestId("uso-conta-valor")).toHaveText(formatarReais(total));

      await folha.getByTestId("uso-encerrar").click();
      await expect(
        page.getByText(toastUsoEncerrado(2, formatarReais(total), { cobrado: true, baixado: true })).first(),
      ).toBeVisible();
      await expect(folha).toHaveAttribute("data-estado", "encerrado");
      await expect(folha.getByTestId("uso-encerrado")).toHaveText(linhaEncerrado(2, 2));
      await expect(folha.getByTestId("uso-encerrado")).toContainText("estoque baixado (2 materiais)");
      // Encerrado: a lista só de leitura (sem "tirar", sem a linha de acrescentar).
      await expect(linhasDeMaterial(page)).toHaveCount(2);
      await expect(folha.getByTestId("tirar-material")).toHaveCount(0);
      await expect(folha.getByTestId("material-acrescentar")).toHaveCount(0);
      await expect(folha.getByTestId("uso-conta-valor")).toHaveText(formatarReais(total));
    } finally {
      await trava.soltar();
    }

    // O livro: DUAS saídas, uma por linha (inclusive a "incluso"), destino uso_livre, área Espaço,
    // origem manual, ligadas ao uso, ao custo médio do momento, com a nota congelada.
    const saidas = await saidasDoUsoNoBanco(usoId);
    expect(saidas).toHaveLength(2);
    const nota = `${nomePessoa} · ${formatarDiaMes(dia)}`;
    for (const saida of saidas) {
      expect(saida).toMatchObject({ origem: "manual", tipo: "saida", destino: "uso_livre", area: "espaco", nota });
    }
    const daArgila = saidas.find((saida) => saida.itemId === argilaId);
    const doEsmalte = saidas.find((saida) => saida.itemId === esmalteId);
    expect(Math.abs(daArgila?.quantidadeMilesimos ?? 0)).toBe(1200);
    expect(Math.abs(daArgila?.valorCentavos ?? 0)).toBe(600);
    expect(Math.abs(doEsmalte?.quantidadeMilesimos ?? 0)).toBe(500);
    expect(Math.abs(doEsmalte?.valorCentavos ?? 0)).toBe(1000);
    expect(await saldoNoBanco(argilaId)).toBe(10_000 - 1200);
    expect(await saldoNoBanco(esmalteId)).toBe(2000 - 500);

    // As linhas do uso: a baixa ligada, o preço congelado e o valor só no cobrado.
    const materiais = await materiaisDoUsoNoBanco(usoId);
    expect(materiais).toHaveLength(2);
    expect(materiais[0]).toMatchObject({
      itemId: argilaId,
      quantidadeMilesimos: 1200,
      cobrar: true,
      precoUnitarioCentavos: 1800,
      valorCentavos: materialCobrado,
      movimentacaoId: daArgila?.id,
    });
    expect(materiais[1]).toMatchObject({
      itemId: esmalteId,
      quantidadeMilesimos: 500,
      cobrar: false,
      precoUnitarioCentavos: null,
      valorCentavos: null,
      movimentacaoId: doEsmalte?.id,
    });
    expect(await usoLivreNoBanco(usoId)).toMatchObject({
      estado: "encerrado",
      horasCheias: 2,
      precoHoraCentavos: preco,
      valorCentavos: total,
    });
  });

  test("(b) o Estoque mostra o consumo do uso livre: a barra “Uso livre do espaço” no “Para onde foi”, a saída no histórico com o nome e a data, e a folha de baixa continua com os cinco destinos", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const dia = diaDoCaso(1);
    const nomePessoa = `[e2e] Material Estoque ${suf}`;
    const clienteId = await semearCliente({ nome: nomePessoa });
    const nomeItem = `[e2e] Argila Estoque ${suf}`;
    const itemId = await semearMaterialDoUso({
      nome: nomeItem,
      unidade: "kg",
      precoVendaCentavos: null,
      saldo: { milesimos: 4000, custoCentavos: 2000 },
    });
    const usoId = await semearUsoLivre({ clienteId, data: dia, chegadaPrevista: "14:00", estado: "no_espaco" });
    await semearMaterialNoUso({ usoLivreId: usoId, itemId, quantidadeMilesimos: 750, cobrar: false });

    const trava = await travarItemDaHora();
    try {
      await trava.definirPreco(precoDaHora());
      await fazerLogin(page);
      const folha = await abrirUso(page, dia, usoId);
      await expect(linhasDeMaterial(page)).toHaveCount(1);
      await folha.getByTestId("uso-encerrar").click();
      await expect(folha).toHaveAttribute("data-estado", "encerrado");
      await expect(folha.getByTestId("uso-encerrado")).toHaveText(linhaEncerrado(2, 1));
      await expect(folha.getByTestId("uso-encerrado")).toContainText("estoque baixado (1 material)");
    } finally {
      await trava.soltar();
    }
    // 0,75 kg a R$ 5,00/kg = R$ 3,75.
    const [saida] = await saidasDoUsoNoBanco(usoId);
    expect(Math.abs(saida?.valorCentavos ?? 0)).toBe(375);

    // "Para onde foi": a barra do uso livre (área Espaço), com pelo menos o consumo deste caso.
    await page.goto("/gestao/estoque?aba=destino");
    const barra = page.locator('[data-testid="destino-barra"][data-destino="uso_livre"]');
    await expect(barra).toHaveCount(1);
    await expect(barra.getByRole("img")).toHaveAttribute("aria-label", /^Uso livre do espaço: R\$/);
    expect(Number(await barra.getAttribute("data-valor-centavos"))).toBeGreaterThanOrEqual(375);

    // O histórico: a saída da Agenda no formato da saída manual, com o nome e a data congelados.
    await page.goto("/gestao/estoque?aba=historico&limite=1000");
    await expect(page.getByTestId("historico-lista")).toBeVisible();
    const linha = page.locator(`[data-testid="historico-linha"][data-item-id="${itemId}"]`).filter({
      hasText: "Uso livre do espaço",
    });
    await expect(linha).toHaveCount(1);
    await expect(linha.getByTestId("historico-detalhe")).toContainText(
      `Uso livre do espaço · paga por Espaço · ${nomePessoa} · ${formatarDiaMes(dia)}`,
    );

    // A folha de baixa do Estoque continua com os cinco destinos — "Uso livre do espaço" só a Agenda grava.
    await page.goto("/gestao/estoque");
    await page
      .locator(`[data-testid="estoque-cartao"][data-item-id="${itemId}"]`)
      .filter({ visible: true })
      .getByTestId("estoque-dar-baixa")
      .click();
    const folhaDoEstoque = page.getByTestId("folha-movimentacao");
    await expect(folhaDoEstoque).toBeVisible();
    await folhaDoEstoque.getByTestId("folha-tipo-saida").click();
    await expect(folhaDoEstoque.locator('[data-testid^="folha-destino-"]')).toHaveCount(5);
    await expect(folhaDoEstoque.getByTestId("folha-destino-uso_livre")).toHaveCount(0);
  });

  test("(c) antes de encerrar: trocar “Incluso” por “Cobrar” numa linha grava sem toast; “tirar” pede confirmação e a linha some — nada saiu do Estoque", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const dia = diaDoCaso(2);
    const clienteId = await semearCliente({ nome: `[e2e] Material Tirar ${suf}` });
    const nomeItem = `[e2e] Argila Tirar ${suf}`;
    const itemId = await semearMaterialDoUso({
      nome: nomeItem,
      unidade: "kg",
      precoVendaCentavos: 2000,
      saldo: { milesimos: 3000, custoCentavos: 3000 },
    });
    const usoId = await semearUsoLivre({ clienteId, data: dia, chegadaPrevista: "09:00", estado: "no_espaco" });
    const materialId = await semearMaterialNoUso({ usoLivreId: usoId, itemId, quantidadeMilesimos: 300, cobrar: false });

    await fazerLogin(page);
    const folha = await abrirUso(page, dia, usoId);
    const linha = folha.locator(`[data-testid="material-linha"][data-material-id="${materialId}"]`);
    await expect(linha.getByTestId("material-valor")).toHaveText(TEXTO_INCLUSO);

    // "Cobrar · Incluso" na linha: grava o estado desejado, sem toast; 0,3 × R$ 20,00 = R$ 6,00.
    await linha.getByTestId("material-cobrar").click();
    await expect(linha.getByTestId("material-cobrar")).toHaveAttribute("aria-checked", "true");
    await expect(linha.getByTestId("material-valor")).toHaveText(formatarReais(600));
    await expect(folha.getByTestId("uso-conta-material")).toHaveText(formatarReais(600));
    await expect.poll(async () => (await materiaisDoUsoNoBanco(usoId))[0]?.cobrar).toBe(true);

    // "tirar": a confirmação diz o que se perde; manter não muda nada.
    await linha.getByTestId("tirar-material").click();
    const confirmar = page.getByTestId("confirmar-tirar-material");
    await expect(confirmar).toBeVisible();
    await expect(confirmar.getByRole("heading")).toHaveText(tituloConfirmarTirarMaterial(nomeItem));
    await expect(confirmar).toContainText(CORPO_CONFIRMAR_TIRAR_MATERIAL);
    await confirmar.getByTestId("confirmar-tirar-material-nao").click();
    await expect(confirmar).toBeHidden();
    await expect(linhasDeMaterial(page)).toHaveCount(1);

    await linha.getByTestId("tirar-material").click();
    await page.getByTestId("confirmar-tirar-material-sim").click();
    await expect(page.getByTestId("confirmar-tirar-material")).toBeHidden();
    await expect(linhasDeMaterial(page)).toHaveCount(0);
    await expect(folha.getByTestId("material-nenhum")).toHaveText(TEXTO_SEM_MATERIAL);
    await expect(folha.getByTestId("uso-conta-material")).toHaveCount(0);

    expect(await materiaisDoUsoNoBanco(usoId)).toEqual([]);
    expect(await saidasDoUsoNoBanco(usoId)).toEqual([]);
    expect(await saldoNoBanco(itemId)).toBe(3000);
  });

  test("(d) encerrar um uso sem material não cria nenhuma saída de estoque", async ({ page }) => {
    const suf = sufixoUnico();
    const dia = diaDoCaso(3);
    const clienteId = await semearCliente({ nome: `[e2e] Material Nenhum ${suf}` });
    const usoId = await semearUsoLivre({
      clienteId,
      data: dia,
      chegadaPrevista: "15:00",
      horasPrevistas: 1,
      pessoas: 1,
      estado: "no_espaco",
    });
    const preco = precoDaHora();

    const trava = await travarItemDaHora();
    try {
      await trava.definirPreco(preco);
      await fazerLogin(page);
      const folha = await abrirUso(page, dia, usoId);
      await expect(folha.getByTestId("material-nenhum")).toHaveText(TEXTO_SEM_MATERIAL);
      // 1 pessoa: "1 h × R$ …", nunca "× 1 pessoas".
      await expect(folha.getByTestId("uso-conta-horas")).toHaveText(
        linhaHorasCheias(1, 1, formatarReais(preco), formatarReais(preco)),
      );
      await expect(folha.getByTestId("uso-conta-material")).toHaveCount(0);
      await folha.getByTestId("uso-encerrar").click();
      await expect(page.getByText(toastUsoEncerrado(1, formatarReais(preco))).first()).toBeVisible();
      await expect(folha.getByTestId("uso-encerrado")).toHaveText(linhaEncerrado(1));
    } finally {
      await trava.soltar();
    }
    expect(await saidasDoUsoNoBanco(usoId)).toEqual([]);
    expect(await usoLivreNoBanco(usoId)).toMatchObject({ estado: "encerrado", valorCentavos: preco });
  });

  test("(e) mudar o preço de venda do item depois do encerramento não muda o valor gravado (D-14: preço congelado)", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const dia = diaDoCaso(4);
    const clienteId = await semearCliente({ nome: `[e2e] Material Congela ${suf}` });
    const itemId = await semearMaterialDoUso({
      nome: `[e2e] Argila Congela ${suf}`,
      unidade: "kg",
      precoVendaCentavos: 2500,
      saldo: { milesimos: 5000, custoCentavos: 5000 },
    });
    const usoId = await semearUsoLivre({
      clienteId,
      data: dia,
      chegadaPrevista: "08:00",
      horasPrevistas: 1,
      pessoas: 1,
      estado: "no_espaco",
    });
    await semearMaterialNoUso({ usoLivreId: usoId, itemId, quantidadeMilesimos: 2000, cobrar: true });
    const preco = precoDaHora();
    const material = 5000; // 2 × R$ 25,00
    const total = preco + material;

    const trava = await travarItemDaHora();
    try {
      await trava.definirPreco(preco);
      await fazerLogin(page);
      const folha = await abrirUso(page, dia, usoId);
      await expect(folha.getByTestId("uso-conta-valor")).toHaveText(formatarReais(total));
      await folha.getByTestId("uso-encerrar").click();
      await expect(
        page.getByText(toastUsoEncerrado(1, formatarReais(total), { cobrado: true, baixado: true })).first(),
      ).toBeVisible();
      await expect(folha).toHaveAttribute("data-estado", "encerrado");
    } finally {
      await trava.soltar();
    }

    await definirPrecoDeVendaDoItem(itemId, 9900);
    const [linha] = await materiaisDoUsoNoBanco(usoId);
    expect(linha).toMatchObject({ precoUnitarioCentavos: 2500, valorCentavos: material });
    expect(await usoLivreNoBanco(usoId)).toMatchObject({ valorCentavos: total });

    // A folha relida mostra o congelado, não o preço novo.
    const folha = await abrirUso(page, dia, usoId);
    await expect(folha.getByTestId("uso-conta-material")).toHaveText(formatarReais(material));
    await expect(folha.getByTestId("uso-conta-valor")).toHaveText(formatarReais(total));
    await expect(linhasDeMaterial(page).first().getByTestId("material-valor")).toHaveText(formatarReais(material));
  });
});

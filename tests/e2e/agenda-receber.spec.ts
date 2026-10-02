import { test, expect, type Page } from "@playwright/test";

import { nomeDoMes } from "@/lib/agenda/semana";
import {
  CORPO_NINGUEM_DEVENDO,
  FRASE_NINGUEM_DEVENDO,
  fraseJaLancado,
  tagVendaCancelada,
  taxaDaMaquininha,
  toastRecebiAgora,
} from "@/lib/agenda/textos";
import { formatarPercentual, formatarReais } from "@/lib/financeiro/formato";
import { formatarDiaMes } from "@/lib/producao/calendario";

import {
  cancelarDocumentoNoBanco,
  itemDoSistemaNoBanco,
  ligarVendaAInscricao,
  semearCliente,
  semearInscricao,
  semearMaterialDoUso,
  semearMensalidade,
  semearOficina,
  semearTurmaComDatas,
  semearUsoLivreEncerrado,
  vendaDaCobranca,
  vendasDoCliente,
} from "./apoio/semear-agenda";
import { garantirTaxaDeTeste, hojeNoAtelie, somarDiasAoHoje, TAXA_DE_TESTE } from "./apoio/semear-financeiro";

// Plano 05-11 (AGE-15, D-01, D-04, D-08, D-14, UI-D4): a Agenda não guarda dinheiro. “A receber” lista o
// que ainda não virou venda; “Recebi agora” → a forma cria a Venda JÁ PAGA hoje, que entra no Caixa do
// dia, ligada à cobrança e ao cliente; o “pago” vem do Financeiro. Só o caso `@vazio-global` afirma o
// total de “A receber” (é global) — ele roda na cadeia `vazio-*`, antes de qualquer spec criar cobrança.
// Os outros acham a PRÓPRIA linha pelo `data-id` e só afirmam o que é deles; nomes `[e2e]` com sufixo
// único, dias 1200+ (longe dos que outras specs contam), um por caso e por projeto.

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
  return somarDiasAoHoje(1200 + caso * 2 + projeto);
}

function linhaAReceber(page: Page, tipo: "mensalidade" | "inscricao" | "uso_livre", id: string) {
  return page.locator(`[data-testid="a-receber-linha"][data-tipo="${tipo}"][data-id="${id}"]`);
}

async function abrirAReceber(page: Page) {
  await page.goto("/gestao/agenda?aba=receber");
  await expect(page.getByTestId("a-receber")).toBeVisible();
}

// Uma oficina com uma inscrição cobrada — a cobrança mais simples de “A receber”.
async function semearInscricaoCobrada(suf: string, data: string, valorCentavos: number) {
  const nome = `[e2e] Pessoa ${suf}`;
  const titulo = `[e2e] Oficina ${suf}`;
  const clienteId = await semearCliente({ nome });
  const eventoId = await semearOficina({ titulo, data, inicio: "14:00", fim: "17:00", vagas: 8, precoCentavos: valorCentavos });
  const inscricaoId = await semearInscricao({ eventoId, clienteId, tipo: "oficina", valorCentavos });
  return { nome, titulo, clienteId, eventoId, inscricaoId };
}

test.describe("agenda receber", () => {
  test("(a) ninguém devendo: o vazio, o total R$ 0,00 e a aba sem contador @vazio-global", async ({ page }) => {
    await fazerLogin(page);
    await abrirAReceber(page);

    await expect(page.getByTestId("aba-receber")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("aba-receber")).toHaveText("A receber");
    const vazio = page.getByTestId("a-receber-vazio");
    await expect(vazio.getByRole("heading", { name: FRASE_NINGUEM_DEVENDO })).toBeVisible();
    await expect(vazio.getByText(CORPO_NINGUEM_DEVENDO)).toBeVisible();
    await expect(page.getByTestId("a-receber-total")).toHaveText(formatarReais(0));
    await expect(page.getByTestId("a-receber-linha")).toHaveCount(0);
  });

  test("(b) “Recebi agora” → Pix: a venda já paga hoje, ligada à inscrição e à pessoa, no Caixa de hoje; a linha sai de “A receber”", async ({
    page,
  }) => {
    const hoje = hojeNoAtelie();
    const data = diaDoCaso(1);
    const { nome, titulo, clienteId, inscricaoId } = await semearInscricaoCobrada(sufixoUnico(), data, 18000);
    const item = await itemDoSistemaNoBanco("inscricao_oficina");

    await fazerLogin(page);
    await abrirAReceber(page);
    await expect(page.getByTestId("aba-receber")).toHaveText(/^A receber · \d+$/);
    const linha = linhaAReceber(page, "inscricao", inscricaoId);
    await expect(linha.getByTestId("a-receber-nome")).toHaveText(nome);
    await expect(linha.getByTestId("a-receber-valor")).toHaveText(formatarReais(18000));
    await expect(linha.getByTestId("a-receber-sub")).toHaveText(`${titulo} · ${formatarDiaMes(data)}`);

    await linha.getByTestId("recebi-agora").click();
    const folha = page.getByTestId("folha-recebi-agora");
    await expect(folha).toBeVisible();
    await expect(folha.getByTestId("recebi-agora-topo")).toContainText(nome);
    await expect(folha.getByTestId("recebi-agora-topo")).toContainText(formatarReais(18000));
    await folha.getByTestId("forma-pix").click();

    // O toast diz o número da venda; o link “ver no Caixa” (tocado enquanto o toast está na tela) abre o
    // Caixa, onde a venda paga hoje aparece.
    const aviso = page.getByText(/Venda nº \d+ lançada e paga em pix\. Já está no Caixa de hoje\./);
    await expect(aviso).toBeVisible();
    const textoDoAviso = await aviso.innerText();
    const numeroNoAviso = Number(/nº (\d+)/.exec(textoDoAviso)?.[1]);
    expect(textoDoAviso).toBe(toastRecebiAgora(numeroNoAviso, "pix"));
    await page.getByRole("button", { name: "ver no Caixa" }).click();
    await expect(page).toHaveURL(/\/gestao\/financeiro\?aba=caixa/);
    await expect(page.getByTestId("extrato-linha").filter({ hasText: titulo }).first()).toBeVisible();

    // De volta a “A receber”: a linha saiu (o “pago” agora vem do Financeiro).
    await abrirAReceber(page);
    await expect(linhaAReceber(page, "inscricao", inscricaoId)).toHaveCount(0);

    const venda = await vendaDaCobranca("inscricao", inscricaoId);
    expect(venda).not.toBeNull();
    expect(venda?.numero).toBe(numeroNoAviso);
    expect(venda).toMatchObject({
      data: hoje,
      pessoaNome: nome,
      clienteId,
      cancelado: false,
      linhas: [
        {
          itemId: item.id,
          descricao: `${titulo} · ${formatarDiaMes(data)}`,
          categoriaId: item.categoriaVendaId,
          quantidade: 1,
          valorCentavos: 18000,
        },
      ],
      parcelas: [{ vencimento: hoje, valorCentavos: 18000, forma: "pix", pagoEm: hoje, taxaPontosBase: null }],
      movimentacoes: 0,
    });
  });

  test("(c) toque duplo em “Cartão” cria UMA venda, com a taxa congelada; duas abas na mesma mensalidade: a segunda ouve que já virou a venda nº N", async ({
    page,
  }) => {
    await garantirTaxaDeTeste();
    const suf = sufixoUnico();
    const hoje = hojeNoAtelie();

    // Toque duplo.
    const { clienteId, inscricaoId } = await semearInscricaoCobrada(suf, diaDoCaso(2), 25000);
    await fazerLogin(page);
    await abrirAReceber(page);
    await linhaAReceber(page, "inscricao", inscricaoId).getByTestId("recebi-agora").click();
    const folha = page.getByTestId("folha-recebi-agora");
    await expect(folha.getByTestId("recebi-agora-taxa")).toHaveText(taxaDaMaquininha(formatarPercentual(TAXA_DE_TESTE)));
    await folha.getByTestId("forma-cartao").dblclick();
    await expect(page.getByText(/Venda nº \d+ lançada e paga em cartão\./)).toBeVisible();
    await expect(linhaAReceber(page, "inscricao", inscricaoId)).toHaveCount(0);
    expect(await vendasDoCliente(clienteId)).toHaveLength(1);
    const noCartao = await vendaDaCobranca("inscricao", inscricaoId);
    expect(noCartao?.parcelas).toEqual([
      { vencimento: hoje, valorCentavos: 25000, forma: "cartao", pagoEm: hoje, taxaPontosBase: TAXA_DE_TESTE },
    ]);

    // Duas abas, a mesma mensalidade (D-04: o item “Mensalidade”, a descrição com a turma e o mês).
    const turmaNome = `[e2e] Turma ${suf}`;
    const alunaId = await semearCliente({ nome: `[e2e] Aluna ${suf}` });
    const { turmaId } = await semearTurmaComDatas({
      nome: turmaNome,
      diaSemana: 2,
      inicio: "19:00",
      fim: "21:00",
      vagas: 6,
      mensalidadeCentavos: 32000,
      diaVencimento: 10,
      datas: [],
    });
    const mes = `${diaDoCaso(3).slice(0, 7)}-01`;
    const mensalidadeId = await semearMensalidade({
      turmaId,
      clienteId: alunaId,
      mes,
      valorCentavos: 32000,
      vencimento: `${mes.slice(0, 7)}-10`,
    });
    const outra = await page.context().newPage();
    await Promise.all([abrirAReceber(page), abrirAReceber(outra)]);
    for (const aba of [page, outra]) {
      const linha = linhaAReceber(aba, "mensalidade", mensalidadeId);
      await expect(linha.getByTestId("a-receber-sub")).toHaveText(
        `Mensalidade · ${turmaNome} · ${nomeDoMes(mes)} · vence dia 10`,
      );
      await linha.getByTestId("recebi-agora").click();
      await expect(aba.getByTestId("folha-recebi-agora")).toBeVisible();
    }
    await page.getByTestId("folha-recebi-agora").getByTestId("forma-dinheiro").click();
    await expect(page.getByText(/Venda nº \d+ lançada e paga em dinheiro\./)).toBeVisible();
    const daMensalidade = await vendaDaCobranca("mensalidade", mensalidadeId);
    expect(daMensalidade).not.toBeNull();

    await outra.getByTestId("folha-recebi-agora").getByTestId("forma-pix").click();
    await expect(outra.getByText(fraseJaLancado(daMensalidade?.numero ?? 0))).toBeVisible();
    await expect(outra.getByTestId("folha-recebi-agora")).toBeHidden();
    await outra.close();

    expect(await vendasDoCliente(alunaId)).toHaveLength(1);
    const mensalidadeItem = await itemDoSistemaNoBanco("mensalidade");
    expect(daMensalidade).toMatchObject({
      clienteId: alunaId,
      linhas: [
        {
          itemId: mensalidadeItem.id,
          descricao: `Mensalidade · ${turmaNome} · ${nomeDoMes(mes)}`,
          categoriaId: mensalidadeItem.categoriaVendaId,
          quantidade: 1,
          valorCentavos: 32000,
        },
      ],
      parcelas: [{ vencimento: hoje, valorCentavos: 32000, forma: "dinheiro", pagoEm: hoje, taxaPontosBase: null }],
    });
  });

  test("(d) uso livre encerrado com material cobrado: “Recebi agora” na folha do uso cria a linha do item e a linha livre do material, sem mexer no Estoque", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const data = diaDoCaso(4);
    const nome = `[e2e] Pessoa ${suf}`;
    const clienteId = await semearCliente({ nome });
    const argila = `[e2e] Argila ${suf}`;
    const argilaId = await semearMaterialDoUso({ nome: argila, unidade: "kg", precoVendaCentavos: 1800 });
    const esmalteId = await semearMaterialDoUso({ nome: `[e2e] Esmalte ${suf}`, unidade: "l", precoVendaCentavos: null });
    const { usoLivreId, valorCentavos } = await semearUsoLivreEncerrado({
      clienteId,
      data,
      horas: 2,
      pessoas: 2,
      precoHoraCentavos: 3000,
      materiais: [
        { itemId: argilaId, quantidadeMilesimos: 1200, cobrar: true, precoUnitarioCentavos: 1800 },
        { itemId: esmalteId, quantidadeMilesimos: 500, cobrar: false },
      ],
    });
    expect(valorCentavos).toBe(2 * 2 * 3000 + 2160);
    const usoItem = await itemDoSistemaNoBanco("uso_livre_hora");

    await fazerLogin(page);
    await abrirAReceber(page);
    await expect(linhaAReceber(page, "uso_livre", usoLivreId).getByTestId("a-receber-sub")).toHaveText(
      `Uso livre · 2 h × 2 pessoas · ${formatarDiaMes(data)} · material ${formatarReais(2160)}`,
    );

    // A folha do uso encerrado e ainda a receber tem “Recebi agora” no rodapé (verdade 8).
    await page.goto(`/gestao/agenda?semana=${data}&uso=${usoLivreId}`);
    const folhaDoUso = page.getByTestId("folha-uso-livre");
    await expect(folhaDoUso).toHaveAttribute("data-estado", "encerrado");
    await folhaDoUso.getByTestId("recebi-agora").click();
    const folha = page.getByTestId("folha-recebi-agora");
    await expect(folha.getByTestId("recebi-agora-topo")).toContainText(formatarReais(valorCentavos));
    await folha.getByTestId("forma-dinheiro").click();
    await expect(page.getByText(/Venda nº \d+ lançada e paga em dinheiro\./)).toBeVisible();
    // Lançado e pago: o rodapé volta a ter só “Voltar à agenda”.
    await expect(folhaDoUso.getByTestId("recebi-agora")).toHaveCount(0);

    const venda = await vendaDaCobranca("uso_livre", usoLivreId);
    expect(venda).toMatchObject({
      pessoaNome: nome,
      clienteId,
      linhas: [
        {
          itemId: usoItem.id,
          descricao: `Uso livre · 2 h × 2 pessoas · ${formatarDiaMes(data)}`,
          categoriaId: usoItem.categoriaVendaId,
          quantidade: 1,
          valorCentavos: 12000,
        },
        { itemId: null, descricao: `${argila} · 1,2 kg`, categoriaId: usoItem.categoriaVendaId, quantidade: 1, valorCentavos: 2160 },
      ],
      parcelas: [{ valorCentavos: valorCentavos, forma: "dinheiro" }],
      movimentacoes: 0,
    });
  });

  test("(e) experimental gratuita e oficina de preço zero nunca aparecem; a experimental cobrada aparece como “Aula experimental · {turma}”", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const data = diaDoCaso(5);
    const turmaNome = `[e2e] Turma ${suf}`;
    const { eventoIds } = await semearTurmaComDatas({
      nome: turmaNome,
      diaSemana: 3,
      inicio: "19:00",
      fim: "21:00",
      vagas: 6,
      mensalidadeCentavos: 32000,
      diaVencimento: 5,
      datas: [data],
    });
    const gratuitaId = await semearInscricao({
      eventoId: eventoIds[0],
      clienteId: await semearCliente({ nome: `[e2e] Gratuita ${suf}` }),
      tipo: "experimental",
      cobrar: false,
    });
    const cobradaId = await semearInscricao({
      eventoId: eventoIds[0],
      clienteId: await semearCliente({ nome: `[e2e] Cobrada ${suf}` }),
      tipo: "experimental",
      cobrar: true,
      valorCentavos: 8000,
    });
    const oficinaZero = await semearOficina({
      titulo: `[e2e] Oficina grátis ${suf}`,
      data,
      inicio: "09:00",
      fim: "11:00",
      vagas: 8,
      precoCentavos: 0,
    });
    const zeroId = await semearInscricao({
      eventoId: oficinaZero,
      clienteId: await semearCliente({ nome: `[e2e] Zero ${suf}` }),
      tipo: "oficina",
      valorCentavos: 0,
    });

    await fazerLogin(page);
    await abrirAReceber(page);
    const cobrada = linhaAReceber(page, "inscricao", cobradaId);
    await expect(cobrada.getByTestId("a-receber-sub")).toHaveText(
      `Aula experimental · ${turmaNome} · ${formatarDiaMes(data)}`,
    );
    await expect(cobrada.getByTestId("a-receber-valor")).toHaveText(formatarReais(8000));
    await expect(linhaAReceber(page, "inscricao", gratuitaId)).toHaveCount(0);
    await expect(linhaAReceber(page, "inscricao", zeroId)).toHaveCount(0);
  });

  test("(f) a venda cancelada no Caixa devolve a inscrição a “A receber” com a tag, e “Recebi agora” cria outra venda", async ({
    page,
  }) => {
    const data = diaDoCaso(6);
    const { clienteId, titulo, inscricaoId } = await semearInscricaoCobrada(sufixoUnico(), data, 15000);
    const antiga = await ligarVendaAInscricao({
      inscricaoId,
      valorCentavos: 15000,
      descricao: `${titulo} · ${formatarDiaMes(data)}`,
      data: hojeNoAtelie(),
    });

    await fazerLogin(page);
    await abrirAReceber(page);
    // Venda ativa: fora de “A receber”.
    await expect(linhaAReceber(page, "inscricao", inscricaoId)).toHaveCount(0);

    // O Caixa cancela: nada é gravado na inscrição — ela volta sozinha, por derivação (D-08).
    await cancelarDocumentoNoBanco(antiga.documentoId);
    await abrirAReceber(page);
    const linha = linhaAReceber(page, "inscricao", inscricaoId);
    await expect(linha).toHaveAttribute("data-situacao", "venda_cancelada");
    await expect(linha.getByTestId("tag-venda-cancelada")).toHaveText(tagVendaCancelada(antiga.numero));

    await linha.getByTestId("recebi-agora").click();
    await page.getByTestId("folha-recebi-agora").getByTestId("forma-pix").click();
    await expect(page.getByText(/Venda nº \d+ lançada e paga em pix\./)).toBeVisible();
    await expect(linha).toHaveCount(0);

    const nova = await vendaDaCobranca("inscricao", inscricaoId);
    expect(nova?.cancelado).toBe(false);
    expect(nova?.numero).not.toBe(antiga.numero);
    expect(await vendasDoCliente(clienteId)).toEqual([{ numero: nova?.numero, cancelado: false }]);
  });
});

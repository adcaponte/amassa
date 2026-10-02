import { test, expect, type Page } from "@playwright/test";

import { descricaoDaLinha } from "@/lib/agenda/receber";
import { nomeDoMes } from "@/lib/agenda/semana";
import {
  fraseCorridaDoLote,
  linhaDoLote,
  resumoDoLote,
  rotuloDoBotaoDoLote,
  tituloConfirmarLote,
  toastDoLote,
} from "@/lib/agenda/textos";
import { formatarReais } from "@/lib/financeiro/formato";

import {
  dispensarMensalidadeNoBanco,
  itemDoSistemaNoBanco,
  ligarVendaCanceladaAMensalidade,
  mensalidadesNoBanco,
  semearAluno,
  semearCliente,
  semearMensalidade,
  semearTurmaComDatas,
  vendaDaCobranca,
  vendasDoCliente,
} from "./apoio/semear-agenda";
import { hojeNoAtelie, somarDiasAoHoje } from "./apoio/semear-financeiro";

// Plano 05-12 (AGE-16, Assumption A6, D-02, D-08, D-09): o lote lança TODAS as mensalidades a receber de
// uma vez — uma venda POR mensalidade, com UMA parcela EM ABERTO vencendo no dia da turma, e o vínculo
// gravado junto. O lote age sobre TODAS as mensalidades livres do banco: estes casos contam linhas, por
// isso rodam em série na cadeia `vazio-historico` (antes de `desktop`/`celular` criarem cobrança), um
// depois do outro — cada caso deixa tudo lançado para o próximo começar do zero.

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

async function abrirAReceber(page: Page) {
  await page.goto("/gestao/agenda?aba=receber");
  await expect(page.getByTestId("a-receber")).toBeVisible();
}

async function semearTurma(nome: string, mensalidadeCentavos: number, diaVencimento: number): Promise<string> {
  const { turmaId } = await semearTurmaComDatas({
    nome,
    diaSemana: 3,
    inicio: "19:00",
    fim: "21:00",
    vagas: 8,
    mensalidadeCentavos,
    diaVencimento,
    // Uma aula no mês corrente: sem aula no mês, a D-02 não faz nascer a mensalidade (WR-03 da revisão,
    // decisão do dono de 02/10/2026). Nunca HOJE: `inicio-agenda-de-hoje` (também @vazio-historico) conta
    // os lançamentos do dia.
    datas: [`${hojeNoAtelie().slice(0, 7)}-${hojeNoAtelie().endsWith("-01") ? "02" : "01"}`],
  });
  return turmaId;
}

// O mês de hoje em Brasília (as mensalidades do lote são as do mês — D-02).
function mesDeHoje(): { mes: string; dia: (d: number) => string } {
  const prefixo = hojeNoAtelie().slice(0, 7);
  return { mes: `${prefixo}-01`, dia: (d) => `${prefixo}-${String(d).padStart(2, "0")}` };
}

test.describe.serial("agenda mensalidades lote @vazio-historico", () => {
  test("(a) quatro mensalidades (proporcional, venda cancelada, aluno em duas turmas) → quatro vendas com a parcela em aberto no dia da turma; a dispensada não entra", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const { mes, dia } = mesDeHoje();
    const turmaA = `[e2e] Lote A ${suf}`;
    const turmaB = `[e2e] Lote B ${suf}`;
    const turmaAId = await semearTurma(turmaA, 20000, 5);
    const turmaBId = await semearTurma(turmaB, 30000, 20);

    const ana = `[e2e] Ana ${suf}`;
    const bia = `[e2e] Bia ${suf}`;
    const caio = `[e2e] Caio ${suf}`;
    const davi = `[e2e] Davi ${suf}`;
    const anaId = await semearCliente({ nome: ana });
    const biaId = await semearCliente({ nome: bia });
    const caioId = await semearCliente({ nome: caio });
    const daviId = await semearCliente({ nome: davi });

    // Ana: proporcional na turma A. Bia: na turma B, com a venda cancelada no Caixa (D-08 — volta livre).
    // Caio: aluno das DUAS turmas desde antes do dia 1 — as duas mensalidades nascem ao abrir a Agenda
    // (D-02). Davi: dispensada (D-09 — não entra).
    const anaMensalidade = await semearMensalidade({
      turmaId: turmaAId,
      clienteId: anaId,
      mes,
      valorCentavos: 10000,
      vencimento: dia(5),
      aulasRestantes: 2,
      aulasNoMes: 4,
    });
    const biaMensalidade = await semearMensalidade({
      turmaId: turmaBId,
      clienteId: biaId,
      mes,
      valorCentavos: 30000,
      vencimento: dia(20),
    });
    const numeroCancelado = await ligarVendaCanceladaAMensalidade({
      mensalidadeId: biaMensalidade,
      valorCentavos: 30000,
      data: hojeNoAtelie(),
    });
    const daviMensalidade = await semearMensalidade({
      turmaId: turmaAId,
      clienteId: daviId,
      mes,
      valorCentavos: 20000,
      vencimento: dia(5),
    });
    await dispensarMensalidadeNoBanco(daviMensalidade);
    const entrou = somarDiasAoHoje(-70);
    await semearAluno({ turmaId: turmaAId, clienteId: caioId, entrouEm: entrou });
    await semearAluno({ turmaId: turmaBId, clienteId: caioId, entrouEm: entrou });

    await fazerLogin(page);
    // Abrir “A receber” duas vezes não duplica mensalidade (chave única + `on conflict do nothing`, D-02).
    await abrirAReceber(page);
    await abrirAReceber(page);
    const doCaio = await mensalidadesNoBanco(caioId);
    expect(doCaio.map((m) => [m.turmaId, m.mes, m.valorCentavos, m.vencimento]).sort()).toEqual(
      [
        [turmaAId, mes, 20000, dia(5)],
        [turmaBId, mes, 30000, dia(20)],
      ].sort(),
    );

    const lote = page.getByTestId("lote-mensalidades");
    await expect(lote).toHaveAttribute("open", "");
    await expect(lote.getByTestId("lote-resumo")).toHaveText(resumoDoLote(4));
    const mesNaTela = nomeDoMes(mes);
    await expect(lote.getByTestId("lote-linha")).toHaveText([
      linhaDoLote(ana, turmaA, mesNaTela, formatarReais(10000), true),
      linhaDoLote(caio, turmaA, mesNaTela, formatarReais(20000), false),
      linhaDoLote(bia, turmaB, mesNaTela, formatarReais(30000), false),
      linhaDoLote(caio, turmaB, mesNaTela, formatarReais(30000), false),
    ]);
    await expect(lote.getByTestId("lote-lancar")).toHaveText(rotuloDoBotaoDoLote(4, formatarReais(90000)));

    // A confirmação final (decisão do dono de 02/10/2026): quantas e o total, e só o confirmar lança.
    await lote.getByTestId("lote-lancar").click();
    const confirmacao = page.getByTestId("confirmar-lote");
    await expect(confirmacao.getByRole("heading")).toHaveText(tituloConfirmarLote(4));
    await expect(confirmacao).toContainText(formatarReais(90000));
    await confirmacao.getByTestId("confirmar-lote-sim").click();
    await expect(page.getByText(toastDoLote(4))).toBeVisible();
    // Nada mais livre: a sanfona some (E16·empty) e a aba fica sem primário.
    await expect(page.getByTestId("lote-mensalidades")).toHaveCount(0);

    const item = await itemDoSistemaNoBanco("mensalidade");
    const esperadas = [
      { id: anaMensalidade, clienteId: anaId, nome: ana, turma: turmaA, valor: 10000, vencimento: dia(5) },
      { id: biaMensalidade, clienteId: biaId, nome: bia, turma: turmaB, valor: 30000, vencimento: dia(20) },
      ...doCaio.map((m) => ({
        id: m.id,
        clienteId: caioId,
        nome: caio,
        turma: m.turmaId === turmaAId ? turmaA : turmaB,
        valor: m.valorCentavos,
        vencimento: m.vencimento,
      })),
    ];
    const numeros = new Set<number>();
    for (const esperada of esperadas) {
      const venda = await vendaDaCobranca("mensalidade", esperada.id);
      expect(venda).not.toBeNull();
      numeros.add(venda!.numero);
      expect(venda).toMatchObject({ clienteId: esperada.clienteId, pessoaNome: esperada.nome, cancelado: false });
      expect(venda!.linhas).toEqual([
        {
          itemId: item.id,
          descricao: descricaoDaLinha({ tipo: "mensalidade", turma: esperada.turma, mes }),
          categoriaId: item.categoriaVendaId,
          quantidade: 1,
          valorCentavos: esperada.valor,
        },
      ]);
      // UMA parcela, EM ABERTO, no dia da turma — o lote nunca marca recebimento.
      expect(venda!.parcelas).toEqual([
        { vencimento: esperada.vencimento, valorCentavos: esperada.valor, forma: "pix", pagoEm: null, taxaPontosBase: null },
      ]);
    }
    // Quatro vendas distintas; a da Bia é nova (a cancelada continua no Caixa).
    expect(numeros.size).toBe(4);
    expect(numeros.has(numeroCancelado)).toBe(false);
    expect(await vendasDoCliente(caioId)).toHaveLength(2);
    expect(await vendaDaCobranca("mensalidade", daviMensalidade)).toBeNull();
  });

  test("(b) duas abas com o lote aberto: a segunda recebe “0 lançadas; 2 já estavam lançadas.” e nada duplica", async ({
    page,
    browser,
  }) => {
    const suf = sufixoUnico();
    const { mes, dia } = mesDeHoje();
    const turmaId = await semearTurma(`[e2e] Lote C ${suf}`, 25000, 12);
    const clientes = [
      await semearCliente({ nome: `[e2e] Eva ${suf}` }),
      await semearCliente({ nome: `[e2e] Fabi ${suf}` }),
    ];
    for (const clienteId of clientes) {
      await semearMensalidade({ turmaId, clienteId, mes, valorCentavos: 25000, vencimento: dia(12) });
    }

    const outroContexto = await browser.newContext();
    const outra = await outroContexto.newPage();
    try {
      await fazerLogin(page);
      await fazerLogin(outra);
      await abrirAReceber(page);
      await abrirAReceber(outra);
      await expect(page.getByTestId("lote-linha")).toHaveCount(2);
      await expect(outra.getByTestId("lote-linha")).toHaveCount(2);

      await page.getByTestId("lote-lancar").click();
      await page.getByTestId("confirmar-lote-sim").click();
      await expect(page.getByText(toastDoLote(2))).toBeVisible();

      // A outra aba ainda mostra o lote velho: o servidor relê sob a trava, pula e conta.
      await outra.getByTestId("lote-lancar").click();
      await outra.getByTestId("confirmar-lote-sim").click();
      await expect(outra.getByText(fraseCorridaDoLote(0, 2))).toBeVisible();
      await expect(outra.getByTestId("lote-mensalidades")).toHaveCount(0);
    } finally {
      await outroContexto.close();
    }

    for (const clienteId of clientes) {
      expect(await vendasDoCliente(clienteId)).toHaveLength(1);
    }
  });

  test("(c) uma mensalidade só: o singular na sanfona, no botão, na confirmação e no toast; “Voltar” não cria venda", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const { mes, dia } = mesDeHoje();
    const turmaId = await semearTurma(`[e2e] Lote D ${suf}`, 32000, 8);
    const clienteId = await semearCliente({ nome: `[e2e] Gil ${suf}` });
    const mensalidadeId = await semearMensalidade({ turmaId, clienteId, mes, valorCentavos: 32000, vencimento: dia(8) });

    await fazerLogin(page);
    await abrirAReceber(page);
    const lote = page.getByTestId("lote-mensalidades");
    await expect(lote.getByTestId("lote-resumo")).toHaveText(resumoDoLote(1));
    await expect(lote.getByTestId("lote-lancar")).toHaveText("Lançar esta 1 na Venda · " + formatarReais(32000));
    // “Voltar” na confirmação (decisão do dono de 02/10/2026) fecha sem criar venda nenhuma.
    await lote.getByTestId("lote-lancar").click();
    const confirmacao = page.getByTestId("confirmar-lote");
    await expect(confirmacao.getByRole("heading")).toHaveText("Lançar 1 venda?");
    await confirmacao.getByTestId("confirmar-lote-nao").click();
    await expect(confirmacao).toHaveCount(0);
    expect(await vendasDoCliente(clienteId)).toHaveLength(0);
    await expect(page.getByTestId("lote-mensalidades")).toBeVisible();

    await lote.getByTestId("lote-lancar").click();
    await page.getByTestId("confirmar-lote-sim").click();
    await expect(page.getByText(toastDoLote(1))).toBeVisible();

    const venda = await vendaDaCobranca("mensalidade", mensalidadeId);
    expect(venda!.parcelas).toEqual([
      { vencimento: dia(8), valorCentavos: 32000, forma: "pix", pagoEm: null, taxaPontosBase: null },
    ]);
  });
});

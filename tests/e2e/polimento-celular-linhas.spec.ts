import { test, expect, type Locator, type Page } from "@playwright/test";
import { Client } from "pg";

import { medirCaixa } from "./apoio/medir-caixa";
import { semearCliente, semearMensalidade, semearTurmaComDatas } from "./apoio/semear-agenda";
import { apagarContaFixaPeloNome, criarContaFixaInativa } from "./apoio/semear-conta-fixa";
import { buscarCategoriaPorNome, hojeNoAtelie } from "./apoio/semear-financeiro";

// Fase 06.5 (Polimento), plano 02 — D-08, POL-01. As listas que o Cowork achou cortadas no celular
// (achados 4 e 6: "2×…", "Alugu / el") passam a usar a peça comum `LinhaDeRegistro`, cujo título tem
// uma fileira só dele abaixo de 384 px de CONTÊINER. E o botão do lote da Agenda, que vazava do
// cartão (achado 2, causa nº 4).
//
// Toda caixa é medida por `medirCaixa` (D-23) — nunca `boundingBox()` direto. Nomes semeados são
// inventados e prefixados "[e2e]"; nenhum teste afirma estado global do banco (cada um procura a
// PRÓPRIA linha pelo sufixo único).

const LARGURAS_DO_CELULAR = [320, 375] as const;

// `px-4` dos dois lados (32 px) + a borda de 1 px dos dois lados da linha (`border`): o título,
// sozinho na fileira dele, tem a largura da `<ul>` menos isso.
const RECUO_DO_TITULO_NA_LINHA = 32 + 2;

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

async function comCliente<T>(operacao: (cliente: Client) => Promise<T>): Promise<T> {
  const cliente = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
  await cliente.connect();
  try {
    return await operacao(cliente);
  } finally {
    await cliente.end();
  }
}

// Uma venda com `parcelas` parcelas de valor igual, a PRIMEIRA paga hoje (dia do ateliê) — é o que
// põe uma linha no extrato do mês. Mesmo molde de `semear-documento-antigo.ts` (documento → linha →
// parcelas numa transação; a soma das parcelas fecha com a da linha no `commit`).
async function semearVendaPaga(dados: {
  titulo: string;
  valorCentavos: number;
  parcelas: number;
}): Promise<void> {
  const email = process.env.E2E_EMAIL_TESTE;
  if (!email) {
    throw new Error("semearVendaPaga: a variável E2E_EMAIL_TESTE não está definida.");
  }
  const categoriaId = await buscarCategoriaPorNome("Peças prontas");
  const hoje = hojeNoAtelie();
  const valorDaParcela = dados.valorCentavos / dados.parcelas;
  if (!Number.isInteger(valorDaParcela)) {
    throw new Error("semearVendaPaga: o valor precisa dividir certo pelas parcelas.");
  }

  await comCliente(async (cliente) => {
    const usuario = await cliente.query<{ id: string }>(
      "select id from usuarios where lower(email) = lower($1) limit 1",
      [email],
    );
    const criadoPor = usuario.rows[0]?.id;
    if (!criadoPor) {
      throw new Error(`semearVendaPaga: nenhum usuário com o e-mail "${email}".`);
    }

    await cliente.query("begin");
    try {
      const { rows } = await cliente.query<{ id: string }>(
        `insert into documentos (tipo, data, titulo, criado_por)
         values ('venda'::tipo_documento, $1, $2, $3)
         returning id`,
        [hoje, dados.titulo, criadoPor],
      );
      const documentoId = rows[0].id;

      await cliente.query(
        `insert into documento_linhas
           (documento_id, ordem, descricao, categoria_id, quantidade, valor_centavos)
         values ($1, 0, $2, $3, 1, $4)`,
        [documentoId, dados.titulo, categoriaId, dados.valorCentavos],
      );

      for (let numero = 1; numero <= dados.parcelas; numero++) {
        const paga = numero === 1;
        await cliente.query(
          `insert into parcelas
             (documento_id, numero, vencimento, valor_centavos, forma, pago_em, pago_por)
           values ($1, $2, $3, $4, 'dinheiro'::forma_pagamento, $5, $6)`,
          [documentoId, numero, hoje, valorDaParcela, paga ? hoje : null, paga ? criadoPor : null],
        );
      }

      await cliente.query("commit");
    } catch (erro) {
      await cliente.query("rollback");
      throw erro;
    }
  });
}

async function semRolagemLateral(page: Page, onde: string) {
  const [scrollWidth, clientWidth] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    document.documentElement.clientWidth,
  ]);
  expect(
    scrollWidth,
    `${onde} rola de lado (scrollWidth ${scrollWidth} > clientWidth ${clientWidth})`,
  ).toBeLessThanOrEqual(clientWidth);
}

// O título tem a fileira inteira: largura da `<ul>` menos o recuo da linha (± 1 px de arredondamento).
async function tituloOcupaAFileiraInteira(lista: Locator, titulo: Locator, rotulo: string) {
  const caixaDaLista = await medirCaixa(lista, `${rotulo} — a lista`);
  const caixaDoTitulo = await medirCaixa(titulo, `${rotulo} — o título`);
  expect(
    Math.abs(caixaDoTitulo.width - (caixaDaLista.width - RECUO_DO_TITULO_NA_LINHA)),
    `${rotulo}: título com ${caixaDoTitulo.width}px numa lista de ${caixaDaLista.width}px`,
  ).toBeLessThanOrEqual(1);
}

test.describe("polimento celular — extrato", () => {
  for (const largura of LARGURAS_DO_CELULAR) {
    test(`a ${largura}px, o título da linha do extrato aparece inteiro, em largura toda`, async ({ page }) => {
      const suf = sufixoUnico();
      const tituloLongo = `[e2e] Encomenda de doze canecas esmaltadas em azul cobalto para o café da praça ${suf}`;
      const tituloParcelado = `[e2e] Travessa grande em duas vezes ${suf}`;

      await semearVendaPaga({ titulo: tituloLongo, valorCentavos: 48000, parcelas: 1 });
      await semearVendaPaga({ titulo: tituloParcelado, valorCentavos: 30000, parcelas: 2 });

      await fazerLogin(page);
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/gestao/financeiro?aba=caixa");

      const lista = page.getByRole("list", { name: "O que já entrou e saiu" });
      const linhaLonga = page.getByTestId("extrato-linha").filter({ hasText: suf }).filter({
        hasText: "canecas",
      });
      const linhaParcelada = page
        .getByTestId("extrato-linha")
        .filter({ hasText: suf })
        .filter({ hasText: "Travessa" });

      // A peça comum está ali, com a variante certa, e os testids de hoje continuam.
      await expect(linhaLonga.getByTestId("linha-registro")).toHaveAttribute("data-variante", "extrato");
      await expect(linhaParcelada.getByTestId("extrato-parcela")).toHaveText("1 de 2");

      // O texto INTEIRO do título — nunca "…".
      const tituloDaLonga = linhaLonga.getByTestId("linha-registro-titulo");
      await expect(tituloDaLonga).toHaveText(tituloLongo);
      await tituloOcupaAFileiraInteira(lista, tituloDaLonga, `extrato a ${largura}px (título longo)`);
      await tituloOcupaAFileiraInteira(
        lista,
        linhaParcelada.getByTestId("linha-registro-titulo"),
        `extrato a ${largura}px (parcelada)`,
      );

      // O valor fica abaixo do título (fileira 2), nunca espremido ao lado dele.
      const caixaDoTitulo = await medirCaixa(tituloDaLonga, "título longo");
      const caixaDoValor = await medirCaixa(linhaLonga.getByTestId("linha-registro-valor"), "valor");
      expect(caixaDoValor.y).toBeGreaterThanOrEqual(caixaDoTitulo.y + caixaDoTitulo.height - 0.5);

      // O "ver" é alvo de toque de 44 px e diz de qual linha é.
      const ver = linhaLonga.getByTestId("extrato-ver");
      await expect(ver).toHaveAccessibleName(`Ver ${tituloLongo}`);
      const caixaDoVer = await medirCaixa(ver, "o ver da linha");
      expect(caixaDoVer.height).toBeGreaterThanOrEqual(44);

      await semRolagemLateral(page, `Caixa a ${largura}px`);
    });
  }
});

// Um nome de exatamente 60 caracteres, único por execução — nunca terminando em espaço (o banco
// guardaria o espaço e o `toHaveText` o normalizaria, escondendo a diferença).
function nomeDe60Caracteres(suf: string): string {
  const nome = `[e2e] ${suf} Aluguel da sala dos fundos com depósito e condomínio`.slice(0, 60);
  return nome.endsWith(" ") ? `${nome.slice(0, 59)}s` : nome;
}

test.describe("polimento celular — contas fixas", () => {
  for (const largura of LARGURAS_DO_CELULAR) {
    test(`a ${largura}px, o nome de 60 caracteres aparece inteiro, com o valor e o botão embaixo`, async ({
      page,
    }) => {
      const nome = nomeDe60Caracteres(sufixoUnico());
      expect(nome).toHaveLength(60);

      // INATIVA de propósito (e apagada no fim): uma conta ativa a mais mudaria o que o "Gerar as
      // contas" de `cadastros-contas-fixas.spec.ts` cria — e a inativa ainda prova a linha riscada.
      await criarContaFixaInativa({
        nome,
        categoria: "Aluguel",
        valorCentavos: 150000,
        diaVencimento: 5,
      });
      try {
        await fazerLogin(page);
        await page.setViewportSize({ width: largura, height: 900 });
        await page.goto("/gestao/cadastros?sub=fixas");

        const lista = page.getByRole("list", { name: "Contas fixas" });
        const linha = page
          .getByTestId("conta-fixa-linha")
          .filter({ has: page.getByText(nome, { exact: true }) });

        await expect(linha.getByTestId("linha-registro")).toHaveAttribute("data-variante", "conta-fixa");

        // O nome INTEIRO, riscado (desativada) — nunca cortado.
        const titulo = linha.getByTestId("linha-registro-titulo");
        await expect(titulo).toHaveText(nome);
        await expect(titulo).toHaveClass(/line-through/);
        await tituloOcupaAFileiraInteira(lista, titulo, `contas fixas a ${largura}px`);

        // O campo de valor e o botão ficam ABAIXO do título, campo à esquerda e botão à direita.
        const caixaDoTitulo = await medirCaixa(titulo, "nome da conta fixa");
        const fimDoTitulo = caixaDoTitulo.y + caixaDoTitulo.height;
        const caixaDoValor = await medirCaixa(linha.getByTestId("conta-fixa-valor"), "campo de valor");
        const caixaDoBotao = await medirCaixa(
          linha.getByRole("button", { name: "Reativar" }),
          "botão Reativar",
        );
        expect(caixaDoValor.y).toBeGreaterThanOrEqual(fimDoTitulo - 0.5);
        expect(caixaDoBotao.y).toBeGreaterThanOrEqual(fimDoTitulo - 0.5);
        expect(caixaDoBotao.x).toBeGreaterThan(caixaDoValor.x + caixaDoValor.width);
        expect(caixaDoBotao.height).toBeGreaterThanOrEqual(44);

        await semRolagemLateral(page, `Contas fixas a ${largura}px`);
      } finally {
        await apagarContaFixaPeloNome(nome);
      }
    });
  }
});

test.describe("polimento celular — lote", () => {
  for (const largura of [320, 375, 414] as const) {
    test(`a ${largura}px, o botão do lote fica inteiro dentro do cartão`, async ({ page }) => {
      const suf = sufixoUnico();
      // Uma mensalidade livre basta para a sanfona do lote existir. Nenhuma aula semeada (`datas: []`):
      // o caso não depende de "hoje" nem mexe na agenda do dia de ninguém. O teste só MEDE — nunca
      // toca no botão, então não lança nada sobre as mensalidades dos outros casos.
      const { turmaId } = await semearTurmaComDatas({
        nome: `[e2e] Turma do botão do lote ${suf}`,
        diaSemana: 4,
        inicio: "19:00",
        fim: "21:00",
        vagas: 6,
        mensalidadeCentavos: 22000,
        diaVencimento: 10,
        datas: [],
      });
      const mes = `${hojeNoAtelie().slice(0, 7)}-01`;
      const mensalidadeId = await semearMensalidade({
        turmaId,
        clienteId: await semearCliente({ nome: `[e2e] Aluna do lote ${suf}` }),
        mes,
        valorCentavos: 22000,
        vencimento: `${mes.slice(0, 7)}-10`,
      });

      await fazerLogin(page);
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/gestao/agenda?aba=receber");
      await expect(page.locator(`[data-testid="lote-linha"][data-id="${mensalidadeId}"]`)).toHaveCount(1);

      const cartao = await medirCaixa(page.getByTestId("lote-mensalidades"), "cartão do lote");
      const botao = await medirCaixa(page.getByTestId("lote-lancar"), "botão do lote");
      expect(botao.x, `a ${largura}px o botão começa antes do cartão`).toBeGreaterThanOrEqual(cartao.x - 0.5);
      expect(
        botao.x + botao.width,
        `a ${largura}px o botão termina depois do cartão (${botao.x + botao.width} > ${cartao.x + cartao.width})`,
      ).toBeLessThanOrEqual(cartao.x + cartao.width + 0.5);
      expect(botao.height).toBeGreaterThanOrEqual(44);

      await semRolagemLateral(page, `A receber a ${largura}px`);
    });
  }
});

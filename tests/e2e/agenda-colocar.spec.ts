import { test, expect, type Page } from "@playwright/test";

import {
  AVISO_LISTA_CHEIA,
  CORPO_TIRAR_INSCRICAO_DA_LISTA,
  faixaInscricaoNaOficina,
  FRASE_DIGITE_PARA_BUSCAR,
  FRASE_NINGUEM_COM_ESSE_NOME,
  FRASE_NINGUEM_INSCRITO,
  fraseInscricaoJaVirouVenda,
  fraseJaEstaNaLista,
  fraseJaVirouVenda,
  rotuloCadastrarTexto,
  TOAST_INSCRITO_NA_OFICINA,
  tituloConfirmarTirarDaLista,
  tituloQuemVem,
  toastSaiuDaLista,
} from "@/lib/agenda/textos";
import { formatarReais } from "@/lib/financeiro/formato";

import {
  cancelarDocumentoNoBanco,
  clientesComNome,
  inscricaoNoBanco,
  inscricoesDoEvento,
  ligarVendaAInscricao,
  semearCliente,
  semearInscricao,
  semearOficina,
} from "./apoio/semear-agenda";
import { somarDiasAoHoje } from "./apoio/semear-financeiro";

// Plano 05-05, Tarefa 2 (AGE-10, AGE-11, AGE-12; D-08, UI-D5, UI-D14, UI-D16): colocar alguém numa
// oficina pelo seletor de pessoa — inclusive quem chegou pela primeira vez —, a lista cheia que só
// avisa, tirar da lista com confirmação e a inscrição que já virou venda, que só o Caixa desfaz. Cada
// caso semeia a PRÓPRIA oficina num dia reservado para ele e para o projeto (desktop e celular rodam
// juntos) e acha tudo pelo id ou por um sufixo único — nenhuma afirmação global do banco. Nomes
// `[e2e]`, datas de Brasília.

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

// Dias 360+ — longe dos da `agenda lancamento` (300+) e da `agenda cancelamento` (330+).
function diaReservado(caso: number): string {
  const projeto = test.info().project.name === "celular" ? 1 : 0;
  return somarDiasAoHoje(360 + caso * 2 + projeto);
}

async function abrirFolha(page: Page, data: string, eventoId: string) {
  await page.goto(`/gestao/agenda?semana=${data}&evento=${eventoId}`);
  const folha = page.getByTestId("folha-evento");
  await expect(folha).toBeVisible();
  // A lista chegou do servidor (o cabeçalho "Quem vem" só aparece com ela).
  await expect(folha.getByTestId("quem-vem")).toBeVisible();
  return folha;
}

function campoDoSeletor(page: Page) {
  return page.getByTestId("folha-evento").getByRole("combobox", { name: "Colocar alguém" });
}

async function escolherPelaBusca(page: Page, busca: string, nome: string) {
  await campoDoSeletor(page).fill(busca);
  const opcao = page.getByTestId("seletor-opcao").filter({ hasText: nome });
  await expect(opcao).toHaveCount(1);
  await opcao.click();
  await expect(campoDoSeletor(page)).toHaveAttribute("aria-expanded", "false");
}

test.describe("agenda colocar", () => {
  test("(a) duas pessoas enchem a oficina de 2 vagas — uma cadastrada pelo seletor —, o aviso âmbar aparece e a terceira GRAVA", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const data = diaReservado(0);
    const precoCentavos = 12345;
    const eventoId = await semearOficina({
      titulo: `[e2e] Oficina de duas vagas ${suf}`,
      data,
      inicio: "14:00",
      fim: "16:00",
      vagas: 2,
      precoCentavos,
    });
    const joao = `[e2e] João Colocar ${suf}`;
    const bia = `[e2e] Bia Colocar ${suf}`;
    const nova = `[e2e] Caio Chegou Agora ${suf}`;
    await semearCliente({ nome: joao, telefone: "(00) 1111-2222" });
    await semearCliente({ nome: bia });

    await fazerLogin(page);
    const folha = await abrirFolha(page, data, eventoId);
    await expect(folha.getByTestId("quem-vem")).toHaveText(tituloQuemVem(0, 2));
    await expect(folha.getByTestId("folha-evento-vazia")).toHaveText(FRASE_NINGUEM_INSCRITO);
    await expect(folha.getByTestId("aviso-lista-cheia")).toHaveCount(0);

    // Campo vazio: "Digite para buscar." (há gente cadastrada).
    await campoDoSeletor(page).click();
    await expect(campoDoSeletor(page)).toHaveAttribute("aria-expanded", "true");
    await expect(folha.getByTestId("seletor-mensagem")).toHaveText(FRASE_DIGITE_PARA_BUSCAR);

    // 1) "joao" acha "João" — sem acento, por pedaço do nome —, com o telefone na linha.
    await campoDoSeletor(page).fill(`joao colocar ${suf}`);
    const opcaoJoao = folha.getByTestId("seletor-opcao").filter({ hasText: joao });
    await expect(opcaoJoao).toHaveCount(1);
    await expect(opcaoJoao).toContainText("(00) 1111-2222");
    await opcaoJoao.click();
    await expect(folha.getByTestId("faixa-colocar")).toHaveText(
      faixaInscricaoNaOficina(joao, formatarReais(precoCentavos)),
    );
    await folha.getByTestId("colocar-na-lista").click();
    await expect(page.getByText(TOAST_INSCRITO_NA_OFICINA).first()).toBeVisible();
    await expect(folha.getByTestId("quem-vem")).toHaveText(tituloQuemVem(1, 2));
    await expect(folha.getByTestId("inscrito").filter({ hasText: joao })).toHaveCount(1);
    await expect(campoDoSeletor(page)).toHaveValue("");

    // 2) Quem chegou pela primeira vez: "Ninguém com esse nome." + "Cadastrar “…”", o formulário de
    //    pessoa com o nome escrito, e salvo, a pessoa fica escolhida.
    await campoDoSeletor(page).fill(nova);
    await expect(folha.getByTestId("seletor-mensagem")).toHaveText(FRASE_NINGUEM_COM_ESSE_NOME);
    const cadastrar = folha.getByTestId("seletor-cadastrar");
    await expect(cadastrar).toHaveText(rotuloCadastrarTexto(nova));
    await cadastrar.click();
    const formulario = page.getByTestId("formulario-cliente");
    await expect(formulario.getByLabel("Nome")).toHaveValue(nova);
    await formulario.getByRole("button", { name: "Salvar pessoa" }).click();
    await expect(formulario).toBeHidden();
    await expect(folha.getByTestId("faixa-colocar")).toHaveText(
      faixaInscricaoNaOficina(nova, formatarReais(precoCentavos)),
    );
    expect(await clientesComNome(nova)).toHaveLength(1);
    await folha.getByTestId("colocar-na-lista").click();
    await expect(folha.getByTestId("quem-vem")).toHaveText(tituloQuemVem(2, 2));

    // Lista cheia: a caixa âmbar AVISA — e o botão continua lá.
    await expect(folha.getByTestId("aviso-lista-cheia")).toHaveText(AVISO_LISTA_CHEIA);

    // 3) A terceira numa oficina de 2 vagas GRAVA (AGE-11: nada bloqueia por lista cheia).
    await escolherPelaBusca(page, `bia colocar ${suf}`, bia);
    await expect(folha.getByTestId("aviso-lista-cheia")).toBeVisible();
    await folha.getByTestId("colocar-na-lista").click();
    await expect(folha.getByTestId("quem-vem")).toHaveText(tituloQuemVem(3, 2));
    await expect(folha.getByTestId("inscrito")).toHaveCount(3);

    // O banco tem as três, cada uma paga à parte, com o preço do evento copiado.
    const gravadas = await inscricoesDoEvento(eventoId);
    expect(gravadas).toHaveLength(3);
    for (const inscricao of gravadas) {
      expect(inscricao.tipo).toBe("oficina");
      expect(inscricao.cobrar).toBe(true);
      expect(inscricao.valorCentavos).toBe(precoCentavos);
      expect(inscricao.documentoId).toBeNull();
    }
  });

  test("(b) quem já está na lista não aparece no seletor; Esc fecha só a lista; duas abas colocando a mesma pessoa terminam com uma inscrição só", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const data = diaReservado(1);
    const eventoId = await semearOficina({
      titulo: `[e2e] Oficina das duas abas ${suf}`,
      data,
      inicio: "10:00",
      fim: "12:00",
      vagas: 6,
      precoCentavos: 5000,
    });
    const inscrita = `[e2e] Duda Inscrita ${suf}`;
    const repetida = `[e2e] Duda Repetida ${suf}`;
    const inscritaId = await semearCliente({ nome: inscrita });
    const repetidaId = await semearCliente({ nome: repetida });
    await semearInscricao({ eventoId, clienteId: inscritaId, tipo: "oficina", valorCentavos: 5000 });

    await fazerLogin(page);
    const folha = await abrirFolha(page, data, eventoId);

    // A busca pelo sufixo acha as duas pessoas no cadastro — mas a que já está na data não aparece.
    await campoDoSeletor(page).fill(suf);
    await expect(folha.getByTestId("seletor-opcao")).toHaveCount(1);
    await expect(folha.getByTestId("seletor-opcao")).toContainText(repetida);
    await expect(folha.getByTestId("seletor-opcao").filter({ hasText: inscrita })).toHaveCount(0);

    // Esc com a lista aberta fecha a lista, não a folha.
    await campoDoSeletor(page).press("Escape");
    await expect(campoDoSeletor(page)).toHaveAttribute("aria-expanded", "false");
    await expect(folha).toBeVisible();

    // Setas e Enter escolhem.
    await campoDoSeletor(page).press("ArrowDown");
    await expect(campoDoSeletor(page)).toHaveAttribute("aria-expanded", "true");
    await campoDoSeletor(page).press("ArrowDown");
    await campoDoSeletor(page).press("Enter");
    await expect(folha.getByTestId("faixa-colocar")).toContainText(repetida);

    // A outra aba (a mesma sessão) escolhe a mesma pessoa antes de a primeira gravar.
    const outra = await page.context().newPage();
    await abrirFolha(outra, data, eventoId);
    await escolherPelaBusca(outra, `repetida ${suf}`, repetida);

    await folha.getByTestId("colocar-na-lista").click();
    await expect(folha.getByTestId("inscrito").filter({ hasText: repetida })).toHaveCount(1);

    const folhaDaOutra = outra.getByTestId("folha-evento");
    await folhaDaOutra.getByTestId("colocar-na-lista").click();
    await expect(folhaDaOutra.getByTestId("colocar-erro")).toHaveText(fraseJaEstaNaLista(repetida));
    // A tela foi atualizada: a pessoa aparece na lista da outra aba, uma vez.
    await expect(folhaDaOutra.getByTestId("inscrito").filter({ hasText: repetida })).toHaveCount(1);
    await outra.close();

    const gravadas = await inscricoesDoEvento(eventoId);
    expect(gravadas.filter((inscricao) => inscricao.clienteId === repetidaId)).toHaveLength(1);
    expect(gravadas).toHaveLength(2);
  });

  test("(c) tirar da lista pede confirmação, “Manter na lista” não muda nada, e a pessoa sai", async ({ page }) => {
    const suf = sufixoUnico();
    const data = diaReservado(2);
    const nome = `[e2e] Eva Sai ${suf}`;
    const eventoId = await semearOficina({
      titulo: `[e2e] Oficina para tirar ${suf}`,
      data,
      inicio: "14:00",
      fim: "16:00",
      vagas: 4,
      precoCentavos: 9000,
    });
    const clienteId = await semearCliente({ nome });
    const inscricaoId = await semearInscricao({ eventoId, clienteId, tipo: "oficina", valorCentavos: 9000 });

    await fazerLogin(page);
    const folha = await abrirFolha(page, data, eventoId);
    const linha = folha.getByTestId("inscrito").filter({ hasText: nome });
    const tirar = linha.getByRole("button", { name: `Tirar ${nome} da lista` });
    await expect(tirar).toHaveText("tirar da lista");

    await tirar.click();
    const confirmacao = page.getByTestId("confirmar-tirar-da-lista");
    await expect(confirmacao.getByRole("heading", { name: tituloConfirmarTirarDaLista(nome) })).toBeVisible();
    await expect(confirmacao).toContainText(CORPO_TIRAR_INSCRICAO_DA_LISTA);
    await page.getByTestId("confirmar-tirar-da-lista-nao").click();
    await expect(confirmacao).toHaveCount(0);
    expect(await inscricaoNoBanco(inscricaoId)).not.toBeNull();

    await tirar.click();
    await page.getByTestId("confirmar-tirar-da-lista-sim").click();
    await expect(page.getByText(toastSaiuDaLista(nome)).first()).toBeVisible();
    await expect(folha.getByTestId("inscrito")).toHaveCount(0);
    await expect(folha.getByTestId("folha-evento-vazia")).toHaveText(FRASE_NINGUEM_INSCRITO);
    await expect(folha.getByTestId("quem-vem")).toHaveText(tituloQuemVem(0, 4));
    expect(await inscricaoNoBanco(inscricaoId)).toBeNull();
  });

  test("(d) inscrição que virou venda ativa não sai pela Agenda — a tela velha ouve a frase da D-08; com a venda cancelada, o “tirar da lista” volta", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const data = diaReservado(3);
    const nome = `[e2e] Gil Pagou ${suf}`;
    const eventoId = await semearOficina({
      titulo: `[e2e] Oficina já vendida ${suf}`,
      data,
      inicio: "09:00",
      fim: "11:00",
      vagas: 4,
      precoCentavos: 7000,
    });
    const clienteId = await semearCliente({ nome });
    const inscricaoId = await semearInscricao({ eventoId, clienteId, tipo: "oficina", valorCentavos: 7000 });

    await fazerLogin(page);
    // A aba "velha": abriu a folha ANTES de a inscrição virar venda.
    const folhaVelha = await abrirFolha(page, data, eventoId);
    const linhaVelha = folhaVelha.getByTestId("inscrito").filter({ hasText: nome });
    await expect(linhaVelha.getByTestId("tirar-da-lista")).toBeVisible();

    const { documentoId, numero } = await ligarVendaAInscricao({
      inscricaoId,
      valorCentavos: 7000,
      descricao: `[e2e] Inscrição ${suf}`,
      data: somarDiasAoHoje(0),
    });

    // Uma aba nova vê a venda: a frase da UI-D14 + "ver no Caixa", e nenhum "tirar da lista".
    const nova = await page.context().newPage();
    const folhaNova = await abrirFolha(nova, data, eventoId);
    const linhaNova = folhaNova.getByTestId("inscrito").filter({ hasText: nome });
    await expect(linhaNova.getByTestId("venda-ativa")).toContainText(fraseJaVirouVenda(numero));
    await expect(linhaNova.getByRole("link", { name: "ver no Caixa" })).toHaveAttribute(
      "href",
      /\/gestao\/financeiro\?aba=caixa/,
    );
    await expect(linhaNova.getByTestId("tirar-da-lista")).toHaveCount(0);
    await nova.close();

    // A aba velha tenta tirar: o servidor recusa com a frase da D-08, dentro da confirmação.
    await linhaVelha.getByTestId("tirar-da-lista").click();
    await page.getByTestId("confirmar-tirar-da-lista-sim").click();
    await expect(page.getByTestId("confirmar-tirar-da-lista-erro")).toHaveText(fraseInscricaoJaVirouVenda(numero));
    expect(await inscricaoNoBanco(inscricaoId)).not.toBeNull();
    // Fechar a confirmação atualiza a folha: agora ela também mostra a venda.
    await page.getByTestId("confirmar-tirar-da-lista-nao").click();
    await expect(linhaVelha.getByTestId("venda-ativa")).toBeVisible();
    await expect(linhaVelha.getByTestId("tirar-da-lista")).toHaveCount(0);

    // O Caixa cancelou a venda: o "tirar da lista" volta, e tirar apaga só a inscrição.
    await cancelarDocumentoNoBanco(documentoId);
    await page.reload();
    const folha = page.getByTestId("folha-evento");
    const linha = folha.getByTestId("inscrito").filter({ hasText: nome });
    await expect(linha.getByTestId("tirar-da-lista")).toBeVisible();
    await expect(linha.getByTestId("venda-ativa")).toHaveCount(0);
    await linha.getByTestId("tirar-da-lista").click();
    await page.getByTestId("confirmar-tirar-da-lista-sim").click();
    await expect(page.getByText(toastSaiuDaLista(nome)).first()).toBeVisible();
    expect(await inscricaoNoBanco(inscricaoId)).toBeNull();
  });
});

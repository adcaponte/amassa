// A escrita das Queimas que roda DENTRO de uma transação (Fase 06.4 — contagem e vendas das
// externas).
//
// SEM a diretiva de Server Action, de propósito (molde `lib/agenda/gravacao.ts`): toda função
// exportada de um arquivo com a diretiva vira endpoint — chamável pelo navegador — e `npm run
// verificar-acoes` exigiria `exigirUsuario()` na primeira linha de cada uma. Estas funções recebem a
// TRANSAÇÃO de quem chama (as ações de `lib/queimas/acoes.ts`), por isso só são alcançáveis de dentro
// do servidor, depois que a ação que as chama já autorizou o usuário.
//
// A TRAVA É A DA LINHA DA QUEIMA (`for no key update of queimas`), nunca a da contagem: a contagem
// pode ainda não existir; a queima existe sempre — e a exclusão da queima (que leva a contagem e os
// vínculos, por cascade) espera essa mesma trava. `for no key update`, e não a trava exclusiva, pelo
// mesmo motivo da Agenda: a queima é alvo de chave estrangeira (`queima_contagens.queima_id`), e um
// insert concorrente pede `for key share`, que não conflita com `for no key update`.
//
// ORDEM DE TRAVAS DAS QUEIMAS, para nunca haver ciclo:
//   QUEIMA → (leitura dos vínculos) → (documento novo) → ITENS → (vínculo novo)
// Salvar a contagem (plano 01), apagá-la (plano 02), "Recebi agora" (plano 04) e "Lançar na Venda"
// (plano 05) passam TODOS por `travarContagem`. Nenhum escritor de `queima_contagens` ou de
// `queima_vendas` pode pular essa trava: o piso da D-07 só existe por causa dela.
//
// Quick 261005-2yu (05/10/2026): a EXCLUSÃO da queima também passa por `travarContagem`
// (`excluirQueimaNaTransacao`) — confere as vendas ativas sob a trava, e o `delete` sobe a trava da
// própria linha (`for update`, por baixo) na MESMA transação; a ordem continua QUEIMA primeiro.
//
// E a CONCORRÊNCIA OTIMISTA (06.4-WR-01/02/03): o navegador manda o que a tela mostrou — a contagem com
// que a folha abriu (`esperada`), as vendas ativas que a folha ou a confirmação mostraram
// (`vendasVistas`) — e as funções abaixo recusam, sob a trava, quando isso mudou: `RecusaDasQueimas`
// com a frase humana e `telaMudou`, e a tela é relida. Nada é gravado numa recusa.
// Quick 261008-pmi (08/10/2026), auditoria 08/10 — Queimas, aviso 1: o "Lançar na Venda" também
// (`vincularQueimaNaVenda`): a Venda aberta pelas Queimas leva as vendas ativas que a página leu, e um
// segundo "Lançar venda" depois de uma resposta perdida é recusado em vez de gravar outra venda.
//
// CR-01: a trava é tomada numa instrução e a leitura é REFEITA noutra (`travarEReler`); as vendas
// ligadas são lidas DEPOIS da trava, noutra instrução — sob READ COMMITTED, a instrução que esperou a
// trava traria as tabelas não travadas do retrato antigo.
//
// D-07 — o piso: a soma lançada em vendas ATIVAS nunca passa das externas contadas, por tamanho. Não é
// check do banco (é entre tabelas) — mora aqui, em `gravarContagem`, sob a trava da queima, com as
// regras puras de `lib/queimas/contagem.ts`. Subir as externas é sempre livre.
import { and, asc, count, eq, inArray, isNull } from "drizzle-orm";

import {
  clientes,
  documentos,
  parcelas,
  queimaContagens,
  queimaVendas,
  queimas,
} from "@/db/schema";
import type { TransacaoDoBanco } from "@/lib/estoque/gravacao";
import { gravarVenda, type LinhaDoPedidoDeVenda } from "@/lib/financeiro/gravacao";
import { conferirParcelas } from "@/lib/financeiro/parcelas";
import type { FormaDePagamento } from "@/lib/financeiro/textos";

import { obterItensDasQueimas } from "./consultas";
import {
  abaixoDoLancado,
  cabeNoQueFalta,
  chaveDoTamanho,
  contagemMudou,
  externasDaContagem,
  faltaCobrar,
  lancadoAtivo,
  numerosDasVendasAtivas,
  resumoPmg,
  totalDasQuantidades,
  precosDosItens,
  quantidadesDasLinhas,
  valorDasExternas,
  vendasAtivasMudaram,
  type Contagem,
  type LinhaParaQuantidades,
  type Quantidades,
  type VendaLigada,
} from "./contagem";
import {
  fraseAbaixoDoLancado,
  fraseAcimaDoQueFaltaNaVenda,
  fraseApagarComVendas,
  fraseOrigemQueimaTudoLancado,
  fraseSemPrecoDaQueima,
  fraseContagemMudou,
  fraseExclusaoComVendasNovas,
  fraseSoFaltam,
  fraseTudoJaLancado,
  fraseVendasMudaram,
  fraseVendasMudaramNaVenda,
  FRASE_LINHA_DA_QUEIMA_FALTANDO,
  FRASE_ORIGEM_QUEIMA_NAO_ACHADA,
  FRASE_PESSOA_SUMIU,
  FRASE_QUEIMA_DESFEITA_NADA_CONTADO,
  FRASE_SAIU_DE_A_COBRAR,
  type TipoDeQueima,
} from "./textos";

export type { TransacaoDoBanco };

// Uma recusa decidida SOB A TRAVA, com a frase que a tela mostra. Lançada de dentro da transação —
// nada foi gravado — e traduzida pela ação em `{ ok: false, erro: frase }` (molde `RecusaDaAgenda`).
//
// `detalhe.telaMudou` (quick 261005-2yu): a recusa é de TELA VELHA — a tela relê. `contagemAtual` = a
// contagem gravada agora (ou `null`), para a folha passar a esperar por ela.
export type DetalheDaRecusa = { telaMudou: true; contagemAtual?: Contagem | null };

export class RecusaDasQueimas extends Error {
  constructor(
    readonly frase: string,
    readonly detalhe?: DetalheDaRecusa,
  ) {
    super(frase);
    this.name = "RecusaDasQueimas";
  }
}

// CR-01 (revisão da Fase 5, copiado de `lib/agenda/gravacao.ts`): TRAVA numa instrução e RELÊ noutra.
// Sob READ COMMITTED, quem esperou a trava de uma linha que outra transação ATUALIZOU relê só a linha
// travada (EvalPlanQual) — as tabelas do LEFT JOIN que não estão travadas (aqui, `queima_contagens`)
// voltam do retrato ANTIGO. A segunda instrução tira um retrato NOVO com a trava já garantida. Repetir a
// trava na releitura não espera nada: ela já é desta transação. (Uma `QueryPromise` do Drizzle executa
// de novo a cada `await`.)
async function travarEReler<T>(consultaTravada: PromiseLike<T>): Promise<T> {
  await consultaTravada;
  return await consultaTravada;
}

export type QueimaTravada = {
  id: string;
  fornoId: string;
  tipo: TipoDeQueima;
  ocorridaEm: string;
  // `null` = sem contagem (estado válido e permanente).
  contagem: Contagem | null;
  // As vendas ligadas, relidas DEPOIS da trava — ativas e canceladas, em ordem de número. A base única
  // de "o que falta cobrar" (planos 02, 04 e 05).
  vendas: VendaLigada[];
};

// Trava a linha da QUEIMA e devolve, relidos depois da trava, a contagem (ou `null`) e as vendas
// ligadas. `null` se a queima não existe (desfeita em outro celular, ou pelo "Desfazer").
export async function travarContagem(
  tx: TransacaoDoBanco,
  queimaId: string,
): Promise<QueimaTravada | null> {
  const [linha] = await travarEReler(
    tx
      .select({
        id: queimas.id,
        fornoId: queimas.fornoId,
        tipo: queimas.tipo,
        ocorridaEm: queimas.ocorridaEm,
        contagemDe: queimaContagens.queimaId,
        internasP: queimaContagens.internasP,
        internasM: queimaContagens.internasM,
        internasG: queimaContagens.internasG,
        externasP: queimaContagens.externasP,
        externasM: queimaContagens.externasM,
        externasG: queimaContagens.externasG,
        saiuCheio: queimaContagens.saiuCheio,
      })
      .from(queimas)
      .leftJoin(queimaContagens, eq(queimaContagens.queimaId, queimas.id))
      .where(eq(queimas.id, queimaId))
      .for("no key update", { of: queimas }),
  );
  if (!linha) {
    return null;
  }

  const contagem: Contagem | null =
    linha.contagemDe === null
      ? null
      : {
          internasP: linha.internasP ?? 0,
          internasM: linha.internasM ?? 0,
          internasG: linha.internasG ?? 0,
          externasP: linha.externasP ?? 0,
          externasM: linha.externasM ?? 0,
          externasG: linha.externasG ?? 0,
          saiuCheio: linha.saiuCheio ?? true,
        };

  // Depois da trava, noutra instrução (CR-01): as vendas ligadas e a situação de cada uma — LIDAS,
  // nunca travadas (as Queimas não travam documento existente, como a Agenda).
  const ligadas = await tx
    .select({
      documentoId: queimaVendas.documentoId,
      numero: documentos.numero,
      canceladoEm: documentos.canceladoEm,
      quantidadeP: queimaVendas.quantidadeP,
      quantidadeM: queimaVendas.quantidadeM,
      quantidadeG: queimaVendas.quantidadeG,
    })
    .from(queimaVendas)
    .innerJoin(documentos, eq(documentos.id, queimaVendas.documentoId))
    .where(eq(queimaVendas.queimaId, queimaId))
    .orderBy(asc(documentos.numero));

  const emAbertoPorVenda = new Map<string, number>();
  if (ligadas.length > 0) {
    const contagens = await tx
      .select({ documentoId: parcelas.documentoId, emAberto: count() })
      .from(parcelas)
      .where(
        and(
          inArray(
            parcelas.documentoId,
            ligadas.map((venda) => venda.documentoId),
          ),
          isNull(parcelas.pagoEm),
        ),
      )
      .groupBy(parcelas.documentoId);
    for (const linhaDeParcela of contagens) {
      emAbertoPorVenda.set(linhaDeParcela.documentoId, Number(linhaDeParcela.emAberto));
    }
  }

  const vendas: VendaLigada[] = ligadas.map((venda) => ({
    documentoId: venda.documentoId,
    numero: venda.numero,
    cancelada: venda.canceladoEm !== null,
    paga: (emAbertoPorVenda.get(venda.documentoId) ?? 0) === 0,
    quantidades: { p: venda.quantidadeP, m: venda.quantidadeM, g: venda.quantidadeG },
  }));

  return {
    id: linha.id,
    fornoId: linha.fornoId,
    tipo: linha.tipo,
    ocorridaEm: linha.ocorridaEm.toISOString(),
    contagem,
    vendas,
  };
}

// Grava (cria ou corrige) a contagem de uma queima, sob a trava da queima. Recusa (nada gravado):
// queima que sumiu → `FRASE_QUEIMA_DESFEITA_NADA_CONTADO`; externas abaixo do já lançado em vendas
// ativas (D-07) → a frase do piso, com o lançado naquele tamanho e as vendas ativas que o têm.
// `criada` = a trava não achou contagem (a tela diz "salva" × "corrigida").
//
// 06.4-WR-01 (quick 261005-2yu): `esperada` é a contagem com que a folha abriu (`null` = abriu sem).
// Se a gravada AGORA é outra — alguém salvou ou apagou no meio —, recusa com `fraseContagemMudou` e
// `telaMudou`, ANTES do piso: salvar por cima apagaria o dele em silêncio. A folha passa a esperar a
// contagem atual; salvar de novo grava de propósito.
export async function gravarContagem(
  tx: TransacaoDoBanco,
  queimaId: string,
  contagem: Contagem,
  esperada: Contagem | null,
  contadoPor: string,
): Promise<{ criada: boolean }> {
  const travada = await travarContagem(tx, queimaId);
  if (travada === null) {
    throw new RecusaDasQueimas(FRASE_QUEIMA_DESFEITA_NADA_CONTADO);
  }
  if (contagemMudou(travada.contagem, esperada)) {
    throw new RecusaDasQueimas(fraseContagemMudou(travada.contagem), {
      telaMudou: true,
      contagemAtual: travada.contagem,
    });
  }

  const lancado = lancadoAtivo(travada.vendas);
  const tamanho = abaixoDoLancado(externasDaContagem(contagem), lancado);
  if (tamanho !== null) {
    const chave = chaveDoTamanho(tamanho);
    const numerosDasVendas = travada.vendas
      .filter((venda) => !venda.cancelada && venda.quantidades[chave] > 0)
      .map((venda) => venda.numero);
    throw new RecusaDasQueimas(fraseAbaixoDoLancado(tamanho, lancado[chave], numerosDasVendas));
  }

  const numeros = {
    internasP: contagem.internasP,
    internasM: contagem.internasM,
    internasG: contagem.internasG,
    externasP: contagem.externasP,
    externasM: contagem.externasM,
    externasG: contagem.externasG,
    saiuCheio: contagem.saiuCheio,
    contadoPor,
  };
  // Uma linha por queima: a PK é `queima_id`, e salvar de novo corrige a mesma linha (o gatilho
  // `tocar_atualizado_em_queima_contagens` atualiza `atualizado_em`).
  await tx
    .insert(queimaContagens)
    .values({ queimaId, ...numeros })
    .onConflictDoUpdate({ target: queimaContagens.queimaId, set: numeros });

  return { criada: travada.contagem === null };
}

// Apaga a contagem de uma queima (plano 02, UI-D6), sob a trava da queima. Recusa (nada apagado):
// queima que sumiu → `FRASE_QUEIMA_DESFEITA_NADA_CONTADO`; peça lançada em venda ATIVA (D-07) →
// `fraseApagarComVendas` com os números das vendas ativas — o cascade levaria os vínculos e as vendas
// ficariam no Caixa sem dizer de onde vieram. Sem contagem a apagar → nada a fazer (o estado pedido já
// vale; `apagou = false`). Vendas só CANCELADAS não impedem: o cascade leva os vínculos cancelados junto
// e as vendas continuam no Caixa, canceladas (decidido sem o dono, revisão do checker, 04/10/2026).
//
// 06.4-WR-01 (quick 261005-2yu): `esperada` é a contagem que a folha mostrou. Sem contagem a apagar
// continua idempotente (primeiro); se a gravada é OUTRA, a recusa da tela velha (`telaMudou`); só
// depois a recusa das vendas.
export async function apagarContagemNaTransacao(
  tx: TransacaoDoBanco,
  queimaId: string,
  esperada: Contagem,
): Promise<{ apagou: boolean }> {
  const travada = await travarContagem(tx, queimaId);
  if (travada === null) {
    throw new RecusaDasQueimas(FRASE_QUEIMA_DESFEITA_NADA_CONTADO);
  }
  if (travada.contagem === null) {
    return { apagou: false };
  }
  if (contagemMudou(travada.contagem, esperada)) {
    throw new RecusaDasQueimas(fraseContagemMudou(travada.contagem), {
      telaMudou: true,
      contagemAtual: travada.contagem,
    });
  }
  if (totalDasQuantidades(lancadoAtivo(travada.vendas)) > 0) {
    const numeros = travada.vendas.filter((venda) => !venda.cancelada).map((venda) => venda.numero);
    throw new RecusaDasQueimas(fraseApagarComVendas(numeros));
  }
  await tx.delete(queimaContagens).where(eq(queimaContagens.queimaId, queimaId));
  return { apagou: true };
}

// ---------------------------------------------------------------------------------------------
// Fase 06.4, plano 04 — o "Recebi agora" das externas (QMC-08; D-07). O corpo da Server Action
// `receberQueimaAgora` DENTRO da transação, separado para a prova de corrida
// (`scripts/provar-corridas-das-queimas.ts`) chamar o MESMO código sem sessão.
//
// Sob a trava da QUEIMA (`travarContagem`, CR-01: contagem e vendas relidas depois da trava), decide
// pelo que FALTA naquele instante — nunca pelo que a tela mostrou: queima/contagem sumida ou sem
// externas → `FRASE_SAIU_DE_A_COBRAR`; nada falta → `fraseTudoJaLancado` (as vendas ativas); algum
// tamanho pedido acima do que falta → `fraseSoFaltam` (o que falta agora). Os preços e as linhas são
// do BANCO, lidos depois da trava (mudar o preço depois não muda esta venda — ela congela o valor ao
// nascer); preço faltando (nulo ou ≤ 0) num tamanho PEDIDO → a frase do preço. A pessoa (opcional —
// decisão do dono de 04/10/2026, UI-D13 revista) é um cadastro de `clientes`: o NOME vem do banco e
// fica congelado em `pessoa_nome`, com o vínculo `cliente_id` — o mesmo par que a Agenda grava.
//
// A venda nasce JÁ PAGA, hoje (uma parcela paga na forma tocada), pelo escritor único do Financeiro
// (`gravarVenda`), e o vínculo com as quantidades entra em `queima_vendas` na MESMA transação.
export type PedidoDeCobrancaDaQueima = {
  queimaId: string;
  forma: FormaDePagamento;
  quantidades: Quantidades;
  // `null` = venda sem pessoa.
  clienteId: string | null;
  // As vendas ATIVAS que a folha mostrou ao abrir — congeladas (06.4-WR-02, quick 261005-2yu).
  vendasVistas: readonly number[];
  hoje: string;
  registradoPor: string;
  taxaCartaoPontosBase: number;
  dataSaldoInicial: string | null;
};

export async function cobrarQueimaNaTransacao(
  tx: TransacaoDoBanco,
  pedido: PedidoDeCobrancaDaQueima,
): Promise<{ documentoId: string; numero: number }> {
  const travada = await travarContagem(tx, pedido.queimaId);
  if (travada === null || travada.contagem === null) {
    throw new RecusaDasQueimas(FRASE_SAIU_DE_A_COBRAR);
  }
  const externas = externasDaContagem(travada.contagem);
  if (totalDasQuantidades(externas) === 0) {
    throw new RecusaDasQueimas(FRASE_SAIU_DE_A_COBRAR);
  }
  const falta = faltaCobrar(externas, lancadoAtivo(travada.vendas));
  if (totalDasQuantidades(falta) === 0) {
    throw new RecusaDasQueimas(
      fraseTudoJaLancado(
        travada.vendas.filter((venda) => !venda.cancelada).map((venda) => venda.numero),
      ),
    );
  }
  // 06.4-WR-02 (quick 261005-2yu): DEPOIS de "nada falta" (que já fecha a folha com a frase de sempre) e
  // ANTES de conferir o que cabe — a queima ganhou (ou perdeu) venda ativa desde que a folha abriu? Um
  // novo toque depois de uma resposta perdida vê a venda que já entrou e é recusado: nunca uma segunda
  // venda paga das mesmas peças. A folha congela as vistas ao abrir; a tela é relida.
  if (vendasAtivasMudaram(travada.vendas, pedido.vendasVistas)) {
    const vistas = new Set(pedido.vendasVistas);
    const novas = numerosDasVendasAtivas(travada.vendas).filter((numero) => !vistas.has(numero));
    throw new RecusaDasQueimas(fraseVendasMudaram(novas), { telaMudou: true });
  }
  if (!cabeNoQueFalta(pedido.quantidades, falta)) {
    throw new RecusaDasQueimas(fraseSoFaltam(resumoPmg(falta.p, falta.m, falta.g)));
  }

  // Depois da trava: os itens e os preços de AGORA (nenhum preço no código, nenhum do navegador).
  const itens = await obterItensDasQueimas(tx);
  const { valorCentavos: totalCentavos, tamanhosSemPreco } = valorDasExternas(
    pedido.quantidades,
    precosDosItens(itens),
  );
  if (totalCentavos === null) {
    throw new RecusaDasQueimas(
      fraseSemPrecoDaQueima(tamanhosSemPreco, {
        P: itens.P.nome,
        M: itens.M.nome,
        G: itens.G.nome,
      }),
    );
  }

  const linhas: LinhaDoPedidoDeVenda[] = [];
  for (const tamanho of ["P", "M", "G"] as const) {
    const quantidade = pedido.quantidades[chaveDoTamanho(tamanho)];
    if (quantidade <= 0) {
      continue;
    }
    const item = itens[tamanho];
    linhas.push({
      tipo: "item",
      itemId: item.id,
      descricao: item.nome,
      categoriaId: item.categoriaVendaId,
      quantidade,
      // `valorDasExternas` já recusou preço nulo ou ≤ 0 num tamanho pedido.
      valorCentavos: quantidade * (item.precoVendaCentavos ?? 0),
    });
  }

  const parcela = {
    vencimento: pedido.hoje,
    valorCentavos: totalCentavos,
    forma: pedido.forma,
    pago: true,
  };
  // A mesma conferência da Venda manual (soma, teto, data do saldo inicial) — com a frase dela.
  const conferencia = conferirParcelas({
    totalCentavos,
    parcelas: [parcela],
    hoje: pedido.hoje,
    dataSaldoInicial: pedido.dataSaldoInicial,
  });
  if (!conferencia.ok) {
    throw new RecusaDasQueimas(conferencia.erro);
  }

  let pessoaNome: string | null = null;
  if (pedido.clienteId !== null) {
    const [pessoa] = await tx
      .select({ nome: clientes.nome })
      .from(clientes)
      .where(eq(clientes.id, pedido.clienteId));
    if (!pessoa) {
      throw new RecusaDasQueimas(FRASE_PESSOA_SUMIU);
    }
    pessoaNome = pessoa.nome;
  }

  const venda = await gravarVenda(
    tx,
    {
      data: pedido.hoje,
      pessoaNome,
      clienteId: pedido.clienteId,
      linhas,
      parcelas: [parcela],
    },
    { registradoPor: pedido.registradoPor, taxaCartaoPontosBase: pedido.taxaCartaoPontosBase },
  );
  await tx.insert(queimaVendas).values({
    documentoId: venda.id,
    queimaId: pedido.queimaId,
    quantidadeP: pedido.quantidades.p,
    quantidadeM: pedido.quantidades.m,
    quantidadeG: pedido.quantidades.g,
    lancadoPor: pedido.registradoPor,
  });
  return { documentoId: venda.id, numero: venda.numero };
}

// ---------------------------------------------------------------------------------------------
// Quick 261005-2yu (05/10/2026), 06.4-WR-03 — excluir a queima SOB A TRAVA. O "Desfazer" do registro e a
// exclusão confirmada do Histórico mandam os números das vendas ativas que a confirmação mostrou
// (`vendasVistas`; o "Desfazer" manda `[]`). Se as ativas de AGORA são outras — uma venda entrou depois
// de a página carregar —, recusa com `fraseExclusaoComVendasNovas` e `telaMudou`: o cascade levaria o
// vínculo e a venda ficaria no Caixa sem dizer de onde veio. Senão, o `delete` na MESMA transação (o
// cascade leva contagem e vínculos; as vendas continuam no Caixa).
export async function excluirQueimaNaTransacao(
  tx: TransacaoDoBanco,
  queimaId: string,
  vendasVistas: readonly number[],
): Promise<{ id: string }> {
  const travada = await travarContagem(tx, queimaId);
  if (travada === null) {
    throw new RecusaDasQueimas("Essa queima não existe mais.");
  }
  if (vendasAtivasMudaram(travada.vendas, vendasVistas)) {
    throw new RecusaDasQueimas(fraseExclusaoComVendasNovas(numerosDasVendasAtivas(travada.vendas)), {
      telaMudou: true,
    });
  }
  await tx.delete(queimas).where(eq(queimas.id, queimaId));
  return { id: queimaId };
}

// ---------------------------------------------------------------------------------------------
// Fase 06.4, plano 05 — a metade das Queimas do “Lançar na Venda” (QMC-08; D-07, decisão do dono de
// 04/10/2026: várias vendas por queima, uma por pessoa). Chamada por `lancarVenda`
// (`lib/financeiro/acoes.ts`) DENTRO da transação e ANTES de `gravarVenda` — a ordem de travas das
// Queimas: QUEIMA → (leitura dos vínculos) → (documento novo) → ITENS → (vínculo novo). Molde
// `vincularCobranca` da Agenda, com três diferenças: a pessoa NÃO é sobrescrita (a queima externa não
// tem cliente — quem escreve é o dono, no campo livre da Venda); a origem não vira UMA venda, ela cede
// o que FALTA, por tamanho; e as quantidades do vínculo são as das LINHAS da venda que vai ser gravada.
//
// Sob a trava da queima (`travarContagem`, a MESMA do “Recebi agora”), com as MESMAS regras puras
// (`faltaCobrar`, `cabeNoQueFalta`, `quantidadesDasLinhas`): somados, os dois caminhos nunca passam das
// externas em nenhum tamanho. Recusas (nada gravado): queima/contagem sumida ou sem externas →
// `FRASE_ORIGEM_QUEIMA_NAO_ACHADA`; nada falta → `fraseOrigemQueimaTudoLancado` (as vendas ativas);
// as vendas ativas de agora não são as que a Venda viu ao abrir (`vendasVistas`) →
// `fraseVendasMudaramNaVenda` com `telaMudou` (quick 261008-pmi, auditoria 08/10 aviso 1); nenhuma
// linha dos três itens → `FRASE_LINHA_DA_QUEIMA_FALTANDO`; algum tamanho acima do que falta →
// `fraseAcimaDoQueFaltaNaVenda` (o que falta agora).
export type VinculoDaQueimaNaVenda = {
  // O id de cada um dos três itens “Queima externa P/M/G”, lidos pela chave depois da trava.
  itensPorTamanho: Record<"P" | "M" | "G", string>;
  itensDaQueima: string[];
  // As quantidades do vínculo, tiradas das linhas da venda (somadas por tamanho) e conferidas contra o
  // que falta AGORA — ou a recusa com a frase da tela.
  conferir: (linhas: readonly LinhaParaQuantidades[]) => Quantidades;
  // O vínculo venda → queima com as quantidades, na MESMA transação, DEPOIS de `gravarVenda`.
  gravar: (documentoId: string, quantidades: Quantidades, lancadoPor: string) => Promise<void>;
};

export async function vincularQueimaNaVenda(
  tx: TransacaoDoBanco,
  queimaId: string,
  // As vendas ATIVAS da queima que a página da Venda leu ao abrir (quick 261008-pmi).
  vendasVistas: readonly number[],
): Promise<VinculoDaQueimaNaVenda> {
  const travada = await travarContagem(tx, queimaId);
  if (travada === null || travada.contagem === null) {
    throw new RecusaDasQueimas(FRASE_ORIGEM_QUEIMA_NAO_ACHADA);
  }
  const externas = externasDaContagem(travada.contagem);
  if (totalDasQuantidades(externas) === 0) {
    throw new RecusaDasQueimas(FRASE_ORIGEM_QUEIMA_NAO_ACHADA);
  }
  const falta = faltaCobrar(externas, lancadoAtivo(travada.vendas));
  if (totalDasQuantidades(falta) === 0) {
    throw new RecusaDasQueimas(
      fraseOrigemQueimaTudoLancado(
        travada.vendas.filter((venda) => !venda.cancelada).map((venda) => venda.numero),
      ),
    );
  }
  // Quick 261008-pmi (08/10/2026), auditoria 08/10 — Queimas, aviso 1. A mesma conferência do "Recebi
  // agora" (`cobrarQueimaNaTransacao`), no mesmo lugar: DEPOIS de "nada falta" e ANTES de conferir o que
  // cabe. A queima ganhou (ou perdeu) venda ativa desde que esta Venda abriu? Um segundo "Lançar venda"
  // depois de uma resposta perdida vê a venda que o primeiro gravou e é recusado — nunca uma segunda
  // venda das mesmas peças. A Venda não relê a página numa falha de rede, então o retrato é o da abertura.
  if (vendasAtivasMudaram(travada.vendas, vendasVistas)) {
    const vistas = new Set(vendasVistas);
    const novas = numerosDasVendasAtivas(travada.vendas).filter((numero) => !vistas.has(numero));
    throw new RecusaDasQueimas(fraseVendasMudaramNaVenda(novas), { telaMudou: true });
  }

  const itens = await obterItensDasQueimas(tx);
  const itensPorTamanho = { P: itens.P.id, M: itens.M.id, G: itens.G.id };

  return {
    itensPorTamanho,
    itensDaQueima: [itens.P.id, itens.M.id, itens.G.id],
    conferir: (linhas) => {
      const quantidades = quantidadesDasLinhas(linhas, itensPorTamanho);
      if (totalDasQuantidades(quantidades) === 0) {
        throw new RecusaDasQueimas(FRASE_LINHA_DA_QUEIMA_FALTANDO);
      }
      if (!cabeNoQueFalta(quantidades, falta)) {
        throw new RecusaDasQueimas(fraseAcimaDoQueFaltaNaVenda(resumoPmg(falta.p, falta.m, falta.g)));
      }
      return quantidades;
    },
    gravar: async (documentoId, quantidades, lancadoPor) => {
      await tx.insert(queimaVendas).values({
        documentoId,
        queimaId,
        quantidadeP: quantidades.p,
        quantidadeM: quantidades.m,
        quantidadeG: quantidades.g,
        lancadoPor,
      });
    },
  };
}

// Leituras da Produção (Fase 06.1) — sem diretiva: nada aqui é Server Action (quem chama é Server
// Component ou ação que já autorizou). Molde "consulta principal + filhos casados por `Map`" de
// `lib/estoque/consultas.ts`. As regras (etapa atual, dias, selo, colunas) moram no módulo puro;
// estas funções só carregam o que ele precisa.
import { and, asc, count, eq, inArray, isNotNull, notExists, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  documentos,
  fichasPrecificacao,
  itensCatalogo,
  movimentacoesEstoque,
  orcamentoFotos,
  orcamentos,
  ordemEtapas,
  ordemPecas,
  ordensProducao,
  parcelas,
  usuarios,
} from "@/db/schema";
import { numeroDeOrcamento } from "@/lib/orcamentos/formato";
import { parametrosVigentes } from "@/lib/precificacao/consultas";
import { quantasCabem } from "@/lib/precificacao/forno";

import type { CaminhoOrdem, StatusOrdem, TipoOrdem } from "./etapas";
import type { CabemDaFicha, PecaEmResumo } from "./forno";
import type { EtapaDaOrdem, OrdemParaLeitura } from "./leitura";

export type PecaDaOrdem = {
  id: string;
  posicao: number;
  descricao: string;
  quantidade: number;
  aMais: number;
  cor: string | null;
  personalizacao: string | null;
  // A ficha é referência, não cópia (Modelo de dados da pesquisa): `exclusiva` e as horas são
  // lidas AO VIVO pela `ficha_id` — nulos quando a peça não tem ficha.
  fichaId: string | null;
  exclusiva: boolean | null;
  // Horas de UMA peça, em milésimos (a escala da ficha). Só a página da ordem lê (PRD-05).
  horasMilesimos: number | null;
};

// De onde a ordem veio (PRD-10): o orçamento aprovado que a abriu e a venda que ele gerou. `null`
// para ordem sem orçamento (produção da casa, pedido de boca). Só ids e números — nenhum caminho.
export type OrigemDaOrdem = {
  orcamentoId: string;
  orcamentoNumero: string;
  // `null` só se o orçamento não tiver venda (não acontece com orçamento aprovado; defensivo).
  documentoNumero: number | null;
  // A parcela 1 da venda (a do sinal) — o destino do link "venda nº {M}" no Caixa.
  parcelaDoSinalId: string | null;
  // A venda foi cancelada no Caixa (`documentos.cancelado_em`) — D-07, derivado na LEITURA: a
  // ordem liberada não muda no banco quando a venda cai.
  documentoCancelado: boolean;
};

export type OrdemEmAndamento = OrdemParaLeitura & {
  id: string;
  numero: number;
  nome: string;
  clienteNome: string | null;
  tipo: TipoOrdem;
  caminho: CaminhoOrdem;
  status: StatusOrdem;
  etapas: EtapaDaOrdem[];
  // Pedido e a mais somados por ordem — o "{n} peças + {m} a mais" do cartão.
  totalPecas: number;
  totalAMais: number;
  // As peças no que a fila do forno precisa (plano 08, PRD-13): a ficha e as feitas de cada uma.
  pecasEmResumo: PecaEmResumo[];
  // A venda do orçamento que abriu a ordem foi cancelada no Caixa (D-07) — derivado na LEITURA
  // (ordem → `orcamentos` → `documentos.cancelado_em`): a ordem liberada não muda no banco quando a
  // venda cai; o cartão mostra o chip "venda cancelada" (UI-D19) e o dono decide.
  vendaCancelada: boolean;
};

// O sinal da ordem vinda de orçamento (plano 03, PRD-11): a parcela `numero = 1` da venda criada
// na aprovação — em todos os planos ("sinal", "avista", "3x") a aprovação grava a parcela da
// aprovação como a primeira (`lib/orcamentos/acoes.ts`, suposição A6 da pesquisa). "Consta como
// recebido" = `pago_em` preenchido. SÓ LEITURA: a Produção nunca escreve em `parcelas` nem em
// `documentos` (briefing §3; T-06.1-13) — receber o sinal no Caixa não libera a ordem sozinho.
export type SinalDaOrdem = {
  plano: (typeof orcamentos.plano.enumValues)[number];
  parcelaId: string;
  // `YYYY-MM-DD` ou `null` quando ainda não consta como recebida.
  recebidoEm: string | null;
};

export type OrdemCarregada = OrdemEmAndamento & {
  pecas: PecaDaOrdem[];
  // Os ids de `orcamento_fotos` do orçamento ligado, na ordem do orçamento — a foto sai só pela
  // rota autenticada `/gestao/api/orcamentos/fotos/{id}`; nenhum arquivo é copiado (briefing §3).
  fotos: string[];
  origem: OrigemDaOrdem | null;
  // `null` para ordem sem orçamento (produção da casa, pedido de boca) ou orçamento sem venda.
  sinal: SinalDaOrdem | null;
  // Plano 06 (PRD-18, D-07) — o que a confirmação de cancelar e o resultado da cancelada dizem.
  // Quantas baixas de material o livro do Estoque tem ligadas a esta ordem (saída manual "consumo
  // em encomenda") — cancelar NÃO as devolve.
  baixasFeitas: number;
  // O número da venda do orçamento que abriu a ordem (`null` sem orçamento ou sem venda). Se ela já
  // foi cancelada no Caixa, é o `vendaCancelada` de `OrdemEmAndamento`.
  vendaNumero: number | null;
  canceladaEm: Date | null;
  // O nome de quem cancelou, lido por junção com `usuarios`; `null` na ordem não cancelada.
  canceladaPorNome: string | null;
  canceladaPelaVenda: boolean;
};

const COLUNAS_DA_ORDEM = {
  id: ordensProducao.id,
  numero: ordensProducao.numero,
  nome: ordensProducao.nome,
  tipo: ordensProducao.tipo,
  caminho: ordensProducao.caminho,
  status: ordensProducao.status,
  clienteNome: ordensProducao.clienteNome,
  entregaPrometida: ordensProducao.entregaPrometida,
  inicio: ordensProducao.inicio,
};

const COLUNAS_DA_ETAPA = {
  ordemId: ordemEtapas.ordemId,
  etapa: ordemEtapas.etapa,
  posicao: ordemEtapas.posicao,
  diasPrevistos: ordemEtapas.diasPrevistos,
  feitaEm: ordemEtapas.feitaEm,
  passaram: ordemEtapas.passaram,
};

const COLUNAS_DA_PECA = {
  id: ordemPecas.id,
  ordemId: ordemPecas.ordemId,
  posicao: ordemPecas.posicao,
  descricao: ordemPecas.descricao,
  quantidade: ordemPecas.quantidade,
  aMais: ordemPecas.aMais,
  cor: ordemPecas.cor,
  personalizacao: ordemPecas.personalizacao,
  fichaId: ordemPecas.fichaId,
  exclusiva: fichasPrecificacao.exclusiva,
  horasMilesimos: fichasPrecificacao.horasMilesimos,
};

function agruparPorOrdem<T extends { ordemId: string }>(linhas: readonly T[]): Map<string, T[]> {
  const porOrdem = new Map<string, T[]>();
  for (const linha of linhas) {
    const lista = porOrdem.get(linha.ordemId);
    if (lista) {
      lista.push(linha);
    } else {
      porOrdem.set(linha.ordemId, [linha]);
    }
  }
  return porOrdem;
}

function semOrdemId<T extends { ordemId: string }>(linha: T): Omit<T, "ordemId"> {
  const { ordemId: _ordemId, ...resto } = linha;
  void _ordemId;
  return resto;
}

// As ordens aguardando o sinal ou ativas, com as etapas (por posição) e o total de peças. As
// aguardando só aparecem na seção própria (plano 03); o quadro usa as ativas.
export async function listarOrdensEmAndamento(): Promise<OrdemEmAndamento[]> {
  const ordens = await db
    .select(COLUNAS_DA_ORDEM)
    .from(ordensProducao)
    .where(inArray(ordensProducao.status, ["aguardando_sinal", "ativa"]))
    .orderBy(asc(ordensProducao.numero));
  if (ordens.length === 0) {
    return [];
  }
  const ids = ordens.map((ordem) => ordem.id);
  const [etapas, pecas, vendasCanceladas] = await Promise.all([
    db
      .select(COLUNAS_DA_ETAPA)
      .from(ordemEtapas)
      .where(inArray(ordemEtapas.ordemId, ids))
      .orderBy(asc(ordemEtapas.ordemId), asc(ordemEtapas.posicao)),
    db
      .select({
        ordemId: ordemPecas.ordemId,
        fichaId: ordemPecas.fichaId,
        quantidade: ordemPecas.quantidade,
        aMais: ordemPecas.aMais,
      })
      .from(ordemPecas)
      .where(inArray(ordemPecas.ordemId, ids))
      .orderBy(asc(ordemPecas.ordemId), asc(ordemPecas.posicao)),
    // As ordens destas cuja venda (a do orçamento que as abriu) já foi cancelada no Caixa.
    db
      .select({ ordemId: orcamentos.encomendaId })
      .from(orcamentos)
      .innerJoin(documentos, eq(documentos.id, orcamentos.documentoId))
      .where(and(inArray(orcamentos.encomendaId, ids), isNotNull(documentos.canceladoEm))),
  ]);
  const etapasPorOrdem = agruparPorOrdem(etapas);
  const pecasPorOrdem = agruparPorOrdem(pecas);
  const comVendaCancelada = new Set(vendasCanceladas.map((linha) => linha.ordemId));

  return ordens.map((ordem) => {
    const pecasDaOrdem = pecasPorOrdem.get(ordem.id) ?? [];
    return {
      ...ordem,
      etapas: (etapasPorOrdem.get(ordem.id) ?? []).map(semOrdemId),
      totalPecas: pecasDaOrdem.reduce((total, peca) => total + peca.quantidade, 0),
      totalAMais: pecasDaOrdem.reduce((total, peca) => total + peca.aMais, 0),
      pecasEmResumo: pecasDaOrdem.map(semOrdemId),
      vendaCancelada: comVendaCancelada.has(ordem.id),
    };
  });
}

// Um id que não tem a forma de um uuid nunca chega ao banco (o Postgres responderia 22P02 e a
// página cairia no erro de carregamento em vez do 404) — id malformado e id que nunca existiu
// respondem igual: `null`.
const FORMA_DE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A ordem inteira (qualquer status), com etapas e peças por posição; `null` se não existe.
export async function obterOrdem(id: string): Promise<OrdemCarregada | null> {
  if (!FORMA_DE_UUID.test(id)) {
    return null;
  }
  const [linha] = await db
    .select({
      ...COLUNAS_DA_ORDEM,
      canceladaEm: ordensProducao.canceladaEm,
      canceladaPelaVenda: ordensProducao.canceladaPelaVenda,
      canceladaPorNome: usuarios.nome,
    })
    .from(ordensProducao)
    .leftJoin(usuarios, eq(usuarios.id, ordensProducao.canceladaPor))
    .where(eq(ordensProducao.id, id))
    .limit(1);
  if (!linha) {
    return null;
  }
  const { canceladaEm, canceladaPelaVenda, canceladaPorNome, ...ordem } = linha;
  const [etapas, pecas, sinal, origem, fotos, baixasFeitas] = await Promise.all([
    db
      .select(COLUNAS_DA_ETAPA)
      .from(ordemEtapas)
      .where(eq(ordemEtapas.ordemId, id))
      .orderBy(asc(ordemEtapas.posicao)),
    db
      .select(COLUNAS_DA_PECA)
      .from(ordemPecas)
      .leftJoin(fichasPrecificacao, eq(fichasPrecificacao.id, ordemPecas.fichaId))
      .where(eq(ordemPecas.ordemId, id))
      .orderBy(asc(ordemPecas.posicao)),
    sinalDaOrdem(id),
    origemDaOrdem(id),
    fotosDaOrdem(id),
    baixasDaOrdem(id),
  ]);
  return {
    ...ordem,
    etapas: etapas.map(semOrdemId),
    pecas: pecas.map(semOrdemId),
    sinal,
    origem,
    fotos,
    baixasFeitas,
    vendaNumero: origem?.documentoNumero ?? null,
    vendaCancelada: origem?.documentoCancelado ?? false,
    canceladaEm,
    canceladaPorNome,
    canceladaPelaVenda,
    totalPecas: pecas.reduce((total, peca) => total + peca.quantidade, 0),
    totalAMais: pecas.reduce((total, peca) => total + peca.aMais, 0),
    pecasEmResumo: pecas.map((peca) => ({
      fichaId: peca.fichaId,
      quantidade: peca.quantidade,
      aMais: peca.aMais,
    })),
  };
}

// Quanto cabe no forno por ficha (plano 08, PRD-13) — o "cabem" que a fila do forno divide. Uma
// conta só (T-06.1-33): `parametrosVigentes(hoje)` UMA vez e `quantasCabem` da Precificação por
// ficha, com os dois "já contei" — o mesmo número que a Precificação mostra (molde de
// `custosDasPecasProntas`, lib/estoque/consultas.ts). Fica FORA do mapa, e a peça conta como "sem
// estimativa": parâmetro faltando (nunca um zero inventado) e ficha apagada. Ficha sem medida
// (algum lado 0 — a ficha recém-criada é válida, mas inútil) e sem o "já contei" daquela queima
// entra com 0 naquela queima, que o módulo puro trata como "sem estimativa". `hoje` chega por
// argumento: este módulo não lê o relógio.
export async function cabemPorFicha(
  fichaIds: readonly string[],
  hoje: string,
): Promise<Map<string, CabemDaFicha>> {
  const mapa = new Map<string, CabemDaFicha>();
  const unicos = [...new Set(fichaIds)];
  if (unicos.length === 0) {
    return mapa;
  }
  const [fichas, parametros] = await Promise.all([
    db
      .select({
        id: fichasPrecificacao.id,
        larguraMm: fichasPrecificacao.larguraMm,
        profundidadeMm: fichasPrecificacao.profundidadeMm,
        alturaMm: fichasPrecificacao.alturaMm,
        cabemBiscoitoInformado: fichasPrecificacao.cabemBiscoitoInformado,
        cabemEsmalteInformado: fichasPrecificacao.cabemEsmalteInformado,
      })
      .from(fichasPrecificacao)
      .where(inArray(fichasPrecificacao.id, unicos)),
    parametrosVigentes(hoje),
  ]);
  if (!parametros.ok) {
    return mapa;
  }
  for (const ficha of fichas) {
    const cabem = quantasCabem(
      { larguraMm: ficha.larguraMm, profundidadeMm: ficha.profundidadeMm, alturaMm: ficha.alturaMm },
      parametros.forno,
      { biscoito: ficha.cabemBiscoitoInformado, esmalte: ficha.cabemEsmalteInformado },
    );
    const comMedida = ficha.larguraMm > 0 && ficha.profundidadeMm > 0 && ficha.alturaMm > 0;
    mapa.set(ficha.id, {
      cabe: cabem.cabe,
      biscoito: comMedida || !cabem.biscoitoAutomatico ? cabem.biscoito : 0,
      esmalte: comMedida || !cabem.esmalteAutomatico ? cabem.esmalte : 0,
    });
  }
  return mapa;
}

// A leitura do sinal no Caixa: ordem → `orcamentos.encomenda_id` → `orcamentos.documento_id` →
// `parcelas` (`numero = 1`). Só `select`, sem trava. `null` quando a ordem não veio de orçamento
// aprovado com venda.
export async function sinalDaOrdem(ordemId: string): Promise<SinalDaOrdem | null> {
  const [linha] = await db
    .select({
      plano: orcamentos.plano,
      parcelaId: parcelas.id,
      recebidoEm: parcelas.pagoEm,
    })
    .from(orcamentos)
    .innerJoin(
      parcelas,
      and(eq(parcelas.documentoId, orcamentos.documentoId), eq(parcelas.numero, 1)),
    )
    .where(eq(orcamentos.encomendaId, ordemId))
    .limit(1);
  return linha ?? null;
}

// A origem da ordem (PRD-10): ordem → `orcamentos.encomenda_id` (único — um orçamento aponta para no
// máximo uma ordem) → o número do orçamento, o da venda (`documentos.numero`) e a parcela 1 dela.
// Só `select`.
export async function origemDaOrdem(ordemId: string): Promise<OrigemDaOrdem | null> {
  const [linha] = await db
    .select({
      orcamentoId: orcamentos.id,
      ano: orcamentos.ano,
      sequencial: orcamentos.sequencial,
      documentoNumero: documentos.numero,
      documentoCanceladoEm: documentos.canceladoEm,
      parcelaDoSinalId: parcelas.id,
    })
    .from(orcamentos)
    .leftJoin(documentos, eq(documentos.id, orcamentos.documentoId))
    .leftJoin(
      parcelas,
      and(eq(parcelas.documentoId, orcamentos.documentoId), eq(parcelas.numero, 1)),
    )
    .where(eq(orcamentos.encomendaId, ordemId))
    .limit(1);
  if (!linha) {
    return null;
  }
  return {
    orcamentoId: linha.orcamentoId,
    orcamentoNumero: numeroDeOrcamento(linha.ano, linha.sequencial),
    documentoNumero: linha.documentoNumero,
    parcelaDoSinalId: linha.parcelaDoSinalId,
    documentoCancelado: linha.documentoCanceladoEm !== null,
  };
}

// Quantas baixas de material o livro do Estoque tem ligadas à ordem: a saída manual "consumo em
// encomenda" com `encomenda_id` = a ordem (o nome da coluna é histórico — aponta para a ordem desde
// a 0024). Só `select`. É o "{N}" da confirmação de cancelar: essas baixas não voltam sozinhas.
export async function baixasDaOrdem(ordemId: string): Promise<number> {
  const [linha] = await db
    .select({ quantas: count() })
    .from(movimentacoesEstoque)
    .where(
      and(eq(movimentacoesEstoque.encomendaId, ordemId), eq(movimentacoesEstoque.origem, "manual")),
    );
  return Number(linha?.quantas ?? 0);
}

// As fotos de referência do orçamento que abriu a ordem — SÓ os ids das linhas de
// `orcamento_fotos`, na `ordem` do orçamento. O nome do arquivo em disco nunca sai daqui (T-06.1-15).
export async function fotosDaOrdem(ordemId: string): Promise<string[]> {
  const linhas = await db
    .select({ id: orcamentoFotos.id })
    .from(orcamentoFotos)
    .innerJoin(orcamentos, eq(orcamentos.id, orcamentoFotos.orcamentoId))
    .where(eq(orcamentos.encomendaId, ordemId))
    .orderBy(asc(orcamentoFotos.ordem));
  return linhas.map((linha) => linha.id);
}

// O seletor de peça da "Nova ordem" (plano 07, D-04/D-05/D-13) — só `id` e `nome`, por nome:
// - `fichasDeLinha`: fichas de precificação NÃO exclusivas e com item do catálogo — "Peças de
//   linha" na encomenda, "Peças precificadas" na casa;
// - `fichasExclusivas`: "Peças exclusivas" (só na encomenda);
// - `itensDoEstoque`: itens que já controlam estoque, ativos, que não são item de nenhuma ficha de
//   linha — "Itens do estoque" (só na casa; sem ficha: sem material previsto, D-14).
// A lista é conveniência: a regra é conferida de novo no banco por `criarOrdem`.
export type OpcaoDoCatalogo = { id: string; nome: string };

export type CatalogoDaNovaOrdem = {
  fichasDeLinha: OpcaoDoCatalogo[];
  fichasExclusivas: OpcaoDoCatalogo[];
  itensDoEstoque: OpcaoDoCatalogo[];
};

export async function listarCatalogoDaNovaOrdem(): Promise<CatalogoDaNovaOrdem> {
  const [fichasDeLinha, fichasExclusivas, itensDoEstoque] = await Promise.all([
    db
      .select({ id: fichasPrecificacao.id, nome: fichasPrecificacao.nome })
      .from(fichasPrecificacao)
      .where(
        and(eq(fichasPrecificacao.exclusiva, false), isNotNull(fichasPrecificacao.itemCatalogoId)),
      )
      .orderBy(asc(fichasPrecificacao.nome), asc(fichasPrecificacao.id)),
    db
      .select({ id: fichasPrecificacao.id, nome: fichasPrecificacao.nome })
      .from(fichasPrecificacao)
      .where(eq(fichasPrecificacao.exclusiva, true))
      .orderBy(asc(fichasPrecificacao.nome), asc(fichasPrecificacao.id)),
    db
      .select({ id: itensCatalogo.id, nome: itensCatalogo.nome })
      .from(itensCatalogo)
      .where(
        and(
          eq(itensCatalogo.controlaEstoque, true),
          eq(itensCatalogo.ativo, true),
          notExists(
            db
              .select({ um: sql`1` })
              .from(fichasPrecificacao)
              .where(eq(fichasPrecificacao.itemCatalogoId, itensCatalogo.id)),
          ),
        ),
      )
      .orderBy(asc(itensCatalogo.nome), asc(itensCatalogo.id)),
  ]);
  return { fichasDeLinha, fichasExclusivas, itensDoEstoque };
}

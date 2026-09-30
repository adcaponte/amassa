// Leituras da Produção (Fase 06.1) — sem diretiva: nada aqui é Server Action (quem chama é Server
// Component ou ação que já autorizou). Molde "consulta principal + filhos casados por `Map`" de
// `lib/estoque/consultas.ts`. As regras (etapa atual, dias, selo, colunas) moram no módulo puro;
// estas funções só carregam o que ele precisa.
import { and, asc, count, desc, eq, gte, inArray, isNotNull, notExists, sql } from "drizzle-orm";

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
import type { Unidade } from "@/lib/cadastros/catalogo";
import { custosDasFichas } from "@/lib/estoque/consultas";
import { numeroDeOrcamento } from "@/lib/orcamentos/formato";
import {
  listarCategoriasDeVenda,
  parametrosVigentes,
  type CategoriaDeVenda,
} from "@/lib/precificacao/consultas";
import { quantasCabem } from "@/lib/precificacao/forno";

import type { CaminhoOrdem, StatusOrdem, TipoOrdem } from "./etapas";
import type { OrdemParaAFolha, OrdemParaAFolhaGeral } from "./folhas";
import type { CabemDaFicha, PecaEmResumo } from "./forno";
import type { TransacaoDoBanco } from "./gravacao";
import type { EtapaDaOrdem, OrdemParaLeitura } from "./leitura";
import {
  materialPrevisto,
  type MaterialDaOrdem,
  type MaterialPrevisto,
  type PecaParaPrevisto,
} from "./material";
import type { ConclusaoParaAPerda } from "./perda";

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
  // O que a conclusão gravou (plano 11) — nulos até a ordem ser concluída, preenchidos JUNTOS
  // (check `ordem_pecas_conclusao_junta`). A perda técnica e as extras sem destino ficam separadas.
  perdidas: number | null;
  paraEstoque: number | null;
  semDestino: number | null;
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
  // Plano 11 — a conclusão: o dia em que foi concluída e se foi entrega parcial.
  concluidaEm: string | null;
  entregaParcial: boolean;
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
  perdidas: ordemPecas.perdidas,
  paraEstoque: ordemPecas.paraEstoque,
  semDestino: ordemPecas.semDestino,
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
      concluidaEm: ordensProducao.concluidaEm,
      entregaParcial: ordensProducao.entregaParcial,
    })
    .from(ordensProducao)
    .leftJoin(usuarios, eq(usuarios.id, ordensProducao.canceladaPor))
    .where(eq(ordensProducao.id, id))
    .limit(1);
  if (!linha) {
    return null;
  }
  const { canceladaEm, canceladaPelaVenda, canceladaPorNome, concluidaEm, entregaParcial, ...ordem } =
    linha;
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
    concluidaEm,
    entregaParcial,
    totalPecas: pecas.reduce((total, peca) => total + peca.quantidade, 0),
    totalAMais: pecas.reduce((total, peca) => total + peca.aMais, 0),
    pecasEmResumo: pecas.map((peca) => ({
      fichaId: peca.fichaId,
      quantidade: peca.quantidade,
      aMais: peca.aMais,
    })),
  };
}

// A folha da ordem A4 (plano 13, PRD-19) — folha de BANCADA. A defesa contra dinheiro no papel é por
// construção: esta leitura seleciona SÓ as colunas que a folha usa (a ordem, as etapas, as peças com
// as gramas e as medidas da ficha, o número do orçamento e os ids das fotos). Nenhuma coluna de
// dinheiro nem de trabalho estimado entra aqui (T-06.1-49), e o tipo `OrdemParaAFolha` não as tem.
// `null` se a ordem não existe (ou o id é malformado).
export async function ordemParaAFolha(id: string): Promise<OrdemParaAFolha | null> {
  if (!FORMA_DE_UUID.test(id)) {
    return null;
  }
  const [ordem] = await db
    .select(COLUNAS_DA_ORDEM)
    .from(ordensProducao)
    .where(eq(ordensProducao.id, id))
    .limit(1);
  if (!ordem) {
    return null;
  }
  const [etapas, pecas, orcamento, fotos] = await Promise.all([
    db
      .select(COLUNAS_DA_ETAPA)
      .from(ordemEtapas)
      .where(eq(ordemEtapas.ordemId, id))
      .orderBy(asc(ordemEtapas.posicao)),
    db
      .select({
        posicao: ordemPecas.posicao,
        descricao: ordemPecas.descricao,
        quantidade: ordemPecas.quantidade,
        aMais: ordemPecas.aMais,
        cor: ordemPecas.cor,
        personalizacao: ordemPecas.personalizacao,
        fichaId: fichasPrecificacao.id,
        argilaMiligramas: fichasPrecificacao.argilaMiligramas,
        esmalteMiligramas: fichasPrecificacao.esmalteMiligramas,
        larguraMm: fichasPrecificacao.larguraMm,
        profundidadeMm: fichasPrecificacao.profundidadeMm,
        alturaMm: fichasPrecificacao.alturaMm,
      })
      .from(ordemPecas)
      .leftJoin(fichasPrecificacao, eq(fichasPrecificacao.id, ordemPecas.fichaId))
      .where(eq(ordemPecas.ordemId, id))
      .orderBy(asc(ordemPecas.posicao)),
    db
      .select({ ano: orcamentos.ano, sequencial: orcamentos.sequencial })
      .from(orcamentos)
      .where(eq(orcamentos.encomendaId, id))
      .limit(1),
    fotosDaOrdem(id),
  ]);
  const [doOrcamento] = orcamento;
  return {
    numero: ordem.numero,
    nome: ordem.nome,
    tipo: ordem.tipo,
    caminho: ordem.caminho,
    status: ordem.status,
    clienteNome: ordem.clienteNome,
    entregaPrometida: ordem.entregaPrometida,
    inicio: ordem.inicio,
    etapas: etapas.map(semOrdemId),
    orcamentoNumero: doOrcamento ? numeroDeOrcamento(doOrcamento.ano, doOrcamento.sequencial) : null,
    fotos,
    pecas: pecas.map((peca) => ({
      posicao: peca.posicao,
      descricao: peca.descricao,
      quantidade: peca.quantidade,
      aMais: peca.aMais,
      cor: peca.cor,
      personalizacao: peca.personalizacao,
      ficha:
        peca.fichaId === null
          ? null
          : {
              argilaMiligramas: peca.argilaMiligramas ?? 0,
              esmalteMiligramas: peca.esmalteMiligramas ?? 0,
              larguraMm: peca.larguraMm ?? 0,
              profundidadeMm: peca.profundidadeMm ?? 0,
              alturaMm: peca.alturaMm ?? 0,
            },
    })),
  };
}

// A folha geral A4 (plano 13, PRD-20): TODAS as ordens liberadas e aguardando o sinal — sem filtro,
// independente do que a tela mostra (mesma regra da folha antiga, D-18 da Fase 3) —, com as etapas
// (o parcial `passaram` incluído) e os totais de pedido e a mais. Nenhuma coluna de dinheiro.
export async function ordensParaAFolhaGeral(): Promise<OrdemParaAFolhaGeral[]> {
  const ordens = await db
    .select(COLUNAS_DA_ORDEM)
    .from(ordensProducao)
    .where(inArray(ordensProducao.status, ["aguardando_sinal", "ativa"]))
    .orderBy(asc(ordensProducao.numero));
  if (ordens.length === 0) {
    return [];
  }
  const ids = ordens.map((ordem) => ordem.id);
  const [etapas, pecas] = await Promise.all([
    db
      .select(COLUNAS_DA_ETAPA)
      .from(ordemEtapas)
      .where(inArray(ordemEtapas.ordemId, ids))
      .orderBy(asc(ordemEtapas.ordemId), asc(ordemEtapas.posicao)),
    db
      .select({
        ordemId: ordemPecas.ordemId,
        quantidade: ordemPecas.quantidade,
        aMais: ordemPecas.aMais,
      })
      .from(ordemPecas)
      .where(inArray(ordemPecas.ordemId, ids)),
  ]);
  const etapasPorOrdem = agruparPorOrdem(etapas);
  const pecasPorOrdem = agruparPorOrdem(pecas);
  return ordens.map((ordem) => {
    const pecasDaOrdem = pecasPorOrdem.get(ordem.id) ?? [];
    return {
      ...ordem,
      etapas: (etapasPorOrdem.get(ordem.id) ?? []).map(semOrdemId),
      totalPecas: pecasDaOrdem.reduce((total, peca) => total + peca.quantidade, 0),
      totalAMais: pecasDaOrdem.reduce((total, peca) => total + peca.aMais, 0),
    };
  });
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
// - `itensDoEstoque`: itens que já controlam estoque, ativos, contados em unidades (`un`), que não
//   são item de nenhuma ficha de linha — "Itens do estoque" (só na casa; sem ficha: sem material
//   previsto, D-14).
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
          // Só o contado em unidades (revisão 06.1, WR-03 — `itemGuardaPecas`): argila em kg,
          // esmalte em g ou café em ml são material, não peça que a casa produz.
          eq(itensCatalogo.unidade, "un"),
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

// ---------------------------------------------------------------------------------------------
// Concluídas e canceladas (plano 08, UI-D8) — `/gestao/producao/concluidas`, 50 por vez.
// ---------------------------------------------------------------------------------------------

// Teto fixo por leitura (T-06.1-31): quem chama só escolhe o deslocamento.
export const CONCLUIDAS_POR_VEZ = 50;

export type OrdemEncerrada = {
  id: string;
  nome: string;
  tipo: TipoOrdem;
  clienteNome: string | null;
  status: "concluida" | "cancelada";
  inicio: string | null;
  // `YYYY-MM-DD`.
  concluidaEm: string | null;
  // O DIA de Brasília do cancelamento (`cancelada_em` é instante) — `YYYY-MM-DD`.
  canceladaEm: string | null;
  canceladaPelaVenda: boolean;
  entregaParcial: boolean;
  // Somadas das peças: feitas = pedido + a mais; boas = feitas − perdidas. `null` quando alguma peça
  // não tem as perdidas gravadas (a cancelada nunca passou pela conclusão).
  boas: number | null;
  feitas: number;
};

const STATUS_ENCERRADOS = ["concluida", "cancelada"] as const;

// O dia de Brasília do cancelamento, calculado pelo Postgres com o fuso ESCRITO na consulta — o
// banco não tem `TZ` (CLAUDE.md §Fuso). A concluída já guarda o dia civil.
const DIA_DO_CANCELAMENTO = sql<string | null>`to_char(${ordensProducao.canceladaEm} at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')`;
const DIA_DO_ENCERRAMENTO = sql`coalesce(${ordensProducao.concluidaEm}, (${ordensProducao.canceladaEm} at time zone 'America/Sao_Paulo')::date)`;

// As ordens concluídas e canceladas, mais recentes primeiro — pela data de conclusão ou de
// cancelamento; no mesmo dia, a de número maior (a mais nova) antes, para a página seguinte nunca
// repetir nem pular uma ordem. Molde "consulta principal + filhos casados por `Map`".
export async function listarConcluidasECanceladas({
  deslocamento,
}: {
  deslocamento: number;
}): Promise<OrdemEncerrada[]> {
  const ordens = await db
    .select({
      id: ordensProducao.id,
      nome: ordensProducao.nome,
      tipo: ordensProducao.tipo,
      clienteNome: ordensProducao.clienteNome,
      status: ordensProducao.status,
      inicio: ordensProducao.inicio,
      concluidaEm: ordensProducao.concluidaEm,
      canceladaEm: DIA_DO_CANCELAMENTO,
      canceladaPelaVenda: ordensProducao.canceladaPelaVenda,
      entregaParcial: ordensProducao.entregaParcial,
    })
    .from(ordensProducao)
    .where(inArray(ordensProducao.status, [...STATUS_ENCERRADOS]))
    .orderBy(desc(DIA_DO_ENCERRAMENTO), desc(ordensProducao.numero))
    .limit(CONCLUIDAS_POR_VEZ)
    .offset(deslocamento);
  if (ordens.length === 0) {
    return [];
  }
  const pecas = await db
    .select({
      ordemId: ordemPecas.ordemId,
      quantidade: ordemPecas.quantidade,
      aMais: ordemPecas.aMais,
      perdidas: ordemPecas.perdidas,
    })
    .from(ordemPecas)
    .where(
      inArray(
        ordemPecas.ordemId,
        ordens.map((ordem) => ordem.id),
      ),
    );
  const pecasPorOrdem = agruparPorOrdem(pecas);

  return ordens.map((ordem) => {
    const dela = pecasPorOrdem.get(ordem.id) ?? [];
    const feitas = dela.reduce((total, peca) => total + peca.quantidade + peca.aMais, 0);
    const todasComPerdidas = dela.length > 0 && dela.every((peca) => peca.perdidas !== null);
    return {
      ...ordem,
      // O `where` só deixa passar os dois; o tipo do Drizzle é o enum inteiro.
      status: ordem.status === "concluida" ? "concluida" : "cancelada",
      boas: todasComPerdidas
        ? dela.reduce((total, peca) => total + peca.quantidade + peca.aMais - (peca.perdidas ?? 0), 0)
        : null,
      feitas,
    };
  });
}

// Quantas ordens concluídas e canceladas existem — o "(N)" do link da Produção e o "Mostrar mais 50".
export async function contarConcluidasECanceladas(): Promise<number> {
  const [linha] = await db
    .select({ quantas: count() })
    .from(ordensProducao)
    .where(inArray(ordensProducao.status, [...STATUS_ENCERRADOS]));
  return Number(linha?.quantas ?? 0);
}

// ---------------------------------------------------------------------------------------------
// Material usado (plano 10, PRD-14).
// ---------------------------------------------------------------------------------------------

// Uma baixa de material feita pela ordem: a saída manual "consumo em encomenda" com
// `encomenda_id` = a ordem (o nome da coluna é histórico — aponta para a ordem desde a 0024).
export type BaixaDaOrdem = {
  id: string;
  itemId: string;
  nome: string;
  unidade: Unidade;
  // Com sinal, como gravado (a saída é negativa), na unidade do ITEM.
  quantidadeMilesimos: number;
  // `null` = "+ Dar baixa de outro material".
  material: MaterialDaOrdem | null;
  criadoEm: Date;
  registradoPorNome: string;
};

export type MaterialDaOrdemCarregado = {
  previsto: MaterialPrevisto;
  // Alguma peça da ordem tem ficha — sem nenhuma, a frase "Sem material previsto…".
  algumaPecaComFicha: boolean;
  // Na ordem do livro (`numero`).
  baixas: BaixaDaOrdem[];
  // O item da ÚLTIMA baixa de cada material nesta ordem — a pré-escolha da folha (UI-D6).
  ultimoItem: Record<MaterialDaOrdem, string | null>;
};

// O previsto (gramas da ficha lidas AO VIVO pela `ficha_id` × feitas, pelo módulo puro) e as baixas
// da ordem com o item, a unidade e quem registrou. Só `select`, sem trava. `null` se a ordem não
// existe.
export async function materialDaOrdem(ordemId: string): Promise<MaterialDaOrdemCarregado | null> {
  if (!FORMA_DE_UUID.test(ordemId)) {
    return null;
  }
  const [ordens, pecas, baixas] = await Promise.all([
    db
      .select({ caminho: ordensProducao.caminho })
      .from(ordensProducao)
      .where(eq(ordensProducao.id, ordemId))
      .limit(1),
    db
      .select({
        quantidade: ordemPecas.quantidade,
        aMais: ordemPecas.aMais,
        fichaId: fichasPrecificacao.id,
        argilaMiligramas: fichasPrecificacao.argilaMiligramas,
        esmalteMiligramas: fichasPrecificacao.esmalteMiligramas,
      })
      .from(ordemPecas)
      .leftJoin(fichasPrecificacao, eq(fichasPrecificacao.id, ordemPecas.fichaId))
      .where(eq(ordemPecas.ordemId, ordemId))
      .orderBy(asc(ordemPecas.posicao)),
    db
      .select({
        id: movimentacoesEstoque.id,
        itemId: movimentacoesEstoque.itemId,
        nome: itensCatalogo.nome,
        unidade: itensCatalogo.unidade,
        quantidadeMilesimos: movimentacoesEstoque.quantidadeMilesimos,
        material: movimentacoesEstoque.materialDaOrdem,
        criadoEm: movimentacoesEstoque.criadoEm,
        registradoPorNome: usuarios.nome,
      })
      .from(movimentacoesEstoque)
      .innerJoin(itensCatalogo, eq(itensCatalogo.id, movimentacoesEstoque.itemId))
      .innerJoin(usuarios, eq(usuarios.id, movimentacoesEstoque.registradoPor))
      .where(
        and(
          eq(movimentacoesEstoque.encomendaId, ordemId),
          eq(movimentacoesEstoque.origem, "manual"),
          eq(movimentacoesEstoque.destino, "encomenda"),
        ),
      )
      .orderBy(asc(movimentacoesEstoque.numero)),
  ]);
  const [ordem] = ordens;
  if (!ordem) {
    return null;
  }

  const pecasParaPrevisto: PecaParaPrevisto[] = pecas.map((peca) => ({
    quantidade: peca.quantidade,
    aMais: peca.aMais,
    ficha:
      peca.fichaId === null
        ? null
        : {
            argilaMiligramas: peca.argilaMiligramas ?? 0,
            esmalteMiligramas: peca.esmalteMiligramas ?? 0,
          },
  }));

  // O item do livro sempre controla estoque e tem unidade (só um material recebe baixa); a unidade
  // nula do catálogo não chega aqui — conferido por defesa, a linha sai da lista.
  const baixasDaOrdem: BaixaDaOrdem[] = baixas.flatMap((baixa) =>
    baixa.unidade === null
      ? []
      : [
          {
            ...baixa,
            unidade: baixa.unidade,
            quantidadeMilesimos: Number(baixa.quantidadeMilesimos),
          },
        ],
  );

  const ultimoItem: Record<MaterialDaOrdem, string | null> = { argila: null, esmalte: null };
  for (const baixa of baixasDaOrdem) {
    if (baixa.material !== null) {
      ultimoItem[baixa.material] = baixa.itemId;
    }
  }

  return {
    previsto: materialPrevisto(pecasParaPrevisto, ordem.caminho),
    algumaPecaComFicha: pecasParaPrevisto.some((peca) => peca.ficha !== null),
    baixas: baixasDaOrdem,
    ultimoItem,
  };
}

// ---------------------------------------------------------------------------------------------
// A conclusão (plano 11, PRD-15/PRD-16, D-12/D-13/D-14).
// ---------------------------------------------------------------------------------------------

// O que a folha de conclusão (e a ação, FORA da transação) precisa de cada peça. O item é o da
// ficha de LINHA (`fichas_precificacao.item_catalogo_id`) ou, na produção da casa sem ficha, o da
// própria peça (`ordem_pecas.item_catalogo_id`); peça exclusiva e peça em texto livre não têm item.
export type PecaParaConcluir = {
  id: string;
  descricao: string;
  quantidade: number;
  aMais: number;
  fichaId: string | null;
  // `null` quando a peça não tem ficha.
  exclusiva: boolean | null;
  item: {
    id: string;
    nome: string;
    unidade: Unidade | null;
    controlaEstoque: boolean;
    ativo: boolean;
  } | null;
  // O preço praticado guardado NA FICHA — só a exclusiva o tem (na de linha ele é o do item, D-18).
  // É o preço que o passo "Transformar em peça de linha" traz preenchido (D-12).
  precoPraticadoCentavos: number | null;
  // O custo de UMA peça pela ficha (`custosDasFichas` — a mesma conta do Estoque); `null` sem
  // ficha ou quando a ficha não dá custo hoje (D-14: a folha pede o custo).
  custoPelaFichaCentavos: number | null;
};

export type PecaLidaParaConcluir = Omit<PecaParaConcluir, "custoPelaFichaCentavos">;

// As peças da ordem com a ficha e o item, por posição. Recebe o executor: a folha lê com o `db`
// (`dadosDaConclusao`); a ação `concluirOrdem` lê com a TRANSAÇÃO, depois de travar a ordem — o
// que ela decide reflete o banco sob a trava, nunca o que a folha viu.
export async function lerPecasParaConcluir(
  executor: TransacaoDoBanco | typeof db,
  ordemId: string,
): Promise<PecaLidaParaConcluir[]> {
  const pecas = await executor
    .select({
      id: ordemPecas.id,
      descricao: ordemPecas.descricao,
      quantidade: ordemPecas.quantidade,
      aMais: ordemPecas.aMais,
      fichaId: ordemPecas.fichaId,
      exclusiva: fichasPrecificacao.exclusiva,
      precoPraticadoCentavos: fichasPrecificacao.precoPraticadoCentavos,
      itemId: itensCatalogo.id,
      itemNome: itensCatalogo.nome,
      itemUnidade: itensCatalogo.unidade,
      itemControlaEstoque: itensCatalogo.controlaEstoque,
      itemAtivo: itensCatalogo.ativo,
    })
    .from(ordemPecas)
    .leftJoin(fichasPrecificacao, eq(fichasPrecificacao.id, ordemPecas.fichaId))
    .leftJoin(
      itensCatalogo,
      eq(
        itensCatalogo.id,
        sql`coalesce(${fichasPrecificacao.itemCatalogoId}, ${ordemPecas.itemCatalogoId})`,
      ),
    )
    .where(eq(ordemPecas.ordemId, ordemId))
    .orderBy(asc(ordemPecas.posicao));

  return pecas.map((peca) => ({
    id: peca.id,
    descricao: peca.descricao,
    quantidade: peca.quantidade,
    aMais: peca.aMais,
    fichaId: peca.fichaId,
    exclusiva: peca.fichaId === null ? null : (peca.exclusiva ?? null),
    precoPraticadoCentavos: peca.precoPraticadoCentavos ?? null,
    item:
      peca.itemId === null
        ? null
        : {
            id: peca.itemId,
            nome: peca.itemNome ?? "",
            unidade: peca.itemUnidade ?? null,
            controlaEstoque: peca.itemControlaEstoque ?? false,
            ativo: peca.itemAtivo ?? false,
          },
  }));
}

// O que a folha de conclusão recebe: as peças e, para o passo "Transformar em peça de linha"
// (D-12), as categorias de venda ATIVAS do grupo Receitas e o id de "Peças prontas" (a sugestão;
// `null` quando a categoria não existe mais ou está desativada — a folha pede para escolher).
export type DadosDaConclusao = {
  pecas: PecaParaConcluir[];
  categoriasDeVenda: CategoriaDeVenda[];
  categoriaPecasProntasId: string | null;
};

// O nome exato que a migração 0016 semeou (a mesma frase de `NOME_CATEGORIA_PECAS_PRONTAS` em
// `./textos`, repetida aqui para a consulta não importar o módulo de frases).
const NOME_PECAS_PRONTAS = "Peças prontas";

// Só `select`, sem trava: é o que a folha MOSTRA e o custo que a ação leva para dentro da
// transação (como `aprovarOrcamento` lê a configuração antes). A decisão — status, contas, item
// sem estoque, a ficha ainda exclusiva — é refeita sob a trava da ordem. `hoje` chega por
// argumento. As categorias de venda só são lidas quando alguma peça é exclusiva (é só ela que
// mostra o passo do D-12).
export async function dadosDaConclusao(ordemId: string, hoje: string): Promise<DadosDaConclusao> {
  if (!FORMA_DE_UUID.test(ordemId)) {
    return { pecas: [], categoriasDeVenda: [], categoriaPecasProntasId: null };
  }
  const lidas = await lerPecasParaConcluir(db, ordemId);
  const custos = await custosDasFichas(
    lidas.flatMap((peca) => (peca.fichaId === null ? [] : [peca.fichaId])),
    hoje,
  );
  const pecas = lidas.map((peca) => ({
    ...peca,
    custoPelaFichaCentavos: peca.fichaId === null ? null : (custos.get(peca.fichaId) ?? null),
  }));
  if (!pecas.some((peca) => peca.exclusiva === true)) {
    return { pecas, categoriasDeVenda: [], categoriaPecasProntasId: null };
  }
  // A MESMA lista do diálogo da ficha na Precificação (ativas, grupo Receitas).
  const categoriasDeVenda = await listarCategoriasDeVenda();
  const pecasProntas = categoriasDeVenda.find(
    (categoria) =>
      categoria.nome.trim().toLocaleLowerCase("pt-BR") === NOME_PECAS_PRONTAS.toLocaleLowerCase("pt-BR"),
  );
  return { pecas, categoriasDeVenda, categoriaPecasProntasId: pecasProntas?.id ?? null };
}

// ---------------------------------------------------------------------------------------------
// A perda medida (plano 12, D-08, PRD-17).
// ---------------------------------------------------------------------------------------------

// As ordens CONCLUÍDAS desde `desde` (inclusive), somadas por ordem: as perdidas e as feitas
// (quantidade + a mais) de todas as peças. Canceladas ficam fora (só `status = 'concluida'`); a
// produção da casa entra. As extras sem destino (`sem_destino`) NÃO são lidas — não são perda
// (briefing §7). A conta é o módulo puro `perdaMedida` (`./perda`); esta leitura só traz os números.
export async function conclusoesParaAPerda(desde: string): Promise<ConclusaoParaAPerda[]> {
  const linhas = await db
    .select({
      concluidaEm: ordensProducao.concluidaEm,
      perdidas: sql<string>`coalesce(sum(${ordemPecas.perdidas}), 0)`,
      feitas: sql<string>`coalesce(sum(${ordemPecas.quantidade} + ${ordemPecas.aMais}), 0)`,
    })
    .from(ordensProducao)
    .innerJoin(ordemPecas, eq(ordemPecas.ordemId, ordensProducao.id))
    .where(
      and(
        eq(ordensProducao.status, "concluida"),
        isNotNull(ordensProducao.concluidaEm),
        gte(ordensProducao.concluidaEm, desde),
      ),
    )
    .groupBy(ordensProducao.id, ordensProducao.concluidaEm);

  return linhas.flatMap((linha) =>
    linha.concluidaEm === null
      ? []
      : [{ concluidaEm: linha.concluidaEm, perdidas: Number(linha.perdidas), feitas: Number(linha.feitas) }],
  );
}

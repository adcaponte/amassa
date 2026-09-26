// Leituras do módulo de precificação. Sem `"use server"` — não são Server Actions, são consultas
// chamadas direto do Server Component da página (mesmo molde de `lib/financeiro/consultas.ts`).
//
// `parametrosVigentes` é a ÚNICA porta por onde ficha, orçamento e tela leem parâmetro — nenhum
// outro módulo monta o `ParametrosDoCalculo` na mão. A taxa do cartão nunca é lida de novo aqui:
// vem de `obterConfiguracaoFinanceira` (lib/financeiro/consultas.ts), a mesma leitura que a 04.4
// já faz — D-16, "não duplicar".
import { and, asc, countDistinct, desc, eq, lte } from "drizzle-orm";

import { db } from "@/db";
import {
  categorias,
  fichasPrecificacao,
  itensCatalogo,
  orcamentoLinhas,
  parametrosPrecificacao,
} from "@/db/schema";
import { obterConfiguracaoFinanceira } from "@/lib/financeiro/consultas";

import type { ParametrosDoCalculo } from "./calculo";
import type { CamposCopiaveisDaFicha } from "./ficha";
import type { MedidasUteisDoForno } from "./forno";
import { CATALOGO_DE_PARAMETROS, type ChaveDeParametro, type LinhaDeParametro } from "./parametros";

export type ParametroVigente = LinhaDeParametro & { chave: ChaveDeParametro };

export type ParametrosVigentesResultado =
  | {
      ok: true;
      // Os 18, um por chave — o que a TELA precisa (valor, selo, "desde") além do que
      // `calcularPeca` usa.
      porChave: Record<ChaveDeParametro, ParametroVigente>;
      // O mesmo agregado que `calcularPeca` espera — montado aqui, nunca por quem chama.
      calculo: ParametrosDoCalculo;
      // As medidas do forno, no formato que `quantasCabem` (lib/precificacao/forno.ts) espera —
      // mesma disciplina de `calculo`: montado aqui, a ÚNICA porta de leitura de parâmetro nunca
      // deixa outro módulo remontar isto na mão (04.5-04-PLAN.md).
      forno: MedidasUteisDoForno;
      taxaCartaoPontosBase: number;
    }
  // Uma chave sem NENHUMA linha vigente na data pedida — a tela precisa saber a diferença entre
  // "vale zero" e "não existe" (nunca finge zero).
  | { ok: false; faltando: ChaveDeParametro[] };

function valorInteiroDe(
  porChave: Map<ChaveDeParametro, ParametroVigente>,
  chave: ChaveDeParametro,
): number {
  // Não-nulo: só é chamada depois de confirmar que `faltando` está vazio.
  return porChave.get(chave)!.valorInteiro;
}

// A linha de maior `vigente_desde <= $1` POR CHAVE, numa consulta só — `distinct on (chave)` com
// `order by chave, vigente_desde desc` é o que o Postgres faz melhor aqui (nunca uma consulta por
// chave, nunca um laço). "hoje" chega por argumento: este módulo nunca lê o relógio.
export async function parametrosVigentes(hoje: string): Promise<ParametrosVigentesResultado> {
  const [linhasVigentes, configuracao] = await Promise.all([
    db
      .selectDistinctOn([parametrosPrecificacao.chave], {
        chave: parametrosPrecificacao.chave,
        valorInteiro: parametrosPrecificacao.valorInteiro,
        medido: parametrosPrecificacao.medido,
        vigenteDesde: parametrosPrecificacao.vigenteDesde,
      })
      .from(parametrosPrecificacao)
      .where(lte(parametrosPrecificacao.vigenteDesde, hoje))
      .orderBy(parametrosPrecificacao.chave, desc(parametrosPrecificacao.vigenteDesde)),
    obterConfiguracaoFinanceira(),
  ]);

  const porChave = new Map<ChaveDeParametro, ParametroVigente>(
    linhasVigentes.map((linha) => [
      linha.chave as ChaveDeParametro,
      { ...linha, chave: linha.chave as ChaveDeParametro },
    ]),
  );

  const faltando = CATALOGO_DE_PARAMETROS.map((definicao) => definicao.chave).filter(
    (chave) => !porChave.has(chave),
  );
  if (faltando.length > 0) {
    return { ok: false, faltando };
  }

  const valor = (chave: ChaveDeParametro) => valorInteiroDe(porChave, chave);

  const calculo: ParametrosDoCalculo = {
    argilaReaisPorKgCentavos: valor("material_argila"),
    esmalteReaisPorKgCentavos: valor("material_esmalte"),
    horaTrabalhoCentavos: valor("trabalho_hora"),
    tarifaEnergiaCentavos: valor("forno_tarifa_energia"),
    kwhBiscoitoMilesimos: valor("forno_kwh_biscoito"),
    kwhEsmalteMilesimos: valor("forno_kwh_esmalte"),
    desgastePorFornadaCentavos: valor("forno_desgaste_por_fornada"),
    perdaPontosBase: valor("perda_unica"),
    lucroPontosBase: valor("preco_lucro"),
    folgaNegociacaoPontosBase: valor("preco_folga_negociacao"),
    impostoPontosBase: valor("preco_imposto_sobre_venda"),
    comissaoGaleriaPontosBase: valor("preco_comissao_galeria"),
  };

  // As cinco medidas de comprimento do forno são guardadas na ESCALA DO CATÁLOGO de parâmetros
  // (cm × 1000 — `CATALOGO_DE_PARAMETROS`, escala 1000 para medida física), não em milímetros: 35
  // cm entram como 35000. `MedidasUteisDoForno` (lib/precificacao/forno.ts) espera milímetros
  // (35 cm = 350). A conversão é cm-milésimos ÷ 100 = mm (cm×1000 ÷ 100 = cm×10 = mm) — nunca o
  // valor bruto do parâmetro direto, que erraria por 100× (achado real: o teste e2e de "peça não
  // cabe" media 400 mm reais contra um forno de "35000 mm", que nunca recusaria peça nenhuma).
  function cmMilesimosParaMm(chave: ChaveDeParametro): number {
    return Math.round(valor(chave) / 100);
  }

  const forno: MedidasUteisDoForno = {
    larguraMm: cmMilesimosParaMm("forno_largura_util"),
    profundidadeMm: cmMilesimosParaMm("forno_profundidade_util"),
    alturaMm: cmMilesimosParaMm("forno_altura_util"),
    folgaMm: cmMilesimosParaMm("forno_folga_entre_pecas"),
    prateleiraEPilarMm: cmMilesimosParaMm("forno_prateleira_e_pilar"),
    // Fator (×, escala 1000) NÃO é comprimento — nenhuma conversão de unidade aqui, o valor
    // guardado JÁ é o que `quantasCabem` espera (1800 = 1,8×).
    fatorBiscoitoMilesimos: valor("forno_fator_biscoito"),
  };

  return {
    ok: true,
    porChave: Object.fromEntries(porChave) as Record<ChaveDeParametro, ParametroVigente>,
    calculo,
    forno,
    taxaCartaoPontosBase: configuracao.taxaCartaoPontosBase,
  };
}

// O histórico de UM parâmetro, mais recente primeiro — alimenta o "desde" da tela e, no futuro, a
// tela de histórico completo (se um dia existir). Nunca chamado em laço por `parametrosVigentes`
// acima (D1 do plano: uma consulta por chave nunca é o caminho de leitura em massa).
export async function historicoDoParametro(chave: ChaveDeParametro): Promise<LinhaDeParametro[]> {
  return db
    .select({
      valorInteiro: parametrosPrecificacao.valorInteiro,
      medido: parametrosPrecificacao.medido,
      vigenteDesde: parametrosPrecificacao.vigenteDesde,
    })
    .from(parametrosPrecificacao)
    .where(eq(parametrosPrecificacao.chave, chave))
    .orderBy(desc(parametrosPrecificacao.vigenteDesde));
}

// ---------------------------------------------------------------------------------------------
// Ficha de peça (04.5-04-PLAN.md — D-18/D-19)
// ---------------------------------------------------------------------------------------------

export type CategoriaDeVenda = { id: string; nome: string };

// Ativas, do grupo receita — a MESMA regra de `lib/cadastros/consultas.ts::listarCategoriasParaItem`
// (`.vendaveis`), redeclarada aqui (cada módulo tem sua própria cópia, D-15 do projeto).
export async function listarCategoriasDeVenda(): Promise<CategoriaDeVenda[]> {
  return db
    .select({ id: categorias.id, nome: categorias.nome })
    .from(categorias)
    .where(and(eq(categorias.ativa, true), eq(categorias.grupo, "receita")))
    .orderBy(asc(categorias.nome));
}

export type FichaParaEdicao = {
  id: string;
  nome: string;
  argilaMiligramas: number;
  esmalteMiligramas: number;
  horasMilesimos: number;
  larguraMm: number;
  profundidadeMm: number;
  alturaMm: number;
  embalagemCentavos: number;
  cabemBiscoitoInformado: number | null;
  cabemEsmalteInformado: number | null;
  precoMercadoCentavos: number | null;
  exclusiva: boolean;
  itemCatalogoId: string | null;
  categoriaVendaId: string | null;
  // A opção ATUAL da categoria, mesmo desativada — mesma técnica de
  // `components/amassa/cadastros/dialogo-item-catalogo.tsx::opcoesComAtual`: a categoria
  // desativada nunca some do formulário de uma ficha que já a usa.
  categoriaVendaNome: string | null;
  // O preço EFETIVO (D-18): o do item quando de linha, o da própria ficha quando exclusiva — a
  // tela nunca decide sozinha qual preço mostrar, esta consulta já resolve.
  precoPraticadoEfetivoCentavos: number | null;
};

// A ficha com o item vinculado (quando de linha) e a categoria dele — nunca uma segunda consulta
// para "qual é o preço efetivo" (key_links do plano).
export async function obterFichaParaEdicao(id: string): Promise<FichaParaEdicao | null> {
  const [linha] = await db
    .select({
      id: fichasPrecificacao.id,
      nome: fichasPrecificacao.nome,
      argilaMiligramas: fichasPrecificacao.argilaMiligramas,
      esmalteMiligramas: fichasPrecificacao.esmalteMiligramas,
      horasMilesimos: fichasPrecificacao.horasMilesimos,
      larguraMm: fichasPrecificacao.larguraMm,
      profundidadeMm: fichasPrecificacao.profundidadeMm,
      alturaMm: fichasPrecificacao.alturaMm,
      embalagemCentavos: fichasPrecificacao.embalagemCentavos,
      cabemBiscoitoInformado: fichasPrecificacao.cabemBiscoitoInformado,
      cabemEsmalteInformado: fichasPrecificacao.cabemEsmalteInformado,
      precoMercadoCentavos: fichasPrecificacao.precoMercadoCentavos,
      precoPraticadoCentavos: fichasPrecificacao.precoPraticadoCentavos,
      exclusiva: fichasPrecificacao.exclusiva,
      itemCatalogoId: fichasPrecificacao.itemCatalogoId,
      itemCategoriaVendaId: itensCatalogo.categoriaVendaId,
      itemCategoriaVendaNome: categorias.nome,
      itemPrecoVendaCentavos: itensCatalogo.precoVendaCentavos,
    })
    .from(fichasPrecificacao)
    .leftJoin(itensCatalogo, eq(fichasPrecificacao.itemCatalogoId, itensCatalogo.id))
    .leftJoin(categorias, eq(itensCatalogo.categoriaVendaId, categorias.id))
    .where(eq(fichasPrecificacao.id, id))
    .limit(1);

  if (!linha) {
    return null;
  }

  return {
    id: linha.id,
    nome: linha.nome,
    argilaMiligramas: linha.argilaMiligramas,
    esmalteMiligramas: linha.esmalteMiligramas,
    horasMilesimos: linha.horasMilesimos,
    larguraMm: linha.larguraMm,
    profundidadeMm: linha.profundidadeMm,
    alturaMm: linha.alturaMm,
    embalagemCentavos: linha.embalagemCentavos,
    cabemBiscoitoInformado: linha.cabemBiscoitoInformado,
    cabemEsmalteInformado: linha.cabemEsmalteInformado,
    precoMercadoCentavos: linha.precoMercadoCentavos,
    exclusiva: linha.exclusiva,
    itemCatalogoId: linha.itemCatalogoId,
    categoriaVendaId: linha.itemCategoriaVendaId,
    categoriaVendaNome: linha.itemCategoriaVendaNome,
    precoPraticadoEfetivoCentavos: linha.exclusiva
      ? linha.precoPraticadoCentavos
      : linha.itemPrecoVendaCentavos,
  };
}

// ---------------------------------------------------------------------------------------------
// Lista de Peças (04.5-05-PLAN.md — D-19/D-20)
// ---------------------------------------------------------------------------------------------

// O tipo da transação do Drizzle, derivado do próprio `db` (nunca importado de
// `drizzle-orm/node-postgres`) — mesma técnica de `lib/orcamentos/numero.ts::TransacaoDoBanco`,
// redeclarada aqui (D-15: cada módulo tem sua própria cópia).
export type TransacaoDoBanco = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type FichaDaLista = {
  id: string;
  nome: string;
  exclusiva: boolean;
  // O preço EFETIVO (D-18) — o do item quando de linha, o da própria ficha quando exclusiva,
  // igual à mesma resolução de `obterFichaParaEdicao`, nunca uma segunda regra.
  precoPraticadoEfetivoCentavos: number | null;
  // Quantos orçamentos DISTINTOS usam esta ficha AGORA — mostrado como aviso preventivo em
  // `ConfirmarApagarPeca` (D-20), nunca como a palavra final: a recusa de verdade é sempre a que
  // `apagarFicha` lê de novo, dentro da própria transação (a contagem pode mudar entre a página
  // carregar e o dono confirmar). Sempre 0 neste plano — nenhuma tela ainda cria linha de
  // orçamento; o plano 06 é o primeiro a fazer este número deixar de ser zero.
  orcamentosCount: number;
  argilaMiligramas: number;
  esmalteMiligramas: number;
  horasMilesimos: number;
  larguraMm: number;
  profundidadeMm: number;
  alturaMm: number;
  embalagemCentavos: number;
  cabemBiscoitoInformado: number | null;
  cabemEsmalteInformado: number | null;
};

// TODAS as fichas (exclusivas inclusas) numa consulta só, mais a contagem de orçamentos de cada
// uma numa SEGUNDA consulta agregada (nunca uma consulta por linha) — mesmo molde de
// `lib/cadastros/consultas.ts::listarCategoriasComUso` (query principal + agregado(s), casados
// por um `Map` em memória, em vez de um único `GROUP BY` com todas as colunas da ficha). Quem
// decide se a exclusiva aparece na tela é QUEM CHAMA (`ListaPecas`, filtrando por `exclusiva`) —
// esta consulta sempre traz tudo, para que o alternador "Mostrar/Esconder" (D-19) nunca precise
// de uma segunda ida ao banco só para saber quantas exclusivas existem.
export async function listarFichas(): Promise<FichaDaLista[]> {
  const [fichas, contagemPorFicha] = await Promise.all([
    db
      .select({
        id: fichasPrecificacao.id,
        nome: fichasPrecificacao.nome,
        exclusiva: fichasPrecificacao.exclusiva,
        precoPraticadoCentavos: fichasPrecificacao.precoPraticadoCentavos,
        argilaMiligramas: fichasPrecificacao.argilaMiligramas,
        esmalteMiligramas: fichasPrecificacao.esmalteMiligramas,
        horasMilesimos: fichasPrecificacao.horasMilesimos,
        larguraMm: fichasPrecificacao.larguraMm,
        profundidadeMm: fichasPrecificacao.profundidadeMm,
        alturaMm: fichasPrecificacao.alturaMm,
        embalagemCentavos: fichasPrecificacao.embalagemCentavos,
        cabemBiscoitoInformado: fichasPrecificacao.cabemBiscoitoInformado,
        cabemEsmalteInformado: fichasPrecificacao.cabemEsmalteInformado,
        itemPrecoVendaCentavos: itensCatalogo.precoVendaCentavos,
      })
      .from(fichasPrecificacao)
      .leftJoin(itensCatalogo, eq(fichasPrecificacao.itemCatalogoId, itensCatalogo.id))
      .orderBy(asc(fichasPrecificacao.criadoEm)),
    db
      .select({ fichaId: orcamentoLinhas.fichaId, total: countDistinct(orcamentoLinhas.orcamentoId) })
      .from(orcamentoLinhas)
      .groupBy(orcamentoLinhas.fichaId),
  ]);

  const contagemPorId = new Map(contagemPorFicha.map((linha) => [linha.fichaId, Number(linha.total)]));

  return fichas.map((linha) => ({
    id: linha.id,
    nome: linha.nome,
    exclusiva: linha.exclusiva,
    precoPraticadoEfetivoCentavos: linha.exclusiva
      ? linha.precoPraticadoCentavos
      : linha.itemPrecoVendaCentavos,
    orcamentosCount: contagemPorId.get(linha.id) ?? 0,
    argilaMiligramas: linha.argilaMiligramas,
    esmalteMiligramas: linha.esmalteMiligramas,
    horasMilesimos: linha.horasMilesimos,
    larguraMm: linha.larguraMm,
    profundidadeMm: linha.profundidadeMm,
    alturaMm: linha.alturaMm,
    embalagemCentavos: linha.embalagemCentavos,
    cabemBiscoitoInformado: linha.cabemBiscoitoInformado,
    cabemEsmalteInformado: linha.cabemEsmalteInformado,
  }));
}

export type FichaParaCopiar = { id: string; nome: string } & CamposCopiaveisDaFicha;

// nome e id para o rótulo do `<select>` "Começar a partir de", mais os campos que
// `camposCopiaveisDaFicha` (lib/precificacao/ficha.ts) sabe filtrar — carregados de uma vez para
// que trocar a opção no cliente nunca dispare uma consulta nova (a Tarefa 2 só faz um `find` no
// array já em mãos). TODAS as fichas, exclusivas inclusas — D-19 permite copiar de qualquer
// ficha que o dono enxergue, diferente do protótipo original.
export async function listarFichasParaCopiar(): Promise<FichaParaCopiar[]> {
  return db
    .select({
      id: fichasPrecificacao.id,
      nome: fichasPrecificacao.nome,
      argilaMiligramas: fichasPrecificacao.argilaMiligramas,
      esmalteMiligramas: fichasPrecificacao.esmalteMiligramas,
      horasMilesimos: fichasPrecificacao.horasMilesimos,
      larguraMm: fichasPrecificacao.larguraMm,
      profundidadeMm: fichasPrecificacao.profundidadeMm,
      alturaMm: fichasPrecificacao.alturaMm,
      embalagemCentavos: fichasPrecificacao.embalagemCentavos,
      cabemBiscoitoInformado: fichasPrecificacao.cabemBiscoitoInformado,
      cabemEsmalteInformado: fichasPrecificacao.cabemEsmalteInformado,
    })
    .from(fichasPrecificacao)
    .orderBy(asc(fichasPrecificacao.nome));
}

// Chamada DENTRO de `db.transaction(async (tx) => ...)` por `apagarFicha` (lib/precificacao/
// acoes.ts) — nunca com `db` direto. Conta ORÇAMENTOS distintos, não linhas: uma ficha usada duas
// vezes no MESMO orçamento ainda está "em 1 orçamento" (D-20 fala do documento, não da linha).
export async function contarOrcamentosDaFicha(tx: TransacaoDoBanco, fichaId: string): Promise<number> {
  const [linha] = await tx
    .select({ total: countDistinct(orcamentoLinhas.orcamentoId) })
    .from(orcamentoLinhas)
    .where(eq(orcamentoLinhas.fichaId, fichaId));

  return Number(linha?.total ?? 0);
}

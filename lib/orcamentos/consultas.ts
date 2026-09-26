// Leituras do módulo Orçamentos. Sem `"use server"` — não são Server Actions, são consultas
// chamadas direto do Server Component da página; `lib/orcamentos/acoes.ts` fica só com escrita
// (mesmo molde de `lib/financeiro/consultas.ts`).
import { asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { fichasPrecificacao, orcamentoLinhas, orcamentoProjeto, orcamentos } from "@/db/schema";
import type { PlanoDePagamentoDoOrcamento } from "@/lib/orcamentos/plano";

export type OrcamentoParaLista = {
  id: string;
  ano: number;
  sequencial: number;
  revisao: number;
  status: (typeof orcamentos.status.enumValues)[number];
  clienteNome: string | null;
  titulo: string | null;
  data: string;
  validadeDias: number;
  // Sempre derivado da soma das linhas — nunca uma coluna gravada (04.5-06-PLAN.md, prohibition
  // "Nenhum total é gravado em coluna"). Agregação na própria consulta (`group by`), não uma
  // segunda consulta por orçamento.
  totalCentavos: number;
};

// Ordenada por `ano desc, sequencial desc` — a mesma ordem do protótipo (o mais recente primeiro
// é sempre `ORC-{ano mais alto}-{sequencial mais alto}`). Seleção por coluna, nunca `select()`
// solto (CLAUDE.md/molde do projeto).
export async function listarOrcamentos(): Promise<OrcamentoParaLista[]> {
  const linhas = await db
    .select({
      id: orcamentos.id,
      ano: orcamentos.ano,
      sequencial: orcamentos.sequencial,
      revisao: orcamentos.revisao,
      status: orcamentos.status,
      clienteNome: orcamentos.clienteNome,
      titulo: orcamentos.titulo,
      data: orcamentos.data,
      validadeDias: orcamentos.validadeDias,
      totalCentavos: sql<string>`coalesce(sum(${orcamentoLinhas.quantidade} * ${orcamentoLinhas.precoUnitarioCentavos}), 0)`,
    })
    .from(orcamentos)
    .leftJoin(orcamentoLinhas, eq(orcamentoLinhas.orcamentoId, orcamentos.id))
    .groupBy(orcamentos.id)
    .orderBy(desc(orcamentos.ano), desc(orcamentos.sequencial));

  // `sum(...)` sobre colunas `integer` volta como TEXTO do driver do Postgres (`bigint`) — sempre
  // convertido para número inteiro aqui, nunca deixado como string para a tela formatar.
  return linhas.map((linha) => ({ ...linha, totalCentavos: Number(linha.totalCentavos) }));
}

// ---------------------------------------------------------------------------------------------
// O editor do orçamento (04.5-06-PLAN.md, Tarefa 2/3)
// ---------------------------------------------------------------------------------------------

export type FichaDaLinhaDoOrcamento = {
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
};

export type LinhaDoOrcamentoParaEdicao = {
  id: string;
  fichaId: string;
  quantidade: number;
  precoUnitarioCentavos: number;
  cor: string | null;
  personalizacao: string | null;
  ordem: number;
  ficha: FichaDaLinhaDoOrcamento;
};

export type CustoDeProjetoDoOrcamento = {
  id: string;
  descricao: string;
  valorCentavos: number;
  ordem: number;
};

export type OrcamentoParaEdicao = {
  id: string;
  ano: number;
  sequencial: number;
  revisao: number;
  status: (typeof orcamentos.status.enumValues)[number];
  clienteNome: string | null;
  titulo: string | null;
  data: string;
  entregaPrevista: string;
  validadeDias: number;
  // "Total e pagamento" (04.5-07-PLAN.md): plano de pagamento, sinal, frete e observações do
  // orçamento — os quatro já existiam no schema desde o plano 01, zerados/com padrão até aqui.
  plano: PlanoDePagamentoDoOrcamento;
  sinalPercentual: number;
  freteCentavos: number;
  observacoes: string | null;
  linhas: LinhaDoOrcamentoParaEdicao[];
  custosDeProjeto: CustoDeProjetoDoOrcamento[];
};

// O orçamento, as linhas com a ficha de cada uma e os custos de projeto, em TRÊS consultas (nunca
// uma por linha) — dentro do limite de quatro que o plano permite (fotos ficam para um plano
// futuro, fora do escopo desta tela).
export async function obterOrcamentoParaEdicao(id: string): Promise<OrcamentoParaEdicao | null> {
  const [cabecalho] = await db
    .select({
      id: orcamentos.id,
      ano: orcamentos.ano,
      sequencial: orcamentos.sequencial,
      revisao: orcamentos.revisao,
      status: orcamentos.status,
      clienteNome: orcamentos.clienteNome,
      titulo: orcamentos.titulo,
      data: orcamentos.data,
      entregaPrevista: orcamentos.entregaPrevista,
      validadeDias: orcamentos.validadeDias,
      plano: orcamentos.plano,
      sinalPercentual: orcamentos.sinalPercentual,
      freteCentavos: orcamentos.freteCentavos,
      observacoes: orcamentos.observacoes,
    })
    .from(orcamentos)
    .where(eq(orcamentos.id, id))
    .limit(1);

  if (!cabecalho) {
    return null;
  }

  const [linhas, custosDeProjeto] = await Promise.all([
    db
      .select({
        id: orcamentoLinhas.id,
        fichaId: orcamentoLinhas.fichaId,
        quantidade: orcamentoLinhas.quantidade,
        precoUnitarioCentavos: orcamentoLinhas.precoUnitarioCentavos,
        cor: orcamentoLinhas.cor,
        personalizacao: orcamentoLinhas.personalizacao,
        ordem: orcamentoLinhas.ordem,
        fichaNome: fichasPrecificacao.nome,
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
      .from(orcamentoLinhas)
      .innerJoin(fichasPrecificacao, eq(orcamentoLinhas.fichaId, fichasPrecificacao.id))
      .where(eq(orcamentoLinhas.orcamentoId, id))
      .orderBy(asc(orcamentoLinhas.ordem)),
    db
      .select({
        id: orcamentoProjeto.id,
        descricao: orcamentoProjeto.descricao,
        valorCentavos: orcamentoProjeto.valorCentavos,
        ordem: orcamentoProjeto.ordem,
      })
      .from(orcamentoProjeto)
      .where(eq(orcamentoProjeto.orcamentoId, id))
      .orderBy(asc(orcamentoProjeto.ordem)),
  ]);

  return {
    ...cabecalho,
    custosDeProjeto,
    linhas: linhas.map((linha) => ({
      id: linha.id,
      fichaId: linha.fichaId,
      quantidade: linha.quantidade,
      precoUnitarioCentavos: linha.precoUnitarioCentavos,
      cor: linha.cor,
      personalizacao: linha.personalizacao,
      ordem: linha.ordem,
      ficha: {
        nome: linha.fichaNome,
        argilaMiligramas: linha.argilaMiligramas,
        esmalteMiligramas: linha.esmalteMiligramas,
        horasMilesimos: linha.horasMilesimos,
        larguraMm: linha.larguraMm,
        profundidadeMm: linha.profundidadeMm,
        alturaMm: linha.alturaMm,
        embalagemCentavos: linha.embalagemCentavos,
        cabemBiscoitoInformado: linha.cabemBiscoitoInformado,
        cabemEsmalteInformado: linha.cabemEsmalteInformado,
      },
    })),
  };
}

export type PecaParaEscolha = {
  id: string;
  nome: string;
} & FichaDaLinhaDoOrcamento;

// "+ Peça da lista" (must_have): as fichas NÃO exclusivas (D-19 — uma exclusiva pertence a um só
// pedido, nunca aparece aqui), com os campos de cálculo para a tela resolver o "mín. {R$X}" ao
// lado de cada uma (a MESMA cadeia quantasCabem → calcularPeca que `ListaPecas` já usa).
export async function listarPecasParaEscolha(): Promise<PecaParaEscolha[]> {
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
    .where(eq(fichasPrecificacao.exclusiva, false))
    .orderBy(asc(fichasPrecificacao.nome));
}

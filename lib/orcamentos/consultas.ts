// Leituras do módulo Orçamentos. Sem `"use server"` — não são Server Actions, são consultas
// chamadas direto do Server Component da página; `lib/orcamentos/acoes.ts` fica só com escrita
// (mesmo molde de `lib/financeiro/consultas.ts`).
import { asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  fichasPrecificacao,
  orcamentoFotos,
  orcamentoLinhas,
  orcamentoProjeto,
  orcamentoRevisoes,
  orcamentos,
} from "@/db/schema";
import { hojeEmBrasilia } from "@/lib/financeiro/formato";
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
  // O congelamento (04.5-08-PLAN.md, D-21) — `unknown` de propósito: só `lerDoSnapshot`
  // (lib/orcamentos/snapshot.ts) sabe interpretar esta coluna, e só quando `status !== "rascunho"`
  // (o invariante de banco `(status='rascunho') = (snapshot is null)` garante que aqui nunca é
  // `null` fora de rascunho).
  snapshot: unknown;
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
      snapshot: orcamentos.snapshot,
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

// ---------------------------------------------------------------------------------------------
// "Atualizar preços" (04.5-09-PLAN.md, Tarefa 2) — o histórico de revisões, para o painel "Só
// para você"
// ---------------------------------------------------------------------------------------------

export type RevisaoDoOrcamento = {
  revisao: number;
  // `orcamento_revisoes.enviado_em` é um INSTANTE (timestamptz — o `congelado_em` de então),
  // convertido para data CIVIL de Brasília aqui na borda (`hojeEmBrasilia`, a mesma função que
  // resolve "hoje" em `lib/orcamentos/acoes.ts`, aqui aplicada a um instante passado) — nunca
  // `.toISOString().slice(0, 10)`, que truncaria em UTC e erraria o dia à noite.
  enviadoEmCivil: string;
  totalCentavos: number;
};

// Em ordem crescente de revisão (a mais antiga primeiro) — o histórico se lê como uma linha do
// tempo, "revisão 1 de..., revisão 2 de...", nunca do mais recente para o mais antigo.
export async function listarRevisoes(orcamentoId: string): Promise<RevisaoDoOrcamento[]> {
  const linhas = await db
    .select({
      revisao: orcamentoRevisoes.revisao,
      enviadoEm: orcamentoRevisoes.enviadoEm,
      totalCentavos: orcamentoRevisoes.totalCentavos,
    })
    .from(orcamentoRevisoes)
    .where(eq(orcamentoRevisoes.orcamentoId, orcamentoId))
    .orderBy(asc(orcamentoRevisoes.revisao));

  return linhas.map((linha) => ({
    revisao: linha.revisao,
    enviadoEmCivil: linha.enviadoEm ? hojeEmBrasilia(linha.enviadoEm) : "",
    totalCentavos: linha.totalCentavos,
  }));
}

// ---------------------------------------------------------------------------------------------
// Fotos de referência (04.5-10-PLAN.md, Tarefa 3)
// ---------------------------------------------------------------------------------------------

export type FotoDoOrcamento = {
  id: string;
  legenda: string | null;
  ordem: number;
};

// A grade de fotos do editor (Tarefa 4) — nunca o BYTE da foto (a tela busca cada imagem por
// `/api/orcamentos/fotos/<id>`, na rota autenticada; esta consulta só devolve o que a tela
// precisa para montar a grade e o texto de cada célula).
export async function listarFotosDoOrcamento(orcamentoId: string): Promise<FotoDoOrcamento[]> {
  return db
    .select({
      id: orcamentoFotos.id,
      legenda: orcamentoFotos.legenda,
      ordem: orcamentoFotos.ordem,
    })
    .from(orcamentoFotos)
    .where(eq(orcamentoFotos.orcamentoId, orcamentoId))
    .orderBy(asc(orcamentoFotos.ordem));
}

// ---------------------------------------------------------------------------------------------
// O PDF do cliente (04.5-11-PLAN.md, Tarefa 4)
// ---------------------------------------------------------------------------------------------

export type FotoParaPdf = {
  id: string;
  legenda: string | null;
  arquivo: string;
};

// A ÚNICA consulta de fotos que a rota do PDF faz — diferente de `listarFotosDoOrcamento`
// (Tarefa 3, que a tela usa) porque o SERVIDOR precisa do NOME do arquivo para ler os bytes com
// `caminhoDaFoto()` (a tela nunca lê byte: busca cada foto por
// `/api/orcamentos/fotos/<id>`). Mesma ordem (`ordem asc`) das demais consultas de foto do
// módulo.
export async function listarFotosParaPdf(orcamentoId: string): Promise<FotoParaPdf[]> {
  return db
    .select({
      id: orcamentoFotos.id,
      legenda: orcamentoFotos.legenda,
      arquivo: orcamentoFotos.arquivo,
    })
    .from(orcamentoFotos)
    .where(eq(orcamentoFotos.orcamentoId, orcamentoId))
    .orderBy(asc(orcamentoFotos.ordem));
}

export type FotoParaLeitura = {
  orcamentoId: string;
  arquivo: string;
};

// A ÚNICA consulta que `GET /api/orcamentos/fotos/[id]` faz (D-27/T-04.5-47): resolve o NOME do
// arquivo em disco a partir do identificador da foto — nunca o inverso. A rota nunca concatena
// texto vindo da requisição; o `arquivo` que sai daqui é sempre o que `anexarFotoDeOrcamento`
// gerou no servidor (`caminhoDaFoto`, plano 03, recusa qualquer formato diferente).
export async function obterFotoParaLeitura(id: string): Promise<FotoParaLeitura | null> {
  const [linha] = await db
    .select({ orcamentoId: orcamentoFotos.orcamentoId, arquivo: orcamentoFotos.arquivo })
    .from(orcamentoFotos)
    .where(eq(orcamentoFotos.id, id))
    .limit(1);

  return linha ?? null;
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

// Leituras da Produção (Fase 06.1) — sem diretiva: nada aqui é Server Action (quem chama é Server
// Component ou ação que já autorizou). Molde "consulta principal + filhos casados por `Map`" de
// `lib/estoque/consultas.ts`. As regras (etapa atual, dias, selo, colunas) moram no módulo puro;
// estas funções só carregam o que ele precisa.
import { asc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { ordemEtapas, ordemPecas, ordensProducao } from "@/db/schema";

import type { CaminhoOrdem, StatusOrdem, TipoOrdem } from "./etapas";
import type { EtapaDaOrdem, OrdemParaLeitura } from "./leitura";

export type PecaDaOrdem = {
  id: string;
  posicao: number;
  descricao: string;
  quantidade: number;
  aMais: number;
  cor: string | null;
  personalizacao: string | null;
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
};

export type OrdemCarregada = OrdemEmAndamento & { pecas: PecaDaOrdem[] };

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

// Um id que não tem a forma de um uuid nunca chega ao banco (o Postgres responderia 22P02 e a
// página cairia no erro de carregamento em vez do 404) — id malformado e id que nunca existiu
// respondem igual: `null`.
const FORMA_DE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A ordem inteira (qualquer status), com etapas e peças por posição; `null` se não existe.
export async function obterOrdem(id: string): Promise<OrdemCarregada | null> {
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
  const [etapas, pecas] = await Promise.all([
    db
      .select(COLUNAS_DA_ETAPA)
      .from(ordemEtapas)
      .where(eq(ordemEtapas.ordemId, id))
      .orderBy(asc(ordemEtapas.posicao)),
    db
      .select(COLUNAS_DA_PECA)
      .from(ordemPecas)
      .where(eq(ordemPecas.ordemId, id))
      .orderBy(asc(ordemPecas.posicao)),
  ]);
  return {
    ...ordem,
    etapas: etapas.map(semOrdemId),
    pecas: pecas.map(semOrdemId),
    totalPecas: pecas.reduce((total, peca) => total + peca.quantidade, 0),
    totalAMais: pecas.reduce((total, peca) => total + peca.aMais, 0),
  };
}

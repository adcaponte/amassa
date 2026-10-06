// Leituras da Agenda — o USO LIVRE e os PREÇOS: o uso na semana e na folha, o material do uso, os
// itens do sistema no Catálogo e o preço da hora (D-24/P10, plano 06.5-27 — saíram de `consultas.ts`,
// que agora é o índice).
// Sem diretiva, como o antigo `consultas.ts`: leituras chamadas só por Server Components e pelas
// ações, depois de `exigirUsuario()` (ver o comentário de topo do índice `consultas.ts`).

import { and, asc, eq, gte, inArray, isNotNull, lte } from "drizzle-orm";

import { db } from "@/db";
import { clientes, itensCatalogo, usosLivres, usosLivresMaterial } from "@/db/schema";
import type { Unidade } from "@/lib/cadastros/catalogo";
import { obterConfiguracaoFinanceira } from "@/lib/financeiro/consultas";

import { lerCobranca, type TransacaoDoBanco } from "./gravacao";
import { horaDe, minutosDe } from "./horario";
import {
  situacaoDaCobranca,
  subLinhaDaCobranca,
  type SituacaoDaCobranca,
} from "./receber";
import { FRASE_ITENS_DA_AGENDA_SUMIRAM } from "./textos";
import type { EstadoUsoLivre } from "./tipos";
import { precisaEncerrar, saidaPrevista } from "./uso-livre";

import { hhmm, type LeitorDeConsulta } from "./consultas-comum";
import type { SituacaoDePagamento } from "./consultas-receber";

// Um uso livre do espaço na semana (plano 09 — 05-UI-SPEC.md §"Cartão de evento"): a hora de chegada
// (a real, depois de "Chegou"; antes, a prevista), "Uso livre · {nome}", "{n} pessoa(s)" e a sub-linha
// com o fim (o previsto; encerrado, a saída real). `encerrar` é a D-18: dia passado ainda no espaço.
export type UsoLivreDaSemana = {
  id: string;
  tipo: "uso_livre";
  data: string;
  inicio: string;
  fim: string;
  // O nome da pessoa — o cartão escreve "Uso livre · {nome}"; desempata o mesmo horário.
  titulo: string;
  pessoas: number;
  estado: EstadoUsoLivre;
  encerrar: boolean;
  // (Plano 13) A situação do pagamento do uso ENCERRADO (“a receber” / “lançado na Venda” / “pago” /
  // “venda nº {N} cancelada”), derivada do Financeiro; nula antes de encerrar.
  pagamento: SituacaoDePagamento | null;
};

type LinhaDoUsoLivre = {
  id: string;
  data: string;
  nome: string;
  chegadaPrevista: string;
  horasPrevistas: number;
  pessoas: number;
  estado: EstadoUsoLivre;
  chegada: string | null;
  saida: string | null;
};

const COLUNAS_DO_USO_LIVRE = {
  id: usosLivres.id,
  data: usosLivres.data,
  nome: clientes.nome,
  chegadaPrevista: usosLivres.chegadaPrevista,
  horasPrevistas: usosLivres.horasPrevistas,
  pessoas: usosLivres.pessoas,
  estado: usosLivres.estado,
  chegada: usosLivres.chegada,
  saida: usosLivres.saida,
};

export function usoLivreDaSemana(linha: LinhaDoUsoLivre, hoje: string): UsoLivreDaSemana {
  const chegou = linha.chegada ?? linha.chegadaPrevista;
  return {
    id: linha.id,
    tipo: "uso_livre",
    data: linha.data,
    inicio: horaDe(minutosDe(chegou)),
    fim:
      linha.estado === "encerrado" && linha.saida !== null
        ? horaDe(minutosDe(linha.saida))
        : saidaPrevista(chegou, linha.horasPrevistas),
    titulo: linha.nome,
    pessoas: linha.pessoas,
    estado: linha.estado,
    encerrar: precisaEncerrar({ data: linha.data, estado: linha.estado }, hoje),
    pagamento: null,
  };
}

// Os usos livres entre `de` e `ate` (inclusive), com o nome da pessoa — todos os estados: a reserva, o
// uso no espaço e o encerrado ficam na agenda (só a reserva cancelada sai, e ela é apagada).
export async function usosLivresEntre(de: string, ate: string): Promise<LinhaDoUsoLivre[]> {
  return db
    .select(COLUNAS_DO_USO_LIVRE)
    .from(usosLivres)
    .innerJoin(clientes, eq(clientes.id, usosLivres.clienteId))
    .where(and(gte(usosLivres.data, de), lte(usosLivres.data, ate)))
    .orderBy(asc(usosLivres.data), asc(usosLivres.criadoEm), asc(usosLivres.id));
}

// Os três itens do Catálogo que a Agenda usa para cobrar (D-04, D-17, AGE-17) — achados SÓ pela
// `chave_do_sistema`, nunca pelo nome, que o dono edita em Cadastros. O preço vem daqui (o da hora
// do uso livre) ou da turma/evento: nenhum valor no código. Usada pelos planos de cobrança
// (05-09, 05-11, 05-12).
export type ItemDoSistema = {
  id: string;
  nome: string;
  precoVendaCentavos: number | null;
  categoriaVendaId: string | null;
};

export type ItensDoSistema = {
  mensalidade: ItemDoSistema;
  inscricaoOficina: ItemDoSistema;
  usoLivreHora: ItemDoSistema;
};

const CHAVES_DOS_ITENS_DO_SISTEMA = ["mensalidade", "inscricao_oficina", "uso_livre_hora"] as const;

// O leitor é o `db` por padrão; `encerrarUsoLivre` passa a TRANSAÇÃO, para ler o preço da hora junto da
// trava do uso e congelá-lo (plano 09).
export async function obterItensDoSistema(leitor: LeitorDeConsulta = db): Promise<ItensDoSistema> {
  const linhas = await (leitor as Pick<TransacaoDoBanco, "select">)
    .select({
      chaveDoSistema: itensCatalogo.chaveDoSistema,
      id: itensCatalogo.id,
      nome: itensCatalogo.nome,
      precoVendaCentavos: itensCatalogo.precoVendaCentavos,
      categoriaVendaId: itensCatalogo.categoriaVendaId,
    })
    .from(itensCatalogo)
    .where(inArray(itensCatalogo.chaveDoSistema, [...CHAVES_DOS_ITENS_DO_SISTEMA]));

  const porChave = new Map(
    linhas.map(({ chaveDoSistema, ...item }) => [chaveDoSistema, item] as const),
  );
  const mensalidade = porChave.get("mensalidade");
  const inscricaoOficina = porChave.get("inscricao_oficina");
  const usoLivreHora = porChave.get("uso_livre_hora");
  if (!mensalidade || !inscricaoOficina || !usoLivreHora) {
    console.error(FRASE_ITENS_DA_AGENDA_SUMIRAM, {
      encontrados: linhas.map((linha) => linha.chaveDoSistema),
    });
    throw new Error(FRASE_ITENS_DA_AGENDA_SUMIRAM);
  }
  return { mensalidade, inscricaoOficina, usoLivreHora };
}

// O uso livre aberto na folha (`?uso={id}`, plano 09) — `null` se ele não existe (reserva cancelada em
// outro celular, link velho). Traz o que o cartão já sabe, as horas de parede em "HH:MM", o que foi
// CONGELADO no encerramento (horas cheias, preço da hora, valor) e o preço da hora de AGORA, achado pela
// chave do item "Uso livre (hora)" (D-04, D-17 — renomear o item em Cadastros não muda nada). O preço
// de agora só serve à conta que a folha mostra antes de encerrar; quem grava é `encerrarUsoLivre`, que o
// lê de novo sob a trava.
export type UsoLivreCarregado = UsoLivreDaSemana & {
  clienteId: string;
  chegadaPrevista: string;
  horasPrevistas: number;
  chegada: string | null;
  saida: string | null;
  // A saída prevista: chegada (a real, quando houver) + horas previstas.
  saidaPrevista: string;
  horasCheias: number | null;
  precoHoraCongeladoCentavos: number | null;
  valorCentavos: number | null;
  precoHoraAtualCentavos: number | null;
  // O material do uso (plano 10 — AGE-14), na ordem em que foi acrescentado.
  materiais: MaterialDoUso[];
  // O preço de venda de AGORA de cada item ativo com estoque próprio que TEM preço (D-14: "Cobrar" só
  // para eles) — só para a linha de acrescentar, antes de encerrar; vazio no uso encerrado.
  precosDeVenda: Record<string, number>;
  // A cobrança do uso ENCERRADO (plano 11 — AGE-15): a situação derivada do Financeiro, o número da venda
  // ligada, o topo do “Recebi agora” e a taxa do cartão de agora. Nula antes de encerrar.
  cobranca: CobrancaDoUsoLivre | null;
};

export type CobrancaDoUsoLivre = {
  situacao: SituacaoDaCobranca;
  numeroDaVenda: number | null;
  descricao: string;
  taxaCartaoPontosBase: number;
};

export async function obterUsoLivre(id: string, hoje: string): Promise<UsoLivreCarregado | null> {
  const [[linha], itens, materiais] = await Promise.all([
    db
      .select({
        ...COLUNAS_DO_USO_LIVRE,
        clienteId: usosLivres.clienteId,
        horasCheias: usosLivres.horasCheias,
        precoHoraCentavos: usosLivres.precoHoraCentavos,
        valorCentavos: usosLivres.valorCentavos,
      })
      .from(usosLivres)
      .innerJoin(clientes, eq(clientes.id, usosLivres.clienteId))
      .where(eq(usosLivres.id, id)),
    obterItensDoSistema(),
    materiaisDoUso(id),
  ]);
  if (!linha) {
    return null;
  }
  const naSemana = usoLivreDaSemana(linha, hoje);
  const encerrado = linha.estado === "encerrado";
  const [precosDeVenda, cobranca] = await Promise.all([
    encerrado ? Promise.resolve({}) : precosDeVendaDoEstoque(),
    encerrado ? cobrancaDoUsoLivre(id) : Promise.resolve(null),
  ]);
  return {
    ...naSemana,
    pagamento: cobranca === null ? null : { situacao: cobranca.situacao, numeroDaVenda: cobranca.numeroDaVenda },
    clienteId: linha.clienteId,
    chegadaPrevista: hhmm(linha.chegadaPrevista) ?? naSemana.inicio,
    horasPrevistas: linha.horasPrevistas,
    chegada: hhmm(linha.chegada),
    saida: hhmm(linha.saida),
    saidaPrevista: saidaPrevista(linha.chegada ?? linha.chegadaPrevista, linha.horasPrevistas),
    horasCheias: linha.horasCheias,
    precoHoraCongeladoCentavos: linha.precoHoraCentavos,
    valorCentavos: linha.valorCentavos,
    precoHoraAtualCentavos: itens.usoLivreHora.precoVendaCentavos,
    materiais,
    precosDeVenda,
    cobranca,
  };
}

// Uma linha do "Material usado" (AGE-14): o item com o nome e a unidade de agora, a quantidade em
// milésimos, se cobra, o preço de venda de AGORA (a prévia da conta antes de encerrar) e o que foi
// CONGELADO no encerramento (preço unitário e valor — só no cobrado, D-14). `baixado` = já saiu do
// Estoque (`movimentacao_id`): nunca mais se tira nem se muda.
export type MaterialDoUso = {
  id: string;
  itemId: string;
  nome: string;
  unidade: Unidade;
  quantidadeMilesimos: number;
  cobrar: boolean;
  precoVendaAtualCentavos: number | null;
  precoUnitarioCentavos: number | null;
  valorCentavos: number | null;
  baixado: boolean;
};

// O material de um uso livre, na ordem em que foi acrescentado (`criado_em`, depois o id). O item de
// estoque tem sempre unidade (o check do Catálogo exige unidade em quem controla estoque); a falta dela
// cai em "un" só para a tela não quebrar.
export async function materiaisDoUso(usoLivreId: string, leitor: LeitorDeConsulta = db): Promise<MaterialDoUso[]> {
  const linhas = await (leitor as Pick<TransacaoDoBanco, "select">)
    .select({
      id: usosLivresMaterial.id,
      itemId: usosLivresMaterial.itemId,
      nome: itensCatalogo.nome,
      unidade: itensCatalogo.unidade,
      quantidadeMilesimos: usosLivresMaterial.quantidadeMilesimos,
      cobrar: usosLivresMaterial.cobrar,
      precoVendaAtualCentavos: itensCatalogo.precoVendaCentavos,
      precoUnitarioCentavos: usosLivresMaterial.precoUnitarioCentavos,
      valorCentavos: usosLivresMaterial.valorCentavos,
      movimentacaoId: usosLivresMaterial.movimentacaoId,
    })
    .from(usosLivresMaterial)
    .innerJoin(itensCatalogo, eq(itensCatalogo.id, usosLivresMaterial.itemId))
    .where(eq(usosLivresMaterial.usoLivreId, usoLivreId))
    .orderBy(asc(usosLivresMaterial.criadoEm), asc(usosLivresMaterial.id));
  return linhas.map(({ movimentacaoId, unidade, ...linha }) => ({
    ...linha,
    unidade: unidade ?? "un",
    baixado: movimentacaoId !== null,
  }));
}

// O preço de venda de agora dos itens ativos com estoque próprio que têm preço — o que decide, na tela,
// se a linha de acrescentar mostra "Cobrar" (D-14). O servidor confere de novo ao acrescentar e congela
// ao encerrar; isto é só a tela.
export async function precosDeVendaDoEstoque(): Promise<Record<string, number>> {
  const linhas = await db
    .select({ id: itensCatalogo.id, preco: itensCatalogo.precoVendaCentavos })
    .from(itensCatalogo)
    .where(
      and(
        eq(itensCatalogo.controlaEstoque, true),
        eq(itensCatalogo.ativo, true),
        isNotNull(itensCatalogo.precoVendaCentavos),
      ),
    );
  const precos: Record<string, number> = {};
  for (const linha of linhas) {
    if (linha.preco !== null) {
      precos[linha.id] = linha.preco;
    }
  }
  return precos;
}

// O preço da hora do uso livre agora (a dica da folha "Lançar na agenda") — pela chave, nunca pelo nome.
export async function precoDaHoraDoUsoLivre(): Promise<number | null> {
  return (await obterItensDoSistema()).usoLivreHora.precoVendaCentavos;
}

// A cobrança do uso livre encerrado, para o rodapé da folha (“Recebi agora” enquanto a receber).
async function cobrancaDoUsoLivre(usoLivreId: string): Promise<CobrancaDoUsoLivre | null> {
  const [cobranca, configuracao] = await Promise.all([
    lerCobranca(db, { tipo: "uso_livre", id: usoLivreId }),
    obterConfiguracaoFinanceira(),
  ]);
  if (cobranca === null || cobranca.tipo !== "uso_livre") {
    return null;
  }
  return {
    situacao: situacaoDaCobranca(cobranca),
    numeroDaVenda: cobranca.numeroDaVenda,
    descricao: subLinhaDaCobranca(cobranca),
    taxaCartaoPontosBase: configuracao.taxaCartaoPontosBase,
  };
}

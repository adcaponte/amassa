// Leituras da Agenda — o A RECEBER: as linhas, a cobrança para a venda, as dispensadas e a situação
// de pagamento que a semana, a folha e as pessoas mostram (D-24/P10, plano 06.5-27 — saíram de
// `consultas.ts`, que agora é o índice).
// Sem diretiva, como o antigo `consultas.ts`: leituras chamadas só por Server Components e pelas
// ações, depois de `exigirUsuario()` (ver o comentário de topo do índice `consultas.ts`).

import { and, asc, count, desc, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";

import { db } from "@/db";
import {
  clientes,
  documentos,
  eventos,
  inscricoes,
  mensalidades,
  turmas,
  usosLivres,
  usuarios,
} from "@/db/schema";
import { obterConfiguracaoFinanceira } from "@/lib/financeiro/consultas";
import { hojeEmBrasilia } from "@/lib/financeiro/formato";
import { formatarDiaMes } from "@/lib/producao/calendario";

import { lerCobranca, lerCobrancas, type ReferenciaDaCobranca } from "./gravacao";
import {
  dataDeVencimento,
  descricaoDaLinha,
  itensAReceber,
  linhasDaVenda,
  loteDeMensalidades,
  DISPENSADAS_POR_VEZ,
  ordenarDispensadas,
  podeDispensar,
  situacaoDaCobranca,
  subLinhaDaCobranca,
  totalAReceber,
  type ItensDoSistema as ItensDoSistemaParaVenda,
  type CobrancaDaAgenda,
  type LinhaDaVendaDaAgenda,
  type LoteDeMensalidades,
  type SituacaoDaCobranca,
  type TipoDeCobranca,
} from "./receber";
import { FRASE_ITENS_DA_AGENDA_SUMIRAM } from "./textos";

import { type ItensDoSistema, obterItensDoSistema } from "./consultas-uso-livre";

// ── “A receber” (plano 11 — AGE-15; 05-UI-SPEC.md §“Aba A receber”) ─────────────────────────────────────

// Uma linha de “A receber”, pronta para a tela: tudo o que ela mostra e a referência da cobrança — o
// “Recebi agora” manda só `{ tipo, id }` e a forma; o resto o servidor relê sob a trava.
export type LinhaAReceber = {
  tipo: TipoDeCobranca;
  id: string;
  nome: string;
  valorCentavos: number;
  subLinha: string;
  situacao: "a_receber" | "venda_cancelada";
  // O número da venda cancelada (a tag “venda nº {N} cancelada”, D-08); nulo sem venda.
  numeroDaVenda: number | null;
  // A descrição D-04 (o `aria-label` de “Dispensar a cobrança”) e se a linha tem esse link (D-09: só
  // mensalidade e inscrição livres — `podeDispensar`, módulo puro).
  descricao: string;
  podeDispensar: boolean;
};

export type AReceberCarregado = {
  linhas: LinhaAReceber[];
  totalCentavos: number;
  // A taxa do cartão de agora (Cadastros → Taxas) — a linha “a maquininha fica com {x}%” da folha.
  taxaCartaoPontosBase: number;
  // A sanfona do lote (plano 12 — AGE-16): as mensalidades livres, por turma e nome, e o total exato.
  lote: LoteDeMensalidades;
  // “Dispensadas ({N})” no fim (plano 13 — D-09, UI-D15): 20 por vez.
  dispensadas: DispensadasCarregadas;
  quantasDispensadas: number;
};

// O que falta receber: as cobranças sem venda ativa e não dispensadas, pela regra do módulo puro (valor
// > 0, data não cancelada, ordem por vencimento). Quem chama já garantiu as mensalidades do mês (D-02).
export async function lerAReceber({
  quantasDispensadas = DISPENSADAS_POR_VEZ,
}: { quantasDispensadas?: number } = {}): Promise<AReceberCarregado> {
  const [cobrancas, configuracao, dispensadas] = await Promise.all([
    lerCobrancas(db, { soLivres: true }),
    obterConfiguracaoFinanceira(),
    lerDispensadas({ quantas: quantasDispensadas }),
  ]);
  const itens = itensAReceber(cobrancas);
  return {
    linhas: itens.map((item) => ({
      tipo: item.tipo,
      id: item.id,
      nome: item.nome,
      valorCentavos: item.valorCentavos,
      subLinha: subLinhaDaCobranca(item),
      situacao: item.situacao,
      numeroDaVenda: item.situacao === "venda_cancelada" ? item.numeroDaVenda : null,
      descricao: descricaoDaLinha(item),
      podeDispensar: podeDispensar(item),
    })),
    totalCentavos: totalAReceber(itens),
    taxaCartaoPontosBase: configuracao.taxaCartaoPontosBase,
    lote: loteDeMensalidades(itens),
    dispensadas,
    quantasDispensadas,
  };
}

// O “ · {N}” da aba (UI E15·zero-one-many) — a mesma regra da lista.
export async function quantosAReceber(): Promise<number> {
  return itensAReceber(await lerCobrancas(db, { soLivres: true })).length;
}

// ── “Lançar na Venda” (plano 12 — AGE-15, mecanismo B da pesquisa, UI-D26) ──────────────────────────────

// Os três itens do sistema como a venda os usa: id e categoria de venda. Item com chave nunca perde a
// categoria (aparece na Venda — check e gatilho da 0026); a falta dela é o mesmo defeito de “sumiram”.
// Movido de `acoes.ts` (plano 11) para servir também a `cobrancaParaVenda` e ao lote.
export function itensDoSistemaParaVenda(itens: ItensDoSistema): ItensDoSistemaParaVenda {
  const paraVenda = (item: { id: string; categoriaVendaId: string | null }) => {
    if (item.categoriaVendaId === null) {
      throw new Error(FRASE_ITENS_DA_AGENDA_SUMIRAM);
    }
    return { id: item.id, categoriaId: item.categoriaVendaId };
  };
  return {
    mensalidade: paraVenda(itens.mensalidade),
    inscricaoOficina: paraVenda(itens.inscricaoOficina),
    usoLivreHora: paraVenda(itens.usoLivreHora),
  };
}

// O que a Venda do Financeiro precisa para abrir preenchida a partir de uma cobrança da Agenda. Lido no
// SERVIDOR pela página (`?aba=venda&origem=`): o navegador nunca manda descrição, cliente nem o valor-base
// da cobrança — e, ao lançar, `lancarVenda` relê tudo sob a trava (`vincularCobranca`).
export type CobrancaParaVenda =
  | {
      situacao: "livre";
      clienteId: string;
      clienteNome: string;
      // D-04: a descrição da linha de origem (a faixa “Da Agenda · {descrição} · {nome}”).
      descricao: string;
      // O “Vence em” do à vista em aberto: o vencimento da mensalidade; a data do evento ou do uso.
      vencimento: string;
      // As linhas da venda (`linhasDaVenda`): a primeira é a linha de origem (o item do sistema).
      linhas: LinhaDaVendaDaAgenda[];
      itemDoSistemaId: string;
    }
  | { situacao: "ja_lancada"; numero: number }
  | { situacao: "nao_achada" };

export async function cobrancaParaVenda(origem: ReferenciaDaCobranca): Promise<CobrancaParaVenda> {
  const [cobranca, itens] = await Promise.all([lerCobranca(db, origem), obterItensDoSistema()]);
  if (cobranca === null) {
    return { situacao: "nao_achada" };
  }
  const situacao = situacaoDaCobranca(cobranca);
  if ((situacao === "lancado" || situacao === "pago") && cobranca.numeroDaVenda !== null) {
    return { situacao: "ja_lancada", numero: cobranca.numeroDaVenda };
  }
  if (
    situacao === "dispensada" ||
    cobranca.valorCentavos <= 0 ||
    (cobranca.tipo === "inscricao" && cobranca.dataCancelada)
  ) {
    return { situacao: "nao_achada" };
  }
  const paraVenda = itensDoSistemaParaVenda(itens);
  const itemDoSistema =
    cobranca.tipo === "mensalidade"
      ? paraVenda.mensalidade
      : cobranca.tipo === "inscricao"
        ? paraVenda.inscricaoOficina
        : paraVenda.usoLivreHora;
  return {
    situacao: "livre",
    clienteId: cobranca.clienteId,
    clienteNome: cobranca.nome,
    descricao: descricaoDaLinha(cobranca),
    vencimento: dataDeVencimento(cobranca),
    // `linhasDaVenda` começa SEMPRE pela linha do item do sistema (a linha de origem).
    linhas: linhasDaVenda(cobranca, paraVenda),
    itemDoSistemaId: itemDoSistema.id,
  };
}

// ── “Dispensadas” (plano 13 — D-09, UI-D15; 05-UI-SPEC.md §“Aba A receber”, item 4) ─────────────────────

// Uma linha de “Dispensadas”: “{nome} · {descrição}” + “dispensada por {quem} em {dd/mm}” + “ · {motivo}”,
// e a referência que o “Desfazer” manda (`{ tipo, id }` + o estado desejado).
export type DispensadaCarregada = {
  // O uso livre entra desde a decisão do dono no chat, 02/10/2026 (0027): só com a venda cancelada.
  tipo: "mensalidade" | "inscricao" | "uso_livre";
  id: string;
  nome: string;
  // A descrição D-04 da cobrança (“Mensalidade · {turma} · {mês}”, “{oficina} · {dd/mm}”…).
  descricao: string;
  // O nome de quem dispensou (o usuário de `dispensada_por`).
  quem: string;
  // ISO — a ordem; e o dia em Brasília, já como “dd/mm”.
  dispensadaEm: string;
  diaMes: string;
  motivo: string | null;
};

export type DispensadasCarregadas = {
  linhas: DispensadaCarregada[];
  // O N de “Dispensadas ({N})” — todas, não só as que a página carregou.
  total: number;
};

// As cobranças dispensadas que ainda podem voltar para “A receber” — sem venda ATIVA (a dispensa nunca
// convive com uma; o filtro é defesa) e, na inscrição, com a data de pé —, as mais recentes primeiro, até
// `quantas` (20 por vez). Três leituras limitadas (mensalidades, inscrições e — desde a decisão do dono no
// chat, 02/10/2026, migração 0027 — usos livres) e a mistura pelo módulo puro.
export async function lerDispensadas({ quantas }: { quantas: number }): Promise<DispensadasCarregadas> {
  const semVendaAtivaDaMensalidade = and(
    isNotNull(mensalidades.dispensadaEm),
    or(isNull(mensalidades.documentoId), isNotNull(documentos.canceladoEm)),
  );
  const semVendaAtivaDaInscricao = and(
    eq(inscricoes.cobrar, true),
    isNotNull(inscricoes.dispensadaEm),
    isNull(eventos.canceladoEm),
    or(isNull(inscricoes.documentoId), isNotNull(documentos.canceladoEm)),
  );
  // O uso livre dispensado tem sempre venda (check `usos_livres_dispensa_so_com_venda`), e ela está
  // cancelada (`podeDispensar`, sob a trava); o `or` é a mesma defesa das outras duas.
  const semVendaAtivaDoUsoLivre = and(
    isNotNull(usosLivres.dispensadaEm),
    or(isNull(usosLivres.documentoId), isNotNull(documentos.canceladoEm)),
  );

  const [doMes, inscritas, usos, [contaDoMes], [contaInscritas], [contaUsos]] = await Promise.all([
    db
      .select({
        id: mensalidades.id,
        nome: clientes.nome,
        turma: turmas.nome,
        mes: mensalidades.mes,
        quem: usuarios.nome,
        dispensadaEm: mensalidades.dispensadaEm,
        motivo: mensalidades.motivoDispensa,
      })
      .from(mensalidades)
      .innerJoin(clientes, eq(clientes.id, mensalidades.clienteId))
      .innerJoin(turmas, eq(turmas.id, mensalidades.turmaId))
      .innerJoin(usuarios, eq(usuarios.id, mensalidades.dispensadaPor))
      .leftJoin(documentos, eq(documentos.id, mensalidades.documentoId))
      .where(semVendaAtivaDaMensalidade)
      .orderBy(desc(mensalidades.dispensadaEm), asc(mensalidades.id))
      .limit(quantas),
    db
      .select({
        id: inscricoes.id,
        nome: clientes.nome,
        tipo: inscricoes.tipo,
        tituloDoEvento: eventos.titulo,
        nomeDaTurma: turmas.nome,
        data: eventos.data,
        quem: usuarios.nome,
        dispensadaEm: inscricoes.dispensadaEm,
        motivo: inscricoes.motivoDispensa,
      })
      .from(inscricoes)
      .innerJoin(eventos, eq(eventos.id, inscricoes.eventoId))
      .innerJoin(clientes, eq(clientes.id, inscricoes.clienteId))
      .innerJoin(usuarios, eq(usuarios.id, inscricoes.dispensadaPor))
      .leftJoin(turmas, eq(turmas.id, eventos.turmaId))
      .leftJoin(documentos, eq(documentos.id, inscricoes.documentoId))
      .where(semVendaAtivaDaInscricao)
      .orderBy(desc(inscricoes.dispensadaEm), asc(inscricoes.id))
      .limit(quantas),
    db
      .select({
        id: usosLivres.id,
        nome: clientes.nome,
        horas: usosLivres.horasCheias,
        pessoas: usosLivres.pessoas,
        data: usosLivres.data,
        quem: usuarios.nome,
        dispensadaEm: usosLivres.dispensadaEm,
        motivo: usosLivres.motivoDispensa,
      })
      .from(usosLivres)
      .innerJoin(clientes, eq(clientes.id, usosLivres.clienteId))
      .innerJoin(usuarios, eq(usuarios.id, usosLivres.dispensadaPor))
      .leftJoin(documentos, eq(documentos.id, usosLivres.documentoId))
      .where(semVendaAtivaDoUsoLivre)
      .orderBy(desc(usosLivres.dispensadaEm), asc(usosLivres.id))
      .limit(quantas),
    db
      .select({ quantas: count() })
      .from(mensalidades)
      .leftJoin(documentos, eq(documentos.id, mensalidades.documentoId))
      .where(semVendaAtivaDaMensalidade),
    db
      .select({ quantas: count() })
      .from(inscricoes)
      .innerJoin(eventos, eq(eventos.id, inscricoes.eventoId))
      .leftJoin(documentos, eq(documentos.id, inscricoes.documentoId))
      .where(semVendaAtivaDaInscricao),
    db
      .select({ quantas: count() })
      .from(usosLivres)
      .leftJoin(documentos, eq(documentos.id, usosLivres.documentoId))
      .where(semVendaAtivaDoUsoLivre),
  ]);

  const linhas: DispensadaCarregada[] = [];
  for (const linha of doMes) {
    if (linha.dispensadaEm === null) {
      continue;
    }
    linhas.push({
      tipo: "mensalidade",
      id: linha.id,
      nome: linha.nome,
      descricao: descricaoDaLinha({ tipo: "mensalidade", turma: linha.turma, mes: linha.mes }),
      quem: linha.quem,
      dispensadaEm: linha.dispensadaEm.toISOString(),
      diaMes: formatarDiaMes(hojeEmBrasilia(linha.dispensadaEm)),
      motivo: linha.motivo,
    });
  }
  for (const linha of inscritas) {
    if (linha.dispensadaEm === null) {
      continue;
    }
    const experimental = linha.tipo === "experimental";
    linhas.push({
      tipo: "inscricao",
      id: linha.id,
      nome: linha.nome,
      descricao: descricaoDaLinha({
        tipo: "inscricao",
        experimental,
        // O mesmo título de `lerInscricoesCobradas`: a experimental leva o nome da turma.
        titulo: experimental
          ? (linha.nomeDaTurma ?? linha.tituloDoEvento ?? "")
          : (linha.tituloDoEvento ?? linha.nomeDaTurma ?? ""),
        data: linha.data,
      }),
      quem: linha.quem,
      dispensadaEm: linha.dispensadaEm.toISOString(),
      diaMes: formatarDiaMes(hojeEmBrasilia(linha.dispensadaEm)),
      motivo: linha.motivo,
    });
  }
  for (const linha of usos) {
    if (linha.dispensadaEm === null) {
      continue;
    }
    linhas.push({
      tipo: "uso_livre",
      id: linha.id,
      nome: linha.nome,
      // Não-nulas no encerrado (check `usos_livres_encerrado_completo`); a dispensa exige encerrado.
      descricao: descricaoDaLinha({ tipo: "uso_livre", horas: linha.horas ?? 0, pessoas: linha.pessoas, data: linha.data }),
      quem: linha.quem,
      dispensadaEm: linha.dispensadaEm.toISOString(),
      diaMes: formatarDiaMes(hojeEmBrasilia(linha.dispensadaEm)),
      motivo: linha.motivo,
    });
  }

  return {
    linhas: ordenarDispensadas(linhas).slice(0, quantas),
    total:
      Number(contaDoMes?.quantas ?? 0) + Number(contaInscritas?.quantas ?? 0) + Number(contaUsos?.quantas ?? 0),
  };
}

// ── O pagamento onde o gestor olha (plano 13 — D-02, D-08, D-09; 05-UI-SPEC.md §Color, tags de pagamento) ──
//
// Todas as leituras abaixo passam pela MESMA derivação de “A receber” — `lerCobrancas` (a venda ligada e as
// parcelas em aberto) + `situacaoDaCobranca` / `itensAReceber` (módulo puro). Nada é gravado na Agenda: a
// venda cancelada no Caixa muda a tag sozinha (D-08), e a dispensa vira a tag neutra “dispensada” (D-09).

export type SituacaoDePagamento = { situacao: SituacaoDaCobranca; numeroDaVenda: number | null };

function situacaoDePagamento(cobranca: CobrancaDaAgenda): SituacaoDePagamento {
  return { situacao: situacaoDaCobranca(cobranca), numeroDaVenda: cobranca.numeroDaVenda };
}

// Numa data cancelada, a inscrição a receber (ou de venda cancelada) sai de “A receber” — a tag não a cobra.
export function saiDeAReceberAoCancelar(situacao: SituacaoDaCobranca): boolean {
  return situacao === "a_receber" || situacao === "venda_cancelada";
}

// A situação de cada inscrição COBRADA (oficina, experimental cobrada) da data, pelo id da inscrição.
// Valor zero não cobra nada: sem tag.
export async function situacoesDasInscricoes(eventoId: string): Promise<Record<string, SituacaoDePagamento>> {
  const cobrancas = await lerCobrancas(db, { tipos: ["inscricao"], eventoIds: [eventoId] });
  const situacoes: Record<string, SituacaoDePagamento> = {};
  for (const cobranca of cobrancas) {
    if (cobranca.valorCentavos > 0) {
      situacoes[cobranca.id] = situacaoDePagamento(cobranca);
    }
  }
  return situacoes;
}

// A situação da mensalidade de `mes` (“AAAA-MM-01”) de cada aluno da turma, pelo id do cliente — a tag do
// aluno na data de turma. Aluno sem a mensalidade desse mês (mês que ainda não nasceu): sem tag.
export async function situacaoDaMensalidadeDoMes(
  turmaId: string,
  mes: string,
): Promise<Record<string, SituacaoDePagamento>> {
  const cobrancas = await lerCobrancas(db, { tipos: ["mensalidade"], turmaId, mes });
  const situacoes: Record<string, SituacaoDePagamento> = {};
  for (const cobranca of cobrancas) {
    if (cobranca.valorCentavos > 0) {
      situacoes[cobranca.clienteId] = situacaoDePagamento(cobranca);
    }
  }
  return situacoes;
}

// Quantas inscrições cobradas de cada data estão em “A receber” — o “{n} a receber” do cartão. Quem chama
// passa só as datas de pé (a cancelada não deve nada).
export async function aReceberPorEvento(eventoIds: readonly string[]): Promise<Record<string, number>> {
  if (eventoIds.length === 0) {
    return {};
  }
  const [cobrancas, inscritas] = await Promise.all([
    lerCobrancas(db, { tipos: ["inscricao"], soLivres: true, eventoIds }),
    db
      .select({ id: inscricoes.id, eventoId: inscricoes.eventoId })
      .from(inscricoes)
      .where(and(inArray(inscricoes.eventoId, [...eventoIds]), eq(inscricoes.cobrar, true))),
  ]);
  const eventoDaInscricao = new Map(inscritas.map((linha) => [linha.id, linha.eventoId]));
  const porEvento: Record<string, number> = {};
  for (const item of itensAReceber(cobrancas)) {
    const eventoId = eventoDaInscricao.get(item.id);
    if (eventoId !== undefined) {
      porEvento[eventoId] = (porEvento[eventoId] ?? 0) + 1;
    }
  }
  return porEvento;
}

// A situação do pagamento de cada uso livre ENCERRADO pedido, pelo id do uso — a tag do cartão.
export async function situacoesDosUsos(usoIds: readonly string[]): Promise<Record<string, SituacaoDePagamento>> {
  if (usoIds.length === 0) {
    return {};
  }
  const cobrancas = await lerCobrancas(db, { tipos: ["uso_livre"], usoIds });
  const situacoes: Record<string, SituacaoDePagamento> = {};
  for (const cobranca of cobrancas) {
    situacoes[cobranca.id] = situacaoDePagamento(cobranca);
  }
  return situacoes;
}

// O quadro “A RECEBER” da ficha: a soma do que a pessoa deve AGORA — as cobranças livres (a receber, ou
// com a venda cancelada no Caixa), não dispensadas, com valor, e (inscrição) de data de pé. É a MESMA regra
// da lista de “A receber” (`itensAReceber`), recortada pela pessoa. Quem chama já garantiu as mensalidades
// do mês (D-02).
export async function cobrancasDaPessoa(clienteId: string): Promise<number> {
  return totalAReceber(itensAReceber(await lerCobrancas(db, { soLivres: true, clienteIds: [clienteId] })));
}

// A tag “{n} a receber” de cada pessoa da lista de Pessoas (só quem deve aparece no resultado).
export async function aReceberPorCliente(clienteIds: readonly string[]): Promise<Record<string, number>> {
  if (clienteIds.length === 0) {
    return {};
  }
  const porCliente: Record<string, number> = {};
  for (const item of itensAReceber(await lerCobrancas(db, { soLivres: true, clienteIds }))) {
    porCliente[item.clienteId] = (porCliente[item.clienteId] ?? 0) + 1;
  }
  return porCliente;
}

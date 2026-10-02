// Módulo puro da Agenda — o que falta RECEBER (AGE-15, §5: a Agenda não guarda dinheiro). Só importa
// puros (`semana.ts`, `lib/producao/calendario.ts`, `lib/financeiro/formato.ts`, `lib/estoque/saldo.ts`
// e o tipo da unidade do Catálogo); nenhuma linha alcança React, Next, drizzle-orm, pg ou `@/db`, e
// nenhuma lê o relógio.
//
// Três regras moram aqui e só aqui:
//   1. “Pago” é DERIVADO do Financeiro — a venda ligada à cobrança e as parcelas dela —, nunca uma
//      coluna da Agenda. A venda cancelada no Caixa devolve a cobrança a “A receber” SOZINHA (D-08):
//      nada é gravado no cancelamento, e `cancelarDocumento` não sabe que a Agenda existe.
//   2. “A receber” é o que tem valor, não virou venda ATIVA e não foi dispensado — em ordem de
//      vencimento, uma linha por cobrança (a mesma pessoa com mensalidade e inscrição tem duas).
//   3. Como cada cobrança vira LINHAS de venda (D-04/D-14): uma linha do item do sistema, com a
//      descrição da cobrança, e — no uso livre — uma linha LIVRE por material cobrado, na categoria do
//      item “Uso livre (hora)” (Pitfall 3: nunca linha do item de estoque, que daria baixa em dobro).
//      Os itens do sistema chegam como argumento: o módulo nunca procura item por nome.
import type { Unidade } from "@/lib/cadastros/catalogo";
import { ROTULO_UNIDADE } from "@/lib/cadastros/catalogo";
import { textoDeMilesimos } from "@/lib/estoque/saldo";
import { formatarReais } from "@/lib/financeiro/formato";
import { formatarDiaMes } from "@/lib/producao/calendario";

import { nomeDoMes } from "./semana";

export const TIPOS_DE_COBRANCA = ["mensalidade", "inscricao", "uso_livre"] as const;
export type TipoDeCobranca = (typeof TIPOS_DE_COBRANCA)[number];

// Os rótulos do protótipo (`PAGO`, prototipo.html:212) e a D-09: o plano 13 mostra as tags fora de
// “A receber”; aqui só `a_receber` e `venda_cancelada` entram na lista.
export type SituacaoDaCobranca = "a_receber" | "venda_cancelada" | "lancado" | "pago" | "dispensada";

// O teto de `documento_linhas_descricao_comprimento` (length(trim()) entre 1 e 160, em caracteres —
// contados em pontos de código, como o `length()` do Postgres).
export const LIMITE_DA_DESCRICAO = 160;

// O que a consulta lê do Financeiro para cada cobrança.
export type VendaLigada = {
  documentoId: string | null;
  numeroDaVenda: number | null;
  canceladoEm: string | null;
  parcelasEmAberto: number;
  dispensadaEm: string | null;
};

export function situacaoDaCobranca({
  documentoId,
  canceladoEm = null,
  parcelasEmAberto = 0,
  dispensadaEm = null,
}: {
  documentoId: string | null;
  canceladoEm?: string | null;
  parcelasEmAberto?: number;
  dispensadaEm?: string | null;
}): SituacaoDaCobranca {
  // Venda ATIVA manda: a dispensa nunca apaga venda (D-09 só vale para o que não virou venda).
  if (documentoId !== null && canceladoEm === null) {
    return parcelasEmAberto > 0 ? "lancado" : "pago";
  }
  if (dispensadaEm !== null) {
    return "dispensada";
  }
  // Vínculo com venda cancelada conta como livre (D-08) — com a tag “venda nº {N} cancelada”.
  return documentoId !== null ? "venda_cancelada" : "a_receber";
}

export type MaterialDoUsoNaCobranca = {
  nome: string;
  quantidadeMilesimos: number;
  unidade: Unidade;
  cobrar: boolean;
  // CONGELADO no encerramento (D-14); nulo no incluso.
  valorCentavos: number | null;
};

type DadosDaCobranca = {
  id: string;
  clienteId: string;
  // O nome do cliente HOJE — vai congelado para `pessoa_nome` na venda (D-01).
  nome: string;
  valorCentavos: number;
} & VendaLigada;

export type CobrancaDaAgenda = DadosDaCobranca &
  (
    | {
        tipo: "mensalidade";
        turma: string;
        // AAAA-MM-01.
        mes: string;
        vencimento: string;
        proporcional: boolean;
      }
    | {
        tipo: "inscricao";
        // Experimental cobrada numa data de turma (o título é o nome da turma) ou inscrição de oficina.
        experimental: boolean;
        titulo: string;
        data: string;
        dataCancelada: boolean;
      }
    | {
        tipo: "uso_livre";
        horas: number;
        pessoas: number;
        precoHoraCentavos: number;
        data: string;
        materiais: readonly MaterialDoUsoNaCobranca[];
      }
  );

export type ItemAReceber<T extends CobrancaDaAgenda = CobrancaDaAgenda> = T & {
  situacao: "a_receber" | "venda_cancelada";
};

const COMPARADOR_DE_NOMES = new Intl.Collator("pt-BR", { sensitivity: "base" });

// O dia que ordena a lista: a mensalidade pelo vencimento; a inscrição e o uso livre pela data do evento.
export function dataDeVencimento(cobranca: CobrancaDaAgenda): string {
  return cobranca.tipo === "mensalidade" ? cobranca.vencimento : cobranca.data;
}

// O que entra em “A receber”: valor > 0 (experimental gratuita e oficina de preço zero nunca
// aparecem), situação `a_receber` ou `venda_cancelada`, e — na inscrição — data não cancelada.
// Ordem por vencimento, desempate pelo nome (sem acento nem caixa) e pelo id. Devolve lista nova.
export function itensAReceber<T extends CobrancaDaAgenda>(cobrancas: readonly T[]): ItemAReceber<T>[] {
  const itens: ItemAReceber<T>[] = [];
  for (const cobranca of cobrancas) {
    if (cobranca.valorCentavos <= 0) {
      continue;
    }
    if (cobranca.tipo === "inscricao" && cobranca.dataCancelada) {
      continue;
    }
    const situacao = situacaoDaCobranca(cobranca);
    if (situacao !== "a_receber" && situacao !== "venda_cancelada") {
      continue;
    }
    itens.push({ ...cobranca, situacao });
  }
  return itens.sort((a, b) => {
    const porData = dataDeVencimento(a).localeCompare(dataDeVencimento(b));
    if (porData !== 0) {
      return porData;
    }
    const porNome = COMPARADOR_DE_NOMES.compare(a.nome, b.nome);
    if (porNome !== 0) {
      return porNome;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export function totalAReceber(itens: readonly { valorCentavos: number }[]): number {
  return itens.reduce((total, item) => total + item.valorCentavos, 0);
}

// Corta em 160 pontos de código, terminando em “…”, para caber no check da linha da venda.
function cortarDescricao(texto: string): string {
  const caracteres = [...texto.normalize("NFC").trim()];
  if (caracteres.length <= LIMITE_DA_DESCRICAO) {
    return caracteres.join("");
  }
  return `${caracteres.slice(0, LIMITE_DA_DESCRICAO - 1).join("").trimEnd()}…`;
}

// “Uso livre · {h} h” + “ × {n} pessoas” (só com mais de uma — o protótipo, `devidos()`).
function textoDoUsoLivre(horas: number, pessoas: number): string {
  return `Uso livre · ${horas} h${pessoas > 1 ? ` × ${pessoas} pessoas` : ""}`;
}

export type DescricaoDeCobranca =
  | { tipo: "mensalidade"; turma: string; mes: string }
  | { tipo: "inscricao"; experimental: boolean; titulo: string; data: string }
  | { tipo: "uso_livre"; horas: number; pessoas: number; data: string };

// A descrição da linha de venda (D-04): “Mensalidade · {turma} · {mês}”, “{oficina} · {dd/mm}”,
// “Aula experimental · {turma} · {dd/mm}”, “Uso livre · {h} h × {n} pessoas · {dd/mm}”. Até 160.
export function descricaoDaLinha(cobranca: DescricaoDeCobranca): string {
  switch (cobranca.tipo) {
    case "mensalidade":
      return cortarDescricao(`Mensalidade · ${cobranca.turma} · ${nomeDoMes(cobranca.mes)}`);
    case "inscricao":
      return cortarDescricao(
        cobranca.experimental
          ? `Aula experimental · ${cobranca.titulo} · ${formatarDiaMes(cobranca.data)}`
          : `${cobranca.titulo} · ${formatarDiaMes(cobranca.data)}`,
      );
    case "uso_livre":
      return cortarDescricao(
        `${textoDoUsoLivre(cobranca.horas, cobranca.pessoas)} · ${formatarDiaMes(cobranca.data)}`,
      );
  }
}

function materialCobrado(materiais: readonly MaterialDoUsoNaCobranca[]): number {
  return materiais.reduce(
    (soma, material) => soma + (material.cobrar && material.valorCentavos !== null ? material.valorCentavos : 0),
    0,
  );
}

// A sub-linha de “A receber” (UI-SPEC §“Lote e A receber — linhas de leitura”).
export function subLinhaDaCobranca(cobranca: CobrancaDaAgenda): string {
  switch (cobranca.tipo) {
    case "mensalidade":
      return `Mensalidade · ${cobranca.turma}${cobranca.proporcional ? " (proporcional)" : ""} · ${nomeDoMes(
        cobranca.mes,
      )} · vence dia ${Number(cobranca.vencimento.slice(8, 10))}`;
    case "inscricao":
      return cobranca.experimental
        ? `Aula experimental · ${cobranca.titulo} · ${formatarDiaMes(cobranca.data)}`
        : `${cobranca.titulo} · ${formatarDiaMes(cobranca.data)}`;
    case "uso_livre":
      return subLinhaDoUsoLivre({
        horas: cobranca.horas,
        pessoas: cobranca.pessoas,
        data: cobranca.data,
        materialCobradoCentavos: materialCobrado(cobranca.materiais),
      });
  }
}

// “Uso livre · {h} h” + “ × {n} pessoas” + “ · {dd/mm}” + “ · material {R$}” — também o topo do “Recebi
// agora” aberto da folha do uso encerrado.
export function subLinhaDoUsoLivre({
  horas,
  pessoas,
  data,
  materialCobradoCentavos,
}: {
  horas: number;
  pessoas: number;
  data: string;
  materialCobradoCentavos: number;
}): string {
  return `${textoDoUsoLivre(horas, pessoas)} · ${formatarDiaMes(data)}${
    materialCobradoCentavos > 0 ? ` · material ${formatarReais(materialCobradoCentavos)}` : ""
  }`;
}

// Os três itens do sistema (D-17), achados pela CHAVE por quem chama.
export type ItemDoSistemaParaVenda = { id: string; categoriaId: string };
export type ItensDoSistema = {
  mensalidade: ItemDoSistemaParaVenda;
  inscricaoOficina: ItemDoSistemaParaVenda;
  usoLivreHora: ItemDoSistemaParaVenda;
};

// O mesmo formato de `LinhaDoPedidoDeVenda` (`lib/financeiro/gravacao.ts`), redeclarado aqui para o
// módulo continuar puro.
export type LinhaDaVendaDaAgenda =
  | {
      tipo: "item";
      itemId: string;
      descricao: string;
      categoriaId: string;
      quantidade: number;
      valorCentavos: number;
    }
  | { tipo: "livre"; descricao: string; categoriaId: string; valorCentavos: number };

// “{nome do material} · {q} {un}” — corta o NOME para a quantidade sempre caber.
function descricaoDoMaterial(material: MaterialDoUsoNaCobranca): string {
  const sufixo = ` · ${textoDeMilesimos(material.quantidadeMilesimos)} ${ROTULO_UNIDADE[material.unidade]}`;
  const caracteres = [...material.nome.normalize("NFC").trim()];
  const espaco = LIMITE_DA_DESCRICAO - [...sufixo].length;
  const nome =
    caracteres.length <= espaco ? caracteres.join("") : `${caracteres.slice(0, espaco - 1).join("").trimEnd()}…`;
  return `${nome}${sufixo}`;
}

// As linhas da venda de uma cobrança. Quantidade 1 nas linhas de item; a soma é o valor da cobrança,
// sem desconto automático. Uma soma diferente do valor congelado é DEFEITO (lança) — nunca vira venda.
export function linhasDaVenda(cobranca: CobrancaDaAgenda, itens: ItensDoSistema): LinhaDaVendaDaAgenda[] {
  if (cobranca.tipo === "mensalidade") {
    return [
      {
        tipo: "item",
        itemId: itens.mensalidade.id,
        descricao: descricaoDaLinha(cobranca),
        categoriaId: itens.mensalidade.categoriaId,
        quantidade: 1,
        valorCentavos: cobranca.valorCentavos,
      },
    ];
  }
  if (cobranca.tipo === "inscricao") {
    return [
      {
        tipo: "item",
        itemId: itens.inscricaoOficina.id,
        descricao: descricaoDaLinha(cobranca),
        categoriaId: itens.inscricaoOficina.categoriaId,
        quantidade: 1,
        valorCentavos: cobranca.valorCentavos,
      },
    ];
  }

  const categoriaId = itens.usoLivreHora.categoriaId;
  const linhas: LinhaDaVendaDaAgenda[] = [
    {
      tipo: "item",
      itemId: itens.usoLivreHora.id,
      descricao: descricaoDaLinha(cobranca),
      categoriaId,
      quantidade: 1,
      valorCentavos: cobranca.horas * cobranca.pessoas * cobranca.precoHoraCentavos,
    },
  ];
  for (const material of cobranca.materiais) {
    if (!material.cobrar || material.valorCentavos === null) {
      continue;
    }
    linhas.push({
      tipo: "livre",
      descricao: descricaoDoMaterial(material),
      categoriaId,
      valorCentavos: material.valorCentavos,
    });
  }
  const soma = linhas.reduce((total, linha) => total + linha.valorCentavos, 0);
  if (soma !== cobranca.valorCentavos) {
    throw new Error(
      `linhasDaVenda: as linhas do uso livre ${cobranca.id} somam ${soma}, mas o valor congelado é ${cobranca.valorCentavos}.`,
    );
  }
  return linhas;
}

// ── O lote de mensalidades (plano 12 — AGE-16) ───────────────────────────────────────────────────────────

// Uma linha do lote: o que a sanfona mostra (“{nome} · {turma} · {mês} · {R$}” + “ (proporcional)”) e o
// vencimento da parcela em aberto que a venda dela vai ter (o dia da turma, D-02).
export type LinhaDoLote = {
  id: string;
  nome: string;
  turma: string;
  // AAAA-MM-01.
  mes: string;
  vencimento: string;
  valorCentavos: number;
  proporcional: boolean;
};

export type LoteDeMensalidades = {
  linhas: LinhaDoLote[];
  // A soma EXATA das linhas, proporcionais incluídas — o total do botão.
  totalCentavos: number;
  quantas: number;
};

// Quem entra no lote: só as MENSALIDADES livres — a receber, ou com a venda cancelada no Caixa (D-08) —,
// com valor; nunca a lançada, a paga nem a dispensada (D-09). Em ordem de turma e nome (sem acento nem
// caixa), depois pelo id: a mesma pessoa em duas turmas tem duas linhas (Assumption A6 — duas vendas,
// cada uma no dia da sua turma). Quem grava relê cada uma sob a trava; isto é o que a tela mostra.
export function loteDeMensalidades(cobrancas: readonly CobrancaDaAgenda[]): LoteDeMensalidades {
  const linhas: LinhaDoLote[] = [];
  for (const cobranca of cobrancas) {
    if (cobranca.tipo !== "mensalidade" || cobranca.valorCentavos <= 0) {
      continue;
    }
    const situacao = situacaoDaCobranca(cobranca);
    if (situacao !== "a_receber" && situacao !== "venda_cancelada") {
      continue;
    }
    linhas.push({
      id: cobranca.id,
      nome: cobranca.nome,
      turma: cobranca.turma,
      mes: cobranca.mes,
      vencimento: cobranca.vencimento,
      valorCentavos: cobranca.valorCentavos,
      proporcional: cobranca.proporcional,
    });
  }
  linhas.sort((a, b) => {
    const porTurma = COMPARADOR_DE_NOMES.compare(a.turma, b.turma);
    if (porTurma !== 0) {
      return porTurma;
    }
    const porNome = COMPARADOR_DE_NOMES.compare(a.nome, b.nome);
    if (porNome !== 0) {
      return porNome;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return { linhas, totalCentavos: totalAReceber(linhas), quantas: linhas.length };
}

// ── Dispensar uma cobrança (plano 13 — D-09, UI-D15) ─────────────────────────────────────────────────────

// Quem pode ser dispensado: só MENSALIDADE e INSCRIÇÃO, e só enquanto estão livres — a receber, ou com a
// venda cancelada no Caixa (D-08). O uso livre nunca (D-09: o caso é aluno que saiu, bolsa, experimental
// cobrada por engano); o que já virou venda ATIVA se desfaz no Caixa, nunca aqui.
export function podeDispensar(cobranca: { tipo: TipoDeCobranca; situacao: SituacaoDaCobranca }): boolean {
  if (cobranca.tipo === "uso_livre") {
    return false;
  }
  return cobranca.situacao === "a_receber" || cobranca.situacao === "venda_cancelada";
}

// “Dispensadas”: 20 por vez + “Mostrar mais 20” (05-UI-SPEC.md §“Aba A receber”, item 4).
export const DISPENSADAS_POR_VEZ = 20;
// O máximo que uma página carrega de uma vez — `?dispensadas=` só aceita múltiplos de 20 até aqui.
export const TETO_DE_DISPENSADAS = 500;

// `?dispensadas=` — quantas a sanfona mostra; parâmetro estranho cai nas 20 primeiras, nunca em erro.
export function quantasDispensadasDaUrl(valor: string | readonly string[] | null | undefined): number {
  if (typeof valor !== "string" || !/^\d{1,5}$/.test(valor)) {
    return DISPENSADAS_POR_VEZ;
  }
  const numero = Number(valor);
  if (numero > TETO_DE_DISPENSADAS) {
    return TETO_DE_DISPENSADAS;
  }
  if (numero < DISPENSADAS_POR_VEZ || numero % DISPENSADAS_POR_VEZ !== 0) {
    return DISPENSADAS_POR_VEZ;
  }
  return numero;
}

// As mais recentes primeiro (pelo instante da dispensa, ISO), desempate pelo id. Devolve lista nova.
export function ordenarDispensadas<T extends { id: string; dispensadaEm: string }>(lista: readonly T[]): T[] {
  return [...lista].sort((a, b) => {
    const porInstante = Date.parse(b.dispensadaEm) - Date.parse(a.dispensadaEm);
    if (porInstante !== 0) {
      return porInstante;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

// Módulo puro da Agenda — a semana (o nome reservado no CLAUDE.md). Só imports de módulos puros
// (`lib/producao/calendario.ts`, que faz a aritmética de datas civis sem `Date`, e os outros puros
// da Agenda); nenhuma linha alcança React, Next, drizzle-orm, pg ou `@/db`. Datas são sempre
// `YYYY-MM-DD`; "hoje" chega por argumento — `hojeEmBrasilia(new Date())` só na borda.
//
// A semana vai de segunda a domingo (herdado do protótipo): o domingo pertence à semana que
// começou na segunda anterior.
import { diasEntre, formatarDiaMes, somarDias } from "@/lib/producao/calendario";

import { minutosDe } from "./horario";
import { TIPOS_DE_EVENTO, type TipoEvento } from "./tipos";

// 05/01/1970 foi uma segunda-feira — a âncora da conta do dia da semana.
const UMA_SEGUNDA = "1970-01-05";

// 0 = segunda … 6 = domingo (a posição na semana da Agenda).
function posicaoNaSemana(data: string): number {
  return ((diasEntre(UMA_SEGUNDA, data) % 7) + 7) % 7;
}

const NOMES_DOS_DIAS = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"] as const;

export function segundaDaSemana(data: string): string {
  return somarDias(data, -posicaoNaSemana(data));
}

// Os sete dias, de segunda a domingo, a partir da segunda.
export function diasDaSemana(segunda: string): string[] {
  return Array.from({ length: 7 }, (_, indice) => somarDias(segunda, indice));
}

// "05/10 a 11/10"; semana que cruza o ano: "28/12/2026 a 03/01/2027".
export function tituloDaSemana(segunda: string): string {
  const domingo = somarDias(segunda, 6);
  if (segunda.slice(0, 4) === domingo.slice(0, 4)) {
    return `${formatarDiaMes(segunda)} a ${formatarDiaMes(domingo)}`;
  }
  return `${formatarDiaMes(segunda)}/${segunda.slice(0, 4)} a ${formatarDiaMes(domingo)}/${domingo.slice(0, 4)}`;
}

// "segunda", "terça" … "domingo" — o nome do dia da semana de uma data civil.
export function diaDaSemanaPorExtenso(data: string): string {
  return NOMES_DOS_DIAS[posicaoNaSemana(data)];
}

// "segunda · 05/10" e, no dia de hoje, "quinta · 01/10 · hoje" (herdado). A caixa alta é do CSS.
export function rotuloDoDia(data: string, hoje: string): string {
  const base = `${diaDaSemanaPorExtenso(data)} · ${formatarDiaMes(data)}`;
  return data === hoje ? `${base} · hoje` : base;
}

// O mínimo que a ordenação precisa de um evento da semana.
export type ItemDoDia = {
  id: string;
  data: string;
  tipo: TipoEvento;
  // Nulo no dia fechado ("dia todo"). Aceita "HH:MM" e "HH:MM:SS".
  inicio: string | null;
  // O que o cartão mostra (nome da turma/aula, motivo do fechado) — desempata o mesmo horário.
  titulo?: string;
};

// Ordem alfabética de gente: sem diferença de caixa nem de acento ("Ágata" junto de "agata").
const ORDEM_DE_TITULO = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

const POSICAO_DO_TIPO: ReadonlyMap<TipoEvento, number> = new Map(
  TIPOS_DE_EVENTO.map((tipo, indice) => [tipo, indice]),
);

function comparar(a: ItemDoDia, b: ItemDoDia): number {
  const aFechado = a.tipo === "fechado" ? 0 : 1;
  const bFechado = b.tipo === "fechado" ? 0 : 1;
  if (aFechado !== bFechado) {
    return aFechado - bFechado;
  }
  const aInicio = a.inicio === null ? -1 : minutosDe(a.inicio);
  const bInicio = b.inicio === null ? -1 : minutosDe(b.inicio);
  if (aInicio !== bInicio) {
    return aInicio - bInicio;
  }
  const porTitulo = ORDEM_DE_TITULO.compare(a.titulo ?? "", b.titulo ?? "");
  if (porTitulo !== 0) {
    return porTitulo;
  }
  const porTipo = (POSICAO_DO_TIPO.get(a.tipo) ?? 0) - (POSICAO_DO_TIPO.get(b.tipo) ?? 0);
  if (porTipo !== 0) {
    return porTipo;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// Fechado primeiro ("dia todo"), depois por início, depois por título (05-UI-SPEC.md §"Aba Agenda —
// Semana"; plano 03), depois por tipo, depois por id — ordem estável entre recarregamentos (AGE-02 · ordering). Dois eventos no mesmo horário aparecem os
// dois (AGE-02 · adjacency): nada é fundido. Devolve uma lista nova.
export function ordenarNoDia<T extends ItemDoDia>(itens: readonly T[]): T[] {
  return [...itens].sort(comparar);
}

export type GrupoDoDia<T extends ItemDoDia> = { data: string; itens: T[] };

// Os sete dias da semana que começa em `segunda`, cada um com a sua lista ordenada — vazia quando
// nada está marcado. Item fora da semana é ignorado.
export function agruparPorDia<T extends ItemDoDia>(segunda: string, itens: readonly T[]): GrupoDoDia<T>[] {
  return diasDaSemana(segunda).map((data) => ({
    data,
    itens: ordenarNoDia(itens.filter((item) => item.data === data)),
  }));
}

// ——— A vista do mês (AGE-02; 05-UI-SPEC.md §"Aba Agenda — Mês") ———

const NOMES_DOS_MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

// "2026-12" → "dezembro" (a dica da folha da turma: "a mensalidade nova vale a partir de novembro").
export function nomeDoMes(mes: string): string {
  return NOMES_DOS_MESES[Number(mes.slice(5, 7)) - 1];
}

// "2026-12" → "dezembro de 2026".
export function tituloDoMes(mes: string): string {
  return `${NOMES_DOS_MESES[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}`;
}

// O mês `delta` meses antes/depois de `mes` (AAAA-MM), cruzando o ano.
export function mesVizinho(mes: string, delta: number): string {
  const indice = Number(mes.slice(0, 4)) * 12 + (Number(mes.slice(5, 7)) - 1) + delta;
  const ano = Math.floor(indice / 12);
  const mesDoAno = indice - ano * 12 + 1;
  return `${String(ano).padStart(4, "0")}-${String(mesDoAno).padStart(2, "0")}`;
}

export type CelulaDoMes = { data: string; doMes: boolean };

// A grade do mês com SEGUNDA primeiro: 42 células a partir da segunda da semana do dia 1, e a 6ª
// linha cortada quando ela é toda fora do mês (herdado do protótipo: `if(i>=35&&fora)break`) —
// 35 ou 42 células. As células de fora do mês ficam (fundo `superficie-2`, número `tinta-fraca`).
export function gradeDoMes(mes: string): CelulaDoMes[] {
  const primeiroDia = `${mes}-01`;
  const inicio = segundaDaSemana(primeiroDia);
  const celulas = Array.from({ length: 42 }, (_, indice) => {
    const data = somarDias(inicio, indice);
    return { data, doMes: data.slice(0, 7) === mes };
  });
  return celulas[35].doMes ? celulas : celulas.slice(0, 35);
}

// O que a célula do mês sabe de um lançamento: o tipo (o uso livre entra no plano 09) e se foi
// cancelado — cancelado não tem ponto nem conta no resumo.
export type TipoDoPonto = TipoEvento | "uso_livre";
export type LancamentoDoDia = { tipo: TipoDoPonto; cancelado?: boolean };

const TETO_DE_PONTOS = 6;

// Os pontos de uma célula: até seis, o fechado primeiro, cancelado sem ponto; o resto na ordem
// recebida (a consulta já vem por início).
export function pontosDoDia(lancamentos: readonly LancamentoDoDia[]): TipoDoPonto[] {
  const validos = lancamentos.filter((lancamento) => !lancamento.cancelado);
  const fechados = validos.filter((lancamento) => lancamento.tipo === "fechado");
  const outros = validos.filter((lancamento) => lancamento.tipo !== "fechado");
  return [...fechados, ...outros].slice(0, TETO_DE_PONTOS).map((lancamento) => lancamento.tipo);
}

const PLURAL_DO_TIPO: Record<Exclude<TipoDoPonto, "fechado">, readonly [string, string]> = {
  turma: ["turma fixa", "turmas fixas"],
  avulsa: ["oficina", "oficinas"],
  uso_livre: ["uso livre", "usos livres"],
};

// O resumo da célula para o leitor de tela: "nada marcado" / "1 turma fixa, 2 oficinas, 1 uso
// livre" / "dia fechado" — plural de verdade, contando TODOS os lançamentos (não só os seis
// pontos desenhados); cancelado não conta.
export function resumoDoDia(lancamentos: readonly LancamentoDoDia[]): string {
  const validos = lancamentos.filter((lancamento) => !lancamento.cancelado);
  const partes: string[] = [];
  if (validos.some((lancamento) => lancamento.tipo === "fechado")) {
    partes.push("dia fechado");
  }
  for (const tipo of ["turma", "avulsa", "uso_livre"] as const) {
    const quantos = validos.filter((lancamento) => lancamento.tipo === tipo).length;
    if (quantos > 0) {
      const [singular, plural] = PLURAL_DO_TIPO[tipo];
      partes.push(`${quantos} ${quantos === 1 ? singular : plural}`);
    }
  }
  return partes.length === 0 ? "nada marcado" : partes.join(", ");
}

// O `aria-label` da célula: "{dia da semana}, {d} de {mês}: {resumo}" + " · hoje".
export function rotuloDaCelulaDoMes(data: string, resumo: string, hoje: string): string {
  const dia = Number(data.slice(8, 10));
  const mes = NOMES_DOS_MESES[Number(data.slice(5, 7)) - 1];
  const base = `${diaDaSemanaPorExtenso(data)}, ${dia} de ${mes}: ${resumo}`;
  return data === hoje ? `${base} · hoje` : base;
}

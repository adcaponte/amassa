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
};

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
  const porTipo = (POSICAO_DO_TIPO.get(a.tipo) ?? 0) - (POSICAO_DO_TIPO.get(b.tipo) ?? 0);
  if (porTipo !== 0) {
    return porTipo;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// Fechado primeiro ("dia todo"), depois por início, depois por tipo, depois por id — ordem
// estável entre recarregamentos (AGE-02 · ordering). Dois eventos no mesmo horário aparecem os
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

// Módulo puro da Agenda — as datas da turma fixa (AGE-03, D-03, D-13). Só imports de módulos puros
// (`lib/producao/calendario.ts`, a aritmética de datas civis sem `Date`, e `./horario`); nenhuma linha
// alcança React, Next, drizzle-orm, pg ou `@/db`. "Hoje" chega por argumento — calculado na borda, no
// fuso de Brasília. Datas são sempre `YYYY-MM-DD` civis: nenhuma escorrega de dia por fuso
// (Pitfall 9 vale para as horas: "19:00" e "19:00:00" são a mesma).
//
// Dia da semana da turma: 0 = domingo … 6 = sábado (o `getDay()` do protótipo, `DOWL` na linha 206,
// e o check `turmas.dia_semana between 0 and 6`).
import { diasEntre, somarDias } from "@/lib/producao/calendario";

import { minutosDe } from "./horario";

// Indexado pelo dia da semana da turma (0 = domingo).
export const NOMES_DOS_DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"] as const;

// A ordem em que o gestor escolhe o dia (herdada do protótipo): segunda → domingo.
export const ORDEM_DOS_DIAS_NA_TELA = [1, 2, 3, 4, 5, 6, 0] as const;

export const SEMANAS_MINIMAS = 1;
export const SEMANAS_MAXIMAS = 52;

// 04/01/1970 foi um domingo — a âncora da conta.
const UM_DOMINGO = "1970-01-04";

function conferirDiaDaSemana(diaDaSemana: number): void {
  if (!Number.isInteger(diaDaSemana) || diaDaSemana < 0 || diaDaSemana > 6) {
    throw new RangeError(`Dia da semana inválido (0 = domingo … 6 = sábado): ${diaDaSemana}`);
  }
}

// 0 = domingo … 6 = sábado, de uma data civil.
export function diaDaSemanaDe(data: string): number {
  return ((diasEntre(UM_DOMINGO, data) % 7) + 7) % 7;
}

// As `semanas` primeiras datas com aquele dia da semana a partir de `aPartirDe` (inclusive), uma por
// semana, em ordem de calendário. Não pula dia fechado (D-13): quem decide é o gestor, depois.
export function datasDaTurma({
  diaDaSemana,
  aPartirDe,
  semanas,
}: {
  diaDaSemana: number;
  aPartirDe: string;
  semanas: number;
}): string[] {
  conferirDiaDaSemana(diaDaSemana);
  if (!Number.isInteger(semanas) || semanas < SEMANAS_MINIMAS || semanas > SEMANAS_MAXIMAS) {
    throw new RangeError(`Semanas fora de 1..52: ${semanas}`);
  }
  const primeira = somarDias(aPartirDe, (diaDaSemana - diaDaSemanaDe(aPartirDe) + 7) % 7);
  return Array.from({ length: semanas }, (_, indice) => somarDias(primeira, indice * 7));
}

// De onde "Marcar mais N semanas" começa: o dia seguinte à última data marcada (ela nunca é marcada
// de novo), ou hoje se ela já passou ou se a turma não tem data nenhuma.
export function aPartirDeParaEstender(ultimaData: string | null, hoje: string): string {
  if (ultimaData === null) {
    return hoje;
  }
  const seguinte = somarDias(ultimaData, 1);
  return diasEntre(hoje, seguinte) > 0 ? seguinte : hoje;
}

export type FechadoDoDia = { data: string; motivo: string };

// As datas da turma que caem num dia fechado, na ordem das datas, com o motivo (o primeiro fechado do
// dia, se houver mais de um).
export function datasEmDiaFechado(datas: readonly string[], fechados: readonly FechadoDoDia[]): FechadoDoDia[] {
  const motivoDoDia = new Map<string, string>();
  for (const fechado of fechados) {
    if (!motivoDoDia.has(fechado.data)) {
      motivoDoDia.set(fechado.data, fechado.motivo);
    }
  }
  const resultado: FechadoDoDia[] = [];
  for (const data of datas) {
    const motivo = motivoDoDia.get(data);
    if (motivo !== undefined) {
      resultado.push({ data, motivo });
    }
  }
  return resultado;
}

// "toda terça" · "todo sábado" · "todo domingo" — sábado e domingo são masculinos.
export function todoODia(diaDaSemana: number): string {
  conferirDiaDaSemana(diaDaSemana);
  const masculino = diaDaSemana === 0 || diaDaSemana === 6;
  return `${masculino ? "todo" : "toda"} ${NOMES_DOS_DIAS[diaDaSemana]}`;
}

function horaCurta(hora: string): string {
  const minutos = minutosDe(hora);
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

// "19h" · "19h30" (o jeito do site).
function horaDoSite(hora: string): string {
  const minutos = minutosDe(hora);
  const resto = minutos % 60;
  return `${Math.floor(minutos / 60)}h${resto === 0 ? "" : String(resto).padStart(2, "0")}`;
}

type HorarioDaTurma = { diaSemana: number; inicio: string; fim: string };

// "toda terça, 19:00 às 21:00" — a folha da turma, na gestão.
export function rotuloDaTurmaNaGestao({ diaSemana, inicio, fim }: HorarioDaTurma): string {
  return `${todoODia(diaSemana)}, ${horaCurta(inicio)} às ${horaCurta(fim)}`;
}

// "toda terça, 19h às 21h" (meia hora: "19h30") — o "quando" do cartão do site (plano 15).
export function quandoDaTurmaNoSite({ diaSemana, inicio, fim }: HorarioDaTurma): string {
  return `${todoODia(diaSemana)}, ${horaDoSite(inicio)} às ${horaDoSite(fim)}`;
}

// Módulo puro da Agenda — a aba Números (AGE-19): como o espaço está sendo usado, do dia 1 do mês até
// hoje, no fuso do ateliê. Só leitura; recebe as linhas já lidas por `dadosDosNumeros`
// (`lib/agenda/consultas.ts`) e o `hoje` da página. Só imports de puros; nenhuma linha alcança React,
// Next, drizzle-orm, pg ou `@/db`, e nenhuma lê o relógio.
//
// §8 do briefing: Números nunca mostra dinheiro nem cruza o uso com o que ele rende ou gasta — são
// horas, presença e pessoas. Os indicadores são os do protótipo (`prototipo.html` 285-288), com três
// ajustes de contrato: presença sem marcação é "—" e não 0% (UI-D22); "pessoas diferentes" conta
// também o uso livre ainda no espaço (iniciado, não só encerrado); e o meio arredonda para cima.
import { diasEntre } from "@/lib/producao/calendario";

import { minutosDe } from "./horario";
import { segundaDaSemana } from "./semana";
import type { EstadoUsoLivre, Presenca } from "./tipos";

export type UsoLivreDoMes = {
  data: string;
  clienteId: string;
  estado: EstadoUsoLivre;
  pessoas: number;
  // As horas cheias gravadas ao encerrar; nulas antes disso.
  horasCheias: number | null;
};

// Uma inscrição numa data de turma ou aula/oficina avulsa, com o horário da data.
export type InscricaoDoMes = {
  data: string;
  clienteId: string;
  presenca: Presenca | null;
  inicio: string;
  fim: string;
  cancelada: boolean;
};

export type DadosDosNumeros = {
  usosLivres: readonly UsoLivreDoMes[];
  inscricoes: readonly InscricaoDoMes[];
  // O saldo de reposição de cada pessoa, HOJE (`creditosPorCliente`) — o saldo não tem mês.
  saldosDeReposicao: readonly number[];
};

export type QuadrosDoMes = {
  // Horas-pessoa do uso livre encerrado e quantas visitas (usos encerrados).
  usoLivre: { horas: number; visitas: number };
  // Veio ÷ marcadas, em %, inteiro com meio para cima; `null` sem nenhuma marcação (UI-D22: "—").
  presenca: { porcento: number | null; faltas: number };
  aRepor: number;
  pessoas: number;
};

export const DIAS_DAS_BARRAS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"] as const;
export type DiaDaBarra = (typeof DIAS_DAS_BARRAS)[number];

export type BarrasDaSemana = readonly { dia: DiaDaBarra; horas: number }[];

export type NumerosDoMes = QuadrosDoMes & { barras: BarrasDaSemana };

// 0 = segunda … 6 = domingo.
function posicaoNaSemana(data: string): number {
  return diasEntre(segundaDaSemana(data), data);
}

// A aula conta, por pessoa presente, as horas da data arredondadas para cima (Assumption A12: 2h30
// conta 3 h), como o protótipo.
function horasDaAula(inicio: string, fim: string): number {
  return Math.ceil((minutosDe(fim) - minutosDe(inicio)) / 60);
}

// Inteiro mais próximo de `parte ÷ todo × 100`, com o meio para cima, sem ponto flutuante.
function porcentoMeioParaCima(parte: number, todo: number): number {
  return Math.floor((200 * parte + todo) / (2 * todo));
}

export function numerosDoMes(dados: DadosDosNumeros, hoje: string): NumerosDoMes {
  const primeiro = `${hoje.slice(0, 7)}-01`;
  const noPeriodo = (data: string) => data >= primeiro && data <= hoje;

  const barras = DIAS_DAS_BARRAS.map(() => 0);
  const pessoas = new Set<string>();

  let horasDoUsoLivre = 0;
  let visitas = 0;
  for (const uso of dados.usosLivres) {
    if (!noPeriodo(uso.data) || uso.estado === "reservado") {
      continue;
    }
    pessoas.add(uso.clienteId);
    if (uso.estado === "encerrado" && uso.horasCheias !== null) {
      const horas = uso.horasCheias * uso.pessoas;
      horasDoUsoLivre += horas;
      visitas += 1;
      barras[posicaoNaSemana(uso.data)] += horas;
    }
  }

  let veio = 0;
  let faltas = 0;
  for (const inscricao of dados.inscricoes) {
    if (!noPeriodo(inscricao.data) || inscricao.cancelada || inscricao.presenca === null) {
      continue;
    }
    if (inscricao.presenca === "faltou") {
      faltas += 1;
      continue;
    }
    veio += 1;
    pessoas.add(inscricao.clienteId);
    barras[posicaoNaSemana(inscricao.data)] += horasDaAula(inscricao.inicio, inscricao.fim);
  }

  const marcadas = veio + faltas;
  return {
    usoLivre: { horas: horasDoUsoLivre, visitas },
    presenca: { porcento: marcadas === 0 ? null : porcentoMeioParaCima(veio, marcadas), faltas },
    aRepor: dados.saldosDeReposicao.reduce((soma, saldo) => soma + Math.max(0, saldo), 0),
    pessoas: pessoas.size,
    barras: DIAS_DAS_BARRAS.map((dia, indice) => ({ dia, horas: barras[indice] })),
  };
}

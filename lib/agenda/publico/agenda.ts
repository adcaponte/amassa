// Módulo puro — o que o site público mostra da Agenda (AGE-18, D-10, D-11, D-12). Recebe as linhas
// já lidas por `lerAgendaPublica` (`./consultas.ts`) e o "hoje" da borda; devolve só o que o visitante
// pode ver. Só imports de puros: nenhuma linha alcança React, Next, drizzle-orm, pg ou `@/db`.
//
// O que NUNCA sai daqui (§2.9 do briefing, T-05-69): nome, telefone ou presença de pessoa, e o motivo
// de um dia fechado. A defesa principal é a consulta não selecionar essas colunas; esta camada repete a
// cerca montando cada objeto campo a campo (nunca `...linha`), e `tests/unit/agenda-publico.test.ts`
// afirma a lista branca de chaves.
import { formatarReais } from "@/lib/financeiro/formato";
import { ultimoDiaDoMes } from "@/lib/financeiro/calendario";
import { formatarDiaMes } from "@/lib/producao/calendario";

import { minutosDe } from "../horario";
import { NOMES_DOS_DIAS, diaDaSemanaDe, horaDoSite, quandoDaTurmaNoSite, todoODia } from "../turma";
import { rotuloDeVagas, vagasRestantes } from "../vagas";

// Quantos cartões "Próximas" mostra antes do "e mais {N} no calendário" (05-UI-SPEC.md, Site, item 2).
export const LIMITE_DE_PROXIMAS = 10;
// A janela do site: do mês de hoje até o fim do 6º mês, contando o de hoje (Assumption A11).
export const MESES_NO_SITE = 6;

// ---- Entrada: o que a consulta pública lê (sem coluna de pessoa) --------------------------------

// Uma data de turma fixa ou uma aula/oficina avulsa. `inscritos` é a CONTAGEM da lista daquela data.
export type EventoPublicoLido = {
  tipo: "turma" | "avulsa";
  data: string;
  inicio: string;
  fim: string;
  titulo: string | null;
  vagas: number;
  precoCentavos: number | null;
  turmaId: string | null;
  publico: boolean;
  cancelado: boolean;
  inscritos: number;
};

// A turma fixa: `alunosAtivos` é a CONTAGEM de quem está na turma hoje (D-12).
export type TurmaPublicaLida = {
  id: string;
  nome: string;
  diaSemana: number;
  inicio: string;
  fim: string;
  vagas: number;
  mensalidadeCentavos: number;
  ativa: boolean;
  alunosAtivos: number;
};

export type DadosDaAgendaPublica = {
  eventos: readonly EventoPublicoLido[];
  turmas: readonly TurmaPublicaLida[];
  // Só as DATAS dos dias fechados — o motivo nunca é lido.
  fechados: readonly string[];
};

// ---- Saída: o que o site desenha ------------------------------------------------------------------

export type TipoDoCartaoPublico = "turma" | "oficina";

export type CartaoPublico = {
  chave: string;
  tipo: TipoDoCartaoPublico;
  data: string;
  titulo: string;
  // "Turma fixa · toda terça, 19h às 21h" · "Terça, 03/12 · 19h às 21h".
  quando: string;
  // "R$ 320,00 por mês" · "R$ 120,00 por pessoa" (D-10).
  precoTexto: string;
  vagasTexto: string;
  restantes: number;
  esgotado: boolean;
  podeReservar: boolean;
  // O que vai entre parênteses na mensagem de reserva: "toda terça" ou "03/12".
  quandoDaReserva: string;
};

export type DiaPublico = {
  data: string;
  fechado: boolean;
  cartoes: CartaoPublico[];
};

export type MesPublico = {
  // "2026-12"
  chave: string;
  // "dezembro de 2026"
  nome: string;
  // "Em {mês}": os eventos do mês de hoje em diante, a turma uma vez.
  cartoes: CartaoPublico[];
};

export type AgendaPublicaPronta =
  | { temEventos: false }
  | {
      temEventos: true;
      hoje: string;
      proximas: CartaoPublico[];
      restantes: number;
      meses: MesPublico[];
      dias: DiaPublico[];
    };

// ---- Contas ---------------------------------------------------------------------------------------

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

function maiuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// "2026-12" + n meses.
export function somarMeses(chave: string, meses: number): string {
  const [ano, mes] = chave.split("-").map(Number);
  const indice = ano * 12 + (mes - 1) + meses;
  const anoFinal = Math.floor(indice / 12);
  const mesFinal = indice - anoFinal * 12 + 1;
  return `${anoFinal}-${String(mesFinal).padStart(2, "0")}`;
}

// "dezembro de 2026"
export function nomeDoMesPublico(chave: string): string {
  const [ano, mes] = chave.split("-").map(Number);
  return `${NOMES_DOS_MESES[mes - 1]} de ${ano}`;
}

// "Terça, 03/12" — o título da lista do dia escolhido.
export function tituloDoDia(data: string): string {
  return `${maiuscula(NOMES_DOS_DIAS[diaDaSemanaDe(data)])}, ${formatarDiaMes(data)}`;
}

// O último dia da janela do site: o fim do 6º mês, contando o de hoje.
export function fimDaJanela(hoje: string): string {
  const ultimoMes = somarMeses(hoje.slice(0, 7), MESES_NO_SITE - 1);
  const [ano, mes] = ultimoMes.split("-").map(Number);
  return `${ultimoMes}-${String(ultimoDiaDoMes(ano, mes)).padStart(2, "0")}`;
}

// As células do mês, de segunda a domingo: `null` é célula fora do mês (vazia).
export function gradeDoMes(chave: string): (string | null)[] {
  const [ano, mes] = chave.split("-").map(Number);
  const primeiro = `${chave}-01`;
  const deslocamento = (diaDaSemanaDe(primeiro) + 6) % 7; // segunda = 0
  const dias = ultimoDiaDoMes(ano, mes);
  const celulas: (string | null)[] = Array.from({ length: deslocamento }, () => null);
  for (let dia = 1; dia <= dias; dia += 1) {
    celulas.push(`${chave}-${String(dia).padStart(2, "0")}`);
  }
  while (celulas.length % 7 !== 0) {
    celulas.push(null);
  }
  return celulas;
}

function precoPorMes(centavos: number): string {
  return `${formatarReais(centavos)} por mês`;
}

function precoPorPessoa(centavos: number): string {
  return `${formatarReais(centavos)} por pessoa`;
}

function cartao(
  campos: Omit<CartaoPublico, "vagasTexto" | "esgotado" | "podeReservar">,
): CartaoPublico {
  const esgotado = campos.restantes <= 0;
  // Campo a campo — nunca espalhar a linha lida.
  return {
    chave: campos.chave,
    tipo: campos.tipo,
    data: campos.data,
    titulo: campos.titulo,
    quando: campos.quando,
    precoTexto: campos.precoTexto,
    vagasTexto: rotuloDeVagas(campos.restantes),
    restantes: campos.restantes,
    esgotado,
    podeReservar: !esgotado,
    quandoDaReserva: campos.quandoDaReserva,
  };
}

function cartaoDaOficina(evento: EventoPublicoLido, indice: number): CartaoPublico {
  return cartao({
    chave: `oficina-${evento.data}-${evento.inicio}-${indice}`,
    tipo: "oficina",
    data: evento.data,
    titulo: evento.titulo ?? "",
    quando: `${tituloDoDia(evento.data)} · ${horaDoSite(evento.inicio)} às ${horaDoSite(evento.fim)}`,
    precoTexto: precoPorPessoa(evento.precoCentavos ?? 0),
    restantes: vagasRestantes(evento.vagas, evento.inscritos),
    quandoDaReserva: formatarDiaMes(evento.data),
  });
}

// Turma: `restantes` vem de fora — em "Próximas" e na lista do mês, vagas da turma − alunos ativos;
// na lista do dia, vagas da data − a lista daquela data (D-12).
function cartaoDaTurma(turma: TurmaPublicaLida, data: string, restantes: number): CartaoPublico {
  return cartao({
    chave: `turma-${turma.id}-${data}`,
    tipo: "turma",
    data,
    titulo: turma.nome,
    quando: `Turma fixa · ${quandoDaTurmaNoSite(turma)}`,
    precoTexto: precoPorMes(turma.mensalidadeCentavos),
    restantes,
    quandoDaReserva: todoODia(turma.diaSemana),
  });
}

function emOrdem(a: { data: string; inicio: string }, b: { data: string; inicio: string }): number {
  if (a.data !== b.data) {
    return a.data < b.data ? -1 : 1;
  }
  return minutosDe(a.inicio) - minutosDe(b.inicio);
}

// Turma uma vez, na posição da primeira data da lista dada (já em ordem).
function umaVezPorTurma(
  eventos: readonly EventoPublicoLido[],
  turmaPorId: ReadonlyMap<string, TurmaPublicaLida>,
): CartaoPublico[] {
  const vistas = new Set<string>();
  const cartoes: CartaoPublico[] = [];
  eventos.forEach((evento, indice) => {
    if (evento.tipo === "avulsa") {
      cartoes.push(cartaoDaOficina(evento, indice));
      return;
    }
    const turma = turmaPorId.get(evento.turmaId ?? "");
    if (turma === undefined || vistas.has(turma.id)) {
      return;
    }
    vistas.add(turma.id);
    cartoes.push(cartaoDaTurma(turma, evento.data, vagasRestantes(turma.vagas, turma.alunosAtivos)));
  });
  return cartoes;
}

export function agendaPublica(dados: DadosDaAgendaPublica, hoje: string): AgendaPublicaPronta {
  const fim = fimDaJanela(hoje);
  const turmaPorId = new Map<string, TurmaPublicaLida>();
  for (const turma of dados.turmas) {
    if (turma.ativa) {
      turmaPorId.set(turma.id, turma);
    }
  }

  // Os filtros repetem os da consulta (defesa em profundidade, T-05-73): público, não cancelado, de
  // hoje em diante (o evento de hoje fica o dia inteiro), dentro da janela, turma ativa.
  const eventos = dados.eventos
    .filter(
      (evento) =>
        evento.publico &&
        !evento.cancelado &&
        evento.data >= hoje &&
        evento.data <= fim &&
        (evento.tipo === "avulsa" || turmaPorId.has(evento.turmaId ?? "")),
    )
    .slice()
    .sort(emOrdem);

  if (eventos.length === 0) {
    return { temEventos: false };
  }

  const todas = umaVezPorTurma(eventos, turmaPorId);

  const mesDeHoje = hoje.slice(0, 7);
  const meses: MesPublico[] = Array.from({ length: MESES_NO_SITE }, (_, indice) => {
    const chave = somarMeses(mesDeHoje, indice);
    return {
      chave,
      nome: nomeDoMesPublico(chave),
      cartoes: umaVezPorTurma(
        eventos.filter((evento) => evento.data.startsWith(`${chave}-`)),
        turmaPorId,
      ),
    };
  });

  const fechados = new Set(dados.fechados.filter((data) => data >= hoje && data <= fim));
  const datas = new Set<string>([...fechados, ...eventos.map((evento) => evento.data)]);
  const dias: DiaPublico[] = [...datas].sort().map((data) => ({
    data,
    fechado: fechados.has(data),
    cartoes: eventos
      .filter((evento) => evento.data === data)
      .map((evento, indice) => {
        if (evento.tipo === "avulsa") {
          return cartaoDaOficina(evento, indice);
        }
        const turma = turmaPorId.get(evento.turmaId ?? "") as TurmaPublicaLida;
        return cartaoDaTurma(turma, data, vagasRestantes(evento.vagas, evento.inscritos));
      }),
  }));

  return {
    temEventos: true,
    hoje,
    proximas: todas.slice(0, LIMITE_DE_PROXIMAS),
    restantes: Math.max(0, todas.length - LIMITE_DE_PROXIMAS),
    meses,
    dias,
  };
}

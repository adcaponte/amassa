// Módulo puro da Agenda — quem está no espaço agora. Só importa puros da Agenda (`horario.ts`,
// `tipos.ts`); nenhuma linha alcança React, Next, drizzle-orm, pg ou `@/db`, e nenhuma lê o relógio:
// "agora" chega por argumento (`agoraEmBrasilia` na página). Nasceu em `lib/agenda/` (e não em
// `lib/inicio/`) porque a ocupação é regra da Agenda (GES-09): o bloco "Agenda de hoje" do Início
// lê `agendaDeHoje` (`lib/agenda/consultas.ts`), que chama `pessoasAgoraNoEspaco` daqui, e escreve o
// número por `ocupacaoDoEspaco` — o Início não tem regra nenhuma (D-05, plano 05-14).
//
// 🔴 NÃO EXISTE CAPACIDADE DO ESPAÇO, e isso é decisão do dono, de 29/09/2026, no portão de
// verificação humana da Fase 04.6 (item 13). O plano 06 tinha nascido com
// `LUGARES_DO_ESPACO = 10` e a linha "N de M lugares", número que veio do protótipo aprovado
// ("3 de 10 lugares", `prototipo-gestao.html`) e NUNCA de uma medição do espaço físico. Ao ser
// perguntado quantos lugares o espaço tem de verdade, o dono respondeu que a pergunta não se
// aplica: "no espaço em si pode ser que caiba mais, pode ser que eu coloque umas mesas a mais na
// parte externa"; a gestão é dele, no dia, "de acordo com as pessoas que estão e o que estão
// fazendo". Um denominador fixo seria um limite inventado, e mostrá-lo na tela daria a impressão
// de uma regra que o ateliê não tem.
//
// O que PERMANECE é o número de relance — quantas pessoas estão no espaço agora —, porque é
// justamente ele que alimenta a decisão do dono. O que saiu é a fração.
//
// Isto NÃO retira o limite por TURMA: aulas e oficinas têm, cada uma, um máximo próprio definido
// conforme a aula ("teremos um até número x de pessoas, que será definido de acordo com a aula e
// oficina"). Esse limite é o `vagas` de cada data da Agenda (AGE-11 — "{n} de {vagas} inscritos",
// lista cheia, `lib/agenda/vagas.ts`), e não tem relação com a contagem do espaço daqui.
import { cobreOAgora, minutosDe } from "./horario";
import type { EstadoUsoLivre } from "./tipos";

// Plural em português: 0 e 2+ pedem "pessoas", 1 pede "pessoa". Sem `Intl` porque a regra aqui tem
// duas saídas.
export function ocupacaoDoEspaco(ocupados: number): string {
  return ocupados === 1 ? "1 pessoa" : `${ocupados} pessoas`;
}

export type UsoLivreParaContar = {
  // A data civil do uso, `YYYY-MM-DD`.
  data: string;
  estado: EstadoUsoLivre;
  pessoas: number;
};

// Uma data de turma ou aula/oficina avulsa (o dia fechado não tem horário e não entra aqui).
export type AulaParaContar = {
  data: string;
  // "HH:MM" ou "HH:MM:SS" (o `pg` devolve com segundos).
  inicio: string;
  fim: string;
  cancelada: boolean;
  inscritos: number;
  // Quantas inscrições da data estão marcadas "Faltou".
  faltaram: number;
};

export type AgoraDoAtelie = {
  // A data civil de hoje em Brasília.
  data: string;
  // Minutos do dia (0..1439) em Brasília.
  minutos: number;
};

// "Agora no espaço" (D-05 refinada pela D-18):
//   - as pessoas de todo uso livre DE HOJE com "Chegou" e ainda não encerrado (`no_espaco`) — o uso
//     de dia passado esquecido no espaço não conta (D-18; ele aparece na semana com "encerrar");
//   - mais os inscritos de toda aula ou oficina de hoje, não cancelada, cujo horário cobre o agora (o
//     início entra, o fim não), sem quem está marcado "Faltou". A aula conta pelo HORÁRIO porque
//     ninguém marca chegada de aluno.
// Uma contagem, nunca uma fração.
export function pessoasAgoraNoEspaco({
  usosLivres,
  aulas,
  agora,
}: {
  usosLivres: readonly UsoLivreParaContar[];
  aulas: readonly AulaParaContar[];
  agora: AgoraDoAtelie;
}): number {
  let total = 0;
  for (const uso of usosLivres) {
    if (uso.data === agora.data && uso.estado === "no_espaco") {
      total += uso.pessoas;
    }
  }
  for (const aula of aulas) {
    if (aula.data === agora.data && !aula.cancelada && cobreOAgora(aula.inicio, aula.fim, agora.minutos)) {
      total += Math.max(0, aula.inscritos - aula.faltaram);
    }
  }
  return total;
}

// A tag "marcar presença" de uma linha do Início (UI-D19): a aula de HOJE que já começou, não foi
// cancelada e tem alguém sem marcação. (Na semana, a mesma tag vale para datas passadas —
// `precisaMarcarPresenca`; no Início, o dia é sempre hoje e o que decide é o horário.)
export function presencaPendenteAgora(
  aula: { inicio: string; cancelada: boolean; semMarcacao: number },
  agoraMinutos: number,
): boolean {
  return !aula.cancelada && aula.semMarcacao > 0 && minutosDe(aula.inicio) <= agoraMinutos;
}

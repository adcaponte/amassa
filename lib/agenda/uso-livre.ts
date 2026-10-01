// Módulo puro da Agenda — a conta do uso livre do ateliê (AGE-13, AGE-14). Só importa outros puros da
// Agenda (`horario.ts`, `mensalidade.ts`) e o teto do dinheiro; nenhuma linha alcança React, Next,
// drizzle-orm, pg ou `@/db`, e nenhuma lê o relógio — "agora" chega por argumento, calculado na borda
// (`agoraEmBrasilia`, `lib/financeiro/formato.ts`).
//
// Tudo em INTEIROS: minutos do dia, horas cheias, milésimos de quantidade e centavos. O teto das horas
// é `Math.ceil` sobre a divisão de dois inteiros (o resultado é exato), e o material arredonda ao
// centavo com o meio para cima por `arredondarMeioParaCima` — nenhum ponto flutuante chega ao valor.
import { horaDe, minutosDe } from "@/lib/agenda/horario";
import { arredondarMeioParaCima } from "@/lib/agenda/mensalidade";
import { TETO_CENTAVOS } from "@/lib/financeiro/dinheiro";

export type EstadoDoUsoLivre = "reservado" | "no_espaco" | "encerrado";
export type AcaoDoUsoLivre = "chegou" | "encerrar";

// O banco guarda as mesmas faixas (`usos_livres_horas_previstas_faixa`, `usos_livres_pessoas_faixa`).
export const HORAS_PREVISTAS_MINIMAS = 1;
export const HORAS_PREVISTAS_MAXIMAS = 12;
export const PESSOAS_MINIMAS = 1;
export const PESSOAS_MAXIMAS = 50;

const ULTIMO_MINUTO_DO_DIA = 1439;

function conferirInteiro(nome: string, valor: number, minimo: number, maximo: number): void {
  if (!Number.isInteger(valor) || valor < minimo || valor > maximo) {
    throw new RangeError(`${nome} fora da faixa (${minimo}..${maximo}): ${valor}`);
  }
}

// Horas cheias entre a chegada e a saída: passou da hora, conta a próxima. 1 min = 1 h; 60 min = 1 h;
// 61 min = 2 h. Aceita "HH:MM" e "HH:MM:SS" (Pitfall 9). Saída igual ou antes da chegada → `RangeError`
// (nada atravessa a meia-noite — check `usos_livres_saida_depois_da_chegada`).
export function horasCheias(chegada: string, saida: string): number {
  const minutos = minutosDe(saida) - minutosDe(chegada);
  if (minutos <= 0) {
    throw new RangeError(`A saída (${saida}) precisa ser depois da chegada (${chegada}).`);
  }
  return Math.ceil(minutos / 60);
}

// O valor de UMA linha de material cobrado: milésimos × preço unitário ÷ 1000, ao centavo, meio para
// cima. 1,2 kg × R$ 18,00 = 1200 × 1800 ÷ 1000 = R$ 21,60.
export function valorDoMaterial(quantidadeMilesimos: number, precoUnitarioCentavos: number): number {
  conferirInteiro("Quantidade em milésimos", quantidadeMilesimos, 1, Number.MAX_SAFE_INTEGER);
  conferirInteiro("Preço unitário em centavos", precoUnitarioCentavos, 0, TETO_CENTAVOS);
  const valor = arredondarMeioParaCima(quantidadeMilesimos * precoUnitarioCentavos, 1000);
  conferirInteiro("Valor do material em centavos", valor, 0, TETO_CENTAVOS);
  return valor;
}

// O valor do uso livre: horas cheias × pessoas × preço da hora + Σ material cobrado, em centavos.
// Pessoas multiplica UMA vez (nota do AGE-13 — o protótipo, não o §6 do briefing).
export function valorDoUsoLivre({
  horas,
  pessoas,
  precoHoraCentavos,
  materialCobradoCentavos,
}: {
  horas: number;
  pessoas: number;
  precoHoraCentavos: number;
  materialCobradoCentavos: number;
}): number {
  conferirInteiro("Horas cheias", horas, 1, 24);
  conferirInteiro("Pessoas", pessoas, PESSOAS_MINIMAS, PESSOAS_MAXIMAS);
  conferirInteiro("Preço da hora em centavos", precoHoraCentavos, 0, TETO_CENTAVOS);
  conferirInteiro("Material cobrado em centavos", materialCobradoCentavos, 0, TETO_CENTAVOS);
  const valor = horas * pessoas * precoHoraCentavos + materialCobradoCentavos;
  conferirInteiro("Valor do uso livre em centavos", valor, 0, TETO_CENTAVOS);
  return valor;
}

// As únicas transições: Reservado → (chegou) → No espaço → (encerrar) → Encerrado. Qualquer outra é
// `null` — quem chama traduz em frase humana (já começou, já foi encerrado).
export function proximoEstado(estado: EstadoDoUsoLivre, acao: AcaoDoUsoLivre): EstadoDoUsoLivre | null {
  if (estado === "reservado" && acao === "chegou") {
    return "no_espaco";
  }
  if (estado === "no_espaco" && acao === "encerrar") {
    return "encerrado";
  }
  return null;
}

// A saída prevista: chegada prevista + horas previstas, em "HH:MM". Nada atravessa a meia-noite: uma
// reserva que passaria dela para em 23:59.
export function saidaPrevista(chegadaPrevista: string, horasPrevistas: number): string {
  conferirInteiro("Horas previstas", horasPrevistas, HORAS_PREVISTAS_MINIMAS, HORAS_PREVISTAS_MAXIMAS);
  const minutos = minutosDe(chegadaPrevista) + horasPrevistas * 60;
  return horaDe(Math.min(minutos, ULTIMO_MINUTO_DO_DIA));
}

// D-18: o uso de um dia que já passou e ainda está "no espaço" foi esquecido — a semana mostra a tag
// "encerrar" e ele continua encerrável. Hoje não pede (a pessoa pode estar lá); reservado e encerrado
// nunca pedem. `hoje` chega por argumento (data civil de Brasília).
export function precisaEncerrar(uso: { data: string; estado: EstadoDoUsoLivre }, hoje: string): boolean {
  return uso.estado === "no_espaco" && uso.data < hoje;
}

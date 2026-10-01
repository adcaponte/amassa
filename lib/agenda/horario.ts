// Módulo puro da Agenda — horas de parede. Zero import: nenhuma linha alcança React, Next,
// drizzle-orm, pg ou `@/db` (grep de aceite do plano 05-01), mesma disciplina de
// `lib/estoque/pedidos.ts`. Nunca lê o relógio: "agora" chega por argumento, em minutos do dia,
// calculado na borda (página ou ação) no fuso de Brasília.
//
// Pitfall 9 da pesquisa: o `pg` devolve a coluna `time` com segundos ("19:00:00"), o formulário
// manda sem ("19:00"). As duas formas são a mesma hora aqui — nada atravessa a meia-noite
// (`check (fim > inicio)` no banco), então minutos do dia de 0 a 1439 bastam.

const FORMATO_HORA = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

// "19:00" ou "19:00:00" → 1140. Recusa com `RangeError` o que não é hora do dia.
export function minutosDe(hora: string): number {
  const casamento = FORMATO_HORA.exec(hora);
  if (!casamento) {
    throw new RangeError(`Hora inválida: ${hora}`);
  }
  const horas = Number(casamento[1]);
  const minutos = Number(casamento[2]);
  const segundos = casamento[3] === undefined ? 0 : Number(casamento[3]);
  if (horas > 23 || minutos > 59 || segundos > 59) {
    throw new RangeError(`Hora inválida: ${hora}`);
  }
  return horas * 60 + minutos;
}

// 1140 → "19:00". Recusa o que não é minuto do dia.
export function horaDe(minutos: number): string {
  if (!Number.isInteger(minutos) || minutos < 0 || minutos > 1439) {
    throw new RangeError(`Minutos do dia inválidos: ${minutos}`);
  }
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return `${String(horas).padStart(2, "0")}:${String(resto).padStart(2, "0")}`;
}

// Verdadeiro quando `agoraMinutos` está dentro do intervalo — o início entra, o fim não.
export function cobreOAgora(inicio: string, fim: string, agoraMinutos: number): boolean {
  return minutosDe(inicio) <= agoraMinutos && agoraMinutos < minutosDe(fim);
}

// Auxiliares das leituras da Agenda usados por mais de um arquivo `consultas-*.ts` (D-24/P10, plano
// 06.5-27 — saíram de `consultas.ts`): `hhmm` (o `pg` devolve `time` com segundos, Pitfall 9) e o
// tipo `LeitorDeConsulta`. Só imports de TIPO — nada daqui chega ao banco em tempo de execução.

import type { db } from "@/db";

import type { TransacaoDoBanco } from "./gravacao";
import { horaDe, minutosDe } from "./horario";

export function hhmm(hora: string | null): string | null {
  return hora === null ? null : horaDe(minutosDe(hora));
}

export type LeitorDeConsulta = Pick<typeof db, "select"> | Pick<TransacaoDoBanco, "select">;

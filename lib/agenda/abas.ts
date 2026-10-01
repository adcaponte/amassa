// Módulo puro da Agenda — o que a URL de `/gestao/agenda` pode pedir. Só imports de módulos puros;
// nenhuma linha alcança React, Next, drizzle-orm, pg ou `@/db`. Parâmetro desconhecido, forjado ou
// repetido cai no padrão — nunca em erro (UI E1·error). As abas (`?aba=`) e a vista mês (`?mes=`)
// chegam nos planos seguintes, aqui mesmo.
import { ehDataCivil } from "@/lib/producao/calendario";

import { segundaDaSemana } from "./semana";

type ValorDaUrl = string | string[] | undefined;

const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// `?semana=` — qualquer data civil vira a segunda da semana dela; sem parâmetro, lixo, data
// impossível ou lista repetida: a segunda da semana de hoje.
export function semanaDaUrl(valor: ValorDaUrl, hoje: string): string {
  if (typeof valor === "string" && ehDataCivil(valor)) {
    return segundaDaSemana(valor);
  }
  return segundaDaSemana(hoje);
}

// `?evento=` (e as outras folhas por URL) — só um uuid; qualquer outra coisa é `null`.
export function idDaUrl(valor: ValorDaUrl): string | null {
  return typeof valor === "string" && FORMATO_UUID.test(valor) ? valor : null;
}

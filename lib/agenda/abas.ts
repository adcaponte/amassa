// Módulo puro da Agenda — o que a URL de `/gestao/agenda` pode pedir. Só imports de módulos puros;
// nenhuma linha alcança React, Next, drizzle-orm, pg ou `@/db`. Parâmetro desconhecido, forjado ou
// repetido cai no padrão — nunca em erro (UI E1·error).
import { buscaDaUrl as buscaDoCadastroDaUrl } from "@/lib/clientes/lista";
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

// `?dia=` (a data da folha "Lançar na agenda" aberta pelo "+ lançar" de um dia) — só data civil
// válida; qualquer outra coisa é `null` e a folha usa hoje.
export function diaDaUrl(valor: ValorDaUrl): string | null {
  return typeof valor === "string" && ehDataCivil(valor) ? valor : null;
}

// `?lancar=1` — a folha "Lançar na agenda" aberta (UI-D8). Só o "1" abre.
export function lancarDaUrl(valor: ValorDaUrl): boolean {
  return valor === "1";
}

export const VISTAS_DA_AGENDA = ["semana", "mes"] as const;
export type VistaDaAgenda = (typeof VISTAS_DA_AGENDA)[number];

// `?vista=` — "mes" abre a grade do mês; o resto (inclusive nada) é a semana, o padrão.
export function vistaDaUrl(valor: ValorDaUrl): VistaDaAgenda {
  return valor === "mes" ? "mes" : "semana";
}

const FORMATO_MES = /^\d{4}-\d{2}$/;

// `?mes=` (AAAA-MM) — um mês que existe; lixo, mês 13 ou data inteira caem no mês de hoje.
export function mesDaUrl(valor: ValorDaUrl, hoje: string): string {
  if (typeof valor === "string" && FORMATO_MES.test(valor) && ehDataCivil(`${valor}-01`)) {
    return valor;
  }
  return hoje.slice(0, 7);
}

// As abas da Agenda (05-UI-SPEC.md §Rotas; UI-D1), a união completa: "agenda" (a semana/o mês,
// padrão), "pessoas" (o cadastro de clientes, D-01), "receber" (o que falta receber — plano 11,
// AGE-15), "site" (o que vai ao ar no site, ao vivo — plano 15, AGE-18, UI-D18) e "numeros" (o mês até
// hoje, só leitura — plano 14, AGE-19). Na ordem da tela.
export const ABAS_DA_AGENDA = ["agenda", "pessoas", "receber", "site", "numeros"] as const;
export type AbaDaAgenda = (typeof ABAS_DA_AGENDA)[number];

export function abaDaAgendaDaUrl(valor: ValorDaUrl): AbaDaAgenda {
  return typeof valor === "string" && (ABAS_DA_AGENDA as readonly string[]).includes(valor)
    ? (valor as AbaDaAgenda)
    : "agenda";
}

// `?busca=` (aba Pessoas) — o mesmo normalizador de Cadastros → Clientes: aparado, até 160 caracteres;
// lista repetida ou nada → "".
export function buscaDaUrl(valor: ValorDaUrl): string {
  return buscaDoCadastroDaUrl(valor);
}

// `?pessoa=` — a ficha da pessoa aberta (UI-D8). Só um uuid; qualquer outra coisa é `null`.
export function pessoaDaUrl(valor: ValorDaUrl): string | null {
  return idDaUrl(valor);
}

// `?turma=` — a folha da turma aberta (D-03, UI-D25). Só um uuid; qualquer outra coisa é `null`.
export function turmaDaUrl(valor: ValorDaUrl): string | null {
  return idDaUrl(valor);
}

// `?uso=` — a folha do uso livre aberta (plano 09, UI-D8). Só um uuid; qualquer outra coisa é `null`.
export function usoDaUrl(valor: ValorDaUrl): string | null {
  return idDaUrl(valor);
}

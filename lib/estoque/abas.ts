// Módulo puro, sem nenhum import — o molde de `lib/financeiro/abas.ts`. Os quatro parâmetros de URL
// da página do Estoque passam por aqui e SÓ por aqui: cada um vira um valor de uma união fechada (ou
// um número de uma lista fechada) antes de chegar a qualquer consulta — nenhum parâmetro cru alcança
// o banco (T-06-29). Valor desconhecido, ausente, vazio ou repetido (`?aba=a&aba=b` chega como
// lista) cai no padrão.

type ValorDaUrl = string | readonly string[] | null | undefined;

function textoUnico(valor: ValorDaUrl): string | null {
  return typeof valor === "string" ? valor : null;
}

// As três abas do protótipo (D-11): Saldos · Histórico · Para onde foi. Saldos é a padrão.
export type AbaDoEstoque = "saldos" | "historico" | "destino";

export function abaDoEstoqueDaUrl(valor: ValorDaUrl): AbaDoEstoque {
  const texto = textoUnico(valor);
  if (texto === "historico") return "historico";
  if (texto === "destino") return "destino";
  return "saldos";
}

// As pílulas do Histórico: Tudo · Entradas · Saídas · Ajustes (herdadas do protótipo).
export type TipoDoHistorico = "tudo" | "entrada" | "saida" | "ajuste";

export function tipoDoHistoricoDaUrl(valor: ValorDaUrl): TipoDoHistorico {
  const texto = textoUnico(valor);
  if (texto === "entrada" || texto === "saida" || texto === "ajuste") return texto;
  return "tudo";
}

// UI-D15: o Histórico mostra 50 por vez; "Mostrar mais 50" soma 50. O teto de 1000 é o limite do
// que uma página carrega de uma vez (T-06-28) — `?limite=` só aceita múltiplos de 50 entre 50 e
// 1000, escritos só com dígitos; qualquer outra coisa volta a 50.
export const LIMITE_DO_HISTORICO = 50;
export const PASSO_DO_HISTORICO = 50;
export const LIMITE_MAXIMO_DO_HISTORICO = 1000;

export function limiteDaUrl(valor: ValorDaUrl): number {
  const texto = textoUnico(valor);
  if (texto === null || !/^\d{1,4}$/.test(texto)) {
    return LIMITE_DO_HISTORICO;
  }
  const numero = Number(texto);
  if (
    numero < LIMITE_DO_HISTORICO ||
    numero > LIMITE_MAXIMO_DO_HISTORICO ||
    numero % PASSO_DO_HISTORICO !== 0
  ) {
    return LIMITE_DO_HISTORICO;
  }
  return numero;
}

// O período do "Para onde foi": Últimos 30 dias (padrão) · 90 dias · Tudo.
export type PeriodoDoParaOndeFoi = "30" | "90" | "tudo";

export function periodoDaUrl(valor: ValorDaUrl): PeriodoDoParaOndeFoi {
  const texto = textoUnico(valor);
  if (texto === "90" || texto === "tudo") return texto;
  return "30";
}

// Quantos dias civis o período cobre; `null` = sem corte ("Tudo").
export function diasDoPeriodo(periodo: PeriodoDoParaOndeFoi): number | null {
  if (periodo === "tudo") return null;
  return periodo === "90" ? 90 : 30;
}

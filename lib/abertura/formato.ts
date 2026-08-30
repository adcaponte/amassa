// Módulo puro: recebe dados, devolve dados. Só `Intl` global, nenhum import — mesmo molde de
// `lib/encomendas/formato.ts`. `hojeEmBrasilia` é a ÚNICA função deste módulo que lê um
// instante, e mesmo ela o recebe por argumento, nunca lê `new Date()` por dentro.

// O container do Postgres roda em UTC e `current_date` devolveria o dia errado à noite
// (`02-MODELO-DE-DADOS.md` §0) — esta função existe para o mesmo problema no lado da aplicação.
// A localidade `en-CA` produz `YYYY-MM-DD` direto, sem montagem manual de string.
export function hojeEmBrasilia(agora: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

function partesDeData(dataIso: string): { ano: number; mes: number; dia: number } {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  return { ano, mes, dia };
}

function dataUtcDoDiaCivil(dataIso: string): Date {
  const { ano, mes, dia } = partesDeData(dataIso);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

// "R$ 4.800" — inteiro, sem centavos, como o protótipo (`Math.round` do valor em reais +
// `toLocaleString("pt-BR")`). É AQUI, e só aqui, que o arredondamento de uma parcela fracionada
// acontece — `lib/abertura/parcelas.ts` nunca arredonda dentro da conta (comentário de
// `calcularParcelas`).
export function formatarReais(centavos: number): string {
  const reais = centavos / 100;
  return `R$ ${Math.round(reais).toLocaleString("pt-BR")}`;
}

// "10/11" — dia e mês com dois dígitos, separados por barra (o formato do protótipo para a
// data da próxima/última parcela e a etiqueta "chega DD/MM"). Monta `Date.UTC` do dia civil e
// formata com `timeZone: "UTC"`, nunca com o fuso do runtime — o mesmo cuidado de
// `lib/encomendas/formato.ts`, para o dia nunca saltar entre servidor (UTC) e leitura local.
export function formatarDiaEMes(dataIso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(dataUtcDoDiaCivil(dataIso));
}

// "24 de outubro de 2026" — a data de inauguração por extenso (plano 04), mesma disciplina de
// `Date.UTC` + `timeZone: "UTC"` de `formatarDiaEMes`.
export function formatarDataPorExtenso(dataIso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(dataUtcDoDiaCivil(dataIso));
}

// "novembro de 2026" — o nome do mês por extenso, da chave `"YYYY-MM"` que agrupa a visão "Por
// mês" (`lib/abertura/parcelas.ts` → `fluxoMensal`, plano 04). Usa `Intl` — por isso mora aqui, e
// não no módulo puro de cálculo (a mesma separação que este arquivo já mantém de `parcelas.ts`) —
// a partir de `Date.UTC` do dia 1 daquele mês, com `timeZone: "UTC"`, nunca com o fuso do
// runtime.
export function nomeDoMes(chave: string): string {
  const [ano, mes] = chave.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(ano, mes - 1, 1)));
}

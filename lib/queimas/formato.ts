// Módulo puro: recebe dados, devolve dados. Nenhum import — mesma disciplina de
// `lib/encomendas/formato.ts` (PD-04): `date-fns` foi conscientemente dispensado no projeto
// inteiro; só `Intl.DateTimeFormat` nativo.
//
// `hojeEmBrasilia` é copiado VERBATIM de `lib/encomendas/formato.ts` — é a função que
// `04-CONTEXT.md` §Specifics aponta como a solução já paga para a armadilha de fuso: o
// container do Postgres roda em UTC e `current_date`/`getDay()` do runtime dariam o dia errado
// à noite em Brasília (`02-MODELO-DE-DADOS.md` §0). É a única função aqui que lê um instante do
// relógio — e mesmo essa recebe o instante como argumento, nunca lê `new Date()` por dentro.

// A localidade `en-CA` produz `YYYY-MM-DD` direto, sem montagem manual de string.
export function hojeEmBrasilia(agora: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

// Converte um instante (`timestamptz`, string ISO) no dia civil `YYYY-MM-DD` de Brasília — o
// mesmo `Intl` de `hojeEmBrasilia`, mas recebendo o instante já pronto em vez do relógio. É esta
// função que resolve a armadilha de fuso de `queimas.ocorridaEm`/`manutencoes.ocorridaEm`: um
// instante às 23h30 de um dia em Brasília ainda cai no dia anterior em UTC, e `getDay()` do
// processo (rodando em UTC) erraria o dia civil.
export function diaCivilEmBrasilia(instanteIso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(instanteIso));
}

function partesDeData(dataIso: string): { ano: number; mes: number; dia: number } {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  return { ano, mes, dia };
}

function dataUtcDoDiaCivil(dataIso: string): Date {
  const { ano, mes, dia } = partesDeData(dataIso);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

// Mês abreviado em português, sem o ponto final que o `Intl` do runtime às vezes devolve
// ("ago.") — mesma abordagem de `mesAbreviado` em `lib/encomendas/formato.ts`: formata o dia
// civil já calculado com `timeZone: "UTC"` (nunca o fuso do runtime, que faria o mês saltar
// perto da virada), e remove o ponto.
function mesAbreviado(dataIso: string): string {
  const texto = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" }).format(
    dataUtcDoDiaCivil(dataIso),
  );
  return texto.replace(".", "");
}

// "12 ago 2026" — dia civil de Brasília do instante recebido, sem zero à esquerda, mês abreviado
// sem ponto, ano. É a data que `fraseDoRodape` (`lib/queimas/textos.ts`) usa para "Última
// manutenção em {data}".
export function formatarInstanteCurto(instanteIso: string): string {
  const diaCivil = diaCivilEmBrasilia(instanteIso);
  const { ano, dia } = partesDeData(diaCivil);
  return `${dia} ${mesAbreviado(diaCivil)} ${ano}`;
}

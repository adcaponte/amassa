// Módulo puro: recebe dados, devolve dados. Nenhum import — só `Intl.DateTimeFormat` global,
// o mesmo caminho que `scripts/testar-migracoes.mjs` já usa para calcular a data civil de
// Brasília sem instalar dependência de fuso nenhuma (`date-fns` foi conscientemente dispensado,
// PD-04 do plano 01).
//
// `hojeEmBrasilia` é a única função que lê um instante do relógio — e mesmo essa recebe o
// instante como argumento, nunca lê `new Date()` por dentro. As demais formatam a partir da
// string civil `YYYY-MM-DD` já calculada por `lib/encomendas/cronograma.ts`, construindo um
// `Date.UTC` do dia civil e formatando com `timeZone: "UTC"` — nunca com o fuso do runtime, ou o
// dia salta quando o servidor está em UTC e o formatador em Brasília.

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

// Mês abreviado em português, sem o ponto final que o `Intl` do runtime às vezes devolve
// ("ago.") — `03-UI-SPEC.md` escreve "12 a 18 ago" sem ponto, e a diferença apareceria como
// ruído em toda data da tela.
function mesAbreviado(dataIso: string): string {
  const texto = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" }).format(
    dataUtcDoDiaCivil(dataIso),
  );
  return texto.replace(".", "");
}

function mesPorExtenso(dataIso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(
    dataUtcDoDiaCivil(dataIso),
  );
}

// "12 ago" — dia sem zero à esquerda, mês abreviado sem ponto. A unidade que a trilha vertical,
// o Gantt e o histórico usam para toda data isolada.
export function formatarDiaCurto(dia: string): string {
  const { dia: diaDoMes } = partesDeData(dia);
  return `${diaDoMes} ${mesAbreviado(dia)}`;
}

// "12 de agosto de 2026" — usado onde a data precisa ser lida por extenso (ex.: confirmação de
// conclusão antecipada).
export function formatarDiaCompleto(dia: string): string {
  const { dia: diaDoMes, ano } = partesDeData(dia);
  return `${diaDoMes} de ${mesPorExtenso(dia)} de ${ano}`;
}

// "12 a 18 ago" quando início e fim caem no mesmo mês; "28 ago a 3 set" quando o mês muda — os
// dois meses aparecem só quando fazem falta, para não repetir "ago" duas vezes numa mesma
// barra do Gantt.
export function formatarIntervalo(inicio: string, ultimoDia: string): string {
  const partesInicio = partesDeData(inicio);
  const partesFim = partesDeData(ultimoDia);
  const mesmoMes = partesInicio.ano === partesFim.ano && partesInicio.mes === partesFim.mes;

  if (mesmoMes) {
    return `${partesInicio.dia} a ${partesFim.dia} ${mesAbreviado(ultimoDia)}`;
  }

  return `${partesInicio.dia} ${mesAbreviado(inicio)} a ${partesFim.dia} ${mesAbreviado(ultimoDia)}`;
}

// "12 ago – 3 set" (travessão, `03-UI-SPEC.md`) — o período do histórico, sempre com o mês dos
// dois lados (ao contrário de `formatarIntervalo`, que omite o mês repetido). Com `fim: null`
// (encomenda ainda sem conclusão calculada), devolve só o início — nunca "12 ago – —", que
// pareceria um período quebrado em vez de um período que ainda não tem fim.
export function formatarPeriodo(inicio: string, fim: string | null): string {
  if (fim === null) {
    return formatarDiaCurto(inicio);
  }

  return `${formatarDiaCurto(inicio)} – ${formatarDiaCurto(fim)}`;
}

// Módulo puro: recebe dados, devolve dados. Só `Intl` global, nenhum import — mesmo molde de
// `lib/abertura/formato.ts`. `hojeEmBrasilia` é a ÚNICA função deste módulo que lê um instante, e
// mesmo ela o recebe por argumento, nunca lê `new Date()` por dentro.
//
// DESVIO DELIBERADO de `lib/abertura/formato.ts::formatarReais` (04.4-UI-SPEC.md, Assunção 2):
// aquela função arredonda para reais inteiros ("R$ 4.800") — correto lá, porque os valores da
// Abertura nascem inteiros. O Financeiro NÃO pode herdar essa função: taxa de cartão (3,5% de
// R$ 150 = R$ 5,25), desconto proporcional e diferença de pagamento produzem centavos reais que
// precisam aparecer. Este módulo é NOVO e ESCOPADO — mesmo nome de função, arquivo diferente, sem
// colisão.

// O container do Postgres roda em UTC e `current_date` devolveria o dia errado à noite — esta
// função existe para o mesmo problema no lado da aplicação. A localidade `en-CA` produz
// `YYYY-MM-DD` direto, sem montagem manual de string.
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

// "R$ 1.234,56" — MOSTRA centavos, sempre com duas casas (UI-SPEC "Dinheiro: centavos inteiros,
// exibidos com 2 casas") — mesma técnica que o `brl()` do próprio protótipo já usa
// (`toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })`).
export function formatarReais(centavos: number): string {
  const reais = centavos / 100;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(reais);
}

// "18/12/26" — dia, mês e ano com dois dígitos, separados por barra (o formato `dBR` do
// protótipo). `Date.UTC` + `timeZone: "UTC"`, nunca o fuso do runtime — mesmo cuidado de
// `lib/abertura/formato.ts::formatarDiaEMes`.
export function formatarDataCurta(dataIso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    timeZone: "UTC",
  }).format(dataUtcDoDiaCivil(dataIso));
}

// "0,04" → "0,04"; "15" → "15"; "2,5" → "2,5" — pt-BR, até 3 casas, sem zeros à direita. Recebe
// um texto decimal normalizado com ponto (o formato que `converterQuantidade` devolve), nunca um
// `number` (perderia precisão em quantidades fracionárias pequenas).
export function formatarQuantidade(quantidadeTexto: string): string {
  const numero = Number(quantidadeTexto);
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(numero);
}

// "dezembro de 2026" — o nome do mês por extenso, a partir da chave "YYYY-MM" que agrupa o
// extrato/Mês.
export function nomeDoMes(chave: string): string {
  const [ano, mes] = chave.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(ano, mes - 1, 1)));
}

// "2026-12" a partir de "2026-12-18" — a chave que agrupa movimentos por mês (extrato, D-11).
export function chaveDoMes(dataIso: string): string {
  return dataIso.slice(0, 7);
}

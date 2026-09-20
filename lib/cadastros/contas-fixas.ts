// Módulo puro — só importa `lib/financeiro/calendario.ts` (Cadastros e Financeiro são módulos
// PERMANENTES do mesmo domínio, key_links do plano: a dependência é segura, nunca `lib/abertura`).
// Nem React, nem Next, nem drizzle-orm, nem `@/db`. A aritmética de vencimento e o título da
// despesa gerada por "Gerar as contas de {mês}" (04.4-10-PLAN.md, D-13).
import { mesSeguinte, ultimoDiaDoMes } from "@/lib/financeiro/calendario";

// Cópia PRÓPRIA deste módulo (D-15: cada módulo redeclara, nunca importa de outro) — diferente do
// formato "mês de ano" de `lib/financeiro/formato.ts::nomeDoMes` (usado no rótulo do botão e no
// aviso), este é o formato curto "mês/ano" do TÍTULO da despesa gerada, herdado do protótipo.
const NOMES_DOS_MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

// O dia de vencimento da conta fixa, dentro do mês `chaveDoMes` ("YYYY-MM") — dia que não existe
// naquele mês (31 de abril, 29/30/31 de fevereiro fora de ano bissexto) cai no ÚLTIMO DIA daquele
// mês (mesma regra de `lib/financeiro/calendario.ts::somarMeses`, D-19, mas aqui o mês de destino
// é dado, nunca somado a partir de uma data anterior).
export function vencimentoNoMes(diaVencimento: number, chaveDoMes: string): string {
  const [anoTexto, mesTexto] = chaveDoMes.split("-");
  const ano = Number(anoTexto);
  const mes = Number(mesTexto);
  const ultimoDia = ultimoDiaDoMes(ano, mes);
  const dia = Math.min(diaVencimento, ultimoDia);
  return `${anoTexto}-${mesTexto}-${String(dia).padStart(2, "0")}`;
}

// "janeiro/2027" — o formato curto usado só no título da despesa gerada (nunca confundir com
// `nomeDoMes` de `lib/financeiro/formato.ts`, que usa "de" e serve o rótulo do botão/aviso).
export function nomeCurtoDoMes(chaveDoMes: string): string {
  const [anoTexto, mesTexto] = chaveDoMes.split("-");
  const indiceDoMes = Number(mesTexto) - 1;
  return `${NOMES_DOS_MESES[indiceDoMes]}/${anoTexto}`;
}

// "Aluguel · janeiro/2027" — o título do documento de despesa que `gerarContasDoMes`
// (lib/cadastros/acoes.ts) grava para cada conta fixa ativa.
export function tituloDaContaFixa(nome: string, chaveDoMes: string): string {
  return `${nome} · ${nomeCurtoDoMes(chaveDoMes)}`;
}

// O mês que "Gerar as contas de {mês}" sempre gera: o mês SEGUINTE ao de hoje (suposição do
// planejador registrada no plano — o protótipo nunca oferece um seletor de mês). `hojeIso`
// ("YYYY-MM-DD") chega por argumento, nunca lido de dentro deste módulo puro.
export function mesDaGeracao(hojeIso: string): string {
  const chaveDoMesAtual = hojeIso.slice(0, 7);
  return mesSeguinte(chaveDoMesAtual);
}

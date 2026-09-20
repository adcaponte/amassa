// Módulo puro — só importa `lib/financeiro/calendario.ts` (Cadastros e Financeiro são módulos
// PERMANENTES do mesmo domínio, key_links do plano: a dependência é segura, nunca `lib/abertura`).
// Nem React, nem Next, nem drizzle-orm, nem `@/db`. A aritmética de vencimento e o título da
// despesa gerada por "Gerar as contas de {mês}" (04.4-10-PLAN.md, D-13).
import { mesSeguinte, ultimoDiaDoMes } from "@/lib/financeiro/calendario";

// O teto da faixa de "Gerar as contas de {mês}" (resposta do dono, 2026-09-20): a faixa é o mês de
// hoje mais estes onze seguintes — doze opções no total, fechando o formato no servidor e cabendo
// num seletor nativo no celular.
export const MESES_DE_GERACAO_A_FRENTE = 11;

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

// A faixa que "Gerar as contas de {mês}" oferece no seletor (resposta do dono, 2026-09-20): o mês
// de `hojeIso` e os `MESES_DE_GERACAO_A_FRENTE` seguintes, em ordem, usando `mesSeguinte` — o
// módulo continua sem construir `Date` nenhuma e sem ler o relógio. É esta lista, não uma
// igualdade com um único mês, que `mesPermitidoParaGeracao` confere e que o servidor
// (`gerarContasDoMes`) usa para recusar um mês fora da faixa.
export function mesesParaGeracao(hojeIso: string): string[] {
  const meses = [hojeIso.slice(0, 7)];
  for (let i = 0; i < MESES_DE_GERACAO_A_FRENTE; i++) {
    meses.push(mesSeguinte(meses[meses.length - 1]));
  }
  return meses;
}

// Se `mes` está dentro da faixa de `mesesParaGeracao(hojeIso)` — a ÚNICA porta que o servidor usa
// para aceitar ou recusar o mês escolhido no seletor (T-04.4-72): um envio forçado (DOM
// adulterado) com um mês fora da faixa, ou num formato que não é "YYYY-MM", nunca passa daqui.
export function mesPermitidoParaGeracao(hojeIso: string, mes: string): boolean {
  return mesesParaGeracao(hojeIso).includes(mes);
}

// O mês que o seletor de "Gerar as contas de {mês}" mostra ESCOLHIDO quando a tela abre — deixou
// de ser "o único mês que o botão gera" (antes deste plano, o protótipo nunca oferecia seletor) e
// passou a ser só o PRÉ-SELECIONADO dentro da faixa de `mesesParaGeracao`: sempre o mês seguinte
// ao de hoje, o mesmo valor de sempre, mantendo o caso de uso mais comum em um toque só. `hojeIso`
// ("YYYY-MM-DD") chega por argumento, nunca lido de dentro deste módulo puro.
export function mesDaGeracao(hojeIso: string): string {
  const chaveDoMesAtual = hojeIso.slice(0, 7);
  return mesSeguinte(chaveDoMesAtual);
}

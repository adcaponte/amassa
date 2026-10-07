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

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// 06.5-WR-03 (quick 261007-shs; decisão do dono, 07/10/2026 — “perguntar antes”). Desde a D-26 (0031), o
// índice único é PARCIAL (`where cancelado_em is null`): uma conta cuja despesa do mês foi cancelada pode
// nascer de novo — é o caminho “cancele e gere de novo” para corrigir uma conta. Mas o botão é por MÊS, e
// “Gerar” recriava em silêncio toda conta cancelada de propósito naquele mês (pagável duas vezes). Agora
// nada se grava antes de a pessoa ver essas contas pelo nome e escolher quais voltam.

export type ContaParaPlanejarGeracao = {
  id: string;
  nome: string;
  valorCentavos: number;
  // Tem despesa NÃO cancelada no mês (o índice parcial já segura: nunca entra em lista nenhuma).
  temAtiva: boolean;
  // Tem despesa CANCELADA no mês.
  temCancelada: boolean;
};

export type ContaCanceladaNoMes = { id: string; nome: string; valorCentavos: number };

export type PlanoDaGeracao =
  | { tipo: "perguntar"; canceladas: ContaCanceladaNoMes[]; novas: number }
  | { tipo: "gerar"; criar: string[]; recriar: string[]; mantidas: string[] };

// A decisão, sobre o estado lido NA transação (`gerarContasDoMes`):
// - “só cancelada” no mês = sem ativa e com cancelada; “sem nada” = nem uma nem outra (é criada, como sempre);
// - se alguma “só cancelada” de AGORA não está em `canceladasVistas` (a pessoa não a viu — inclusive a aba
//   aberta antes da publicação, que não manda as listas), PERGUNTA: a lista inteira de agora, em ordem de
//   nome, e quantas seriam criadas. Nada a gravar;
// - senão GERA: `recriar` = as “só canceladas” de agora que vieram marcadas; `mantidas` = as outras; uma
//   marcada que deixou de ser “só cancelada” (alguém a gerou no meio) não entra em lista nenhuma.
export function planejarGeracaoDoMes({
  contas,
  canceladasVistas,
  recriar,
}: {
  contas: readonly ContaParaPlanejarGeracao[];
  canceladasVistas: readonly string[];
  recriar: readonly string[];
}): PlanoDaGeracao {
  const vistas = new Set(canceladasVistas);
  const marcadas = new Set(recriar);
  const soCanceladas = contas
    .filter((conta) => !conta.temAtiva && conta.temCancelada)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const criar = contas.filter((conta) => !conta.temAtiva && !conta.temCancelada).map((conta) => conta.id);

  if (soCanceladas.some((conta) => !vistas.has(conta.id))) {
    return {
      tipo: "perguntar",
      canceladas: soCanceladas.map(({ id, nome, valorCentavos }) => ({ id, nome, valorCentavos })),
      novas: criar.length,
    };
  }

  return {
    tipo: "gerar",
    criar,
    recriar: soCanceladas.filter((conta) => marcadas.has(conta.id)).map((conta) => conta.id),
    mantidas: soCanceladas.filter((conta) => !marcadas.has(conta.id)).map((conta) => conta.id),
  };
}

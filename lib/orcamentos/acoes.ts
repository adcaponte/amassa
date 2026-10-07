// Índice das ações dos Orçamentos (D-24/P10, plano 06.5-27). As 1.694 linhas deste arquivo foram
// MOVIDAS, sem reescrever, para arquivos por assunto; este caminho continua importável, então nenhum
// componente precisou saber da divisão:
//
//   acoes-rascunho.ts  "use server" — criar, cabeçalho, linhas, custos de projeto, plano, observações
//   acoes-ciclo.ts     "use server" — enviar, recusar, voltar a rascunho, duplicar, atualizar preços
//   acoes-aprovacao.ts "use server" — "Cliente aprovou"
//   acoes-fotos.ts     "use server" — anexar, legenda e remover foto
//   acoes-comum.ts     sem diretiva, PURO — o tipo de resultado, as classes de recusa e as frases
//   (mais os auxiliares de servidor sem diretiva — trava do rascunho, guarda das transições —, que
//   este índice NUNCA reexporta)
//
// SEM diretiva: este índice entra no pacote do cliente. Por isso reexporta VALORES só dos arquivos
// "use server" (no cliente viram referências de ação) e, se um dia preciso, do `acoes-comum.ts`
// puro; todo o resto é `export type`. Cada ação tem `exigirUsuario()` na primeira linha no
// arquivo onde mora — `npm run verificar-acoes` confere lá.

export type { ResultadoDeAcao } from "./acoes-comum";
export {
  criarOrcamento,
  atualizarCabecalhoDoOrcamento,
  acrescentarLinha,
  atualizarLinha,
  removerLinha,
  acrescentarCustoDeProjeto,
  atualizarCustoDeProjeto,
  removerCustoDeProjeto,
  definirPlanoDePagamento,
  definirObservacoes,
} from "./acoes-rascunho";
export {
  marcarComoEnviado,
  recusarOrcamento,
  voltarParaRascunho,
  duplicarOrcamento,
  atualizarPrecos,
} from "./acoes-ciclo";
export { aprovarOrcamento } from "./acoes-aprovacao";
export type { ResultadoDaAprovacao } from "./acoes-aprovacao";
export {
  anexarFotoDeOrcamento,
  definirLegendaDaFoto,
  removerFotoDeOrcamento,
} from "./acoes-fotos";
export type { FotoAnexada } from "./acoes-fotos";

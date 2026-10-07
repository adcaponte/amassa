// Índice das ações da Agenda (D-24/P10, plano 06.5-27). As 2.099 linhas deste arquivo foram MOVIDAS,
// sem reescrever, para arquivos por assunto; este caminho continua importável, então nenhum
// componente precisou saber da divisão:
//
//   acoes-datas.ts     "use server" — presença, avulsa, dia fechado, cancelar data, colocar/tirar da lista
//   acoes-turmas.ts    "use server" — lançar, editar, mais semanas, desativar, entrar e sair da turma
//   acoes-uso-livre.ts "use server" — reservar, chegada, cancelar, encerrar, material do uso
//   acoes-cobranca.ts  "use server" — receber agora, mensalidades em lote, dispensa
//   acoes-comum.ts     sem diretiva, PURO — os tipos de resultado e os auxiliares de validação
//   (mais um auxiliar de servidor sem diretiva — revalidar as telas —, que este índice NUNCA reexporta)
//
// SEM diretiva: este índice entra no pacote do cliente. Por isso reexporta VALORES só dos arquivos
// "use server" (no cliente viram referências de ação) e, se um dia preciso, do `acoes-comum.ts`
// puro; todo o resto é `export type`. Cada ação tem `exigirUsuario()` na primeira linha no
// arquivo onde mora — `npm run verificar-acoes` confere lá.

export type { ResultadoDeAcao, ResultadoDoLancamento } from "./acoes-comum";
export {
  definirPresenca,
  definirDireitoARepor,
  lancarAvulsa,
  fecharDia,
  conferirDiaParaLancar,
  cancelarData,
  tirarBloqueio,
  buscarPessoasParaData,
  colocarNaData,
  tirarDaLista,
} from "./acoes-datas";
export type {
  Lancado,
  ResultadoCancelarData,
  Colocado,
  TiradoDaLista,
} from "./acoes-datas";
export {
  lancarTurma,
  editarTurma,
  marcarMaisSemanas,
  desativarTurma,
  entrarNaTurma,
  sairDaTurma,
} from "./acoes-turmas";
export type {
  TurmaLancada,
  TurmaSalva,
  SemanasMarcadas,
  TurmaDesativada,
  EntradaNaTurma,
  SaidaDaTurma,
} from "./acoes-turmas";
export {
  reservarUsoLivre,
  marcarChegada,
  corrigirChegada,
  cancelarReserva,
  encerrarUsoLivre,
  acrescentarMaterial,
  definirCobrancaDoMaterial,
  tirarMaterial,
} from "./acoes-uso-livre";
export type { UsoLivreReservado, ChegadaMarcada, UsoEncerrado } from "./acoes-uso-livre";
export {
  receberAgora,
  lancarMensalidadesEmLote,
  definirDispensa,
} from "./acoes-cobranca";
export type { RecebidoAgora, LoteLancado, DispensaDefinida } from "./acoes-cobranca";

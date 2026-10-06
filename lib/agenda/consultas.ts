// As leituras da Agenda (Fase 5). SEM a diretiva de Server Action (Pattern 4): são chamadas só por
// Server Components (a página), que já chamaram `exigirUsuario()` antes — uma exportação de
// arquivo com a diretiva viraria endpoint chamável pelo navegador.
//
// O `pg` devolve as colunas `time` com segundos ("19:00:00", Pitfall 9): tudo sai daqui já em
// "HH:MM", pelo módulo puro `horario.ts`.

// Índice das leituras da Agenda (D-24/P10, plano 06.5-27). As 1.881 linhas deste arquivo foram
// MOVIDAS, sem reescrever, para arquivos por assunto; este caminho continua importável:
//
//   consultas-semana.ts    a semana, o mês, a folha do evento, os dias fechados
//   consultas-pessoas.ts   últimas vindas, créditos de reposição, pessoas para uma data
//   consultas-turmas.ts    a turma, perdas ao desativar, datas do mês, turmas da pessoa
//   consultas-uso-livre.ts o uso livre, o material, os itens do sistema e o preço da hora
//   consultas-receber.ts   a receber, cobrança para a venda, dispensadas, situação de pagamento
//   consultas-inicio.ts    a agenda de hoje do Início e os Números
//   consultas-comum.ts     `hhmm` e o tipo `LeitorDeConsulta`, usados por vários dos acima
//
// Nenhum arquivo "use client" importa VALOR daqui nem de `consultas-*` — só `import type`.

export {
  lerSemana,
  fechadosEntre,
  vendaDaInscricao,
  perdasAoCancelar,
  obterEvento,
  aulasDaTurmaNoMes,
  lerDiaParaLancar,
  lerMes,
} from "./consultas-semana";
export type {
  EventoDaSemana,
  ItemDaSemana,
  InscritoCarregado,
  VendaDaInscricao,
  EventoCarregado,
  SugestaoDaAula,
  PerdasAoCancelar,
  DiaParaLancar,
  LancamentoDoMes,
} from "./consultas-semana";
export {
  ultimasVindas,
  creditosDoCliente,
  creditosPorCliente,
  saldosDeReposicao,
  pessoasParaData,
} from "./consultas-pessoas";
export type { VindaDaPessoa, PessoasParaData } from "./consultas-pessoas";
export {
  perdasAoDesativar,
  obterTurma,
  datasDaTurmaNoMes,
  turmasDaPessoa,
  turmasPorCliente,
} from "./consultas-turmas";
export type {
  PerdasAoDesativar,
  AlunoDaTurma,
  TurmaCarregada,
  TurmaDaPessoa,
} from "./consultas-turmas";
export {
  obterItensDoSistema,
  obterUsoLivre,
  materiaisDoUso,
  precosDeVendaDoEstoque,
  precoDaHoraDoUsoLivre,
} from "./consultas-uso-livre";
export type {
  UsoLivreDaSemana,
  ItemDoSistema,
  ItensDoSistema,
  UsoLivreCarregado,
  CobrancaDoUsoLivre,
  MaterialDoUso,
} from "./consultas-uso-livre";
export {
  lerAReceber,
  quantosAReceber,
  itensDoSistemaParaVenda,
  cobrancaParaVenda,
  lerDispensadas,
  situacoesDasInscricoes,
  situacaoDaMensalidadeDoMes,
  aReceberPorEvento,
  situacoesDosUsos,
  cobrancasDaPessoa,
  aReceberPorCliente,
} from "./consultas-receber";
export type {
  LinhaAReceber,
  AReceberCarregado,
  CobrancaParaVenda,
  DispensadaCarregada,
  DispensadasCarregadas,
  SituacaoDePagamento,
} from "./consultas-receber";
export {
  LINHAS_DA_AGENDA_DE_HOJE,
  agendaDeHoje,
  dadosDosNumeros,
} from "./consultas-inicio";
export type { LinhaDeHoje, AgendaDeHoje } from "./consultas-inicio";

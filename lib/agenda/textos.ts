// Frases pt-BR da Agenda — verbatim da UI-SPEC (05-UI-SPEC.md §Copywriting Contract). Zero import:
// nenhuma linha alcança React, Next, drizzle-orm, pg ou `@/db`. Os planos seguintes acrescentam aqui
// as frases dos seus caminhos; nenhuma frase da Agenda mora dentro de componente.

export const TITULO_AGENDA = "Agenda";

// Semana e cartão de evento.
export const FRASE_NADA_MARCADO = "nada marcado";
export const ROTULO_SEMANA_ANTERIOR = "Semana anterior";
export const ROTULO_PROXIMA_SEMANA = "Próxima semana";
export const ROTULO_DIA_TODO = "dia todo";
export const ROTULO_CANCELADA = "cancelada";

// A sub-linha do cartão: o TIPO sempre escrito (a cor da borda é decorativa — UI-D12) + o fim.
export function subLinhaDoCartao(tipo: "turma" | "avulsa" | "fechado", fim: string | null): string {
  if (tipo === "fechado" || fim === null) {
    return "Fechado · o dia todo";
  }
  return tipo === "turma" ? `Turma fixa · até ${fim}` : `Oficina · até ${fim}`;
}

// "{n} / {vagas}" na terceira coluna do cartão.
export function ocupacaoDoCartao(inscritos: number, vagas: number): string {
  return `${inscritos} / ${vagas}`;
}

// Folha do evento.
export const ROTULO_FECHAR = "Fechar";
export const ROTULO_PRONTO = "Pronto";
export const ROTULO_TURMA_FIXA = "Turma fixa";
export const ROTULO_AULA_AVULSA = "Aula ou oficina avulsa";

export function tituloQuemVem(inscritos: number, vagas: number): string {
  return `Quem vem · ${inscritos} de ${vagas}`;
}

export const FRASE_NINGUEM_INSCRITO = "Ninguém inscrito ainda.";

export const DICA_FIM_TURMA =
  "Turma fixa: o pagamento é a mensalidade do mês (aparece ao lado do nome). Quem vem repor não paga de novo. Aula experimental é cobrada ou não na hora de colocar a pessoa.";
export const DICA_FIM_OFICINA =
  "Oficina avulsa: cada inscrição é paga à parte — o que falta aparece em “A receber”.";

// Presença — o segmentado "Veio · Faltou".
export const ROTULO_VEIO = "Veio";
export const ROTULO_FALTOU = "Faltou";

export function rotuloPresencaDe(nome: string): string {
  return `Presença de ${nome}`;
}

// Tags da linha de inscrito.
export const TAG_REPOSICAO = "reposição";
export const TAG_EXPERIMENTAL = "experimental";

// Erros (Copywriting → Erros).
export const TITULO_ERRO = "Algo não funcionou.";
export const ROTULO_TENTAR_DE_NOVO = "Tentar de novo";
export const FRASE_ERRO_CARREGAR_AGENDA =
  "Não deu para carregar a agenda. Verifique a internet e tente de novo.";
export const FRASE_ERRO_CARREGAR_AULA =
  "Não deu para carregar esta aula. Verifique a internet e tente de novo.";
export const FRASE_LANCAMENTO_NAO_EXISTE =
  "Esse lançamento não existe mais — talvez tenha sido removido em outro celular.";
export const FRASE_DATA_CANCELADA = "Esta data foi cancelada — a tela foi atualizada.";

export function fraseFalhaAoMarcarPresenca(nome: string): string {
  return `Não deu para marcar a presença de ${nome}. Toque de novo.`;
}

// A frase genérica do servidor quando a presença não grava — a tela troca pela frase com o nome.
export const FRASE_FALHA_PRESENCA_GENERICA =
  "Não deu para marcar a presença. Verifique a internet e tente de novo.";

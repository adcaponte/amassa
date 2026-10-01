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
// D-17: um dos três itens do sistema sumiu do Catálogo (só acontece apagando à mão no banco — o
// gatilho `travar_item_do_sistema` recusa pela aplicação).
export const FRASE_ITENS_DA_AGENDA_SUMIRAM =
  "Os itens da Agenda sumiram do Catálogo. Fale com o Theo — a migração 0026 cria os três.";

export function fraseFalhaAoMarcarPresenca(nome: string): string {
  return `Não deu para marcar a presença de ${nome}. Toque de novo.`;
}

// A frase genérica do servidor quando a presença não grava — a tela troca pela frase com o nome.
export const FRASE_FALHA_PRESENCA_GENERICA =
  "Não deu para marcar a presença. Verifique a internet e tente de novo.";

// Folha "Lançar na agenda" (05-UI-SPEC.md §"Folha "Lançar na agenda"", §Copywriting → Ações,
// Rótulos, Erros, Toasts). Os tipos chegam aos poucos: avulsa e fechado aqui (plano 03), turma no
// plano 06 e uso livre no plano 09 — cada um com o formulário inteiro, nunca uma pílula sem destino.
export const TITULO_LANCAR_NA_AGENDA = "Lançar na agenda";
export const ROTULO_HOJE = "Hoje";
export const ROTULO_LANCAR_NO_DIA = "lançar";

export function rotuloLancarNoDia(diaDaSemana: string, diaMes: string): string {
  return `Lançar em ${diaDaSemana}, ${diaMes}`;
}

export const ARIA_O_QUE_LANCAR = "O que lançar";
export const ROTULO_FECHADO_BLOQUEIO = "Fechado / bloqueio";
export const ROTULO_VOLTAR = "Voltar";

// O botão de gravar diz o que vai acontecer (UI-D9) — e, enquanto grava, o "…ndo…".
export const ROTULO_LANCAR_AULA = "Lançar aula";
export const ROTULO_FECHAR_O_DIA = "Fechar o dia";
export const ROTULO_LANCANDO = "Lançando…";
export const ROTULO_FECHANDO = "Fechando…";

// Rótulos, padrões e dicas dos campos.
export const ROTULO_NOME = "Nome";
export const PLACEHOLDER_NOME_AULA = "ex.: Oficina de pintura em biscoito";
export const ROTULO_DATA = "Data";
export const ROTULO_COMECA = "Começa";
export const ROTULO_TERMINA = "Termina";
export const ROTULO_VAGAS = "Vagas";
export const VAGAS_PADRAO = "8";
export const ROTULO_PRECO_POR_PESSOA = "Preço por pessoa (R$)";
export const ROTULO_MOSTRAR_NO_SITE = "Mostrar no calendário público do site";
export const ROTULO_MOTIVO = "Motivo";
export const PLACEHOLDER_MOTIVO = "ex.: feriado";
export const DICA_MOTIVO = "não aparece no site — lá o dia aparece só como fechado";
export const DICA_TIPO_AULA = "Uma data, com vagas e preço por pessoa. Material incluso.";
export const DICA_TIPO_FECHADO =
  "Fecha o dia: feriado, viagem, queima grande. No site o dia aparece só como “fechado”, sem o motivo.";

// Erros de campo — embaixo do campo, nunca em toast.
export const FRASE_NOME_DA_AULA = "Dê um nome à aula ou oficina.";
export const FRASE_NOME_LONGO = "O nome pode ter até 120 caracteres.";
export const FRASE_HORARIO_VAZIO = "Diga a hora de começo e de fim.";
export const FRASE_FIM_ANTES_DO_COMECO = "O fim precisa ser depois do começo.";
export const FRASE_PRECO_POR_PESSOA = "Diga o preço por pessoa — por exemplo, 120 ou 37,50.";
export const FRASE_VAGAS = "Vagas: um número inteiro de 1 a 999.";
export const FRASE_ESCOLHA_A_DATA = "Escolha a data.";
export const FRASE_MOTIVO_VAZIO = "Diga o motivo do fechamento.";
export const FRASE_MOTIVO_LONGO = "O motivo pode ter até 120 caracteres.";
export const FRASE_FALHA_AO_LANCAR =
  "Não deu para lançar. Nada foi gravado — verifique a internet e tente de novo.";

// D-13: dia fechado avisa e NÃO bloqueia — o botão de gravar não muda, o servidor não recusa.
export function avisoDiaFechado(motivo: string): string {
  return `Este dia está fechado: ${motivo}. Dá para lançar mesmo assim.`;
}

export function avisoDiaComLancamentos(lancamentos: number): string {
  if (lancamentos === 1) {
    return "Este dia já tem 1 lançamento. Ele não é cancelado sozinho — as datas de turma aparecem com “dia fechado” para você cancelar com um toque.";
  }
  return `Este dia já tem ${lancamentos} lançamentos. Eles não são cancelados sozinhos — as datas de turma aparecem com “dia fechado” para você cancelar com um toque.`;
}

// Toasts do lançamento.
export const TOAST_LANCADO = "Lançado na agenda.";

export function toastDiaFechado(diaMes: string): string {
  return `Dia ${diaMes} fechado.`;
}

// Cancelar esta data / desfazer (05-UI-SPEC.md §Confirmações, §Toasts; decisão E29 do plano 03).
export const FRASE_FALHA_AO_CANCELAR =
  "Não deu para cancelar a data. Verifique a internet e tente de novo.";
export const ROTULO_CANCELAR_DATA = "Cancelar esta data";
export const ROTULO_DESFAZER_CANCELAMENTO = "Desfazer cancelamento";
export const ROTULO_CANCELANDO = "Cancelando…";
export const ROTULO_DESFAZENDO = "Desfazendo…";
export const ROTULO_MANTER_A_DATA = "Manter a data";
export const ROTULO_DESFAZER = "Desfazer";

export function tituloConfirmarCancelarData(diaDaSemana: string, diaMes: string): string {
  return `Cancelar a aula de ${diaDaSemana}, ${diaMes}?`;
}

function frasePresencasPerdidas(presencas: number): string {
  return presencas === 1
    ? "1 presença já marcada nesta data se perde."
    : `As ${presencas} presenças já marcadas nesta data se perdem.`;
}

export function corpoConfirmarCancelarTurma(presencas: number): string {
  return `Cancelada pelo ateliê não conta falta para ninguém. ${frasePresencasPerdidas(presencas)} A data fica riscada e dá para desfazer o cancelamento — mas as presenças não voltam.`;
}

// A oficina: as inscrições ainda não lançadas saem de "A receber"; e, se já havia presença
// marcada, ela também se perde (diz o que será perdido — CLAUDE.md §Exclusão).
export function corpoConfirmarCancelarOficina(inscricoesAReceber: number, presencas: number): string {
  const partes = ["A data fica riscada e sai do site."];
  if (inscricoesAReceber === 1) {
    partes.push("1 inscrição ainda não lançada sai de “A receber”.");
  } else if (inscricoesAReceber > 1) {
    partes.push(`${inscricoesAReceber} inscrições ainda não lançadas saem de “A receber”.`);
  }
  if (presencas > 0) {
    partes.push(`${frasePresencasPerdidas(presencas)} Desfazer o cancelamento não as devolve.`);
  }
  partes.push("Quem já pagou continua no Financeiro — devolução se resolve lá.");
  return partes.join(" ");
}

export const TOAST_CANCELADA_TURMA =
  "Data cancelada pelo ateliê: não conta falta para ninguém. Combine a reposição marcando uma data extra.";
export const TOAST_CANCELADA_OFICINA =
  "Data cancelada. Quem já pagou continua no Financeiro — devolução se resolve lá.";
export const TOAST_DATA_VOLTOU = "A data voltou para a agenda.";
// Decisão E29 (a UI-SPEC não fixa): o "Desfazer" do toast falhou.
export const FRASE_FALHA_AO_DESFAZER =
  "Não deu para desfazer. A data continua cancelada — use “Desfazer cancelamento” na folha.";
export const FRASE_FALHA_AO_DESFAZER_CANCELAMENTO =
  "Não deu para desfazer o cancelamento. Verifique a internet e tente de novo.";
export const FRASE_FECHADO_NAO_SE_CANCELA = "O dia fechado não se cancela — use “Tirar o bloqueio”.";

// Folha do fechado e "Tirar o bloqueio" (05-UI-SPEC.md §"Folha do fechado", §Confirmações).
export function subTituloDoFechado(diaDaSemana: string, diaMes: string): string {
  return `Fechado · ${diaDaSemana}, ${diaMes} · o dia todo`;
}

export const DICA_FOLHA_FECHADO =
  "Dia fechado: aparece como “fechado” no site, sem o motivo. Quem lançar algo neste dia vê um aviso.";
export const ROTULO_TIRAR_BLOQUEIO = "Tirar o bloqueio";
export const ROTULO_TIRANDO_BLOQUEIO = "Tirando…";
export const ROTULO_VOLTAR_A_AGENDA = "Voltar à agenda";
export const ROTULO_MANTER_FECHADO = "Manter fechado";

export function tituloConfirmarTirarBloqueio(diaMes: string): string {
  return `Tirar o bloqueio de ${diaMes}?`;
}

export const CORPO_CONFIRMAR_TIRAR_BLOQUEIO =
  "O dia volta a aparecer aberto no site. O que está marcado nele não muda.";
export const FRASE_JA_REMOVIDO = "Isso já tinha sido removido.";
export const FRASE_FALHA_AO_TIRAR_BLOQUEIO =
  "Não deu para tirar o bloqueio. Verifique a internet e tente de novo.";

export function toastBloqueioTirado(diaMes: string): string {
  return `Bloqueio de ${diaMes} tirado.`;
}

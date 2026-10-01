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

// A barra e a vista do mês (05-UI-SPEC.md §"Aba Agenda — Mês", §Copywriting → Ações, UI-D2).
export const ROTULO_MES_ANTERIOR = "Mês anterior";
export const ROTULO_PROXIMO_MES = "Próximo mês";
export const ARIA_VER_AGENDA_POR = "Ver a agenda por";
export const ROTULO_VISTA_SEMANA = "Semana";
export const ROTULO_VISTA_MES = "Mês";
export const CABECALHO_DOS_DIAS_DO_MES = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"] as const;
export const LEGENDA_TURMA_FIXA = "Turma fixa";
export const LEGENDA_USO_LIVRE = "Uso livre";
export const DICA_DO_MES = "Toque num dia para abrir a semana dele.";
export const FRASE_MES_VAZIO = "Nada marcado neste mês.";

// As abas da Agenda (05-UI-SPEC.md §Ações; UI-D1) — "A receber", "No site" e "Números" entram nos
// planos 11, 15 e 14.
export const ARIA_PARTES_DA_AGENDA = "Partes da Agenda";
export const ROTULO_ABA_AGENDA = "Agenda";
export const ROTULO_ABA_PESSOAS = "Pessoas";

// A aba Pessoas (05-UI-SPEC.md §"Aba Pessoas", §Estados vazios; D-01). As frases do formulário, da
// busca e do homônimo moram em `lib/clientes/textos.ts` — o cadastro é transversal.
export const TITULO_PESSOAS = "Pessoas";
export const ROTULO_MAIS_PESSOA = "+ Pessoa";
export const ROTULO_ABRIR = "Abrir";

export function ariaAbrirFicha(nome: string): string {
  return `Abrir a ficha de ${nome}`;
}

export const FRASE_VAZIO_PESSOAS_TITULO = "Ninguém cadastrado ainda.";
export const FRASE_VAZIO_PESSOAS_CORPO =
  "Cadastre a primeira pessoa — ela aparece também em Cadastros → Clientes.";
export const DICA_PESSOAS =
  "É o cadastro de clientes da AMASSA — o mesmo de Cadastros → Clientes. As vendas que a Agenda cria ficam ligadas à pessoa.";

// A ficha da pessoa (05-UI-SPEC.md §"Ficha da pessoa", §"Ficha da pessoa — linhas de leitura"). Os
// quadros "A REPOR"/"A RECEBER" entram nos planos 08 e 11; as "Turmas fixas", no fim deste arquivo (07).
export const ROTULO_SEM_TELEFONE = "sem telefone";
export const ROTULO_EDITAR = "Editar";
export const TITULO_ULTIMAS_VINDAS = "Últimas vindas";
export const FRASE_AINDA_NAO_VEIO = "Ainda não veio.";
export const TAG_VEIO = "veio";
export const TAG_FALTOU = "faltou";
export const FRASE_ERRO_CARREGAR_FICHA =
  "Não deu para carregar esta ficha. Verifique a internet e tente de novo.";

export function linhaDeVinda(diaMes: string, titulo: string): string {
  return `${diaMes} · ${titulo}`;
}
// O título da ficha quando a leitura falhou sem que a tela soubesse quem é (link direto).
export const TITULO_FICHA = "Ficha da pessoa";

// Vagas (AGE-11): os quatro rótulos do protótipo (linha 277), usados pelo calendário do site (plano
// 15). Zero ou negativo é "esgotado" — e mesmo assim dá para colocar alguém (lista cheia só avisa).
export const ROTULO_ESGOTADO = "esgotado";
export const ROTULO_ULTIMA_VAGA = "última vaga";

export function rotuloUltimasVagas(restantes: number): string {
  return `últimas ${restantes} vagas`;
}

export function rotuloNVagas(restantes: number): string {
  return `${restantes} vagas`;
}

// O seletor de pessoa (05-UI-SPEC.md §"Seletor de pessoa" — UI-D5, confirmada pelo dono). O mesmo
// seletor serve ao "Colocar alguém" da folha do evento e ao "Quem" do uso livre (plano 09).
export const ROTULO_COLOCAR_ALGUEM = "Colocar alguém";
export const PLACEHOLDER_BUSCAR_PELO_NOME = "Buscar pelo nome";
export const ROTULO_GRUPO_A_REPOR = "Tem aula a repor";
export const ROTULO_GRUPO_INSCREVER = "Inscrever";
export const ROTULO_GRUPO_EXPERIMENTAL = "Aula experimental / avulsa";
export const ROTULO_GRUPO_PESSOAS = "Pessoas";

// O grupo do contexto: na oficina, "Inscrever"; em data de turma, "Aula experimental / avulsa"; sem
// data (o "Quem" do uso livre), "Pessoas".
export function rotuloDoGrupoDoSeletor(tipoDoEvento: "turma" | "avulsa" | "fechado" | null): string {
  if (tipoDoEvento === "avulsa") {
    return ROTULO_GRUPO_INSCREVER;
  }
  if (tipoDoEvento === "turma") {
    return ROTULO_GRUPO_EXPERIMENTAL;
  }
  return ROTULO_GRUPO_PESSOAS;
}

export const FRASE_DIGITE_PARA_BUSCAR = "Digite para buscar.";
export const FRASE_NINGUEM_CADASTRADO_NO_SELETOR = "Ninguém cadastrado ainda. Digite o nome para cadastrar.";
export const FRASE_NINGUEM_COM_ESSE_NOME = "Ninguém com esse nome.";
// Backstop E8·overflow (decisão do plano 05): a última linha de um grupo que passou do teto.
export const FRASE_HA_MAIS_PESSOAS = "Há mais pessoas com esse nome — continue digitando.";
export const FRASE_ERRO_CARREGAR_PESSOAS =
  "Não deu para carregar a lista de pessoas. Verifique a internet e tente de novo.";

export function rotuloCadastrarTexto(texto: string): string {
  return `Cadastrar “${texto}”`;
}

// Colocar alguém numa oficina (AGE-10, AGE-12): a faixa de confirmação, o botão e o aviso de lista
// cheia (UI-D16 — âmbar, nunca vermelho: avisa e não bloqueia).
export function faixaInscricaoNaOficina(nome: string, valor: string): string {
  return `${nome} entra como inscrição de ${valor} — vai para “A receber”.`;
}

export const ROTULO_COLOCAR_NA_LISTA = "Colocar na lista";
export const ROTULO_COLOCANDO = "Colocando…";
export const AVISO_LISTA_CHEIA = "A lista já está cheia — dá para colocar mesmo assim, é só um aviso.";
export const TOAST_INSCRITO_NA_OFICINA = "Inscrito. A inscrição foi para “A receber”.";
export const FRASE_FALHA_AO_COLOCAR = "Não deu para colocar na lista. Verifique a internet e tente de novo.";

export function fraseJaEstaNaLista(nome: string): string {
  return `${nome} já está nesta lista — a tela foi atualizada.`;
}

// Tirar da lista (05-UI-SPEC.md §Confirmações "Tirar da lista", §Toasts; D-08, UI-D14).
export const ROTULO_TIRAR_DA_LISTA_LINK = "tirar da lista";
export const ROTULO_TIRAR_DA_LISTA = "Tirar da lista";
export const ROTULO_TIRANDO_DA_LISTA = "Tirando…";
export const ROTULO_MANTER_NA_LISTA = "Manter na lista";
export const CORPO_TIRAR_INSCRICAO_DA_LISTA = "A inscrição sai desta data e de “A receber”.";
export const FRASE_FALHA_AO_TIRAR_DA_LISTA =
  "Não deu para tirar da lista. Verifique a internet e tente de novo.";

export function ariaTirarDaLista(nome: string): string {
  return `Tirar ${nome} da lista`;
}

export function tituloConfirmarTirarDaLista(nome: string): string {
  return `Tirar ${nome} da lista?`;
}

export function toastSaiuDaLista(nome: string): string {
  return `${nome} saiu da lista.`;
}

// D-08 verbatim: a Agenda nunca devolve dinheiro — a venda ativa só se desfaz no Caixa.
export function fraseInscricaoJaVirouVenda(numero: number): string {
  return `Esta inscrição já virou a venda nº ${numero}. Para devolver, cancele a venda no Caixa.`;
}

// UI-D14: no lugar do "tirar da lista", quando a inscrição já é uma venda não cancelada.
export function fraseJaVirouVenda(numero: number): string {
  return `Já virou a venda nº ${numero} — para devolver, cancele a venda no Caixa.`;
}

export const ROTULO_VER_NO_CAIXA = "ver no Caixa";

// Turma fixa — lançar (05-UI-SPEC.md §"Folha "Lançar na agenda"", §"Rótulos e dicas de campo",
// §Toasts; AGE-03, D-13, UI-D10). O número de semanas e o vencimento têm padrão; o preço, nunca
// (AGE-17: nenhum preço no código).
export const ROTULO_LANCAR_TURMA = "Lançar turma";
export const PLACEHOLDER_NOME_TURMA = "ex.: Torno à noite";
export const ROTULO_DIA_DA_SEMANA = "Dia da semana";
export const ROTULO_PRIMEIRA_AULA = "Primeira aula a partir de";
export const ROTULO_MENSALIDADE = "Mensalidade (R$)";
export const ROTULO_SEMANAS = "Marcar quantas semanas";
export const SEMANAS_PADRAO = "8";
export const ROTULO_VENCIMENTO = "Mensalidade vence dia";
export const VENCIMENTO_PADRAO = "10";
export const DICA_VENCIMENTO = "de 1 a 28 — todo mês tem esses dias";
export const DICA_TIPO_TURMA =
  "Cria a turma e já marca as próximas semanas (você escolhe quantas; dá para estender depois, na folha da turma). Os alunos entram depois, pela ficha de cada um, em Pessoas.";

export const FRASE_NOME_DA_TURMA = "Dê um nome à turma.";
export const FRASE_MENSALIDADE = "Diga a mensalidade — por exemplo, 320 ou 320,50.";
export const FRASE_SEMANAS = "Semanas: um número de 1 a 52.";
export const FRASE_VENCIMENTO = "O vencimento precisa ser um dia de 1 a 28.";
// Decidido sem o dono (a UI-SPEC não fixa): o `Select` sempre tem um dia, então só chamada forjada vê.
export const FRASE_DIA_DA_SEMANA = "Escolha o dia da semana.";

// O aviso D-13 da folha, ANTES de gravar: gerar não pula nem cancela dia fechado. Concordância de
// verdade (a UI-SPEC escreve "{k} das datas cai … Elas são marcadas" para qualquer k).
export function avisoTurmaEmDiaFechado(diasMes: readonly string[]): string {
  if (diasMes.length === 1) {
    return `1 das datas cai em dia fechado (${diasMes[0]}). Ela é marcada mesmo assim, com a etiqueta “dia fechado”.`;
  }
  return `${diasMes.length} das datas caem em dias fechados (${diasMes.join(", ")}). Elas são marcadas mesmo assim, com a etiqueta “dia fechado”.`;
}

// Decisão do backstop E29 long-text (plano 06): o toast de lançar turma, com a concordância certa.
export function toastTurmaLancada(aulas: number, diasMesFechados: readonly string[]): string {
  const base = aulas === 1 ? "Turma lançada, com a próxima aula." : `Turma lançada, com as próximas ${aulas} aulas.`;
  if (diasMesFechados.length === 0) {
    return base;
  }
  if (aulas === 1) {
    return `${base} Ela cai num dia fechado (${diasMesFechados[0]}) e está marcada com “dia fechado”.`;
  }
  if (diasMesFechados.length === 1) {
    return `${base} Uma delas cai num dia fechado (${diasMesFechados[0]}) e está marcada com “dia fechado”.`;
  }
  return `${base} ${diasMesFechados.length} delas caem em dias fechados (${diasMesFechados.join(", ")}) e estão marcadas com “dia fechado”.`;
}

// A data de turma num dia fechado (D-13): a tag do cartão e a caixa do topo da folha da data, com o
// "Cancelar esta data" DENTRO dela. Cancelar continua sendo um toque do gestor.
export const TAG_DIA_FECHADO = "dia fechado";

export function caixaDataDeTurmaEmDiaFechado(motivo: string): string {
  return `Este dia está fechado: ${motivo}. Se a aula não vai acontecer, cancele esta data.`;
}

// A folha da turma (05-UI-SPEC.md §"Folha da turma (D-03 — o protótipo não tem)", §Confirmações
// "Desativar turma", §Toasts; UI-D25). Decisões dos backstops E11 e E28 (plano 06): o plural do
// sub-título ("1 aluno"), o título "Alunos ({n})" e o erro de uma confirmação DENTRO do diálogo.
export const ROTULO_ABRIR_A_TURMA = "Abrir a turma";
export const ROTULO_VOLTAR_A_DATA = "Voltar à data";
export const ROTULO_SALVAR_TURMA = "Salvar turma";
export const ROTULO_SALVANDO = "Salvando…";

export function subTituloDaTurma({
  quando,
  alunos,
  vagas,
  publica,
  desativadaEm,
}: {
  // "toda terça, 19:00 às 21:00" (`rotuloDaTurmaNaGestao`).
  quando: string;
  alunos: number;
  vagas: number;
  publica: boolean;
  // "dd/mm" da desativação, ou `null` com a turma ativa.
  desativadaEm: string | null;
}): string {
  const partes = [`Turma fixa · ${quando}`, alunos === 1 ? `1 aluno de ${vagas} vagas` : `${alunos} alunos de ${vagas} vagas`];
  if (publica && desativadaEm === null) {
    partes.push("no site");
  }
  if (desativadaEm !== null) {
    partes.push(`desativada em ${desativadaEm}`);
  }
  return partes.join(" · ");
}

export function linhaDiaDaSemanaDaTurma(dia: string): string {
  return `Dia da semana: ${dia}`;
}

export const DICA_DIA_DA_SEMANA_FIXO = "Para mudar o dia, desative esta turma e lance outra.";

export function dicaAoEditarTurma(proximoMes: string, mesAtual: string): string {
  return `Horário, vagas e público valem para as datas a partir de amanhã. A mensalidade nova vale a partir de ${proximoMes} — a de ${mesAtual} já nasceu e não muda.`;
}

export const TITULO_DATAS_DA_TURMA = "Datas";

export function linhaDatasMarcadas(diaDaSemana: string, diaMes: string, futuras: number): string {
  const contagem = futuras === 1 ? "1 data daqui para frente" : `${futuras} datas daqui para frente`;
  return `Marcada até ${diaDaSemana}, ${diaMes} · ${contagem}`;
}

export const FRASE_NENHUMA_DATA_FUTURA = "Nenhuma data marcada daqui para frente.";
export const ROTULO_MARCAR_MAIS = "Marcar mais";
export const ROTULO_SEMANAS_DO_MARCAR_MAIS = "semanas";
export const ROTULO_MARCAR_MAIS_SEMANAS = "Marcar mais semanas";
export const ROTULO_MARCANDO = "Marcando…";
export const DICA_MARCAR_MAIS = "Os alunos da turma entram nas datas novas.";

export function tituloAlunos(alunos: number): string {
  return `Alunos (${alunos})`;
}

export const FRASE_NENHUM_ALUNO = "Nenhum aluno ainda. Os alunos entram pela ficha de cada pessoa, em Pessoas.";

export const ROTULO_DESATIVAR_TURMA = "Desativar turma";
export const ROTULO_DESATIVANDO = "Desativando…";
export const ROTULO_MANTER_TURMA = "Manter turma";

export function tituloConfirmarDesativarTurma(nome: string): string {
  return `Desativar ${nome}?`;
}

// "As {n} datas daqui para frente saem da agenda e do site, junto com as inscrições delas ({r}
// reposições marcadas voltam a ser crédito). …" — sem reposição, sem o parêntese; plural de verdade.
export function corpoConfirmarDesativarTurma(datas: number, reposicoes: number): string {
  const parentese =
    reposicoes === 0
      ? ""
      : reposicoes === 1
        ? " (1 reposição marcada volta a ser crédito)"
        : ` (${reposicoes} reposições marcadas voltam a ser crédito)`;
  const datasQueSaem =
    datas === 0
      ? "Nenhuma data daqui para frente está marcada."
      : datas === 1
        ? `A data daqui para frente sai da agenda e do site, junto com as inscrições dela${parentese}.`
        : `As ${datas} datas daqui para frente saem da agenda e do site, junto com as inscrições delas${parentese}.`;
  return `${datasQueSaem} O que já aconteceu fica, e as mensalidades já nascidas continuam em “A receber”. Não dá para reativar.`;
}

export const TOAST_TURMA_SALVA = "Turma salva.";

export function toastDatasNovas(datas: number, ateDiaMes: string): string {
  return datas === 1
    ? `1 data nova marcada, até ${ateDiaMes}.`
    : `${datas} datas novas marcadas, até ${ateDiaMes}.`;
}

export const TOAST_TURMA_DESATIVADA = "Turma desativada. As datas que já aconteceram continuam na agenda.";

export const FRASE_ERRO_CARREGAR_TURMA =
  "Não deu para carregar esta turma. Verifique a internet e tente de novo.";
export const FRASE_FALHA_AO_SALVAR_TURMA = "Não deu para salvar a turma. Verifique a internet e tente de novo.";
export const FRASE_FALHA_AO_MARCAR_SEMANAS =
  "Não deu para marcar mais semanas. Verifique a internet e tente de novo.";
export const FRASE_FALHA_AO_DESATIVAR_TURMA =
  "Não deu para desativar a turma. Verifique a internet e tente de novo.";
export const FRASE_TURMA_JA_DESATIVADA = "Esta turma já foi desativada — a tela foi atualizada.";

export function fraseDesativarComVendaAtiva(diaMes: string, numero: number): string {
  return `A data de ${diaMes} tem uma inscrição que já virou a venda nº ${numero}. Cancele a venda no Caixa antes de desativar a turma.`;
}

// Turmas fixas na ficha da pessoa — entrar e sair da turma (AGE-07; 05-UI-SPEC.md §"Ficha da pessoa —
// linhas de leitura", §Confirmações "Sair da turma", §Toasts). As frases que a UI-SPEC não fixa são
// decisões do plano 07 (o terceiro toast de entrada, o de "a mensalidade já existia", o corpo de sair
// com 0 ou 1 aula e sem mensalidade do mês em "A receber").
export const TITULO_TURMAS_FIXAS = "Turmas fixas";
export const FRASE_NENHUMA_TURMA_FIXA = "Nenhuma turma fixa lançada ainda.";
export const ROTULO_VER_TURMA = "ver turma";
export const ROTULO_ENTRANDO_NA_TURMA = "Entrando…";

// "{nome} · {dia da semana} {hh:mm} · {R$}/mês, vence dia {d}".
export function rotuloDaTurmaNaFicha({
  nome,
  dia,
  inicio,
  mensalidade,
  diaVencimento,
}: {
  nome: string;
  dia: string;
  inicio: string;
  mensalidade: string;
  diaVencimento: number;
}): string {
  return `${nome} · ${dia} ${inicio} · ${mensalidade}/mês, vence dia ${diaVencimento}`;
}

export function ariaVerTurma(nome: string): string {
  return `Ver a turma ${nome}`;
}

export function toastEntrouProporcional(mes: string, restantes: number, noMes: number, valor: string): string {
  return `Entrou na turma. Mensalidade de ${mes} proporcional: ${restantes} de ${noMes} aulas = ${valor}.`;
}

export const TOAST_ENTROU_MENSALIDADE_CHEIA =
  "Entrou na turma: já está nas próximas aulas e a mensalidade do mês foi criada.";

export function toastEntrouSemAulaNoMes(mes: string, proximoMes: string): string {
  return `Entrou na turma: já está nas próximas aulas. Não sobra aula da turma em ${mes} — a mensalidade começa em ${proximoMes}.`;
}

// Voltou à turma no mesmo mês em que saiu: a mensalidade do mês já nasceu (a chave única não deixa
// nascer a segunda) e continua como estava.
export function toastEntrouMensalidadeJaExistia(mes: string): string {
  return `Entrou na turma: já está nas próximas aulas. A mensalidade de ${mes} já existia e continua como estava.`;
}

export const TOAST_SAIU_DA_TURMA = "Saiu da turma: sai das aulas futuras. O que já aconteceu fica.";

export function tituloConfirmarSairDaTurma(nome: string, turma: string): string {
  return `Tirar ${nome} de ${turma}?`;
}

// "Sai das {n} aulas daqui para frente. O que já aconteceu fica, e a mensalidade de {mês} continua em
// “A receber” — dispense lá se não for cobrar." — plural de verdade, e a parte da mensalidade só
// quando ela existe e ainda está em "A receber".
export function corpoConfirmarSairDaTurma(aulas: number, mes: string, mensalidadeAReceber: boolean): string {
  const aulasQueSaem =
    aulas === 0
      ? "Não está em nenhuma aula daqui para frente."
      : aulas === 1
        ? "Sai da aula daqui para frente."
        : `Sai das ${aulas} aulas daqui para frente.`;
  const resto = mensalidadeAReceber
    ? ` O que já aconteceu fica, e a mensalidade de ${mes} continua em “A receber” — dispense lá se não for cobrar.`
    : " O que já aconteceu fica.";
  return `${aulasQueSaem}${resto}`;
}

export const ROTULO_MANTER_NA_TURMA = "Manter na turma";
export const ROTULO_TIRAR_DA_TURMA = "Tirar da turma";
export const ROTULO_TIRANDO_DA_TURMA = "Tirando…";

export function fraseJaEstaNaTurma(nome: string): string {
  return `${nome} já está nesta turma — a tela foi atualizada.`;
}

export function fraseJaNaoEstaNaTurma(nome: string): string {
  return `${nome} já não está nesta turma — a tela foi atualizada.`;
}

export const FRASE_FALHA_AO_ENTRAR_NA_TURMA =
  "Não deu para colocar na turma. Verifique a internet e tente de novo.";
export const FRASE_FALHA_AO_SAIR_DA_TURMA = "Não deu para tirar da turma. Verifique a internet e tente de novo.";

// As frases dos Lembretes (Fase 06.3). Módulo sem import: não lê React nem o banco. Os textos vêm
// verbatim da 06.3-UI-SPEC.md (§Copywriting Contract: "Ações", "Rótulos e dicas de campo",
// "Toasts" e "Erros"). O plano 06.3-01 escreve as do Zod e as do traçador (criar no Início); os
// planos seguintes acrescentam as suas.

// Erros do Zod (06.3-UI-SPEC.md §Erros) — os tetos espelham os checks `lembretes_*` da 0029.
export const FRASE_ESCREVA_O_LEMBRETE = "Escreva o lembrete.";
export const FRASE_LEMBRETE_LONGO = "O lembrete pode ter até 200 caracteres.";
export const FRASE_DATA_INVALIDA = "Essa data não existe. Escolha outra no calendário.";
export const FRASE_PESSOA_INVALIDA =
  "Essa pessoa não está mais na lista. Escolha outra ou deixe “geral”.";

// Erros do traçador (06.3-UI-SPEC.md §Erros).
export const FRASE_FALHA_AO_GUARDAR =
  "Não deu para guardar o lembrete. Verifique a internet e tente de novo.";
export const FRASE_ERRO_DA_COLUNA =
  "Não deu para carregar os lembretes. Verifique a internet e tente de novo.";

// O bloco do Início (06.3-UI-SPEC.md §"Início — o bloco duplo" e §Rótulos). Os títulos de coluna
// ficam em caixa normal no DOM; a caixa alta é do CSS.
export const TITULO_DO_BLOCO = "Anotações e lembretes";
export const TITULO_DA_FOLHA = "Folha da casa";
export const TITULO_PARA_FAZER = "Para fazer";

// A linha de criar (06.3-UI-SPEC.md §Ações e §Rótulos). O placeholder é a única cópia do
// protótipo que entra no código — copy aprovada (UI-D14).
export const PLACEHOLDER_NOVO_LEMBRETE = "+ lembrete · ex.: pedir argila na Cerâmica Técnica";
export const ROTULO_NOVO_LEMBRETE = "Novo lembrete";
export const ROTULO_GUARDAR = "Guardar";
export const ROTULO_GUARDANDO = "Guardando…";

// Toasts (06.3-UI-SPEC.md §Toasts).
export const TOAST_LEMBRETE_GUARDADO = "Lembrete guardado.";

// Linhas de leitura (06.3-UI-SPEC.md §Copywriting → "Linhas de leitura" e "Contagem ao lado de
// Para fazer"). Plural de verdade, nunca "(s)". Usadas por `lib/lembretes/lista.ts` (plano 06.3-02).
export const ROTULO_HOJE = "hoje";
export const ROTULO_AMANHA = "amanhã";
export const FRASE_NADA_PENDENTE = "nada pendente";

// "venceu {dd/mm} · ontem" para 1 dia; "venceu {dd/mm} · {N} dias" para N ≥ 2.
export function textoVenceu(diaMes: string, dias: number): string {
  return dias === 1 ? `venceu ${diaMes} · ontem` : `venceu ${diaMes} · ${dias} dias`;
}

export function textoAbertos(n: number): string {
  return n === 1 ? "1 aberto" : `${n} abertos`;
}

export function textoVencidos(m: number): string {
  return m === 1 ? "1 vencido" : `${m} vencidos`;
}

// Os caminhos do Início para "ver todos" (06.3-UI-SPEC.md §Ações; D-01: "ver todos" é a rota
// `/gestao/lembretes`, não uma folha sobre o Início).
export const ROTULO_VER_TODOS_OS_LEMBRETES = "ver todos os lembretes";

// "e mais {N} — ver todos" — abaixo da lista, só com mais de 6 abertos.
export function textoEMaisN(n: number): string {
  return `e mais ${n} — ver todos`;
}

// Nenhum aberto, no Início (06.3-UI-SPEC.md §Estados vazios). O lembrete não notifica ninguém
// (BRIEFING §5, fora): vencer é ficar vermelho, e a frase diz isso. Troca do dono no chat,
// 03/10/2026, na Parte 0 da verificação humana — a copy aprovada do protótipo dizia "com data ele
// avisa quando vencer".
export const FRASE_NADA_PARA_FAZER =
  "Nada para fazer. Escreva um lembrete na linha acima — com data ele fica vermelho quando vencer.";

// A linha de criar completa (06.3-UI-SPEC.md §Rótulos e §Erros; plano 06.3-03).
// Guardar com o campo vazio ou só com espaços — a frase do cliente (UI-D9: nada em silêncio). O
// "Escreva o lembrete." de cima é o do Zod, para o envio que contornou a tela.
export const FRASE_ESCREVA_ANTES_DE_GUARDAR = "Escreva o lembrete antes de guardar.";
// A pílula de data: o texto visível e o nome acessível do `<input type="date">`.
export const ROTULO_PARA = "para";
export const ROTULO_PARA_QUANDO = "Para quando (opcional)";
// O grupo das pílulas de pessoa e a pílula "sem dono" (nunca "ninguém" nem "todos").
export const ROTULO_DE_QUEM = "De quem é o lembrete";
export const ROTULO_GERAL = "geral";

// As ações da linha (06.3-UI-SPEC.md §Ações, §Toasts e §Erros; plano 06.3-04). Toda frase aqui é
// texto puro: o `toast` nunca recebe HTML nem JSX (T-06.3-19).

// A caixa de feito: sem texto visível, o nome acessível diz o que o toque faz (verbatim do protótipo).
export function rotuloMarcarFeito(texto: string): string {
  return `Marcar feito: ${texto}`;
}

export function rotuloDesfazerFeito(texto: string): string {
  return `Desfazer: ${texto}`;
}

// "editar"/"excluir" (verbatim, minúsculos) e os nomes acessíveis — várias linhas teriam o mesmo
// nome sem o texto.
export const ROTULO_EDITAR = "editar";
export const ROTULO_EXCLUIR = "excluir";

export function rotuloEditar(texto: string): string {
  return `Editar: ${texto}`;
}

export function rotuloExcluir(texto: string): string {
  return `Excluir: ${texto}`;
}

// A edição na linha.
export const ROTULO_SALVAR = "Salvar";
export const ROTULO_SALVANDO = "Salvando…";
export const ROTULO_CANCELAR = "cancelar";
export const ROTULO_TEXTO_DO_LEMBRETE = "Texto do lembrete";

// Toasts.
export const ROTULO_DESFAZER = "Desfazer";
export const TOAST_REABERTO = "Lembrete reaberto.";
export const TOAST_ATUALIZADO = "Lembrete atualizado.";

// "Feito: {trecho}" — o trecho vem de `trecho()` (`lib/lembretes/lista.ts`).
export function textoFeito(trechoDoTexto: string): string {
  return `Feito: ${trechoDoTexto}`;
}

// "Lembrete excluído: {trecho}" — o trecho diz o que se perde (UI-D10).
export function textoExcluido(trechoDoTexto: string): string {
  return `Lembrete excluído: ${trechoDoTexto}`;
}

// Quick 261005-2yu (05/10/2026), 06.3-WR-01: várias exclusões seguidas viram UM aviso, cujo "Desfazer"
// devolve todas. Só é usado com N ≥ 2 (com 1, o `textoExcluido` com o trecho).
export function textoExcluidos(n: number): string {
  return `${n} lembretes excluídos.`;
}

// 06.3-WR-03: outra pessoa marcou antes — o aviso diz quem, e não oferece "Desfazer" (desfazer seria
// apagar o feito DELA).
export function textoJaEstavaFeito(trechoDoTexto: string, nome: string | null): string {
  return nome ? `Já estava feito por ${nome}: ${trechoDoTexto}` : `Já estava feito: ${trechoDoTexto}`;
}

// 06.3-WR-03: a linha voltou aberta (outra pessoa reabriu entre o toque e a resposta) — o aviso não diz
// "Feito".
export const FRASE_REABERTO_POR_OUTRA_PESSOA =
  "Outra pessoa reabriu este lembrete agora há pouco — ele continua em “Para fazer”.";

// Erros das ações (06.3-UI-SPEC.md §Erros).
export const FRASE_LEMBRETE_NAO_EXISTE =
  "Esse lembrete não existe mais — alguém excluiu. A lista foi atualizada.";
export const FRASE_FALHA_AO_MARCAR =
  "Não deu para marcar como feito. Verifique a internet e tente de novo.";
export const FRASE_FALHA_AO_REABRIR =
  "Não deu para reabrir o lembrete. Verifique a internet e tente de novo.";
export const FRASE_FALHA_AO_DESFAZER =
  "Não deu para desfazer. O lembrete está em “Feitos” — desmarque lá.";
export const FRASE_FALHA_AO_SALVAR_EDICAO =
  "Não deu para salvar a mudança. Verifique a internet e tente de novo.";
export const FRASE_EDICAO_VAZIA =
  "O lembrete não pode ficar vazio. Escreva o texto — ou use “excluir”.";
// A frase da ação no servidor; a tela mostra a de `textoFalhaAoExcluir`, com o trecho.
export const FRASE_FALHA_AO_EXCLUIR =
  "Não deu para excluir o lembrete. Verifique a internet e tente de novo.";

export function textoFalhaAoExcluir(trechoDoTexto: string): string {
  return `Não deu para excluir “${trechoDoTexto}”. Ele voltou para a lista — tente de novo.`;
}

// A sanfona "Feitos" do Início (D-02) e as linhas de autoria (UI-D11: "dd/mm hh:mm").
export function textoFeitos(n: number): string {
  return `Feitos (${n})`;
}

export function textoEMaisNosFeitos(n: number): string {
  return `e mais ${n} em “ver todos”`;
}

export function textoFeitoPor(nome: string, instante: string): string {
  return `feito por ${nome} · ${instante}`;
}

export function textoPor(nome: string, instante: string): string {
  return `por ${nome} · ${instante}`;
}

// "Ver todos" — a rota `/gestao/lembretes` (06.3-UI-SPEC.md §"`/gestao/lembretes` — ver todos",
// §Rótulos, §Estados vazios, §Erros; plano 06.3-05, LMB-09). O "Todos" do filtro é "sem filtro" —
// outra coisa que o "geral" (sem dono) das pílulas de criar.
export const TITULO_DA_PAGINA = "Lembretes";
export const ROTULO_SITUACAO = "Situação";
export const ROTULO_ABERTOS = "Abertos";
export const ROTULO_FEITOS = "Feitos";
export const ROTULO_DE_QUEM_FILTRO = "De quem";
export const ROTULO_TODOS = "Todos";
export const ROTULO_GERAL_FILTRO = "Geral";
export const FRASE_NENHUM_LEMBRETE_AQUI = "Nenhum lembrete aqui.";
// A MESMA frase do `ROTULO_MOSTRAR_MAIS` de Clientes (`lib/clientes/textos.ts`) — repetida aqui,
// não importada: este módulo não tem import (e a frase de Clientes pode mudar sozinha).
export const ROTULO_MOSTRAR_MAIS = "Mostrar mais 50";
export const DICA_DE_VER_TODOS =
  "Lembrete feito fica guardado com quem marcou e quando. “Excluir” apaga de vez (com alguns segundos para desfazer) — é o único lugar da plataforma onde apagar é normal, porque lembrete não é registro.";
export const ROTULO_TENTAR_DE_NOVO = "Tentar de novo";

// 06.3-WR-02 (quick 261005-2yu; decisão do dono de 05/10/2026: só o aviso, sem paginação nova): no teto
// de "Mostrar mais", a lista diz que não está mostrando tudo.
export function fraseNoTetoDaLista(teto: number): string {
  return `Mostrando os ${teto} primeiros — há mais lembretes que esta lista não mostra. Use o filtro “${ROTULO_DE_QUEM_FILTRO}” para ver menos de cada vez.`;
}
// O nome do esqueleto para o leitor de tela (`loading.tsx`).
export const ROTULO_CARREGANDO_A_PAGINA = "Carregando: Lembretes";

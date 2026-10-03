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

// Nenhum aberto, no Início (06.3-UI-SPEC.md §Estados vazios — copy aprovada, verbatim). Nota para
// a Parte 0 da verificação humana: o lembrete não notifica ninguém (BRIEFING §5, fora); "avisa" é
// ficar vermelho. Trocar por "fica vermelho quando vencer" é esta linha.
export const FRASE_NADA_PARA_FAZER =
  "Nada para fazer. Escreva um lembrete na linha acima — com data ele avisa quando vencer.";

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

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

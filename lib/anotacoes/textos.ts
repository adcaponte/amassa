// As cópias das Anotações da casa — módulo puro, sem nenhum import (mesma disciplina de
// `lib/inicio/textos.ts`): nenhuma regra de negócio mora aqui, só as frases que a tela mostra.

// Verbatim do protótipo aprovado (`prototipo-gestao.html`, `telaInicio()`, placeholder de `#nota`).
export const CONVITE_DA_CAIXA_VAZIA =
  "Qualquer coisa: recado para a Andressa, lembrete de compra, ideia de peça…";

// Verbatim do protótipo aprovado (mesma seção, `<p class="dica">` abaixo da caixa).
export const FRASE_DE_APOIO = "Uma folha só, da casa: o que um escreve, o outro vê. Salva sozinha.";

// O indicador ao lado do título (D-08/GES-10) — nunca um botão "Salvar" como única porta.
export const ROTULO_INDICADOR_SALVANDO = "salvando…";
export const ROTULO_INDICADOR_SALVO = "salvo";

// O aviso de conflito (D-08): na MESMA linha do cabeçalho, nunca um diálogo no meio do caminho.
export const FRASE_AVISO_DE_CONFLITO =
  "Alguém salvou um texto diferente enquanto você escrevia.";
export const ROTULO_MANTER_O_MEU = "manter o meu";
export const ROTULO_VER_O_DELA = "ver o dela";
// "Ver o dela" troca o texto da caixa pelo do servidor — a regra da casa é que toda remoção diz o
// que será perdido ANTES de trocar (CLAUDE.md §Exclusão), nunca uma troca silenciosa.
export const FRASE_VER_O_DELA_VAI_TROCAR =
  "Isso vai substituir o que você escreveu por aqui pelo texto salvo por outra pessoa.";

// A frase de erro PRÓPRIA deste bloco (D-09) — nunca "Algo não funcionou" genérico repetido.
export const FRASE_ERRO_DO_BLOCO = "Não deu para carregar as anotações.";

// Erro de banco ao SALVAR (T-04.6-39): a tela nunca mostra detalhe de exceção do Postgres, só
// esta frase — o `console.error` do servidor guarda o resto.
export const FRASE_ERRO_AO_SALVAR = "Não deu para salvar agora. Tente de novo em instantes.";

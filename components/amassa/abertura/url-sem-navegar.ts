"use client";

// Atualiza a URL sem disparar navegacao.
//
// POR QUE. Todo dialogo desta tela e enderecavel (`?item=<id>`, `?removerItem=<id>`) e isso
// continua valendo: a URL e compartilhavel e o historico funciona. O que mudou e COMO ela e
// escrita. `router.push` despacha uma transicao do React, e e justamente a confirmacao dessa
// transicao que falha em silencio numa fracao dos toques (.planning/debug/
// abertura-navegacao-trava.md) -- resultado: a pessoa tocava e nada acontecia.
//
// `window.history.pushState` escreve a URL direto, sem transicao e sem ida ao servidor. O Next
// sincroniza `useSearchParams()` com ela (suportado desde o App Router 14.1), entao os
// componentes que leem a query reagem normalmente. Como abrir um dialogo NAO precisa de dado
// novo do servidor -- o formulario de criacao nasce vazio, e o de edicao/remocao recebe a linha
// da propria lista --, nao ha nada a esperar do servidor aqui.
//
// GRAVAR e outra historia: ai a lista precisa do que so o servidor sabe, e por isso os
// formularios usam navegacao COMPLETA depois de salvar (ver formulario-item.tsx).
export function irParaSemNavegar(url: string): void {
  window.history.pushState(null, "", url);
}

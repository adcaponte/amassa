// Módulo puro, sem nenhum import: a voz única das fronteiras de erro do App Router
// (`app/(app)/error.tsx`, `app/error.tsx`, `app/global-error.tsx`), seguindo a mesma disciplina
// de `lib/encomendas/textos.ts` e `lib/acessibilidade/rotulos.ts`.
//
// `FRASE_ERRO_TITULO` colide de propósito com o `FRASE_ERRO_TITULO` de
// `lib/encomendas/textos.ts` — as duas cadeias precisam continuar idênticas. Aquele módulo tem
// regra própria e documentada de só aceitar `import type`, nunca import de valor, então ele NÃO
// pode importar daqui e mantém o literal dele. Quem impede as duas cópias de divergirem é o
// teste unitário `tests/unit/textos-erro.test.ts` (comparação estrita entre os dois módulos),
// não o compilador.
export const FRASE_ERRO_TITULO = "Algo não funcionou.";

// Corpo GENÉRICO — fala em "esta página", não em "as encomendas" (esse é
// `FRASE_ERRO_CORPO` de `lib/encomendas/textos.ts`, um caso mais específico). Usado pelas três
// fronteiras de erro que não sabem qual página estava carregando.
export const FRASE_ERRO_CORPO_GENERICO =
  "Não deu para carregar esta página. Verifique a internet e tente de novo.";

export const ROTULO_TENTAR_DE_NOVO = "Tentar de novo";

import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// `tailwind-merge` não conhece a escala tipográfica própria do design system (04-DESIGN-SYSTEM.md
// §4 / app/globals.css, namespace `--text-*`): `display`, `titulo`, `corpo`, `apoio`, `micro`,
// `mono`, `nav`. Sem esta extensão, `twMerge("text-titulo text-foreground")` devolve só
// `"text-foreground"` — `text-titulo` não bate com nenhum tamanho conhecido do Tailwind, então
// `tailwind-merge` classifica o sufixo "titulo" como COR de texto, "conflita" com
// `text-foreground` e perde por ordem (o último da lista, no caso `text-foreground`, sobrevive).
// Foi assim que `components/amassa/cartao-painel.tsx` renderizou em Inter, no tamanho e peso
// errados, desde a 02b-03: `CardTitle` (shadcn) mescla seu próprio `text-base` com o `className`
// do chamador via `cn()`, e o papel nunca sobrevivia à mesclagem — um defeito de camada mais
// baixa que nenhuma correção em `app/globals.css` sozinha alcança. Registrar os sete papéis
// aqui, uma vez, protege qualquer combinação futura de papel + cor em QUALQUER primitivo shadcn
// que use `cn()` — não seria resolvido corrigindo só o cartão. Ver tests/unit/cn.test.ts.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["display", "titulo", "corpo", "apoio", "micro", "mono", "nav"] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

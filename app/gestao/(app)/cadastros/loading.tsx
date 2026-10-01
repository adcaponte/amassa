import { Skeleton } from "@/components/ui/skeleton";

// Esqueleto no formato do conteúdo — a segunda fileira de pílulas (6 sub-abas desde a Fase 5, D-01:
// Catálogo · Categorias · Clientes | Contas fixas · Taxas · Parâmetros, 3 + 3 abaixo de 768px, uma
// fileira acima, o mesmo desenho de `sub-abas-cadastros.tsx`) e uma lista, nunca "carregando..."
// solto (04.4-UI-SPEC.md §UI Considerations, "loading"). A barra de pílulas do Financeiro vive em
// `layout.tsx`, fora do limite de Suspense que este arquivo cobre — `loading.tsx` só envolve
// `{children}` do layout, nunca o próprio conteúdo dele (mesmo achado de
// `app/(app)/abertura/loading.tsx`).
//
// Este esqueleto é COMPARTILHADO por todas as sub-abas (`loading.tsx` não recebe `searchParams` —
// só a página em si sabe qual sub-aba está carregando): a forma genérica de lista serve a todas;
// não há uma versão "5 blocos de grupo" específica de Parâmetros aqui (04.5-02-PLAN.md, "Decidido
// sem o dono" — mesmo precedente de `app/(app)/financeiro/error.tsx`, que também ficou genérico
// depois de a Fase 04.5-01 acrescentar Orçamentos/Peças). Clientes tem, além deste, o esqueleto
// PRÓPRIO dentro da página (`EsqueletoDosClientes`), num `Suspense` da sub-aba.
const PILULAS_DE_CIMA = [0, 1, 2] as const;
const PILULAS_DE_BAIXO = [0, 1, 2] as const;

export default function CarregandoCadastros() {
  return (
    <div className="flex flex-col">
      <div className="mx-6 mt-6 flex flex-wrap gap-1 rounded-md bg-muted p-1 md:mx-8 md:max-w-xl">
        {PILULAS_DE_CIMA.map((pilula) => (
          <Skeleton key={`cima-${pilula}`} className="h-11 flex-1 rounded-sm" />
        ))}
        <span aria-hidden="true" className="basis-full md:hidden" />
        {PILULAS_DE_BAIXO.map((pilula) => (
          <Skeleton key={`baixo-${pilula}`} className="h-11 flex-1 rounded-sm" />
        ))}
      </div>

      <div className="flex flex-col gap-3 px-6 py-6 md:px-8">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}

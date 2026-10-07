import { Skeleton } from "@/components/ui/skeleton";

// Esqueleto no formato do conteúdo — a fileira de pílulas (desde a Fase 06.5, D-09: UMA fileira com
// rolagem lateral, o mesmo desenho de `sub-abas-cadastros.tsx` — três pílulas inteiras e uma quarta
// cortada na borda, o sinal de que a fileira continua) e uma lista, nunca "carregando..."
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
const PILULAS_INTEIRAS = [0, 1, 2] as const;

export default function CarregandoCadastros() {
  return (
    <div className="flex flex-col">
      <div className="mx-6 mt-6 flex gap-1 overflow-hidden rounded-md bg-muted p-1 md:mx-8">
        {PILULAS_INTEIRAS.map((pilula) => (
          <Skeleton key={pilula} className="h-11 w-24 shrink-0 rounded-sm" />
        ))}
        <Skeleton className="h-11 w-12 shrink-0 rounded-sm" />
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

import { Skeleton } from "@/components/ui/skeleton";

// Esqueleto no formato do conteúdo — a segunda fileira de pílulas (4 sub-abas) e uma lista,
// nunca "carregando..." solto (04.4-UI-SPEC.md §UI Considerations, "loading"). A barra de 5
// pílulas do Financeiro (Venda·Despesa·Caixa·Mês·Cadastros) vive em `layout.tsx`, fora do limite
// de Suspense que este arquivo cobre — `loading.tsx` só envolve `{children}` do layout, nunca o
// próprio conteúdo dele (mesmo achado de `app/(app)/abertura/loading.tsx`).
export default function CarregandoCadastros() {
  return (
    <div className="flex flex-col">
      <div className="mx-6 mt-6 flex gap-1 rounded-md bg-muted p-1 md:mx-8 md:max-w-md">
        <Skeleton className="h-11 flex-1 rounded-sm" />
        <Skeleton className="h-11 flex-1 rounded-sm" />
        <Skeleton className="h-11 flex-1 rounded-sm" />
        <Skeleton className="h-11 flex-1 rounded-sm" />
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

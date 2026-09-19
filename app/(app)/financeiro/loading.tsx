import { Skeleton } from "@/components/ui/skeleton";

// Esqueleto no formato do conteúdo — barra de pílulas e dois blocos, nunca "carregando..." solto
// (04.4-UI-SPEC.md §UI Considerations, "loading").
export default function CarregandoFinanceiro() {
  return (
    <div className="flex flex-col">
      <div className="mx-6 mt-6 flex gap-1 rounded-md bg-muted p-1 md:mx-8 md:max-w-md">
        <Skeleton className="h-11 flex-1 rounded-sm" />
        <Skeleton className="h-11 flex-1 rounded-sm" />
      </div>

      <div className="grid grid-cols-1 gap-6 px-6 py-6 md:grid-cols-2 md:px-8">
        <div className="border-border flex flex-col gap-3 rounded-lg border p-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-32 w-full" />
        </div>
        <div className="border-border flex flex-col gap-3 rounded-lg border p-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    </div>
  );
}

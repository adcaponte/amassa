import { Skeleton } from "@/components/ui/skeleton";

// Esqueleto da aba Saldos no formato do conteúdo (UI-SPEC §UI Considerations, loading E1): a barra
// de ferramentas, 4 cartões abaixo de 980px e 6 linhas de tabela a partir de 980px — nunca
// "carregando..." solto, nunca tela em branco. O banner NÃO tem esqueleto: ele é derivado da mesma
// lista e simplesmente não existe enquanto ela carrega (loading E2 — nada pisca).
export function EsqueletoSaldos() {
  return (
    <div
      className="flex flex-col gap-4 px-6 py-8 md:px-8"
      aria-busy="true"
      data-testid="estoque-saldos-carregando"
    >
      <span className="sr-only">Carregando os saldos…</span>
      <div className="flex flex-col gap-3 min-[980px]:flex-row min-[980px]:items-center">
        <Skeleton className="h-11 w-full min-[980px]:max-w-sm" />
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3].map((indice) => (
            <Skeleton key={indice} className="h-11 w-20 rounded-full" />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 min-[980px]:hidden">
        {[0, 1, 2, 3].map((indice) => (
          <div
            key={indice}
            className="bg-superficie border-borda grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 rounded-lg border border-l-4 p-4"
          >
            <Skeleton className="h-5 w-40" />
            <Skeleton className="row-span-2 h-10 w-12" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="col-span-2 mt-2 h-11 w-28" />
          </div>
        ))}
      </div>

      <div className="bg-superficie border-borda hidden flex-col rounded-lg border min-[980px]:flex">
        <div className="border-borda border-b px-4 py-3">
          <Skeleton className="h-5 w-full" />
        </div>
        {[0, 1, 2, 3, 4, 5].map((indice) => (
          <div
            key={indice}
            className="border-borda flex items-center gap-4 border-b px-4 py-3 last:border-b-0"
          >
            <Skeleton className="h-5 flex-[2]" />
            <Skeleton className="h-5 flex-1" />
            <Skeleton className="h-5 flex-1" />
            <Skeleton className="h-5 flex-1" />
            <Skeleton className="h-11 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

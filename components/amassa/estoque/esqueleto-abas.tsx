import { Skeleton } from "@/components/ui/skeleton";

// Os esqueletos das abas Histórico e Para onde foi, no formato do conteúdo de cada uma (UI-SPEC §UI
// Considerations, loading E3/E4) — nunca "carregando..." solto, nunca tela em branco. O da aba
// Saldos é `EsqueletoSaldos` (plano 06-04).

// Histórico: as quatro pílulas, o contador e 6 linhas com a coluna de 76px à esquerda.
export function EsqueletoHistorico() {
  return (
    <div
      className="flex flex-col gap-4 px-6 py-8 md:px-8"
      aria-busy="true"
      data-testid="historico-carregando"
    >
      <span className="sr-only">Carregando o histórico…</span>
      <div className="flex flex-wrap gap-2">
        {[0, 1, 2, 3].map((indice) => (
          <Skeleton key={indice} className="h-11 w-24 rounded-full" />
        ))}
      </div>
      <div className="bg-superficie border-borda divide-borda flex flex-col divide-y rounded-lg border min-[980px]:max-w-3xl">
        {[0, 1, 2, 3, 4, 5].map((indice) => (
          <div key={indice} className="flex items-start gap-3 p-4">
            <div className="flex w-[76px] shrink-0 flex-col items-end gap-1">
              <Skeleton className="h-6 w-14" />
              <Skeleton className="h-4 w-6" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-full max-w-sm" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Para onde foi: as três pílulas do período, o resumo com o total e as seis barras.
export function EsqueletoParaOndeFoi() {
  return (
    <div
      className="flex flex-col gap-4 px-6 py-8 md:px-8"
      aria-busy="true"
      data-testid="destino-carregando"
    >
      <span className="sr-only">Carregando para onde foi o material…</span>
      <div className="flex flex-wrap gap-2">
        {[0, 1, 2].map((indice) => (
          <Skeleton key={indice} className="h-11 w-28 rounded-full" />
        ))}
      </div>
      <div className="bg-superficie border-borda flex flex-col gap-2 rounded-lg border p-4 min-[980px]:max-w-3xl">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-12 w-full" />
      </div>
      <div className="bg-superficie border-borda flex flex-col gap-4 rounded-lg border p-4 min-[980px]:max-w-3xl">
        {[0, 1, 2, 3, 4, 5].map((indice) => (
          <div key={indice} className="flex flex-col gap-2">
            <div className="flex justify-between gap-4">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-4 w-44" />
          </div>
        ))}
      </div>
    </div>
  );
}

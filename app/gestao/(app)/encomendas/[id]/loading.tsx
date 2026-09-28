import { Skeleton } from "@/components/ui/skeleton";

// Esqueleto no FORMATO da trilha que substitui (docs/convencoes-de-interface.md §2): barra de
// título + seis linhas com marcador circular cinza e duas barras de texto — nenhuma palavra
// solta descrevendo o estado, só `Skeleton` e leiaute.
const LINHAS = [0, 1, 2, 3, 4, 5] as const;

export default function CarregandoDetalheDaEncomenda() {
  return (
    <div className="flex flex-col">
      <div className="border-border flex flex-wrap items-center justify-between gap-4 border-b px-6 py-6 md:px-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-11 w-64" />
      </div>

      <div className="flex flex-col gap-4 px-6 py-6 md:px-8">
        {LINHAS.map((linha) => (
          <div key={linha} className="flex items-center gap-4">
            <Skeleton className="size-4 flex-shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

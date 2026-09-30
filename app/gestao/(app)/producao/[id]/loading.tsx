import { Skeleton } from "@/components/ui/skeleton";

// Esqueleto da página da ordem no FORMATO do conteúdo (UI-SPEC §"Estados → Carregando"): o
// cabeçalho, o bloco "Etapas" com seis linhas de trilha (ponto + duas linhas de texto), o bloco
// "Peças" com duas linhas e o bloco "Material" com duas — uma coluna no celular, duas a partir de
// 1024px, como a página. Nenhuma palavra solta descrevendo o estado.
const LINHAS_DA_TRILHA = [0, 1, 2, 3, 4, 5] as const;
const DUAS_LINHAS = [0, 1] as const;

function BlocoEsqueleto({ linhas }: { linhas: readonly number[] }) {
  return (
    <div className="bg-superficie border-borda flex flex-col gap-4 rounded-lg border p-4">
      <Skeleton className="h-6 w-28" />
      {linhas.map((linha) => (
        <div key={linha} className="flex items-center justify-between gap-4">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-12" />
        </div>
      ))}
    </div>
  );
}

export default function CarregandoOrdem() {
  return (
    <div className="flex flex-col">
      <div className="border-border flex flex-wrap items-center justify-between gap-4 border-b px-6 py-6 md:px-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>
      <div className="grid grid-cols-1 items-start gap-6 px-6 py-6 md:px-8 lg:grid-cols-[1.15fr_1fr]">
        <div className="bg-superficie border-borda flex flex-col gap-4 rounded-lg border p-4">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-3/4" />
          {LINHAS_DA_TRILHA.map((linha) => (
            <div key={linha} className="flex items-center gap-4">
              <Skeleton className="size-4 shrink-0 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
          <Skeleton className="ml-auto h-[52px] w-48" />
        </div>
        <div className="flex flex-col gap-6">
          <BlocoEsqueleto linhas={DUAS_LINHAS} />
          <BlocoEsqueleto linhas={DUAS_LINHAS} />
        </div>
      </div>
    </div>
  );
}

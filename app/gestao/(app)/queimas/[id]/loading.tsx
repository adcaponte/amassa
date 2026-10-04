import { Skeleton } from "@/components/ui/skeleton";

// Esqueleto na FORMA do conteúdo que substitui (E6/loading, 04-UI-SPEC.md): bloco de cabeçalho +
// bloco alto do medidor + linhas das duas listas de histórico, na mesma altura que elas terão —
// nenhum "carregando…" solto (CLAUDE.md §Estados).
const LINHAS = [0, 1, 2] as const;
const QUADROS = [0, 1, 2, 3] as const;

export default function CarregandoDetalheDoForno() {
  return (
    <div className="flex flex-col">
      <div className="border-border flex flex-wrap items-center justify-between gap-4 border-b px-6 py-6 md:px-8">
        <Skeleton className="h-8 w-56" />
      </div>

      <div className="flex flex-col gap-8 px-6 py-6 md:px-8">
        {/* bloco do medidor: contador + trilho + as duas fileiras de rótulos (D-04) + a linha
            "Contagem: …" (Fase 06.4) + rodapé */}
        <div className="flex flex-col gap-3">
          <Skeleton className="ml-auto h-4 w-16" />
          <Skeleton className="h-3 w-full rounded-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-2/3" />
        </div>

        {/* bloco da lista de manutenções */}
        <div className="flex flex-col gap-3">
          <Skeleton className="h-6 w-40" />
          {LINHAS.map((linha) => (
            <Skeleton key={`manutencao-${linha}`} className="h-12 w-full" />
          ))}
        </div>

        {/* bloco da lista de queimas */}
        <div className="flex flex-col gap-3">
          <Skeleton className="h-6 w-32" />
          {LINHAS.map((linha) => (
            <Skeleton key={`queima-${linha}`} className="h-12 w-full" />
          ))}
        </div>

        {/* bloco "Números" (Fase 06.4, plano 06): título, quatro quadros na grade 2 × 2 / 4 e os dois
            blocos — a mesma forma de `EsqueletoDosNumerosDoForno` (o fallback do `Suspense`). */}
        <div className="flex flex-col gap-4">
          <Skeleton className="h-6 w-32" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-4">
            {QUADROS.map((quadro) => (
              <Skeleton key={`quadro-${quadro}`} className="h-28 rounded-lg" />
            ))}
          </div>
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.15fr_1fr]">
            <Skeleton className="h-40 rounded-lg" />
            <Skeleton className="h-40 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

// Esqueleto na FORMA do conteúdo que substitui (E9/loading, `04-UI-SPEC.md`): 4 blocos de
// estatística + retângulos na altura dos gráficos — nunca um "carregando…" solto
// (CLAUDE.md §Estados). O seletor de topo em si não pisca: ele é montado só depois que os dados
// chegam (junto com o cabeçalho), mesma disciplina de `app/(app)/queimas/loading.tsx`.
const ESTATISTICAS = [0, 1, 2, 3] as const;

export default function CarregandoRelatoriosDeQueimas() {
  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-6 md:px-8">
        <Skeleton className="h-8 w-40" />
      </div>

      <div className="flex flex-col gap-8 px-6 py-6 md:px-8">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {ESTATISTICAS.map((estatistica) => (
            <div
              key={estatistica}
              className="flex flex-col gap-2 rounded-xl border border-border p-4"
            >
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-10" />
            </div>
          ))}
        </div>

        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    </div>
  );
}

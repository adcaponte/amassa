import { Skeleton } from "@/components/ui/skeleton";

// Esqueleto na FORMA do índice que ele substitui (mesmo princípio de
// `app/(app)/encomendas/loading.tsx`) — cabeçalho + grade de cartões-esqueleto na MESMA altura
// do cartão real (cabeçalho com selo, medidor, duas linhas de rodapé, botão), para o layout não
// pular quando os dados chegam (E1/E2 loading, CLAUDE.md §Estados). Nunca um "carregando…" solto
// entre as tags.
const CARTOES = [0, 1, 2, 3] as const;

export default function CarregandoQueimas() {
  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-6 md:px-8">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-11 w-36" />
      </div>

      <div className="grid grid-cols-1 gap-4 px-6 py-6 md:grid-cols-2 md:px-8">
        {CARTOES.map((cartao) => (
          <div key={cartao} className="flex flex-col gap-4 rounded-xl border border-border p-4">
            {/* bloco do cabeçalho: nome + selo */}
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-5 w-20" />
            </div>

            {/* bloco do medidor: contador + trilho + rótulos */}
            <div className="flex flex-col gap-1">
              <Skeleton className="ml-auto h-4 w-16" />
              <Skeleton className="h-3 w-full rounded-full" />
              <Skeleton className="h-3 w-full" />
            </div>

            {/* bloco do rodapé: duas linhas */}
            <div className="flex flex-col gap-1">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>

            {/* bloco do botão */}
            <Skeleton className="h-11 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

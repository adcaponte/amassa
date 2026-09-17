import { Skeleton } from "@/components/ui/skeleton";

// Esqueleto na FORMA do conteúdo da aba Cotações (UI-SPEC §"Estados e Comportamento" ▸
// "Carregamento"): três retângulos arredondados na altura de pílula (as sub-abas de categoria) +
// o cabeçalho da tabela + quatro linhas na altura final da linha real (56px) — nunca
// "carregando..." solto entre as tags, nunca tela em branco. Sem margem/padding próprios: o
// chamador decide o espaçamento externo, mesma disciplina do conteúdo real (`page.tsx` envolve
// `SubAbasCategorias`/`PainelCotacoes` num único `<div className="px-6 py-6 md:px-8">`).
//
// Usado por `app/(app)/abertura/loading.tsx` (a MESMA forma para qualquer `?aba=`, backstop —
// `loading.tsx` não recebe `searchParams` e não sabe qual aba vai aparecer) e por qualquer
// limite de Suspense que a aba Cotações precise no futuro.
const LINHAS = [0, 1, 2, 3] as const;

export function EsqueletoCotacoes() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-11 w-24 rounded-full" />
        <Skeleton className="h-11 w-28 rounded-full" />
        <Skeleton className="h-11 w-20 rounded-full" />
      </div>

      <div className="border-border overflow-hidden rounded-xl border">
        <div className="border-border flex items-center gap-4 border-b p-3">
          <Skeleton className="size-4 rounded-sm" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-16" />
        </div>
        {LINHAS.map((linha) => (
          <div
            key={linha}
            className="border-border flex h-14 items-center gap-4 border-b p-3 last:border-0"
          >
            <Skeleton className="size-4 rounded-sm" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

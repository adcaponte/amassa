import { Skeleton } from "@/components/ui/skeleton";

// Esqueleto na FORMA de `DataInauguracao` — mesmo molde do resto do módulo (UI-SPEC §"Estados de
// carregamento"). Cobre a busca de `obterConfiguracaoDaAbertura()` em layout.tsx, que fica FORA
// do `<Suspense>` automático de `loading.tsx` (achado de
// .planning/debug/abertura-navegacao-trava.md: mover a busca para o layout tira este trecho do
// patch de toda navegação `?item=`/`?tarefa=`, mas também tira do Suspense de `loading.tsx` —
// por isso o próprio `layout.tsx` embrulha a busca no seu PRÓPRIO `<Suspense>`, com este esqueleto).
export function EsqueletoDataInauguracao() {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 px-6 pt-4 md:px-8">
      <Skeleton className="h-4 w-56" />
      <div className="flex flex-none flex-col items-end gap-1">
        <Skeleton className="h-7 w-10" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  );
}

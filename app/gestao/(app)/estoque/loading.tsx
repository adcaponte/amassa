import { Skeleton } from "@/components/ui/skeleton";

// Esqueleto no formato do conteúdo — o cabeçalho e quatro cartões de saldo (nome à esquerda, saldo
// grande à direita, "Dar baixa" embaixo), nunca "carregando..." solto nem tela em branco (CLAUDE.md
// §Estados; molde de `app/gestao/(app)/cadastros/loading.tsx`).
export default function CarregandoEstoque() {
  return (
    <div className="flex flex-col">
      <div className="border-border border-b px-6 py-6 md:px-8">
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="flex flex-col gap-2 px-6 py-8 md:px-8">
        {[0, 1, 2, 3].map((indice) => (
          <div
            key={indice}
            className="bg-superficie border-borda grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 rounded-lg border border-l-4 p-4"
          >
            <Skeleton className="h-5 w-40" />
            <Skeleton className="row-span-2 h-10 w-12" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="col-span-2 mt-2 h-11 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}

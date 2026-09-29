import { Skeleton } from "@/components/ui/skeleton";

// Esqueleto da contagem (UI · loading · E9): o cabeçalho, o progresso, a busca e 6 linhas no
// formato da linha de contagem — nunca "carregando..." solto nem tela em branco.
export default function CarregandoContagem() {
  return (
    <div className="flex flex-col" aria-busy="true" data-testid="contagem-carregando">
      <span className="sr-only">Carregando a contagem…</span>
      <div className="border-border border-b px-6 py-6 md:px-8">
        <Skeleton className="h-8 w-56" />
      </div>
      <div className="flex flex-col gap-4 px-6 py-6 md:px-8">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-11 w-full min-[980px]:max-w-sm" />
        <div className="flex flex-col">
          {[0, 1, 2, 3, 4, 5].map((indice) => (
            <div
              key={indice}
              className="border-borda flex flex-col gap-3 border-b py-4 min-[980px]:flex-row min-[980px]:items-center"
            >
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-11 w-full min-[980px]:w-32" />
              <Skeleton className="h-11 w-full min-[980px]:ml-auto min-[980px]:w-44" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

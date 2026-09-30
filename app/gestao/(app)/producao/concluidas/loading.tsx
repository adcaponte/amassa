import { TITULO_CONCLUIDAS } from "@/lib/producao/textos";
import { CabecalhoPagina } from "@/components/amassa/cabecalho-pagina";
import { Skeleton } from "@/components/ui/skeleton";

// Esqueleto das Concluídas e canceladas (UI-SPEC §"Estados → Carregando"): o cabeçalho real e 6
// linhas no formato da lista — nome, sub-linha e o "Abrir". Nunca "carregando..." solto nem tela em
// branco (CLAUDE.md §Estados).
const LINHAS = [0, 1, 2, 3, 4, 5] as const;

export default function CarregandoConcluidas() {
  return (
    <div className="flex flex-col" aria-busy="true">
      <CabecalhoPagina titulo={TITULO_CONCLUIDAS} />
      <div className="px-6 py-6 md:px-8">
        <div className="bg-superficie border-borda flex flex-col rounded-lg border">
          {LINHAS.map((linha) => (
            <div
              key={linha}
              className="border-borda flex flex-col gap-3 border-b p-4 last:border-b-0 sm:flex-row sm:items-center"
            >
              <div className="flex flex-1 flex-col gap-2">
                <div className="flex justify-between gap-3">
                  <Skeleton className="h-5 w-1/2" />
                  <Skeleton className="h-5 w-16" />
                </div>
                <Skeleton className="h-4 w-3/4" />
              </div>
              <Skeleton className="h-11 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

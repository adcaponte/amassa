import { TITULO_PRODUCAO } from "@/lib/producao/textos";
import { CabecalhoPagina } from "@/components/amassa/cabecalho-pagina";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Esqueleto da Produção no FORMATO da página (UI-SPEC §"Estados → Carregando"): o cabeçalho real,
// as 3 pílulas, os 3 números (linhas abaixo de 640px, três colunas a partir dele — UI-D10), o
// alternador de vista e o quadro com 2 cartões por seção — 3 seções empilhadas no celular, grade
// 3 × 2 entre 768 e 1279px, seis colunas a partir de 1280px (a mesma grade de `QuadroProducao`).
// Nunca "carregando..." solto nem tela em branco (CLAUDE.md §Estados).
const PILULAS = ["w-16", "w-28", "w-24"] as const;
const NUMEROS = [0, 1, 2] as const;
const COLUNAS = [0, 1, 2, 3, 4, 5] as const;
const CARTOES = [0, 1] as const;

export default function CarregandoProducao() {
  return (
    <div className="flex flex-col" aria-busy="true">
      <CabecalhoPagina titulo={TITULO_PRODUCAO} />
      <div className="flex flex-col px-6 pt-4 pb-6 md:px-8">
        <div className="flex flex-wrap gap-2">
          {PILULAS.map((largura) => (
            <Skeleton key={largura} className={cn("h-11 rounded-full", largura)} />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-4">
          {NUMEROS.map((numero) => (
            <div
              key={numero}
              className="bg-superficie border-borda flex items-center justify-between gap-4 rounded-lg border p-4 sm:flex-col sm:items-start sm:gap-2"
            >
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-40 sm:hidden" />
              </div>
              <Skeleton className="h-8 w-10" />
              <Skeleton className="hidden h-4 w-40 sm:block" />
            </div>
          ))}
        </div>
        <Skeleton className="mt-8 h-11 w-full rounded-lg md:max-w-md" />
        <div className="mt-4 grid grid-cols-1 items-start gap-4 md:grid-cols-3 xl:grid-cols-6">
          {COLUNAS.map((coluna) => (
            <div
              key={coluna}
              className={cn(
                "bg-superficie-2 flex-col gap-2 rounded-lg p-4 xl:p-3",
                // No celular, 3 seções bastam para dizer "é aqui que o quadro aparece".
                coluna < 3 ? "flex" : "hidden md:flex",
              )}
            >
              <Skeleton className="h-4 w-2/3" />
              {CARTOES.map((cartao) => (
                <div
                  key={cartao}
                  className="bg-superficie border-borda flex flex-col gap-2 rounded-md border p-4 xl:p-3"
                >
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

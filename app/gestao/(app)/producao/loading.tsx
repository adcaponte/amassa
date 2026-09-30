import { Skeleton } from "@/components/ui/skeleton";

// Esqueleto da Produção no FORMATO do quadro (UI-SPEC §"Estados → Carregando"): o cabeçalho e as
// seis colunas com dois cartões cada — empilhadas no celular, 3 × 2 entre 768 e 1279px, seis
// colunas a partir de 1280px (a mesma grade de `QuadroProducao`). Nunca "carregando..." solto nem
// tela em branco (CLAUDE.md §Estados).
const COLUNAS = [0, 1, 2, 3, 4, 5] as const;
const CARTOES = [0, 1] as const;

export default function CarregandoProducao() {
  return (
    <div className="flex flex-col">
      <div className="border-border border-b px-6 py-6 md:px-8">
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="grid grid-cols-1 items-start gap-4 px-6 py-6 md:grid-cols-3 md:px-8 xl:grid-cols-6">
        {COLUNAS.map((coluna) => (
          <div key={coluna} className="bg-superficie-2 flex flex-col gap-2 rounded-lg p-4 xl:p-3">
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
  );
}

import { Skeleton } from "@/components/ui/skeleton";

// Esqueleto no FORMATO do índice que ele substitui (docs/convencoes-de-interface.md §2), não o
// genérico da casca (`app/(app)/loading.tsx`): uma faixa de cabeçalho e, abaixo, a estrutura de
// duas colunas do Gantt (desktop) ou de cartões empilhados (celular) — as duas alternando por
// CSS, mesmo princípio de D-02. Só componentes `Skeleton` e leiaute, nenhuma cadeia de texto
// solta entre as tags — nunca a palavra que descreve esse estado, escrita por extenso, solta na
// tela.
const LINHAS = [0, 1, 2, 3] as const;

export default function CarregandoEncomendas() {
  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-6 md:px-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-11 w-36" />
      </div>

      <div className="px-6 py-6 md:px-8">
        {/* Formato do Gantt: coluna fixa com 3-4 barras do tamanho de um nome, área de barras
            com retângulos em posições e larguras variadas. */}
        <div className="hidden overflow-hidden rounded-xl border border-border md:block">
          <div className="flex flex-col">
            {LINHAS.map((linha) => (
              <div
                key={linha}
                className="flex items-center gap-6 border-b border-border px-4 py-5 last:border-b-0"
              >
                <Skeleton className="h-4 w-40 flex-shrink-0" />
                <Skeleton
                  className={linha % 2 === 0 ? "h-7 w-72" : "h-7 w-44"}
                  style={{ marginLeft: `${linha * 24}px` }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Formato dos cartões: título + subtítulo + trilha de 6 segmentos. */}
        <div className="flex flex-col gap-3 md:hidden">
          {LINHAS.map((linha) => (
            <div key={linha} className="flex flex-col gap-2 rounded-xl border border-border p-4">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

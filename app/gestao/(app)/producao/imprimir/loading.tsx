import { Skeleton } from "@/components/ui/skeleton";

// Esqueleto da folha geral A4 (UI-SPEC §"Estados → Carregando"): a barra dos dois botões e um
// retângulo do tamanho da folha (proporção A4) com 8 linhas — nunca a tela em branco.
const OITO_LINHAS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

export default function CarregandoFolhaGeral() {
  return (
    <div className="bg-superficie-2 min-h-full p-4">
      <div className="mx-auto mb-4 flex max-w-[768px] flex-wrap justify-between gap-2">
        <Skeleton className="h-11 w-40" />
        <Skeleton className="h-11 w-40" />
      </div>
      <div className="bg-superficie border-t-acento mx-auto flex aspect-[210/297] max-w-[768px] flex-col gap-4 border-t-8 p-6 md:p-12">
        <Skeleton className="h-8 w-2/3" />
        {OITO_LINHAS.map((linha) => (
          <Skeleton key={linha} className="h-5 w-full" />
        ))}
      </div>
    </div>
  );
}

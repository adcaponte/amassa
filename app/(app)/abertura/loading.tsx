import { Skeleton } from "@/components/ui/skeleton";

// Esqueleto na FORMA do conteúdo que substitui — cabeçalho, o bloco "Comprometido" (na ALTURA
// final, para a página não pular quando o número chegar), a barra de abas (plano 04.2-02) e três
// a quatro linhas de item/tarefa, na mesma altura da linha real (UI-SPEC §"Estados de
// carregamento"). Nunca um "carregando..." solto entre as tags — só `Skeleton` e leiaute, no
// molde de `app/(app)/queimas/loading.tsx`.
//
// `loading.tsx` não recebe `searchParams` (é o mesmo esqueleto para qualquer `?aba=`) — por isso
// ele não pode saber qual das duas listas vai aparecer. A solução é desenhar as DUAS formas de
// linha (item e tarefa são visualmente parecidas: nome + etiquetas à esquerda, valor/urgência à
// direita), o que continua sem salto de layout perceptível quando o conteúdo real chega, seja
// qual for a aba.
const LINHAS = [0, 1, 2, 3] as const;

export default function CarregandoAbertura() {
  return (
    <div className="flex flex-col">
      {/* Cabeçalho: título + botão "+ Adicionar item". */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-6 md:px-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-11 w-40" />
      </div>

      {/* Os TRÊS blocos do painel (D-15/ABE-12: Comprometido, Sai neste mês, Precisa de
          atenção) — uma coluna no celular, três a partir de 660px, cada um na ALTURA FINAL do
          bloco real, para a página não pular quando os números chegarem (UI-SPEC §"Estados de
          carregamento", que pede isto explicitamente para este painel). */}
      <div className="grid grid-cols-1 gap-3 px-6 pt-6 sm:grid-cols-3 md:px-8">
        {[0, 1, 2].map((bloco) => (
          <div
            key={bloco}
            className="flex flex-col gap-2 rounded-lg border border-border p-4"
          >
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        ))}
      </div>

      {/* Barra de abas (Itens/Tarefas/Por mês, `AbasAbertura`) — três blocos do mesmo tamanho do
          botão real (min-h-11), lado a lado. */}
      <div className="mx-6 mt-6 flex gap-1 rounded-md bg-muted p-1 md:mx-8 md:max-w-md">
        <Skeleton className="h-11 flex-1 rounded-sm" />
        <Skeleton className="h-11 flex-1 rounded-sm" />
        <Skeleton className="h-11 flex-1 rounded-sm" />
      </div>

      {/* Três a quatro linhas de item/tarefa em esqueleto, na mesma altura da linha real (nome +
          duas etiquetas à esquerda, valor/urgência à direita). */}
      <div className="flex flex-col gap-2 px-6 py-6 md:px-8">
        {LINHAS.map((linha) => (
          <div
            key={linha}
            className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-24 rounded-full" />
            </div>
            <div className="flex flex-none flex-col items-end gap-1">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

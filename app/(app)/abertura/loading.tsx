import { EsqueletoCotacoes } from "@/components/amassa/cotacoes/esqueleto-cotacoes";
import { Skeleton } from "@/components/ui/skeleton";

// Esqueleto na FORMA do conteúdo que substitui — o bloco "Comprometido" (na ALTURA final, para a
// página não pular quando o número chegar), a barra de abas (plano 04.2-02) e o esqueleto
// compartilhado de `EsqueletoCotacoes` (sub-abas de categoria + cabeçalho de tabela + linhas na
// mesma altura da linha real, UI-SPEC §"Estados de carregamento"). Nunca um "carregando..."
// solto entre as tags — só `Skeleton` e leiaute, no molde de `app/(app)/queimas/loading.tsx`.
//
// Cabeçalho + data de inauguração NÃO aparecem aqui — vivem em
// `app/(app)/abertura/layout.tsx` (achado quantitativo de
// .planning/debug/abertura-navegacao-trava.md), fora do limite de Suspense que este arquivo
// cobre (`loading.tsx` só envolve `{children}` do layout, nunca o próprio conteúdo do layout).
// A busca de dados do layout tem seu PRÓPRIO `<Suspense>` interno (ver layout.tsx), então o
// estado de carregamento continua garantido — só num limite diferente.
//
// `loading.tsx` não recebe `searchParams` (é o mesmo esqueleto para qualquer `?aba=`) — por isso
// ele não pode saber qual das quatro listas vai aparecer. A solução (04.3-02, Tarefa 3) é
// reaproveitar `EsqueletoCotacoes` (sub-abas + cabeçalho + linhas) para a segunda fileira E as
// linhas de conteúdo das QUATRO abas — item, tarefa e mês são visualmente próximos o bastante de
// uma linha de tabela com cabeçalho (nome + valor/urgência à direita) para não produzir salto de
// leiaute perceptível quando o conteúdo real chega, seja qual for a aba.
export default function CarregandoAbertura() {
  return (
    <div className="flex flex-col">
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

      {/* Barra de abas (Itens/Tarefas/Por mês/Cotações, `AbasAbertura`) — QUATRO blocos do mesmo
          tamanho do botão real (min-h-11), lado a lado (plano 04.3-01: a quarta aba). */}
      <div className="mx-6 mt-6 flex gap-1 rounded-md bg-muted p-1 md:mx-8 md:max-w-md">
        <Skeleton className="h-11 flex-1 rounded-sm" />
        <Skeleton className="h-11 flex-1 rounded-sm" />
        <Skeleton className="h-11 flex-1 rounded-sm" />
        <Skeleton className="h-11 flex-1 rounded-sm" />
      </div>

      {/* Segunda fileira (sub-abas de categoria) + cabeçalho + linhas — `EsqueletoCotacoes`
          (04.3-02, Tarefa 3). Aparece sempre, mesmo fora da aba Cotações: o esqueleto de
          `loading.tsx` é o MESMO para qualquer `?aba=` (não recebe `searchParams`). */}
      <div className="mx-6 mt-2 pb-6 md:mx-8">
        <EsqueletoCotacoes />
      </div>
    </div>
  );
}

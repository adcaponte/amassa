import { Skeleton } from "@/components/ui/skeleton";

// Os esqueletos de Cadastros → Fornecedores (06.2-UI-SPEC.md §"Estados e Comportamento →
// Carregando"), no formato do conteúdo — nunca a tela em branco nem "carregando..." solto.
//
// `EsqueletoDosFornecedores`: a sub-aba inteira enquanto a lista chega (o `Suspense` da página) —
// bloco Lista (título + botão, campo de busca, 3 pílulas, 6 linhas de 64 px) e bloco Ficha.
// `EsqueletoDaFicha`: só o bloco Ficha, na troca de fornecedor (`Suspense` com `key` = id) — a lista
// fica na tela.

const PILULAS = [0, 1, 2] as const;
const LINHAS_DA_LISTA = [0, 1, 2, 3, 4, 5] as const;
const ETIQUETAS = [0, 1] as const;
const CARTOES = [0, 1, 2] as const;
const LINHAS_DE_ANEXO = [0, 1, 2] as const;

const CLASSE_DO_BLOCO = "bg-superficie border-borda flex flex-col gap-4 rounded-xl border p-4";

export function EsqueletoDosFornecedores() {
  return (
    <div
      className="mx-6 mt-6 grid items-start gap-4 pb-12 md:mx-8 lg:grid-cols-[minmax(300px,0.9fr)_1.4fr]"
      aria-busy="true"
      data-testid="fornecedores-carregando"
    >
      <div className={CLASSE_DO_BLOCO}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-11 w-44 rounded-md" />
        </div>
        <Skeleton className="h-11 w-full rounded-md" />
        <div className="flex flex-wrap gap-2">
          {PILULAS.map((pilula) => (
            <Skeleton key={pilula} className="h-11 w-20 rounded-full" />
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {LINHAS_DA_LISTA.map((linha) => (
            <Skeleton key={linha} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
      <EsqueletoDaFicha />
    </div>
  );
}

export function EsqueletoDaFicha() {
  return (
    <div className={CLASSE_DO_BLOCO} aria-busy="true" data-testid="fornecedor-ficha-carregando">
      <Skeleton className="h-7 w-2/3" />
      <div className="flex flex-wrap gap-2">
        {ETIQUETAS.map((etiqueta) => (
          <Skeleton key={etiqueta} className="h-7 w-24 rounded-full" />
        ))}
      </div>
      <Skeleton className="h-5 w-full" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(176px,1fr))] gap-2">
        {CARTOES.map((cartao) => (
          <Skeleton key={cartao} className="h-20 w-full rounded-lg" />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {LINHAS_DE_ANEXO.map((linha) => (
          <Skeleton key={linha} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

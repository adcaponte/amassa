import { listarSemContagem } from "@/lib/queimas/consultas";
import { FRASE_ERRO_DAS_LISTAS } from "@/lib/queimas/textos";
import { Skeleton } from "@/components/ui/skeleton";
import { TentarDeNovo } from "@/components/amassa/inicio/tentar-de-novo";

import { ListaSemContagem } from "./lista-sem-contagem";

// As listas do índice de Queimas (06.4-UI-SPEC.md §"Índice — …"): "Queimas externas a cobrar" (plano
// 04, na primeira coluna) e "Sem contagem" (este plano). As listas NUNCA derrubam nem atrasam os
// cartões e o "Queimar" — o registro em dois toques é o que importa (QMC-01): a página monta este
// componente dentro de um `Suspense` próprio (o esqueleto é `EsqueletoDasListas`, abaixo) e a leitura
// tem um `try` próprio, com UM bloco de erro para as duas listas (a frase já fala das duas). Molde de
// `try` por bloco com `console.error`: `components/amassa/inicio/bloco-anotacoes.tsx`.
export async function ListasDoIndice({ hoje }: { hoje: string }) {
  let semContagem;
  try {
    semContagem = await listarSemContagem(hoje);
  } catch (erro) {
    console.error("Falha ao carregar as listas do índice de Queimas:", erro);
    return (
      <div className="px-6 pb-6 md:px-8">
        <div
          role="alert"
          data-testid="queimas-listas-erro"
          className="bg-superficie border-border flex flex-col items-start gap-3 rounded-lg border p-4"
        >
          <p className="text-corpo text-tinta">{FRASE_ERRO_DAS_LISTAS}</p>
          <TentarDeNovo />
        </div>
      </div>
    );
  }

  // Nada a mostrar: a seção não aparece (verbatim do protótipo — nada a contar não é uma tarefa).
  if (semContagem.linhas.length === 0 && semContagem.maisAntigas === 0) {
    return null;
  }

  return (
    <div className="px-6 pb-6 md:px-8">
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 lg:gap-6">
        <ListaSemContagem
          linhas={semContagem.linhas}
          maisAntigas={semContagem.maisAntigas}
          maisDeUmForno={semContagem.maisDeUmForno}
        />
      </div>
    </div>
  );
}

// O esqueleto das listas, no formato do conteúdo (06.4-UI-SPEC.md §Carregando): o bloco "Sem
// contagem" com título `h-6 w-40` e duas linhas `h-16`. O bloco "a cobrar" entra no plano 04.
export function EsqueletoDasListas() {
  return (
    <div className="px-6 pb-6 md:px-8">
      <div
        aria-busy="true"
        data-testid="queimas-listas-carregando"
        className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 lg:gap-6"
      >
        <div className="bg-superficie border-border flex flex-col gap-4 rounded-lg border p-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    </div>
  );
}

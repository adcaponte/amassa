import { obterConfiguracaoFinanceira } from "@/lib/financeiro/consultas";
import {
  listarACobrar,
  listarSemContagem,
  obterItensDasQueimas,
  type DadosDaFolha,
} from "@/lib/queimas/consultas";
import type { ModoSemContagem } from "@/lib/queimas/contagem";
import { FRASE_ERRO_DAS_LISTAS } from "@/lib/queimas/textos";
import { Skeleton } from "@/components/ui/skeleton";
import { TentarDeNovo } from "@/components/amassa/inicio/tentar-de-novo";

import { ListaACobrar } from "./lista-a-cobrar";
import { ListaSemContagem } from "./lista-sem-contagem";

// As listas do índice de Queimas (06.4-UI-SPEC.md §"Índice — …"): "Queimas externas a cobrar" (plano
// 04, na primeira coluna) e "Sem contagem" (plano 02). As listas NUNCA derrubam nem atrasam os
// cartões e o "Queimar" — o registro em dois toques é o que importa (QMC-01): a página monta este
// componente dentro de um `Suspense` próprio (o esqueleto é `EsqueletoDasListas`, abaixo) e a leitura
// tem um `try` próprio, com UM bloco de erro para as duas listas (a frase já fala das duas). Molde de
// `try` por bloco com `console.error`: `components/amassa/inicio/bloco-anotacoes.tsx`.
//
// Plano 03: `semContagem` é a visão da lista "Sem contagem" (`recentes` | `todas`), lida da URL UMA
// vez pela página e passada adiante sem mudar; "a cobrar" não depende dela (plano 04).
//
// Plano 04 (QMC-07): no MESMO `try`, "a cobrar" (as contagens com falta em algum tamanho), os três
// itens com o preço ATUAL e a taxa do cartão (a linha sob "Cartão" do "Recebi agora"). Cada seção
// some quando vazia; uma sozinha fica na primeira coluna.
export async function ListasDoIndice({
  hoje,
  dadosDaFolha,
  semContagem: modo,
}: {
  hoje: string;
  dadosDaFolha: DadosDaFolha | null;
  semContagem: ModoSemContagem;
}) {
  let leitura;
  try {
    const [semContagem, aCobrar, itens, configuracao] = await Promise.all([
      listarSemContagem(hoje, modo),
      listarACobrar(),
      obterItensDasQueimas(),
      obterConfiguracaoFinanceira(),
    ]);
    leitura = { semContagem, aCobrar, itens, configuracao };
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
  const { semContagem, aCobrar, itens, configuracao } = leitura;

  // Nada a mostrar: a seção não aparece (verbatim do protótipo — nada a contar, nada a cobrar, não é
  // uma tarefa).
  const temSemContagem = semContagem.linhas.length > 0 || semContagem.maisAntigas > 0;
  const temACobrar = aCobrar.length > 0;
  if (!temSemContagem && !temACobrar) {
    return null;
  }

  return (
    <div className="px-6 pb-6 md:px-8">
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 lg:gap-6">
        {temACobrar ? (
          <ListaACobrar
            linhas={aCobrar}
            maisDeUmForno={semContagem.maisDeUmForno}
            itens={itens}
            taxaCartaoPontosBase={configuracao.taxaCartaoPontosBase}
          />
        ) : null}
        {temSemContagem ? (
          <ListaSemContagem
            linhas={semContagem.linhas}
            maisAntigas={semContagem.maisAntigas}
            maisDeUmForno={semContagem.maisDeUmForno}
            dadosDaFolha={dadosDaFolha}
            semContagem={modo}
          />
        ) : null}
      </div>
    </div>
  );
}

// O esqueleto das listas, no formato do conteúdo (06.4-UI-SPEC.md §Carregando): o bloco "a cobrar"
// (título `h-6 w-56` e duas linhas `h-24`, plano 04) antes do bloco "Sem contagem" (título `h-6 w-40` e
// duas linhas `h-16`).
export function EsqueletoDasListas() {
  return (
    <div className="px-6 pb-6 md:px-8">
      <div
        aria-busy="true"
        data-testid="queimas-listas-carregando"
        className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 lg:gap-6"
      >
        <div className="bg-superficie border-border flex flex-col gap-4 rounded-lg border p-4">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="bg-superficie border-border flex flex-col gap-4 rounded-lg border p-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    </div>
  );
}

import { ROTULO_CARREGANDO_A_PAGINA, TITULO_DA_PAGINA } from "@/lib/lembretes/textos";
import { Skeleton } from "@/components/ui/skeleton";
import { CabecalhoPagina } from "@/components/amassa/cabecalho-pagina";

const PILULAS = [0, 1, 2, 3, 4, 5];
const LINHAS = [0, 1, 2, 3, 4, 5];

// O esqueleto de "ver todos" (06.3-UI-SPEC.md §Carregando): o cabeçalho REAL "Lembretes", a barra
// do campo de criar (44 px, `rounded-full`), 6 pílulas de filtro (44 px) e 6 linhas de 56 px — no
// formato da página pronta, nunca a tela em branco (CLAUDE.md §Estados). Os retângulos são
// `aria-hidden`; o leitor de tela ouve só "Carregando: Lembretes".
export default function CarregandoLembretes() {
  return (
    <div className="flex flex-col">
      <CabecalhoPagina titulo={TITULO_DA_PAGINA} />
      <div className="flex flex-col gap-4 px-6 py-6 md:px-8">
        <div className="flex w-full max-w-3xl flex-col gap-4" aria-busy="true">
          <span className="sr-only">{ROTULO_CARREGANDO_A_PAGINA}</span>
          <Skeleton aria-hidden="true" className="h-11 w-full rounded-full" />
          <div aria-hidden="true" className="flex flex-wrap gap-2">
            {PILULAS.map((indice) => (
              <Skeleton key={indice} className="h-11 w-20 rounded-full" />
            ))}
          </div>
          <div aria-hidden="true" className="flex flex-col gap-1">
            {LINHAS.map((indice) => (
              <Skeleton key={indice} className="h-14 w-full rounded-md" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

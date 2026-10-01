import { TITULO_AGENDA } from "@/lib/agenda/textos";
import { CabecalhoPagina } from "@/components/amassa/cabecalho-pagina";
import { Skeleton } from "@/components/ui/skeleton";

// Esqueleto da Agenda no FORMATO da semana (05-UI-SPEC.md §"Estados → Carregando"): o cabeçalho
// real, a barra de navegação e 3 grupos de dia com 2 cartões de 64px cada. Trocar de semana usa
// este mesmo arquivo. Nunca "carregando..." solto nem tela em branco (CLAUDE.md §Estados).
const DIAS = [0, 1, 2] as const;
const CARTOES = [0, 1] as const;

export default function CarregandoAgenda() {
  return (
    <div className="flex flex-col" aria-busy="true" data-testid="agenda-carregando">
      <CabecalhoPagina titulo={TITULO_AGENDA} />
      <div className="flex max-w-3xl flex-col gap-4 px-6 pt-4 pb-6 md:px-8">
        <div className="flex items-center gap-2">
          <Skeleton className="size-11 rounded-md" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="size-11 rounded-md" />
        </div>
        {DIAS.map((dia) => (
          <div key={dia} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-28" />
            {CARTOES.map((cartao) => (
              <Skeleton key={cartao} className="h-16 w-full rounded-md" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

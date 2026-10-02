import { ConteudoDaAgendaViva } from "@/components/site/agenda-publica";
import { AulasEOficinas } from "@/components/site/aulas-e-oficinas";
import { Skeleton } from "@/components/ui/skeleton";
import type { AgendaPublicaPronta } from "@/lib/agenda/publico/agenda";
import { DICA_NO_SITE, FRASE_NO_SITE_VAZIO } from "@/lib/agenda/textos";

// A aba "No site" (UI-D18): o gestor vê exatamente o que vai ao ar — O MESMO componente do site,
// lido AO VIVO (sem o cache da raiz) e com os links reais de WhatsApp, dentro de uma moldura do papel
// do site (até 1080px, os mesmos pontos de quebra 768/880). Sem evento público (D-11): a caixa neutra
// e a prévia do estado da 04.6. A leitura que falha NÃO cai aqui — sobe ao `error.tsx` da Agenda
// (decisão do backstop E19 error): o estado da D-11 diria "nenhuma aula pública" sem ser verdade.
const CLASSE_DA_MOLDURA =
  "w-full max-w-[1080px] overflow-hidden rounded-[14px] border border-site-borda bg-site-papel text-site-tinta";

export function MolduraNoSite({ agenda }: { agenda: AgendaPublicaPronta }) {
  return (
    <div className="flex flex-col gap-4" data-testid="no-site">
      <p className="text-corpo text-muted-foreground">{DICA_NO_SITE}</p>
      {agenda.temEventos ? (
        <div data-testid="moldura-no-site" className={`${CLASSE_DA_MOLDURA} p-4 md:p-8`}>
          <ConteudoDaAgendaViva agenda={agenda} />
        </div>
      ) : (
        <>
          <p
            data-testid="no-site-vazio"
            className="text-corpo rounded-md border border-border bg-muted p-4"
          >
            {FRASE_NO_SITE_VAZIO}
          </p>
          <div data-testid="moldura-no-site" className={CLASSE_DA_MOLDURA}>
            <AulasEOficinas />
          </div>
        </>
      )}
    </div>
  );
}

// Carregando (05-UI-SPEC.md §Carregando, "No site"): a moldura + 3 cartões.
export function EsqueletoDoNoSite() {
  return (
    <div
      className="flex flex-col gap-4"
      aria-busy="true"
      data-testid="no-site-carregando"
    >
      <Skeleton className="h-10 w-full max-w-xl" />
      <div className={`${CLASSE_DA_MOLDURA} flex flex-col gap-4 p-4 md:p-8`}>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-11 w-52 rounded-full" />
        {[0, 1, 2].map((cartao) => (
          <Skeleton key={cartao} className="h-32 w-full rounded-[12px]" />
        ))}
      </div>
    </div>
  );
}

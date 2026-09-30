import { FILTROS_DO_QUADRO, type FiltroDoQuadro } from "@/lib/producao/quadro";
import { ARIA_FILTRAR_ORDENS, ROTULO_DO_FILTRO } from "@/lib/producao/textos";
import { cn } from "@/lib/utils";

// O estilo da pílula da Fase 06 (`classeDaPilula` de `components/amassa/estoque/
// barra-ferramentas-saldos.tsx`, copiado como as outras telas copiam): contorno neutro; marcada, o
// fundo `acento-fundo` com texto terracota em 600 — o estado não depende só de cor (o peso muda
// junto). 44px de alvo (UI-D1: o filtro é pílula; a vista, aba neutra — plano 09).
function classeDaPilula(marcada: boolean): string {
  return cn(
    "text-apoio focus-visible:ring-ring inline-flex min-h-[44px] items-center gap-1 rounded-full border px-4 py-2 transition-colors focus-visible:ring-2 focus-visible:outline-none",
    marcada
      ? "border-acento bg-acento-fundo text-acento font-semibold"
      : "border-borda bg-superficie text-tinta hover:bg-superficie-2 font-normal",
  );
}

// As pílulas "Tudo · Encomendas · Da casa" (UI-SPEC §"Página `/gestao/producao`" item 2; PRD-05).
// Componente burro — quem guarda o filtro é o `PainelProducao`. `flex-wrap`: a 320px as pílulas
// quebram linha, nunca rolam de lado.
export function PilulasFiltro({
  filtro,
  aoMudar,
}: {
  filtro: FiltroDoQuadro;
  aoMudar: (filtro: FiltroDoQuadro) => void;
}) {
  return (
    <div role="group" aria-label={ARIA_FILTRAR_ORDENS} className="flex flex-wrap gap-2">
      {FILTROS_DO_QUADRO.map((umFiltro) => (
        <button
          key={umFiltro}
          type="button"
          aria-pressed={filtro === umFiltro}
          onClick={() => aoMudar(umFiltro)}
          data-testid={`producao-filtro-${umFiltro}`}
          className={classeDaPilula(filtro === umFiltro)}
        >
          {ROTULO_DO_FILTRO[umFiltro]}
        </button>
      ))}
    </div>
  );
}

import { larguraDaRegua, type ResumoDoMes } from "@/lib/financeiro/mes";
import { formatarReais } from "@/lib/financeiro/formato";
import {
  FRASE_NENHUM_CUSTO_GERAL,
  ROTULO_AREA,
  ROTULO_GERAL_CUSTOS_DA_CASA,
  ROTULO_O_QUE_AREAS_DEIXARAM,
  TITULO_AREAS_PAGAM_A_CASA,
  textoVeredito,
} from "@/lib/financeiro/textos";
import { cn } from "@/lib/utils";

export type ReguaMesProps = {
  resumo: ResumoDoMes;
};

// "As áreas pagam a casa?" (protótipo `telaMes`) — duas barras segmentadas (o que as áreas
// deixaram, por cor de área; o Geral, sem dividir) na MESMA escala, o veredito (única cor
// saturada e cheia da tela, 04.4-UI-SPEC.md Foco Visual Principal) e a lista do Geral.
export function ReguaMes({ resumo }: ReguaMesProps) {
  const { areas, deixouTotalCentavos, geral, geralTotalCentavos, veredicto, resultadoCentavos } = resumo;
  const sobrou = veredicto === "sobrou";

  return (
    <section className="border-border bg-card flex flex-col gap-4 rounded-lg border p-4">
      <h2 className="text-titulo text-foreground">{TITULO_AREAS_PAGAM_A_CASA}</h2>

      <div className="flex flex-col gap-2">
        <div className="text-apoio text-muted-foreground flex justify-between">
          <span>{ROTULO_O_QUE_AREAS_DEIXARAM}</span>
          <span className="tabular-nums">{formatarReais(deixouTotalCentavos)}</span>
        </div>
        <div className="bg-muted flex h-[22px] overflow-hidden rounded-sm">
          {areas.map((area) => (
            <i
              key={area.area}
              title={ROTULO_AREA[area.area]}
              aria-hidden="true"
              style={{
                width: `${larguraDaRegua(area.deixouCentavos, deixouTotalCentavos, geralTotalCentavos)}%`,
                backgroundColor: `var(--color-area-${area.area})`,
              }}
            />
          ))}
        </div>

        <div className="text-apoio text-muted-foreground flex justify-between">
          <span>{ROTULO_GERAL_CUSTOS_DA_CASA}</span>
          <span className="tabular-nums">{formatarReais(geralTotalCentavos)}</span>
        </div>
        <div className="bg-muted flex h-[22px] overflow-hidden rounded-sm">
          <i
            aria-hidden="true"
            style={{
              width: `${larguraDaRegua(geralTotalCentavos, deixouTotalCentavos, geralTotalCentavos)}%`,
              backgroundColor: "var(--color-area-geral)",
            }}
          />
        </div>
      </div>

      <div
        data-testid="mes-veredito"
        className={cn(
          "rounded-md px-3 py-2 text-corpo font-semibold",
          sobrou ? "bg-sucesso-fundo text-sucesso" : "bg-erro-fundo text-erro",
        )}
      >
        {textoVeredito(sobrou, formatarReais(resultadoCentavos))}
      </div>

      {geral.length === 0 ? (
        <p className="text-corpo text-muted-foreground">{FRASE_NENHUM_CUSTO_GERAL}</p>
      ) : (
        <div className="flex flex-col gap-1">
          {geral.map((linha) => (
            <div key={linha.nome} data-testid="mes-geral-linha" className="flex justify-between gap-3">
              <span className="text-corpo min-w-0 flex-1 truncate">{linha.nome}</span>
              <span className="text-corpo tabular-nums whitespace-nowrap">{formatarReais(linha.valorCentavos)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

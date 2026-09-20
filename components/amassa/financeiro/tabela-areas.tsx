import type { AreaDoMesResumo } from "@/lib/financeiro/mes";
import { formatarReais } from "@/lib/financeiro/formato";
import {
  DICA_CUSTOU_DA_AREA,
  ROTULO_AREA,
  ROTULO_COLUNA_AREA,
  ROTULO_COLUNA_CUSTOU,
  ROTULO_COLUNA_DEIXOU,
  ROTULO_COLUNA_VENDEU,
  ROTULO_JUNTAS,
  TITULO_QUANTO_AREA_DEIXOU,
} from "@/lib/financeiro/textos";

export type TabelaAreasProps = {
  areas: readonly AreaDoMesResumo[];
  vendeuTotalCentavos: number;
  custouTotalCentavos: number;
  deixouTotalCentavos: number;
};

// "Quanto cada área deixou" (protótipo `telaMes`): as quatro áreas de verdade, sempre na ordem
// fixa, com o ponto de cor e "Deixou" negativo em `--color-erro`. `overflow-x-auto` no próprio
// contêiner é a rede de segurança contra tela estreita — a PÁGINA nunca rola na horizontal por
// causa desta tabela (04.4-UI-SPEC.md).
export function TabelaAreas({ areas, vendeuTotalCentavos, custouTotalCentavos, deixouTotalCentavos }: TabelaAreasProps) {
  return (
    <section className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4">
      <h2 className="text-titulo text-foreground">{TITULO_QUANTO_AREA_DEIXOU}</h2>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-corpo">
          <thead>
            <tr>
              <th className="text-apoio text-muted-foreground py-1 text-left font-medium">{ROTULO_COLUNA_AREA}</th>
              <th className="text-apoio text-muted-foreground py-1 text-right font-medium">{ROTULO_COLUNA_VENDEU}</th>
              <th className="text-apoio text-muted-foreground py-1 text-right font-medium">{ROTULO_COLUNA_CUSTOU}</th>
              <th className="text-apoio text-muted-foreground py-1 text-right font-medium">{ROTULO_COLUNA_DEIXOU}</th>
            </tr>
          </thead>
          <tbody>
            {areas.map((area) => (
              <tr key={area.area} data-testid={`mes-area-${area.area}`} className="border-border border-t">
                <td className="py-2 whitespace-nowrap">
                  <span
                    aria-hidden="true"
                    className="mr-2 inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: `var(--color-area-${area.area})` }}
                  />
                  {ROTULO_AREA[area.area]}
                </td>
                <td className="text-corpo py-2 text-right tabular-nums whitespace-nowrap">
                  {formatarReais(area.vendeuCentavos)}
                </td>
                <td className="text-corpo py-2 text-right tabular-nums whitespace-nowrap">
                  {formatarReais(area.custouCentavos)}
                </td>
                <td
                  className={
                    "py-2 text-right tabular-nums whitespace-nowrap " +
                    (area.deixouCentavos < 0 ? "text-erro" : "text-foreground")
                  }
                >
                  {formatarReais(area.deixouCentavos)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr data-testid="mes-juntas" className="border-border border-t font-semibold">
              <td className="py-2">{ROTULO_JUNTAS}</td>
              <td className="text-corpo py-2 text-right tabular-nums whitespace-nowrap">
                {formatarReais(vendeuTotalCentavos)}
              </td>
              <td className="text-corpo py-2 text-right tabular-nums whitespace-nowrap">
                {formatarReais(custouTotalCentavos)}
              </td>
              <td
                className={
                  "py-2 text-right tabular-nums whitespace-nowrap " +
                  (deixouTotalCentavos < 0 ? "text-erro" : "text-foreground")
                }
              >
                {formatarReais(deixouTotalCentavos)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-apoio text-muted-foreground">{DICA_CUSTOU_DA_AREA}</p>
    </section>
  );
}

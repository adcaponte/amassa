import { TabelaResponsiva } from "@/components/amassa/tabela-responsiva";
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
  textoVendeuCustou,
} from "@/lib/financeiro/textos";

export type TabelaAreasProps = {
  areas: readonly AreaDoMesResumo[];
  vendeuTotalCentavos: number;
  custouTotalCentavos: number;
  deixouTotalCentavos: number;
};

function classeDoDeixou(centavos: number): string {
  return centavos < 0 ? "text-erro" : "text-foreground";
}

// Uma fileira da forma lista: à esquerda o nome (com o ponto da área, quando há área); à direita
// "Deixou {R$}" — o número que o dono procura, onde o olho pousa (achado 5 do Cowork); embaixo,
// "vendeu {R$} · custou {R$}".
function FileiraDaLista({
  testId,
  nome,
  area,
  vendeuCentavos,
  custouCentavos,
  deixouCentavos,
  juntas = false,
}: {
  testId: string;
  nome: string;
  area?: string;
  vendeuCentavos: number;
  custouCentavos: number;
  deixouCentavos: number;
  juntas?: boolean;
}) {
  return (
    <li
      data-testid={testId}
      className={
        "flex flex-col gap-1 py-2" + (juntas ? " border-borda-forte border-t-2 font-semibold" : "")
      }
    >
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-corpo text-foreground flex min-w-0 items-center gap-2">
          {area ? (
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: `var(--color-area-${area})` }}
            />
          ) : null}
          {nome}
        </span>
        <span className="flex shrink-0 items-baseline gap-2">
          <span className="text-apoio text-muted-foreground">{ROTULO_COLUNA_DEIXOU}</span>
          <span
            data-testid="mes-lista-deixou"
            className={
              "text-corpo font-semibold tabular-nums whitespace-nowrap " + classeDoDeixou(deixouCentavos)
            }
          >
            {formatarReais(deixouCentavos)}
          </span>
        </span>
      </div>
      <p className="text-apoio text-tinta-media tabular-nums">
        {textoVendeuCustou(formatarReais(vendeuCentavos), formatarReais(custouCentavos))}
      </p>
    </li>
  );
}

// "Quanto cada área deixou" (protótipo `telaMes`): as quatro áreas de verdade, sempre na ordem
// fixa, com o ponto de cor e "Deixou" negativo em `--color-erro`.
//
// Fase 06.5 (D-08 causa nº 2, achado 5 do Cowork): o mesmo dado em duas formas pela
// `TabelaResponsiva`. Abaixo de 384 px de CONTÊINER (`@sm`, a letra do D-08), uma lista; a partir
// daí, a tabela de sempre, intocada no desenho. Não é `@md` (UI-D2): na grade de duas colunas do
// Mês, a 1280 px de tela a seção tem 442 px de conteúdo e a tabela sumiria do desktop. Entre 384 e
// 420 px de contêiner, o `min-w-[420px]` rola DENTRO da rede `overflow-x-auto` — a PÁGINA nunca rola
// na horizontal por causa desta seção (04.4-UI-SPEC.md).
export function TabelaAreas({ areas, vendeuTotalCentavos, custouTotalCentavos, deixouTotalCentavos }: TabelaAreasProps) {
  const lista = (
    <ul className="divide-border flex flex-col divide-y">
      {areas.map((area) => (
        <FileiraDaLista
          key={area.area}
          testId={`mes-area-lista-${area.area}`}
          nome={ROTULO_AREA[area.area]}
          area={area.area}
          vendeuCentavos={area.vendeuCentavos}
          custouCentavos={area.custouCentavos}
          deixouCentavos={area.deixouCentavos}
        />
      ))}
      <FileiraDaLista
        testId="mes-juntas-lista"
        nome={ROTULO_JUNTAS}
        vendeuCentavos={vendeuTotalCentavos}
        custouCentavos={custouTotalCentavos}
        deixouCentavos={deixouTotalCentavos}
        juntas
      />
    </ul>
  );

  const tabela = (
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
              data-testid="mes-tabela-deixou"
              className={"py-2 text-right tabular-nums whitespace-nowrap " + classeDoDeixou(area.deixouCentavos)}
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
            data-testid="mes-tabela-deixou"
            className={"py-2 text-right tabular-nums whitespace-nowrap " + classeDoDeixou(deixouTotalCentavos)}
          >
            {formatarReais(deixouTotalCentavos)}
          </td>
        </tr>
      </tfoot>
    </table>
  );

  return (
    <section className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4">
      <h2 className="text-titulo text-foreground">{TITULO_QUANTO_AREA_DEIXOU}</h2>

      <TabelaResponsiva limiar="sm" rotulo={TITULO_QUANTO_AREA_DEIXOU} lista={lista} tabela={tabela} />

      <p className="text-apoio text-muted-foreground">{DICA_CUSTOU_DA_AREA}</p>
    </section>
  );
}

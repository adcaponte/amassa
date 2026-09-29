import { formatarReais } from "@/lib/financeiro/formato";
import { ROTULO_AREA } from "@/lib/financeiro/textos";
import type { BarraDoParaOndeFoi } from "@/lib/estoque/historico";
import {
  SEM_SAIDA,
  rotuloDaBarra,
  textoDoPeriodo,
  textoQuantasBaixas,
  textoQuantasSaidas,
} from "@/lib/estoque/textos";
import { cn } from "@/lib/utils";

import { PontoDaArea } from "./cartao-saldo";

// A sub-linha da barra (UI-SPEC §Aba Para onde foi): "{Área} · {n} saída(s) · {p}% do período"; na
// de vendas, "{n} baixa(s) · {p}% do período"; sem nada, "nenhuma saída" (com a área na frente, nos
// destinos manuais).
function subLinha(barra: BarraDoParaOndeFoi): string {
  const area = barra.area !== null ? ROTULO_AREA[barra.area] : null;
  if (barra.saidas === 0) {
    return [area, SEM_SAIDA].filter(Boolean).join(" · ");
  }
  const quantas =
    barra.chave === "venda" ? textoQuantasBaixas(barra.saidas) : textoQuantasSaidas(barra.saidas);
  return [area, quantas, textoDoPeriodo(barra.percentual)].filter(Boolean).join(" · ");
}

// As seis barras do "Para onde foi" — HTML, sem Recharts (UI-SPEC). Cada uma: cabeçalho "{nome}" …
// "{R$}" (o valor 600, `whitespace-nowrap`, `tabular-nums` — a 320px o nome quebra e o valor não,
// UI · overflow · E4), o trilho de 8px `superficie-2` com o preenchimento proporcional (`acento`, ou
// `erro` na "Perda ou quebra" — P12/P13), a sub-linha e, na barra de vendas, uma linha por área que
// vendeu (D-31). A barra (cabeçalho, trilho e sub-linha) é `role="img"` com o nome acessível da
// UI-SPEC; o trilho é decorativo (`aria-hidden`). As linhas por área ficam FORA do `img` — um
// `img` esconde os filhos do leitor de tela, e o valor de cada área precisa ser lido. Cada barra
// continua um item de lista. Componente burro: a conta é de `agregarParaOndeFoi`.
export function BarrasParaOndeFoi({ barras }: { barras: readonly BarraDoParaOndeFoi[] }) {
  return (
    <ul
      data-testid="destino-barras"
      aria-label="Consumo por destino"
      className="bg-superficie border-borda flex flex-col gap-4 rounded-lg border p-4 min-[980px]:max-w-3xl"
    >
      {barras.map((barra) => {
        const valor = formatarReais(barra.valorCentavos);
        return (
          <li
            key={barra.chave}
            data-testid="destino-barra"
            data-destino={barra.chave}
            data-valor-centavos={barra.valorCentavos}
            className="flex flex-col gap-1"
          >
            <div
              role="img"
              aria-label={rotuloDaBarra(barra.nome, valor, barra.percentual)}
              data-testid="destino-barra-grafico"
              className="flex flex-col gap-1"
            >
              <div className="text-corpo text-tinta flex items-baseline justify-between gap-3">
                <span className="min-w-0 [overflow-wrap:anywhere]">{barra.nome}</span>
                <span className="font-semibold whitespace-nowrap tabular-nums">{valor}</span>
              </div>
              <div aria-hidden="true" className="bg-superficie-2 h-2 overflow-hidden rounded-full">
                <div
                  className={cn(
                    "h-full rounded-full",
                    barra.chave === "perda" ? "bg-erro" : "bg-acento",
                  )}
                  style={{ width: `${barra.largura}%` }}
                />
              </div>
              <p className="text-apoio text-tinta-fraca tabular-nums">{subLinha(barra)}</p>
            </div>
            {barra.porArea.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {barra.porArea.map((linha) => (
                  <li
                    key={linha.area}
                    data-testid="destino-barra-area"
                    className="text-apoio text-tinta-media flex items-center gap-2 tabular-nums"
                  >
                    <PontoDaArea area={linha.area} />
                    <span>{ROTULO_AREA[linha.area]}</span>
                    <span className="font-semibold whitespace-nowrap">
                      {formatarReais(linha.valorCentavos)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

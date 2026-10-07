import { formatarReais } from "@/lib/financeiro/formato";
import type { ResultadoDaFicha as ResultadoDaFichaTipo } from "@/lib/precificacao/ficha";
import {
  FRASE_DIVISOR_INVALIDO,
  FRASE_MERCADO_ABAIXO_DO_MINIMO,
  FRASE_MERCADO_ACIMA_DO_MINIMO,
  FRASE_NAO_CABE_NO_FORNO,
  fraseNoForno,
} from "@/lib/precificacao/textos";
import { BarraDeCusto } from "./barra-de-custo";
import { SeloDePreco } from "./selo-de-preco";

export type ResultadoDaFichaProps = {
  resultado: ResultadoDaFichaTipo;
  precoPraticadoCentavos: number | null;
  precoMercadoCentavos: number | null;
};

// O bloco "de onde vem o custo" (04.5-UI-SPEC.md §Foco Visual) — recalculado AO VIVO a cada tecla
// pelo diálogo (`DialogoFicha`), que já chega aqui com `resultado` pronto (a mesma função pura
// `resultadoDaFicha` que o servidor chamaria, se algum dia precisasse). Nenhuma aritmética de
// preço neste componente.
export function ResultadoDaFicha({
  resultado,
  precoPraticadoCentavos,
  precoMercadoCentavos,
}: ResultadoDaFichaProps) {
  if (!resultado.ok) {
    const testid = resultado.motivo === "nao-cabe" ? "aviso-nao-cabe" : "aviso-divisor";
    const texto = resultado.motivo === "nao-cabe" ? FRASE_NAO_CABE_NO_FORNO : FRASE_DIVISOR_INVALIDO;
    return (
      <div data-testid="ficha-resultado">
        <div role="alert" data-testid={testid} className="bg-erro-fundo text-erro text-corpo rounded-lg p-4">
          {texto}
        </div>
      </div>
    );
  }

  const mercadoInformado = precoMercadoCentavos !== null && precoMercadoCentavos > 0;
  const mercadoAcimaDoMinimo = mercadoInformado && (precoMercadoCentavos as number) >= resultado.minimoCentavos;

  return (
    <div data-testid="ficha-resultado" className="flex flex-col gap-3">
      <p data-testid="ficha-cabem" className="text-apoio text-muted-foreground">
        {fraseNoForno(resultado.forno)}
      </p>

      <BarraDeCusto fatias={resultado.fatias} custoCentavos={resultado.custoCentavos} />

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <span className="text-corpo text-foreground font-medium">Custo da peça</span>
          <span className="text-corpo text-foreground tabular-nums font-semibold">
            {formatarReais(resultado.custoCentavos)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-corpo text-foreground">Preço mínimo, venda direta ou encomenda</span>
          <span data-testid="ficha-minimo-direto" className="text-corpo text-foreground tabular-nums font-semibold">
            {formatarReais(resultado.minimoCentavos)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-corpo text-foreground">Preço mínimo em galeria ou consignado</span>
          <span data-testid="ficha-minimo-galeria" className="text-apoio text-muted-foreground tabular-nums">
            {resultado.minimoGaleriaCentavos !== null ? formatarReais(resultado.minimoGaleriaCentavos) : "—"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-corpo text-foreground">Preço zero</span>
          <span className="text-apoio text-muted-foreground tabular-nums">
            {formatarReais(resultado.zeroCentavos)}
          </span>
        </div>
      </div>

      <SeloDePreco
        farol={resultado.farol}
        precoPraticadoCentavos={precoPraticadoCentavos}
        minimoCentavos={resultado.minimoCentavos}
      />

      {mercadoInformado ? (
        <p className="text-apoio text-muted-foreground">
          {mercadoAcimaDoMinimo ? FRASE_MERCADO_ACIMA_DO_MINIMO : FRASE_MERCADO_ABAIXO_DO_MINIMO}
        </p>
      ) : null}
    </div>
  );
}

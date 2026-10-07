import { formatarReais } from "@/lib/financeiro/formato";
import type { ResumoDoCaixa } from "@/lib/financeiro/extrato";
import {
  ROTULO_TILE_A_PAGAR,
  ROTULO_TILE_A_RECEBER,
  ROTULO_TILE_SALDO,
  ROTULO_TILE_SE_TUDO_SE_CUMPRIR,
  textoJanelaAte,
} from "@/lib/financeiro/textos";

export type TilesCaixaProps = {
  resumo: ResumoDoCaixa;
  // O fim da janela de 30 dias, já em `dd/mm` (06.5-12, UI-D7): "A receber", "A pagar" e "Se tudo
  // se cumprir" somam só a janela e dizem até quando, embaixo do número; o saldo não muda.
  janelaAte: string;
};

// Os quatro tiles do Caixa (protótipo `telaCaixa`) — grade `auto-fit minmax(150px,1fr)` para um
// valor alto ("R$ 123.456,78") crescer na vertical em vez de rolar a página na horizontal
// (04.4-UI-SPEC.md, backstop de overflow). "Saldo em caixa" é o único de fundo escuro
// (`--color-tinta`) — o foco visual principal da tela (04.4-UI-SPEC.md §Foco Visual Principal).
export function TilesCaixa({ resumo, janelaAte }: TilesCaixaProps) {
  const ate = (
    <span data-testid="caixa-janela-ate" className="text-apoio text-muted-foreground">
      {textoJanelaAte(janelaAte)}
    </span>
  );

  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}
    >
      <div
        data-testid="caixa-tile-saldo"
        className="bg-tinta flex flex-col gap-1 rounded-lg p-4 text-white"
      >
        <span className="text-apoio font-semibold tracking-wide uppercase">
          {ROTULO_TILE_SALDO}
        </span>
        <strong className="text-display tabular-nums whitespace-nowrap">
          {formatarReais(resumo.saldoCentavos)}
        </strong>
      </div>

      <div
        data-testid="caixa-tile-receber"
        className="border-border bg-card flex flex-col gap-1 rounded-lg border p-4"
      >
        <span className="text-apoio text-muted-foreground font-semibold tracking-wide uppercase">
          {ROTULO_TILE_A_RECEBER}
        </span>
        <strong className="text-display text-foreground tabular-nums whitespace-nowrap">
          {formatarReais(resumo.aReceberCentavos)}
        </strong>
        {ate}
      </div>

      <div
        data-testid="caixa-tile-pagar"
        className="border-border bg-card flex flex-col gap-1 rounded-lg border p-4"
      >
        <span className="text-apoio text-muted-foreground font-semibold tracking-wide uppercase">
          {ROTULO_TILE_A_PAGAR}
        </span>
        <strong className="text-display text-foreground tabular-nums whitespace-nowrap">
          {formatarReais(resumo.aPagarCentavos)}
        </strong>
        {ate}
      </div>

      <div
        data-testid="caixa-tile-previsto"
        className="border-border bg-card flex flex-col gap-1 rounded-lg border p-4"
      >
        <span className="text-apoio text-muted-foreground font-semibold tracking-wide uppercase">
          {ROTULO_TILE_SE_TUDO_SE_CUMPRIR}
        </span>
        <strong className="text-display text-foreground tabular-nums whitespace-nowrap">
          {formatarReais(resumo.seTudoSeCumprirCentavos)}
        </strong>
        {ate}
      </div>
    </div>
  );
}

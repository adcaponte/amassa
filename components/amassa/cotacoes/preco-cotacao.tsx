import {
  ROTULO_PRECO_SOB_CONSULTA_ACESSIVEL,
  ROTULO_PRECO_SOB_CONSULTA_VISUAL,
} from "@/lib/cotacoes/textos";
import { formatarReais } from "@/lib/abertura/formato";

// Preço nulo (D-07): travessão VISUAL, envolvido num elemento com a frase de sob consulta para o
// leitor de tela (nunca deixá-lo anunciar só o traço). Compartilhado por `linha-cotacao.tsx` e
// `cartao-cotacao.tsx` (Tarefa 3, 04.3-03) — uma função só, nunca duas cópias da mesma regra de
// exibição.
export function PrecoCotacao({ centavos }: { centavos: number | null }) {
  if (centavos === null) {
    return (
      <span
        data-testid="cotacoes-preco"
        aria-label={ROTULO_PRECO_SOB_CONSULTA_ACESSIVEL}
        className="text-corpo font-bold tabular-nums"
      >
        {ROTULO_PRECO_SOB_CONSULTA_VISUAL}
      </span>
    );
  }
  return (
    <span data-testid="cotacoes-preco" className="text-corpo font-bold tabular-nums">
      {formatarReais(centavos)}
    </span>
  );
}

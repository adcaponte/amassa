import {
  ROTULO_PRECO_SOB_CONSULTA_ACESSIVEL,
  ROTULO_PRECO_SOB_CONSULTA_VISUAL,
} from "@/lib/cotacoes/textos";
import { formatarReais } from "@/lib/abertura/formato";
import { cn } from "@/lib/utils";

export type PrecoCotacaoProps = {
  centavos: number | null;
  // "corpo" (padrão) — o preço dentro da linha/cartão da lista. "titulo" — o preço EM DESTAQUE do
  // detalhe e da comparação (Tarefa 2/3, 04.3-04): `text-titulo font-bold tabular-nums` é
  // EXATAMENTE a classe que `04.3-UI-SPEC.md` §Typography nomeia — a mesma que
  // `lista-meses.tsx`/`painel-resumo.tsx` já usam para valor monetário em destaque no mesmo
  // módulo, nunca uma declaração solta de tamanho/peso. Um único componente com um parâmetro de
  // tamanho, nunca uma segunda função de formatação de moeda (proibição do plano).
  tamanho?: "corpo" | "titulo";
};

// Preço nulo (D-07): travessão VISUAL, envolvido num elemento com a frase de sob consulta para o
// leitor de tela (nunca deixá-lo anunciar só o traço). Compartilhado por `linha-cotacao.tsx`,
// `cartao-cotacao.tsx` (Tarefa 3, 04.3-03), `detalhe-cotacao.tsx` e `comparacao-cotacoes.tsx`
// (Tarefa 2/3, 04.3-04) — uma função só, nunca duas cópias da mesma regra de exibição.
export function PrecoCotacao({ centavos, tamanho = "corpo" }: PrecoCotacaoProps) {
  const classe = cn(
    "font-bold tabular-nums",
    tamanho === "titulo" ? "text-titulo" : "text-corpo",
  );

  if (centavos === null) {
    return (
      <span data-testid="cotacoes-preco" aria-label={ROTULO_PRECO_SOB_CONSULTA_ACESSIVEL} className={classe}>
        {ROTULO_PRECO_SOB_CONSULTA_VISUAL}
      </span>
    );
  }
  return (
    <span data-testid="cotacoes-preco" className={classe}>
      {formatarReais(centavos)}
    </span>
  );
}

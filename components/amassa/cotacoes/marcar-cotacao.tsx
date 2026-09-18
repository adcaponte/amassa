"use client";

import type { Cotacao } from "@/lib/cotacoes/consultas";
import { ROTULO_MARCAR_PARA_COMPARAR } from "@/lib/cotacoes/textos";
import { Checkbox } from "@/components/ui/checkbox";

export type MarcarCotacaoProps = {
  cotacao: Cotacao;
  marcado: boolean;
  aoAlternar: () => void;
};

// A caixa de marcação "comparar" (D-13, Tarefa 3): seleção múltipla INDEPENDENTE, nunca o botão
// de alternância `CaixaMarcacao` do módulo hospedeiro (aquele grava no servidor e usa
// `aria-pressed`; esta marcação é estado só de CLIENTE, D-23 — o UI-SPEC pede explicitamente
// para não reaproveitar aquele). Usa o `Checkbox` nativo instalado no plano 01 — o estado é lido
// nativamente pelo leitor de tela, sem precisar de `aria-pressed` manual.
//
// Glifo visual de 20×20 (`size-5`) dentro de uma zona de toque REAL de 44×44: o `<span>` externo
// É o alvo medido pelo e2e (mesma disciplina de `caixa-marcacao.tsx` — um alvo de verdade, não só
// um hit-slop invisível). O `Checkbox` em si ganha um hit-slop maior
// (`after:-inset-y-3`, substituindo o `-inset-y-2` padrão de `components/ui/checkbox.tsx`) para
// que um toque em qualquer ponto do quadrado de 44px acerte o controle de verdade — Playwright
// sempre clica no CENTRO do elemento localizado, então os dois alvos coincidem nos testes; num
// dedo real, o hit-slop é o que faz a borda do quadrado de 44px responder também.
export function MarcarCotacao({ cotacao, marcado, aoAlternar }: MarcarCotacaoProps) {
  return (
    <span data-testid="cotacoes-marcar" className="flex size-11 flex-none items-center justify-center">
      <Checkbox
        className="size-5 after:-inset-y-3"
        checked={marcado}
        onCheckedChange={aoAlternar}
        aria-label={ROTULO_MARCAR_PARA_COMPARAR(cotacao.empresa)}
      />
    </span>
  );
}

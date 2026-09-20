"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { atualizarValorDaContaFixa } from "@/lib/cadastros/acoes";
import { converterReaisParaCentavos } from "@/lib/financeiro/dinheiro";

export type ValorContaFixaProps = {
  id: string;
  nome: string;
  valorCentavos: number;
};

// "150000" centavos → "1500,00" — texto digitável em reais com vírgula, sempre com duas casas
// (mesma mão inversa de `formulario-taxa.tsx::pontosBaseParaTexto`, mas em reais, não percentual).
function centavosParaTexto(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Campo de valor esperado editável NA PRÓPRIA LINHA (04.4-10-PLAN.md, Tarefa 1): ao sair do campo
// com o valor mudado, chama `atualizarValorDaContaFixa` SEM navegar (nunca
// `window.location.assign` — mudar o valor esperado não precisa recarregar a lista inteira); deu
// certo, o campo fica com o valor gravado; falhou, volta ao valor anterior e mostra o erro
// (`toast.error`, mesma disciplina de `CaixaMarcacao`). Alvo de toque 44px/texto 16px (CLAUDE.md
// §Acessibilidade — campo de formulário menor que 16px dá zoom sozinho no iOS ao focar).
export function ValorContaFixa({ id, nome, valorCentavos }: ValorContaFixaProps) {
  const [valor, setValor] = useState(() => centavosParaTexto(valorCentavos));
  const [enviando, setEnviando] = useState(false);
  const valorGravadoRef = useRef(valorCentavos);

  // O valor gravado pode mudar por fora (outro gestor editou, ou a navegação completa de
  // outra ação revalidou a lista) — o campo local precisa acompanhar, nunca ficar preso ao
  // primeiro carregamento (mesmo cuidado de `caixa-marcacao.tsx`).
  useEffect(() => {
    valorGravadoRef.current = valorCentavos;
    setValor(centavosParaTexto(valorCentavos));
  }, [valorCentavos]);

  async function salvarSeMudou() {
    const resultado = converterReaisParaCentavos(valor);

    if (!resultado.ok || resultado.centavos === null || resultado.centavos === valorGravadoRef.current) {
      // Texto inválido, vazio ou sem mudança de verdade — nada para gravar; o campo volta a
      // mostrar o valor gravado, formatado.
      setValor(centavosParaTexto(valorGravadoRef.current));
      return;
    }

    setEnviando(true);
    const resposta = await atualizarValorDaContaFixa({ id, valorTexto: valor });
    setEnviando(false);

    if (!resposta.ok) {
      setValor(centavosParaTexto(valorGravadoRef.current));
      toast.error(resposta.erro);
      return;
    }

    valorGravadoRef.current = resposta.dados.valorCentavos;
    setValor(centavosParaTexto(resposta.dados.valorCentavos));
  }

  return (
    <input
      type="text"
      aria-label={`Valor esperado de ${nome}`}
      data-testid="conta-fixa-valor"
      inputMode="decimal"
      disabled={enviando}
      value={valor}
      onChange={(evento) => setValor(evento.target.value)}
      onBlur={() => void salvarSeMudou()}
      className="border-border text-corpo min-h-[44px] w-[130px] rounded-md border px-3 disabled:opacity-60"
    />
  );
}

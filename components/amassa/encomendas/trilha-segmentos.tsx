import type { Etapa, FaixaDeEtapa, Situacao } from "@/lib/encomendas/cronograma";
import { ROTULO_ETAPA } from "@/lib/encomendas/textos";

// Largura mínima de um segmento desenhado — resposta à borda de adjacência (ENC-08/adjacency):
// uma etapa de 1 dia ao lado de uma de 20 continua visível, mesmo quando o percentual puro
// arredondaria para menos de 4px.
const LARGURA_MINIMA_SEGMENTO = 4;

export type TrilhaSegmentosProps = {
  faixas: readonly FaixaDeEtapa[];
  situacao: Situacao;
  rascunho: boolean;
};

// A etapa que `situacaoEm` aponta como "atual" — só os três ramos que de fato apontam uma
// etapa (em curso, em curso num marco, última etapa) ganham destaque; os demais (ainda não
// começou, atrasada, concluída, cancelada, sem etapas) não têm etapa "atual" no sentido do
// destaque visual da trilha (03-UI-SPEC.md "Lista Vertical Mobile" e a tabela de casos de
// borda do ENC-09 — nenhuma delas pede um segmento destacado fora desses três casos).
function etapaAtualDaSituacao(situacao: Situacao): Etapa | null {
  switch (situacao.tipo) {
    case "em-etapa-intervalo":
    case "em-etapa-marco":
    case "ultima-etapa":
      return situacao.etapa;
    default:
      return null;
  }
}

// Server Component puro de apresentação — os 6 segmentos horizontais proporcionais à duração
// (percentual = dias / duração total), NUNCA na escala de 18px/dia do Gantt (não cabe no
// celular, 04-DESIGN-SYSTEM.md §6). Etapas com `dias: 0` não geram segmento.
export function TrilhaSegmentos({ faixas, situacao, rascunho }: TrilhaSegmentosProps) {
  const faixasDesenhadas = faixas.filter((faixa) => faixa.dias > 0);
  const duracaoTotal = faixasDesenhadas.reduce((total, faixa) => total + faixa.dias, 0);

  if (duracaoTotal === 0) {
    return <p className="text-apoio text-tinta-fraca">Nenhuma etapa ligada</p>;
  }

  const etapaAtual = etapaAtualDaSituacao(situacao);

  return (
    <div
      role="list"
      aria-label="Trilha das etapas"
      data-testid="trilha-segmentos"
      className="flex h-3 w-full overflow-hidden rounded-full"
    >
      {faixasDesenhadas.map((faixa) => {
        const percentual = (faixa.dias / duracaoTotal) * 100;
        const cor = `var(--color-${faixa.etapa})`;
        const destaque = faixa.etapa === etapaAtual;
        const rotulo = `${ROTULO_ETAPA[faixa.etapa]} — ${faixa.dias} dia${faixa.dias === 1 ? "" : "s"}`;

        return (
          <div
            key={faixa.etapa}
            role="listitem"
            title={rotulo}
            aria-label={rotulo}
            data-testid={`trilha-segmento-${faixa.etapa}`}
            data-atual={destaque ? "true" : "false"}
            className="box-border"
            style={{
              width: `${percentual}%`,
              minWidth: LARGURA_MINIMA_SEGMENTO,
              backgroundImage: rascunho
                ? `repeating-linear-gradient(45deg, ${cor} 0 4px, color-mix(in srgb, ${cor} 100%, black 20%) 4px 8px)`
                : undefined,
              backgroundColor: rascunho ? undefined : cor,
              // A etapa atual ganha borda de 2px na cor da própria etapa, mais saturada que o
              // preenchimento (03-UI-SPEC.md "Lista Vertical Mobile").
              border: destaque
                ? `2px solid color-mix(in srgb, ${cor} 100%, black 20%)`
                : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

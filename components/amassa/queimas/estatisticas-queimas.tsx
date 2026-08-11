import type { EstatisticasDeQueimas } from "@/lib/queimas/relatorios";
import { ROTULO_ESTATISTICA_30_DIAS, ROTULO_ESTATISTICA_TOTAL, rotuloDoTipo } from "@/lib/queimas/textos";

// As quatro estatísticas do topo (E9, `04-UI-SPEC.md` §"Visual Hierarchy" — primeiro foco da
// tela, lidas antes dos gráficos, também no celular D-07). Server Component de apresentação puro:
// recebe o resultado já calculado de `estatisticasDeQueimas` (`lib/queimas/relatorios.ts`), não
// soma nada por conta própria. Renderiza SEMPRE as quatro, com zero quando aplicável — nunca
// meio-preenchido (E9/error, E9/zero-one-many).
export type EstatisticasQueimasProps = {
  estatisticas: EstatisticasDeQueimas;
};

type Estatistica = { rotulo: string; valor: number; testId: string };

export function EstatisticasQueimas({ estatisticas }: EstatisticasQueimasProps) {
  const itens: Estatistica[] = [
    { rotulo: ROTULO_ESTATISTICA_TOTAL, valor: estatisticas.total, testId: "total" },
    { rotulo: ROTULO_ESTATISTICA_30_DIAS, valor: estatisticas.ultimos30Dias, testId: "30-dias" },
    { rotulo: rotuloDoTipo("biscoito"), valor: estatisticas.biscoito, testId: "biscoito" },
    { rotulo: rotuloDoTipo("esmalte"), valor: estatisticas.esmalte, testId: "esmalte" },
  ];

  return (
    <div
      className="grid grid-cols-2 gap-4 md:grid-cols-4"
      aria-label="Estatísticas de queimas"
      data-testid="estatisticas-queimas"
    >
      {itens.map((item) => (
        <div
          key={item.testId}
          className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4"
          data-testid={`estatistica-${item.testId}`}
        >
          {/* label em text-apoio, número em text-mono (tabular) — literal de
              `04-UI-SPEC.md` §Typography, não simplificar para um tamanho maior. */}
          <span className="text-apoio text-muted-foreground">{item.rotulo}</span>
          <span className="text-mono text-foreground tabular-nums" data-testid={`estatistica-${item.testId}-valor`}>
            {item.valor}
          </span>
        </div>
      ))}
    </div>
  );
}

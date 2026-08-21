import type { Etapa, FaixaDeEtapa, Situacao } from "@/lib/encomendas/cronograma";
import { formatarDiaCurto } from "@/lib/encomendas/formato";
import { posicaoDeHojeNaTrilha, segmentosDaTrilha } from "@/lib/encomendas/trilha";
import { ROTULO_ETAPA, textoDaEsperaNaTrilha } from "@/lib/encomendas/textos";

// Largura mínima de um segmento desenhado — resposta à borda de adjacência (ENC-08/adjacency):
// uma etapa de 1 dia ao lado de uma de 20 continua visível, mesmo quando o percentual puro
// arredondaria para menos de 4px.
const LARGURA_MINIMA_SEGMENTO = 4;

export type TrilhaSegmentosProps = {
  faixas: readonly FaixaDeEtapa[];
  situacao: Situacao;
  rascunho: boolean;
  // A data de hoje (`YYYY-MM-DD`), sempre por prop — este componente NUNCA lê o relógio por
  // dentro, a mesma disciplina que `Gantt` já segue (A2 do brief noturno).
  hoje: string;
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

// Server Component puro de apresentação — os segmentos horizontais proporcionais à EXTENSÃO DE
// CALENDÁRIO (percentual = dias / extensão total, `segmentosDaTrilha`), NUNCA na escala de
// 18px/dia do Gantt (não cabe no celular, 04-DESIGN-SYSTEM.md §6). Etapas com `dias: 0` não
// geram segmento. A partir da fase 04.1 (D-09), um vão de espera antes de um marco vira um item
// sem preenchimento nenhum — a ausência de pintura é o que comunica o tempo parado, nunca um
// bloco tracejado ou hachurado próprio. Este componente não faz nenhuma aritmética de
// calendário: toda a geometria sai de `lib/encomendas/trilha.ts` (módulo puro), exatamente como
// o Gantt não recalcula `retanguloDaEtapa`.
export function TrilhaSegmentos({ faixas, situacao, rascunho, hoje }: TrilhaSegmentosProps) {
  const faixasDesenhadas = faixas.filter((faixa) => faixa.dias > 0);

  if (faixasDesenhadas.length === 0) {
    // Ramo defensivo INALCANÇÁVEL pela interface a partir da fase 04.1: os três marcos sempre
    // valem 1 dia (D-06), então pelo menos eles sempre geram segmento. Mantido como defesa
    // contra uma linha semeada direto no banco com as 6 etapas em 0 dias.
    return <p className="text-apoio text-tinta-fraca">Nenhuma etapa ligada</p>;
  }

  const etapaAtual = etapaAtualDaSituacao(situacao);
  // `posicaoDeHojeNaTrilha` (lib/encomendas/trilha.ts, módulo puro) devolve `null` quando "hoje"
  // está fora do período desenhado — a marca não é desenhada nesse caso (A2: nunca grudar numa
  // ponta, o que mentiria a posição).
  const posicaoDeHoje = posicaoDeHojeNaTrilha(faixasDesenhadas, hoje);
  const segmentos = segmentosDaTrilha(faixasDesenhadas);
  const primeiraFaixaDesenhada = faixasDesenhadas[0];
  // `ultimoDia` só é `null` quando `dias === 0` (cronograma.ts) — inalcançável aqui porque o
  // array já foi filtrado por `dias > 0`.
  const ultimaFaixaDesenhada = faixasDesenhadas[faixasDesenhadas.length - 1];
  const ultimoDiaDesenhado = ultimaFaixaDesenhada.ultimoDia as string;

  return (
    <div>
      <div
        role="list"
        aria-label="Trilha das etapas"
        data-testid="trilha-segmentos"
        className="relative flex h-3 w-full overflow-hidden rounded-full"
      >
        {segmentos.map((segmento) => {
          if (segmento.tipo === "vao") {
            // O vão vazio de espera (D-09): sem cor de fundo, sem imagem de fundo e sem borda —
            // é a ausência de pintura que comunica que a peça está parada, nunca um bloco
            // tracejado ou hachurado próprio. `title`/`aria-label` carregam a frase para quem
            // passar o cursor ou usar leitor de tela; `role="img"` expõe o rótulo (uma `div`
            // sem papel não é anunciada por padrão), mesma técnica do losango do Gantt.
            const textoDoVao = textoDaEsperaNaTrilha(segmento.dias) ?? "";

            return (
              <div
                key={`vao-${segmento.etapa}`}
                role="img"
                title={textoDoVao}
                aria-label={textoDoVao}
                data-testid={`trilha-espera-${segmento.etapa}`}
                className="box-border"
                style={{ width: `${segmento.percentual}%` }}
              />
            );
          }

          const etapa = segmento.etapa as Etapa;
          const cor = `var(--color-${etapa})`;
          const destaque = etapa === etapaAtual;
          const rotulo = `${ROTULO_ETAPA[etapa]} — ${segmento.dias} dia${segmento.dias === 1 ? "" : "s"}`;

          return (
            <div
              key={etapa}
              role="listitem"
              title={rotulo}
              aria-label={rotulo}
              data-testid={`trilha-segmento-${etapa}`}
              data-atual={destaque ? "true" : "false"}
              className="box-border"
              style={{
                width: `${segmento.percentual}%`,
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
        {posicaoDeHoje !== null && (
          // Decorativa (aria-hidden): a informação já existe em texto no cartão ("Etapa
          // atual: … · faltam N dias para …") e não deve ser duplicada em leitor de tela.
          <div
            aria-hidden="true"
            data-testid="trilha-hoje"
            data-posicao={String(posicaoDeHoje)}
            className="bg-erro absolute top-0 z-10 h-full w-0.5"
            style={{ left: `${posicaoDeHoje}%` }}
          />
        )}
      </div>
      <div
        data-testid="trilha-datas"
        className="text-micro text-muted-foreground mt-1 flex justify-between"
      >
        <span>
          <span className="sr-only">Início: </span>
          {formatarDiaCurto(primeiraFaixaDesenhada.inicio)}
        </span>
        <span>
          <span className="sr-only">Entrega: </span>
          {formatarDiaCurto(ultimoDiaDesenhado)}
        </span>
      </div>
    </div>
  );
}

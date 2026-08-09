import type {
  Cronograma,
  FaixaDeEtapa,
  Situacao,
  StatusDeEncomenda,
} from "@/lib/encomendas/cronograma";
import { formatarDiaCurto, formatarIntervalo } from "@/lib/encomendas/formato";
import { ROTULO_ETAPA, SELO_ATRASADA, SELO_RASCUNHO, textoDaSituacao } from "@/lib/encomendas/textos";

const TAMANHO_MARCADOR = 14;

export type TrilhaEtapasProps = {
  encomendaId: string;
  status: StatusDeEncomenda;
  cronograma: Cronograma;
  situacao: Situacao;
};

// A etapa que `situacaoEm` aponta como "hoje" — só os três ramos que de fato apontam uma etapa
// (em curso, em curso num marco, última etapa) recebem o selo/destaque; os demais nunca têm
// "HOJE" na trilha (03-UI-SPEC.md "Etapa de hoje — destaque"). A escolha de QUAL linha recebe o
// selo vem sempre de `situacaoEm` (D-15) — nunca de uma comparação de data refeita aqui.
function etapaDeHoje(situacao: Situacao): string | null {
  switch (situacao.tipo) {
    case "em-etapa-intervalo":
    case "em-etapa-marco":
    case "ultima-etapa":
      return situacao.etapa;
    default:
      return null;
  }
}

// "Desligada" no lugar das datas (dias: 0), data única para marco, "12 a 18 ago" para
// intervalo — o último dia mostrado é `ultimoDia` (o último dia que a etapa OCUPA), nunca
// `fimExclusivo` (o dia em que a próxima começa) — 00-BRIEFING.md §5.
function textoDeData(faixa: FaixaDeEtapa): string {
  if (faixa.dias === 0) {
    return "Desligada";
  }
  if (faixa.marco) {
    return formatarDiaCurto(faixa.inicio);
  }
  return formatarIntervalo(faixa.inicio, faixa.ultimoDia ?? faixa.inicio);
}

function Marcador({ marco, desligada, cor }: { marco: boolean; desligada: boolean; cor: string }) {
  const estiloComum = {
    width: TAMANHO_MARCADOR,
    height: TAMANHO_MARCADOR,
    backgroundColor: desligada ? "transparent" : cor,
    border: desligada ? `1.5px solid ${cor}` : undefined,
  };

  if (marco) {
    // Mesma técnica visual do Gantt (quadrado rotacionado 45°) — para quem já leu o Gantt
    // reconhecer de cara o mesmo símbolo aqui (03-UI-SPEC.md).
    return (
      <span
        aria-hidden="true"
        className="shrink-0 rounded-[2px]"
        style={{ ...estiloComum, transform: "rotate(45deg)" }}
      />
    );
  }

  return <span aria-hidden="true" className="shrink-0 rounded-full" style={estiloComum} />;
}

// Server Component de apresentação (D-04) — mesma implementação no desktop e no celular: coluna
// única, sem nada horizontal além da própria linha. Uma linha vertical conectora de 1px em
// `--color-borda-forte` atravessa as seis linhas — ela é NEUTRA (não usa cor de etapa); só o
// marcador de cada linha usa a cor. O ajuste rápido (Tarefa 2) e "Marcar como concluída"
// (Tarefa 3) entram aqui em ondas seguintes.
export function TrilhaEtapas({ status, cronograma, situacao }: TrilhaEtapasProps) {
  const etapaHoje = etapaDeHoje(situacao);
  const rascunho = status === "rascunho";
  const atrasada = situacao.tipo === "atrasada";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <p
          className={
            atrasada ? "text-corpo font-medium text-atencao" : "text-corpo text-tinta-media"
          }
        >
          {textoDaSituacao(situacao)}
        </p>
        {rascunho && (
          <span className="text-micro shrink-0 rounded border border-borda-forte bg-superficie-2 px-1.5 py-0.5 tracking-wide text-tinta-media uppercase">
            {SELO_RASCUNHO}
          </span>
        )}
        {atrasada && (
          <span className="text-micro shrink-0 rounded border border-atencao bg-atencao-fundo px-1.5 py-0.5 tracking-wide text-atencao uppercase">
            {SELO_ATRASADA}
          </span>
        )}
      </div>

      <ol className="flex flex-col" data-testid="trilha-etapas">
        {cronograma.faixas.map((faixa, indice) => {
          const desligada = faixa.dias === 0;
          const ehHoje = faixa.etapa === etapaHoje;
          const ehUltima = indice === cronograma.faixas.length - 1;
          const cor = `var(--color-${faixa.etapa})`;

          return (
            <li
              key={faixa.etapa}
              className="relative flex gap-4"
              data-testid={`trilha-linha-${faixa.etapa}`}
            >
              <div className="flex flex-col items-center pt-1">
                <Marcador marco={faixa.marco} desligada={desligada} cor={cor} />
                {!ehUltima && (
                  <div
                    aria-hidden="true"
                    className="mt-1 w-px flex-1"
                    style={
                      desligada
                        ? { borderLeft: "1px dashed var(--color-borda-forte)" }
                        : { backgroundColor: "var(--color-borda-forte)" }
                    }
                  />
                )}
              </div>

              <div
                className={`min-w-0 flex-1 rounded-md px-2 py-1.5 ${ehHoje ? "bg-superficie-2" : ""}`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className={`text-titulo ${desligada ? "text-tinta-fraca" : "text-tinta"}`}>
                    {ROTULO_ETAPA[faixa.etapa]}
                  </span>

                  <span className="flex items-center gap-2">
                    <span
                      className={`text-mono tabular-nums ${desligada ? "text-tinta-fraca" : "text-tinta-media"}`}
                    >
                      {textoDeData(faixa)}
                    </span>
                    {ehHoje && (
                      <span
                        data-testid="selo-hoje"
                        className="text-micro shrink-0 rounded bg-tinta px-1.5 py-0.5 tracking-wide text-white uppercase"
                      >
                        HOJE
                      </span>
                    )}
                  </span>
                </div>

                <div className="mt-1 flex items-center gap-4 pb-5">
                  <span className="text-apoio text-tinta-fraca">
                    {faixa.dias} dia{faixa.dias === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="border-border flex flex-wrap items-center justify-between gap-4 border-t pt-4">
        <p className="text-corpo text-tinta-media" data-testid="rodape-trilha">
          Duração total:{" "}
          <span className="text-mono tabular-nums font-medium text-tinta">
            {cronograma.duracaoTotalEmDias} dia{cronograma.duracaoTotalEmDias === 1 ? "" : "s"}
          </span>
          {cronograma.dataDeConclusao && (
            <>
              {" · Conclusão prevista: "}
              <span className="text-mono tabular-nums font-medium text-tinta">
                {formatarDiaCurto(cronograma.dataDeConclusao)}
              </span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

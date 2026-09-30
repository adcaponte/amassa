import {
  CHIP_ENTREGA_PARCIAL,
  textoDiasDoInicioAoFim,
  textoResultadoCancelada,
} from "@/lib/producao/textos";

// O resultado de uma ordem encerrada, no lugar das ações e da previsão (UI-SPEC §"Página da ordem").
// Nada aqui é editável — a ordem vale pelo que aconteceu.
//
// - CANCELADA (plano 06): caixa NEUTRA (`superficie-2`/`tinta-media`), nunca a verde da concluída:
//   cancelada não é sucesso, e o verde diria o contrário do que aconteceu (UI-SPEC §"Onde o
//   protótipo não vale mais").
// - CONCLUÍDA (plano 11): caixa `sucesso-fundo`/`sucesso` — uma linha por peça em Corpo 600 ("{peça}:
//   {e} entregues · {s} para o estoque · {d} sem destino · {p} perdidas de {f}", as linhas já
//   escritas no servidor), "{N} dias do início ao fim." em Apoio e o chip "Entrega parcial".
export type ResultadoDaOrdemProps = {
  resultado:
    | {
        tipo: "cancelada";
        // "dd/mm" já formatado no servidor (o dia de Brasília do `cancelada_em`).
        canceladaEmDiaMes: string;
        canceladaPorNome: string | null;
        // O número da venda quando a ordem caiu JUNTO com ela no Caixa (D-07); `null` quando
        // alguém cancelou a ordem pela Produção.
        pelaVendaNumero: number | null;
      }
    | {
        tipo: "concluida";
        linhas: string[];
        diasDoInicioAoFim: number;
        entregaParcial: boolean;
      };
};

export function ResultadoDaOrdem({ resultado }: ResultadoDaOrdemProps) {
  if (resultado.tipo === "concluida") {
    return (
      <div
        data-testid="ordem-resultado"
        data-resultado="concluida"
        className="bg-sucesso-fundo text-sucesso flex flex-col gap-2 rounded-md p-4 [overflow-wrap:anywhere]"
      >
        {resultado.entregaParcial ? (
          <span
            data-testid="ordem-entrega-parcial"
            // O mesmo chip da lista de Concluídas (`atencao`) — um desenho só para "Entrega parcial".
            className="text-apoio bg-atencao-fundo text-atencao inline-flex self-start rounded-full px-2 py-1 font-semibold whitespace-nowrap"
          >
            {CHIP_ENTREGA_PARCIAL}
          </span>
        ) : null}
        <ul className="flex flex-col gap-1">
          {resultado.linhas.map((linha, indice) => (
            <li key={indice} data-testid="ordem-resultado-peca" className="text-corpo font-semibold">
              {linha}
            </li>
          ))}
        </ul>
        <p data-testid="ordem-resultado-dias" className="text-apoio">
          {textoDiasDoInicioAoFim(resultado.diasDoInicioAoFim)}
        </p>
      </div>
    );
  }
  return (
    <div
      data-testid="ordem-resultado"
      data-resultado={resultado.tipo}
      className="bg-superficie-2 text-tinta-media text-corpo rounded-md p-4 [overflow-wrap:anywhere]"
    >
      <p>
        {textoResultadoCancelada({
          canceladaEmDiaMes: resultado.canceladaEmDiaMes,
          canceladaPorNome: resultado.canceladaPorNome,
          pelaVendaNumero: resultado.pelaVendaNumero,
        })}
      </p>
    </div>
  );
}

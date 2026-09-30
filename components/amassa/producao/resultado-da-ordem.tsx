import { textoResultadoCancelada } from "@/lib/producao/textos";

// O resultado de uma ordem encerrada, no lugar das ações e da previsão (UI-SPEC §"Página da ordem").
// Plano 06: o ramo da CANCELADA — caixa NEUTRA (`superficie-2`/`tinta-media`), nunca a verde da
// concluída: cancelada não é sucesso, e o verde diria o contrário do que aconteceu (UI-SPEC §"Onde o
// protótipo não vale mais"). O ramo da concluída chega com a conclusão (plano 11).
export type ResultadoDaOrdemProps = {
  resultado: {
    tipo: "cancelada";
    // "dd/mm" já formatado no servidor (o dia de Brasília do `cancelada_em`).
    canceladaEmDiaMes: string;
    canceladaPorNome: string | null;
    // O número da venda quando a ordem caiu JUNTO com ela no Caixa (D-07); `null` quando alguém
    // cancelou a ordem pela Produção.
    pelaVendaNumero: number | null;
  };
};

export function ResultadoDaOrdem({ resultado }: ResultadoDaOrdemProps) {
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

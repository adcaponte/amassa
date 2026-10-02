"use client";

import { useRef, type KeyboardEvent } from "react";

import { ROTULO_AREA } from "@/lib/financeiro/textos";
import { DESTINOS_DA_FOLHA_DO_ESTOQUE, type DestinoDeSaida } from "@/lib/estoque/destinos";
import { cn } from "@/lib/utils";

export type GradeDestinosProps = {
  destino: DestinoDeSaida | null;
  aoMudar: (destino: DestinoDeSaida | null) => void;
  // Ids do rótulo e da dica ("Para onde foi?" / "obrigatório — é o que diz qual área pagou").
  rotuloId: string;
  dicaId: string;
  invalida: boolean;
};

// "Para onde foi?" — os CINCO destinos da saída manual, SEMPRE na ordem de `DESTINOS_DA_FOLHA_DO_ESTOQUE`
// (EST-11 · ordering: uma constante, nunca reordenada na tela), cada um com a área que paga escrita
// embaixo (D-14). "Venda na loja" não existe (D-15): venda só nasce no Financeiro.
//
// Uma saída tem exatamente UM destino (EST-11 · adjacency): `role="radiogroup"` com
// `aria-required="true"`; tocar de novo no marcado desmarca (herdado do protótipo) — o `check` do
// banco exige destino em toda saída manual, e a folha avisa embaixo da grade se faltar. Setas do
// teclado movem a escolha, como no segmentado.
export function GradeDestinos({ destino, aoMudar, rotuloId, dicaId, invalida }: GradeDestinosProps) {
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);
  const indiceMarcado = DESTINOS_DA_FOLHA_DO_ESTOQUE.findIndex((opcao) => opcao.valor === destino);

  function aoTeclar(evento: KeyboardEvent<HTMLButtonElement>, indice: number) {
    const passo =
      evento.key === "ArrowRight" || evento.key === "ArrowDown"
        ? 1
        : evento.key === "ArrowLeft" || evento.key === "ArrowUp"
          ? -1
          : 0;
    if (passo === 0) {
      return;
    }
    evento.preventDefault();
    const total = DESTINOS_DA_FOLHA_DO_ESTOQUE.length;
    const proximo = (indice + passo + total) % total;
    aoMudar(DESTINOS_DA_FOLHA_DO_ESTOQUE[proximo].valor);
    botoes.current[proximo]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-required="true"
      aria-labelledby={rotuloId}
      aria-describedby={dicaId}
      aria-invalid={invalida}
      data-testid="folha-destinos"
      className="grid grid-cols-2 gap-2"
    >
      {DESTINOS_DA_FOLHA_DO_ESTOQUE.map((opcao, indice) => {
        const marcado = destino === opcao.valor;
        // Tabulação itinerante: o marcado recebe o Tab; sem nenhum marcado, o primeiro.
        const tabulavel = indiceMarcado === -1 ? indice === 0 : marcado;
        return (
          <button
            key={opcao.valor}
            ref={(elemento) => {
              botoes.current[indice] = elemento;
            }}
            type="button"
            role="radio"
            aria-checked={marcado}
            tabIndex={tabulavel ? 0 : -1}
            data-testid={`folha-destino-${opcao.valor}`}
            onClick={() => aoMudar(marcado ? null : opcao.valor)}
            onKeyDown={(evento) => aoTeclar(evento, indice)}
            className={cn(
              "flex min-h-[52px] flex-col items-start justify-center rounded-md border px-3 py-2 text-left focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
              marcado
                ? "bg-acento-fundo border-acento text-acento"
                : "bg-superficie border-borda-forte text-tinta",
            )}
          >
            <span className={cn("text-corpo leading-tight", marcado && "font-semibold")}>
              {opcao.rotulo}
            </span>
            <span className={cn("text-apoio", marcado ? "text-acento" : "text-tinta-fraca")}>
              {ROTULO_AREA[opcao.area]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

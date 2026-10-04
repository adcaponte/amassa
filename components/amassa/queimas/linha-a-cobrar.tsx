"use client";

import { ROTULO_RECEBI_AGORA } from "@/lib/agenda/textos";
import { formatarReais } from "@/lib/financeiro/formato";
import type { ItensDasQueimas, QueimaACobrar } from "@/lib/queimas/consultas";
import { precosDosItens, resumoPmg, valorDasExternas } from "@/lib/queimas/contagem";
import {
  FRASE_FALTA_PRECO,
  ariaRecebiAgora,
  linhaDaFalta,
  linhaJaLancado,
} from "@/lib/queimas/textos";
import { Button } from "@/components/ui/button";

export type LinhaACobrarProps = {
  linha: QueimaACobrar;
  // "Biscoito de 18/12" (+ " · {forno}" com mais de um forno — UI-D15), montado pela lista.
  titulo: string;
  itens: ItensDasQueimas;
  aoReceberAgora: (linha: QueimaACobrar) => void;
};

// Uma linha de "Queimas externas a cobrar" (06.4-UI-SPEC.md §"Índice"; QMC-07, D-07) — o molde
// `LinhaAReceber` da Agenda sem "Dispensar": grade `1fr auto`; título (Corpo 600) e o valor DO QUE FALTA
// (Σ falta × preço ATUAL do Catálogo — `valorDasExternas`, nenhum preço no código) na 1ª fileira; a falta
// por tamanho ("falta: 1 P · 2 M") na 2ª; depois uma linha de apoio por venda ATIVA ligada ("já lançado:
// venda nº 12 (2 P)"); e as ações na última. "Recebi agora" (`outline`, 44 px; a 320 px desce em largura
// total) abre a folha com o passo de quantidade. A linha some sozinha quando nada mais falta: quem decide
// é `listarACobrar`, pelas vendas ATIVAS.
export function LinhaACobrar({ linha, titulo, itens, aoReceberAgora }: LinhaACobrarProps) {
  const { valorCentavos } = valorDasExternas(linha.falta, precosDosItens(itens));
  const ativas = linha.vendas.filter((venda) => !venda.cancelada);
  const situacao = ativas.length > 0 ? "parcial" : "a_cobrar";
  const semPreco = valorCentavos === null;

  return (
    <li
      data-testid="a-cobrar-linha"
      data-queima-id={linha.queimaId}
      data-situacao={situacao}
      className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-1 py-2"
    >
      <span className="text-corpo text-tinta min-w-0 font-semibold [overflow-wrap:anywhere]">
        {titulo}
      </span>
      {semPreco ? (
        <span
          data-testid="a-cobrar-valor"
          className="text-apoio text-tinta-fraca whitespace-nowrap"
        >
          {FRASE_FALTA_PRECO}
        </span>
      ) : (
        <span
          data-testid="a-cobrar-valor"
          className="text-corpo text-tinta font-semibold whitespace-nowrap tabular-nums"
        >
          {formatarReais(valorCentavos)}
        </span>
      )}
      <span
        data-testid="a-cobrar-falta"
        className="text-apoio text-tinta-media col-span-2 min-w-0 [overflow-wrap:anywhere]"
      >
        {linhaDaFalta(resumoPmg(linha.falta.p, linha.falta.m, linha.falta.g))}
      </span>
      {ativas.map((venda) => (
        <span
          key={venda.documentoId}
          data-testid="a-cobrar-venda"
          data-documento-id={venda.documentoId}
          data-cancelada="false"
          className="text-apoio text-tinta-fraca col-span-2 min-w-0 [overflow-wrap:anywhere]"
        >
          {linhaJaLancado(
            venda.numero,
            resumoPmg(venda.quantidades.p, venda.quantidades.m, venda.quantidades.g),
          )}
        </span>
      ))}
      <div className="col-span-2 flex flex-wrap justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          data-testid="recebi-agora"
          aria-label={ariaRecebiAgora(titulo)}
          disabled={semPreco}
          onClick={() => aoReceberAgora(linha)}
          className="text-corpo h-auto min-h-[44px] px-4 font-semibold max-[359px]:w-full"
        >
          {ROTULO_RECEBI_AGORA}
        </Button>
      </div>
    </li>
  );
}

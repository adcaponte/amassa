"use client";

import { useId } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { ROTULO_LANCAR_NA_VENDA, ROTULO_RECEBI_AGORA, tagVendaCancelada } from "@/lib/agenda/textos";
import { hrefDaVendaComOrigem } from "@/lib/financeiro/navegacao";
import { formatarReais } from "@/lib/financeiro/formato";
import type { ItensDasQueimas, QueimaACobrar } from "@/lib/queimas/consultas";
import { precosDosItens, resumoPmg, valorDasExternas } from "@/lib/queimas/contagem";
import {
  FRASE_FALTA_PRECO,
  ROTULO_ABRIR_O_CATALOGO,
  ariaLancarNaVenda,
  ariaRecebiAgora,
  fraseSemPrecoDaQueima,
  linhaDaFalta,
  linhaJaLancado,
} from "@/lib/queimas/textos";
import { rotaDeGestao } from "@/lib/rotas/gestao";
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
// total) abre a folha com o passo de quantidade; “Lançar na Venda” (plano 05), ao lado e igual, abre a Venda
// do Financeiro com o que falta (as quantidades da Venda são o passo — UI-D30). A linha some sozinha quando nada mais falta: quem decide
// é `listarACobrar`, pelas vendas ATIVAS.
//
// Sem preço (AGE-17, UI-D5): se algum tamanho que AINDA FALTA não tem preço no Catálogo (nulo ou zero —
// uma venda de R$ 0,00 não nasce), o valor vira "falta preço", aparece o aviso com o nome ATUAL de cada
// item e o caminho até o Catálogo, e os dois botões ficam desabilitados com `aria-describedby` no aviso.
// Tamanho sem preço que já não falta não bloqueia. Contar continua livre.
export function LinhaACobrar({ linha, titulo, itens, aoReceberAgora }: LinhaACobrarProps) {
  const idDoAviso = useId();
  const { valorCentavos, tamanhosSemPreco } = valorDasExternas(linha.falta, precosDosItens(itens));
  const ativas = linha.vendas.filter((venda) => !venda.cancelada);
  const canceladas = linha.vendas.filter((venda) => venda.cancelada);
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
      {canceladas.length > 0 ? (
        // Venda cancelada no Caixa: a quantidade dela voltou para "a cobrar" (D-07, o princípio da D-08
        // da Agenda) — a tag diz por quê (molde `tag-venda-cancelada` da Agenda).
        <div className="col-span-2 flex flex-wrap gap-2">
          {canceladas.map((venda) => (
            <span
              key={venda.documentoId}
              data-testid="a-cobrar-venda"
              data-documento-id={venda.documentoId}
              data-cancelada="true"
              className="bg-atencao-fundo text-atencao text-apoio rounded-sm px-2 font-semibold whitespace-nowrap"
            >
              {tagVendaCancelada(venda.numero)}
            </span>
          ))}
        </div>
      ) : null}
      {semPreco ? (
        <div
          id={idDoAviso}
          role="status"
          data-testid="a-cobrar-sem-preco"
          className="bg-atencao-fundo text-atencao text-apoio col-span-2 flex items-start gap-2 rounded-md p-4 font-semibold"
        >
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <div className="flex min-w-0 flex-col items-start gap-1">
            <p className="[overflow-wrap:anywhere]">
              {fraseSemPrecoDaQueima(tamanhosSemPreco, {
                P: itens.P.nome,
                M: itens.M.nome,
                G: itens.G.nome,
              })}
            </p>
            <Link
              href={rotaDeGestao("/cadastros?sub=catalogo")}
              className="text-apoio text-acento focus-visible:ring-ring inline-flex min-h-[44px] items-center font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
            >
              {ROTULO_ABRIR_O_CATALOGO}
            </Link>
          </div>
        </div>
      ) : null}
      <div className="col-span-2 flex flex-wrap justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          data-testid="recebi-agora"
          aria-label={ariaRecebiAgora(titulo)}
          aria-describedby={semPreco ? idDoAviso : undefined}
          disabled={semPreco}
          onClick={() => aoReceberAgora(linha)}
          className="text-corpo h-auto min-h-[44px] px-4 font-semibold max-[359px]:w-full"
        >
          {ROTULO_RECEBI_AGORA}
        </Button>
        {semPreco ? (
          // Sem preço (UI-D5): um botão desabilitado, NUNCA um link — a Venda não abre com linha sem valor.
          <Button
            type="button"
            variant="outline"
            data-testid="lancar-na-venda"
            aria-label={ariaLancarNaVenda(titulo)}
            aria-describedby={idDoAviso}
            disabled
            className="text-corpo h-auto min-h-[44px] px-4 font-semibold max-[359px]:w-full"
          >
            {ROTULO_LANCAR_NA_VENDA}
          </Button>
        ) : (
          // “Lançar na Venda” (QMC-08, D-07): a Venda do Financeiro abre com o que FALTA, pessoa livre; o
          // navegador só diz QUAL queima — o resto é resolvido no servidor (mecanismo B da Agenda).
          <Button
            asChild
            variant="outline"
            className="text-corpo h-auto min-h-[44px] px-4 font-semibold max-[359px]:w-full"
          >
            <Link
              data-testid="lancar-na-venda"
              aria-label={ariaLancarNaVenda(titulo)}
              href={hrefDaVendaComOrigem({ tipo: "queima", id: linha.queimaId })}
            >
              {ROTULO_LANCAR_NA_VENDA}
            </Link>
          </Button>
        )}
      </div>
    </li>
  );
}

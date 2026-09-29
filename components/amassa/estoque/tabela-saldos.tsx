"use client";

import { ROTULO_UNIDADE } from "@/lib/cadastros/catalogo";
import { formatarReais } from "@/lib/financeiro/formato";
import { ROTULO_AREA } from "@/lib/financeiro/textos";
import type { SaldoDoItem } from "@/lib/estoque/consultas";
import { alertaDoItem } from "@/lib/estoque/saldo";
import {
  COLUNA_ACOES,
  COLUNA_AREA,
  COLUNA_CUSTO_MEDIO,
  COLUNA_MATERIAL,
  COLUNA_MINIMO,
  COLUNA_SALDO,
  COLUNA_VALOR,
  META_PECA_PRONTA,
  ROTULO_DAR_BAIXA,
  ROTULO_HISTORICO_DO_MATERIAL,
  SEM_MINIMO_NA_TABELA,
  rotuloHistoricoDe,
} from "@/lib/estoque/textos";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import {
  COR_DO_SALDO,
  ChipDoSaldo,
  PontoDaArea,
  formatarMilesimos,
  textoDoCustoMedio,
} from "./cartao-saldo";

export type TabelaSaldosProps = {
  saldos: readonly SaldoDoItem[];
  aoDarBaixa: (saldo: SaldoDoItem) => void;
  aoVerHistorico: (saldo: SaldoDoItem) => void;
};

const CABECALHO =
  "text-apoio text-tinta-fraca px-4 py-3 font-semibold tracking-[0.06em] uppercase";

// A tabela da aba Saldos a partir de 980px (UI-SPEC §Aba Saldos → Tabela; abaixo disso, cartões).
// Material · Área · Saldo · Mínimo · Custo médio · Valor · ações. Números à direita com
// `tabular-nums`; linha em alerta SEM fundo colorido — a cor fica no número e no chip. O painel tem
// `overflow-x-auto`: se a largura não couber, rola a TABELA, nunca a página (overflow E1).
//
// Cada linha repete os `data-testid` do cartão do traçador (`estoque-cartao`,
// `estoque-cartao-saldo`, `estoque-cartao-unidade`, `estoque-dar-baixa`): no desktop é ela que está
// visível, e os e2e de 06-01/06-03 continuam achando o material pelo mesmo nome.
export function TabelaSaldos({ saldos, aoDarBaixa, aoVerHistorico }: TabelaSaldosProps) {
  return (
    <div
      data-testid="estoque-tabela"
      className="bg-superficie border-borda hidden overflow-x-auto rounded-lg border min-[980px]:block"
    >
      <table className="text-corpo w-full min-w-[760px] border-collapse">
        <thead>
          <tr className="border-borda border-b">
            <th scope="col" className={cn(CABECALHO, "text-left")}>
              {COLUNA_MATERIAL}
            </th>
            <th scope="col" className={cn(CABECALHO, "text-left")}>
              {COLUNA_AREA}
            </th>
            <th scope="col" className={cn(CABECALHO, "text-right")}>
              {COLUNA_SALDO}
            </th>
            <th scope="col" className={cn(CABECALHO, "text-right")}>
              {COLUNA_MINIMO}
            </th>
            <th scope="col" className={cn(CABECALHO, "text-right")}>
              {COLUNA_CUSTO_MEDIO}
            </th>
            <th scope="col" className={cn(CABECALHO, "text-right")}>
              {COLUNA_VALOR}
            </th>
            <th scope="col" className={cn(CABECALHO, "text-right")}>
              <span className="sr-only">{COLUNA_ACOES}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {saldos.map((saldo) => {
            const alerta = alertaDoItem(saldo);
            const unidade = ROTULO_UNIDADE[saldo.unidade];
            const categoria = [saldo.categoriaCompraNome, saldo.ehPecaPronta ? META_PECA_PRONTA : null]
              .filter((parte): parte is string => Boolean(parte))
              .join(" · ");
            return (
              <tr
                key={saldo.id}
                data-testid="estoque-cartao"
                data-item-id={saldo.id}
                data-alerta={alerta}
                className="border-borda border-b align-top last:border-b-0"
              >
                <td className="px-4 py-3">
                  <div className="flex min-w-[12rem] flex-col items-start gap-1">
                    <span className="text-tinta font-semibold [overflow-wrap:anywhere]">
                      {saldo.nome}
                    </span>
                    <ChipDoSaldo saldo={saldo} />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-tinta flex items-center gap-1">
                    <PontoDaArea area={saldo.area} />
                    {ROTULO_AREA[saldo.area]}
                  </span>
                  {categoria ? (
                    <span className="text-apoio text-tinta-fraca block [overflow-wrap:anywhere]">
                      {categoria}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <span
                    data-testid="estoque-cartao-saldo"
                    className={cn("font-semibold tabular-nums", COR_DO_SALDO[alerta])}
                  >
                    {formatarMilesimos(saldo.saldoMilesimos)}
                  </span>{" "}
                  <span data-testid="estoque-cartao-unidade" className="text-apoio text-tinta-fraca">
                    {unidade}
                  </span>
                </td>
                <td className="text-tinta px-4 py-3 text-right whitespace-nowrap tabular-nums">
                  {saldo.estoqueMinimoMilesimos === 0
                    ? SEM_MINIMO_NA_TABELA
                    : `${formatarMilesimos(saldo.estoqueMinimoMilesimos)} ${unidade}`}
                </td>
                <td className="text-tinta px-4 py-3 text-right whitespace-nowrap tabular-nums">
                  {textoDoCustoMedio(saldo)}
                </td>
                <td className="text-tinta px-4 py-3 text-right font-semibold whitespace-nowrap tabular-nums">
                  {formatarReais(saldo.valorCentavos)}
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    {saldo.ativo ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="text-corpo min-h-[44px] px-4 font-semibold"
                        aria-label={`${ROTULO_DAR_BAIXA} em ${saldo.nome}`}
                        data-testid="estoque-dar-baixa"
                        onClick={() => aoDarBaixa(saldo)}
                      >
                        {ROTULO_DAR_BAIXA}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      className="text-corpo min-h-[44px] px-4 font-semibold"
                      aria-label={rotuloHistoricoDe(saldo.nome)}
                      data-testid="estoque-historico-material"
                      onClick={() => aoVerHistorico(saldo)}
                    >
                      {ROTULO_HISTORICO_DO_MATERIAL}
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

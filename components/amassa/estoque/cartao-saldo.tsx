"use client";

import { ROTULO_UNIDADE } from "@/lib/cadastros/catalogo";
import { formatarQuantidade } from "@/lib/financeiro/formato";
import type { SaldoDoItem } from "@/lib/estoque/consultas";
import { ROTULO_DAR_BAIXA } from "@/lib/estoque/textos";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// Milésimos inteiros → "3", "2,5", "−1" — pt-BR, até 3 casas, com o sinal de menos TIPOGRÁFICO
// ("−", não o hífen) quando negativo (UI-SPEC §Aba Saldos → Cartão). A divisão por 1000 só acontece
// aqui, na hora de MOSTRAR: a conta inteira do saldo é soma de inteiros no banco.
export function formatarMilesimos(milesimos: number): string {
  const absoluto = formatarQuantidade(String(Math.abs(milesimos) / 1000));
  return milesimos < 0 ? `−${absoluto}` : absoluto;
}

export type CartaoSaldoProps = {
  saldo: SaldoDoItem;
  aoDarBaixa: (saldo: SaldoDoItem) => void;
};

// O cartão da aba Saldos (UI-SPEC §"Estados e Comportamento → Aba Saldos (Cartão)") no caminho do
// traçador: nome, saldo em Display com a unidade embaixo, e "Dar baixa". O cartão inteiro NÃO é
// clicável — só o botão (evita toque acidental ao rolar com a mão suja). Material desativado não se
// movimenta (UI-D11): sem "Dar baixa". Os chips de alerta, a área, a categoria, o custo médio e o
// "Histórico" entram nos planos seguintes da fase.
export function CartaoSaldo({ saldo, aoDarBaixa }: CartaoSaldoProps) {
  const negativo = saldo.saldoMilesimos < 0;
  const unidade = ROTULO_UNIDADE[saldo.unidade];
  const meta =
    saldo.estoqueMinimoMilesimos > 0
      ? `mínimo ${formatarMilesimos(saldo.estoqueMinimoMilesimos)} ${unidade}`
      : "sem mínimo";

  return (
    <article
      data-testid="estoque-cartao"
      data-item-id={saldo.id}
      className={cn(
        "bg-superficie border-borda grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-lg border border-l-4 p-4",
        negativo ? "border-l-erro" : "border-l-borda",
      )}
    >
      <p className="text-corpo text-tinta min-w-0 font-semibold break-words">{saldo.nome}</p>
      <div className="row-span-2 text-right">
        <p
          data-testid="estoque-cartao-saldo"
          className={cn("text-display tabular-nums", negativo ? "text-erro" : "text-tinta")}
        >
          {formatarMilesimos(saldo.saldoMilesimos)}
        </p>
        <p data-testid="estoque-cartao-unidade" className="text-apoio text-tinta-fraca">
          {unidade}
        </p>
      </div>
      <p className="text-apoio text-tinta-fraca min-w-0 break-words">{meta}</p>

      <div className="col-span-2 mt-2 flex flex-wrap items-center gap-2">
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
        ) : (
          <span className="text-apoio bg-superficie-2 text-tinta-fraca rounded-full px-2 py-1 font-semibold">
            Desativado
          </span>
        )}
      </div>
    </article>
  );
}

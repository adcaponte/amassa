"use client";

import { ROTULO_CUSTOU_AO_TODO, ROTULO_TIRAR, textoRotuloQuantos } from "@/lib/financeiro/textos";
import { Input } from "@/components/ui/input";

function unidadeExibida(unidade: string): string {
  return unidade === "l" ? "L" : unidade;
}

export type LinhaDeCompra = {
  chave: string;
  nome: string;
  area: string;
  unidade: string;
  quantidadeEstoqueTexto: string;
  valorTotalTexto: string;
};

export type LinhaCompraProps = {
  linha: LinhaDeCompra;
  aoMudarQuantos: (chave: string, valor: string) => void;
  aoMudarCustou: (chave: string, valor: string) => void;
  aoTirar: (chave: string) => void;
};

// Uma linha da compra de material (04.4-07-PLAN.md): ponto de cor da área, nome, "quantos
// ({unidade})" e "custou ao todo" — sem passo de quantidade nem "cada" (diferente de
// `LinhaCarrinho`, a Venda): a compra grava quantidade 1 e o custo é sempre do TOTAL da linha.
export function LinhaCompra({ linha, aoMudarQuantos, aoMudarCustou, aoTirar }: LinhaCompraProps) {
  return (
    <li
      data-testid="compra-linha"
      className="border-border flex flex-col gap-2 rounded-md border px-3 py-2"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-corpo flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: `var(--color-area-${linha.area})` }}
          />
          <span className="truncate">{linha.nome}</span>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-apoio text-muted-foreground flex items-center gap-2">
          {textoRotuloQuantos(unidadeExibida(linha.unidade))}
          <Input
            data-testid="compra-quantos"
            inputMode="decimal"
            value={linha.quantidadeEstoqueTexto}
            onChange={(evento) => aoMudarQuantos(linha.chave, evento.target.value)}
            className="text-corpo min-h-[44px] w-24"
          />
        </label>

        <label className="text-apoio text-muted-foreground flex items-center gap-2">
          {ROTULO_CUSTOU_AO_TODO}
          <Input
            data-testid="compra-custou"
            inputMode="decimal"
            placeholder="R$"
            value={linha.valorTotalTexto}
            onChange={(evento) => aoMudarCustou(linha.chave, evento.target.value)}
            className="text-corpo min-h-[44px] w-28"
          />
        </label>

        <button
          type="button"
          onClick={() => aoTirar(linha.chave)}
          className="text-apoio text-muted-foreground hover:text-foreground ml-auto min-h-[44px] px-2"
        >
          {ROTULO_TIRAR}
        </button>
      </div>
    </li>
  );
}

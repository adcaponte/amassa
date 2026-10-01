"use client";

import type { LinhaAReceber as DadosDaLinha } from "@/lib/agenda/consultas";
import { ROTULO_RECEBI_AGORA, tagVendaCancelada } from "@/lib/agenda/textos";
import { formatarReais } from "@/lib/financeiro/formato";
import { Button } from "@/components/ui/button";

export type LinhaAReceberProps = {
  linha: DadosDaLinha;
  aoReceberAgora: (linha: DadosDaLinha) => void;
};

// Uma linha de “A receber” (05-UI-SPEC.md §“Aba A receber”, item 3; molde `.conta` do protótipo): grade
// `1fr auto` — nome (Corpo 600) e valor (Corpo 600, `tabular-nums`) na primeira fileira; a sub-linha e as
// tags (Apoio) na coluna inteira, quebrando sem empurrar o valor; e a fileira de ações (`flex-wrap`, gap
// 8px) com “Recebi agora” (`outline`, 44px — UI-D3: o terracota da tela é só o lote). “Lançar na Venda”
// entra no plano 12 e “Dispensar a cobrança” no 13. A 320px os botões da direita descem um embaixo do
// outro (largura total), nunca rolam de lado.
export function LinhaAReceber({ linha, aoReceberAgora }: LinhaAReceberProps) {
  return (
    <li
      data-testid="a-receber-linha"
      data-tipo={linha.tipo}
      data-id={linha.id}
      data-situacao={linha.situacao}
      className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 py-2"
    >
      <span data-testid="a-receber-nome" className="text-corpo text-tinta min-w-0 font-semibold [overflow-wrap:anywhere]">
        {linha.nome}
      </span>
      <span data-testid="a-receber-valor" className="text-corpo text-tinta font-semibold whitespace-nowrap tabular-nums">
        {formatarReais(linha.valorCentavos)}
      </span>
      <div className="text-apoio text-tinta-media col-span-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span data-testid="a-receber-sub" className="min-w-0 [overflow-wrap:anywhere]">
          {linha.subLinha}
        </span>
        {linha.situacao === "venda_cancelada" && linha.numeroDaVenda !== null ? (
          <span
            data-testid="tag-venda-cancelada"
            className="bg-atencao-fundo text-atencao rounded-sm px-2 font-semibold whitespace-nowrap"
          >
            {tagVendaCancelada(linha.numeroDaVenda)}
          </span>
        ) : null}
      </div>
      <div className="col-span-2 flex flex-wrap justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          data-testid="recebi-agora"
          onClick={() => aoReceberAgora(linha)}
          className="text-corpo h-auto min-h-[44px] px-4 font-semibold max-[359px]:w-full"
        >
          {ROTULO_RECEBI_AGORA}
        </Button>
      </div>
    </li>
  );
}

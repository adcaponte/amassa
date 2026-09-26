"use client";

import { formatarReais } from "@/lib/financeiro/formato";
import {
  ROTULO_CADA,
  ROTULO_MAIS_UM,
  ROTULO_MENOS_UM,
  ROTULO_TIRAR,
  textoEtiquetaDesconto,
  textoEtiquetaTabela,
} from "@/lib/financeiro/textos";
import { Input } from "@/components/ui/input";

export type LinhaDoCarrinho =
  | {
      chave: string;
      tipo: "item";
      nome: string;
      area: string;
      quantidade: number;
      valorUnitarioTexto: string;
      // Já convertido pelo pai (`converterReaisParaCentavos`) — `null` quando o texto está vazio
      // ou não é um valor válido, nunca uma segunda conversão aqui.
      valorUnitarioCentavos: number | null;
      // Valor FINAL da linha, já com a parte do desconto (D-09), se houver — o que aparece na
      // tela.
      subtotalCentavos: number;
      // quantidade × unitário, ANTES de qualquer desconto — comparado com `subtotalCentavos`
      // para saber se o desconto afetou esta linha.
      subtotalAntesDoDescontoCentavos: number;
      // `null` quando o item vende por "valor na hora" — nunca mostra a etiqueta "tabela".
      precoDeTabelaCentavos: number | null;
    }
  | {
      chave: string;
      tipo: "livre";
      nome: string;
      area: string;
      subtotalCentavos: number;
      subtotalAntesDoDescontoCentavos: number;
    };

export type LinhaCarrinhoProps = {
  linha: LinhaDoCarrinho;
  aoMudarQuantidade: (chave: string, delta: 1 | -1) => void;
  aoMudarValorUnitario: (chave: string, valor: string) => void;
  aoTirar: (chave: string) => void;
};

// Uma linha do carrinho da Venda — ponto de cor da área, nome, subtotal, e (só para item do
// catálogo) o passo de quantidade e o "cada" editável. DUAS etiquetas, um mecanismo visual só
// (a MESMA pílula, os mesmos tokens), um texto por MOTIVO — separação feita em 04.4-13-PLAN.md
// (Tarefa 2) porque a etiqueta unificada escondia dois problemas reais achados na conferência do
// dono de 26/09/2026 (item 11): "tabela R$ 153,00" numa linha de valor livre não fala de desconto
// nenhum, e um item de "valor na hora" atingido pelo desconto não mostrava etiqueta alguma.
// - "tabela R$ X" (etiqueta de preço de tabela, único identificador de teste do gênero neste
//   arquivo) significa SÓ isto: o preço UNITÁRIO desta linha (editado à mão) difere do preço de
//   tabela do catálogo. Não reage mais ao desconto.
// - "− R$ X de desconto" (`venda-linha-desconto`) aparece em QUALQUER tipo de linha (item comum,
//   item de "valor na hora" sem preço de tabela, valor livre) sempre que o desconto (D-09) tirou
//   uma parte positiva do subtotal desta linha. Quando os dois motivos valem na mesma linha
//   (preço editado E desconto), as DUAS etiquetas aparecem, nesta ordem.
export function LinhaCarrinho({
  linha,
  aoMudarQuantidade,
  aoMudarValorUnitario,
  aoTirar,
}: LinhaCarrinhoProps) {
  const diferencaDoDescontoCentavos =
    linha.subtotalAntesDoDescontoCentavos - linha.subtotalCentavos;
  const afetadaPeloDesconto = diferencaDoDescontoCentavos > 0;

  const valorDaTabelaDiferente =
    linha.tipo === "item" &&
    linha.precoDeTabelaCentavos != null &&
    linha.precoDeTabelaCentavos !== linha.valorUnitarioCentavos;

  return (
    <li
      data-testid="venda-linha"
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
        <span className="text-corpo tabular-nums">{formatarReais(linha.subtotalCentavos)}</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {linha.tipo === "item" && (
          <>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={ROTULO_MENOS_UM}
                onClick={() => aoMudarQuantidade(linha.chave, -1)}
                className="border-border flex h-11 w-11 items-center justify-center rounded-md border text-lg"
              >
                −
              </button>
              <output
                data-testid="venda-linha-quantidade"
                className="text-corpo min-w-6 text-center tabular-nums"
              >
                {linha.quantidade}
              </output>
              <button
                type="button"
                aria-label={ROTULO_MAIS_UM}
                onClick={() => aoMudarQuantidade(linha.chave, 1)}
                className="border-border flex h-11 w-11 items-center justify-center rounded-md border text-lg"
              >
                +
              </button>
            </div>

            <label className="text-apoio text-muted-foreground flex items-center gap-2">
              {ROTULO_CADA}
              <Input
                inputMode="decimal"
                value={linha.valorUnitarioTexto}
                placeholder="R$"
                onChange={(evento) => aoMudarValorUnitario(linha.chave, evento.target.value)}
                className="text-corpo min-h-[44px] w-24"
              />
            </label>

            {valorDaTabelaDiferente && linha.precoDeTabelaCentavos != null && (
              <span
                data-testid="venda-linha-tabela"
                className="bg-secondary text-secondary-foreground text-apoio rounded-full px-2 py-0.5"
              >
                {textoEtiquetaTabela(formatarReais(linha.precoDeTabelaCentavos))}
              </span>
            )}

            {afetadaPeloDesconto && (
              <span
                data-testid="venda-linha-desconto"
                className="bg-secondary text-secondary-foreground text-apoio rounded-full px-2 py-0.5"
              >
                {textoEtiquetaDesconto(formatarReais(diferencaDoDescontoCentavos))}
              </span>
            )}
          </>
        )}

        {linha.tipo === "livre" && afetadaPeloDesconto && (
          <span
            data-testid="venda-linha-desconto"
            className="bg-secondary text-secondary-foreground text-apoio rounded-full px-2 py-0.5"
          >
            {textoEtiquetaDesconto(formatarReais(diferencaDoDescontoCentavos))}
          </span>
        )}

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

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// Peça comum 1 da Fase 06.5 (D-08, causa nº 1 do celular; POL-01; 06.5-UI-SPEC.md §"Peça comum 1").
//
// O defeito que ela resolve: a linha do extrato e a da conta fixa eram uma fileira `flex-wrap` com o
// nome `min-w-0 flex-1 truncate` — a 320 px o valor, a data e o botão comiam a largura e o nome
// virava "2×…" ou quebrava em "Alugu / el" (achados 4 e 6 do Cowork). Aqui o título tem uma fileira
// SÓ DELE, em largura toda, e quebra onde precisar (`[overflow-wrap:anywhere]`) — nunca `truncate`.
//
// A régua é a LARGURA DO CONTÊINER, não a da tela (UI-D1): a Caixa põe "A pagar" e "A receber" lado a
// lado a partir de 768 px, colunas mais estreitas que um celular. Quem usa esta peça põe `@container`
// na `<ul>` pai; `@sm` = 384 px de contêiner.
//
// - Abaixo de `@sm`: fileira 1 = título sozinho; fileira 2 = meta à esquerda e valor à direita
//   (`1fr | auto`, `gap-x-4`); fileira 3 = extra; fileira 4 = ações (`flex flex-wrap gap-2`).
// - A partir de `@sm`: `grid-cols-[1fr_auto]` — título, meta e extra empilhados à esquerda; valor e
//   ações à direita, alinhados ao topo.
//
// Como uma árvore só vira as duas formas: as duas colunas são `div`s `contents` abaixo de `@sm` (os
// filhos viram itens da grade da linha, ordenados por `order`) e `flex flex-col` a partir de `@sm`.
// A ordem de leitura do DOM (título, meta, extra, valor, ações) só difere da visual no celular, onde o
// valor sobe para a fileira da meta.

export type VarianteDaLinhaDeRegistro = "extrato" | "conta-fixa";

export type LinhaDeRegistroProps = {
  titulo: ReactNode;
  valor?: ReactNode;
  meta?: ReactNode;
  extra?: ReactNode;
  acoes?: ReactNode;
  variante: VarianteDaLinhaDeRegistro;
  // Linha cancelada (extrato) ou desativada (conta fixa): o título riscado e em `tinta-fraca`, como
  // já era. Sem `opacity` — diluiria o `tinta-fraca` abaixo da AA (WCAG 1.4.3; ver a nota em
  // `cadastros/lista-contas-fixas.tsx`).
  riscada?: boolean;
  // O testid que a linha já tinha (`extrato-linha`, `conta-fixa-linha`) — continua na raiz; o
  // `linha-registro` comum fica no elemento interno da grade.
  dataTestId?: string;
};

export function LinhaDeRegistro({
  titulo,
  valor,
  meta,
  extra,
  acoes,
  variante,
  riscada = false,
  dataTestId,
}: LinhaDeRegistroProps) {
  return (
    <li data-testid={dataTestId} className="border-border rounded-md border px-4 py-2">
      <div
        data-testid="linha-registro"
        data-variante={variante}
        className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 @sm:items-start"
      >
        <div className="contents @sm:flex @sm:min-w-0 @sm:flex-col @sm:gap-y-1">
          {/* `span` (bloco), não `div`: os e2e das Contas fixas acham o nome por `locator("span", { hasText })`
              e conferem o `line-through` nele. */}
          <span
            data-testid="linha-registro-titulo"
            className={cn(
              "text-corpo text-foreground order-1 col-span-2 block min-w-0 [overflow-wrap:anywhere]",
              riscada && "text-muted-foreground line-through",
            )}
          >
            {titulo}
          </span>
          {meta != null && (
            <div className="text-apoio text-muted-foreground order-2 col-start-1 min-w-0 [overflow-wrap:anywhere]">
              {meta}
            </div>
          )}
          {extra != null && (
            <div className="text-apoio text-muted-foreground order-4 col-span-2 min-w-0 [overflow-wrap:anywhere]">
              {extra}
            </div>
          )}
        </div>

        <div className="contents @sm:flex @sm:flex-col @sm:items-end @sm:gap-y-1">
          {valor != null && (
            <div
              data-testid="linha-registro-valor"
              className="text-corpo order-3 col-start-2 justify-self-end text-right whitespace-nowrap tabular-nums"
            >
              {valor}
            </div>
          )}
          {acoes != null && (
            <div
              className={cn(
                "order-5 col-span-2 flex flex-wrap items-center gap-2",
                variante === "conta-fixa" ? "justify-between @sm:justify-end" : "justify-end",
              )}
            >
              {acoes}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

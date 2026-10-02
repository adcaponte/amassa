"use client";

import type { LoteDeMensalidades as DadosDoLote } from "@/lib/agenda/receber";
import { nomeDoMes } from "@/lib/agenda/semana";
import { ARIA_LISTA_DO_LOTE, DICA_DO_LOTE, linhaDoLote, resumoDoLote } from "@/lib/agenda/textos";
import { formatarReais } from "@/lib/financeiro/formato";

import { ConfirmarLancarLote } from "./confirmar-lancar-lote";

export type LoteDeMensalidadesProps = {
  lote: DadosDoLote;
};

// A sanfona do lote no topo de “A receber” (05-UI-SPEC.md §“Aba A receber”, item 2; AGE-16; UI-D3): só
// existe com mensalidade livre — sem ela, a aba fica sem primário. `<details open>` com a borda tracejada
// `borda-forte`, o `summary` de 44px, a lista “{nome} · {turma} · {mês} · {R$}” (+ “ (proporcional)”) que
// quebra sem estourar a borda e SEM rolagem interna (com 40 linhas a página rola, e o botão continua no fim
// da lista), o botão primário — o ÚNICO terracota da aba — com o total exato, e a dica. Um toque abre a
// confirmação (decisão do dono, 02/10/2026); só o confirmar cria as vendas — uma por mensalidade, com a
// parcela em aberto. O “Lançando…”, o `useRef` contra o toque duplo e a frase de erro moram no diálogo
// (`ConfirmarLancarLote`). A ação revalida a Agenda: a sanfona some sozinha quando nada mais fica livre.
export function LoteDeMensalidades({ lote }: LoteDeMensalidadesProps) {
  if (lote.quantas === 0) {
    return null;
  }

  return (
    <details
      open
      data-testid="lote-mensalidades"
      className="border-borda-forte rounded-md border border-dashed px-4 py-2"
    >
      <summary
        data-testid="lote-resumo"
        className="text-apoio text-tinta flex min-h-[44px] cursor-pointer items-center font-semibold [overflow-wrap:anywhere]"
      >
        {resumoDoLote(lote.quantas)}
      </summary>
      <div className="flex flex-col gap-3 pt-2 pb-2">
        <ul aria-label={ARIA_LISTA_DO_LOTE} className="text-apoio text-tinta-media flex flex-col gap-1">
          {lote.linhas.map((linha) => (
            <li
              key={linha.id}
              data-testid="lote-linha"
              data-id={linha.id}
              className="min-w-0 [overflow-wrap:anywhere]"
            >
              {linhaDoLote(
                linha.nome,
                linha.turma,
                nomeDoMes(linha.mes),
                formatarReais(linha.valorCentavos),
                linha.proporcional,
              )}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ConfirmarLancarLote
            ids={lote.linhas.map((linha) => linha.id)}
            quantas={lote.quantas}
            total={formatarReais(lote.totalCentavos)}
          />
        </div>
        <p className="text-apoio text-tinta-fraca">{DICA_DO_LOTE}</p>
      </div>
    </details>
  );
}

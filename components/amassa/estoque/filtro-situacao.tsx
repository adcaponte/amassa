"use client";

import type { FiltroDeSituacao } from "@/lib/estoque/saldo";
import {
  ROTULO_FILTRAR_POR_SITUACAO,
  ROTULO_FILTRO_ATIVOS,
  ROTULO_FILTRO_DESATIVADOS,
  ROTULO_FILTRO_TODOS,
} from "@/lib/estoque/textos";
import { cn } from "@/lib/utils";

export type FiltroSituacaoProps = {
  filtro: FiltroDeSituacao;
  aoMudarFiltro: (valor: FiltroDeSituacao) => void;
};

const OPCOES: { valor: FiltroDeSituacao; rotulo: string }[] = [
  { valor: "ativos", rotulo: ROTULO_FILTRO_ATIVOS },
  { valor: "desativados", rotulo: ROTULO_FILTRO_DESATIVADOS },
  { valor: "todos", rotulo: ROTULO_FILTRO_TODOS },
];

// Ativos · Desativados · Todos (D-20) — cópia estrutural de `queimas/filtro-fornos.tsx`, no FIM da
// lista, antes da nota de rodapé (UI-D4: desativado é consulta rara; o topo fica para o material
// do dia). Componente burro: quem filtra é a `AbaSaldos`, por `filtrarSaldos`. O estado marcado é
// fundo + borda + peso 600 — nunca só cor (UI-SPEC §Typography: 400 desmarcado, 600 marcado).
export function FiltroSituacao({ filtro, aoMudarFiltro }: FiltroSituacaoProps) {
  return (
    <div
      role="radiogroup"
      aria-label={ROTULO_FILTRAR_POR_SITUACAO}
      className="flex flex-wrap gap-2"
      data-testid="estoque-filtro-situacao"
    >
      {OPCOES.map((opcao) => {
        const selecionado = opcao.valor === filtro;
        return (
          <button
            key={opcao.valor}
            type="button"
            role="radio"
            aria-checked={selecionado}
            onClick={() => aoMudarFiltro(opcao.valor)}
            data-testid={`estoque-filtro-situacao-${opcao.valor}`}
            className={cn(
              "text-apoio focus-visible:ring-ring min-h-[44px] rounded-full border px-4 py-2 transition-colors focus-visible:ring-2 focus-visible:outline-none",
              selecionado
                ? "border-tinta bg-superficie-2 text-tinta font-semibold"
                : "border-borda bg-superficie text-tinta-fraca hover:bg-superficie-2 font-normal",
            )}
          >
            {opcao.rotulo}
          </button>
        );
      })}
    </div>
  );
}

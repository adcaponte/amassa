"use client";

import type { FiltroDeForno } from "@/lib/queimas/filtros";
import {
  ROTULO_FILTRO_ATIVOS,
  ROTULO_FILTRO_DESATIVADOS,
  ROTULO_FILTRO_TODOS,
} from "@/lib/queimas/textos";

export type FiltroFornosProps = {
  filtro: FiltroDeForno;
  aoMudarFiltro: (valor: FiltroDeForno) => void;
};

const OPCOES: { valor: FiltroDeForno; rotulo: string }[] = [
  { valor: "ativos", rotulo: ROTULO_FILTRO_ATIVOS },
  { valor: "desativados", rotulo: ROTULO_FILTRO_DESATIVADOS },
  { valor: "todos", rotulo: ROTULO_FILTRO_TODOS },
];

// D-05: o seletor discreto Ativos/Desativados/Todos do índice de `/queimas` — a consequência
// aceita de D-02 (sem tela de cadastro, este é o ÚNICO caminho que responde "quais fornos o
// ateliê tem, incluindo os desativados"). Mesmo mecanismo do histórico de Encomendas (D-07 da
// Fase 3), estritamente mais simples: sem busca, sem ordenação — só três posições.
//
// Componente burro: recebe estado + manipulador de `lista-fornos.tsx`, nunca chama
// `filtrarPorAtivo` por conta própria (mesma disciplina de `filtro-encomendas.tsx`).
// `role="radiogroup"`/`role="radio"` + `aria-checked` fazem o estado ativo perceptível ao leitor
// de tela; visualmente, o estado ativo usa fundo + borda (nunca só cor de texto), então não
// depende de percepção de cor para ser lido.
export function FiltroFornos({ filtro, aoMudarFiltro }: FiltroFornosProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Filtrar fornos por estado"
      className="flex flex-wrap gap-2 px-6 md:px-8"
      data-testid="filtro-fornos"
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
            data-testid={`filtro-fornos-${opcao.valor}`}
            className={
              "text-apoio focus-visible:ring-ring min-h-[44px] rounded-full border px-4 py-2 font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none " +
              (selecionado
                ? "border-tinta bg-superficie-2 text-tinta"
                : "border-borda bg-superficie text-tinta-fraca hover:bg-superficie-2")
            }
          >
            {opcao.rotulo}
          </button>
        );
      })}
    </div>
  );
}

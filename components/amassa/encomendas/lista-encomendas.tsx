"use client";

import type { Cronograma, Situacao, StatusDeEncomenda } from "@/lib/encomendas/cronograma";

import { Gantt } from "./gantt";

// A casca cliente do índice — nasce Client Component porque o plano 07 põe filtro/busca/
// ordenação dentro dela (D-11); os planos 06 e 07 modificam este arquivo de novo. Nesta onda,
// sem estado nenhum ainda: só a alternância Gantt/lista por CSS (D-02).
export type EncomendaDoIndice = {
  id: string;
  nome: string;
  clienteNome: string | null;
  status: StatusDeEncomenda;
  dataInicio: string;
  cronograma: Cronograma;
  situacao: Situacao;
};

export type ListaEncomendasProps = {
  encomendas: EncomendaDoIndice[];
  hoje: string;
};

// Recebe a lista completa (já ordenada por `ordenarParaGantt` no Server Component) por props.
// Renderiza as duas metades — Gantt (desktop) e cartões (celular) — SEMPRE as duas no HTML,
// uma escondida por CSS (`hidden md:block` / `md:hidden`, D-02). Nunca o hook de detecção de
// dispositivo que veio com o Sidebar do shadcn (`hooks/` + o arquivo de detecção de largura de
// tela) — ele existe no projeto e seria o erro fácil de cometer aqui.
export function ListaEncomendas({ encomendas, hoje }: ListaEncomendasProps) {
  return (
    <div className="px-6 py-6 md:px-8">
      <div className="hidden md:block">
        <Gantt encomendas={encomendas} hoje={hoje} />
      </div>

      {/* Metade do celular — marcador simples nesta tarefa; a Tarefa 2 substitui por
          `CartaoEncomenda` com a trilha de 6 segmentos e o texto de situação. */}
      <ul className="flex flex-col gap-3 md:hidden">
        {encomendas.map((encomenda) => (
          <li
            key={encomenda.id}
            className="rounded-xl border border-border bg-card p-4"
            data-testid={`lista-item-${encomenda.id}`}
          >
            <span className="text-titulo text-foreground">{encomenda.nome}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

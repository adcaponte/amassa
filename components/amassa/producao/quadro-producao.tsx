import type { OrdemEmAndamento } from "@/lib/producao/consultas";
import { rotuloDaColuna, type EtapaProducao } from "@/lib/producao/etapas";
import type { LeituraDaOrdem, Selo } from "@/lib/producao/leitura";
import { SR_COLUNA_VAZIA, textoCabecalhoDaColuna } from "@/lib/producao/textos";
import { cn } from "@/lib/utils";

import { CartaoOrdem } from "./cartao-ordem";

export type OrdemNoQuadro = {
  ordem: OrdemEmAndamento;
  leitura: Extract<LeituraDaOrdem, { tipo: "em-andamento" }>;
  selo: Selo;
};

export type ColunaNoQuadro = { etapa: EtapaProducao; ordens: OrdemNoQuadro[] };

// O ponto de 8px da etapa (decorativo, `aria-hidden`): `var(--color-{etapa})`, os tokens "NÃO
// ALTERAR" de `app/globals.css`. A secagem ganha contorno `tinta-fraca` (UI-D13) — o token dela é
// claro demais para aparecer sozinho sobre o fundo da coluna.
export function PontoDaEtapa({ etapa, className }: { etapa: EtapaProducao; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        etapa === "secagem" && "border-tinta-fraca border",
        className,
      )}
      style={{ backgroundColor: `var(--color-${etapa})` }}
    />
  );
}

// O quadro por etapa (UI-SPEC §"Quadro por etapa"): seis `<section>` em ordem fixa — empilhadas
// abaixo de 768px, grade 3 × 2 entre 768 e 1279px, seis colunas a partir de 1280px (UI-D2). As
// colunas chegam prontas (`colunasDoQuadro`, módulo puro); aqui só se desenha.
export function QuadroProducao({ colunas }: { colunas: readonly ColunaNoQuadro[] }) {
  return (
    <div
      data-testid="producao-quadro"
      className="grid grid-cols-1 items-start gap-4 md:grid-cols-3 xl:grid-cols-6"
    >
      {colunas.map((coluna) => {
        const rotulo = rotuloDaColuna(coluna.etapa);
        return (
          <section
            key={coluna.etapa}
            data-testid={`producao-coluna-${coluna.etapa}`}
            aria-labelledby={`producao-coluna-${coluna.etapa}-titulo`}
            className="bg-superficie-2 flex min-w-0 flex-col gap-2 rounded-lg p-4 xl:p-3"
          >
            <h2
              id={`producao-coluna-${coluna.etapa}-titulo`}
              aria-label={textoCabecalhoDaColuna(rotulo, coluna.ordens.length)}
              className="text-apoio text-tinta-media flex items-center gap-2 font-semibold uppercase"
            >
              <PontoDaEtapa etapa={coluna.etapa} />
              <span className="min-w-0 flex-1">{rotulo}</span>
              <span className="bg-superficie rounded-full px-2 tabular-nums">
                {coluna.ordens.length}
              </span>
            </h2>
            {coluna.ordens.length === 0 ? (
              <p className="text-apoio text-tinta-fraca">
                <span aria-hidden="true">—</span>
                <span className="sr-only">{SR_COLUNA_VAZIA}</span>
              </p>
            ) : (
              coluna.ordens.map((item) => (
                <CartaoOrdem
                  key={item.ordem.id}
                  ordem={item.ordem}
                  leitura={item.leitura}
                  selo={item.selo}
                />
              ))
            )}
          </section>
        );
      })}
    </div>
  );
}

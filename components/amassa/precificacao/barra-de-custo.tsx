import type { ChaveDaFatiaDeCusto, FatiaDoCusto } from "@/lib/precificacao/ficha";
import { formatarReais } from "@/lib/financeiro/formato";

// Os cinco tokens novos de cor (04.5-UI-SPEC.md §Color, "parcelas do custo") — uso SEMPRE
// decorativo (segmento de barra, ponto de legenda de 9px), nunca cor de texto corrido. Coincidem
// em hex com `--color-area-*` por herança do mesmo protótipo-fonte — tokens novos e
// independentes, não "consertar" a coincidência. Sintaxe de propriedade arbitrária do Tailwind v4
// (referenciando a variável CSS entre colchetes) em vez do utilitário automático — deixa o nome
// completo do token literal na classe, inclusive para quem procurar por ele depois.
const CLASSE_DE_FUNDO: Record<ChaveDaFatiaDeCusto, string> = {
  material: "bg-[--color-custo-material]",
  trabalho: "bg-[--color-custo-trabalho]",
  queima: "bg-[--color-custo-queima]",
  embalagem: "bg-[--color-custo-embalagem]",
  perda: "bg-[--color-custo-perda]",
};

const ROTULO_DA_FATIA: Record<ChaveDaFatiaDeCusto, string> = {
  material: "Material",
  trabalho: "Trabalho",
  queima: "Queimas",
  embalagem: "Embalagem",
  perda: "Perda",
};

export type BarraDeCustoProps = {
  fatias: readonly FatiaDoCusto[];
  custoCentavos: number;
};

// A barra "De onde vem o custo" — o argumento visual de por que o preço é aquele número
// (04.5-UI-SPEC.md §Foco Visual). Puramente apresentação: as fatias já vêm calculadas de
// `resultadoDaFicha` (lib/precificacao/ficha.ts), nenhuma aritmética de preço aqui.
export function BarraDeCusto({ fatias, custoCentavos }: BarraDeCustoProps) {
  return (
    <div data-testid="ficha-barra-custo" className="flex flex-col gap-2">
      <div className="border-border flex h-3 w-full overflow-hidden rounded-full border">
        {fatias.map((fatia) => (
          <span
            key={fatia.chave}
            className={CLASSE_DE_FUNDO[fatia.chave]}
            style={{
              width: custoCentavos > 0 ? `${(fatia.centavos / custoCentavos) * 100}%` : 0,
            }}
            title={ROTULO_DA_FATIA[fatia.chave]}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {fatias.map((fatia) => (
          <li key={fatia.chave} className="text-apoio text-muted-foreground flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={`inline-block size-[9px] shrink-0 rounded-full ${CLASSE_DE_FUNDO[fatia.chave]}`}
            />
            {ROTULO_DA_FATIA[fatia.chave]}
            <span className="tabular-nums">{formatarReais(fatia.centavos)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

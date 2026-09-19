"use client";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export type ModoDeDesconto = "reais" | "percentual";

export type CampoDescontoProps = {
  modo: ModoDeDesconto;
  aoMudarModo: (modo: ModoDeDesconto) => void;
  texto: string;
  aoMudarTexto: (texto: string) => void;
  erro: string | null;
};

// "Desconto" logo abaixo do Total da Venda (D-09/D-10) — par de pílulas "R$"/"%" (mesmo visual
// das pílulas de filtro/forma) e um campo de 44px/16px. A recusa da função pura
// (`lib/financeiro/desconto.ts::repartirDesconto`) aparece aqui como a mensagem de erro; nunca
// um segundo texto inventado pelo componente.
export function CampoDesconto({ modo, aoMudarModo, texto, aoMudarTexto, erro }: CampoDescontoProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-apoio text-muted-foreground">Desconto</span>
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          <button
            type="button"
            aria-pressed={modo === "reais"}
            onClick={() => aoMudarModo("reais")}
            className={cn(
              "text-apoio min-h-[44px] rounded-md border px-3 font-medium",
              modo === "reais"
                ? "border-primary bg-accent text-accent-foreground"
                : "border-border bg-secondary text-secondary-foreground",
            )}
          >
            R$
          </button>
          <button
            type="button"
            aria-pressed={modo === "percentual"}
            onClick={() => aoMudarModo("percentual")}
            className={cn(
              "text-apoio min-h-[44px] rounded-md border px-3 font-medium",
              modo === "percentual"
                ? "border-primary bg-accent text-accent-foreground"
                : "border-border bg-secondary text-secondary-foreground",
            )}
          >
            %
          </button>
        </div>
        <Input
          data-testid="venda-desconto"
          inputMode="decimal"
          value={texto}
          onChange={(evento) => aoMudarTexto(evento.target.value)}
          placeholder="0"
          className="text-corpo min-h-[44px] w-28"
        />
      </div>
      {erro && (
        <p role="alert" aria-live="assertive" className="text-apoio text-destructive">
          {erro}
        </p>
      )}
    </div>
  );
}

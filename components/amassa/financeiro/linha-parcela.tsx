"use client";

import { ROTULO_FORMA, ROTULO_TIRAR, type FormaDePagamento } from "@/lib/financeiro/textos";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

const FORMAS_EM_ORDEM: readonly FormaDePagamento[] = ["dinheiro", "pix", "cartao"];

export type LinhaParcelaProps = {
  numero: number;
  de: number;
  valorTexto: string;
  aoMudarValor: (valor: string) => void;
  // Desde o 04.4-12-PLAN.md, a data é passada sempre que a linha NÃO é uma parcela à vista já
  // paga — inclusive no modo "duas formas" (D-08), quando aquela linha está em aberto; some só
  // quando o vencimento seria, por definição, a própria data do documento.
  vencimento?: string;
  aoMudarVencimento?: (valor: string) => void;
  // Sempre passada desde o 04.4-12-PLAN.md — inclusive no modo "duas formas", onde cada linha
  // ganha a própria caixa de marcação.
  pago?: boolean;
  aoMudarPago?: (valor: boolean) => void;
  rotuloPago?: string;
  // Presente só no modo "duas formas" (D-07/D-08): cada linha tem a própria forma e pode ser
  // tirada, voltando a uma forma só.
  forma?: FormaDePagamento;
  aoMudarForma?: (forma: FormaDePagamento) => void;
  aoTirar?: () => void;
};

// Uma linha do plano de pagamento (04.4-06-PLAN.md, 04.4-12-PLAN.md): "k/N", valor, "já
// recebi/paguei" e — conforme o modo — data (Nx/sinal, ou duas formas do à vista quando aquela
// linha está em aberto) e/ou forma + "tirar" (duas formas do à vista, D-08). Desde o 04.4-12, a
// caixa de marcação é passada SEMPRE, inclusive no modo de duas formas — cada linha tem a própria
// (dividir semeia as duas com a intenção atual do à vista, e depois elas são independentes); só a
// DATA some numa linha à vista já paga, que por definição vence na data do documento. As colunas
// encolhem (`flex-wrap`, `min-w-0`) para caber a 320px sem rolar a página horizontalmente
// (04.4-UI-SPEC.md). A caixa de marcação é `<input type="checkbox">` NATIVO — a zona de toque de
// 44×44 é o `<span>` externo que a envolve, mesma disciplina de `marcar-cotacao.tsx` (04.3-04): um
// alvo de verdade, não um hit-slop invisível.
export function LinhaParcela({
  numero,
  de,
  valorTexto,
  aoMudarValor,
  vencimento,
  aoMudarVencimento,
  pago,
  aoMudarPago,
  rotuloPago,
  forma,
  aoMudarForma,
  aoTirar,
}: LinhaParcelaProps) {
  return (
    <div
      data-testid="parcela-linha"
      className="border-border flex flex-wrap items-center gap-2 rounded-md border px-2 py-2"
    >
      <span className="text-apoio text-muted-foreground w-10 shrink-0 tabular-nums">
        {numero}/{de}
      </span>

      {vencimento !== undefined && aoMudarVencimento && (
        <Input
          type="date"
          aria-label={`Vencimento da parcela ${numero} de ${de}`}
          value={vencimento}
          onChange={(evento) => aoMudarVencimento(evento.target.value)}
          className="text-corpo min-h-[44px] min-w-0 flex-1 basis-32"
        />
      )}

      <Input
        inputMode="decimal"
        aria-label={`Valor da parcela ${numero} de ${de}`}
        value={valorTexto}
        placeholder="R$"
        onChange={(evento) => aoMudarValor(evento.target.value)}
        className="text-corpo min-h-[44px] min-w-0 flex-1 basis-24"
      />

      {pago !== undefined && aoMudarPago && (
        <span
          data-testid="parcela-paga"
          className="flex size-11 shrink-0 items-center justify-center"
        >
          <input
            type="checkbox"
            aria-label={`${rotuloPago ?? "paga"} — parcela ${numero} de ${de}`}
            checked={pago}
            onChange={(evento) => aoMudarPago(evento.target.checked)}
            className="size-5"
          />
        </span>
      )}

      {forma && aoMudarForma && (
        <div className="flex gap-1">
          {FORMAS_EM_ORDEM.map((valor) => (
            <button
              key={valor}
              type="button"
              aria-pressed={forma === valor}
              onClick={() => aoMudarForma(valor)}
              className={cn(
                "text-apoio min-h-[44px] rounded-md border px-2",
                forma === valor
                  ? "border-primary bg-accent text-accent-foreground"
                  : "border-border bg-secondary text-secondary-foreground",
              )}
            >
              {ROTULO_FORMA[valor]}
            </button>
          ))}
        </div>
      )}

      {aoTirar && (
        <button
          type="button"
          onClick={aoTirar}
          className="text-apoio text-muted-foreground hover:text-foreground min-h-[44px] px-2"
        >
          {ROTULO_TIRAR}
        </button>
      )}
    </div>
  );
}

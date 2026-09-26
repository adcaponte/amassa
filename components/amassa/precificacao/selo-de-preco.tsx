import type { FarolDoPreco } from "@/lib/precificacao/calculo";
import { arredondarBonito } from "@/lib/precificacao/calculo";
import { formatarReais } from "@/lib/financeiro/formato";
import { TEXTO_FAROL, fraseSugestaoParaComecar } from "@/lib/precificacao/textos";

export type SeloDePrecoProps = {
  farol: FarolDoPreco;
  precoPraticadoCentavos: number | null;
  minimoCentavos: number;
};

const CLASSE_DO_FAROL: Record<Exclude<FarolDoPreco, null>, string> = {
  verde: "bg-sucesso-fundo text-sucesso",
  amarelo: "bg-atencao-fundo text-atencao",
  vermelho: "bg-erro-fundo text-erro",
};

// O veredito do preço praticado (ORC-06) — verde/âmbar/vermelho nas cópias herdadas, verbatim, do
// protótipo; sem selo nenhum (farol `null`) quando ainda não há preço praticado, mostrando a
// sugestão de partida em vez do veredito.
export function SeloDePreco({ farol, precoPraticadoCentavos, minimoCentavos }: SeloDePrecoProps) {
  if (farol === null) {
    return (
      <p data-testid="ficha-selo" className="text-apoio text-muted-foreground">
        {fraseSugestaoParaComecar(formatarReais(arredondarBonito(minimoCentavos)))}
      </p>
    );
  }

  return (
    <div data-testid="ficha-selo" role="status" className={`text-corpo rounded-lg p-3 ${CLASSE_DO_FAROL[farol]}`}>
      {precoPraticadoCentavos !== null ? `A ${formatarReais(precoPraticadoCentavos)}: ` : ""}
      {TEXTO_FAROL[farol]}.
    </div>
  );
}

import { formatarEfeito, type EfeitoNoEstoque } from "@/lib/financeiro/efeito-estoque";
import { DICA_EFEITO_ESTOQUE, TITULO_EFEITO_ESTOQUE_VENDA } from "@/lib/financeiro/textos";

export type EfeitoEstoqueProps = {
  efeito: EfeitoNoEstoque;
};

// "O que esta venda tira do estoque" — cálculo puro exibido, NUNCA gravado nesta fase (BRIEFING
// §6). Recolhível (`<details>`, mesmo padrão do protótipo) e só aparece quando há alguma
// variação a mostrar.
export function EfeitoEstoque({ efeito }: EfeitoEstoqueProps) {
  if (efeito.length === 0) {
    return null;
  }
  return (
    <details data-testid="venda-efeito" className="border-border rounded-md border p-3">
      <summary className="text-corpo text-foreground cursor-pointer font-medium">
        {TITULO_EFEITO_ESTOQUE_VENDA}
      </summary>
      <ul className="mt-2 flex flex-col gap-1">
        {efeito.map((entrada) => (
          <li key={entrada.itemId} className="text-apoio text-muted-foreground">
            {formatarEfeito(entrada)}
          </li>
        ))}
      </ul>
      <p className="text-apoio text-muted-foreground mt-2">{DICA_EFEITO_ESTOQUE}</p>
    </details>
  );
}

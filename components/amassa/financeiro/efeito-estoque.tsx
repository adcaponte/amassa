import { formatarEfeito, type EfeitoNoEstoque } from "@/lib/financeiro/efeito-estoque";
import { DICA_EFEITO_ESTOQUE, TITULO_EFEITO_ESTOQUE_VENDA } from "@/lib/financeiro/textos";

export type EfeitoEstoqueProps = {
  efeito: EfeitoNoEstoque;
  // Título/dica/testid e se o `<details>` nasce aberto — todos com o padrão da Venda, para o
  // call site do plano 03 (`painel-venda.tsx`) continuar compilando sem mudança nenhuma. A
  // Despesa (04.4-07-PLAN.md) passa os três explicitamente: título "O que esta compra põe no
  // estoque", a dica do custo unitário, e `abertoPorPadrao` (must_have: o efeito nasce ABERTO na
  // compra, ao contrário da Venda, que nasce fechado).
  titulo?: string;
  dica?: string;
  abertoPorPadrao?: boolean;
  testId?: string;
};

// "O que esta venda tira do estoque" / "O que esta compra põe no estoque" — cálculo puro exibido,
// NUNCA gravado nesta fase (BRIEFING §6). Recolhível (`<details>`, mesmo padrão do protótipo) e
// só aparece quando há alguma variação a mostrar. `open={abertoPorPadrao}` só define o estado
// INICIAL: como o valor não muda entre renders de um mesmo painel, o React nunca briga com um
// toque manual do gestor no `<summary>`.
export function EfeitoEstoque({
  efeito,
  titulo = TITULO_EFEITO_ESTOQUE_VENDA,
  dica = DICA_EFEITO_ESTOQUE,
  abertoPorPadrao = false,
  testId = "venda-efeito",
}: EfeitoEstoqueProps) {
  if (efeito.length === 0) {
    return null;
  }
  return (
    <details data-testid={testId} open={abertoPorPadrao} className="border-border rounded-md border p-3">
      <summary className="text-corpo text-foreground cursor-pointer font-medium">
        {titulo}
      </summary>
      <ul className="mt-2 flex flex-col gap-1">
        {efeito.map((entrada) => (
          <li key={entrada.itemId} className="text-apoio text-muted-foreground">
            {formatarEfeito(entrada)}
          </li>
        ))}
      </ul>
      <p className="text-apoio text-muted-foreground mt-2">{dica}</p>
    </details>
  );
}

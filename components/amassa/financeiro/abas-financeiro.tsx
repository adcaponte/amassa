import Link from "next/link";

import type { AbaFinanceiro } from "@/lib/financeiro/abas";
import { ROTULO_ABA_CAIXA, ROTULO_ABA_VENDA } from "@/lib/financeiro/textos";
import { cn } from "@/lib/utils";

// A barra de sub-navegação do Financeiro (`role="tablist"`), mesmo padrão visual e estrutural de
// `abas-abertura.tsx` — pílulas NEUTRAS (nunca terracota), navegação por QUERY STRING na MESMA
// rota (`?aba=venda`/`?aba=caixa`), um `<Link>` normal do Next.js. Server Component simples: esta
// fase não precisa do contorno de re-render de `abas-abertura.tsx` (o painel de venda/caixa é o
// componente caro, não esta barra). Nesta tarefa só Venda e Caixa; Despesa/Mês/Cadastros entram
// nos planos 07/09/02, sempre na mesma ordem fixa.
const ABAS: readonly { valor: AbaFinanceiro; rotulo: string }[] = [
  { valor: "venda", rotulo: ROTULO_ABA_VENDA },
  { valor: "caixa", rotulo: ROTULO_ABA_CAIXA },
];

export function AbasFinanceiro({ abaAtual }: { abaAtual: AbaFinanceiro }) {
  return (
    <div
      role="tablist"
      aria-label="Ver"
      className="mx-6 flex gap-1 rounded-md bg-muted p-1 md:mx-8 md:max-w-md"
    >
      {ABAS.map((aba) => {
        const selecionada = aba.valor === abaAtual;
        return (
          <Link
            key={aba.valor}
            href={`/financeiro?aba=${aba.valor}`}
            role="tab"
            aria-selected={selecionada}
            data-testid={`financeiro-aba-${aba.valor}`}
            className={cn(
              "text-corpo flex min-h-[44px] flex-1 items-center justify-center rounded-sm font-medium transition-colors",
              selecionada
                ? "bg-background text-foreground font-semibold shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {aba.rotulo}
          </Link>
        );
      })}
    </div>
  );
}

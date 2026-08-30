"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

export type AbaAbertura = "itens" | "tarefas" | "meses";

// A barra de abas do protótipo (`role="tablist"`), no molde do `SeletorQueimas` — mas navegando
// por QUERY STRING na MESMA rota (`?aba=itens`/`?aba=tarefas`/`?aba=meses`), não por rotas
// diferentes: as três abas continuam renderizadas no SERVIDOR a cada troca — a URL sempre
// compartilhável, nunca um estado só de cliente escondido atrás de divs alternadas. "Por mês"
// (plano 04.2-04) é a terceira e última aba do protótipo.
const ABAS: readonly { valor: AbaAbertura; rotulo: string }[] = [
  { valor: "itens", rotulo: "Itens" },
  { valor: "tarefas", rotulo: "Tarefas" },
  { valor: "meses", rotulo: "Por mês" },
];

function abaDaUrl(valor: string | null): AbaAbertura {
  if (valor === "tarefas") return "tarefas";
  if (valor === "meses") return "meses";
  return "itens";
}

export function AbasAbertura() {
  const searchParams = useSearchParams();
  const abaAtual: AbaAbertura = abaDaUrl(searchParams.get("aba"));

  return (
    <div
      role="tablist"
      aria-label="Ver"
      className="mx-6 flex gap-1 rounded-md bg-muted p-1 md:mx-8 md:max-w-md"
      data-testid="abertura-aba"
    >
      {ABAS.map((aba) => {
        const selecionada = aba.valor === abaAtual;
        return (
          <Link
            key={aba.valor}
            href={`/abertura?aba=${aba.valor}`}
            role="tab"
            aria-selected={selecionada}
            data-testid={`abertura-aba-${aba.valor}`}
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

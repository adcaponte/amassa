import Link from "next/link";

import type { SubCadastros } from "@/lib/cadastros/abas";
import {
  ROTULO_SUB_CATALOGO,
  ROTULO_SUB_CATEGORIAS,
  ROTULO_SUB_FIXAS,
  ROTULO_SUB_TAXAS,
} from "@/lib/cadastros/textos";
import { cn } from "@/lib/utils";

// A segunda fileira de pílulas, dentro de `/cadastros` (`role="tablist"`), mesmo padrão visual e
// estrutural de `AbasFinanceiro`/`abas-abertura.tsx` — navegação por QUERY STRING na MESMA rota
// (`?sub=`). Server Component simples: não precisa reagir a nada além do que a própria página já
// recebe em `searchParams`. A régua de 44px é PISO, não teto — o rótulo quebra em duas linhas a
// 320px em vez de truncar ou estourar a largura (mesmo cuidado do UI-SPEC para a barra do
// Financeiro), por isso nenhuma classe de `white-space`/`truncate` foi acrescentada aqui.
const SUB_ABAS: readonly { valor: SubCadastros; rotulo: string }[] = [
  { valor: "catalogo", rotulo: ROTULO_SUB_CATALOGO },
  { valor: "categorias", rotulo: ROTULO_SUB_CATEGORIAS },
  { valor: "fixas", rotulo: ROTULO_SUB_FIXAS },
  { valor: "taxas", rotulo: ROTULO_SUB_TAXAS },
];

export function SubAbasCadastros({ subAtual }: { subAtual: SubCadastros }) {
  return (
    <div
      role="tablist"
      aria-label="Sub-navegação de Cadastros"
      className="mx-6 flex gap-1 rounded-md bg-muted p-1 md:mx-8 md:max-w-md"
    >
      {SUB_ABAS.map((sub) => {
        const selecionada = sub.valor === subAtual;
        return (
          <Link
            key={sub.valor}
            href={`/cadastros?sub=${sub.valor}`}
            role="tab"
            aria-selected={selecionada}
            data-testid={`cadastros-sub-${sub.valor}`}
            className={cn(
              "text-corpo flex min-h-[44px] flex-1 items-center justify-center rounded-sm p-1 text-center font-medium transition-colors",
              selecionada
                ? "bg-background text-foreground font-semibold shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {sub.rotulo}
          </Link>
        );
      })}
    </div>
  );
}

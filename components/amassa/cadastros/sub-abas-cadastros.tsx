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
// 320px em vez de truncar ou estourar a largura.
//
// `min-w-0` + `break-words` em cada pílula: achado real do e2e "cadastros base" (não suposição)
// — sem eles, um `<Link>` `flex-1` mantém `min-width: auto` (o piso padrão do flexbox), que para
// uma palavra ÚNICA sem espaço ("Categorias") é a largura do texto inteiro sem quebra. Com
// QUATRO pílulas nesta fileira (uma a mais que a barra do Financeiro), esse piso somado
// estourava 320px por 3px — pequeno demais para notar visualmente, grande o bastante para o
// teste automatizado de UI-06 pegar. `min-w-0` deixa a pílula encolher abaixo do conteúdo;
// `break-words` (overflow-wrap) é o que permite ATÉ uma palavra única quebrar em duas linhas
// quando encolhida, em vez de vazar.
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
              "text-corpo flex min-h-[44px] min-w-0 flex-1 items-center justify-center rounded-sm p-1 text-center font-medium break-words transition-colors",
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

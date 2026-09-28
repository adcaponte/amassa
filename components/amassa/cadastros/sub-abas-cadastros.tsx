import Link from "next/link";

import { rotaDeGestao } from "@/lib/rotas/gestao";
import type { SubCadastros } from "@/lib/cadastros/abas";
import {
  ROTULO_SUB_CATALOGO,
  ROTULO_SUB_CATEGORIAS,
  ROTULO_SUB_FIXAS,
  ROTULO_SUB_PARAMETROS,
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
// quando encolhida, em vez de vazar. Parâmetros (D-03, 04.5-02-PLAN.md) é a QUINTA pílula desta
// fileira, por ÚLTIMO — agrupa com Taxas, o outro parâmetro que a precificação lê (D-16) — e o
// mesmo mecanismo (`min-w-0`/`break-words`) absorve o crescimento sem nenhuma mudança estrutural.
// 🔴 O comentário acima concluía que `min-w-0`/`break-words` "absorve o crescimento sem nenhuma
// mudança estrutural" quando Parâmetros virou a quinta pílula. **Estava errado**, e o dono viu
// num Android em 2026-09-27: a 360px as cinco pílulas ficam com ~57px cada, "Catálogo" e
// "Categorias" encostam sem espaço visível entre elas, "Contas fixas" quebra dentro da própria
// pílula e "Parâmetros" vaza a borda arredondada do contêiner.
//
// A correção é a MESMA que a barra do Financeiro já usava para o problema das sete abas
// (`abas-financeiro.tsx`): `flex-wrap` mais um espaçador `basis-full` que força a quebra num
// ponto ESCOLHIDO, nunca onde o navegador decidir. Duas em cima, três embaixo.
//
// A ordem é a de origem (Catálogo · Categorias | Contas fixas · Taxas · Parâmetros), e não a
// sugerida na conversa (Catálogo + Contas fixas em cima), porque reordenar navegação mexe na
// memória muscular de quem já usa — e a ordem atual agrupa o que se vende em cima e os números
// que o dinheiro usa embaixo.
//
// O espaçador é `md:hidden`: a partir de `md` o contêiner tem `max-w-md` e as cinco pílulas
// cabem numa fileira só, como sempre couberam. Forçar duas fileiras no desktop seria regressão.
const PRIMEIRA_FILEIRA: readonly { valor: SubCadastros; rotulo: string }[] = [
  { valor: "catalogo", rotulo: ROTULO_SUB_CATALOGO },
  { valor: "categorias", rotulo: ROTULO_SUB_CATEGORIAS },
];

const SEGUNDA_FILEIRA: readonly { valor: SubCadastros; rotulo: string }[] = [
  { valor: "fixas", rotulo: ROTULO_SUB_FIXAS },
  { valor: "taxas", rotulo: ROTULO_SUB_TAXAS },
  { valor: "parametros", rotulo: ROTULO_SUB_PARAMETROS },
];

export function SubAbasCadastros({ subAtual }: { subAtual: SubCadastros }) {
  return (
    <div
      role="tablist"
      aria-label="Sub-navegação de Cadastros"
      className="mx-6 flex flex-wrap gap-1 rounded-md bg-muted p-1 md:mx-8 md:max-w-md"
    >
      {PRIMEIRA_FILEIRA.map((sub) => (
        <Pilula key={sub.valor} sub={sub} selecionada={sub.valor === subAtual} />
      ))}

      {/* Espaçador que FORÇA a quebra: com `flex-wrap`, um item de largura total empurra tudo o
          que vem depois para a fileira seguinte. `aria-hidden` porque não é uma aba e não deve
          existir para leitor de tela. `md:hidden` porque no desktop as cinco cabem numa fileira.
          Mesmo mecanismo de `abas-financeiro.tsx`. */}
      <span aria-hidden="true" className="basis-full md:hidden" />

      {SEGUNDA_FILEIRA.map((sub) => (
        <Pilula key={sub.valor} sub={sub} selecionada={sub.valor === subAtual} />
      ))}
    </div>
  );
}

function Pilula({
  sub,
  selecionada,
}: {
  sub: { valor: SubCadastros; rotulo: string };
  selecionada: boolean;
}) {
  return (
    <Link
      href={rotaDeGestao(`/cadastros?sub=${sub.valor}`)}
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
}

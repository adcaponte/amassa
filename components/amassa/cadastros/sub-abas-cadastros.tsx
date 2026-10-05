"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";

import { rotaDeGestao } from "@/lib/rotas/gestao";
import {
  deslocamentoParaCentralizar,
  ORDEM_DAS_SUBS_CADASTROS,
  type SubCadastros,
} from "@/lib/cadastros/abas";
import {
  ROTULO_SUB_CATALOGO,
  ROTULO_SUB_CATEGORIAS,
  ROTULO_SUB_CLIENTES,
  ROTULO_SUB_FIXAS,
  ROTULO_SUB_FORNECEDORES,
  ROTULO_SUB_PARAMETROS,
  ROTULO_SUB_TAXAS,
} from "@/lib/cadastros/textos";
import { cn } from "@/lib/utils";

// A fileira de pílulas dentro de `/cadastros` (`role="tablist"`) — navegação por QUERY STRING na
// MESMA rota (`?sub=`).
//
// Fase 06.5 (D-09, POL-02, achado 25 do Cowork): as sete pílulas viram UMA fileira com rolagem
// lateral. Até aqui eram três fileiras (3 + 3 + 1) forçadas por espaçadores de largura total, a
// solução da barra do Financeiro (`abas-financeiro.tsx`, 04.5-UI-SPEC); no celular elas tomavam ~40 %
// da tela. O dono decidiu desfazer essa decisão SÓ nos Cadastros — o Financeiro e a Agenda continuam
// como estão.
//
// - A ordem mora em `ORDEM_DAS_SUBS_CADASTROS` (`lib/cadastros/abas.ts`, puro e testado); aqui só se
//   percorre a lista.
// - O trilho usa a largura da área de conteúdo e rola o que faltar, sem barra visível e sem arrastar
//   a página (`overscroll-x-contain`). A partir da largura em que as sete cabem, simplesmente não
//   rola — sem breakpoint escrito.
// - A pílula nunca quebra nem encolhe (`shrink-0 whitespace-nowrap`): a que não cabe aparece CORTADA
//   na borda, o primeiro sinal de que a fileira continua.
// - O anel de foco é `ring-inset`: um anel de fora seria cortado pelo `overflow` do trilho.
// - `"use client"` só pela centralização da aba ativa: ao montar (e a cada troca de aba), o trilho rola
//   SÓ no eixo horizontal, instantâneo, até a pílula `aria-selected` ficar no meio. Nunca
//   `scrollIntoView` (rolaria a página na vertical) nem rolagem suave.
const ROTULO_DA_SUB: Record<SubCadastros, string> = {
  catalogo: ROTULO_SUB_CATALOGO,
  clientes: ROTULO_SUB_CLIENTES,
  fornecedores: ROTULO_SUB_FORNECEDORES,
  fixas: ROTULO_SUB_FIXAS,
  categorias: ROTULO_SUB_CATEGORIAS,
  parametros: ROTULO_SUB_PARAMETROS,
  taxas: ROTULO_SUB_TAXAS,
};

export function SubAbasCadastros({ subAtual }: { subAtual: SubCadastros }) {
  const trilhoRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const trilho = trilhoRef.current;
    if (!trilho) return;
    const pilula = trilho.querySelector<HTMLElement>(`[data-testid="cadastros-sub-${subAtual}"]`);
    if (!pilula) return;
    // O trilho é `relative`, então ele é o `offsetParent` da pílula e o `offsetLeft` não depende de
    // quanto o trilho já está rolado.
    trilho.scrollLeft = deslocamentoParaCentralizar({
      larguraDoTrilho: trilho.clientWidth,
      inicioDaPilula: pilula.offsetLeft,
      larguraDaPilula: pilula.offsetWidth,
    });
  }, [subAtual]);

  return (
    <div
      ref={trilhoRef}
      role="tablist"
      aria-label="Sub-navegação de Cadastros"
      data-testid="cadastros-abas-trilho"
      className="relative mx-6 flex flex-nowrap gap-1 overflow-x-auto overscroll-x-contain rounded-md bg-muted p-1 [scrollbar-width:none] md:mx-8 [&::-webkit-scrollbar]:hidden"
    >
      {ORDEM_DAS_SUBS_CADASTROS.map((valor) => (
        <Pilula key={valor} valor={valor} rotulo={ROTULO_DA_SUB[valor]} selecionada={valor === subAtual} />
      ))}
    </div>
  );
}

function Pilula({
  valor,
  rotulo,
  selecionada,
}: {
  valor: SubCadastros;
  rotulo: string;
  selecionada: boolean;
}) {
  return (
    <Link
      href={rotaDeGestao(`/cadastros?sub=${valor}`)}
      role="tab"
      aria-selected={selecionada}
      data-testid={`cadastros-sub-${valor}`}
      className={cn(
        "text-corpo flex min-h-[44px] shrink-0 items-center rounded-sm px-4 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none",
        selecionada
          ? "bg-background text-foreground font-semibold shadow-sm"
          : "font-normal text-muted-foreground hover:text-foreground",
      )}
    >
      {rotulo}
    </Link>
  );
}

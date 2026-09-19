"use client";

import { memo } from "react";
import Link from "next/link";

import { abaDaUrl, type AbaAbertura } from "@/lib/abertura/abas";
import { cn } from "@/lib/utils";
import { useAbaAtual } from "@/components/amassa/abertura/contexto-navegacao";

// A barra de abas do protótipo (`role="tablist"`), no molde do `SeletorQueimas` — mas navegando
// por QUERY STRING na MESMA rota (`?aba=itens`/`?aba=tarefas`/`?aba=meses`/`?aba=cotacoes`), não
// por rotas diferentes: as quatro abas continuam renderizadas no SERVIDOR a cada troca — a URL
// sempre compartilhável, nunca um estado só de cliente escondido atrás de divs alternadas.
// "Cotações" (D-02, plano 04.3-01) é a quarta e última aba, o Comparador de Compras — rótulo
// curto de propósito (UI-SPEC §"A quarta aba": "Comparador" e "Compras" foram descartados por
// colidirem em tamanho/nome com abas existentes). A régua de 44px é PISO, não teto: o rótulo
// quebra em duas linhas a 320px em vez de truncar ou estourar a largura (UI-SPEC §"Cabimento em
// 320px, calculado") — por isso nenhuma classe de `white-space`/`truncate` foi acrescentada aqui.
const ABAS: readonly { valor: AbaAbertura; rotulo: string }[] = [
  { valor: "itens", rotulo: "Itens" },
  { valor: "tarefas", rotulo: "Tarefas" },
  { valor: "meses", rotulo: "Por mês" },
  { valor: "cotacoes", rotulo: "Cotações" },
];

// Casca fininha (nunca `memo` aqui — não tem como comparar o que só existe em contexto): só lê
// `?aba=` e repassa o valor JÁ DERIVADO como prop primitiva para `AbasAberturaConteudo`, que é
// quem de fato pode pular o re-render (achado quantitativo de
// .planning/debug/abertura-navegacao-trava.md: um componente sem props não dá para o `memo`
// comparar nada além do contexto que ele mesmo lê, e nesta árvore isso NÃO bastou para o React
// pular o re-render — só bastou depois de mover o valor para uma prop primitiva com comparador
// próprio).
export function AbasAbertura() {
  const aba = useAbaAtual();
  return <AbasAberturaConteudo abaAtual={abaDaUrl(aba)} />;
}

function AbasAberturaConteudoBase({ abaAtual }: { abaAtual: AbaAbertura }) {
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

function propsIguais(
  anterior: { abaAtual: AbaAbertura },
  atual: { abaAtual: AbaAbertura },
): boolean {
  return anterior.abaAtual === atual.abaAtual;
}

// `memo` com comparador PRÓPRIO explícito (nunca o comparador padrão — ver
// .planning/debug/abertura-navegacao-trava.md: o padrão não bastou para pular o re-render nesta
// árvore, mesmo com props primitivas idênticas). Isto é o que faz esta barra pular o trabalho de
// render quando `?item=`/`?tarefa=` mudam mas `?aba=` continua igual.
const AbasAberturaConteudo = memo(AbasAberturaConteudoBase, propsIguais);

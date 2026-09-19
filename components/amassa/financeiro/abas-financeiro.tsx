"use client";

import { memo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { AbaFinanceiro } from "@/lib/financeiro/abas";
import { ROTULO_ABA_CAIXA, ROTULO_ABA_DESPESA, ROTULO_ABA_VENDA } from "@/lib/financeiro/textos";
import { cn } from "@/lib/utils";

// A barra de sub-navegação do Financeiro (`role="tablist"`), mesmo padrão visual e estrutural de
// `abas-abertura.tsx` — pílulas NEUTRAS (nunca terracota), navegação por QUERY STRING na MESMA
// rota (`?aba=venda`/`?aba=despesa`/`?aba=caixa`) para as abas do Financeiro, um `<Link>` normal
// do Next.js. Nesta tarefa (plano 07) Despesa entra; Mês entra no plano 09. A ordem final das
// pílulas é Venda · Despesa · Caixa · Mês · Cadastros.
const ABAS: readonly { valor: AbaFinanceiro; rotulo: string }[] = [
  { valor: "venda", rotulo: ROTULO_ABA_VENDA },
  { valor: "despesa", rotulo: ROTULO_ABA_DESPESA },
  { valor: "caixa", rotulo: ROTULO_ABA_CAIXA },
];

// A quinta pílula, "Cadastros" (D-06): é um `<Link href="/cadastros">` de VERDADE, não um
// `?aba=` — Cadastros é rota própria. Fica selecionada quando `pathname` começa com
// `/cadastros`, nunca por `abaAtual` (que só existe dentro de `/financeiro`).
//
// `min-w-0` + `break-words` em cada pílula (abaixo): mesmo achado real do e2e "cadastros base"
// aplicado aqui por prevenção — com só 3 pílulas hoje (Venda/Caixa/Cadastros) esta barra ainda
// cabe a 320px, mas os planos 07/09 acrescentam Despesa e Mês (5 pílulas ao todo, a mesma
// contagem de `SubAbasCadastros`, onde o estouro de 3px apareceu). Sem esta classe, o dia em que
// a 4ª/5ª pílula entrar reproduziria o mesmo estouro.
const ROTULO_CADASTROS = "Cadastros";

export type AbasFinanceiroProps = {
  // `null` quando o componente é montado FORA de `/financeiro` (ex.: no topo de `/cadastros`,
  // UI-SPEC §"Sub-navegação do Financeiro") — nenhuma das pílulas de `?aba=` fica selecionada
  // nesse caso, só "Cadastros".
  abaAtual: AbaFinanceiro | null;
};

// Casca fininha: só lê `usePathname()` (a única forma de saber "estou em /cadastros?" de dentro
// de um Client Component sem herdar um provedor de contexto que este componente não precisa) e
// repassa o valor JÁ DERIVADO como prop primitiva para `AbasFinanceiroConteudo`, que é quem pode
// pular o re-render — mesmo padrão de `AbasAbertura`/`AbasAberturaConteudo`
// (components/amassa/abertura/abas-abertura.tsx).
export function AbasFinanceiro({ abaAtual }: AbasFinanceiroProps) {
  const pathname = usePathname();
  const emCadastros = pathname.startsWith("/cadastros");
  return <AbasFinanceiroConteudo abaAtual={abaAtual} emCadastros={emCadastros} />;
}

type PropsDoConteudo = { abaAtual: AbaFinanceiro | null; emCadastros: boolean };

function AbasFinanceiroConteudoBase({ abaAtual, emCadastros }: PropsDoConteudo) {
  return (
    <div
      role="tablist"
      aria-label="Ver"
      className="mx-6 flex gap-1 rounded-md bg-muted p-1 md:mx-8 md:max-w-md"
    >
      {ABAS.map((aba) => {
        const selecionada = !emCadastros && aba.valor === abaAtual;
        return (
          <Link
            key={aba.valor}
            href={`/financeiro?aba=${aba.valor}`}
            role="tab"
            aria-selected={selecionada}
            data-testid={`financeiro-aba-${aba.valor}`}
            className={cn(
              "text-corpo flex min-h-[44px] min-w-0 flex-1 items-center justify-center rounded-sm p-1 text-center font-medium break-words transition-colors",
              selecionada
                ? "bg-background text-foreground font-semibold shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {aba.rotulo}
          </Link>
        );
      })}
      <Link
        href="/cadastros"
        role="tab"
        aria-selected={emCadastros}
        data-testid="financeiro-aba-cadastros"
        className={cn(
          "text-corpo flex min-h-[44px] min-w-0 flex-1 items-center justify-center rounded-sm p-1 text-center font-medium break-words transition-colors",
          emCadastros
            ? "bg-background text-foreground font-semibold shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        {ROTULO_CADASTROS}
      </Link>
    </div>
  );
}

function propsIguais(anterior: PropsDoConteudo, atual: PropsDoConteudo): boolean {
  return anterior.abaAtual === atual.abaAtual && anterior.emCadastros === atual.emCadastros;
}

// `memo` com comparador PRÓPRIO explícito sobre valores primitivos (aba e se está em Cadastros)
// — mesmo cuidado de `AbasAberturaConteudo` (.planning/debug/abertura-navegacao-trava.md): o
// comparador padrão do `memo` não bastou naquela árvore mesmo com props primitivas idênticas.
const AbasFinanceiroConteudo = memo(AbasFinanceiroConteudoBase, propsIguais);

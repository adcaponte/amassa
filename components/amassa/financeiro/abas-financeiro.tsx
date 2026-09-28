"use client";

import { memo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { AbaFinanceiro } from "@/lib/financeiro/abas";
import {
  ROTULO_ABA_CAIXA,
  ROTULO_ABA_DESPESA,
  ROTULO_ABA_MES,
  ROTULO_ABA_ORCAMENTOS,
  ROTULO_ABA_PECAS,
  ROTULO_ABA_VENDA,
} from "@/lib/financeiro/textos";
import { cn } from "@/lib/utils";

// A barra de sub-navegação do Financeiro (`role="tablist"`), mesmo padrão visual e estrutural de
// `abas-abertura.tsx` — pílulas NEUTRAS (nunca terracota), navegação por QUERY STRING na MESMA
// rota (`?aba=venda`/`?aba=despesa`/`?aba=caixa`/`?aba=mes`/`?aba=orcamentos`/`?aba=pecas`) para
// as abas do Financeiro, um `<Link>` normal do Next.js.
//
// Fase 04.5 (D-01/D-02) leva a barra de 5 para 7 elementos — quase o dobro, não o incremento de
// +1 que `abas-abertura.tsx`/`sub-abas-cadastros.tsx` já absorvem com "pílula quebra em 2 linhas
// de texto". A resolução (04.5-UI-SPEC.md §"Layout & Navigation Contract") é DUAS FILEIRAS
// determinísticas por agrupamento de sentido, nunca deixadas ao navegador:
//
//   Fileira 1 (dinheiro do dia a dia):      Venda · Despesa · Caixa · Mês
//   Fileira 2 (precificação e cadastro):    Orçamentos · Peças · Cadastros
//
// PRIMEIRA_FILEIRA fica separada de SEGUNDA_FILEIRA (abaixo) porque o espaçador que força a
// quebra de linha (ver abaixo) entra explicitamente ENTRE as duas na marcação — nunca calculado
// por índice.
const PRIMEIRA_FILEIRA: readonly { valor: AbaFinanceiro; rotulo: string }[] = [
  { valor: "venda", rotulo: ROTULO_ABA_VENDA },
  { valor: "despesa", rotulo: ROTULO_ABA_DESPESA },
  { valor: "caixa", rotulo: ROTULO_ABA_CAIXA },
  { valor: "mes", rotulo: ROTULO_ABA_MES },
];

// "Cadastros" fecha a segunda fileira (não entra aqui — é um `<Link href="/gestao/cadastros">` de
// verdade, montado abaixo, sempre a última pílula da barra).
const SEGUNDA_FILEIRA: readonly { valor: AbaFinanceiro; rotulo: string }[] = [
  { valor: "orcamentos", rotulo: ROTULO_ABA_ORCAMENTOS },
  { valor: "pecas", rotulo: ROTULO_ABA_PECAS },
];

// "Cadastros" (D-06): é um `<Link href="/gestao/cadastros">` de VERDADE, não um `?aba=` — Cadastros é
// rota própria. Fica selecionada quando `pathname` começa com `/cadastros`, nunca por `abaAtual`
// (que só existe dentro de `/financeiro`). Fecha a segunda fileira, sétima e última pílula da
// barra desde a Fase 04.5.
//
// `min-w-0` + `break-words` em cada pílula: mesmo achado real do e2e "cadastros base" aplicado
// aqui por prevenção — sem esta classe, a pílula com o texto mais comprido de cada fileira
// estouraria a 320px.
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
  const emCadastros = pathname.startsWith("/gestao/cadastros");
  return <AbasFinanceiroConteudo abaAtual={abaAtual} emCadastros={emCadastros} />;
}

type PropsDoConteudo = { abaAtual: AbaFinanceiro | null; emCadastros: boolean };

// Classe compartilhada por toda pílula (as duas fileiras + Cadastros) — `min-w-0`+`break-words`
// continua sendo a técnica de degradação graciosa já usada antes de 04.5; o que muda nesta fase
// é só o container (`flex-wrap` em vez de `flex`), nunca a pílula em si.
const CLASSE_DA_PILULA =
  "text-corpo flex min-h-[44px] min-w-0 flex-1 items-center justify-center rounded-sm p-1 text-center font-medium break-words transition-colors";

function Pilula({
  href,
  selecionada,
  testId,
  rotulo,
}: {
  href: string;
  selecionada: boolean;
  testId: string;
  rotulo: string;
}) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={selecionada}
      data-testid={testId}
      className={cn(
        CLASSE_DA_PILULA,
        selecionada
          ? "bg-background text-foreground font-semibold shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {rotulo}
    </Link>
  );
}

function AbasFinanceiroConteudoBase({ abaAtual, emCadastros }: PropsDoConteudo) {
  return (
    <div
      role="tablist"
      aria-label="Ver"
      // `flex-wrap` — desvio DELIBERADO da regra "flex-wrap nunca" de `04.4-UI-SPEC.md` (aquela
      // regra resolvia um crescimento de +1 pílula; aqui a barra vai de 5 para 7, quase o dobro,
      // e precisa de uma resposta diferente — 04.5-UI-SPEC.md §"Layout & Navigation Contract").
      className="mx-6 flex flex-wrap gap-1 rounded-md bg-muted p-1 md:mx-8 md:max-w-md"
    >
      {PRIMEIRA_FILEIRA.map((aba) => (
        <Pilula
          key={aba.valor}
          href={`/financeiro?aba=${aba.valor}`}
          selecionada={!emCadastros && aba.valor === abaAtual}
          testId={`financeiro-aba-${aba.valor}`}
          rotulo={aba.rotulo}
        />
      ))}

      {/* Espaçador que FORÇA a quebra de linha — com `flex-wrap: wrap`, um item de
          `flex-basis: 100%` sempre começa uma fileira nova, então a primeira fileira tem SEMPRE
          exatamente 4 pílulas e a segunda SEMPRE exatamente 3, em qualquer largura de tela —
          nunca dependendo de quanto texto cabe (04.5-UI-SPEC.md §"Layout & Navigation
          Contract"). `aria-hidden`: não é uma aba, não deve existir para leitor de tela. */}
      <span aria-hidden="true" className="basis-full" />

      {SEGUNDA_FILEIRA.map((aba) => (
        <Pilula
          key={aba.valor}
          href={`/financeiro?aba=${aba.valor}`}
          selecionada={!emCadastros && aba.valor === abaAtual}
          testId={`financeiro-aba-${aba.valor}`}
          rotulo={aba.rotulo}
        />
      ))}

      {/* "Cadastros" (D-06): é um `<Link href="/gestao/cadastros">` de VERDADE, não um `?aba=` —
          Cadastros é rota própria. Fica selecionada quando `pathname` começa com `/cadastros`,
          nunca por `abaAtual` (que só existe dentro de `/financeiro`). Só mudou de fileira nesta
          fase — continua a última pílula da barra. */}
      <Pilula
        href="/gestao/cadastros"
        selecionada={emCadastros}
        testId="financeiro-aba-cadastros"
        rotulo={ROTULO_CADASTROS}
      />
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

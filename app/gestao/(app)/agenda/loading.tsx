import { Suspense } from "react";

import { TITULO_AGENDA } from "@/lib/agenda/textos";
import { CabecalhoPagina } from "@/components/amassa/cabecalho-pagina";
import { EsqueletoPelaAba } from "@/components/amassa/agenda/a-receber";
import { AbasDaAgenda } from "@/components/amassa/agenda/abas-da-agenda";
import { EsqueletoDosNumeros } from "@/components/amassa/agenda/numeros-da-agenda";
import { Skeleton } from "@/components/ui/skeleton";

// Esqueleto da Agenda (05-UI-SPEC.md §"Estados → Carregando"): o cabeçalho real, as ABAS REAIS (desde
// o 05-04 — a aba marcada vem do endereço, porque este arquivo não recebe a URL) e o formato da aba
// que está carregando: na aba Agenda (vista semana) a barra de navegação ("‹ título ›" e o alternador),
// a fileira "+ Lançar na agenda · Hoje" (52px) e 3 grupos de dia com 2 cartões de 64px cada; em "A
// receber" (plano 11), o cabeçalho + a sanfona + 4 linhas; em Números (plano 14), 4 quadros + 7 barras —
// escolhido no navegador por `?aba=`
// (`EsqueletoPelaAba`). Trocar de semana, de mês ou de aba usa este mesmo arquivo — nunca
// "carregando..." solto nem tela em branco (CLAUDE.md §Estados). A grade do MÊS e a lista de Pessoas
// esperam o banco atrás do esqueleto próprio de cada uma, num `Suspense` da página.
const DIAS = [0, 1, 2] as const;
const CARTOES = [0, 1] as const;

function EsqueletoDaSemana() {
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="size-11 rounded-md" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="size-11 rounded-md" />
        </div>
        <Skeleton className="h-[52px] w-40 rounded-md" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-[52px] flex-1 rounded-md" />
        <Skeleton className="h-[52px] w-24 rounded-md" />
      </div>
      {DIAS.map((dia) => (
        <div key={dia} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-28" />
          {CARTOES.map((cartao) => (
            <Skeleton key={cartao} className="h-16 w-full rounded-md" />
          ))}
        </div>
      ))}
    </>
  );
}

export default function CarregandoAgenda() {
  return (
    <div className="flex flex-col" aria-busy="true" data-testid="agenda-carregando">
      <CabecalhoPagina titulo={TITULO_AGENDA} />
      <div className="pt-4">
        {/* `useSearchParams` dentro das abas: o `Suspense` com a forma delas evita qualquer salto. */}
        <Suspense fallback={<AbasDaAgenda abaAtual="agenda" />}>
          <AbasDaAgenda />
        </Suspense>
      </div>
      <div className="flex max-w-3xl flex-col gap-4 px-6 pt-6 pb-6 md:px-8">
        <Suspense fallback={<EsqueletoDaSemana />}>
          <EsqueletoPelaAba padrao={<EsqueletoDaSemana />} numeros={<EsqueletoDosNumeros />} />
        </Suspense>
      </div>
    </div>
  );
}

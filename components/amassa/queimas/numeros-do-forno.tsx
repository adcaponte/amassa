import type { ReactNode } from "react";
import Link from "next/link";

import { nomeDoMes } from "@/lib/agenda/semana";
import { numerosDoForno, type NumerosDoForno as Numeros } from "@/lib/queimas/consultas";
import { ORDEM_DOS_QUADROS, type CapacidadeDoTipo, type ChaveDoQuadro, type GrupoQueimado } from "@/lib/queimas/contagem";
import {
  DICA_O_QUE_QUEIMOU,
  FRASE_ERRO_NUMEROS,
  FRASE_FATOR_SEM_DOIS_LADOS,
  FRASE_SEM_CHEIA,
  ROTULO_ABRIR_PARAMETROS,
  ROTULO_EXTERNAS,
  ROTULO_FATOR,
  ROTULO_INTERNAS,
  ROTULO_QUADRO_TODAS,
  TITULO_CAPACIDADE,
  TITULO_NUMEROS,
  TITULO_O_QUE_QUEIMOU,
  TITULO_POR_TIPO,
  VALOR_SEM_NUMERO,
  VAZIO_NUMEROS_CORPO,
  VAZIO_NUMEROS_TITULO,
  dicaCapacidade,
  dicaPorTipo,
  fraseFator,
  frasePoucasCheias,
  mediaDePecas,
  mixMedio,
  rotuloDoTipo,
  rotuloFornadaCheia,
  subDoGrupo,
  subNesteMes,
  subOQueQueimou,
  valorDoGrupo,
} from "@/lib/queimas/textos";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import { cn } from "@/lib/utils";
import { TentarDeNovo } from "@/components/amassa/inicio/tentar-de-novo";
import { Skeleton } from "@/components/ui/skeleton";

// Os Números do forno (QMC-09, QMC-10; 06.4-UI-SPEC.md §"Detalhe do forno — Números"): três blocos,
// TODOS deste forno (D-01) — queimas por tipo desde a manutenção e no mês, quantas peças cabem de
// verdade (com o fator do biscoito medido ao lado do vigente) e o que o forno queimou. Só leitura:
// nenhuma ação, e levar o fator aos Parâmetros é à mão (o link só abre a tela). A página monta este
// componente num `Suspense` próprio e a leitura tem `try` próprio — a falha mostra só o bloco de erro,
// e o medidor, a manutenção e o Histórico continuam (T-06.4-36; molde `ListasDoIndice`).

const CLASSE_DA_SECAO = "flex scroll-mt-4 flex-col gap-4";
const CLASSE_DO_TITULO = "text-titulo text-tinta";
// Os blocos e a grade, os da aba Números da Agenda (`numeros-da-agenda.tsx`).
const CLASSE_DO_BLOCO = "bg-superficie border-borda flex flex-col gap-4 rounded-lg border p-4";
const CLASSE_DA_GRADE = "grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-4";
const CLASSE_DO_SUBTITULO = "text-corpo text-tinta font-semibold";
// Blocos 2 e 3 lado a lado a partir de 1024 px (a proporção `.duas` do protótipo).
const CLASSE_DAS_DUAS = "grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.15fr_1fr]";
const CLASSE_DA_LINHA = "border-borda flex flex-col gap-1 border-b py-2 last:border-b-0";

// Cor de TIPO na borda esquerda dos quadros (UI-D21) — nunca a cor de etapa. Classes literais para o
// Tailwind enxergar.
const BORDA_DO_TIPO: Record<Exclude<ChaveDoQuadro, "todas">, string> = {
  biscoito: "border-l-4 border-l-biscoito",
  esmalte: "border-l-4 border-l-esmalte",
  ouro: "border-l-4 border-l-ouro",
};

// O `Quadro` de `components/amassa/agenda/numeros-da-agenda.tsx`, COPIADO (não exportado da Agenda —
// o molde das cópias da casa), com a borda de tipo como único acréscimo. O número usa só
// `text-display`: o peso 700 vem do token, nenhuma classe de peso por cima (UI-SPEC §Typography).
function Quadro({
  testId,
  rotulo,
  numero,
  sub,
  escuro = false,
  borda,
}: {
  testId: string;
  rotulo: string;
  numero: string;
  sub: string;
  escuro?: boolean;
  borda?: string;
}) {
  return (
    <div
      data-testid={testId}
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-lg p-4",
        escuro ? "bg-tinta text-white" : "border-borda bg-superficie border",
        borda,
      )}
    >
      <span
        data-testid={`${testId}-rotulo`}
        className={cn(
          "text-apoio font-semibold tracking-[0.06em] break-words uppercase",
          escuro ? "text-borda-forte" : "text-tinta-fraca",
        )}
      >
        {rotulo}
      </span>
      <strong
        data-testid={`${testId}-numero`}
        className={cn("text-display tabular-nums break-words", escuro ? "text-white" : "text-tinta")}
      >
        {numero}
      </strong>
      <span
        data-testid={`${testId}-sub`}
        className={cn("text-apoio break-words", escuro ? "text-borda-forte" : "text-tinta-fraca")}
      >
        {sub}
      </span>
    </div>
  );
}

function Linha({
  testId,
  rotulo,
  valor,
  sub,
  ponto,
}: {
  testId: string;
  rotulo: string;
  valor: string;
  sub: string | null;
  ponto?: string;
}) {
  return (
    <li data-testid={testId} className={CLASSE_DA_LINHA}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-corpo text-tinta flex min-w-0 items-center gap-2 break-words">
          {ponto ? <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", ponto)} /> : null}
          {rotulo}
        </span>
        <span data-testid={`${testId}-valor`} className="text-corpo text-tinta shrink-0 font-semibold tabular-nums">
          {valor}
        </span>
      </div>
      {sub ? <span className="text-apoio text-tinta-fraca break-words">{sub}</span> : null}
    </li>
  );
}

function LinhaDaCapacidade({ tipo, capacidade }: { tipo: "biscoito" | "esmalte"; capacidade: CapacidadeDoTipo }) {
  return (
    <Linha
      testId={`numeros-media-${tipo}`}
      rotulo={rotuloFornadaCheia(tipo)}
      valor={capacidade.mediaPecas === null ? VALOR_SEM_NUMERO : mediaDePecas(capacidade.mediaPecas)}
      sub={capacidade.mix === null ? FRASE_SEM_CHEIA : mixMedio(capacidade.mix)}
    />
  );
}

function LinhaDoGrupo({
  testId,
  rotulo,
  grupo,
  ponto,
}: {
  testId: string;
  rotulo: string;
  grupo: GrupoQueimado;
  ponto: string;
}) {
  return (
    <Linha
      testId={testId}
      rotulo={rotulo}
      valor={valorDoGrupo(grupo.total, grupo.pct)}
      sub={subDoGrupo(grupo.P, grupo.M, grupo.G)}
      ponto={ponto}
    />
  );
}

function BlocoPorTipo({ numeros, hoje }: { numeros: Numeros; hoje: string }) {
  const { desdeManutencao, noMes } = numeros.porTipo;
  return (
    <section className={CLASSE_DO_BLOCO} aria-labelledby="numeros-por-tipo-titulo">
      <h3 id="numeros-por-tipo-titulo" className={CLASSE_DO_SUBTITULO}>
        {TITULO_POR_TIPO}
      </h3>
      <div className={CLASSE_DA_GRADE}>
        {ORDEM_DOS_QUADROS.map((chave) => (
          <Quadro
            key={chave}
            testId={`numeros-quadro-${chave}`}
            rotulo={chave === "todas" ? ROTULO_QUADRO_TODAS : rotuloDoTipo(chave)}
            numero={String(desdeManutencao[chave])}
            sub={subNesteMes(noMes[chave])}
            escuro={chave === "todas"}
            borda={chave === "todas" ? undefined : BORDA_DO_TIPO[chave]}
          />
        ))}
      </div>
      <p className="text-apoio text-tinta-fraca">{dicaPorTipo(nomeDoMes(hoje.slice(0, 7)))}</p>
    </section>
  );
}

function BlocoCapacidade({ numeros }: { numeros: Numeros }) {
  const { capacidade, fatorVigente } = numeros;
  const poucas = frasePoucasCheias(capacidade.cheiasTotal);
  return (
    <section className={CLASSE_DO_BLOCO} aria-labelledby="numeros-capacidade-titulo">
      <h3 id="numeros-capacidade-titulo" className={CLASSE_DO_SUBTITULO}>
        {TITULO_CAPACIDADE}
      </h3>
      <ul className="flex flex-col">
        <LinhaDaCapacidade tipo="biscoito" capacidade={capacidade.biscoito} />
        <LinhaDaCapacidade tipo="esmalte" capacidade={capacidade.esmalte} />
        <Linha
          testId="numeros-fator"
          rotulo={ROTULO_FATOR}
          valor={capacidade.fator === null ? VALOR_SEM_NUMERO : fraseFator(capacidade.fator)}
          sub={capacidade.fator === null ? FRASE_FATOR_SEM_DOIS_LADOS : null}
        />
      </ul>
      <div className="flex flex-col items-start gap-1">
        <p className="text-apoio text-tinta-fraca">{dicaCapacidade(fatorVigente)}</p>
        <Link
          href={rotaDeGestao("/cadastros?sub=parametros")}
          className="text-apoio text-acento focus-visible:ring-ring inline-flex min-h-[44px] items-center rounded-md font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
        >
          {ROTULO_ABRIR_PARAMETROS}
        </Link>
      </div>
      {poucas ? (
        <p data-testid="numeros-poucas" className="text-apoio text-tinta font-semibold">
          {poucas}
        </p>
      ) : null}
    </section>
  );
}

function BlocoOQueQueimou({ numeros }: { numeros: Numeros }) {
  const { queimou } = numeros;
  return (
    <section
      data-testid="numeros-o-que-queimou"
      className={CLASSE_DO_BLOCO}
      aria-labelledby="numeros-o-que-queimou-titulo"
    >
      <div className="flex flex-col gap-1">
        <h3 id="numeros-o-que-queimou-titulo" className={CLASSE_DO_SUBTITULO}>
          {TITULO_O_QUE_QUEIMOU}
        </h3>
        <p className="text-apoio text-tinta-fraca">{subOQueQueimou(queimou.fornadas)}</p>
      </div>
      <ul className="flex flex-col">
        <LinhaDoGrupo testId="numeros-internas" rotulo={ROTULO_INTERNAS} grupo={queimou.internas} ponto="bg-area-pecas" />
        <LinhaDoGrupo testId="numeros-externas" rotulo={ROTULO_EXTERNAS} grupo={queimou.externas} ponto="bg-area-loja" />
      </ul>
      {/* A barra é só reforço (os números estão escritos acima): `aria-hidden`; os dois segmentos não se
          distinguem por luminância (1,01:1), por isso o respiro de 4 px entre eles (UI-SPEC §Color). */}
      <div aria-hidden="true" className="bg-superficie-2 flex h-6 gap-1 overflow-hidden rounded-sm">
        {queimou.internas.total > 0 ? (
          <span className="bg-area-pecas h-full" style={{ flex: `${queimou.internas.total} 1 0%` }} />
        ) : null}
        {queimou.externas.total > 0 ? (
          <span className="bg-area-loja h-full" style={{ flex: `${queimou.externas.total} 1 0%` }} />
        ) : null}
      </div>
      <p className="text-apoio text-tinta-fraca">{DICA_O_QUE_QUEIMOU}</p>
    </section>
  );
}

// A seção com o título — o alvo do link “ver os números” (`#numeros-do-forno`), com ou sem erro.
function SecaoDosNumeros({ children }: { children: ReactNode }) {
  return (
    <section id="numeros-do-forno" data-testid="numeros-do-forno" aria-labelledby="numeros-titulo" className={CLASSE_DA_SECAO}>
      <h2 id="numeros-titulo" className={CLASSE_DO_TITULO}>
        {TITULO_NUMEROS}
      </h2>
      {children}
    </section>
  );
}

export async function NumerosDoForno({ fornoId, hoje }: { fornoId: string; hoje: string }) {
  let numeros: Numeros;
  try {
    numeros = await numerosDoForno(fornoId, hoje);
  } catch (erro) {
    console.error("Falha ao carregar os números do forno:", erro);
    return (
      <SecaoDosNumeros>
        <div
          role="alert"
          data-testid="numeros-erro"
          className="bg-superficie border-borda flex flex-col items-start gap-3 rounded-lg border p-4"
        >
          <p className="text-corpo text-tinta">{FRASE_ERRO_NUMEROS}</p>
          <TentarDeNovo />
        </div>
      </SecaoDosNumeros>
    );
  }

  return (
    <SecaoDosNumeros>
      {/* Bloco 1 nunca fica vazio: zero é dado (quadros em 0, "nenhuma neste mês"). */}
      <BlocoPorTipo numeros={numeros} hoje={hoje} />
      {numeros.queimou.fornadas === 0 ? (
        // Nenhuma contagem no forno: no lugar dos blocos 2 e 3, só o vazio tracejado (molde `.vazio`).
        <div
          data-testid="numeros-vazio"
          className="border-borda-forte text-apoio text-tinta-fraca flex flex-col gap-1 rounded-md border border-dashed p-4 text-center"
        >
          <p className="font-semibold">{VAZIO_NUMEROS_TITULO}</p>
          <p>{VAZIO_NUMEROS_CORPO}</p>
        </div>
      ) : (
        <div className={CLASSE_DAS_DUAS}>
          <BlocoCapacidade numeros={numeros} />
          <BlocoOQueQueimou numeros={numeros} />
        </div>
      )}
    </SecaoDosNumeros>
  );
}

const QUADROS = [0, 1, 2, 3] as const;

// O esqueleto do bloco “Números” (06.4-UI-SPEC.md §Carregando): título `h-6 w-32`, quatro quadros `h-28`
// na grade 2 × 2 / 4 e dois blocos `h-40` — o fallback do `Suspense` da página e o pedaço final do
// `loading.tsx` do detalhe.
export function EsqueletoDosNumerosDoForno() {
  return (
    <div aria-busy="true" data-testid="numeros-carregando" className="flex flex-col gap-4">
      <Skeleton className="h-6 w-32" />
      <div className={CLASSE_DA_GRADE}>
        {QUADROS.map((quadro) => (
          <Skeleton key={quadro} className="h-28 rounded-lg" />
        ))}
      </div>
      <div className={CLASSE_DAS_DUAS}>
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
    </div>
  );
}

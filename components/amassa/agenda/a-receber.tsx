"use client";

import { useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

import { abaDaAgendaDaUrl } from "@/lib/agenda/abas";
import type { AReceberCarregado, LinhaAReceber as DadosDaLinha } from "@/lib/agenda/consultas";
import {
  ARIA_LISTA_A_RECEBER,
  CORPO_NINGUEM_DEVENDO,
  DICA_FIM_A_RECEBER,
  FRASE_NINGUEM_DEVENDO,
  TITULO_A_RECEBER,
} from "@/lib/agenda/textos";
import { formatarReais } from "@/lib/financeiro/formato";
import { Skeleton } from "@/components/ui/skeleton";
import { EstadoVazio } from "@/components/amassa/estado-vazio";

import { FolhaRecebiAgora } from "./folha-recebi-agora";
import { LinhaAReceber } from "./linha-a-receber";
import { LoteDeMensalidades } from "./lote-de-mensalidades";

export type AReceberProps = {
  dados: AReceberCarregado;
};

// A aba “A receber” (05-UI-SPEC.md §“Aba A receber”; AGE-15 — a Agenda não guarda dinheiro): o bloco com
// o cabeçalho “A receber pela agenda” e o total à direita (Corpo 600), as linhas em ordem de vencimento
// (a ordem vem do módulo puro, `itensAReceber`), o vazio “Ninguém devendo.” com o total “R$ 0,00”, e a
// dica do fim. Logo abaixo do cabeçalho, a sanfona do lote de mensalidades (plano 12 — só com mensalidade
// livre); “Dispensadas” é do 13. A folha “Recebi agora” é uma só, aberta pela linha tocada.
export function AReceber({ dados }: AReceberProps) {
  const [aberta, setAberta] = useState<DadosDaLinha | null>(null);

  return (
    <section
      data-testid="a-receber"
      className="bg-superficie border-border flex flex-col gap-4 rounded-lg border p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-titulo text-tinta">{TITULO_A_RECEBER}</h2>
        <span data-testid="a-receber-total" className="text-corpo text-tinta font-semibold tabular-nums">
          {formatarReais(dados.totalCentavos)}
        </span>
      </div>

      <LoteDeMensalidades lote={dados.lote} />

      {dados.linhas.length === 0 ? (
        <EstadoVazio testId="a-receber-vazio" titulo={FRASE_NINGUEM_DEVENDO} corpo={CORPO_NINGUEM_DEVENDO} />
      ) : (
        <ul aria-label={ARIA_LISTA_A_RECEBER} className="divide-border flex flex-col divide-y">
          {dados.linhas.map((linha) => (
            <LinhaAReceber key={`${linha.tipo}:${linha.id}`} linha={linha} aoReceberAgora={setAberta} />
          ))}
        </ul>
      )}

      <p className="text-apoio text-tinta-fraca">{DICA_FIM_A_RECEBER}</p>

      {aberta !== null ? (
        <FolhaRecebiAgora
          key={`${aberta.tipo}:${aberta.id}`}
          cobranca={{
            tipo: aberta.tipo,
            id: aberta.id,
            nome: aberta.nome,
            descricao: aberta.subLinha,
            valorCentavos: aberta.valorCentavos,
          }}
          taxaCartaoPontosBase={dados.taxaCartaoPontosBase}
          aoFechar={() => setAberta(null)}
        />
      ) : null}
    </section>
  );
}

const LINHAS_DO_ESQUELETO = [0, 1, 2, 3] as const;

// O esqueleto de “A receber” (05-UI-SPEC.md §Carregando): cabeçalho + sanfona + 4 linhas — nunca a tela
// em branco enquanto o banco responde (CLAUDE.md §Estados).
export function EsqueletoDoAReceber() {
  return (
    <div
      className="bg-superficie border-border flex flex-col gap-4 rounded-lg border p-4"
      aria-busy="true"
      data-testid="a-receber-carregando"
    >
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-6 w-24" />
      </div>
      <Skeleton className="h-11 w-full rounded-md" />
      {LINHAS_DO_ESQUELETO.map((linha) => (
        <div key={linha} className="flex flex-col gap-2 py-2">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-20" />
          </div>
          <Skeleton className="h-4 w-56" />
          <Skeleton className="ml-auto h-11 w-32 rounded-md" />
        </div>
      ))}
    </div>
  );
}

// O `loading.tsx` da Agenda não recebe a URL: este pedaço lê `?aba=` no navegador e troca o esqueleto da
// semana (`padrao`) pelo de "A receber" quando é ela que está carregando.
export function EsqueletoPelaAba({ padrao }: { padrao: ReactNode }) {
  const parametros = useSearchParams();
  return abaDaAgendaDaUrl(parametros.get("aba") ?? undefined) === "receber" ? <EsqueletoDoAReceber /> : padrao;
}

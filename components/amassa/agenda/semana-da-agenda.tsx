"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { idDaUrl } from "@/lib/agenda/abas";
import type { EventoCarregado, EventoDaSemana } from "@/lib/agenda/consultas";
import {
  FRASE_LANCAMENTO_NAO_EXISTE,
  FRASE_NADA_MARCADO,
  ROTULO_PROXIMA_SEMANA,
  ROTULO_SEMANA_ANTERIOR,
} from "@/lib/agenda/textos";
import { cn } from "@/lib/utils";

import { CartaoEvento } from "./cartao-evento";
import { FolhaEvento } from "./folha-evento";

export type DiaDaSemanaNaTela = {
  data: string;
  rotulo: string;
  ehHoje: boolean;
  eventos: EventoDaSemana[];
};

export type SemanaDaAgendaProps = {
  titulo: string;
  semanaAnterior: string;
  proximaSemana: string;
  dias: DiaDaSemanaNaTela[];
  // O evento de `?evento=`, lido pelo servidor; `null` sem parâmetro ou quando ele não existe.
  eventoAberto: EventoCarregado | null;
  // `?evento=` com um id que não existe (link velho, removido em outro celular): toast, sem folha.
  eventoInexistente: boolean;
};

const CLASSE_DA_SETA =
  "border-borda-forte bg-superficie text-tinta hover:bg-superficie-2 inline-flex size-11 items-center justify-center rounded-md border focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none";

// A aba Agenda na vista Semana (05-UI-SPEC.md §"Aba Agenda — Semana"): a barra "‹ {título} ›" e os
// sete grupos de dia, segunda a domingo, com os cartões já ordenados pelo módulo puro.
//
// A folha do evento abre por estado na URL (`?evento={id}`, UI-D8): o "voltar" do Android a fecha,
// e um link (o Início, plano 14) a abre direto. Tocar no cartão abre a folha NA HORA, com o
// cabeçalho que o cartão já conhece e o esqueleto da lista, e pede a URL nova ao servidor
// (`router.push`) — a lista chega quando ele responde. Fechar faz o caminho inverso.
export function SemanaDaAgenda({
  titulo,
  semanaAnterior,
  proximaSemana,
  dias,
  eventoAberto,
  eventoInexistente,
}: SemanaDaAgendaProps) {
  const router = useRouter();
  const caminho = usePathname();
  const parametros = useSearchParams();
  const idNaUrl = idDaUrl(parametros.get("evento") ?? undefined);

  // O id da folha aberta e o cartão tocado (o cabeçalho enquanto a lista carrega).
  const [aberto, setAberto] = useState<string | null>(eventoAberto?.id ?? null);
  const [cartaoTocado, setCartaoTocado] = useState<EventoDaSemana | null>(null);

  // A URL manda: "voltar" do navegador tira o `?evento=` e a folha fecha; um link com `?evento=`
  // a abre.
  useEffect(() => {
    setAberto(idNaUrl);
  }, [idNaUrl]);

  function urlCom(evento: string | null): string {
    const novos = new URLSearchParams(parametros.toString());
    if (evento === null) {
      novos.delete("evento");
    } else {
      novos.set("evento", evento);
    }
    const consulta = novos.toString();
    return consulta === "" ? caminho : `${caminho}?${consulta}`;
  }

  // O toast do link velho aparece UMA vez, e o parâmetro sai da URL.
  const avisado = useRef<string | null>(null);
  useEffect(() => {
    if (eventoInexistente && idNaUrl !== null && avisado.current !== idNaUrl) {
      avisado.current = idNaUrl;
      toast(FRASE_LANCAMENTO_NAO_EXISTE);
      router.replace(urlCom(null), { scroll: false });
    }
    // `urlCom` lê os parâmetros atuais; o efeito só depende do aviso e do id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventoInexistente, idNaUrl]);

  function abrir(evento: EventoDaSemana) {
    setCartaoTocado(evento);
    setAberto(evento.id);
    router.push(urlCom(evento.id), { scroll: false });
  }

  function fechar() {
    setAberto(null);
    setCartaoTocado(null);
    router.push(urlCom(null), { scroll: false });
  }

  const carregado = eventoAberto !== null && eventoAberto.id === aberto ? eventoAberto : null;
  const cabecalho = carregado ?? (cartaoTocado !== null && cartaoTocado.id === aberto ? cartaoTocado : null);

  return (
    <div className="flex flex-col gap-4" data-testid="agenda-semana">
      <nav aria-label="Semana" className="flex flex-wrap items-center gap-2">
        <Link
          href={`${caminho}?semana=${semanaAnterior}`}
          aria-label={ROTULO_SEMANA_ANTERIOR}
          data-testid="agenda-semana-anterior"
          className={CLASSE_DA_SETA}
        >
          <ChevronLeft aria-hidden="true" />
        </Link>
        <h2
          className="text-titulo text-tinta font-semibold whitespace-nowrap tabular-nums"
          data-testid="agenda-titulo-semana"
        >
          {titulo}
        </h2>
        <Link
          href={`${caminho}?semana=${proximaSemana}`}
          aria-label={ROTULO_PROXIMA_SEMANA}
          data-testid="agenda-proxima-semana"
          className={CLASSE_DA_SETA}
        >
          <ChevronRight aria-hidden="true" />
        </Link>
      </nav>

      <div className="flex flex-col gap-4">
        {dias.map((dia) => (
          <section key={dia.data} data-testid={`agenda-dia-${dia.data}`} aria-label={dia.rotulo}>
            <h3
              className={cn(
                "text-apoio mb-2 font-semibold tracking-[0.06em] uppercase",
                dia.ehHoje ? "text-acento" : "text-tinta-media",
              )}
            >
              {dia.rotulo}
            </h3>
            {dia.eventos.length === 0 ? (
              <p className="text-apoio text-tinta-fraca pt-1 pb-2">{FRASE_NADA_MARCADO}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {dia.eventos.map((evento) => (
                  <CartaoEvento key={evento.id} evento={evento} aoTocar={abrir} />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      {aberto !== null && cabecalho !== null ? (
        <FolhaEvento cabecalho={cabecalho} carregado={carregado} aoFechar={fechar} />
      ) : null}
    </div>
  );
}

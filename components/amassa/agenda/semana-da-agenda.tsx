"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { idDaUrl } from "@/lib/agenda/abas";
import type { EventoCarregado, EventoDaSemana } from "@/lib/agenda/consultas";
import { diaDaSemanaPorExtenso } from "@/lib/agenda/semana";
import {
  FRASE_LANCAMENTO_NAO_EXISTE,
  FRASE_NADA_MARCADO,
  ROTULO_LANCAR_NO_DIA,
  rotuloLancarNoDia,
} from "@/lib/agenda/textos";
import { formatarDiaMes } from "@/lib/producao/calendario";
import { cn } from "@/lib/utils";
import { irParaSemNavegar } from "@/components/amassa/abertura/url-sem-navegar";

import { CartaoEvento } from "./cartao-evento";
import { FolhaEvento } from "./folha-evento";
import { FolhaFechado } from "./folha-fechado";
import { enderecoDaAgendaCom } from "./url-da-agenda";

export type DiaDaSemanaNaTela = {
  data: string;
  rotulo: string;
  ehHoje: boolean;
  eventos: EventoDaSemana[];
};

export type SemanaDaAgendaProps = {
  dias: DiaDaSemanaNaTela[];
  // O evento de `?evento=`, lido pelo servidor; `null` sem parâmetro ou quando ele não existe.
  eventoAberto: EventoCarregado | null;
  // `?evento=` com um id que não existe (link velho, removido em outro celular): toast, sem folha.
  eventoInexistente: boolean;
  // Ao abrir a aba sem `?semana=`, a página rola até o cabeçalho de hoje (UI-D27); `null` não rola.
  rolarAte: string | null;
};

// A aba Agenda na vista Semana (05-UI-SPEC.md §"Aba Agenda — Semana", item 3): os sete grupos de
// dia, segunda a domingo, com os cartões já ordenados pelo módulo puro e o "+ lançar" de cada dia
// (abre a folha "Lançar na agenda" com a data do dia, por `?lancar=1&dia=`). A barra de navegação
// e o "+ Lançar na agenda" moram em `BarraDaAgenda`.
//
// A folha do evento abre por estado na URL (`?evento={id}`, UI-D8): o "voltar" do Android a fecha,
// e um link (o Início, plano 14) a abre direto. Tocar no cartão abre a folha NA HORA, com o
// cabeçalho que o cartão já conhece e o esqueleto da lista, e pede a URL nova ao servidor
// (`router.push`) — a lista chega quando ele responde. Fechar faz o caminho inverso.
export function SemanaDaAgenda({
  dias,
  eventoAberto,
  eventoInexistente,
  rolarAte,
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

  // Ao abrir sem `?semana=`: rola até hoje, INSTANTÂNEO (abrir a tela não é animação — e quem pediu
  // menos movimento nunca recebe rolagem suave). Só na montagem: trocar de semana não rola de novo.
  useEffect(() => {
    if (rolarAte !== null) {
      document.getElementById(`dia-${rolarAte}`)?.scrollIntoView({ block: "start", behavior: "instant" });
    }
    // Só na montagem, de propósito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <div className="flex flex-col gap-4">
        {dias.map((dia) => (
          <section
            key={dia.data}
            id={`dia-${dia.data}`}
            data-testid={`agenda-dia-${dia.data}`}
            aria-label={dia.rotulo}
            className="scroll-mt-16 md:scroll-mt-4"
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <h3
                className={cn(
                  "text-apoio font-semibold tracking-[0.06em] uppercase",
                  dia.ehHoje ? "text-acento" : "text-tinta-media",
                )}
              >
                {dia.rotulo}
              </h3>
              <button
                type="button"
                data-testid="agenda-lancar-no-dia"
                aria-label={rotuloLancarNoDia(diaDaSemanaPorExtenso(dia.data), formatarDiaMes(dia.data))}
                onClick={() =>
                  irParaSemNavegar(enderecoDaAgendaCom({ lancar: "1", dia: dia.data, evento: null }))
                }
                className="text-apoio text-acento inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-md px-2 font-semibold focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
              >
                <Plus aria-hidden="true" className="size-4" />
                {ROTULO_LANCAR_NO_DIA}
              </button>
            </div>
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
        cabecalho.tipo === "fechado" ? (
          <FolhaFechado
            fechado={cabecalho}
            // Quem tira o bloqueio não recebe o aviso "não existe mais" do que ela mesma tirou.
            aoComecarATirar={() => {
              avisado.current = cabecalho.id;
            }}
            aoFechar={fechar}
          />
        ) : (
          <FolhaEvento cabecalho={cabecalho} carregado={carregado} aoFechar={fechar} />
        )
      ) : null}
    </div>
  );
}

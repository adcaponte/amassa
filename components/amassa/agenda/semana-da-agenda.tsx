"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { idDaUrl } from "@/lib/agenda/abas";
import type { EventoCarregado, EventoDaSemana, TurmaCarregada } from "@/lib/agenda/consultas";
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
import { FolhaTurma } from "./folha-turma";
import { enderecoDaAgendaCom } from "./url-da-agenda";

export type DiaDaSemanaNaTela = {
  data: string;
  rotulo: string;
  ehHoje: boolean;
  eventos: EventoDaSemana[];
};

// A turma de `?turma=` como o servidor a leu (D-03): nenhuma, lida, inexistente (link velho) ou com
// erro de leitura (o erro aparece dentro da folha).
export type TurmaDoServidor =
  | { estado: "nenhuma" }
  | { estado: "carregada"; turma: TurmaCarregada }
  | { estado: "inexistente"; id: string }
  | { estado: "erro"; id: string };

export type SemanaDaAgendaProps = {
  dias: DiaDaSemanaNaTela[];
  // O "hoje" de Brasília, decidido no servidor (a dica da folha da turma diz o mês atual e o próximo).
  hoje: string;
  turmaAberta: TurmaDoServidor;
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
  hoje,
  turmaAberta,
  eventoAberto,
  eventoInexistente,
  rolarAte,
}: SemanaDaAgendaProps) {
  const router = useRouter();
  const caminho = usePathname();
  const parametros = useSearchParams();
  const idNaUrl = idDaUrl(parametros.get("evento") ?? undefined);
  const idDaTurmaNaUrl = idDaUrl(parametros.get("turma") ?? undefined);

  // O id da folha aberta e o cartão tocado (o cabeçalho enquanto a lista carrega).
  const [aberto, setAberto] = useState<string | null>(eventoAberto?.id ?? null);
  const [cartaoTocado, setCartaoTocado] = useState<EventoDaSemana | null>(null);

  // A folha da turma (`?turma=`) abre NO LUGAR da folha da data (UI-D25): o nome tocado em "Abrir a
  // turma" é o cabeçalho enquanto o servidor lê o resto.
  const [turmaTocada, setTurmaTocada] = useState<{ id: string; nome: string } | null>(null);
  // O id da folha da turma aberta: muda NA HORA do toque (o cabeçalho e o esqueleto aparecem antes de
  // o servidor responder) e segue a URL depois ("voltar" do navegador fecha).
  const [turmaAbertaId, setTurmaAbertaId] = useState<string | null>(idDaTurmaNaUrl);
  useEffect(() => {
    setTurmaAbertaId(idDaTurmaNaUrl);
  }, [idDaTurmaNaUrl]);

  // A URL manda: "voltar" do navegador tira o `?evento=` e a folha fecha; um link com `?evento=`
  // a abre.
  useEffect(() => {
    setAberto(idNaUrl);
  }, [idNaUrl]);

  function urlCom(evento: string | null, turma: string | null = null): string {
    const novos = new URLSearchParams(parametros.toString());
    if (evento === null) {
      novos.delete("evento");
    } else {
      novos.set("evento", evento);
    }
    if (turma === null) {
      novos.delete("turma");
    } else {
      novos.set("turma", turma);
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

  // `?turma=` com um id que não existe (link velho): o toast, uma vez, e o parâmetro sai da URL.
  const turmaAvisada = useRef<string | null>(null);
  useEffect(() => {
    if (turmaAberta.estado === "inexistente" && turmaAvisada.current !== turmaAberta.id) {
      turmaAvisada.current = turmaAberta.id;
      toast(FRASE_LANCAMENTO_NAO_EXISTE);
      router.replace(urlCom(idNaUrl), { scroll: false });
    }
    // `urlCom` lê os parâmetros atuais; o efeito só depende da turma lida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turmaAberta]);

  function abrirTurma(turmaId: string, nome: string) {
    setTurmaTocada({ id: turmaId, nome });
    setTurmaAbertaId(turmaId);
    router.push(urlCom(idNaUrl, turmaId), { scroll: false });
  }

  function voltarAData() {
    setTurmaTocada(null);
    setTurmaAbertaId(null);
    router.push(urlCom(idNaUrl), { scroll: false });
  }

  function fecharTurma() {
    setTurmaTocada(null);
    setTurmaAbertaId(null);
    setAberto(null);
    setCartaoTocado(null);
    router.push(urlCom(null), { scroll: false });
  }

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

  // A folha da turma: a da URL (lida pelo servidor) ou a tocada agora (ainda carregando).
  const turmaCarregada =
    turmaAberta.estado === "carregada" && turmaAberta.turma.id === turmaAbertaId ? turmaAberta.turma : null;
  const erroDaTurma = turmaAberta.estado === "erro" && turmaAberta.id === turmaAbertaId;
  const cabecalhoDaTurma =
    turmaCarregada !== null
      ? { id: turmaCarregada.id, nome: turmaCarregada.nome }
      : turmaTocada !== null && turmaTocada.id === turmaAbertaId
        ? turmaTocada
        : erroDaTurma && turmaAbertaId !== null
          ? { id: turmaAbertaId, nome: "" }
          : null;

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

      {turmaAbertaId !== null && cabecalhoDaTurma !== null ? (
        <FolhaTurma
          cabecalho={cabecalhoDaTurma}
          carregada={turmaCarregada}
          erroAoCarregar={erroDaTurma}
          hoje={hoje}
          aoVoltarAData={idNaUrl !== null ? voltarAData : null}
          aoFechar={fecharTurma}
        />
      ) : aberto !== null && cabecalho !== null ? (
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
          <FolhaEvento cabecalho={cabecalho} carregado={carregado} aoFechar={fechar} aoAbrirTurma={abrirTurma} />
        )
      ) : null}
    </div>
  );
}

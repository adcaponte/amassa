"use client";

import { useMemo, useState } from "react";

import { CartaoEventoSite } from "@/components/site/cartao-evento-site";
import {
  gradeDoMes,
  tituloDoDia,
  type AgendaPublicaPronta,
  type CartaoPublico,
  type DiaPublico,
} from "@/lib/agenda/publico/agenda";

// O calendário do site (UI-D17): "Próximas · Calendário". Recebe a agenda JÁ pronta do servidor —
// trocar de mês e escolher um dia são estado de cliente sobre esses dados: nenhuma requisição por mês,
// nenhum `searchParams` na raiz (que a tornaria dinâmica). Sem JavaScript, o HTML do servidor já traz
// "Próximas" inteira.
type AgendaComEventos = Extract<AgendaPublicaPronta, { temEventos: true }>;

type Vista = "proximas" | "calendario";

const DIAS_DO_CABECALHO = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"] as const;

function botaoDaVista(marcado: boolean): string {
  return marcado
    ? "min-h-11 rounded-full bg-site-barro px-5 font-semibold text-white"
    : "min-h-11 rounded-full border border-site-borda bg-site-papel px-5 text-site-tinta-media";
}

function ListaDeCartoes({ cartoes, duasColunas }: { cartoes: CartaoPublico[]; duasColunas: boolean }) {
  return (
    <div className={duasColunas ? "grid items-start gap-4 md:grid-cols-2 md:gap-6" : "flex flex-col gap-4"}>
      {cartoes.map((cartao) => (
        <CartaoEventoSite key={cartao.chave} cartao={cartao} />
      ))}
    </div>
  );
}

function Pontos({ dia }: { dia: DiaPublico }) {
  return (
    <span className="flex flex-wrap justify-center gap-1" aria-hidden="true">
      {dia.fechado ? <span className="size-2 rounded-full bg-site-tinta-fraca" /> : null}
      {dia.cartoes.map((cartao) => {
        if (cartao.esgotado) {
          return <span key={cartao.chave} className="size-2 rounded-full border border-site-tinta-fraca" />;
        }
        return cartao.tipo === "turma" ? (
          <span key={cartao.chave} className="size-2 rounded-full bg-site-folha" />
        ) : (
          <span key={cartao.chave} className="size-2 rounded-full border border-site-tinta-fraca bg-site-sol" />
        );
      })}
    </span>
  );
}

function rotuloDaCelula(dia: DiaPublico, nomeDoMes: string): string {
  const [, , diaDoMes] = dia.data.split("-");
  const base = `${tituloDoDia(dia.data).split(",")[0]}, ${Number(diaDoMes)} de ${nomeDoMes.split(" ")[0]}`;
  if (dia.fechado && dia.cartoes.length === 0) {
    return `${base}: fechado`;
  }
  const esgotados = dia.cartoes.some((cartao) => cartao.esgotado) ? " + esgotado" : "";
  const fechado = dia.fechado ? ", fechado" : "";
  return `${base}: ${dia.cartoes.length} aulas e oficinas${esgotados}${fechado}`;
}

export function AgendaPublicaCalendario({ agenda }: { agenda: AgendaComEventos }) {
  const [vista, setVista] = useState<Vista>("proximas");
  const [indiceDoMes, setIndiceDoMes] = useState(0);
  const [diaEscolhido, setDiaEscolhido] = useState<string | null>(null);

  const diaPorData = useMemo(() => new Map(agenda.dias.map((dia) => [dia.data, dia])), [agenda.dias]);
  const mes = agenda.meses[indiceDoMes];
  const ultimoIndice = agenda.meses.length - 1;
  const escolhido = diaEscolhido === null ? null : (diaPorData.get(diaEscolhido) ?? null);

  function trocarDeMes(passo: number) {
    setIndiceDoMes((atual) => Math.min(ultimoIndice, Math.max(0, atual + passo)));
    setDiaEscolhido(null);
  }

  return (
    <div data-testid="site-agenda-viva" className="mt-8">
      <div role="tablist" aria-label="Ver a agenda como" data-testid="site-alternador" className="flex gap-2">
        <button
          type="button"
          role="tab"
          aria-selected={vista === "proximas"}
          className={botaoDaVista(vista === "proximas")}
          onClick={() => setVista("proximas")}
        >
          Próximas
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={vista === "calendario"}
          className={botaoDaVista(vista === "calendario")}
          onClick={() => setVista("calendario")}
        >
          Calendário
        </button>
      </div>

      {vista === "proximas" ? (
        <div role="tabpanel" data-testid="site-proximas" className="mt-6">
          <ListaDeCartoes cartoes={agenda.proximas} duasColunas />
          {agenda.restantes > 0 ? (
            <button
              type="button"
              className="mt-4 min-h-11 rounded-full border-[1.5px] border-site-barro px-[18px] text-[15px] font-semibold text-site-barro"
              onClick={() => setVista("calendario")}
            >
              e mais {agenda.restantes} no calendário
            </button>
          ) : null}
        </div>
      ) : (
        <div
          role="tabpanel"
          data-testid="site-calendario"
          className="mt-6 grid items-start gap-6 min-[880px]:grid-cols-[1fr_1.15fr] min-[880px]:gap-8"
        >
          <div className="rounded-[14px] border border-site-borda bg-site-fundo p-4">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                aria-label="Mês anterior"
                aria-disabled={indiceDoMes === 0}
                disabled={indiceDoMes === 0}
                onClick={() => trocarDeMes(-1)}
                className="flex size-11 items-center justify-center rounded-full border border-site-borda bg-site-papel disabled:opacity-40"
              >
                ‹
              </button>
              <p className="font-semibold text-site-tinta">{mes.nome}</p>
              <button
                type="button"
                aria-label="Próximo mês"
                aria-disabled={indiceDoMes === ultimoIndice}
                disabled={indiceDoMes === ultimoIndice}
                onClick={() => trocarDeMes(1)}
                className="flex size-11 items-center justify-center rounded-full border border-site-borda bg-site-papel disabled:opacity-40"
              >
                ›
                {indiceDoMes === ultimoIndice ? (
                  <span className="sr-only">a agenda do site vai até {agenda.meses[ultimoIndice].nome}</span>
                ) : null}
              </button>
            </div>

            <div className="mt-3 grid grid-cols-7 gap-1 text-center text-sm">
              {DIAS_DO_CABECALHO.map((nome) => (
                <span key={nome} className="font-semibold text-site-tinta-fraca">
                  {nome}
                </span>
              ))}
              {gradeDoMes(mes.chave).map((data, indice) => {
                if (data === null) {
                  return <span key={`vazia-${indice}`} />;
                }
                const dia = diaPorData.get(data);
                const numero = Number(data.slice(8));
                if (dia === undefined) {
                  return (
                    <span key={data} className="flex min-h-[48px] items-start justify-center pt-1 text-site-tinta-fraca">
                      {numero}
                    </span>
                  );
                }
                const marcada = diaEscolhido === data;
                return (
                  <button
                    key={data}
                    type="button"
                    aria-label={rotuloDaCelula(dia, mes.nome)}
                    aria-pressed={marcada}
                    data-testid="site-dia"
                    data-data={data}
                    onClick={() => setDiaEscolhido(marcada ? null : data)}
                    className={`flex min-h-[48px] min-w-0 flex-col items-center gap-1 rounded-[8px] bg-site-papel pt-1 text-site-tinta ${
                      marcada ? "border-2 border-site-barro" : "border border-transparent"
                    }`}
                  >
                    {numero}
                    <Pontos dia={dia} />
                  </button>
                );
              })}
            </div>

            <p className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-site-tinta-fraca">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-site-folha" aria-hidden="true" /> turma fixa
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full border border-site-tinta-fraca bg-site-sol" aria-hidden="true" /> oficina
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full border border-site-tinta-fraca" aria-hidden="true" /> esgotado
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-site-tinta-fraca" aria-hidden="true" /> fechado
              </span>
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <p className="font-semibold text-site-tinta">
              {escolhido === null ? `Em ${mes.nome.split(" ")[0]}` : tituloDoDia(escolhido.data)}
            </p>
            {escolhido === null ? (
              mes.cartoes.length === 0 ? (
                <p className="text-site-tinta-fraca">Nada marcado neste mês ainda.</p>
              ) : (
                <ListaDeCartoes cartoes={mes.cartoes} duasColunas={false} />
              )
            ) : (
              <>
                {escolhido.fechado ? <p className="text-site-tinta-fraca">Fechado neste dia.</p> : null}
                <ListaDeCartoes cartoes={escolhido.cartoes} duasColunas={false} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

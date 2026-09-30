"use client";

import { useState, type ReactNode } from "react";

import type { OrdemEmAndamento } from "@/lib/producao/consultas";
import type { FornadasEstimadas } from "@/lib/producao/forno";
import type { LeituraDaOrdem, Selo } from "@/lib/producao/leitura";
import {
  colunasDoQuadro,
  filtrarOrdens,
  numerosDoTopo,
  type FiltroDoQuadro,
  type VistaDaProducao,
} from "@/lib/producao/quadro";
import {
  CORPO_FILTRO_VAZIO,
  ROTULO_VER_TUDO,
  TITULO_FILTRO_VAZIO,
} from "@/lib/producao/textos";
import { Button } from "@/components/ui/button";
import { EstadoVazio } from "@/components/amassa/estado-vazio";

import { AlternadorVista, ID_DO_PAINEL_DA_VISTA, idDaAba } from "./alternador-vista";
import { LinhaDoTempo, type LinhaNaLinhaDoTempo } from "./linha-do-tempo";
import { PilulasFiltro } from "./pilulas-filtro";
import { QuadroProducao, type ColunaNoQuadro } from "./quadro-producao";
import { SecaoAguardando } from "./secao-aguardando";
import { TresNumeros } from "./tres-numeros";

// A leitura de uma ordem LIBERADA, decidida no servidor com o "hoje" de Brasília — o cliente nunca
// decide o dia.
export type LeituraNoPainel = {
  leitura: Extract<LeituraDaOrdem, { tipo: "em-andamento" }>;
  selo: Selo;
};

export type PainelProducaoProps = {
  // As ordens liberadas e aguardando, como a consulta as trouxe (a página já tirou o vazio total).
  ordens: OrdemEmAndamento[];
  // Por id, a leitura e o selo de cada ordem liberada.
  leituras: Record<string, LeituraNoPainel>;
  // As fornadas da fila do forno em cada filtro — calculadas no servidor com o "cabem" da
  // Precificação (`cabemPorFicha` + `fornadasEstimadas`); o cliente só escolhe qual mostrar.
  fornadasPorFiltro: Record<FiltroDoQuadro, FornadasEstimadas>;
  // O que vem embaixo de tudo ("Ver concluídas e canceladas (N)"), fora do filtro.
  rodape?: ReactNode;
  // A vista com que a página abre — lida do cookie `producao_vista` no servidor (plano 09, UI-D18),
  // para nunca pintar o quadro e trocar depois.
  vistaInicial: VistaDaProducao;
  // "Hoje" de Brasília, decidido no servidor — a linha do tempo desenha a partir dele.
  hoje: string;
};

// O painel da Produção (UI-SPEC §"Página `/gestao/producao`" itens 2-7; PRD-05, PRD-07, PRD-13):
// guarda o filtro "Tudo · Encomendas · Da casa" — estado do cliente, começa em "Tudo", não vai para
// a URL — e a vista "Quadro por etapa · Linha do tempo" (começa na do cookie). O filtro vale para os
// três números, para a vista e para a seção "Aguardando o sinal", que aparece nas duas vistas.
// Trocar filtro ou vista não faz consulta nova: tudo sai das ordens que o Server Component carregou.
export function PainelProducao({
  ordens,
  leituras,
  fornadasPorFiltro,
  rodape,
  vistaInicial,
  hoje,
}: PainelProducaoProps) {
  const [filtro, setFiltro] = useState<FiltroDoQuadro>("todas");
  const [vista, setVista] = useState<VistaDaProducao>(vistaInicial);

  const filtradas = filtrarOrdens(ordens, filtro);
  const numeros = numerosDoTopo(filtradas, fornadasPorFiltro[filtro]);
  const ativas = filtradas.filter((ordem) => ordem.status === "ativa");
  const aguardando = filtradas.filter((ordem) => ordem.status === "aguardando_sinal");
  const colunas: ColunaNoQuadro[] = colunasDoQuadro(ativas).map((coluna) => ({
    etapa: coluna.etapa,
    ordens: coluna.ordens.flatMap((ordem) => {
      const lida = leituras[ordem.id];
      return lida ? [{ ordem, leitura: lida.leitura, selo: lida.selo }] : [];
    }),
  }));
  const linhasDoTempo: LinhaNaLinhaDoTempo[] = ativas.flatMap((ordem) => {
    const lida = leituras[ordem.id];
    return lida ? [{ ordem, leitura: lida.leitura, selo: lida.selo }] : [];
  });

  return (
    <div className="flex flex-col px-6 pt-4 pb-6 md:px-8">
      <PilulasFiltro filtro={filtro} aoMudar={setFiltro} />
      <div className="mt-4">
        <TresNumeros numeros={numeros} />
      </div>
      <div className="mt-8">
        <AlternadorVista vista={vista} aoMudar={setVista} />
      </div>
      <div
        role="tabpanel"
        id={ID_DO_PAINEL_DA_VISTA}
        aria-labelledby={idDaAba(vista)}
        data-testid="producao-painel-vista"
        data-vista={vista}
        className="mt-4"
      >
        {filtro !== "todas" && filtradas.length === 0 ? (
          <EstadoVazio
            titulo={TITULO_FILTRO_VAZIO[filtro]}
            corpo={CORPO_FILTRO_VAZIO}
            testId="producao-vazio-filtro"
            botao={
              <Button
                type="button"
                variant="outline"
                data-testid="producao-ver-tudo"
                className="text-corpo h-auto min-h-[44px] px-4 font-semibold"
                onClick={() => setFiltro("todas")}
              >
                {ROTULO_VER_TUDO}
              </Button>
            }
          />
        ) : vista === "tempo" ? (
          // A `key` do filtro remonta a linha do tempo ao trocar de filtro: o intervalo muda, e a
          // rolagem inicial recentra em hoje.
          <LinhaDoTempo
            key={filtro}
            linhas={linhasDoTempo}
            hoje={hoje}
            temAguardando={aguardando.length > 0}
          />
        ) : (
          <QuadroProducao colunas={colunas} />
        )}
      </div>
      {aguardando.length > 0 ? (
        <div className="mt-6">
          <SecaoAguardando ordens={aguardando} />
        </div>
      ) : null}
      {rodape ? <div className="mt-6">{rodape}</div> : null}
    </div>
  );
}

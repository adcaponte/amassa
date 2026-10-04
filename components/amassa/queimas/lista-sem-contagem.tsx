"use client";

import { useState } from "react";
import Link from "next/link";

import type { DadosDaFolha, QueimaSemContagem } from "@/lib/queimas/consultas";
import { diaMes, type ModoSemContagem } from "@/lib/queimas/contagem";
import {
  ROTULO_CONTAR_AGORA,
  ROTULO_VER_SO_AS_RECENTES,
  ROTULO_VER_TODAS_SEM_CONTAGEM,
  SUB_SEM_CONTAGEM,
  TITULO_SEM_CONTAGEM,
  ariaContarAgora,
  fraseMaisSemContagem,
  fraseTodasSemContagem,
  tituloDaQueima,
} from "@/lib/queimas/textos";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import { Button } from "@/components/ui/button";

import { FolhaContagem, type QueimaParaContar } from "./folha-contagem";

export type ListaSemContagemProps = {
  linhas: QueimaSemContagem[];
  maisAntigas: number;
  maisDeUmForno: boolean;
  // `null` = os dados da folha não carregaram: o "Contar agora" não aparece (UI-D19).
  dadosDaFolha: DadosDaFolha | null;
  // A visão da lista (plano 03): "recentes" (a janela de 30 dias, até 20) ou "todas". Vem da URL
  // (`?sem-contagem=todas`), lida uma vez pela página — nenhum estado aqui, então o
  // `router.refresh()` de quem salva uma contagem mantém a visão.
  semContagem: ModoSemContagem;
};

// O link da casa (o desenho do "abrir o Catálogo"): Apoio 600, `text-acento`, 44 px.
const CLASSE_DO_LINK =
  "text-apoio text-acento focus-visible:ring-ring inline-flex min-h-[44px] items-center font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none";

// A âncora da seção — o "Ver todas" volta a ela depois de navegar.
const ANCORA = "queimas-sem-contagem";

// A seção "Sem contagem" do índice (06.4-UI-SPEC.md §"Linha “Sem contagem”"; QMC-02): as queimas que
// ficaram só com o registro ("Pular" ou registradas antes da fase), na janela de `janelaSemContagem`.
// "Contar agora" abre a MESMA folha do registro para aquela queima; ao salvar, a folha recarrega a
// página e a linha some. Bloco no molde `AReceber` da Agenda; linha no molde `LinhaAReceber`.
//
// Por que existe o "Ver todas" (plano 03; o item travado "Pular não perde nada"): a visão padrão só
// mostra os últimos 30 dias, até 20 linhas, e o Histórico do detalhe só as 25 últimas de cada forno —
// sem este caminho, uma queima pulada há mais de 30 dias (e fora das 25 do forno) ficava sem "Contar
// agora". A visão de todas mostra TODAS as sem contagem, de todos os fornos, sem janela e sem teto,
// a mais recente primeiro.
export function ListaSemContagem({
  linhas,
  maisAntigas,
  maisDeUmForno,
  dadosDaFolha,
  semContagem,
}: ListaSemContagemProps) {
  const [folha, setFolha] = useState<
    (QueimaParaContar & { fornoId: string; fornoNome: string }) | null
  >(null);
  const todas = semContagem === "todas";

  return (
    <section
      id={ANCORA}
      data-testid="queimas-sem-contagem"
      data-modo={semContagem}
      aria-labelledby="titulo-sem-contagem"
      className="bg-superficie border-border flex scroll-mt-4 flex-col gap-4 rounded-lg border p-4"
    >
      <div className="flex flex-col gap-1">
        <h2 id="titulo-sem-contagem" className="text-titulo text-tinta">
          {TITULO_SEM_CONTAGEM}
        </h2>
        {todas ? (
          <>
            <p data-testid="sem-contagem-todas" className="text-apoio text-tinta-fraca">
              {fraseTodasSemContagem(linhas.length)}
            </p>
            <Link
              href={rotaDeGestao("/queimas")}
              data-testid="sem-contagem-ver-recentes"
              className={`${CLASSE_DO_LINK} self-start`}
            >
              {ROTULO_VER_SO_AS_RECENTES}
            </Link>
          </>
        ) : null}
      </div>
      {linhas.length > 0 ? (
        <ul aria-label={TITULO_SEM_CONTAGEM} className="divide-border flex flex-col divide-y">
          {linhas.map((queima) => {
            const titulo = tituloDaQueima(
              queima.tipo,
              diaMes(queima.diaCivil),
              maisDeUmForno ? queima.fornoNome : null,
            );
            return (
              <li
                key={queima.id}
                data-testid="sem-contagem-linha"
                data-queima-id={queima.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-2"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="text-corpo text-tinta font-semibold [overflow-wrap:anywhere]">
                    {titulo}
                  </span>
                  <span className="text-apoio text-tinta-fraca">{SUB_SEM_CONTAGEM}</span>
                </div>
                {dadosDaFolha === null ? null : (
                  <Button
                    type="button"
                    variant="outline"
                    data-testid="contar-agora"
                    aria-label={ariaContarAgora(titulo)}
                    onClick={() =>
                      setFolha({
                        id: queima.id,
                        tipo: queima.tipo,
                        ocorridaEm: queima.ocorridaEm,
                        fornoId: queima.fornoId,
                        fornoNome: queima.fornoNome,
                      })
                    }
                    className="text-corpo h-auto min-h-[44px] px-4 font-semibold"
                  >
                    {ROTULO_CONTAR_AGORA}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
      {!todas && maisAntigas > 0 ? (
        <div className="flex flex-wrap items-center gap-x-2">
          <p data-testid="sem-contagem-mais" className="text-apoio text-tinta-fraca">
            {fraseMaisSemContagem(maisAntigas)}
          </p>
          <Link
            href={`${rotaDeGestao("/queimas?sem-contagem=todas")}#${ANCORA}`}
            data-testid="sem-contagem-ver-todas"
            className={CLASSE_DO_LINK}
          >
            {ROTULO_VER_TODAS_SEM_CONTAGEM}
          </Link>
        </div>
      ) : null}
      {dadosDaFolha === null ? null : (
        <FolhaContagem
          queima={folha}
          aoFechar={() => setFolha(null)}
          dados={dadosDaFolha}
          nomeDoForno={folha?.fornoNome ?? ""}
          fornoId={folha?.fornoId ?? ""}
        />
      )}
    </section>
  );
}

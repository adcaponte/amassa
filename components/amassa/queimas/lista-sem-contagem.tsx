"use client";

import { useState } from "react";

import type { QueimaSemContagem } from "@/lib/queimas/consultas";
import { diaMes } from "@/lib/queimas/contagem";
import {
  ROTULO_CONTAR_AGORA,
  SUB_SEM_CONTAGEM,
  TITULO_SEM_CONTAGEM,
  ariaContarAgora,
  fraseMaisSemContagem,
  tituloDaQueima,
} from "@/lib/queimas/textos";
import { Button } from "@/components/ui/button";

import { FolhaContagem, type QueimaParaContar } from "./folha-contagem";

export type ListaSemContagemProps = {
  linhas: QueimaSemContagem[];
  maisAntigas: number;
  maisDeUmForno: boolean;
};

// A seção "Sem contagem" do índice (06.4-UI-SPEC.md §"Linha “Sem contagem”"; QMC-02): as queimas que
// ficaram só com o registro ("Pular" ou registradas antes da fase), na janela de `janelaSemContagem`.
// "Contar agora" abre a MESMA folha do registro para aquela queima; ao salvar, a folha recarrega a
// página e a linha some. Bloco no molde `AReceber` da Agenda; linha no molde `LinhaAReceber`.
export function ListaSemContagem({ linhas, maisAntigas, maisDeUmForno }: ListaSemContagemProps) {
  const [folha, setFolha] = useState<QueimaParaContar | null>(null);

  return (
    <section
      data-testid="queimas-sem-contagem"
      aria-labelledby="titulo-sem-contagem"
      className="bg-superficie border-border flex flex-col gap-4 rounded-lg border p-4"
    >
      <h2 id="titulo-sem-contagem" className="text-titulo text-tinta">
        {TITULO_SEM_CONTAGEM}
      </h2>
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
                <Button
                  type="button"
                  variant="outline"
                  data-testid="contar-agora"
                  aria-label={ariaContarAgora(titulo)}
                  onClick={() =>
                    setFolha({ id: queima.id, tipo: queima.tipo, ocorridaEm: queima.ocorridaEm })
                  }
                  className="text-corpo h-auto min-h-[44px] px-4 font-semibold"
                >
                  {ROTULO_CONTAR_AGORA}
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {maisAntigas > 0 ? (
        <p data-testid="sem-contagem-mais" className="text-apoio text-tinta-fraca">
          {fraseMaisSemContagem(maisAntigas)}
        </p>
      ) : null}
      <FolhaContagem queima={folha} aoFechar={() => setFolha(null)} />
    </section>
  );
}

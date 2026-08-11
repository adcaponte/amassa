"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import type { QueimaDoHistorico } from "@/lib/queimas/consultas";
import { formatarInstanteCurto } from "@/lib/queimas/formato";
import { FRASE_SEM_QUEIMAS, ROTULO_AUTOR_DESCONHECIDO, rotuloDoTipo } from "@/lib/queimas/textos";

import { ConfirmarExcluirQueima } from "./confirmar-excluir-queima";

export type HistoricoQueimasProps = {
  queimas: QueimaDoHistorico[];
  nomeDoForno: string;
};

// Cor de TIPO (`--color-biscoito`/`-esmalte`/`-ouro`) — nunca a cor de NÍVEL do forno
// (`--color-forno-*`): as duas nunca se misturam (04-UI-SPEC.md §Color, `04-DESIGN-SYSTEM.md`
// §3). Um ponto discreto ao lado do rótulo do tipo — a cor é informação (qual tipo), não
// decoração.
function corDoTipo(tipo: QueimaDoHistorico["tipo"]): string {
  switch (tipo) {
    case "biscoito":
      return "bg-biscoito";
    case "esmalte":
      return "bg-esmalte";
    case "ouro":
      return "bg-ouro";
    default: {
      const _exaustivo: never = tipo;
      throw new Error(`corDoTipo: tipo de queima não tratado: ${JSON.stringify(_exaustivo)}`);
    }
  }
}

// O histórico das últimas 25 queimas (E6, FOR-09) — a lista já vem ordenada e limitada pela
// consulta (`buscarForno`); este componente NÃO corta nada por conta própria. `"use client"`
// (achado desta tarefa): o controle de exclusão de cada linha precisa de estado local para saber
// QUAL queima está com o dialog de confirmação aberto — um único `ConfirmarExcluirQueima` é
// montado, reaproveitado entre as linhas pelo `id` corrente, em vez de um dialog por linha.
export function HistoricoQueimas({ queimas, nomeDoForno }: HistoricoQueimasProps) {
  const [idParaExcluir, setIdParaExcluir] = useState<string | null>(null);

  if (queimas.length === 0) {
    return (
      <p className="text-apoio text-muted-foreground" data-testid="historico-queimas-vazio">
        {FRASE_SEM_QUEIMAS}
      </p>
    );
  }

  return (
    <>
      <ul className="flex flex-col" data-testid="lista-historico-queimas">
        {queimas.map((queima) => (
          <li
            key={queima.id}
            data-testid={`linha-queima-${queima.id}`}
            className="border-border flex items-center justify-between gap-3 border-b py-3 last:border-b-0"
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span
                aria-hidden="true"
                className={`size-2.5 shrink-0 rounded-full ${corDoTipo(queima.tipo)}`}
              />
              <div className="flex min-w-0 flex-col">
                <span className="text-corpo text-foreground">{rotuloDoTipo(queima.tipo)}</span>
                <span className="text-apoio text-muted-foreground break-words">
                  {formatarInstanteCurto(queima.ocorridaEm)} ·{" "}
                  {queima.registradoPorNome ?? ROTULO_AUTOR_DESCONHECIDO}
                </span>
              </div>
            </div>

            {/* Alvo de 44px (`size-11`); `aria-label` nomeia data e tipo — nunca um "Excluir"
                genérico que o leitor de tela não consegue distinguir entre 25 linhas. */}
            <button
              type="button"
              aria-label={`Excluir queima de ${rotuloDoTipo(queima.tipo)} em ${formatarInstanteCurto(queima.ocorridaEm)}`}
              onClick={() => setIdParaExcluir(queima.id)}
              className="hover:bg-muted flex size-11 shrink-0 items-center justify-center rounded-md"
              data-testid={`excluir-queima-${queima.id}`}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      <ConfirmarExcluirQueima
        id={idParaExcluir ?? ""}
        nomeDoForno={nomeDoForno}
        aberto={idParaExcluir !== null}
        aoMudarAberto={(aberto) => {
          if (!aberto) {
            setIdParaExcluir(null);
          }
        }}
      />
    </>
  );
}

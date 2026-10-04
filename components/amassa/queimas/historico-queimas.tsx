"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import type { DadosDaFolha, QueimaDoHistorico } from "@/lib/queimas/consultas";
import { totalDaContagem, type Contagem } from "@/lib/queimas/contagem";
import { formatarInstanteCurto } from "@/lib/queimas/formato";
import {
  FRASE_SEM_CONTAGEM_HISTORICO,
  FRASE_SEM_QUEIMAS,
  ROTULO_AUTOR_DESCONHECIDO,
  ROTULO_CONTAR_AGORA,
  ROTULO_CORRIGIR_CONTAGEM,
  TAG_NAO_SAIU_CHEIO,
  chipDaContagem,
  resumoDaContagem,
  rotuloDoTipo,
  type GrupoDoContador,
} from "@/lib/queimas/textos";
import { Button } from "@/components/ui/button";

import { ConfirmarExcluirQueima } from "./confirmar-excluir-queima";
import { FolhaContagem, type QueimaParaContar } from "./folha-contagem";

export type HistoricoQueimasProps = {
  queimas: QueimaDoHistorico[];
  nomeDoForno: string;
  // Os dados da folha "O que queimou?", carregados uma vez pela página. `null` = não carregaram: os
  // botões de contar e corrigir não aparecem (UI-D19); a lixeira continua.
  dadosDaFolha: DadosDaFolha | null;
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

function quantidadesDoGrupo(contagem: Contagem, grupo: GrupoDoContador) {
  return grupo === "internas"
    ? { p: contagem.internasP, m: contagem.internasM, g: contagem.internasG }
    : { p: contagem.externasP, m: contagem.externasM, g: contagem.externasG };
}

const GRUPOS: readonly GrupoDoContador[] = ["internas", "externas"];

type FolhaDoHistorico = QueimaParaContar & { inicial: Contagem | null };

// O histórico das últimas 25 queimas (E6, FOR-09) — a lista já vem ordenada e limitada pela
// consulta (`buscarForno`); este componente NÃO corta nada por conta própria. `"use client"`: a
// exclusão de cada linha e a folha de contagem precisam de estado local — um único
// `ConfirmarExcluirQueima` e uma única `FolhaContagem` são montados, reaproveitados entre as linhas.
//
// Fase 06.4 (UI-D20, QMC-02): a linha é reescrita para mostrar a contagem — tipo e total na 1ª fileira,
// data · autor na 2ª, os chips por grupo (ou "sem contagem") na 3ª, a tag "não saiu cheio" (nunca em
// ouro) quando houver, e na última "Corrigir contagem" (abre a folha com os valores gravados e "Fechar
// sem salvar") ou "Contar agora", com a lixeira herdada à direita. Forno desativado: contar e corrigir
// continuam (é dado do passado). Nenhum `<li>` aninhado — os testes da Fase 4 contam as linhas por `li`.
export function HistoricoQueimas({ queimas, nomeDoForno, dadosDaFolha }: HistoricoQueimasProps) {
  const [idParaExcluir, setIdParaExcluir] = useState<string | null>(null);
  const [folha, setFolha] = useState<FolhaDoHistorico | null>(null);

  if (queimas.length === 0) {
    return (
      <p className="text-apoio text-muted-foreground" data-testid="historico-queimas-vazio">
        {FRASE_SEM_QUEIMAS}
      </p>
    );
  }

  const queimaParaExcluir = queimas.find((queima) => queima.id === idParaExcluir) ?? null;

  return (
    <>
      <ul className="flex flex-col" data-testid="lista-historico-queimas">
        {queimas.map((queima) => {
          const contagem = queima.contagem;
          const chips =
            contagem === null
              ? []
              : GRUPOS.flatMap((grupo) => {
                  const texto = chipDaContagem(grupo, quantidadesDoGrupo(contagem, grupo));
                  return texto === null ? [] : [{ grupo, texto }];
                });
          const naoSaiuCheio = contagem !== null && !contagem.saiuCheio && queima.tipo !== "ouro";
          const quando = formatarInstanteCurto(queima.ocorridaEm);

          return (
            <li
              key={queima.id}
              data-testid={`linha-queima-${queima.id}`}
              className="border-border grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-1 border-b py-2 last:border-b-0"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`size-2.5 shrink-0 rounded-full ${corDoTipo(queima.tipo)}`}
                />
                <span className="text-corpo text-foreground">{rotuloDoTipo(queima.tipo)}</span>
              </div>
              <span
                data-testid={`historico-total-${queima.id}`}
                className="text-corpo text-tinta font-semibold whitespace-nowrap tabular-nums"
              >
                {contagem === null ? "—" : resumoDaContagem(totalDaContagem(contagem))}
              </span>

              <span className="text-apoio text-muted-foreground col-span-2 break-words">
                {quando} · {queima.registradoPorNome ?? ROTULO_AUTOR_DESCONHECIDO}
              </span>

              <div
                data-testid={`historico-contagem-${queima.id}`}
                className="col-span-2 flex flex-wrap gap-2"
              >
                {contagem === null ? (
                  <span className="text-apoio text-tinta-fraca">{FRASE_SEM_CONTAGEM_HISTORICO}</span>
                ) : (
                  chips.map((chip) => (
                    <span
                      key={chip.grupo}
                      className="bg-superficie-2 text-tinta-media text-apoio inline-flex items-center gap-1 rounded-sm px-2"
                    >
                      <span
                        aria-hidden="true"
                        className={`size-2 shrink-0 rounded-full ${
                          chip.grupo === "internas" ? "bg-area-pecas" : "bg-area-loja"
                        }`}
                      />
                      {chip.texto}
                    </span>
                  ))
                )}
              </div>

              {naoSaiuCheio ? (
                <div className="col-span-2 flex flex-wrap gap-2">
                  <span className="bg-superficie-2 text-tinta-media text-apoio rounded-sm px-2">
                    {TAG_NAO_SAIU_CHEIO}
                  </span>
                </div>
              ) : null}

              <div className="col-span-2 flex items-center gap-2 pt-1">
                {dadosDaFolha === null ? null : (
                  <Button
                    type="button"
                    variant="outline"
                    data-testid={
                      contagem === null ? `contar-agora-${queima.id}` : `corrigir-contagem-${queima.id}`
                    }
                    onClick={() =>
                      setFolha({
                        id: queima.id,
                        tipo: queima.tipo,
                        ocorridaEm: queima.ocorridaEm,
                        inicial: contagem,
                      })
                    }
                    className="text-corpo h-auto min-h-[44px] px-4 font-semibold"
                  >
                    {contagem === null ? ROTULO_CONTAR_AGORA : ROTULO_CORRIGIR_CONTAGEM}
                  </Button>
                )}

                {/* Alvo de 44px (`size-11`); `aria-label` nomeia data e tipo — nunca um "Excluir"
                    genérico que o leitor de tela não consegue distinguir entre 25 linhas. */}
                <button
                  type="button"
                  aria-label={`Excluir queima de ${rotuloDoTipo(queima.tipo)} em ${quando}`}
                  onClick={() => setIdParaExcluir(queima.id)}
                  className="hover:bg-muted ml-auto flex size-11 shrink-0 items-center justify-center rounded-md"
                  data-testid={`excluir-queima-${queima.id}`}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <ConfirmarExcluirQueima
        id={idParaExcluir ?? ""}
        nomeDoForno={nomeDoForno}
        pecasContadas={
          queimaParaExcluir?.contagem ? totalDaContagem(queimaParaExcluir.contagem) : null
        }
        aberto={idParaExcluir !== null}
        aoMudarAberto={(aberto) => {
          if (!aberto) {
            setIdParaExcluir(null);
          }
        }}
      />

      {dadosDaFolha === null ? null : (
        <FolhaContagem
          queima={folha}
          aoFechar={() => setFolha(null)}
          dados={dadosDaFolha}
          nomeDoForno={nomeDoForno}
          inicial={folha?.inicial ?? null}
        />
      )}
    </>
  );
}

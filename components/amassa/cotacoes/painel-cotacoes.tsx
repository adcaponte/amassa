"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import type { Cotacao } from "@/lib/cotacoes/consultas";
import { ordenarCotacoes, type OrdemDasCotacoes } from "@/lib/cotacoes/ordenacao";
import {
  ROTULO_COMPARAR_SELECIONADOS,
  ROTULO_NOVA_COTACAO,
  ROTULO_POR_ORDEM,
  ROTULO_VOLTAR_A_LISTA,
  proximaOrdemDasCotacoes,
  rotuloAcessivelBotaoOrdem,
} from "@/lib/cotacoes/textos";
import { useAbridorDeCotacoes } from "@/components/amassa/cotacoes/contexto-cotacoes";
import { irParaSemNavegar } from "@/components/amassa/abertura/url-sem-navegar";
import { ComparacaoCotacoes } from "@/components/amassa/cotacoes/comparacao-cotacoes";
import { ListaCotacoes } from "@/components/amassa/cotacoes/lista-cotacoes";
import { Button } from "@/components/ui/button";

export type PainelCotacoesProps = {
  categoriaId: string;
  categoriaNome: string;
  cotacoes: Cotacao[];
};

// Client Component: o DONO do estado de cliente da aba Cotações — a ordem, o conjunto de
// marcados para comparar e o modo (lista/comparação). A ordenação (plano 03) e a comparação
// lado a lado (plano 04) ainda não desenham nada com este estado, mas ele já mora aqui: é essa
// escolha que impede que trocar a ordem custe uma navegação e apague a marcação feita antes.
//
// Nesta Tarefa: a barra do protótipo (contagem à esquerda, botão terracota de nova cotação à
// direita) e a lista, delegada a `ListaCotacoes`.
export function PainelCotacoes({ categoriaId, categoriaNome, cotacoes }: PainelCotacoesProps) {
  const abridor = useAbridorDeCotacoes();

  // Trocar de CATEGORIA zera a marcação (mesmo comportamento do protótipo) — como este
  // componente é remontado a cada categoria (a `key` vem de `categoriaId` em `page.tsx`), o
  // `useState` já nasce vazio a cada troca, sem efeito extra.
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(new Set());

  // Tarefa 1 (04.3-04, D-11): a ordem também mora AQUI, no cliente, no mesmo componente que
  // guarda a marcação — nunca na URL. Se morasse na URL, trocar a ordem seria uma navegação real
  // de servidor: o componente remontaria e a marcação feita antes sumiria (D-23). O padrão é
  // "cadastro" (UI-SPEC §Assunções item 7), igual ao protótipo.
  const [ordem, setOrdem] = useState<OrdemDasCotacoes>("cadastro");

  // Tarefa 3 (04.3-04, D-13): o MODO (lista ↔ comparação) é a terceira fatia de estado que mora
  // aqui, no mesmo componente da ordem e da marcação — trocar de modo é troca de estado de
  // cliente, instantânea, sem navegação. Trocar de CATEGORIA também zera o modo (a `key` de
  // `categoriaId` remonta o componente).
  const [modo, setModo] = useState<"lista" | "comparar">("lista");

  function alternarMarcacao(id: string) {
    setMarcados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) {
        proximo.delete(id);
      } else {
        proximo.add(id);
      }
      return proximo;
    });
  }

  // O CÁLCULO é a função pura já provada de `lib/cotacoes/ordenacao.ts` (plano 01) — nenhuma
  // segunda versão da regra, nenhum `.sort` escrito neste componente. `useMemo` evita reordenar a
  // cada tecla digitada em outro campo da tela (a lista só muda quando as cotações ou a ordem
  // mudam).
  const cotacoesOrdenadas = useMemo(() => ordenarCotacoes(cotacoes, ordem), [cotacoes, ordem]);

  // As cotações MARCADAS, na MESMA ordem que a lista está mostrando — a comparação nunca
  // reordena por conta própria (key_links do plano: o cálculo é sempre sobre o dado que o
  // cliente já tem).
  const cotacoesMarcadas = useMemo(
    () => cotacoesOrdenadas.filter((cotacao) => marcados.has(cotacao.id)),
    [cotacoesOrdenadas, marcados],
  );

  const hrefNovaCotacao = `/abertura?aba=cotacoes&categoria=${categoriaId}&cotacao=novo`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* Nada quando a categoria está vazia (Tarefa 1, 04.3-02) — o estado vazio de
            `ListaCotacoes` já fala por essa situação; mostrar "0 cotações" aqui seria repetir a
            mesma informação duas vezes na mesma tela. A contagem de MARCADAS (Tarefa 3) aparece
            ao lado, no formato do protótipo — só quando há pelo menos uma marcada. */}
        {cotacoes.length > 0 && (
          <span className="text-apoio text-muted-foreground mr-auto" data-testid="cotacoes-contagem">
            {cotacoes.length} {cotacoes.length === 1 ? "cotação" : "cotações"}
            {cotacoesMarcadas.length > 0 &&
              ` · ${cotacoesMarcadas.length} marcada${cotacoesMarcadas.length > 1 ? "s" : ""}`}
          </span>
        )}

        {/* Botão SECUNDÁRIO (nunca terracota — o único terracota desta tela é "+ Nova cotação",
            04-DESIGN-SYSTEM.md §3). Alterna entre os três estados de `OrdemDasCotacoes`; o texto
            visível é o nome curto do estado ATUAL, o `aria-label` diz o estado e o que o toque
            vai fazer (nunca só o verbo solto). Escondido no modo comparação — ordenar é uma
            operação da LISTA. */}
        {modo === "lista" && cotacoes.length > 1 && (
          <Button
            type="button"
            variant="secondary"
            className="min-h-[44px]"
            data-testid="cotacoes-ordenar"
            aria-label={rotuloAcessivelBotaoOrdem(ordem)}
            onClick={() => setOrdem((atual) => proximaOrdemDasCotacoes(atual))}
          >
            {ROTULO_POR_ORDEM[ordem]}
          </Button>
        )}

        {/* Tarefa 3 (04.3-04, D-13): alterna entre comparar os marcados e voltar à lista — botão
            SECUNDÁRIO que reflete o modo atual (nunca terracota). Troca de modo é troca de estado
            de cliente: instantânea, sem navegação. */}
        {cotacoes.length > 1 && (
          <Button
            type="button"
            variant="secondary"
            className="min-h-[44px]"
            data-testid="cotacoes-comparar"
            aria-pressed={modo === "comparar"}
            onClick={() => setModo((atual) => (atual === "comparar" ? "lista" : "comparar"))}
          >
            {modo === "comparar" ? ROTULO_VOLTAR_A_LISTA : ROTULO_COMPARAR_SELECIONADOS}
          </Button>
        )}

        <Button asChild variant="default" className="min-h-[44px]">
          <Link
            href={hrefNovaCotacao}
            onClick={(evento) => {
              evento.preventDefault();
              irParaSemNavegar(hrefNovaCotacao);
              abridor.abrirCotacao(null);
            }}
          >
            {ROTULO_NOVA_COTACAO}
          </Link>
        </Button>
      </div>

      {modo === "comparar" ? (
        <ComparacaoCotacoes cotacoes={cotacoesMarcadas} categoriaId={categoriaId} />
      ) : (
        <ListaCotacoes
          cotacoes={cotacoesOrdenadas}
          categoriaId={categoriaId}
          categoriaNome={categoriaNome}
          marcados={marcados}
          aoAlternarMarcacao={alternarMarcacao}
        />
      )}
    </div>
  );
}

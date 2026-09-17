"use client";

import { useState } from "react";
import Link from "next/link";

import type { Cotacao } from "@/lib/cotacoes/consultas";
import { ROTULO_NOVA_COTACAO } from "@/lib/cotacoes/textos";
import { useAbridorDeCotacoes } from "@/components/amassa/cotacoes/contexto-cotacoes";
import { irParaSemNavegar } from "@/components/amassa/abertura/url-sem-navegar";
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

  const hrefNovaCotacao = `/abertura?aba=cotacoes&categoria=${categoriaId}&cotacao=novo`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        {/* Nada quando a categoria está vazia (Tarefa 1, 04.3-02) — o estado vazio de
            `ListaCotacoes` já fala por essa situação; mostrar "0 cotações" aqui seria repetir a
            mesma informação duas vezes na mesma tela. */}
        {cotacoes.length > 0 && (
          <span className="text-apoio text-muted-foreground mr-auto" data-testid="cotacoes-contagem">
            {cotacoes.length} {cotacoes.length === 1 ? "cotação" : "cotações"}
          </span>
        )}

        <Button asChild variant="default" className="ml-auto min-h-[44px]">
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

      <ListaCotacoes
        cotacoes={cotacoes}
        categoriaId={categoriaId}
        categoriaNome={categoriaNome}
        marcados={marcados}
        aoAlternarMarcacao={alternarMarcacao}
      />
    </div>
  );
}

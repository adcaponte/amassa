"use client";

import { useState } from "react";

import type { FornoMedido } from "@/lib/queimas/consultas";
import { filtrarPorAtivo, type FiltroDeForno } from "@/lib/queimas/filtros";
import {
  FRASE_FILTRO_VAZIO_CORPO,
  FRASE_FILTRO_VAZIO_TITULO,
  ROTULO_FILTRO_ATIVOS,
} from "@/lib/queimas/textos";
import { EstadoVazio } from "@/components/amassa/estado-vazio";

import { CartaoForno } from "./cartao-forno";
import { FiltroFornos } from "./filtro-fornos";

export type ListaFornosProps = {
  fornos: FornoMedido[];
};

// Grade no desktop, cartões empilhados em largura total no celular (`04-DESIGN-SYSTEM.md` §6,
// molde de `lista-encomendas.tsx`). Um único forno ocupa a largura toda em vez de deixar
// meia-grade órfã no desktop (E1/zero-one-many).
//
// Client Component desde o plano 04-05 (D-05): o filtro Ativos/Desativados/Todos roda no
// CLIENTE, sobre a MESMA lista já carregada pelo servidor (D-11 da Fase 3) — trocar de filtro
// nunca dispara uma nova consulta nem muda de URL. "Ativos" nasce como padrão a cada carga da
// página; recarregar perde o filtro (mesmo comportamento de D-12 de Encomendas). O BANNER de
// `app/(app)/queimas/page.tsx` é calculado sobre a lista COMPLETA, fora deste componente — trocar
// o filtro aqui nunca esconde um forno em atenção do aviso do topo.
export function ListaFornos({ fornos }: ListaFornosProps) {
  const [filtro, setFiltro] = useState<FiltroDeForno>("ativos");

  const fornosFiltrados = filtrarPorAtivo(fornos, filtro);
  const umUnicoForno = fornosFiltrados.length === 1;

  return (
    <div className="flex flex-col gap-4 py-6">
      <FiltroFornos filtro={filtro} aoMudarFiltro={setFiltro} />

      {fornosFiltrados.length === 0 ? (
        // Vazio FILTRADO — distinto do `EstadoVazio` de "Nenhum forno cadastrado ainda." que
        // `app/(app)/queimas/page.tsx` mostra quando não existe NENHUM forno. `aoClicar` (não
        // `hrefBotao`): zerar o filtro é ação de cliente, não muda de URL.
        <EstadoVazio
          titulo={FRASE_FILTRO_VAZIO_TITULO}
          corpo={FRASE_FILTRO_VAZIO_CORPO}
          rotuloBotao={ROTULO_FILTRO_ATIVOS}
          aoClicar={() => setFiltro("ativos")}
        />
      ) : (
        <div
          className="grid grid-cols-1 gap-4 px-6 md:grid-cols-2 md:px-8"
          data-testid="lista-fornos"
        >
          {fornosFiltrados.map((forno) => (
            <div key={forno.id} className={umUnicoForno ? "md:col-span-2" : undefined}>
              <CartaoForno forno={forno} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

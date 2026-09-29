"use client";

import { useMemo, useState } from "react";

import { formatarReais } from "@/lib/financeiro/formato";
import type { AreaFinanceira } from "@/lib/financeiro/textos";
import type { SaldoDoItem } from "@/lib/estoque/consultas";
import {
  areasComMaterial,
  contadorDaLista,
  filtrarSaldos,
  normalizarBusca,
  ordenarSaldos,
  type FiltroDeSituacao,
} from "@/lib/estoque/saldo";
import {
  CORPO_NADA_ACABANDO,
  CORPO_NADA_COM_FILTRO,
  CORPO_NENHUM_DESATIVADO,
  NOTA_SALDOS_AJUSTE,
  NOTA_SALDOS_ANTES_DO_AJUSTE,
  NOTA_SALDOS_DEPOIS_DO_AJUSTE,
  NOTA_SALDOS_DESTAQUE,
  ROTULO_LIMPAR_FILTROS,
  ROTULO_VER_TODOS,
  TITULO_NADA_ACABANDO,
  TITULO_NADA_COM_FILTRO,
  TITULO_NENHUM_DESATIVADO,
} from "@/lib/estoque/textos";
import { Button } from "@/components/ui/button";
import { EstadoVazio } from "@/components/amassa/estado-vazio";

import { BannerEstoque } from "./banner-estoque";
import { BarraFerramentasSaldos } from "./barra-ferramentas-saldos";
import { CartaoSaldo } from "./cartao-saldo";
import { FiltroSituacao } from "./filtro-situacao";
import { useEstoque } from "./provedor-estoque";
import { TabelaSaldos } from "./tabela-saldos";

export type AbaSaldosProps = {
  saldos: readonly SaldoDoItem[];
  // `?acabando=1` na URL — o "Ver só esses" do banner e o "e mais N" do Início (plano 06-10).
  acabandoInicial: boolean;
};

// Mantém `?acabando=1` na URL em sincronia com a pílula, SEM ida ao servidor: o filtro roda no
// cliente sobre a lista já carregada (UI-SPEC, Assunção 8). O Next 15 integra
// `window.history.replaceState` ao roteador — nenhuma consulta nova, nenhum esqueleto piscando.
function sincronizarAcabandoNaUrl(ligado: boolean): void {
  const url = new URL(window.location.href);
  if (ligado) {
    url.searchParams.set("acabando", "1");
  } else {
    url.searchParams.delete("acabando");
  }
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

type TipoDeVazio = "filtro" | "acabando" | "desativados";

// A aba Saldos (UI-SPEC §Aba Saldos): banner, barra de ferramentas, cartões abaixo de 980px e
// tabela a partir de 980px, o filtro de situação no fim e a nota de rodapé. Toda classificação vem
// de `lib/estoque/saldo.ts` (`ordenarSaldos`, `filtrarSaldos`, `resumoDoBanner` via banner,
// `contadorDaLista`) — nenhum componente compara saldo com mínimo por conta própria.
//
// "Dar baixa" abre a folha de movimentação em Saída pelo `ProvedorDoEstoque` (plano 06-06) — o
// único lugar que abre folha nesta página; é o toque 1 dos 4 da baixa (EST-09).
export function AbaSaldos({ saldos, acabandoInicial }: AbaSaldosProps) {
  const [busca, setBusca] = useState("");
  const [area, setArea] = useState<AreaFinanceira | null>(null);
  const [acabando, setAcabando] = useState(acabandoInicial);
  const [situacao, setSituacao] = useState<FiltroDeSituacao>("ativos");
  const { abrirFolha } = useEstoque();

  // Ordena UMA vez: filtrar depois nunca reordena (EST-03 · ordering).
  const ordenados = useMemo(() => ordenarSaldos(saldos), [saldos]);
  const areas = useMemo(() => areasComMaterial(saldos), [saldos]);

  const daSituacao = filtrarSaldos(ordenados, { busca: "", area: null, acabando: false, situacao });
  const visiveis = filtrarSaldos(ordenados, { busca, area, acabando, situacao });
  const contador = contadorDaLista(visiveis.length, daSituacao, formatarReais);

  function darBaixa(saldo: SaldoDoItem) {
    abrirFolha({ itemId: saldo.id, tipo: "saida" });
  }

  function mudarAcabando(ligado: boolean) {
    setAcabando(ligado);
    sincronizarAcabandoNaUrl(ligado);
  }

  // "Ver só esses" (banner): Acabando ligado, sobre todas as áreas — como no protótipo.
  function verSoEsses() {
    setArea(null);
    setSituacao("ativos");
    mudarAcabando(true);
  }

  function limparFiltros() {
    setBusca("");
    setArea(null);
    mudarAcabando(false);
    // Com nenhum material ativo, "Ativos" continuaria vazio: limpa para "Todos".
    setSituacao(saldos.some((saldo) => saldo.ativo) ? "ativos" : "todos");
  }

  // Qual dos vazios nomeados mostrar (UI-SPEC §Estados vazios): busca/área primeiro — é o filtro
  // mais recente do gesto; depois "Acabando"; depois "Desativados".
  const tipoDeVazio: TipoDeVazio =
    normalizarBusca(busca) !== "" || area !== null
      ? "filtro"
      : acabando
        ? "acabando"
        : situacao === "desativados"
          ? "desativados"
          : "filtro";

  return (
    <>
      <BannerEstoque saldos={saldos} aoVerSoEsses={verSoEsses} />

      <div className="flex flex-col gap-4 px-6 py-8 md:px-8">
        <BarraFerramentasSaldos
          busca={busca}
          aoMudarBusca={setBusca}
          areas={areas}
          area={area}
          aoMudarArea={setArea}
          acabando={acabando}
          aoMudarAcabando={mudarAcabando}
          contador={contador}
        />

        {visiveis.length === 0 ? (
          tipoDeVazio === "acabando" ? (
            <EstadoVazio
              titulo={TITULO_NADA_ACABANDO}
              corpo={CORPO_NADA_ACABANDO}
              testId="estoque-vazio-acabando"
              botao={
                <Button
                  type="button"
                  variant="outline"
                  className="text-corpo min-h-[44px] px-4 font-semibold"
                  onClick={() => mudarAcabando(false)}
                >
                  {ROTULO_VER_TODOS}
                </Button>
              }
            />
          ) : tipoDeVazio === "desativados" ? (
            <EstadoVazio
              titulo={TITULO_NENHUM_DESATIVADO}
              corpo={CORPO_NENHUM_DESATIVADO}
              testId="estoque-vazio-desativados"
            />
          ) : (
            <EstadoVazio
              titulo={TITULO_NADA_COM_FILTRO}
              corpo={CORPO_NADA_COM_FILTRO}
              testId="estoque-vazio-filtro"
              botao={
                <Button
                  type="button"
                  variant="outline"
                  className="text-corpo min-h-[44px] px-4 font-semibold"
                  onClick={limparFiltros}
                >
                  {ROTULO_LIMPAR_FILTROS}
                </Button>
              }
            />
          )
        ) : (
          <>
            <ul className="flex flex-col gap-2 min-[980px]:hidden" aria-label="Saldos do estoque">
              {visiveis.map((saldo) => (
                <li key={saldo.id}>
                  <CartaoSaldo saldo={saldo} aoDarBaixa={darBaixa} />
                </li>
              ))}
            </ul>
            <TabelaSaldos saldos={visiveis} aoDarBaixa={darBaixa} />
          </>
        )}

        <FiltroSituacao filtro={situacao} aoMudarFiltro={setSituacao} />

        <p className="text-apoio text-tinta-media bg-superficie-2 rounded-lg p-4">
          <strong className="font-semibold">{NOTA_SALDOS_DESTAQUE}</strong>
          {NOTA_SALDOS_ANTES_DO_AJUSTE}
          <em>{NOTA_SALDOS_AJUSTE}</em>
          {NOTA_SALDOS_DEPOIS_DO_AJUSTE}
        </p>
      </div>
    </>
  );
}

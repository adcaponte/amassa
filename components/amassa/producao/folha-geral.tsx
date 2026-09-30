import type { CSSProperties } from "react";

import type { EtapaProducao } from "@/lib/producao/etapas";
import type { FolhaGeral } from "@/lib/producao/folhas";
import {
  CABECALHO_FOLHA_GERAL,
  CHIP_DA_CASA,
  OLHO_FOLHA_GERAL,
  SR_CAIXA_FEITO,
  SUB_FOLHA_GERAL,
  TITULO_AGUARDANDO_NA_FOLHA,
  TITULO_FOLHA_GERAL,
  pecas,
  srContadorDaSecao,
  textoEntregaNaFolhaGeral,
  textoJaPassaramNaFolha,
  textoNestaEtapaNaFolha,
  textoTotaisDaFolhaGeral,
} from "@/lib/producao/textos";

import { MarcaDaFolha, RodapeDaFolha, TituloDeSecao, corDaEtapa } from "./folha-da-ordem";
import estilos from "./folha-a4.module.css";

// O contador da seção: fundo da etapa e texto branco — na secagem (#C9B896, claro demais para o
// branco: 1,94:1) a tinta escura. A MESMA regra do bloco Produção do Início; `tests/unit/
// contraste.test.ts` lê este arquivo e cobra as duas pontas dela (Q13).
function corDoContador(etapa: EtapaProducao): CSSProperties {
  return {
    background: `var(--color-${etapa})`,
    color: etapa === "secagem" ? "#3A331F" : "#FFFFFF",
  };
}

// A folha geral A4 (PRD-20, UI-SPEC §"Folhas A4" → "Folha geral") — o quadro no papel, para a
// parede: uma seção por etapa, na ordem, SÓ as que têm ordem; "Aguardando sinal" no fim. Mostra
// sempre todas as ordens, independente do filtro da tela. Server Component puro.
//
// Nenhum elemento `header` nem de navegação aqui dentro: a regra de impressão de `app/globals.css`
// esconde TODO `header` no papel (UI-D20) — o cabeçalho da folha é um `<div>`.
export function FolhaGeralA4({
  folha,
  hoje,
}: {
  folha: FolhaGeral;
  // "30/09/2026" — a data do cabeçalho e do rodapé ("folha impressa em").
  hoje: string;
}) {
  return (
    <article data-testid="folha-geral" className={`${estilos.folha} text-apoio`}>
      <MarcaDaFolha />

      {/* 1. Cabeçalho. */}
      <div className={estilos.cabecalho}>
        <div className={estilos.cabecalhoTexto}>
          <p className={`${estilos.caixaAlta} text-apoio text-acento font-semibold`}>
            {OLHO_FOLHA_GERAL}
          </p>
          <h1 data-testid="folha-geral-titulo" className="text-display text-tinta">
            {TITULO_FOLHA_GERAL}
          </h1>
          <p className="text-corpo text-tinta-media">{SUB_FOLHA_GERAL}</p>
        </div>
        <div className={estilos.cabecalhoDireita}>
          <p className={`${estilos.numero} text-corpo text-tinta font-semibold`}>{hoje}</p>
          <p data-testid="folha-geral-totais" className={`${estilos.numero} text-apoio text-tinta-fraca`}>
            {textoTotaisDaFolhaGeral(folha.totalOrdens, folha.totalPecas)}
          </p>
        </div>
      </div>

      {/* 2. Uma seção por etapa com ordem, na ordem das etapas. */}
      {folha.secoes.map((secao) => (
        <section
          key={secao.etapa}
          data-testid={`folha-geral-secao-${secao.etapa}`}
          data-etapa={secao.etapa}
          aria-labelledby={`folha-geral-secao-${secao.etapa}-titulo`}
          className={estilos.bloco}
        >
          <h2
            id={`folha-geral-secao-${secao.etapa}-titulo`}
            className={`${estilos.secao} ${estilos.secaoEtapa} ${estilos.caixaAlta} text-apoio font-semibold`}
          >
            <span
              aria-hidden="true"
              data-etapa={secao.etapa}
              style={corDaEtapa(secao.etapa)}
              className={estilos.ponto}
            />
            {secao.rotulo}
            <span style={corDoContador(secao.etapa)} className={estilos.contador}>
              <span aria-hidden="true">{secao.linhas.length}</span>
              <span className="sr-only">{srContadorDaSecao(secao.linhas.length)}</span>
            </span>
          </h2>
          <table className={`${estilos.tabela} ${estilos.zebra}`}>
            <colgroup>
              <col style={{ width: "36%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "16%" }} />
              <col />
            </colgroup>
            <thead>
              <tr>
                {CABECALHO_FOLHA_GERAL.map((titulo) => (
                  <th key={titulo} scope="col">
                    {titulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {secao.linhas.map((linha) => (
                <tr key={linha.id} data-testid="folha-geral-linha" data-ordem-id={linha.id}>
                  <td>
                    <span className="text-tinta block font-semibold">{linha.nome}</span>
                    <span className="text-tinta-fraca block">
                      {linha.daCasa ? CHIP_DA_CASA : (linha.clienteNome ?? "—")}
                    </span>
                  </td>
                  <td className={estilos.numero}>
                    <span className="block">{linha.pecas}</span>
                    {linha.passaram !== null ? (
                      <span className="text-tinta-fraca block">
                        {textoJaPassaramNaFolha(linha.passaram)}
                      </span>
                    ) : null}
                  </td>
                  <td className={estilos.numero}>
                    {textoNestaEtapaNaFolha(linha.diasNestaEtapa, linha.previsto)}
                  </td>
                  <td className={estilos.numero}>{linha.entrega ?? "—"}</td>
                  <td>
                    <span
                      aria-hidden="true"
                      data-etapa={secao.etapa}
                      style={corDaEtapa(secao.etapa)}
                      className={estilos.caixa}
                    />
                    <span className="sr-only">{SR_CAIXA_FEITO}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      {/* 3. Aguardando sinal — sempre por último, só quando houver. Tabela sem cabeçalho. */}
      {folha.aguardando.length > 0 ? (
        <section
          data-testid="folha-geral-aguardando"
          aria-labelledby="folha-geral-aguardando-titulo"
          className={estilos.bloco}
        >
          <TituloDeSecao id="folha-geral-aguardando-titulo">{TITULO_AGUARDANDO_NA_FOLHA}</TituloDeSecao>
          <table className={`${estilos.tabela} ${estilos.zebra}`}>
            <colgroup>
              <col style={{ width: "50%" }} />
              <col style={{ width: "20%" }} />
              <col />
            </colgroup>
            <tbody>
              {folha.aguardando.map((linha) => (
                <tr key={linha.id} data-testid="folha-geral-linha" data-ordem-id={linha.id}>
                  <td>
                    <span className="text-tinta block font-semibold">{linha.nome}</span>
                    <span className="text-tinta-fraca block">
                      {linha.daCasa ? CHIP_DA_CASA : (linha.clienteNome ?? "—")}
                    </span>
                  </td>
                  <td className={estilos.numero}>{pecas(linha.pecas)}</td>
                  <td className={estilos.numero}>
                    {linha.entrega ? textoEntregaNaFolhaGeral(linha.entrega) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {/* 4. Rodapé. */}
      <RodapeDaFolha impressaEm={hoje} />
    </article>
  );
}

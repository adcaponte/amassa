import type { CSSProperties, ReactNode } from "react";

import type { EtapaProducao } from "@/lib/producao/etapas";
import type { FolhaDaOrdem } from "@/lib/producao/folhas";
import {
  CABECALHO_ETAPAS_DA_FOLHA,
  CABECALHO_PECAS_DA_FOLHA,
  DICA_MATERIAL_NA_FOLHA,
  FRASE_SEM_MATERIAL_NA_FOLHA,
  MARCA_DA_FOLHA,
  ROTULO_BOAS,
  ROTULO_DO_MATERIAL,
  ROTULO_EXTRAS_BOAS,
  ROTULO_PERDIDAS,
  ROTULO_SELO_ENTREGA,
  SR_CAIXA_DA_ETAPA,
  SR_ETAPA_A_FAZER,
  SR_ETAPA_FEITA,
  SR_LINHA_DE_ESCREVER,
  SUB_MARCA_DA_FOLHA,
  TEXTO_AINDA_NAO_COMECOU,
  TEXTO_PARA,
  TEXTO_PARA_A_CASA,
  TITULO_ANOTACOES,
  TITULO_ETAPAS,
  TITULO_MATERIAL_PREVISTO,
  TITULO_NO_FIM,
  TITULO_REFERENCIAS,
  altDaFotoDeReferencia,
  dias,
  textoDetalheDaPecaNaFolha,
  textoInicioNaFolha,
  textoOlhoDaOrdem,
  textoOrcamentoDaOrigem,
  textoRodapeDaFolha,
  textoSemFichaNaFolha,
} from "@/lib/producao/textos";
import { rotaDeGestao } from "@/lib/rotas/gestao";

import { Logo } from "@/components/amassa/logo";

import estilos from "./folha-a4.module.css";

// ---------------------------------------------------------------------------------------------
// Partes comuns às duas folhas (a geral, `folha-geral.tsx`, importa daqui).
// ---------------------------------------------------------------------------------------------

// A cor da etapa para o CSS da folha (`var(--c)`): o token da etapa, nunca um hex.
export function corDaEtapa(etapa: EtapaProducao): CSSProperties {
  return { "--c": `var(--color-${etapa})` } as CSSProperties;
}

// A marca: o `Logo` da plataforma + "AMASSA CERRADO" e "ateliê · produção".
export function MarcaDaFolha() {
  return (
    <div className={estilos.marca}>
      <Logo className={estilos.logo} />
      <div className="flex flex-col">
        <span className={`${estilos.marcaNome} text-titulo text-acento`}>{MARCA_DA_FOLHA}</span>
        <span className={`${estilos.caixaAlta} text-apoio text-tinta-fraca font-semibold`}>
          {SUB_MARCA_DA_FOLHA}
        </span>
      </div>
    </div>
  );
}

// Título de seção: caixa alta, fio até a borda, nunca órfão no pé da página.
export function TituloDeSecao({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className={`${estilos.secao} ${estilos.caixaAlta} text-apoio text-acento font-semibold`}>
      {children}
    </h2>
  );
}

export function RodapeDaFolha({ impressaEm }: { impressaEm: string }) {
  return (
    <p data-testid="folha-rodape" className={`${estilos.rodape} text-apoio`}>
      {textoRodapeDaFolha(impressaEm)}
    </p>
  );
}

// A folha da ordem A4 (PRD-19, UI-SPEC §"Folhas A4" → "Folha da ordem", itens 1-8) — folha de
// BANCADA: o que a mesa precisa (peças, a mais, argila, medidas, fotos, etapas para marcar à mão) e
// nenhum número de dinheiro — o tipo `FolhaDaOrdem` não tem onde carregá-lo. Server Component puro.
//
// Nenhum elemento `header` nem de navegação aqui dentro: a regra de impressão de `app/globals.css`
// esconde TODO `header` no papel (UI-D20) — o cabeçalho da folha é um `<div>`.
export function FolhaDaOrdemA4({ folha, impressaEm }: { folha: FolhaDaOrdem; impressaEm: string }) {
  const daCasa = folha.tipo === "casa";
  return (
    <article data-testid="folha-ordem" className={`${estilos.folha} text-apoio`}>
      <MarcaDaFolha />

      {/* 1. Cabeçalho em duas pontas. */}
      <div className={estilos.cabecalho}>
        <div className={estilos.cabecalhoTexto}>
          <p
            data-testid="folha-ordem-olho"
            className={`${estilos.caixaAlta} text-apoio text-acento font-semibold`}
          >
            {textoOlhoDaOrdem(folha.tipo, folha.numero)}
          </p>
          <h1 data-testid="folha-ordem-nome" className="text-display text-tinta">
            {folha.nome}
          </h1>
          <p data-testid="folha-ordem-para" className="text-corpo text-tinta-media">
            {daCasa ? (
              TEXTO_PARA_A_CASA
            ) : (
              <>
                {TEXTO_PARA} <span className="font-semibold">{folha.clienteNome ?? "—"}</span>
              </>
            )}
            {folha.orcamentoNumero ? ` · ${textoOrcamentoDaOrigem(folha.orcamentoNumero)}` : null}
          </p>
        </div>
        <div className={estilos.cabecalhoDireita}>
          {folha.entrega ? (
            <span data-testid="folha-ordem-entrega" className={estilos.seloEntrega}>
              <span className={`${estilos.caixaAlta} text-apoio text-acento font-semibold`}>
                {ROTULO_SELO_ENTREGA}
              </span>
              <span className={`${estilos.numero} text-titulo text-tinta`}>{folha.entrega}</span>
            </span>
          ) : null}
          <p data-testid="folha-ordem-inicio" className={`${estilos.numero} text-apoio text-tinta-fraca`}>
            {folha.inicio ? textoInicioNaFolha(folha.inicio) : TEXTO_AINDA_NAO_COMECOU}
          </p>
        </div>
      </div>

      {/* 2. Régua das etapas do caminho. */}
      <div className={estilos.regua} aria-hidden="true">
        {folha.regua.map((etapa) => (
          <span
            key={etapa.etapa}
            data-etapa={etapa.etapa}
            data-estado={etapa.estado}
            style={corDaEtapa(etapa.etapa)}
            className={estilos.reguaEtapa}
          >
            {etapa.rotulo}
          </span>
        ))}
      </div>

      {/* 3. Peças. */}
      <table data-testid="folha-ordem-pecas" className={`${estilos.tabela} ${estilos.zebra}`}>
        <colgroup>
          <col style={{ width: "32%" }} />
          <col style={{ width: "11%" }} />
          <col style={{ width: "11%" }} />
          <col style={{ width: "11%" }} />
          <col style={{ width: "13%" }} />
          <col style={{ width: "22%" }} />
        </colgroup>
        <thead>
          <tr>
            {CABECALHO_PECAS_DA_FOLHA.map((titulo) => (
              <th key={titulo} scope="col">
                {titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {folha.pecas.map((peca, indice) => {
            const detalhe = textoDetalheDaPecaNaFolha(peca.cor, peca.personalizacao);
            return (
              <tr key={indice} data-testid="folha-ordem-peca">
                <td>
                  <span className="text-tinta font-semibold">{peca.descricao}</span>
                  {detalhe ? <span className="text-tinta-fraca block">{detalhe}</span> : null}
                </td>
                <td className={estilos.numero}>{peca.pedido}</td>
                <td className={estilos.numero}>{peca.aMais}</td>
                <td className={`${estilos.numero} font-semibold`}>{peca.fazer}</td>
                <td className={estilos.numero}>{peca.argila}</td>
                <td className={estilos.numero}>{peca.medidas}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* 4. Referências — só com foto. Altura fixa: a foto nunca empurra a folha para outra página. */}
      {folha.fotos.length > 0 ? (
        <div data-testid="folha-ordem-referencias" className={estilos.bloco}>
          <TituloDeSecao>{TITULO_REFERENCIAS}</TituloDeSecao>
          <div className={estilos.referencias}>
            {folha.fotos.map((fotoId, indice) => (
              // `<img>` puro, como no bloco Peças: a rota autenticada já serve o arquivo.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={fotoId}
                src={`${rotaDeGestao("/api/orcamentos/fotos")}/${fotoId}`}
                alt={altDaFotoDeReferencia(indice + 1, folha.fotos.length)}
                width={112}
                height={112}
                className={`${estilos.foto} text-apoio text-tinta-fraca`}
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* 5. Etapas — a caixa de marcar à mão, o previsto, a data (ou a linha de escrever). */}
      <TituloDeSecao>{TITULO_ETAPAS}</TituloDeSecao>
      <table data-testid="folha-ordem-etapas" className={estilos.tabela}>
        <colgroup>
          <col className={estilos.colunaCaixa} />
          <col style={{ width: "34%" }} />
          <col style={{ width: "18%" }} />
          <col style={{ width: "22%" }} />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">{SR_CAIXA_DA_ETAPA}</span>
            </th>
            {CABECALHO_ETAPAS_DA_FOLHA.map((titulo) => (
              <th key={titulo} scope="col">
                {titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {folha.etapas.map((etapa) => (
            <tr key={etapa.etapa} data-testid="folha-ordem-etapa" data-feita={etapa.feita}>
              <td>
                <span
                  aria-hidden="true"
                  data-etapa={etapa.etapa}
                  data-feita={etapa.feita}
                  style={corDaEtapa(etapa.etapa)}
                  className={estilos.caixa}
                >
                  {etapa.feita ? "✓" : null}
                </span>
                <span className="sr-only">{etapa.feita ? SR_ETAPA_FEITA : SR_ETAPA_A_FAZER}</span>
              </td>
              <td>
                <span className="inline-flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    data-etapa={etapa.etapa}
                    style={corDaEtapa(etapa.etapa)}
                    className={estilos.ponto}
                  />
                  <span className="text-tinta font-semibold">{etapa.rotulo}</span>
                </span>
              </td>
              <td className={estilos.numero}>{dias(etapa.diasPrevistos)}</td>
              <td className={estilos.numero}>
                {etapa.feitaEm ?? (
                  <span className={estilos.escrever}>
                    <span className="sr-only">{SR_LINHA_DE_ESCREVER}</span>
                  </span>
                )}
              </td>
              <td>
                <span className={estilos.escrever}>
                  <span className="sr-only">{SR_LINHA_DE_ESCREVER}</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 6. Material previsto · No fim. */}
      <div className={estilos.duasColunas}>
        <div data-testid="folha-ordem-material">
          <TituloDeSecao>{TITULO_MATERIAL_PREVISTO}</TituloDeSecao>
          {folha.material.tipo === "sem-ficha" ? (
            <p className="text-tinta-media">{FRASE_SEM_MATERIAL_NA_FOLHA}</p>
          ) : (
            <>
              <p>
                {ROTULO_DO_MATERIAL.argila}:{" "}
                <span className={`${estilos.numero} font-semibold`}>{folha.material.argilaKg} kg</span>
              </p>
              {folha.material.esmalteKg ? (
                <p>
                  {ROTULO_DO_MATERIAL.esmalte}:{" "}
                  <span className={`${estilos.numero} font-semibold`}>
                    {folha.material.esmalteKg} kg
                  </span>
                </p>
              ) : null}
              {folha.material.pecasSemFicha > 0 ? (
                <p className="text-tinta-fraca">{textoSemFichaNaFolha(folha.material.pecasSemFicha)}</p>
              ) : null}
              <p className="text-tinta-fraca">{DICA_MATERIAL_NA_FOLHA}</p>
            </>
          )}
        </div>
        <div data-testid="folha-ordem-no-fim">
          <TituloDeSecao>{TITULO_NO_FIM}</TituloDeSecao>
          <p className="py-1">
            {ROTULO_PERDIDAS}: <span className={estilos.linhaCurta} />
          </p>
          <p className="py-1">
            {folha.noFim === "boas" ? ROTULO_BOAS : ROTULO_EXTRAS_BOAS}:{" "}
            <span className={estilos.linhaCurta} />
          </p>
        </div>
      </div>

      {/* 7. Anotações. */}
      <div className={estilos.bloco}>
        <TituloDeSecao>{TITULO_ANOTACOES}</TituloDeSecao>
        <div className={estilos.pauta} />
      </div>

      {/* 8. Rodapé. */}
      <RodapeDaFolha impressaEm={impressaEm} />
    </article>
  );
}

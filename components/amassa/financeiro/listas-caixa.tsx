"use client";

import { useEffect, useState } from "react";

import type { ContaEmAberto, DocumentoParaDetalhe } from "@/lib/financeiro/consultas";
import {
  FRASE_VAZIO_A_PAGAR,
  FRASE_VAZIO_A_RECEBER,
  fraseVazioAPagarNaJanela,
  fraseVazioAReceberNaJanela,
  ROTULO_TILE_A_PAGAR,
  ROTULO_TILE_A_RECEBER,
  rotuloMostrarSoAte,
  rotuloVerDepois,
  textoDepoisDe,
  textoSubtituloDaJanela,
} from "@/lib/financeiro/textos";
import { Button } from "@/components/ui/button";
import { CartaoConta } from "./cartao-conta";
import { DialogoBaixa, type ContaSelecionadaParaBaixa } from "./dialogo-baixa";
import { DialogoDocumento } from "./dialogo-documento";

export type ContaSelecionada = ContaSelecionadaParaBaixa;

export type ListasCaixaProps = {
  // As contas da janela de 30 dias (vencidas + as que vencem até `janelaAte`) — 06.5-12, D-03.
  contas: readonly ContaEmAberto[];
  // As que vencem depois da janela: fora dos tiles, a um toque no fim de cada lista.
  contasDepois?: readonly ContaEmAberto[];
  // O último dia da janela, já em `dd/mm` (a página formata; este componente não lê o relógio).
  janelaAte: string;
  documentos: ReadonlyMap<string, DocumentoParaDetalhe>;
  hoje: string;
  // "Ver venda no Financeiro" (04.5-12-PLAN.md, D-25) — o id que a página já resolveu de
  // `?documentoId=<uuid>`, para o detalhe abrir sozinho assim que a aba Caixa carrega. `null` na
  // navegação normal (o dono clica "Ver" num cartão, como sempre).
  documentoParaAbrirId?: string | null;
  // "Paguei"/"Recebi" no Início, na parcela específica (D-06, 04.6-06-PLAN.md) — o id que a
  // página já resolveu de `?parcelaFoco=<uuid>`. A linha cujo `parcelaId` casa ganha destaque
  // visual e rola até a vista sozinha; `null` na navegação normal (nenhuma linha em foco).
  parcelaParaFocarId?: string | null;
};

// "A pagar" e "A receber" (protótipo `telaCaixa`), lado a lado a partir de 980px (aproximado por
// `md:`, mesma convenção já usada em `painel-venda.tsx`/`painel-despesa.tsx` para este breakpoint
// do UI-SPEC) — cada lista com o próprio estado vazio (FNC-07). O detalhe do documento ("Ver") e o
// diálogo de "Paguei"/"Recebi" são UMA instância cada, compartilhada pelas duas colunas.
export function ListasCaixa({
  contas,
  contasDepois = [],
  janelaAte,
  documentos,
  hoje,
  documentoParaAbrirId = null,
  parcelaParaFocarId = null,
}: ListasCaixaProps) {
  const [documentoAbertoId, setDocumentoAbertoId] = useState<string | null>(documentoParaAbrirId);
  const [baixaSelecionada, setBaixaSelecionada] = useState<ContaSelecionada | null>(null);

  const aPagar = contas.filter((conta) => conta.tipo === "despesa");
  const aReceber = contas.filter((conta) => conta.tipo === "venda");
  const aPagarDepois = contasDepois.filter((conta) => conta.tipo === "despesa");
  const aReceberDepois = contasDepois.filter((conta) => conta.tipo === "venda");
  // O diálogo de "Paguei"/"Recebi" acha a conta em QUALQUER das duas partes.
  const todasAsContas = [...contas, ...contasDepois];

  // "Ver as {N} que vencem depois de {dd/mm}" — estado local, sem navegar (D-03). A lista já abre
  // aberta quando a linha que a URL pediu para focar (`?parcelaFoco=`) está depois da janela —
  // senão o destaque cairia numa linha escondida.
  const [verDepoisPagar, setVerDepoisPagar] = useState(() =>
    aPagarDepois.some((conta) => conta.parcelaId === parcelaParaFocarId),
  );
  const [verDepoisReceber, setVerDepoisReceber] = useState(() =>
    aReceberDepois.some((conta) => conta.parcelaId === parcelaParaFocarId),
  );

  // Chegar pela URL rola até a linha em foco (D-06) — só na MONTAGEM, nunca de novo se
  // `parcelaParaFocarId` mudar depois (navegação normal dentro da mesma tela não deve
  // "puxar" a rolagem de volta).
  useEffect(() => {
    if (!parcelaParaFocarId) {
      return;
    }
    document
      .getElementById(`conta-${parcelaParaFocarId}`)
      ?.scrollIntoView({ block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function linhaDaConta(conta: (typeof contas)[number]) {
    const emFoco = conta.parcelaId === parcelaParaFocarId;
    return (
      <div
        key={conta.parcelaId}
        id={`conta-${conta.parcelaId}`}
        data-testid={emFoco ? "caixa-parcela-focada" : undefined}
        className={emFoco ? "-mx-2 rounded-lg bg-atencao-fundo px-2 py-1" : undefined}
      >
        <CartaoConta
          conta={conta}
          hoje={hoje}
          aoVer={setDocumentoAbertoId}
          aoBaixar={(parcelaId, documentoId) => setBaixaSelecionada({ parcelaId, documentoId })}
        />
      </div>
    );
  }

  // Uma lista ("A pagar" ou "A receber"): o título, a sub-linha da janela, as contas da janela e,
  // no fim, o botão que abre/fecha as de depois NA MESMA lista, sob a linha "Depois de {dd/mm}".
  // Vazios: sem conta nenhuma, as frases de sempre; janela vazia com contas depois, a frase com a
  // data (o botão continua embaixo). O botão some quando não há nada depois (N = 0).
  function listaDaJanela({
    lista,
    titulo,
    daJanela,
    depois,
    vazio,
    vazioNaJanela,
    aberta,
    alternar,
  }: {
    lista: "pagar" | "receber";
    titulo: string;
    daJanela: readonly ContaEmAberto[];
    depois: readonly ContaEmAberto[];
    vazio: string;
    vazioNaJanela: string;
    aberta: boolean;
    alternar: () => void;
  }) {
    const testIdDaSecao = lista === "pagar" ? "caixa-a-pagar" : "caixa-a-receber";
    const idDasDeDepois = `caixa-depois-${lista}`;
    return (
      <section data-testid={testIdDaSecao} className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-titulo text-foreground">{titulo}</h2>
          <p className="text-apoio text-muted-foreground">{textoSubtituloDaJanela(janelaAte)}</p>
        </div>
        {daJanela.length === 0 ? (
          <p className="text-corpo text-muted-foreground">{depois.length === 0 ? vazio : vazioNaJanela}</p>
        ) : (
          <div className="flex flex-col gap-2">{daJanela.map((conta) => linhaDaConta(conta))}</div>
        )}
        {aberta && depois.length > 0 ? (
          <div id={idDasDeDepois} className="border-border flex flex-col gap-2 border-t pt-2">
            <p data-testid="caixa-depois-de" className="text-apoio text-muted-foreground">
              {textoDepoisDe(janelaAte)}
            </p>
            {depois.map((conta) => linhaDaConta(conta))}
          </div>
        ) : null}
        {depois.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            data-testid={`caixa-ver-depois-${lista}`}
            aria-expanded={aberta}
            aria-controls={aberta ? idDasDeDepois : undefined}
            className="h-auto min-h-[44px] max-w-full self-start py-2 text-left font-semibold whitespace-normal"
            onClick={alternar}
          >
            {aberta ? rotuloMostrarSoAte(janelaAte) : rotuloVerDepois(depois.length, janelaAte)}
          </Button>
        ) : null}
      </section>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {listaDaJanela({
          lista: "pagar",
          titulo: ROTULO_TILE_A_PAGAR,
          daJanela: aPagar,
          depois: aPagarDepois,
          vazio: FRASE_VAZIO_A_PAGAR,
          vazioNaJanela: fraseVazioAPagarNaJanela(janelaAte),
          aberta: verDepoisPagar,
          alternar: () => setVerDepoisPagar((aberta) => !aberta),
        })}
        {listaDaJanela({
          lista: "receber",
          titulo: ROTULO_TILE_A_RECEBER,
          daJanela: aReceber,
          depois: aReceberDepois,
          vazio: FRASE_VAZIO_A_RECEBER,
          vazioNaJanela: fraseVazioAReceberNaJanela(janelaAte),
          aberta: verDepoisReceber,
          alternar: () => setVerDepoisReceber((aberta) => !aberta),
        })}
      </div>

      <DialogoDocumento
        documentoId={documentoAbertoId}
        documentos={documentos}
        aoFechar={() => setDocumentoAbertoId(null)}
      />

      <DialogoBaixa
        selecao={baixaSelecionada}
        contas={todasAsContas}
        hoje={hoje}
        aoFechar={() => setBaixaSelecionada(null)}
      />
    </>
  );
}

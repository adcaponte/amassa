"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { FORMAS_DE_RECEBER, type FormaDeReceber } from "@/lib/agenda/esquemas";
import type { PessoaDoSeletor } from "@/lib/agenda/seletor";
import {
  ARIA_FORMAS_DE_RECEBER,
  DICA_RECEBI_AGORA,
  FRASE_FALHA_AO_RECEBER,
  ROTULO_FORMA_DE_RECEBER,
  ROTULO_REGISTRANDO,
  ROTULO_VER_NO_CAIXA,
  ROTULO_VOLTAR,
  TITULO_RECEBI_AGORA,
  taxaDaMaquininha,
  toastRecebiAgora,
} from "@/lib/agenda/textos";
import { formatarPercentual, formatarReais } from "@/lib/financeiro/formato";
import { hrefDoCaixa } from "@/lib/financeiro/navegacao";
import { ROTULO_PESSOA_OPCIONAL } from "@/lib/financeiro/textos";
import { receberQueimaAgora } from "@/lib/queimas/acoes";
import type { ItensDasQueimas, QueimaACobrar } from "@/lib/queimas/consultas";
import {
  chaveDoTamanho,
  precosDosItens,
  resumoPmg,
  totalDasQuantidades,
  valorDasExternas,
  type Quantidades,
  type Tamanho,
} from "@/lib/queimas/contagem";
import {
  DICA_PASSO_DE_QUANTIDADE,
  DICA_PESSOA_RECEBI_QUEIMA,
  FRASE_ESCOLHA_A_PESSOA_NA_LISTA,
  FRASE_FALTA_PRECO,
  FRASE_NENHUMA_PECA_PARA_COBRAR,
  FRASE_SAIU_DE_A_COBRAR,
  ROTULO_PASSO_DE_QUANTIDADE,
  faltamNoTamanho,
  topoRecebiQueima,
} from "@/lib/queimas/textos";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { naoFecharComOSeletorAberto, SeletorPessoa } from "@/components/amassa/agenda/seletor-pessoa";
import { CLASSE_DA_FOLHA } from "@/components/amassa/estoque/folha-movimentacao";

import { ContadorTamanho } from "./contador-tamanho";

export type FolhaRecebiQueimaProps = {
  queima: QueimaACobrar;
  // "Biscoito de 18/12" (+ forno com mais de um), o mesmo título da linha.
  titulo: string;
  itens: ItensDasQueimas;
  taxaCartaoPontosBase: number;
  aoFechar: () => void;
};

const TAMANHOS: readonly Tamanho[] = ["P", "M", "G"];

// O painel do `SeletorPessoa` (o `data-testid="seletor-painel"` dele) posto FORA do fluxo, logo abaixo
// do campo, por cima do que vem depois — abrir e fechar a lista nunca move as formas de pagamento.
// (Sem `cn`: classes fixas, e o `tailwind-merge` não precisa decidir nada entre elas.)
const CLASSE_DA_LISTA_QUE_FLUTUA =
  "relative [&_[data-testid=seletor-painel]]:absolute [&_[data-testid=seletor-painel]]:inset-x-0 " +
  "[&_[data-testid=seletor-painel]]:top-full [&_[data-testid=seletor-painel]]:z-20 " +
  "[&_[data-testid=seletor-painel]]:mt-1 [&_[data-testid=seletor-painel]]:max-h-72 " +
  "[&_[data-testid=seletor-painel]]:overflow-y-auto [&_[data-testid=seletor-painel]]:shadow-md";

// Recusas que o servidor decidiu sob a trava e que já atualizaram a tela (a ação revalidou as
// Queimas): a folha fecha e a frase vai num aviso — molde `telaJaFoiAtualizada` da Agenda.
function telaJaFoiAtualizada(frase: string): boolean {
  return (
    frase.startsWith("As externas desta queima já foram todas lançadas") ||
    frase.startsWith("Desta queima só faltam") ||
    frase === FRASE_SAIU_DE_A_COBRAR
  );
}

// A folha "Recebi agora" das externas (06.4-UI-SPEC.md §"Folha “Recebi agora” (QMC-08)"): uma CÓPIA do
// desenho de `FolhaRecebiAgora` da Agenda — folha de tela toda no celular, diálogo `md:max-w-sm`; o topo,
// a dica herdada, três `outline` de 52 px, a taxa sob "Cartão", "Registrando…", "Voltar"; tocar a forma JÁ
// GRAVA; o `useRef` barra o segundo toque antes de o React redesenhar —, com, antes das formas:
// 1. o passo de quantidade (D-07): um `ContadorTamanho` por tamanho que ainda falta, com o teto no que
//    falta e começando com TUDO o que falta (as peças de uma pessoa vão juntas; nunca uma venda por peça
//    como regra); o topo acompanha as quantidades escolhidas e o valor delas; com zero peças as formas
//    ficam desabilitadas, com a frase do porquê;
// 2. a PESSOA opcional (decisão do dono de 04/10/2026 — UI-D13 revista): o seletor de pessoas da casa
//    (`SeletorPessoa`, o mesmo da Agenda), para saber depois quem levou o quê numa queima com várias
//    vendas. Vazio = venda sem pessoa; "pular" é não mexer nele — a forma continua um toque. Um nome
//    DIGITADO e não escolhido na lista segura a venda com a frase (a venda nunca sai sem pessoa por engano).
// Vai ao servidor `{ queimaId, forma, quantidades, clienteId }` — o resto é relido sob a trava.
export function FolhaRecebiQueima({
  queima,
  titulo,
  itens,
  taxaCartaoPontosBase,
  aoFechar,
}: FolhaRecebiQueimaProps) {
  const router = useRouter();
  const emVoo = useRef(false);
  const caixaDaPessoa = useRef<HTMLDivElement>(null);
  const idDaFraseNenhuma = useId();
  const idDaDicaDaPessoa = useId();
  const [quantidades, setQuantidades] = useState<Quantidades>({ ...queima.falta });
  const [pessoa, setPessoa] = useState<PessoaDoSeletor | null>(null);
  const [registrando, setRegistrando] = useState<FormaDeReceber | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const total = totalDasQuantidades(quantidades);
  const { valorCentavos } = valorDasExternas(quantidades, precosDosItens(itens));
  const nenhuma = total === 0;

  function mudar(tamanho: Tamanho, valor: number) {
    setErro(null);
    setQuantidades((atual) => ({ ...atual, [chaveDoTamanho(tamanho)]: valor }));
  }

  async function receber(forma: FormaDeReceber) {
    if (emVoo.current || nenhuma) {
      return;
    }
    // Nome digitado e não escolhido: a venda não sai sem pessoa por engano.
    const campoDaPessoa =
      caixaDaPessoa.current?.querySelector<HTMLInputElement>('input[role="combobox"]') ?? null;
    if (pessoa === null && campoDaPessoa !== null && campoDaPessoa.value.trim() !== "") {
      setErro(FRASE_ESCOLHA_A_PESSOA_NA_LISTA);
      campoDaPessoa.focus();
      return;
    }
    emVoo.current = true;
    setErro(null);
    setRegistrando(forma);
    try {
      const resposta = await receberQueimaAgora({
        queimaId: queima.queimaId,
        forma,
        quantidades,
        clienteId: pessoa?.id ?? null,
      });
      if (!resposta.ok) {
        if (telaJaFoiAtualizada(resposta.erro)) {
          toast.error(resposta.erro);
          aoFechar();
          router.refresh();
        } else {
          // Preço apagado entre abrir e tocar, pessoa que sumiu do cadastro: a frase fica na folha.
          setErro(resposta.erro);
        }
        return;
      }
      toast.success(toastRecebiAgora(resposta.dados.numero, resposta.dados.forma), {
        action: { label: ROTULO_VER_NO_CAIXA, onClick: () => router.push(hrefDoCaixa()) },
      });
      aoFechar();
      router.refresh();
    } catch {
      // Nada chegou ao servidor (ou a resposta se perdeu): a folha continua aberta, com a frase.
      setErro(FRASE_FALHA_AO_RECEBER);
    } finally {
      emVoo.current = false;
      setRegistrando(null);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(aberta) => {
        if (!aberta && registrando === null) {
          aoFechar();
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        data-testid="folha-recebi-agora"
        data-cobranca-tipo="queima"
        data-cobranca-id={queima.queimaId}
        onOpenAutoFocus={(evento) => evento.preventDefault()}
        // Esc com a lista do seletor aberta fecha só a lista, nunca a folha.
        onEscapeKeyDown={naoFecharComOSeletorAberto}
        className={cn(CLASSE_DA_FOLHA, "md:max-w-sm")}
      >
        <DialogHeader className="border-border flex flex-col gap-1 border-b px-6 py-4 text-left">
          <DialogTitle className="text-titulo text-tinta">{TITULO_RECEBI_AGORA}</DialogTitle>
          <DialogDescription asChild>
            <div className="flex flex-col gap-1">
              <p
                data-testid="recebi-agora-topo"
                aria-live="polite"
                className="text-corpo text-tinta font-semibold [overflow-wrap:anywhere]"
              >
                {topoRecebiQueima(
                  titulo,
                  resumoPmg(quantidades.p, quantidades.m, quantidades.g),
                  valorCentavos === null ? FRASE_FALTA_PRECO : formatarReais(valorCentavos),
                )}
              </p>
              <p className="text-apoio text-tinta-media">{DICA_RECEBI_AGORA}</p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
          <div
            role="group"
            aria-label={ROTULO_PASSO_DE_QUANTIDADE}
            data-testid="recebi-quantidades"
            className="flex flex-col gap-1"
          >
            <p className="text-corpo text-tinta font-semibold">{ROTULO_PASSO_DE_QUANTIDADE}</p>
            {TAMANHOS.filter((tamanho) => queima.falta[chaveDoTamanho(tamanho)] > 0).map(
              (tamanho) => {
                const falta = queima.falta[chaveDoTamanho(tamanho)];
                return (
                  <ContadorTamanho
                    key={tamanho}
                    grupo="externas"
                    tamanho={tamanho}
                    faixa={faltamNoTamanho(falta)}
                    valor={quantidades[chaveDoTamanho(tamanho)]}
                    maximo={falta}
                    idDeTeste={`recebi-quantidade-${tamanho.toLowerCase()}`}
                    aoMudar={(valor) => mudar(tamanho, valor)}
                    desabilitado={registrando !== null}
                  />
                );
              },
            )}
            <p className="text-apoio text-tinta-fraca">{DICA_PASSO_DE_QUANTIDADE}</p>
          </div>

          <div ref={caixaDaPessoa} className="flex flex-col gap-1" data-testid="recebi-pessoa">
            {/* A lista do seletor FLUTUA por cima das formas (fora do fluxo): aberta no fluxo, ela
                empurrava as formas para baixo, e o toque numa forma — que primeiro tira o foco do campo
                e fecha a lista — caía noutro lugar depois que as formas subiam (podia até cair noutra
                forma). Achado no e2e de 04/10/2026; o componente da Agenda não muda. */}
            <div className={CLASSE_DA_LISTA_QUE_FLUTUA}>
              <SeletorPessoa
                rotulo={ROTULO_PESSOA_OPCIONAL}
                aoEscolher={(escolhida) => {
                  setErro(null);
                  setPessoa(escolhida);
                }}
                aoDigitar={() => {
                  setErro(null);
                  setPessoa(null);
                }}
                desabilitado={registrando !== null}
              />
            </div>
            <p id={idDaDicaDaPessoa} className="text-apoio text-tinta-fraca">
              {DICA_PESSOA_RECEBI_QUEIMA}
            </p>
          </div>

          <div role="group" aria-label={ARIA_FORMAS_DE_RECEBER} className="flex flex-col gap-3">
            {FORMAS_DE_RECEBER.map((forma) => (
              <div key={forma} className="flex flex-col gap-1">
                <Button
                  type="button"
                  variant="outline"
                  data-testid={`forma-${forma}`}
                  disabled={registrando !== null || nenhuma}
                  aria-describedby={nenhuma ? idDaFraseNenhuma : undefined}
                  onClick={() => void receber(forma)}
                  className="text-corpo h-auto min-h-[52px] w-full px-4 font-semibold"
                >
                  {registrando === forma ? ROTULO_REGISTRANDO : ROTULO_FORMA_DE_RECEBER[forma]}
                </Button>
                {forma === "cartao" ? (
                  <p data-testid="recebi-agora-taxa" className="text-apoio text-tinta-fraca text-center">
                    {taxaDaMaquininha(formatarPercentual(taxaCartaoPontosBase))}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
          {nenhuma ? (
            <p
              id={idDaFraseNenhuma}
              data-testid="recebi-nenhuma-peca"
              className="text-apoio text-tinta-media"
            >
              {FRASE_NENHUMA_PECA_PARA_COBRAR}
            </p>
          ) : null}
          {erro !== null ? (
            <p role="alert" data-testid="recebi-agora-erro" className="text-corpo text-erro">
              {erro}
            </p>
          ) : null}
        </div>

        <div className="border-border bg-popover flex flex-col border-t px-6 py-4">
          <Button
            type="button"
            variant="outline"
            data-testid="recebi-agora-voltar"
            disabled={registrando !== null}
            onClick={aoFechar}
            className="text-corpo h-auto min-h-[44px] w-full px-4 font-semibold"
          >
            {ROTULO_VOLTAR}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

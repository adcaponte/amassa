"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { receberAgora } from "@/lib/agenda/acoes";
import type { FormaDeReceber } from "@/lib/agenda/esquemas";
import type { TipoDeCobranca } from "@/lib/agenda/receber";
import {
  DICA_RECEBI_AGORA,
  FRASE_COBRANCA_DISPENSADA,
  FRASE_COBRANCA_SUMIU,
  FRASE_DATA_CANCELADA,
  FRASE_FALHA_AO_RECEBER,
  ROTULO_VER_NO_CAIXA,
  ROTULO_VOLTAR,
  TITULO_RECEBI_AGORA,
  toastRecebiAgora,
  topoRecebiAgora,
} from "@/lib/agenda/textos";
import { formatarReais } from "@/lib/financeiro/formato";
import { hrefDoCaixa } from "@/lib/financeiro/navegacao";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Folha, FolhaCorpo, FolhaRodape } from "@/components/amassa/folha";
import { FormasDeReceber } from "@/components/amassa/formas-de-receber";

// O que a folha precisa saber da cobrança: a referência (a ÚNICA coisa que vai ao servidor, com a forma)
// e o que o topo mostra.
export type CobrancaParaReceber = {
  tipo: TipoDeCobranca;
  id: string;
  nome: string;
  descricao: string;
  valorCentavos: number;
};

export type FolhaRecebiAgoraProps = {
  cobranca: CobrancaParaReceber;
  // A taxa do cartão de agora (Cadastros → Taxas), em pontos-base — a linha embaixo do “Cartão”.
  taxaCartaoPontosBase: number;
  aoFechar: () => void;
};

// Recusas que o servidor decidiu sob a trava e que já atualizaram a tela (a ação revalidou a Agenda): a
// folha fecha e a frase vai num toast — a linha some ou muda sozinha.
function telaJaFoiAtualizada(frase: string): boolean {
  return (
    frase.startsWith("Este item já foi lançado") ||
    frase === FRASE_COBRANCA_SUMIU ||
    frase === FRASE_COBRANCA_DISPENSADA ||
    frase === FRASE_DATA_CANCELADA
  );
}

// A folha “Recebi agora” (05-UI-SPEC.md §“Aba A receber” → “Folha Recebi agora”; UI-D4, confirmada pelo
// dono): no celular, a folha de tela toda do padrão; a partir de 768px, um diálogo pequeno. Título, o topo
// “{nome} · {descrição} · {R$}” e a dica; três botões `outline` de 52px empilhados, largura total —
// tocar uma forma JÁ GRAVA (dois toques: “Recebi agora” → a forma). Enquanto grava, o tocado vira
// “Registrando…” e os três ficam `disabled`; o `useRef` barra o segundo toque antes de o React
// redesenhar (toque duplo nunca cria duas vendas — e o servidor recusa de novo sob a trava).
export function FolhaRecebiAgora({ cobranca, taxaCartaoPontosBase, aoFechar }: FolhaRecebiAgoraProps) {
  const router = useRouter();
  const emVoo = useRef(false);
  const [registrando, setRegistrando] = useState<FormaDeReceber | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function receber(forma: FormaDeReceber) {
    if (emVoo.current) {
      return;
    }
    emVoo.current = true;
    setErro(null);
    setRegistrando(forma);
    try {
      const resposta = await receberAgora({ cobranca: { tipo: cobranca.tipo, id: cobranca.id }, forma });
      if (!resposta.ok) {
        if (telaJaFoiAtualizada(resposta.erro)) {
          toast.error(resposta.erro);
          aoFechar();
        } else {
          setErro(resposta.erro);
        }
        return;
      }
      toast.success(toastRecebiAgora(resposta.dados.numero, resposta.dados.forma), {
        action: { label: ROTULO_VER_NO_CAIXA, onClick: () => router.push(hrefDoCaixa()) },
      });
      aoFechar();
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
      {/* O cabeçalho continua à mão: o "Recebi agora" não tem o "X" do `FolhaCabecalho` (fecha pelo
          "Voltar", pelo Esc e por fora) e empilha título, topo e dica — pôr o fechar mudaria a tela. */}
      <Folha
        tamanho="estreita"
        data-testid="folha-recebi-agora"
        data-cobranca-tipo={cobranca.tipo}
        data-cobranca-id={cobranca.id}
        onOpenAutoFocus={(evento) => evento.preventDefault()}
      >
        <DialogHeader className="border-border flex flex-col gap-1 border-b px-6 py-4 text-left">
          <DialogTitle className="text-titulo text-tinta">{TITULO_RECEBI_AGORA}</DialogTitle>
          <DialogDescription asChild>
            <div className="flex flex-col gap-1">
              <p data-testid="recebi-agora-topo" className="text-corpo text-tinta font-semibold [overflow-wrap:anywhere]">
                {topoRecebiAgora(cobranca.nome, cobranca.descricao, formatarReais(cobranca.valorCentavos))}
              </p>
              <p className="text-apoio text-tinta-media">{DICA_RECEBI_AGORA}</p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <FolhaCorpo className="gap-3">
          <FormasDeReceber
            registrando={registrando}
            aoReceber={(forma) => void receber(forma)}
            taxaCartaoPontosBase={taxaCartaoPontosBase}
          />
          {erro !== null ? (
            <p role="alert" data-testid="recebi-agora-erro" className="text-corpo text-erro">
              {erro}
            </p>
          ) : null}
        </FolhaCorpo>

        <FolhaRodape>
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
        </FolhaRodape>
      </Folha>
    </Dialog>
  );
}

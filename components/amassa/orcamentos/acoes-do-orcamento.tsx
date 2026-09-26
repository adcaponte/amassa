"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { irParaSemNavegar } from "@/components/amassa/abertura/url-sem-navegar";
import {
  duplicarOrcamento,
  marcarComoEnviado,
  recusarOrcamento,
  voltarParaRascunho,
} from "@/lib/orcamentos/acoes";
import {
  FRASE_APROVADO_EXPLICACAO,
  FRASE_FALTA_CLIENTE_E_PECA,
  NOTA_CLIENTE_APROVOU_EM_BREVE,
  NOTA_VER_CLIENTE_EM_BREVE,
  ROTULO_ATUALIZAR_PRECOS,
  ROTULO_ATUALIZAR_PRECOS_E_REABRIR,
  ROTULO_CLIENTE_APROVOU,
  ROTULO_DUPLICAR,
  ROTULO_MARCAR_COMO_ENVIADO,
  ROTULO_RECUSOU,
  ROTULO_VER_COMO_CLIENTE_VE,
  ROTULO_VOLTAR_PARA_RASCUNHO,
} from "@/lib/orcamentos/textos";

export type AcoesDoOrcamentoProps = {
  orcamentoId: string;
  status: "rascunho" | "enviado" | "aprovado" | "recusado";
  temCliente: boolean;
  temPeca: boolean;
};

type AcaoEmAndamento = "enviar" | "recusar" | "reabrir" | "duplicar" | null;

// A barra de ações do orçamento: muda de conteúdo conforme o status, na ordem do protótipo. "Ver
// como o cliente vê" (plano 11) e "Cliente aprovou" (plano 12) ainda não têm ação própria nesta
// fase — o botão existe, desabilitado, com uma nota curta no lugar de um controle morto sem
// explicação (registrado no SUMMARY como stub conhecido). "Atualizar preços"/"Atualizar preços e
// reabrir" (04.5-09-PLAN.md) abre `DialogoAtualizarPrecos` por troca de URL (`?atualizarPrecos=1`,
// sem transição — o mesmo padrão de `EscolherPeca`). Cada transição real termina em navegação
// COMPLETA para o toast correspondente — nunca `router.push`/`router.refresh`.
export function AcoesDoOrcamento({ orcamentoId, status, temCliente, temPeca }: AcoesDoOrcamentoProps) {
  const [emAndamento, setEmAndamento] = useState<AcaoEmAndamento>(null);
  const [erro, setErro] = useState<string | null>(null);

  function irParaEditorComAviso(aviso: string, idAlvo: string) {
    window.location.assign(`/financeiro?aba=orcamentos&orcamento=${idAlvo}&aviso=${aviso}`);
  }

  async function aoClicarEnviar() {
    setEmAndamento("enviar");
    setErro(null);
    const resposta = await marcarComoEnviado({ id: orcamentoId });
    setEmAndamento(null);
    if (!resposta.ok) {
      setErro(resposta.erro);
      return;
    }
    irParaEditorComAviso("orcamento-enviado", orcamentoId);
  }

  async function aoClicarRecusar() {
    setEmAndamento("recusar");
    setErro(null);
    const resposta = await recusarOrcamento({ id: orcamentoId });
    setEmAndamento(null);
    if (!resposta.ok) {
      setErro(resposta.erro);
      return;
    }
    irParaEditorComAviso("orcamento-recusado", orcamentoId);
  }

  async function aoClicarReabrir() {
    setEmAndamento("reabrir");
    setErro(null);
    const resposta = await voltarParaRascunho({ id: orcamentoId });
    setEmAndamento(null);
    if (!resposta.ok) {
      setErro(resposta.erro);
      return;
    }
    irParaEditorComAviso("orcamento-reaberto", orcamentoId);
  }

  async function aoClicarDuplicar() {
    setEmAndamento("duplicar");
    setErro(null);
    const resposta = await duplicarOrcamento({ id: orcamentoId });
    setEmAndamento(null);
    if (!resposta.ok) {
      setErro(resposta.erro);
      return;
    }
    irParaEditorComAviso("orcamento-duplicado", resposta.dados.id);
  }

  const ocupado = emAndamento !== null;
  const podeEnviar = temCliente && temPeca;

  function abrirAtualizarPrecos() {
    irParaSemNavegar(`/financeiro?aba=orcamentos&orcamento=${orcamentoId}&atualizarPrecos=1`);
  }

  const botaoAtualizarPrecos = (rotulo: string) => (
    <Button type="button" variant="outline" onClick={abrirAtualizarPrecos} className="min-h-[44px]">
      {rotulo}
    </Button>
  );

  const botaoDuplicar = (
    <Button
      type="button"
      variant="outline"
      disabled={ocupado}
      onClick={() => void aoClicarDuplicar()}
      className="min-h-[44px]"
    >
      {emAndamento === "duplicar" ? "Duplicando…" : ROTULO_DUPLICAR}
    </Button>
  );

  return (
    <section data-testid="orcamento-acoes" className="flex flex-col gap-2">
      {erro && (
        <p role="alert" aria-live="assertive" className="text-apoio text-destructive">
          {erro}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        {status === "rascunho" && (
          <>
            <Button type="button" variant="outline" disabled className="min-h-[44px]">
              {ROTULO_VER_COMO_CLIENTE_VE}
            </Button>
            <Button
              type="button"
              disabled={ocupado || !podeEnviar}
              onClick={() => void aoClicarEnviar()}
              className="min-h-[44px]"
            >
              {emAndamento === "enviar" ? "Enviando…" : ROTULO_MARCAR_COMO_ENVIADO}
            </Button>
            {botaoAtualizarPrecos(ROTULO_ATUALIZAR_PRECOS)}
            {botaoDuplicar}
          </>
        )}

        {status === "enviado" && (
          <>
            <Button type="button" disabled className="min-h-[44px]">
              {ROTULO_CLIENTE_APROVOU}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={ocupado}
              onClick={() => void aoClicarRecusar()}
              className="min-h-[44px]"
            >
              {emAndamento === "recusar" ? "Recusando…" : ROTULO_RECUSOU}
            </Button>
            {botaoAtualizarPrecos(ROTULO_ATUALIZAR_PRECOS)}
            <Button
              type="button"
              variant="outline"
              disabled={ocupado}
              onClick={() => void aoClicarReabrir()}
              className="min-h-[44px]"
            >
              {emAndamento === "reabrir" ? "Voltando…" : ROTULO_VOLTAR_PARA_RASCUNHO}
            </Button>
            {botaoDuplicar}
          </>
        )}

        {status === "recusado" && (
          <>
            {botaoAtualizarPrecos(ROTULO_ATUALIZAR_PRECOS_E_REABRIR)}
            {botaoDuplicar}
          </>
        )}

        {status === "aprovado" && botaoDuplicar}
      </div>

      {status === "rascunho" && (
        <div className="flex flex-col gap-1">
          <p className="text-apoio text-muted-foreground">{NOTA_VER_CLIENTE_EM_BREVE}</p>
          {!podeEnviar && (
            <p data-testid="orcamento-falta-enviar" className="text-apoio text-muted-foreground">
              {FRASE_FALTA_CLIENTE_E_PECA}
            </p>
          )}
        </div>
      )}

      {status === "enviado" && (
        <p className="text-apoio text-muted-foreground">{NOTA_CLIENTE_APROVOU_EM_BREVE}</p>
      )}

      {status === "aprovado" && (
        <p data-testid="orcamento-aviso-aprovado" className="text-apoio text-muted-foreground">
          {FRASE_APROVADO_EXPLICACAO}
        </p>
      )}
    </section>
  );
}

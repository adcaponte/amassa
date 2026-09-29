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
  FRASE_FALTA_CLIENTE_E_PECA,
  ROTULO_ATUALIZAR_PRECOS,
  ROTULO_ATUALIZAR_PRECOS_E_REABRIR,
  ROTULO_CLIENTE_APROVOU,
  ROTULO_DUPLICAR,
  ROTULO_MARCAR_COMO_ENVIADO,
  ROTULO_RECUSOU,
  ROTULO_VER_COMO_CLIENTE_VE,
  ROTULO_VOLTAR_PARA_RASCUNHO,
} from "@/lib/orcamentos/textos";
import type { StatusEncomenda } from "@/lib/orcamentos/situacao";

import { VereditoDaAprovacao } from "./veredito-da-aprovacao";
import { hrefDoOrcamento } from "@/lib/financeiro/navegacao";

export type AcoesDoOrcamentoProps = {
  orcamentoId: string;
  status: "rascunho" | "enviado" | "aprovado" | "recusado";
  temCliente: boolean;
  temPeca: boolean;
  // Aprovação (04.5-12-PLAN.md, D-25) — só têm valor quando status === "aprovado" (o invariante
  // de banco `orcamentos_documento_exige_aprovado` garante `documentoId`/`documentoNumero` não
  // nulos nesse status).
  documentoId: string | null;
  documentoNumero: number | null;
  encomendaId: string | null;
  // O ESTADO da ordem vinculada (04.5-14) — só repassado adiante; quem decide o que ele
  // significa é `vereditoDaAprovacao` (lib/orcamentos/situacao.ts), nunca esta barra.
  encomendaStatus: StatusEncomenda | null;
  vendaCancelada: boolean;
};

type AcaoEmAndamento = "enviar" | "recusar" | "reabrir" | "duplicar" | null;

// A barra de ações do orçamento: muda de conteúdo conforme o status, na ordem do protótipo.
// "Cliente aprovou" (04.5-12-PLAN.md) abre `DialogoAprovar` por troca de URL (`?aprovar=1`, sem
// transição — o mesmo padrão de "Atualizar preços" abaixo); confirmar dentro dele É gravação e
// termina em navegação COMPLETA. Um orçamento aprovado mostra `VereditoDaAprovacao` em vez do
// texto fixo de antes — os dois links e o aviso de venda cancelada moram lá. "Atualizar
// preços"/"Atualizar preços e reabrir" (04.5-09-PLAN.md) abre `DialogoAtualizarPrecos` do mesmo
// jeito (`?atualizarPrecos=1`, o mesmo padrão de `EscolherPeca`). Cada transição real (enviar/
// recusar/reabrir/duplicar) termina em navegação COMPLETA para o toast correspondente — nunca
// `router.push`/`router.refresh`.
export function AcoesDoOrcamento({
  orcamentoId,
  status,
  temCliente,
  temPeca,
  documentoId,
  documentoNumero,
  encomendaId,
  encomendaStatus,
  vendaCancelada,
}: AcoesDoOrcamentoProps) {
  const [emAndamento, setEmAndamento] = useState<AcaoEmAndamento>(null);
  const [erro, setErro] = useState<string | null>(null);

  function irParaEditorComAviso(aviso: string, idAlvo: string) {
    window.location.assign(hrefDoOrcamento(idAlvo, { aviso }));
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
    irParaSemNavegar(hrefDoOrcamento(orcamentoId, { atualizarPrecos: "1" }));
  }

  // "Ver como o cliente vê" (04.5-11-PLAN.md) — disponível em QUALQUER status (protótipo,
  // `telaEditor`: o botão nunca fica dentro de um bloco condicionado por status). Abre por
  // `irParaSemNavegar` (nunca `router.push`/navegação completa): `VerComoOClienteVe` já está
  // montado ao lado do editor, esperando por `?documento=1` — trocar a URL sem navegar é o que
  // torna a pré-visualização instantânea, sem chamada nova ao servidor.
  function abrirDocumentoDoCliente() {
    irParaSemNavegar(hrefDoOrcamento(orcamentoId, { documento: "1" }));
  }

  // "Cliente aprovou" (04.5-12-PLAN.md) — mesma disciplina de `abrirAtualizarPrecos`: abrir é
  // troca de URL sem transição (`DialogoAprovar` já está montado por `EditorOrcamento`, esperando
  // por `?aprovar=1`, com o plano JÁ calculado por prop — nenhuma chamada nova ao servidor só para
  // abrir).
  function abrirAprovacao() {
    irParaSemNavegar(hrefDoOrcamento(orcamentoId, { aprovar: "1" }));
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
        {/* "Ver como o cliente vê" (04.5-11-PLAN.md): sempre disponível, em qualquer status —
            o protótipo (`telaEditor`) nunca condiciona este botão a `vivo`/status nenhum. */}
        <Button
          type="button"
          variant="outline"
          onClick={abrirDocumentoDoCliente}
          className="min-h-[44px]"
        >
          {ROTULO_VER_COMO_CLIENTE_VE}
        </Button>

        {status === "rascunho" && (
          <>
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
            <Button type="button" onClick={abrirAprovacao} className="min-h-[44px]">
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

      {status === "rascunho" && !podeEnviar && (
        <p data-testid="orcamento-falta-enviar" className="text-apoio text-muted-foreground">
          {FRASE_FALTA_CLIENTE_E_PECA}
        </p>
      )}

      {status === "aprovado" && documentoId !== null && documentoNumero !== null && (
        <VereditoDaAprovacao
          documentoId={documentoId}
          documentoNumero={documentoNumero}
          encomendaId={encomendaId}
          encomendaStatus={encomendaStatus}
          vendaCancelada={vendaCancelada}
        />
      )}
    </section>
  );
}

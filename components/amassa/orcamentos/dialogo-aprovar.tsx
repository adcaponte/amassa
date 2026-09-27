"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { irParaSemNavegar } from "@/components/amassa/abertura/url-sem-navegar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { nomeDaLinha } from "@/lib/financeiro/documento";
import { formatarReais } from "@/lib/financeiro/formato";
import { aprovarOrcamento } from "@/lib/orcamentos/acoes";
import type { PlanoDeAprovacao } from "@/lib/orcamentos/aprovacao";
import {
  DICA_CLIENTE_APROVOU,
  DICA_ORDEM_DE_PRODUCAO,
  DICA_SINAL_A_RECEBER,
  FRASE_FALHA_AO_APROVAR,
  ROTULO_A_RECEBER,
  ROTULO_A_RECEBER_HOJE,
  ROTULO_CRIAR,
  ROTULO_VOLTAR_DA_APROVACAO,
  TITULO_CLIENTE_APROVOU,
  TITULO_NA_PRODUCAO_UMA_ORDEM,
  TITULO_NO_FINANCEIRO_UMA_VENDA,
  rotuloAbrirOrdem,
} from "@/lib/orcamentos/textos";

export type DialogoAprovarProps = {
  orcamentoId: string;
  // O MESMO `PlanoDeAprovacao` que a transação vai criar de verdade
  // (`planejarAprovacao`, lib/orcamentos/aprovacao.ts) — o que o dono lê aqui é literalmente o
  // que será gravado (key_link do 04.5-12-PLAN.md).
  plano: PlanoDeAprovacao;
  entregaPrevistaFormatada: string;
};

// O diálogo "Cliente aprovou" (04.5-12-PLAN.md, Tarefa 3, D-25) — aberto via `?aprovar=1`, mesma
// disciplina de `DialogoAtualizarPrecos`: abrir é troca de URL sem transição (nada precisa ser
// buscado do servidor, o plano já chegou pronto por prop); confirmar É gravação — termina em
// navegação COMPLETA, nunca `router.push`/`router.refresh`.
//
// Diálogo único responsivo, corpo rolável e rodapé preso por FLEX (o mesmo molde documentado em
// `DialogoAtualizarPrecos`, que também cita o debug resolvido de rodapé de formulário no
// desktop) — mesmo com oito peças rolando por baixo, o rodapé nunca sai da vista.
export function DialogoAprovar({ orcamentoId, plano, entregaPrevistaFormatada }: DialogoAprovarProps) {
  const searchParams = useSearchParams();
  const aberto = searchParams.get("aprovar") === "1";

  const [abrirOrdemDeProducao, setAbrirOrdemDeProducao] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function fechar() {
    setErro(null);
    irParaSemNavegar(`/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);
  }

  async function confirmar() {
    setEnviando(true);
    setErro(null);

    const resposta = await aprovarOrcamento({ id: orcamentoId, abrirOrdemDeProducao });

    setEnviando(false);
    if (!resposta.ok) {
      // O diálogo permanece ABERTO (D-25): "Não deu para aprovar agora. Nada foi criado — tente
      // de novo." nunca fecha a folha sozinho, para o dono poder tentar de novo no mesmo lugar.
      setErro(resposta.erro);
      return;
    }

    // Navegação COMPLETA — o chip, o veredito e os dois links só o servidor sabe montar depois de
    // gravar (o toast lê `orcamentoParaEditar` recarregado, nunca um estado otimista do cliente).
    window.location.assign(
      `/financeiro?aba=orcamentos&orcamento=${orcamentoId}&aviso=orcamento-aprovado`,
    );
  }

  const itensTexto = plano.itensDaEncomenda
    .map((item) => nomeDaLinha({ nome: item.descricao, quantidade: item.quantidade }))
    .join(", ");

  return (
    <Dialog open={aberto} onOpenChange={(novoValor) => !novoValor && fechar()}>
      <DialogContent
        aria-label={TITULO_CLIENTE_APROVOU}
        className={cn(
          // Celular (base): folha de baixo, tela toda.
          "inset-x-0 top-auto bottom-0 left-0 flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none rounded-t-none border-0 border-t p-0",
          // Desktop (`md:`): modal centralizado.
          "md:top-1/2 md:right-auto md:bottom-auto md:left-1/2 md:h-auto md:max-h-[85svh] md:w-full md:max-w-2xl md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:border",
        )}
      >
        <DialogHeader className="border-border border-b px-6 py-4">
          <DialogTitle className="text-titulo">{TITULO_CLIENTE_APROVOU}</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
          {erro && (
            <p
              role="alert"
              aria-live="assertive"
              data-testid="aprovar-erro"
              className="text-apoio text-destructive"
            >
              {erro || FRASE_FALHA_AO_APROVAR}
            </p>
          )}

          <p className="text-apoio text-muted-foreground">{DICA_CLIENTE_APROVOU}</p>

          <section className="flex flex-col gap-2">
            <h3 className="text-corpo text-foreground font-semibold">
              {TITULO_NO_FINANCEIRO_UMA_VENDA}
            </h3>
            <ul className="flex flex-col gap-1">
              {plano.linhasDaVenda.map((linha, indice) => (
                <li
                  key={indice}
                  data-testid="aprovar-linha-venda"
                  className="flex items-center justify-between gap-3 border-b py-1 last:border-0"
                >
                  <span className="text-corpo min-w-0 flex-1 break-words">
                    {nomeDaLinha({ nome: linha.descricao, quantidade: linha.quantidade })}
                  </span>
                  <span className="text-corpo tabular-nums whitespace-nowrap">
                    {formatarReais(linha.valorCentavos)}
                  </span>
                </li>
              ))}
            </ul>

            <ul className="flex flex-col gap-1">
              {plano.parcelas.map((parcela, indice) => (
                <li
                  key={indice}
                  data-testid="aprovar-parcela"
                  className="flex items-center justify-between gap-3 border-b py-1 last:border-0"
                >
                  <span className="text-corpo min-w-0 flex-1">
                    {parcela.rotulo}{" "}
                    <span className="bg-muted text-apoio rounded px-1.5 py-0.5">
                      {indice === 0 ? ROTULO_A_RECEBER_HOJE : ROTULO_A_RECEBER}
                    </span>
                  </span>
                  <span className="text-corpo tabular-nums whitespace-nowrap">
                    {formatarReais(parcela.valorCentavos)}
                  </span>
                </li>
              ))}
            </ul>

            <p className="text-apoio text-muted-foreground">{DICA_SINAL_A_RECEBER}</p>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-corpo text-foreground font-semibold">
              {TITULO_NA_PRODUCAO_UMA_ORDEM}
            </h3>
            <label className="flex items-start gap-1">
              {/* A caixa de marcação é `<input type="checkbox">` NATIVO — a zona de toque de
                  44×44 é o `<span>` externo que a envolve, mesma disciplina de
                  `linha-parcela.tsx`/`marcar-cotacao.tsx`: um alvo de verdade, não um hit-slop
                  invisível (CLAUDE.md, alvos de toque ≥ 44px). */}
              <span className="flex size-11 shrink-0 items-center justify-center">
                <input
                  type="checkbox"
                  data-testid="aprovar-ordem"
                  checked={abrirOrdemDeProducao}
                  onChange={(evento) => setAbrirOrdemDeProducao(evento.target.checked)}
                  className="size-5"
                />
              </span>
              <span className="text-corpo text-foreground pt-2.5">
                {rotuloAbrirOrdem(itensTexto, entregaPrevistaFormatada)}
              </span>
            </label>
            <p className="text-apoio text-muted-foreground">{DICA_ORDEM_DE_PRODUCAO}</p>
          </section>
        </div>

        {/* Rodapé ao pé do diálogo por FLEX — mesma disciplina de `DialogoAtualizarPrecos`. */}
        <div className="border-border bg-popover flex flex-col gap-3 border-t px-6 py-4">
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={fechar}
              className="border-border hover:bg-muted text-corpo flex min-h-[44px] items-center rounded-md border px-4"
            >
              {ROTULO_VOLTAR_DA_APROVACAO}
            </button>
            <button
              type="button"
              disabled={enviando}
              onClick={() => void confirmar()}
              className="bg-primary text-primary-foreground hover:bg-primary/80 text-corpo flex min-h-[44px] items-center rounded-md px-4 font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enviando ? "Criando…" : ROTULO_CRIAR}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

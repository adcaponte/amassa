"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { acrescentarLinha } from "@/lib/orcamentos/acoes";
import {
  FRASE_VAZIO_ESCOLHER_PECA,
  ROTULO_FECHAR,
  ROTULO_MAIS_PECA_DA_LISTA,
  TITULO_ESCOLHER_PECA,
  rotuloMinimoNaLista,
} from "@/lib/orcamentos/textos";
import { formatarReais } from "@/lib/financeiro/formato";
import { irParaSemNavegar } from "@/components/amassa/abertura/url-sem-navegar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { hrefDoOrcamento } from "@/lib/financeiro/navegacao";

export type PecaParaEscolherProps = {
  id: string;
  nome: string;
  // `null` quando os parâmetros de hoje não calculam para esta peça (D-11/D-12) — a lista mostra
  // "—" no lugar do mínimo, nunca um número inventado.
  minimoCentavos: number | null;
};

export type EscolherPecaProps = {
  orcamentoId: string;
  pecas: PecaParaEscolherProps[];
};

// O gatilho de "+ Peça da lista" — abrir é troca de URL sem transição (pushState), nunca uma
// navegação: o diálogo não precisa de nenhum dado novo do servidor para abrir.
export function AbrirEscolherPecaBotao({ orcamentoId }: { orcamentoId: string }) {
  return (
    <button
      type="button"
      onClick={() => irParaSemNavegar(hrefDoOrcamento(orcamentoId, { escolherPeca: "1" }))}
      className="border-border hover:bg-muted text-corpo flex min-h-[44px] items-center rounded-md border px-4"
    >
      {ROTULO_MAIS_PECA_DA_LISTA}
    </button>
  );
}

// A folha de escolha ("+ Peça da lista", must_have): um diálogo único responsivo, aberto via
// `?escolherPeca=1` — abrir/fechar usa `window.history.pushState` (nunca uma transição, mesma
// disciplina de Abertura); ESCOLHER uma peça é gravação (o servidor decide o preço da linha), e
// por isso termina em navegação COMPLETA, nunca `router.refresh()`.
export function EscolherPeca({ orcamentoId, pecas }: EscolherPecaProps) {
  const searchParams = useSearchParams();
  const aberto = searchParams.get("escolherPeca") === "1";

  const [enviandoId, setEnviandoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  function fechar() {
    setErro(null);
    irParaSemNavegar(hrefDoOrcamento(orcamentoId));
  }

  async function escolher(fichaId: string) {
    if (enviandoId) {
      return;
    }
    setErro(null);
    setEnviandoId(fichaId);

    const resposta = await acrescentarLinha({ orcamentoId, fichaId });

    if (!resposta.ok) {
      setEnviandoId(null);
      setErro(resposta.erro);
      return;
    }

    // Navegação COMPLETA — a linha nova, com o preço que só o servidor decidiu, precisa vir do
    // recarregamento, nunca de uma atualização otimista no cliente.
    window.location.assign(hrefDoOrcamento(orcamentoId));
  }

  return (
    <Dialog open={aberto} onOpenChange={(novoValor) => !novoValor && fechar()}>
      <DialogContent
        data-testid="orcamento-escolher-peca"
        aria-label={TITULO_ESCOLHER_PECA}
        className="flex max-h-[85vh] flex-col overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle className="text-titulo">{TITULO_ESCOLHER_PECA}</DialogTitle>
        </DialogHeader>

        {erro && (
          <p role="alert" aria-live="assertive" className="text-apoio text-destructive">
            {erro}
          </p>
        )}

        {pecas.length === 0 ? (
          <p className="text-apoio text-muted-foreground">{FRASE_VAZIO_ESCOLHER_PECA}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {pecas.map((peca) => (
              <li key={peca.id}>
                <button
                  type="button"
                  disabled={enviandoId !== null}
                  onClick={() => void escolher(peca.id)}
                  className="border-border hover:bg-muted text-corpo flex min-h-[44px] w-full items-center justify-between gap-3 rounded-md border px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="break-words">{peca.nome}</span>
                  <span className="text-apoio text-muted-foreground tabular-nums flex items-center gap-2">
                    {enviandoId === peca.id && (
                      <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                    )}
                    {rotuloMinimoNaLista(
                      peca.minimoCentavos !== null ? formatarReais(peca.minimoCentavos) : "—",
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={fechar}
            className="border-border hover:bg-muted text-corpo flex min-h-[44px] items-center rounded-md border px-4"
          >
            {ROTULO_FECHAR}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import type { Cotacao } from "@/lib/cotacoes/consultas";
import { ROTULO_EDITAR_NO_DETALHE, ROTULO_FECHAR_DETALHE } from "@/lib/cotacoes/textos";
import { cn } from "@/lib/utils";
import {
  useAbridorDeCotacoes,
  useCotacaoDetalheId,
} from "@/components/amassa/cotacoes/contexto-cotacoes";
import { irParaSemNavegar } from "@/components/amassa/abertura/url-sem-navegar";
import { CamposLongos } from "@/components/amassa/cotacoes/campos-longos";
import { PrecoCotacao } from "@/components/amassa/cotacoes/preco-cotacao";
import { SeloSituacao } from "@/components/amassa/cotacoes/selo-situacao";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type DetalheCotacaoProps = {
  // A lista de cotações da categoria ATIVA, já carregada por `page.tsx` — nunca uma segunda
  // consulta. UMA instância para a lista TODA, achando a cotação certa pelo identificador de
  // `?detalhe=<id>` dentro do array (T-04.3-21: um identificador que não corresponde a nenhuma
  // linha simplesmente não abre nada — nenhuma consulta nova é disparada a partir da URL).
  cotacoes: Cotacao[];
};

// O detalhe completo de UMA cotação (D-12): empresa como título, especificação abaixo, preço EM
// DESTAQUE ao lado do selo, e então os seis campos longos (`CamposLongos`, compartilhado com a
// comparação da Tarefa 3). Aberto por `?detalhe=<id>` escrito com `history.pushState` (D-23) —
// nunca uma navegação de servidor, porque o dado já está no array carregado.
export function DetalheCotacao({ cotacoes }: DetalheCotacaoProps) {
  const detalheId = useCotacaoDetalheId();
  const abridor = useAbridorDeCotacoes();
  const cotacao = cotacoes.find((candidata) => candidata.id === detalheId) ?? null;
  const aberto = cotacao !== null;

  function fechar() {
    const parametros = new URLSearchParams(window.location.search);
    parametros.delete("detalhe");
    const query = parametros.toString();
    irParaSemNavegar(`/abertura${query ? `?${query}` : ""}`);
  }

  // Fecha o detalhe e abre o formulário de edição DA MESMA cotação — troca `detalhe` por
  // `cotacao` na URL (nunca os dois diálogos abertos ao mesmo tempo, mesmo cuidado de
  // `formulario-cotacao.tsx`/`abrirConfirmarRemocao`), e entrega a cotação INTEIRA ao abridor: a
  // navegação por `history.pushState` não busca dado novo do servidor.
  function abrirEdicao() {
    if (!cotacao) {
      return;
    }
    const parametros = new URLSearchParams(window.location.search);
    parametros.delete("detalhe");
    parametros.set("cotacao", cotacao.id);
    irParaSemNavegar(`/abertura?${parametros.toString()}`);
    abridor.abrirCotacao(cotacao);
  }

  return (
    <Dialog open={aberto} onOpenChange={(novoValor) => !novoValor && fechar()}>
      <DialogContent
        showCloseButton
        aria-label={cotacao ? `Detalhes de «${cotacao.empresa}»` : "Detalhe da cotação"}
        data-testid="cotacoes-detalhe"
        className={cn(
          // Celular (base, mobile-first): folha de baixo, tela toda — mesmo molde de
          // `formulario-cotacao.tsx`/`formulario-item.tsx`.
          "inset-x-0 top-auto bottom-0 left-0 flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none rounded-t-none border-0 border-t p-0 data-open:slide-in-from-bottom-10 data-open:zoom-in-100 data-closed:slide-out-to-bottom-10 data-closed:zoom-out-100",
          // Desktop (`md:`): modal centralizado.
          "md:top-1/2 md:right-auto md:bottom-auto md:left-1/2 md:h-auto md:max-h-[85svh] md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:border md:data-open:zoom-in-95 md:data-closed:zoom-out-95",
        )}
      >
        {cotacao && (
          <>
            {/* `descartada` já não dilui empresa/especificação/preço por `opacity-60` (achado de
                acessibilidade, WCAG 1.4.3, UI-09, mesmo cálculo de `cartao-cotacao.tsx`) — o
                Dialog mostra UMA cotação por vez (nunca lado a lado com outra "normal" para
                comparar), então o SELO abaixo já é suficiente para comunicar "descartado" sem
                precisar de uma segunda pista visual aqui. */}
            <DialogHeader className="border-border border-b px-6 py-4">
              <DialogTitle className="text-titulo">{cotacao.empresa}</DialogTitle>
              {cotacao.produto && (
                <p className="text-apoio text-muted-foreground">{cotacao.produto}</p>
              )}
            </DialogHeader>

            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-4">
              <div className="flex items-center gap-3">
                <PrecoCotacao centavos={cotacao.precoCentavos} tamanho="titulo" />
                <SeloSituacao situacao={cotacao.situacao} />
              </div>

              <CamposLongos cotacao={cotacao} />
            </div>

            {/* Rodapé preso ao pé do diálogo por FLEX, nunca por `position: sticky` (D-24) —
                irmão da área rolável, não filho dela. */}
            <div className="border-border bg-popover flex flex-col gap-3 border-t px-6 py-4">
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={fechar}
                  className="border-border hover:bg-muted text-corpo flex min-h-[44px] items-center rounded-md border px-4"
                >
                  {ROTULO_FECHAR_DETALHE}
                </button>
                <button
                  type="button"
                  onClick={abrirEdicao}
                  className="bg-primary text-primary-foreground hover:bg-primary/80 text-corpo flex min-h-[44px] items-center rounded-md px-4 font-medium"
                >
                  {ROTULO_EDITAR_NO_DETALHE}
                </button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

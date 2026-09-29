"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { irParaSemNavegar } from "@/components/amassa/abertura/url-sem-navegar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatarReais } from "@/lib/financeiro/formato";
import { atualizarPrecos } from "@/lib/orcamentos/acoes";
import type { SugestaoDePreco } from "@/lib/orcamentos/atualizacao";
import { formatarPercentualDeVariacao } from "@/lib/orcamentos/formato";
import {
  DICA_ATUALIZAR_RASCUNHO,
  FRASE_NADA_MUDOU_NOS_CUSTOS,
  ROTULO_ATUALIZAR,
  ROTULO_CANCELAR,
  ROTULO_ESTA_ABAIXO,
  ROTULO_ESTA_ACIMA,
  ROTULO_IGUAL,
  ROTULO_NOVO_PRECO_CADA,
  ROTULO_SEM_RAZAO_ANTERIOR,
  TITULO_ATUALIZAR_PRECOS,
  ROTULO_PRECO_MINIMO_PREFIXO,
  dicaAtualizarCongelado,
  dicaAtualizarConfirmarCongelado,
  rotuloCaiu,
  rotuloMinimoHoje,
  rotuloSubiu,
} from "@/lib/orcamentos/textos";
import { hrefDoOrcamento } from "@/lib/financeiro/navegacao";

export type ModoDoDialogoAtualizarPrecos = "rascunho" | "congelado";

export type DialogoAtualizarPrecosProps = {
  orcamentoId: string;
  modo: ModoDoDialogoAtualizarPrecos;
  sugestoes: SugestaoDePreco[];
  // Só faz sentido no modo congelado — o modo rascunho nunca mostra o aviso "nada mudou" (o
  // protótipo não tem esse texto no ramo rascunho: lá o cálculo já É de hoje).
  algoMudou: boolean;
  // `formatarDataCurta(orcamento.data)` — `null` no modo rascunho (nada foi congelado ainda).
  dataCongelamentoFormatada: string | null;
  // `orcamento.revisao + 1` — só usado no parágrafo final do modo congelado.
  novaRevisao: number;
};

const CLASSES_DA_ETIQUETA: Record<"sucesso" | "atencao" | "neutra", string> = {
  sucesso: "bg-sucesso-fundo text-sucesso",
  atencao: "bg-atencao-fundo text-atencao",
  neutra: "bg-muted text-muted-foreground",
};

function precoParaTexto(centavos: number): string {
  return (centavos / 100).toFixed(2).replace(".", ",");
}

// O diálogo "Atualizar preços" (04.5-09-PLAN.md, Tarefa 3, D-23) — aberto via `?atualizarPrecos=1`
// (mesma disciplina de `EscolherPeca`: abrir é troca de URL sem transição, `window.history.
// pushState`, porque não precisa de nenhum dado novo do servidor — as sugestões já chegam
// prontas, calculadas por `sugerirPrecos` em `EditorOrcamento`). Confirmar É gravação (o servidor
// decide o que persiste), e por isso termina em navegação COMPLETA — nunca uma atualização de
// rota só no cliente.
//
// Diálogo único responsivo, com o corpo rolável e o rodapé preso pelo FLEX do `<form>` — nunca a
// técnica que já quebrou o desktop uma vez (ver o debug resolvido em
// .planning/debug/resolved/rodape-formulario-desktop.md, reaproveitado de
// `components/amassa/encomendas/formulario-encomenda.tsx`): a área de linhas é `flex-1 min-h-0
// overflow-y-auto`, o rodapé é um `div` IRMÃO dela, de tamanho natural — o flex sozinho o prende
// ao pé do diálogo nos dois tamanhos de tela, mesmo com oito peças rolando por baixo.
export function DialogoAtualizarPrecos({
  orcamentoId,
  modo,
  sugestoes,
  algoMudou,
  dataCongelamentoFormatada,
  novaRevisao,
}: DialogoAtualizarPrecosProps) {
  const searchParams = useSearchParams();
  const aberto = searchParams.get("atualizarPrecos") === "1";

  const [precosTexto, setPrecosTexto] = useState<Record<string, string>>(() =>
    Object.fromEntries(sugestoes.map((sugestao) => [sugestao.linhaId, precoParaTexto(sugestao.precoSugeridoCentavos)])),
  );
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function fechar() {
    setErro(null);
    irParaSemNavegar(hrefDoOrcamento(orcamentoId));
  }

  async function confirmar() {
    setEnviando(true);
    setErro(null);

    const resposta = await atualizarPrecos({
      orcamentoId,
      linhas: sugestoes.map((sugestao) => ({
        linhaId: sugestao.linhaId,
        precoTexto: precosTexto[sugestao.linhaId] ?? "",
      })),
    });

    setEnviando(false);
    if (!resposta.ok) {
      setErro(resposta.erro);
      return;
    }

    // Navegação COMPLETA — o cabeçalho (revisão, data, validade) e o histórico só o servidor
    // sabem depois de gravar, nunca uma atualização otimista no cliente.
    const aviso = modo === "congelado" ? "orcamento-revisao-criada" : "orcamento-atualizado";
    window.location.assign(hrefDoOrcamento(orcamentoId, { aviso }));
  }

  return (
    <Dialog open={aberto} onOpenChange={(novoValor) => !novoValor && fechar()}>
      <DialogContent
        aria-label={TITULO_ATUALIZAR_PRECOS}
        className={cn(
          // Celular (base): folha de baixo, tela toda — mesmo contrato de
          // `formulario-encomenda.tsx`.
          "inset-x-0 top-auto bottom-0 left-0 flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none rounded-t-none border-0 border-t p-0",
          // Desktop (`md:`): modal centralizado.
          "md:top-1/2 md:right-auto md:bottom-auto md:left-1/2 md:h-auto md:max-h-[85svh] md:w-full md:max-w-2xl md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:border",
        )}
      >
        <DialogHeader className="border-border border-b px-6 py-4">
          <DialogTitle className="text-titulo">{TITULO_ATUALIZAR_PRECOS}</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
          {erro && (
            <p role="alert" aria-live="assertive" className="text-apoio text-destructive">
              {erro}
            </p>
          )}

          <p className="text-apoio text-muted-foreground">
            {modo === "rascunho" ? DICA_ATUALIZAR_RASCUNHO : dicaAtualizarCongelado(dataCongelamentoFormatada ?? "")}
          </p>

          {modo === "congelado" && !algoMudou && (
            <div
              data-testid="orcamento-atualizar-nada-mudou"
              role="status"
              className="bg-sucesso-fundo text-sucesso text-corpo rounded-lg p-3"
            >
              {FRASE_NADA_MUDOU_NOS_CUSTOS}
            </div>
          )}

          <div className="flex flex-col gap-4">
            {sugestoes.map((sugestao) => {
              const precoJaEstaAcima = sugestao.precoAtualCentavos >= sugestao.minimoDeHojeCentavos;
              const semanticaDaEtiqueta: "sucesso" | "atencao" | "neutra" =
                modo === "rascunho"
                  ? precoJaEstaAcima
                    ? "sucesso"
                    : "atencao"
                  : !sugestao.temRazaoAnterior
                    ? "neutra"
                    : sugestao.direcao === "subiu"
                      ? "atencao"
                      : sugestao.direcao === "caiu"
                        ? "sucesso"
                        : "neutra";

              const textoDaEtiqueta =
                modo === "rascunho"
                  ? precoJaEstaAcima
                    ? ROTULO_ESTA_ACIMA
                    : ROTULO_ESTA_ABAIXO
                  : !sugestao.temRazaoAnterior
                    ? ROTULO_SEM_RAZAO_ANTERIOR
                    : sugestao.direcao === "subiu"
                      ? rotuloSubiu(formatarPercentualDeVariacao(sugestao.percentualAbsoluto ?? 0))
                      : sugestao.direcao === "caiu"
                        ? rotuloCaiu(formatarPercentualDeVariacao(sugestao.percentualAbsoluto ?? 0))
                        : ROTULO_IGUAL;

              return (
                <div
                  key={sugestao.linhaId}
                  data-testid="atualizar-linha"
                  className="border-border flex flex-col gap-2 rounded-lg border p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-corpo text-foreground break-words">{sugestao.nome}</span>
                    <span className="text-corpo text-muted-foreground tabular-nums">
                      {formatarReais(sugestao.precoAtualCentavos)}
                    </span>
                  </div>

                  <p className="text-apoio text-muted-foreground flex flex-wrap items-center gap-2">
                    {modo === "rascunho" ? (
                      <span data-testid="atualizar-minimo-hoje">
                        {rotuloMinimoHoje(formatarReais(sugestao.minimoDeHojeCentavos))}
                      </span>
                    ) : (
                      <span>
                        {`${ROTULO_PRECO_MINIMO_PREFIXO} `}
                        <span data-testid="atualizar-minimo-antes">
                          {formatarReais(sugestao.minimoCongeladoCentavos ?? 0)}
                        </span>
                        {" → "}
                        <span data-testid="atualizar-minimo-hoje">
                          {formatarReais(sugestao.minimoDeHojeCentavos)}
                        </span>
                      </span>
                    )}
                    <span
                      data-testid="atualizar-etiqueta"
                      className={`text-micro rounded-full px-2 py-0.5 ${CLASSES_DA_ETIQUETA[semanticaDaEtiqueta]}`}
                    >
                      {textoDaEtiqueta}
                    </span>
                  </p>

                  <label className="flex flex-col gap-1">
                    <span className="text-apoio text-muted-foreground">{ROTULO_NOVO_PRECO_CADA}</span>
                    <input
                      data-testid="atualizar-preco-novo"
                      inputMode="decimal"
                      // `text-corpo` = 16px (app/globals.css) — o mínimo do CLAUDE.md para nenhum
                      // campo de formulário disparar o zoom automático do iOS ao focar; mesma
                      // classe que `orcamento-linha-preco` já usa.
                      className="border-border text-corpo min-h-[44px] max-w-[200px] rounded-md border px-3"
                      value={precosTexto[sugestao.linhaId] ?? ""}
                      onChange={(evento) =>
                        setPrecosTexto((atual) => ({ ...atual, [sugestao.linhaId]: evento.target.value }))
                      }
                    />
                  </label>
                </div>
              );
            })}
          </div>

          {modo === "congelado" && (
            <p className="text-apoio text-muted-foreground">{dicaAtualizarConfirmarCongelado(novaRevisao)}</p>
          )}
        </div>

        {/* Rodapé ao pé do diálogo por FLEX, nunca pela técnica que já quebrou o desktop uma vez
            (ver .planning/debug/resolved/rodape-formulario-desktop.md): este `div` é IRMÃO da
            área rolável acima, não filho dela, e o flex do contêiner já o prende ao pé nos dois
            tamanhos de tela. */}
        <div className="border-border bg-popover flex flex-col gap-3 border-t px-6 py-4">
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={fechar}
              className="border-border hover:bg-muted text-corpo flex min-h-[44px] items-center rounded-md border px-4"
            >
              {ROTULO_CANCELAR}
            </button>
            <button
              type="button"
              disabled={enviando}
              onClick={() => void confirmar()}
              className="bg-primary text-primary-foreground hover:bg-primary/80 text-corpo flex min-h-[44px] items-center rounded-md px-4 font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enviando ? "Atualizando…" : ROTULO_ATUALIZAR}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

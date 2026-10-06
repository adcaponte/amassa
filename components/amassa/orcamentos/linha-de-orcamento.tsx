"use client";

import { useEffect, useState } from "react";

import { atualizarLinha, removerLinha } from "@/lib/orcamentos/acoes";
import {
  CORPO_CONFIRMAR_TIRAR_LINHA,
  PLACEHOLDER_COR_ESMALTE,
  PLACEHOLDER_PERSONALIZACAO,
  ROTULO_CADA,
  ROTULO_COR_ESMALTE,
  ROTULO_PERSONALIZACAO,
  ROTULO_QUANTAS,
  ROTULO_TIRAR,
  ROTULO_VER_CALCULO,
  rotuloPrecoMinimoDaLinha,
  tituloConfirmarTirarLinha,
} from "@/lib/orcamentos/textos";
import { centavosParaCampo } from "@/lib/financeiro/dinheiro";
import { formatarReais } from "@/lib/financeiro/formato";
import type { ResultadoDaFicha } from "@/lib/precificacao/ficha";
import { FRASE_DIVISOR_INVALIDO, FRASE_NAO_CABE_NO_FORNO } from "@/lib/precificacao/textos";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SeloDePreco } from "@/components/amassa/precificacao/selo-de-preco";
import { hrefDoOrcamento } from "@/lib/financeiro/navegacao";

export type LinhaDeOrcamentoProps = {
  orcamentoId: string;
  id: string;
  fichaId: string;
  // `false` fora de rascunho (04.5-08-PLAN.md, "congelamento visual") — os mesmos dados aparecem
  // como texto simples, sem nenhum controle de edição residual visível (mesma disciplina de
  // `CabecalhoDoOrcamento`/`CustosDoProjeto`/`TotalEPagamento`).
  vivo: boolean;
  nome: string;
  quantidade: number;
  precoUnitarioCentavos: number;
  cor: string | null;
  personalizacao: string | null;
  // O resultado JÁ CALCULADO pelo `EditorOrcamento` (a MESMA cadeia
  // quantasCabem→calcularPeca→farolDoPreco que `DialogoFicha`/`ListaPecas` já usam, enquanto vivo
  // — ou lido do snapshot congelado, quando não) — esta linha nunca recalcula sozinha.
  resultado: ResultadoDaFicha;
};

// Uma linha de peça do orçamento (Client Component POR LINHA, mesma disciplina de "diálogo
// montado por linha" já usada em Abertura/Peças — não promove a lista inteira a cliente).
// Editar um campo grava pela Server Action correspondente (`atualizarLinha`); "ver cálculo" e
// "+ Peça exclusiva" usam navegação COMPLETA (a MESMA convenção que `DialogoFicha` já usa para
// abrir/editar uma ficha — precisam de dado novo do servidor); "tirar" é confirmação local, sem
// URL (o gatilho e a confirmação vivem no MESMO componente). Fora de rascunho, nenhum dos três
// controles aparece — só leitura.
export function LinhaDeOrcamento({
  orcamentoId,
  id,
  fichaId,
  vivo,
  nome,
  quantidade,
  precoUnitarioCentavos,
  cor,
  personalizacao,
  resultado,
}: LinhaDeOrcamentoProps) {
  const [quantidadeTexto, setQuantidadeTexto] = useState(String(quantidade));
  const [precoTexto, setPrecoTexto] = useState(centavosParaCampo(precoUnitarioCentavos));
  const [corTexto, setCorTexto] = useState(cor ?? "");
  const [personalizacaoTexto, setPersonalizacaoTexto] = useState(personalizacao ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmandoTirar, setConfirmandoTirar] = useState(false);
  const [removendo, setRemovendo] = useState(false);

  // Recarrega os campos quando o servidor devolve dados novos (depois de uma navegação completa
  // — ex.: "+ Peça exclusiva" acrescentou outra linha e a página inteira recarregou).
  useEffect(() => {
    setQuantidadeTexto(String(quantidade));
    setPrecoTexto(centavosParaCampo(precoUnitarioCentavos));
    setCorTexto(cor ?? "");
    setPersonalizacaoTexto(personalizacao ?? "");
  }, [id, quantidade, precoUnitarioCentavos, cor, personalizacao]);

  async function salvar(campos: {
    quantidadeTexto: string;
    precoTexto: string;
    corTexto: string;
    personalizacaoTexto: string;
  }) {
    setSalvando(true);
    setErro(null);

    const resposta = await atualizarLinha({
      orcamentoId,
      id,
      quantidadeTexto: campos.quantidadeTexto,
      precoTexto: campos.precoTexto,
      corTexto: campos.corTexto,
      personalizacaoTexto: campos.personalizacaoTexto,
    });

    setSalvando(false);

    if (!resposta.ok) {
      setErro(resposta.erro);
      return;
    }

    // Navegação COMPLETA — o subtotal/total do orçamento e o "preço mínimo" desta e de outras
    // linhas dependem do que só o servidor recalcula.
    window.location.assign(hrefDoOrcamento(orcamentoId));
  }

  async function confirmarTirar(evento: { preventDefault: () => void }) {
    evento.preventDefault();
    setRemovendo(true);
    setErro(null);

    const resposta = await removerLinha({ orcamentoId, id });

    setRemovendo(false);

    if (!resposta.ok) {
      setErro(resposta.erro);
      return;
    }

    window.location.assign(hrefDoOrcamento(orcamentoId));
  }

  const subtotalCentavos = quantidade * precoUnitarioCentavos;

  return (
    <div
      data-testid="orcamento-linha"
      className="border-border flex flex-col gap-3 rounded-md border p-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-corpo text-foreground break-words">{nome}</span>
        <span className="text-corpo text-foreground tabular-nums">{formatarReais(subtotalCentavos)}</span>
      </div>

      {erro && (
        <p role="alert" aria-live="assertive" className="text-apoio text-destructive">
          {erro}
        </p>
      )}

      {vivo ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-apoio text-muted-foreground flex flex-col gap-1">
            {ROTULO_QUANTAS}
            <input
              data-testid="orcamento-linha-quantidade"
              inputMode="numeric"
              value={quantidadeTexto}
              disabled={salvando}
              onChange={(evento) => setQuantidadeTexto(evento.target.value)}
              onBlur={() =>
                void salvar({ quantidadeTexto, precoTexto, corTexto, personalizacaoTexto })
              }
              className="border-border text-corpo min-h-[44px] w-20 rounded-md border px-2"
            />
          </label>
          <label className="text-apoio text-muted-foreground flex flex-col gap-1">
            {ROTULO_CADA}
            <input
              data-testid="orcamento-linha-preco"
              inputMode="decimal"
              value={precoTexto}
              disabled={salvando}
              onChange={(evento) => setPrecoTexto(evento.target.value)}
              onBlur={() =>
                void salvar({ quantidadeTexto, precoTexto, corTexto, personalizacaoTexto })
              }
              className="border-border text-corpo min-h-[44px] w-28 rounded-md border px-2"
            />
          </label>
          <a
            href={rotaDeGestao(`/financeiro?aba=orcamentos&orcamento=${orcamentoId}&peca=${fichaId}`)}
            className="text-corpo hover:bg-muted flex min-h-[44px] items-center rounded-md px-2 underline"
          >
            {ROTULO_VER_CALCULO}
          </a>
          <button
            type="button"
            onClick={() => setConfirmandoTirar(true)}
            className="text-corpo text-destructive hover:bg-destructive/10 flex min-h-[44px] items-center rounded-md px-2 underline"
          >
            {ROTULO_TIRAR}
          </button>
        </div>
      ) : (
        <p data-testid="orcamento-linha-quantidade-preco" className="text-apoio text-muted-foreground tabular-nums">
          {`${quantidade} × ${formatarReais(precoUnitarioCentavos)}`}
        </p>
      )}

      {vivo ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-apoio text-muted-foreground flex flex-col gap-1">
            {ROTULO_COR_ESMALTE}
            <input
              data-testid="orcamento-linha-cor"
              placeholder={PLACEHOLDER_COR_ESMALTE}
              value={corTexto}
              disabled={salvando}
              onChange={(evento) => setCorTexto(evento.target.value)}
              onBlur={() =>
                void salvar({ quantidadeTexto, precoTexto, corTexto, personalizacaoTexto })
              }
              className="border-border text-corpo min-h-[44px] rounded-md border px-2"
            />
          </label>
          <label className="text-apoio text-muted-foreground flex flex-col gap-1">
            {ROTULO_PERSONALIZACAO}
            <input
              data-testid="orcamento-linha-personalizacao"
              placeholder={PLACEHOLDER_PERSONALIZACAO}
              value={personalizacaoTexto}
              disabled={salvando}
              onChange={(evento) => setPersonalizacaoTexto(evento.target.value)}
              onBlur={() =>
                void salvar({ quantidadeTexto, precoTexto, corTexto, personalizacaoTexto })
              }
              className="border-border text-corpo min-h-[44px] rounded-md border px-2"
            />
          </label>
        </div>
      ) : (
        (cor || personalizacao) && (
          <p className="text-apoio text-muted-foreground">
            {[cor ? `Cor: ${cor}` : null, personalizacao].filter(Boolean).join(" · ")}
          </p>
        )
      )}

      <div data-testid="orcamento-linha-minimo" className="flex flex-wrap items-center gap-2">
        {resultado.ok ? (
          <>
            <span className="text-apoio text-muted-foreground">
              {rotuloPrecoMinimoDaLinha(formatarReais(resultado.minimoCentavos))}
            </span>
            <SeloDePreco
              farol={resultado.farol}
              precoPraticadoCentavos={precoUnitarioCentavos}
              minimoCentavos={resultado.minimoCentavos}
            />
          </>
        ) : (
          <p className="text-apoio text-destructive">
            {resultado.motivo === "nao-cabe" ? FRASE_NAO_CABE_NO_FORNO : FRASE_DIVISOR_INVALIDO}
          </p>
        )}
      </div>

      <AlertDialog
        open={confirmandoTirar}
        onOpenChange={(novoValor) => {
          if (!removendo) {
            setConfirmandoTirar(novoValor);
          }
        }}
      >
        <AlertDialogContent data-testid="dialogo-tirar-linha" className="max-h-[85svh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="[overflow-wrap:anywhere]">
              {tituloConfirmarTirarLinha(nome)}
            </AlertDialogTitle>
            <AlertDialogDescription>{CORPO_CONFIRMAR_TIRAR_LINHA}</AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={removendo}>Voltar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={removendo} onClick={confirmarTirar}>
              {removendo ? "Tirando…" : ROTULO_TIRAR}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

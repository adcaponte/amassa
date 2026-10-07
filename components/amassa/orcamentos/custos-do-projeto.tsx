"use client";

import { useRef, useState } from "react";

import {
  acrescentarCustoDeProjeto,
  atualizarCustoDeProjeto,
  definirPlanoDePagamento,
  removerCustoDeProjeto,
} from "@/lib/orcamentos/acoes";
import { centavosParaCampo } from "@/lib/financeiro/dinheiro";
import { formatarReais } from "@/lib/financeiro/formato";
import type { CustoDeProjetoDoOrcamento } from "@/lib/orcamentos/consultas";
import type { PlanoDePagamentoDoOrcamento } from "@/lib/orcamentos/plano";
import {
  CORPO_CONFIRMAR_TIRAR_CUSTO_DE_PROJETO,
  DICA_CUSTOS_DE_PROJETO,
  ROTULO_FRETE,
  ROTULO_MAIS_CUSTO_DE_PROJETO,
  ROTULO_O_QUE,
  ROTULO_TIRAR,
  ROTULO_VALOR,
  TITULO_CUSTOS_DO_PROJETO,
  tituloConfirmarTirarCustoDeProjeto,
} from "@/lib/orcamentos/textos";
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
import { hrefDoOrcamento } from "@/lib/financeiro/navegacao";

export type CustosDoProjetoProps = {
  orcamentoId: string;
  vivo: boolean;
  custos: CustoDeProjetoDoOrcamento[];
  freteCentavos: number;
  // Passados adiante só para completar o trio que `definirPlanoDePagamento` sempre recebe junto
  // (lib/orcamentos/esquemas.ts explica o porquê) — este bloco nunca edita plano/sinal, só lê os
  // valores correntes para reenviá-los sem mudança quando o FRETE muda.
  plano: PlanoDePagamentoDoOrcamento;
  sinalPercentual: number;
};

type LinhaLocal = {
  // Chave estável de `key`/estado — o id do banco quando já existe, ou uma chave local enquanto
  // a linha ainda não foi salva (`acrescentarCustoDeProjeto` não foi chamado nem uma vez).
  chave: string;
  id: string | null;
  descricaoTexto: string;
  valorTexto: string;
};

// "Custos do projeto e frete" (Client Component — a lista de custos é um formulário incremental
// de tamanho variável, e o Frete grava por `definirPlanoDePagamento` — a MESMA ação de "Total e
// pagamento"). Cada linha nasce só no estado local (`+ Custo do projeto`); o PRIMEIRO blur com
// descrição e valor preenchidos é que a persiste de verdade (`acrescentarCustoDeProjeto`) — dali
// em diante, todo blur seguinte grava por `atualizarCustoDeProjeto`.
export function CustosDoProjeto({ orcamentoId, vivo, custos, freteCentavos, plano, sinalPercentual }: CustosDoProjetoProps) {
  const [linhas, setLinhas] = useState<LinhaLocal[]>(
    custos.map((custo) => ({
      chave: custo.id,
      id: custo.id,
      descricaoTexto: custo.descricao,
      valorTexto: centavosParaCampo(custo.valorCentavos),
    })),
  );
  const [erroPorLinha, setErroPorLinha] = useState<Record<string, string>>({});
  const [confirmandoTirar, setConfirmandoTirar] = useState<string | null>(null);
  const [removendo, setRemovendo] = useState(false);
  const contadorLocal = useRef(0);

  const [freteTexto, setFreteTexto] = useState(centavosParaCampo(freteCentavos));
  const [salvandoFrete, setSalvandoFrete] = useState(false);
  const [erroFrete, setErroFrete] = useState<string | null>(null);

  function atualizarCampoLocal(chave: string, campo: "descricaoTexto" | "valorTexto", valor: string) {
    setLinhas((atual) => atual.map((linha) => (linha.chave === chave ? { ...linha, [campo]: valor } : linha)));
  }

  async function salvarLinha(chave: string) {
    const linhaAtual = linhas.find((l) => l.chave === chave);
    if (!linhaAtual) return;

    // Linha ainda incompleta (usuário só tocou um dos dois campos) — nada a salvar ainda.
    if (linhaAtual.descricaoTexto.trim() === "" || linhaAtual.valorTexto.trim() === "") {
      return;
    }

    setErroPorLinha((atual) =>
      Object.fromEntries(Object.entries(atual).filter(([chaveDoErro]) => chaveDoErro !== chave)),
    );

    const resposta = linhaAtual.id
      ? await atualizarCustoDeProjeto({
          orcamentoId,
          id: linhaAtual.id,
          descricaoTexto: linhaAtual.descricaoTexto,
          valorTexto: linhaAtual.valorTexto,
        })
      : await acrescentarCustoDeProjeto({
          orcamentoId,
          descricaoTexto: linhaAtual.descricaoTexto,
          valorTexto: linhaAtual.valorTexto,
        });

    if (!resposta.ok) {
      setErroPorLinha((atual) => ({ ...atual, [chave]: resposta.erro }));
      return;
    }

    window.location.assign(hrefDoOrcamento(orcamentoId));
  }

  function acrescentarLinhaLocal() {
    contadorLocal.current += 1;
    setLinhas((atual) => [
      ...atual,
      { chave: `novo-${contadorLocal.current}`, id: null, descricaoTexto: "", valorTexto: "" },
    ]);
  }

  async function confirmarTirar() {
    const chave = confirmandoTirar;
    if (!chave) return;
    const linhaAlvo = linhas.find((l) => l.chave === chave);
    if (!linhaAlvo) return;

    // Linha só local, nunca salva — nada a apagar no servidor.
    if (!linhaAlvo.id) {
      setLinhas((atual) => atual.filter((l) => l.chave !== chave));
      setConfirmandoTirar(null);
      return;
    }

    setRemovendo(true);
    const resposta = await removerCustoDeProjeto({ orcamentoId, id: linhaAlvo.id });
    setRemovendo(false);

    if (!resposta.ok) {
      setErroPorLinha((atual) => ({ ...atual, [chave]: resposta.erro }));
      setConfirmandoTirar(null);
      return;
    }

    window.location.assign(hrefDoOrcamento(orcamentoId));
  }

  async function salvarFrete() {
    setSalvandoFrete(true);
    setErroFrete(null);

    const resposta = await definirPlanoDePagamento({
      orcamentoId,
      planoTexto: plano,
      sinalTexto: plano === "sinal" ? String(sinalPercentual) : undefined,
      freteTexto,
    });

    setSalvandoFrete(false);

    if (!resposta.ok) {
      setErroFrete(resposta.erro);
      return;
    }

    window.location.assign(hrefDoOrcamento(orcamentoId));
  }

  const linhaEmConfirmacao = linhas.find((l) => l.chave === confirmandoTirar);

  return (
    <section className="border-border flex flex-col gap-3 rounded-lg border p-4">
      <h2 className="text-titulo text-foreground">{TITULO_CUSTOS_DO_PROJETO}</h2>
      <p className="text-apoio text-muted-foreground">{DICA_CUSTOS_DE_PROJETO}</p>

      {vivo ? (
        <div className="flex flex-col gap-3">
          {linhas.map((linha) => (
            <div key={linha.chave} data-testid="projeto-linha" className="flex flex-col gap-2">
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-apoio text-muted-foreground flex flex-[2_1_160px] flex-col gap-1">
                  {ROTULO_O_QUE}
                  <input
                    data-testid="projeto-linha-descricao"
                    value={linha.descricaoTexto}
                    onChange={(evento) => atualizarCampoLocal(linha.chave, "descricaoTexto", evento.target.value)}
                    onBlur={() => void salvarLinha(linha.chave)}
                    className="border-border text-corpo min-h-[44px] rounded-md border px-2"
                  />
                </label>
                <label className="text-apoio text-muted-foreground flex flex-col gap-1">
                  {ROTULO_VALOR}
                  <input
                    data-testid="projeto-linha-valor"
                    inputMode="decimal"
                    value={linha.valorTexto}
                    onChange={(evento) => atualizarCampoLocal(linha.chave, "valorTexto", evento.target.value)}
                    onBlur={() => void salvarLinha(linha.chave)}
                    className="border-border text-corpo min-h-[44px] w-28 rounded-md border px-2"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setConfirmandoTirar(linha.chave)}
                  className="text-corpo text-destructive hover:bg-destructive/10 flex min-h-[44px] items-center rounded-md px-2 underline"
                >
                  {ROTULO_TIRAR}
                </button>
              </div>
              {erroPorLinha[linha.chave] && (
                <p role="alert" aria-live="assertive" className="text-apoio text-destructive">
                  {erroPorLinha[linha.chave]}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {custos.map((custo) => (
            <div key={custo.id} data-testid="projeto-linha" className="flex items-center justify-between gap-3">
              <span className="text-corpo text-foreground break-words">{custo.descricao}</span>
              <span className="text-corpo text-foreground tabular-nums">{formatarReais(custo.valorCentavos)}</span>
            </div>
          ))}
        </div>
      )}

      {vivo ? (
        <div className="flex flex-wrap items-end gap-3">
          <button
            type="button"
            onClick={acrescentarLinhaLocal}
            className="border-border text-corpo hover:bg-muted flex min-h-[44px] items-center rounded-md border px-4"
          >
            {ROTULO_MAIS_CUSTO_DE_PROJETO}
          </button>
          <label className="text-apoio text-muted-foreground flex flex-col gap-1" style={{ maxWidth: 160 }}>
            {ROTULO_FRETE}
            <input
              data-testid="orcamento-frete"
              inputMode="decimal"
              value={freteTexto}
              disabled={salvandoFrete}
              onChange={(evento) => setFreteTexto(evento.target.value)}
              onBlur={() => void salvarFrete()}
              className="border-border text-corpo min-h-[44px] rounded-md border px-2"
            />
          </label>
          {erroFrete && (
            <p role="alert" aria-live="assertive" className="text-apoio text-destructive">
              {erroFrete}
            </p>
          )}
        </div>
      ) : (
        freteCentavos > 0 && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-corpo text-foreground">{ROTULO_FRETE}</span>
            <span className="text-corpo text-foreground tabular-nums">{formatarReais(freteCentavos)}</span>
          </div>
        )
      )}

      <AlertDialog
        open={confirmandoTirar !== null}
        onOpenChange={(novoValor) => {
          if (!removendo) {
            setConfirmandoTirar(novoValor ? confirmandoTirar : null);
          }
        }}
      >
        <AlertDialogContent data-testid="dialogo-tirar-custo-de-projeto" className="max-h-[85svh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="[overflow-wrap:anywhere]">
              {linhaEmConfirmacao ? tituloConfirmarTirarCustoDeProjeto(linhaEmConfirmacao.descricaoTexto) : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>{CORPO_CONFIRMAR_TIRAR_CUSTO_DE_PROJETO}</AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={removendo}>Voltar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={removendo} onClick={confirmarTirar}>
              {removendo ? "Tirando…" : ROTULO_TIRAR}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

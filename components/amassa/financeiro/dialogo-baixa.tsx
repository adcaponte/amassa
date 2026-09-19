"use client";

import { useEffect, useState } from "react";

import { registrarPagamento } from "@/lib/financeiro/acoes";
import type { ContaEmAberto } from "@/lib/financeiro/consultas";
import {
  DICA_BAIXA,
  ROTULO_CONFIRMAR,
  ROTULO_FORMA,
  ROTULO_FORMA_CAMPO,
  ROTULO_QUANDO,
  ROTULO_VALOR,
  ROTULO_VOLTAR,
  textoTituloBaixa,
  type FormaDePagamento,
} from "@/lib/financeiro/textos";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const FORMAS_EM_ORDEM: readonly FormaDePagamento[] = ["dinheiro", "pix", "cartao"];

// Mesma técnica de `painel-venda.tsx`/`painel-despesa.tsx::centavosParaTexto` — redeclarada aqui
// (D-15 do projeto: cada componente do módulo tem a própria cópia de conversões de exibição).
function centavosParaTexto(centavos: number): string {
  return (centavos / 100).toFixed(2).replace(".", ",");
}

export type ContaSelecionadaParaBaixa = { parcelaId: string; documentoId: string };

export type DialogoBaixaProps = {
  // Estado local do PAI (`ListasCaixa`) — nulo fecha o diálogo. A conta é achada na lista JÁ
  // carregada pela página, nunca uma segunda consulta ao abrir (mesmo key_link de
  // `DialogoDocumento`).
  selecao: ContaSelecionadaParaBaixa | null;
  contas: readonly ContaEmAberto[];
  hoje: string;
  aoFechar: () => void;
};

// "Paguei"/"Recebi" (protótipo `folhaBaixa`, D-01/D-02/D-03): Valor (o previsto preenchido),
// Quando (hoje, nunca depois), Forma (a da parcela) — sucesso é uma NAVEGAÇÃO COMPLETA para o
// aviso `pago`, nunca uma atualização de roteador do Next.
export function DialogoBaixa({ selecao, contas, hoje, aoFechar }: DialogoBaixaProps) {
  const conta = selecao ? (contas.find((candidata) => candidata.parcelaId === selecao.parcelaId) ?? null) : null;
  const aberto = conta !== null;

  const [valorTexto, setValorTexto] = useState("");
  const [quando, setQuando] = useState(hoje);
  const [forma, setForma] = useState<FormaDePagamento>("dinheiro");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Repreenche os campos toda vez que uma conta NOVA é selecionada — nunca ao reabrir a MESMA
  // (o `enviando`/`erro` também zeram, para uma tentativa falha não vazar para a próxima conta).
  useEffect(() => {
    if (conta) {
      setValorTexto(centavosParaTexto(conta.valorCentavos));
      setQuando(hoje);
      setForma(conta.forma);
      setEnviando(false);
      setErro(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conta?.parcelaId]);

  async function confirmar() {
    if (!conta) {
      return;
    }
    setEnviando(true);
    setErro(null);

    const resposta = await registrarPagamento({
      parcelaId: conta.parcelaId,
      valorTexto,
      pagoEm: quando,
      forma,
    });

    if (!resposta.ok) {
      setEnviando(false);
      setErro(resposta.erro);
      return;
    }

    window.location.assign(`/financeiro?aba=caixa&aviso=pago&parcela=${resposta.dados.parcelaId}`);
  }

  return (
    <Dialog
      open={aberto}
      onOpenChange={(novoValor) => {
        if (!novoValor && !enviando) {
          aoFechar();
        }
      }}
    >
      <DialogContent className="max-h-[85svh] overflow-y-auto">
        {conta && (
          <>
            <DialogHeader>
              <DialogTitle className="[overflow-wrap:anywhere]">
                {textoTituloBaixa(conta.tipo, conta.titulo)}
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              <label className="text-apoio text-muted-foreground flex flex-col gap-1">
                {ROTULO_VALOR}
                <input
                  data-testid="baixa-valor"
                  inputMode="decimal"
                  value={valorTexto}
                  onChange={(evento) => setValorTexto(evento.target.value)}
                  className="border-border text-corpo min-h-[44px] rounded-md border bg-transparent px-3"
                />
              </label>

              <label className="text-apoio text-muted-foreground flex flex-col gap-1">
                {ROTULO_QUANDO}
                <input
                  data-testid="baixa-data"
                  type="date"
                  max={hoje}
                  value={quando}
                  onChange={(evento) => setQuando(evento.target.value)}
                  className="border-border text-corpo min-h-[44px] rounded-md border bg-transparent px-3"
                />
              </label>

              <fieldset data-testid="baixa-forma" className="flex flex-col gap-1">
                <legend className="text-apoio text-muted-foreground">{ROTULO_FORMA_CAMPO}</legend>
                <div className="flex gap-2">
                  {FORMAS_EM_ORDEM.map((valor) => (
                    <button
                      key={valor}
                      type="button"
                      aria-pressed={forma === valor}
                      onClick={() => setForma(valor)}
                      className={cn(
                        "text-corpo min-h-[44px] flex-1 rounded-md border px-3",
                        forma === valor
                          ? "border-primary bg-accent text-accent-foreground"
                          : "border-border bg-secondary text-secondary-foreground",
                      )}
                    >
                      {ROTULO_FORMA[valor]}
                    </button>
                  ))}
                </div>
              </fieldset>

              <p className="text-apoio text-muted-foreground">{DICA_BAIXA}</p>

              {erro && (
                <p role="alert" className="text-apoio text-erro">
                  {erro}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={enviando}
                  className="min-h-[44px]"
                  onClick={aoFechar}
                >
                  {ROTULO_VOLTAR}
                </Button>
                <Button type="button" disabled={enviando} className="min-h-[44px]" onClick={confirmar}>
                  {enviando ? "Confirmando…" : ROTULO_CONFIRMAR}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

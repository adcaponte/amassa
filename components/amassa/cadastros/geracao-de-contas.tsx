"use client";

import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { gerarContasDoMes } from "@/lib/cadastros/acoes";
import type { ContaCanceladaNoMes } from "@/lib/cadastros/contas-fixas";
import {
  dicaContasCanceladas,
  FRASE_CANCELADAS_MUDARAM,
  rotuloGerarContas,
  ROTULO_VOLTAR_SEM_GERAR,
  textoOutrasContasDoMes,
  tituloContasCanceladas,
} from "@/lib/cadastros/textos";
import { formatarReais } from "@/lib/financeiro/formato";
import { FRASE_FALHA_AO_GERAR_CONTAS } from "@/lib/financeiro/textos";
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
import { Checkbox } from "@/components/ui/checkbox";

export type ContasGeradas = { criadas: number; mes: string; mantidas: number };

type Pergunta = {
  mes: string;
  mesPorExtenso: string;
  canceladas: ContaCanceladaNoMes[];
  novas: number;
  // Os ids marcados para voltar — todos DESMARCADOS ao abrir (o lado seguro).
  marcadas: string[];
  // O servidor perguntou de novo: outra conta foi cancelada enquanto a pessoa escolhia.
  mudou: boolean;
};

// O fluxo de “Gerar as contas de {mês}” compartilhado pelos Cadastros (`BotaoGerarContas`) e pelo atalho do
// Caixa (`AvisoContasFixas`) — 06.5-WR-03 (quick 261007-shs; decisão do dono, 07/10/2026 — “perguntar antes”).
// A primeira chamada vai sem escolha nenhuma: sem conta cancelada no mês, gera como sempre; com conta
// cancelada, o servidor NÃO grava nada e devolve a lista, e o diálogo pergunta quais voltam — pelo nome,
// todas desmarcadas. “Voltar” fecha sem gravar. Confirmar chama de novo com as vistas e as marcadas; se o
// servidor perguntar de novo (outra conta foi cancelada no meio), a lista é trocada, as marcas das que
// continuam ficam, e a frase diz que mudou. Cada tela mantém a navegação de sucesso dela (`aoGerar`).
export function useGeracaoDeContas({ aoGerar }: { aoGerar: (dados: ContasGeradas) => void }): {
  gerar: (mes: string, mesPorExtenso: string) => Promise<void>;
  enviando: boolean;
  dialogo: ReactNode;
} {
  const [enviando, setEnviando] = useState(false);
  const [pergunta, setPergunta] = useState<Pergunta | null>(null);
  const primeiraCaixa = useRef<HTMLButtonElement>(null);

  async function chamar(
    mes: string,
    mesPorExtenso: string,
    escolha: { canceladasVistas: string[]; recriar: string[] },
  ): Promise<void> {
    if (enviando) {
      return;
    }
    setEnviando(true);
    let resposta: Awaited<ReturnType<typeof gerarContasDoMes>>;
    try {
      resposta = await gerarContasDoMes({ mes, ...escolha });
    } catch {
      setEnviando(false);
      toast.error(FRASE_FALHA_AO_GERAR_CONTAS);
      return;
    }

    if (resposta.ok) {
      // A navegação completa de quem chama; o botão fica em “Gerando…” até a página trocar.
      aoGerar(resposta.dados);
      return;
    }
    setEnviando(false);

    if (resposta.pergunta) {
      const { canceladas, novas } = resposta.pergunta;
      const idsDeAgora = new Set(canceladas.map((conta) => conta.id));
      setPergunta((anterior) => ({
        mes,
        mesPorExtenso,
        canceladas,
        novas,
        marcadas: (anterior?.marcadas ?? []).filter((id) => idsDeAgora.has(id)),
        mudou: anterior !== null,
      }));
      return;
    }
    toast.error(resposta.erro);
  }

  function marcar(id: string, marcada: boolean) {
    setPergunta((atual) =>
      atual === null
        ? atual
        : {
            ...atual,
            marcadas: marcada
              ? [...atual.marcadas.filter((outro) => outro !== id), id]
              : atual.marcadas.filter((outro) => outro !== id),
          },
    );
  }

  const dialogo = (
    <AlertDialog
      open={pergunta !== null}
      onOpenChange={(aberto) => {
        if (!aberto && !enviando) {
          setPergunta(null);
        }
      }}
    >
      <AlertDialogContent
        data-testid="gerar-canceladas"
        className="max-h-[85svh] overflow-y-auto"
        onOpenAutoFocus={(evento) => {
          // O foco vai à primeira caixa (o teclado escolhe e confirma sem passar pelo “Voltar”).
          evento.preventDefault();
          primeiraCaixa.current?.focus();
        }}
      >
        {pergunta && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="[overflow-wrap:anywhere]">
                {tituloContasCanceladas(pergunta.canceladas.length, pergunta.mesPorExtenso)}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-corpo">
                {dicaContasCanceladas(pergunta.canceladas.length)}{" "}
                {textoOutrasContasDoMes(pergunta.novas, pergunta.mesPorExtenso)}
              </AlertDialogDescription>
            </AlertDialogHeader>

            {pergunta.mudou && (
              <p role="alert" data-testid="gerar-canceladas-mudou" className="text-apoio text-atencao">
                {FRASE_CANCELADAS_MUDARAM}
              </p>
            )}

            <div className="flex flex-col gap-2">
              {pergunta.canceladas.map((conta, indice) => {
                const idDoCampo = `gerar-cancelada-${conta.id}`;
                return (
                  <label
                    key={conta.id}
                    htmlFor={idDoCampo}
                    data-testid="gerar-cancelada-opcao"
                    data-conta-id={conta.id}
                    className="border-border text-corpo flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md border px-3 py-2 [overflow-wrap:anywhere]"
                  >
                    <Checkbox
                      id={idDoCampo}
                      ref={indice === 0 ? primeiraCaixa : undefined}
                      checked={pergunta.marcadas.includes(conta.id)}
                      disabled={enviando}
                      onCheckedChange={(valor) => marcar(conta.id, valor === true)}
                    />
                    <span>
                      {conta.nome} · {formatarReais(conta.valorCentavos)}
                    </span>
                  </label>
                );
              })}
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel
                data-testid="gerar-canceladas-voltar"
                disabled={enviando}
                className="min-h-[44px]"
              >
                {ROTULO_VOLTAR_SEM_GERAR}
              </AlertDialogCancel>
              <AlertDialogAction
                data-testid="gerar-canceladas-confirmar"
                disabled={enviando}
                aria-busy={enviando}
                className="h-auto min-h-[44px] whitespace-normal"
                onClick={(evento) => {
                  // Não fecha antes da resposta: sucesso navega; pergunta de novo troca a lista.
                  evento.preventDefault();
                  void chamar(pergunta.mes, pergunta.mesPorExtenso, {
                    canceladasVistas: pergunta.canceladas.map((conta) => conta.id),
                    recriar: pergunta.marcadas,
                  });
                }}
              >
                {enviando ? "Gerando…" : rotuloGerarContas(pergunta.mesPorExtenso)}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );

  return {
    gerar: (mes, mesPorExtenso) => {
      setPergunta(null);
      return chamar(mes, mesPorExtenso, { canceladasVistas: [], recriar: [] });
    },
    enviando,
    dialogo,
  };
}

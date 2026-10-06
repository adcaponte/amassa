"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { gerarContasDoMes } from "@/lib/cadastros/acoes";
import { rotuloGerarContas } from "@/lib/cadastros/textos";
import {
  FRASE_FALHA_AO_GERAR_CONTAS,
  ROTULO_GERANDO_CONTAS,
  ROTULO_VER_EM_CONTAS_FIXAS,
  textoAvisoContasFixasCorpo,
  textoAvisoContasFixasManchete,
} from "@/lib/financeiro/textos";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import { Button } from "@/components/ui/button";

export type AvisoContasFixasProps = {
  // A chave `YYYY-MM` do mês da janela sem contas fixas geradas — a que a ação recebe.
  mes: string;
  // Já formatados pela página ("novembro de 2026" e "novembro") — este componente não formata data.
  mesPorExtenso: string;
  nomeDoMes: string;
};

// O aviso âmbar do Caixa (06.5-12, D-03 / UI-D8): um por mês da janela de 30 dias cujas contas
// fixas ainda não foram geradas, entre os tiles e as listas. Molde `aviso-sem-preco-hora`, com
// manchete (600) e corpo (400). O botão chama a MESMA ação dos Cadastros (`gerarContasDoMes`, que
// confere a faixa permitida e é idempotente) — sem confirmação, como lá: não apaga nada. Deu certo:
// navegação COMPLETA com o aviso na URL, e o servidor deixa de devolver este aviso. Recusa: o toast
// com a frase da própria ação, e o aviso fica.
export function AvisoContasFixas({ mes, mesPorExtenso, nomeDoMes }: AvisoContasFixasProps) {
  const [enviando, setEnviando] = useState(false);

  async function gerar() {
    if (enviando) {
      return;
    }
    setEnviando(true);

    let resposta: Awaited<ReturnType<typeof gerarContasDoMes>>;
    try {
      resposta = await gerarContasDoMes({ mes });
    } catch {
      setEnviando(false);
      toast.error(FRASE_FALHA_AO_GERAR_CONTAS);
      return;
    }

    if (!resposta.ok) {
      setEnviando(false);
      toast.error(resposta.erro);
      return;
    }

    // `mesGerado`, não `mes`: nesta página `?mes=` escolhe o mês do extrato.
    window.location.assign(
      rotaDeGestao(
        `/financeiro?aba=caixa&aviso=contas-geradas&quantidade=${resposta.dados.criadas}&mesGerado=${resposta.dados.mes}`,
      ),
    );
  }

  return (
    <div
      role="status"
      data-testid={`caixa-aviso-fixas-${mes}`}
      className="bg-atencao-fundo text-atencao flex gap-2 rounded-md p-4"
    >
      <AlertTriangle aria-hidden="true" className="mt-1 size-4 shrink-0" />
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-corpo flex flex-col">
          <span className="font-semibold">{textoAvisoContasFixasManchete(mesPorExtenso)}</span>
          <span className="font-normal">{textoAvisoContasFixasCorpo(nomeDoMes)}</span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            data-testid={`caixa-gerar-fixas-${mes}`}
            disabled={enviando}
            aria-busy={enviando}
            className="h-auto min-h-[44px] py-2 font-semibold whitespace-normal"
            onClick={() => void gerar()}
          >
            {enviando ? ROTULO_GERANDO_CONTAS : rotuloGerarContas(mesPorExtenso)}
          </Button>
          <Link
            href={rotaDeGestao("/cadastros?sub=fixas")}
            className="text-corpo inline-flex min-h-[44px] items-center font-semibold underline underline-offset-4"
          >
            {ROTULO_VER_EM_CONTAS_FIXAS}
          </Link>
        </div>
      </div>
    </div>
  );
}

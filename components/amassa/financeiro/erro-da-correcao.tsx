"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import type { MotivoDaCorrecaoNaTela } from "@/lib/financeiro/acoes";
import { hrefDoCaixa } from "@/lib/financeiro/navegacao";
import {
  ROTULO_VOLTAR_AO_CAIXA,
  rotuloLancarComoNova,
  type TipoDeDocumentoParaTexto,
} from "@/lib/financeiro/textos";
import { Button } from "@/components/ui/button";

export type ErroDaCorrecaoProps = {
  tipo: TipoDeDocumentoParaTexto;
  // O motivo que a ação devolveu (`motivoDaCorrecao`, plano 16) — ou `rede`, quando a chamada nem chegou.
  motivo: MotivoDaCorrecaoNaTela;
  // A frase pronta: a da ação, ou `fraseCorrecaoSemRede` quando a chamada falhou no caminho.
  frase: string;
  // Só em `cancelada`: tira o vínculo e deixa o “Lançar” herdado (quem chama faz o resto).
  aoLancarComoNova: () => void;
};

// A recusa do lançamento da correção no painel da Venda/Despesa (Fase 06.5, plano 18 — 06.5-UI-SPEC.md
// §Erros “Lançar a correção”, §Teclado): `role="alert"`, e o foco vai para a frase ao aparecer (quem chama
// usa uma `key` por tentativa, para a mesma recusa duas vezes focar de novo). Nenhuma regra aqui: o motivo
// vem do servidor, e daqui só sai o caminho — “Lançar como venda/despesa nova” só quando a original já foi
// cancelada por outra pessoa (a nova não lança o mesmo dinheiro duas vezes, T-06.5-52), “Voltar ao Caixa”
// quando ela mudou ou já foi corrigida (partir de dados velhos não é seguro). Os campos do painel ficam.
export function ErroDaCorrecao({ tipo, motivo, frase, aoLancarComoNova }: ErroDaCorrecaoProps) {
  const fraseRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    fraseRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col items-start gap-2">
      <p
        ref={fraseRef}
        tabIndex={-1}
        role="alert"
        aria-live="assertive"
        data-testid="correcao-erro"
        data-motivo={motivo}
        className="text-apoio text-destructive [overflow-wrap:anywhere]"
      >
        {frase}
      </p>
      {motivo === "cancelada" ? (
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px] font-semibold"
          data-testid="lancar-como-nova"
          onClick={aoLancarComoNova}
        >
          {rotuloLancarComoNova(tipo)}
        </Button>
      ) : motivo === "mudou" || motivo === "ja_corrigida" ? (
        <Link
          data-testid="correcao-erro-voltar"
          href={hrefDoCaixa()}
          className="text-acento text-apoio inline-flex min-h-[44px] items-center font-semibold underline-offset-4 hover:underline"
        >
          {ROTULO_VOLTAR_AO_CAIXA}
        </Link>
      ) : null}
    </div>
  );
}

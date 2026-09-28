"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { definirParametro, marcarParametroComoMedido } from "@/lib/precificacao/acoes";
import { valorNaUnidade, type ChaveDeParametro } from "@/lib/precificacao/parametros";
import { ROTULO_SELO_ESTIMADO, ROTULO_SELO_MEDIDO, rotuloDesde } from "@/lib/precificacao/textos";
import { cn } from "@/lib/utils";

export type CampoParametroProps = {
  chave: ChaveDeParametro;
  rotulo: string;
  unidade: string;
  valorInteiro: number;
  medido: boolean;
  // Já formatada por quem chama (`formatarDataCurta`, lib/financeiro/formato.ts) — este
  // componente nunca formata data sozinho (mesma disciplina de `lib/precificacao/textos.ts`).
  desdeFormatado: string;
};

// Até 3 casas (a maior precisão entre as três unidades — dinheiro e percentual usam no máximo 2),
// sem zeros à direita forçados: o valor sempre vem de um inteiro já arredondado na escala certa
// (`valorNaUnidade`), então a representação decimal é exata para os valores que este sistema
// grava.
function formatarValor(valorNaUnidadeHumana: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(valorNaUnidadeHumana);
}

// Uma linha da tela de Parâmetros: o campo de valor (grava por HISTÓRICO, D-15 — a chamada é
// sempre `definirParametro`, nunca um `update`) e o selo estimado/medido (a ÚNICA `update` direta
// permitida nesta tabela). As duas ações terminam em NAVEGAÇÃO COMPLETA para
// `/cadastros?sub=parametros` — nunca a atualização client-side do roteador: o valor mostrado
// depois de gravar precisa vir do SERVIDOR, nunca de um estado otimista (outro gestor pode ter
// mudado o mesmo parâmetro entre a digitação e o envio).
//
// Cores do selo (04.5-UI-SPEC.md §"Conflito real: o selo não pode ser terracota") — 18 pílulas de
// acento na mesma tela violariam "um botão terracota por tela"; "medido" usa verde-sucesso (o
// mesmo significado de "confirmado" que já carrega em 04.4), nunca o acento reservado ao CTA.
export function CampoParametro({
  chave,
  rotulo,
  unidade,
  valorInteiro,
  medido,
  desdeFormatado,
}: CampoParametroProps) {
  const [valorTexto, setValorTexto] = useState(() => formatarValor(valorNaUnidade(chave, valorInteiro)));
  const [enviando, setEnviando] = useState(false);
  const [alternandoSelo, setAlternandoSelo] = useState(false);
  const valorGravadoRef = useRef(valorInteiro);

  useEffect(() => {
    valorGravadoRef.current = valorInteiro;
    setValorTexto(formatarValor(valorNaUnidade(chave, valorInteiro)));
  }, [chave, valorInteiro]);

  async function salvarSeMudou() {
    if (enviando) {
      return;
    }
    const textoDigitado = valorTexto.trim();
    if (textoDigitado === "") {
      setValorTexto(formatarValor(valorNaUnidade(chave, valorGravadoRef.current)));
      return;
    }

    setEnviando(true);
    const resposta = await definirParametro({ chave, valorTexto: textoDigitado });
    setEnviando(false);

    if (!resposta.ok) {
      setValorTexto(formatarValor(valorNaUnidade(chave, valorGravadoRef.current)));
      toast.error(resposta.erro);
      return;
    }

    window.location.assign("/gestao/cadastros?sub=parametros");
  }

  async function alternarSelo() {
    if (alternandoSelo) {
      return;
    }
    setAlternandoSelo(true);
    const novoEstado = !medido;
    const resposta = await marcarParametroComoMedido({ chave, medido: novoEstado });
    setAlternandoSelo(false);

    if (!resposta.ok) {
      toast.error(resposta.erro);
      return;
    }

    window.location.assign("/gestao/cadastros?sub=parametros");
  }

  return (
    <div
      data-testid={`parametro-${chave}`}
      className="border-border flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-b-0"
    >
      <span className="text-corpo text-foreground min-w-0 flex-1 basis-48 break-words font-medium">
        {rotulo}
      </span>

      <div className="flex items-center gap-1.5">
        <input
          type="text"
          aria-label={`Valor de ${rotulo}, em ${unidade}`}
          inputMode="decimal"
          disabled={enviando}
          value={valorTexto}
          onChange={(evento) => setValorTexto(evento.target.value)}
          onBlur={() => void salvarSeMudou()}
          className="border-border text-corpo min-h-[44px] w-[92px] rounded-md border px-2 tabular-nums disabled:opacity-60"
        />
        <span className="text-apoio text-muted-foreground">{unidade}</span>
      </div>

      <span data-testid={`parametro-desde-${chave}`} className="text-apoio text-muted-foreground">
        {rotuloDesde(desdeFormatado)}
      </span>

      <button
        type="button"
        aria-pressed={medido}
        data-testid={`parametro-selo-${chave}`}
        disabled={alternandoSelo}
        onClick={() => void alternarSelo()}
        className={cn(
          "text-apoio flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border px-3 font-medium disabled:opacity-60",
          medido
            ? "border-sucesso bg-sucesso-fundo text-sucesso"
            : "border-borda-forte bg-superficie text-tinta-media",
        )}
      >
        {medido ? ROTULO_SELO_MEDIDO : ROTULO_SELO_ESTIMADO}
      </button>
    </div>
  );
}

"use client";

import { useState, type CSSProperties } from "react";
import { Loader2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";

import type { Etapa } from "@/lib/encomendas/cronograma";
import { ajustarEtapaEncomenda } from "@/lib/encomendas/acoes";
import { FRASE_FALHA_AO_SALVAR, ROTULO_ETAPA } from "@/lib/encomendas/textos";
import { Switch } from "@/components/ui/switch";

export type RespostaDeAjuste = { duracaoTotalEmDias: number; dataDeConclusao: string | null };

export type AjusteRapidoEtapaProps = {
  encomendaId: string;
  etapa: Etapa;
  marco: boolean;
  diasInicial: number;
  // Só é chamado no passo 4 (resposta confirmada do servidor) — nunca no passo 1 (mudança
  // visual local). É o que faz o rodapé de duração total/data de conclusão (trilha-etapas.tsx)
  // nunca recalcular antes da hora.
  aoConfirmar: (resposta: RespostaDeAjuste) => void;
};

// Área de toque 44×44px com desenho visual de 32×32px — padding invisível expandindo a zona
// clicável, mesmo padrão do botão de avatar da 2b (cabecalho-movel.tsx).
const ESTILO_BOTAO: CSSProperties = { width: 44, height: 44 };
const ESTILO_VISUAL: CSSProperties = { width: 32, height: 32 };

// Segundo caminho de escrita de D-15 (o primeiro é o formulário completo, plano 01/06). NUNCA
// otimista (03-UI-SPEC.md "Comportamento de salvamento — não é otimista"): o número/estado muda
// na hora (passo 1, resposta visual de UI local), um spinner de 16px o substitui por até ~1s
// (passo 2 — é este `disabled` que impede um segundo toque de ser emitido, PD-02), se falhar o
// valor volta ao anterior com um aviso (passo 3), e só na resposta confirmada do servidor (passo
// 4) o valor é adotado de verdade — inclusive quando diferente do que o passo 1 previu, que é
// exatamente o caso de duas gravações somadas. `ajustarEtapaEncomenda` recebe sempre
// `delta`/`ligado` (PD-02): o servidor soma a partir da linha que ele mesmo travou (select ...
// for update), nunca de um valor absoluto vindo daqui.
export function AjusteRapidoEtapa({
  encomendaId,
  etapa,
  marco,
  diasInicial,
  aoConfirmar,
}: AjusteRapidoEtapaProps) {
  const [dias, setDias] = useState(diasInicial);
  const [pendente, setPendente] = useState(false);

  async function aplicar(entrada: { delta: 1 | -1 } | { ligado: boolean }) {
    const valorAnterior = dias;
    const valorLocal =
      "delta" in entrada ? Math.max(0, valorAnterior + entrada.delta) : entrada.ligado ? 1 : 0;

    setDias(valorLocal); // passo 1
    setPendente(true); // passo 2

    const resposta = await ajustarEtapaEncomenda({ encomendaId, etapa, ...entrada });

    setPendente(false);

    if (!resposta.ok) {
      setDias(valorAnterior); // passo 3
      toast.error(FRASE_FALHA_AO_SALVAR);
      return;
    }

    setDias(resposta.dados.dias); // passo 4
    aoConfirmar({
      duracaoTotalEmDias: resposta.dados.duracaoTotalEmDias,
      dataDeConclusao: resposta.dados.dataDeConclusao,
    });
  }

  const nomeEtapa = ROTULO_ETAPA[etapa];

  if (marco) {
    const ligado = dias === 1;
    return (
      <Switch
        checked={ligado}
        disabled={pendente}
        onCheckedChange={(novoValor) => {
          void aplicar({ ligado: novoValor });
        }}
        aria-label={ligado ? `Desativar ${nomeEtapa}` : `Ativar ${nomeEtapa}`}
        data-testid={`ajuste-switch-${etapa}`}
        // 44×44 de área de toque (o próprio elemento com role="switch" é o que
        // boundingBox() mede) com o desenho visual mantido pequeno via
        // `background-clip: content-box` — a cor da trilha só pinta a região de
        // conteúdo (o track de sempre), o padding ao redor fica transparente e
        // clicável. `style` (não classe) porque as classes de tamanho do componente
        // (`data-[size=default]:h-[18.4px]`/`w-[32px]`) usam um seletor de atributo
        // mais específico que uma classe solta — só o atributo `style` vence sempre.
        className="rounded-full [background-clip:content-box]"
        style={{ width: 44, height: 44, paddingInline: 6, paddingBlock: 12.8 }}
      />
    );
  }

  return (
    <span className="inline-flex items-center gap-2" data-testid={`ajuste-rapido-${etapa}`}>
      <button
        type="button"
        aria-label={`Diminuir dias de ${nomeEtapa}`}
        disabled={pendente || dias === 0}
        onClick={() => {
          void aplicar({ delta: -1 });
        }}
        className="focus-visible:ring-ring flex items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        style={ESTILO_BOTAO}
      >
        <span
          className="border-border bg-background flex items-center justify-center rounded-md border"
          style={ESTILO_VISUAL}
        >
          <Minus className="size-4" aria-hidden="true" />
        </span>
      </button>

      <span
        className="text-mono tabular-nums flex w-6 items-center justify-center text-tinta"
        aria-hidden="true"
        data-testid={`ajuste-numero-${etapa}`}
        data-pendente={pendente ? "true" : "false"}
        data-valor={dias}
      >
        {pendente ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : dias}
      </span>

      <button
        type="button"
        aria-label={`Aumentar dias de ${nomeEtapa}`}
        disabled={pendente}
        onClick={() => {
          void aplicar({ delta: 1 });
        }}
        className="focus-visible:ring-ring flex items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        style={ESTILO_BOTAO}
      >
        <span
          className="border-border bg-background flex items-center justify-center rounded-md border"
          style={ESTILO_VISUAL}
        >
          <Plus className="size-4" aria-hidden="true" />
        </span>
      </button>
    </span>
  );
}

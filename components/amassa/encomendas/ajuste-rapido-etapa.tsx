"use client";

import { useState, type CSSProperties } from "react";
import { Loader2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";

import type { Etapa } from "@/lib/encomendas/cronograma";
import { ajustarEtapaEncomenda } from "@/lib/encomendas/acoes";
import { FRASE_FALHA_AO_SALVAR, ROTULO_ETAPA, SUFIXO_ESPERA } from "@/lib/encomendas/textos";

export type RespostaDeAjuste = { duracaoTotalEmDias: number; dataDeConclusao: string | null };

export type AjusteRapidoEtapaProps = {
  encomendaId: string;
  etapa: Etapa;
  marco: boolean;
  diasInicial: number;
  // A partir da fase 04.1 (D-06): só usado quando `marco` é `true` — o valor inicial da espera
  // ANTES do marco, nunca a duração dele. Ignorado para etapa de intervalo.
  esperaInicial: number;
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
// `delta`/`deltaEspera` (PD-02, D-06): o servidor soma a partir da linha que ele mesmo travou
// (select ... for update), nunca de um valor absoluto vindo daqui.
export function AjusteRapidoEtapa({
  encomendaId,
  etapa,
  marco,
  diasInicial,
  esperaInicial,
  aoConfirmar,
}: AjusteRapidoEtapaProps) {
  const [dias, setDias] = useState(diasInicial);
  const [espera, setEspera] = useState(esperaInicial);
  const [pendente, setPendente] = useState(false);

  async function aplicar(entrada: { delta: 1 | -1 } | { deltaEspera: 1 | -1 }) {
    const valorAnteriorDeDias = dias;
    const valorAnteriorDeEspera = espera;
    const valorLocalDeDias = "delta" in entrada ? Math.max(0, dias + entrada.delta) : dias;
    const valorLocalDeEspera =
      "deltaEspera" in entrada ? Math.max(0, espera + entrada.deltaEspera) : espera;

    if ("delta" in entrada) {
      setDias(valorLocalDeDias); // passo 1
    } else {
      setEspera(valorLocalDeEspera); // passo 1
    }
    setPendente(true); // passo 2

    // `finally` é o ponto: sucesso, `{ ok: false }` ou rejeição de promessa (erro inesperado de
    // rede/servidor) saem TODOS do estado pendente por aqui — nunca só no caminho feliz. Sem
    // isso, um erro que escapa do `await` deixa o spinner girando até a página recarregar
    // (CR-02/gap 17 da verificação).
    try {
      const resposta = await ajustarEtapaEncomenda({ encomendaId, etapa, ...entrada });

      if (!resposta.ok) {
        setDias(valorAnteriorDeDias); // passo 3
        setEspera(valorAnteriorDeEspera); // passo 3
        // A mensagem em português que o servidor escreveu à mão (ex.: o teto de 365 dias de
        // espera) é o que o gestor precisa ler — nunca a frase genérica no lugar dela. A frase
        // genérica só entra se o servidor não mandou nenhuma (reserva, não é o caminho comum).
        toast.error(resposta.erro || FRASE_FALHA_AO_SALVAR);
        return;
      }

      setDias(resposta.dados.dias); // passo 4
      setEspera(resposta.dados.esperaDias); // passo 4
      aoConfirmar({
        duracaoTotalEmDias: resposta.dados.duracaoTotalEmDias,
        dataDeConclusao: resposta.dados.dataDeConclusao,
      });
    } catch {
      // Erro inesperado (rede caída, exceção não tratada no servidor) — sem mensagem própria em
      // português para mostrar, então a frase de reserva assume.
      setDias(valorAnteriorDeDias); // passo 3
      setEspera(valorAnteriorDeEspera); // passo 3
      toast.error(FRASE_FALHA_AO_SALVAR);
    } finally {
      setPendente(false);
    }
  }

  const nomeEtapa = ROTULO_ETAPA[etapa];

  if (marco) {
    return (
      <span className="inline-flex items-center gap-2" data-testid={`ajuste-espera-${etapa}`}>
        <button
          type="button"
          aria-label={`Diminuir a espera antes de ${nomeEtapa}`}
          disabled={pendente || espera === 0}
          onClick={() => {
            void aplicar({ deltaEspera: -1 });
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
          data-testid={`ajuste-numero-espera-${etapa}`}
          data-pendente={pendente ? "true" : "false"}
          data-valor={espera}
        >
          {pendente ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : espera}
        </span>

        <button
          type="button"
          aria-label={`Aumentar a espera antes de ${nomeEtapa}`}
          disabled={pendente || espera === 365}
          onClick={() => {
            void aplicar({ deltaEspera: 1 });
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

        <span className="text-apoio text-muted-foreground">{SUFIXO_ESPERA}</span>
      </span>
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

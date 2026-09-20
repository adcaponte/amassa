"use client";

import { useState } from "react";
import { toast } from "sonner";

import { gerarContasDoMes } from "@/lib/cadastros/acoes";
import { ROTULO_MES_DA_GERACAO, rotuloGerarContas } from "@/lib/cadastros/textos";

export type OpcaoDeMesParaGeracao = {
  // "YYYY-MM" — a chave que a ação de fato recebe.
  chave: string;
  // Já formatado por extenso (`nomeDoMes`, lib/financeiro/formato.ts) — este componente nunca
  // formata data.
  rotulo: string;
};

export type BotaoGerarContasProps = {
  // As doze opções da faixa (o mês corrente e os onze seguintes — `mesesParaGeracao`,
  // lib/cadastros/contas-fixas.ts), já formatadas por quem chama.
  meses: OpcaoDeMesParaGeracao[];
  // O mês PRÉ-SELECIONADO quando a tela abre — sempre o mês seguinte ao de hoje (`mesDaGeracao`),
  // mantendo o uso mais comum em um toque só (resposta do dono, 2026-09-20).
  mesInicial: string;
  // Desabilitado sem nenhuma conta fixa ATIVA (must_have do plano) — decidido pela página, que já
  // tem a lista carregada, nunca uma segunda consulta disparada por este componente.
  existeContaAtiva: boolean;
};

// O seletor de mês + o único botão terracota da sub-aba Contas fixas (04.4-UI-SPEC.md — "+ Nova
// conta fixa" é contorno para não ter duas ações terracota na mesma tela). Desde o
// 04.4-12-PLAN.md o mês deixou de ser fixo: o seletor nativo (`gerar-contas-mes`, mesmo molde de
// `pagamento-plano`) oferece a faixa inteira, pré-selecionando o mês seguinte — o uso de sempre
// continua um toque só. Os dois empilham no celular em vez de rolar de lado. O seletor fica
// desabilitado junto com o botão (sem conta ativa, ou enviando); duplo toque no botão não dispara
// duas vezes NESTA tela, e mesmo que disparasse, o `on conflict do nothing` do servidor
// (`gerarContasDoMes`) segura a idempotência de qualquer jeito.
export function BotaoGerarContas({ meses, mesInicial, existeContaAtiva }: BotaoGerarContasProps) {
  const [mes, setMes] = useState(mesInicial);
  const [enviando, setEnviando] = useState(false);

  const mesEscolhido = meses.find((opcao) => opcao.chave === mes) ?? meses[0];

  async function gerar() {
    if (enviando) {
      return;
    }
    setEnviando(true);

    const resposta = await gerarContasDoMes({ mes });

    setEnviando(false);

    if (!resposta.ok) {
      toast.error(resposta.erro);
      return;
    }

    // Navegação COMPLETA com o aviso na URL — o servidor monta o texto certo ("N criada(s)" ou
    // "já existiam"), nunca um toast local antes de a lista real ter carregado.
    window.location.assign(
      `/cadastros?sub=fixas&aviso=contas-geradas&quantidade=${resposta.dados.criadas}&mes=${resposta.dados.mes}`,
    );
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <label className="text-apoio text-muted-foreground flex flex-col gap-1">
        {ROTULO_MES_DA_GERACAO}
        <select
          data-testid="gerar-contas-mes"
          value={mes}
          disabled={!existeContaAtiva || enviando}
          onChange={(evento) => setMes(evento.target.value)}
          className="border-border text-corpo min-h-[44px] rounded-md border bg-transparent px-3 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {meses.map((opcao) => (
            <option key={opcao.chave} value={opcao.chave}>
              {opcao.rotulo}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        data-testid="gerar-contas"
        disabled={!existeContaAtiva || enviando}
        aria-busy={enviando}
        onClick={() => void gerar()}
        className="bg-primary text-primary-foreground hover:bg-primary/80 text-corpo flex min-h-[44px] items-center rounded-md px-4 font-medium disabled:cursor-not-allowed disabled:opacity-50"
      >
        {enviando ? "Gerando…" : rotuloGerarContas(mesEscolhido?.rotulo ?? "")}
      </button>
    </div>
  );
}

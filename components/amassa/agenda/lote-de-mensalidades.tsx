"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

import { lancarMensalidadesEmLote } from "@/lib/agenda/acoes";
import type { LoteDeMensalidades as DadosDoLote } from "@/lib/agenda/receber";
import { nomeDoMes } from "@/lib/agenda/semana";
import {
  ARIA_LISTA_DO_LOTE,
  DICA_DO_LOTE,
  FRASE_FALHA_AO_LANCAR_LOTE,
  ROTULO_LANCANDO_LOTE,
  fraseCorridaDoLote,
  linhaDoLote,
  resumoDoLote,
  rotuloDoBotaoDoLote,
  toastDoLote,
} from "@/lib/agenda/textos";
import { formatarReais } from "@/lib/financeiro/formato";
import { Button } from "@/components/ui/button";

export type LoteDeMensalidadesProps = {
  lote: DadosDoLote;
};

// A sanfona do lote no topo de “A receber” (05-UI-SPEC.md §“Aba A receber”, item 2; AGE-16; UI-D3): só
// existe com mensalidade livre — sem ela, a aba fica sem primário. `<details open>` com a borda tracejada
// `borda-forte`, o `summary` de 44px, a lista “{nome} · {turma} · {mês} · {R$}” (+ “ (proporcional)”) que
// quebra sem estourar a borda e SEM rolagem interna (com 40 linhas a página rola, e o botão continua no fim
// da lista), o botão primário — o ÚNICO terracota da aba — com o total exato, e a dica. Um toque cria uma
// venda por mensalidade, com a parcela em aberto; “Lançando…” com `disabled` e um `useRef` contra o toque
// duplo. A ação revalida a Agenda: a sanfona some sozinha quando nada mais fica livre.
export function LoteDeMensalidades({ lote }: LoteDeMensalidadesProps) {
  const emVoo = useRef(false);
  const [lancando, setLancando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (lote.quantas === 0) {
    return null;
  }

  async function lancar() {
    if (emVoo.current) {
      return;
    }
    emVoo.current = true;
    setLancando(true);
    setErro(null);
    try {
      const resposta = await lancarMensalidadesEmLote({ ids: lote.linhas.map((linha) => linha.id) });
      if (!resposta.ok) {
        setErro(resposta.erro);
        return;
      }
      const { lancadas, jaLancadas } = resposta.dados;
      if (jaLancadas > 0) {
        // A corrida (outro celular, o “Recebi agora” ou o “Lançar na Venda” no meio): nada duplicou.
        toast.info(fraseCorridaDoLote(lancadas, jaLancadas));
      } else {
        toast.success(toastDoLote(lancadas));
      }
    } catch {
      // A transação é uma só: se a resposta não chegou, nenhuma venda foi criada pela metade.
      setErro(FRASE_FALHA_AO_LANCAR_LOTE);
    } finally {
      emVoo.current = false;
      setLancando(false);
    }
  }

  return (
    <details
      open
      data-testid="lote-mensalidades"
      className="border-borda-forte rounded-md border border-dashed px-4 py-2"
    >
      <summary
        data-testid="lote-resumo"
        className="text-apoio text-tinta flex min-h-[44px] cursor-pointer items-center font-semibold [overflow-wrap:anywhere]"
      >
        {resumoDoLote(lote.quantas)}
      </summary>
      <div className="flex flex-col gap-3 pt-2 pb-2">
        <ul aria-label={ARIA_LISTA_DO_LOTE} className="text-apoio text-tinta-media flex flex-col gap-1">
          {lote.linhas.map((linha) => (
            <li
              key={linha.id}
              data-testid="lote-linha"
              data-id={linha.id}
              className="min-w-0 [overflow-wrap:anywhere]"
            >
              {linhaDoLote(
                linha.nome,
                linha.turma,
                nomeDoMes(linha.mes),
                formatarReais(linha.valorCentavos),
                linha.proporcional,
              )}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            data-testid="lote-lancar"
            disabled={lancando}
            aria-busy={lancando}
            onClick={() => void lancar()}
            className="text-corpo h-auto min-h-[44px] px-4 font-semibold whitespace-normal max-[359px]:w-full"
          >
            {lancando ? ROTULO_LANCANDO_LOTE : rotuloDoBotaoDoLote(lote.quantas, formatarReais(lote.totalCentavos))}
          </Button>
        </div>
        {erro !== null ? (
          <p role="alert" data-testid="lote-erro" className="text-apoio text-destructive">
            {erro}
          </p>
        ) : null}
        <p className="text-apoio text-tinta-fraca">{DICA_DO_LOTE}</p>
      </div>
    </details>
  );
}

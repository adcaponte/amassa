"use client";

import { FORMAS_DE_RECEBER, type FormaDeReceber } from "@/lib/agenda/esquemas";
import {
  ARIA_FORMAS_DE_RECEBER,
  ROTULO_FORMA_DE_RECEBER,
  ROTULO_REGISTRANDO,
  taxaDaMaquininha,
} from "@/lib/agenda/textos";
import { formatarPercentual } from "@/lib/financeiro/formato";
import { Button } from "@/components/ui/button";

export type FormasDeReceberProps = {
  // A forma tocada que está gravando agora (o botão dela vira "Registrando…"); `null` = nada em voo.
  registrando: FormaDeReceber | null;
  // Trava a mais do módulo (as Queimas com zero peças). Com algo em voo, os três já ficam travados.
  desabilitado?: boolean;
  aoReceber: (forma: FormaDeReceber) => void;
  // A taxa do cartão de agora (Cadastros → Taxas), em pontos-base — a linha embaixo do "Cartão".
  taxaCartaoPontosBase: number;
  // O `aria-describedby` dos três botões quando o módulo diz por que estão travados.
  idDescritoPor?: string;
};

// A parte VISUAL do "Recebi agora", comum à Agenda e às Queimas (D-24, P9 · POL-11): o grupo das
// três formas (`outline`, 52 px, largura total), o "Registrando…" no botão tocado e a linha da
// taxa da maquininha sob o "Cartão". Nenhuma ação de servidor nem regra de dinheiro aqui — cada
// folha passa o `aoReceber` dela, com a sua trava (`useRef`) e a sua ação. Os textos são os de
// `lib/agenda/textos`, que as duas folhas já usavam.
export function FormasDeReceber({
  registrando,
  desabilitado = false,
  aoReceber,
  taxaCartaoPontosBase,
  idDescritoPor,
}: FormasDeReceberProps) {
  return (
    <div role="group" aria-label={ARIA_FORMAS_DE_RECEBER} className="flex flex-col gap-3">
      {FORMAS_DE_RECEBER.map((forma) => (
        <div key={forma} className="flex flex-col gap-1">
          <Button
            type="button"
            variant="outline"
            data-testid={`forma-${forma}`}
            disabled={registrando !== null || desabilitado}
            aria-describedby={idDescritoPor}
            onClick={() => aoReceber(forma)}
            className="text-corpo h-auto min-h-[52px] w-full px-4 font-semibold"
          >
            {registrando === forma ? ROTULO_REGISTRANDO : ROTULO_FORMA_DE_RECEBER[forma]}
          </Button>
          {forma === "cartao" ? (
            <p data-testid="recebi-agora-taxa" className="text-apoio text-tinta-fraca text-center">
              {taxaDaMaquininha(formatarPercentual(taxaCartaoPontosBase))}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

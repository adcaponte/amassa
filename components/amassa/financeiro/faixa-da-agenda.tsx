import Link from "next/link";

import {
  FRASE_ORIGEM_NAO_ACHADA,
  FRASE_VENDA_EM_MONTAGEM_GUARDADA,
  ROTULO_VER_NO_CAIXA,
  ROTULO_VOLTAR_A_AGENDA_DA_VENDA,
  faixaDaAgenda,
  fraseOrigemJaLancada,
} from "@/lib/agenda/textos";
import { hrefDoCaixa } from "@/lib/financeiro/navegacao";
import { rotaDeGestao } from "@/lib/rotas/gestao";

export type FaixaDaAgendaProps = {
  descricao: string;
  nome: string;
  // Havia uma venda em montagem no rascunho comum (Pitfall 10): ela continua guardada e a faixa diz.
  haviaVendaEmMontagem: boolean;
};

// A faixa “Da Agenda” no topo da Venda aberta pela Agenda (05-UI-SPEC.md §“Venda aberta pela Agenda”,
// UI-D26; contraste A10: `tinta` sobre `acento-fundo`, 13,89:1; o link é A9, `acento`, 6,41:1). O texto
// quebra livre — a 320px, com uma turma de nome longo, ele desce em quantas linhas precisar — e o
// “Voltar à Agenda” continua com 44px. Voltar não lança nada: a cobrança fica em “A receber”.
export function FaixaDaAgenda({ descricao, nome, haviaVendaEmMontagem }: FaixaDaAgendaProps) {
  return (
    <div
      data-testid="faixa-da-agenda"
      className="bg-acento-fundo text-tinta text-apoio flex flex-col gap-1 rounded-md px-4 py-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p data-testid="faixa-da-agenda-texto" className="min-w-0 [overflow-wrap:anywhere]">
          {faixaDaAgenda(descricao, nome)}
        </p>
        <Link
          data-testid="voltar-a-agenda"
          href={rotaDeGestao("/agenda?aba=receber")}
          className="text-acento inline-flex min-h-[44px] items-center font-semibold underline-offset-4 hover:underline"
        >
          {ROTULO_VOLTAR_A_AGENDA_DA_VENDA}
        </Link>
      </div>
      {haviaVendaEmMontagem ? (
        <p data-testid="faixa-em-montagem" className="[overflow-wrap:anywhere]">
          {FRASE_VENDA_EM_MONTAGEM_GUARDADA}
        </p>
      ) : null}
    </div>
  );
}

export type OrigemIndisponivelProps = {
  // A venda que a cobrança já virou; `null` = a cobrança não foi achada (ou saiu de “A receber”).
  numeroDaVenda: number | null;
};

// No lugar do carrinho, quando a origem já virou venda ou não foi achada (05-UI-SPEC.md §Erros “Venda da
// Agenda — origem inválida”): NUNCA um carrinho preenchido com dado velho. A frase diz o que aconteceu e
// o link leva aonde resolver — o Caixa (a venda existe) ou de volta à Agenda.
export function OrigemIndisponivel({ numeroDaVenda }: OrigemIndisponivelProps) {
  return (
    <div className="px-6 py-6 md:px-8">
      <div
        role="status"
        data-testid="origem-indisponivel"
        className="border-border bg-card flex flex-col items-start gap-2 rounded-lg border p-4"
      >
        <p className="text-corpo text-foreground [overflow-wrap:anywhere]">
          {numeroDaVenda !== null ? fraseOrigemJaLancada(numeroDaVenda) : FRASE_ORIGEM_NAO_ACHADA}
        </p>
        {numeroDaVenda !== null ? (
          <Link
            data-testid="origem-ver-no-caixa"
            href={hrefDoCaixa()}
            className="text-acento text-corpo inline-flex min-h-[44px] items-center font-semibold underline-offset-4 hover:underline"
          >
            {ROTULO_VER_NO_CAIXA}
          </Link>
        ) : (
          <Link
            data-testid="voltar-a-agenda"
            href={rotaDeGestao("/agenda?aba=receber")}
            className="text-acento text-corpo inline-flex min-h-[44px] items-center font-semibold underline-offset-4 hover:underline"
          >
            {ROTULO_VOLTAR_A_AGENDA_DA_VENDA}
          </Link>
        )}
      </div>
    </div>
  );
}

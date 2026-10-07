import Link from "next/link";

import { listaEmPortugues } from "@/lib/financeiro/documento";
import { hrefDoCaixa } from "@/lib/financeiro/navegacao";
import {
  FRASE_FAIXA_DA_CORRECAO_SAIR,
  ROTULO_VOLTAR_AO_CAIXA,
  fraseItensDeForaDaCorrecao,
  linha2DaFaixaDaCorrecao,
  linha2DaFaixaDesligada,
  tituloDaFaixaDaCorrecao,
  type TipoDeDocumentoParaTexto,
} from "@/lib/financeiro/textos";

const CLASSE_DO_LINK =
  "text-acento inline-flex min-h-[44px] items-center font-semibold underline-offset-4 hover:underline";

export type FaixaDaCorrecaoProps = {
  tipo: TipoDeDocumentoParaTexto;
  originalId: string;
  numeroOriginal: number;
  // A original mexeu no estoque: a 2ª linha diz que o material volta (venda) / sai (despesa).
  comEstoque: boolean;
  // Os nomes dos itens que não estão mais ativos no Catálogo e ficaram de fora.
  deFora: readonly string[];
  // Depois de “Lançar como venda/despesa nova” (plano 18): o vínculo saiu, e a 2ª linha diz isso.
  desligada?: boolean;
};

// A faixa no topo da Venda/Despesa aberta por “Corrigir” (06.5-UI-SPEC.md §“Corrigir” um lançamento,
// passo 3; UI-D9 do dono, 05/10/2026), no molde de `FaixaDaOrigem`: `bg-acento-fundo text-tinta` (A10,
// 13,89:1), `role="status"`, ANTES do carrinho na ordem de leitura. Ela é quem explica — a original
// continua valendo até o lançamento, e sair sem lançar não muda nada; quem confirma é o “Lançar e
// cancelar a nº {N}” do painel. “Voltar ao Caixa” não grava nada.
export function FaixaDaCorrecao({
  tipo,
  originalId,
  numeroOriginal,
  comEstoque,
  deFora,
  desligada = false,
}: FaixaDaCorrecaoProps) {
  return (
    <div
      role="status"
      data-testid="faixa-correcao"
      data-original-id={originalId}
      className="bg-acento-fundo text-tinta text-apoio flex flex-col gap-1 rounded-md px-4 py-2"
    >
      <p data-testid="faixa-correcao-titulo" className="font-semibold [overflow-wrap:anywhere]">
        {tituloDaFaixaDaCorrecao(tipo, numeroOriginal)}
      </p>
      <p
        data-testid="faixa-correcao-linha2"
        data-desligada={desligada ? "true" : undefined}
        className="[overflow-wrap:anywhere]"
      >
        {desligada
          ? linha2DaFaixaDesligada(numeroOriginal)
          : linha2DaFaixaDaCorrecao(tipo, numeroOriginal, comEstoque)}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="min-w-0 [overflow-wrap:anywhere]">{FRASE_FAIXA_DA_CORRECAO_SAIR}</p>
        <Link data-testid="faixa-correcao-voltar" href={hrefDoCaixa()} className={CLASSE_DO_LINK}>
          {ROTULO_VOLTAR_AO_CAIXA}
        </Link>
      </div>
      {deFora.length > 0 ? (
        <p data-testid="faixa-correcao-de-fora" className="[overflow-wrap:anywhere]">
          {fraseItensDeForaDaCorrecao(deFora.length, listaEmPortugues(deFora))}
        </p>
      ) : null}
    </div>
  );
}

export type CorrecaoIndisponivelProps = {
  // A frase pronta: original cancelada, não achada, ou de uma origem que não se corrige por aqui.
  frase: string;
};

// No lugar da Venda/Despesa preenchida, quando o `?corrige=` não abre correção (06.5-UI-SPEC.md §Erros
// “Abrir a correção”) — molde `OrigemIndisponivel`: NUNCA um carrinho com dado que não se pode corrigir.
export function CorrecaoIndisponivel({ frase }: CorrecaoIndisponivelProps) {
  return (
    <div className="px-6 py-6 md:px-8">
      <div
        role="status"
        data-testid="correcao-indisponivel"
        className="border-border bg-card flex flex-col items-start gap-2 rounded-lg border p-4"
      >
        <p className="text-corpo text-foreground [overflow-wrap:anywhere]">{frase}</p>
        <Link data-testid="correcao-voltar-ao-caixa" href={hrefDoCaixa()} className={`${CLASSE_DO_LINK} text-corpo`}>
          {ROTULO_VOLTAR_AO_CAIXA}
        </Link>
      </div>
    </div>
  );
}

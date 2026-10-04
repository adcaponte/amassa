"use client";

import { useState } from "react";

import type { ItensDasQueimas, QueimaACobrar } from "@/lib/queimas/consultas";
import { diaMes } from "@/lib/queimas/contagem";
import { DICA_FIM_A_COBRAR, TITULO_A_COBRAR, tituloDaQueima } from "@/lib/queimas/textos";

import { FolhaRecebiQueima } from "./folha-recebi-queima";
import { LinhaACobrar } from "./linha-a-cobrar";

export type ListaACobrarProps = {
  linhas: QueimaACobrar[];
  maisDeUmForno: boolean;
  itens: ItensDasQueimas;
  // A taxa do cartão de agora (Cadastros → Taxas), em pontos-base — a linha sob "Cartão" na folha.
  taxaCartaoPontosBase: number;
};

// A seção "Queimas externas a cobrar" do índice (06.4-UI-SPEC.md §"Índice"; QMC-07, UI-D26): toda
// queima com externas que ainda tem falta em algum tamanho, de todos os fornos, a mais ANTIGA primeiro
// (é dinheiro esperando), sem teto. Vazia, não aparece — quem decide é `ListasDoIndice`. Bloco no molde
// `AReceber` da Agenda; uma folha "Recebi agora" só, reaproveitada entre as linhas.
export function ListaACobrar({
  linhas,
  maisDeUmForno,
  itens,
  taxaCartaoPontosBase,
}: ListaACobrarProps) {
  const [cobrando, setCobrando] = useState<QueimaACobrar | null>(null);

  function titulo(linha: QueimaACobrar): string {
    return tituloDaQueima(linha.tipo, diaMes(linha.diaCivil), maisDeUmForno ? linha.fornoNome : null);
  }

  return (
    <section
      data-testid="queimas-a-cobrar"
      aria-labelledby="titulo-a-cobrar"
      className="bg-superficie border-border flex flex-col gap-4 rounded-lg border p-4"
    >
      <h2 id="titulo-a-cobrar" className="text-titulo text-tinta">
        {TITULO_A_COBRAR}
      </h2>
      <ul aria-label={TITULO_A_COBRAR} className="divide-border flex flex-col divide-y">
        {linhas.map((linha) => (
          <LinhaACobrar
            key={linha.queimaId}
            linha={linha}
            titulo={titulo(linha)}
            itens={itens}
            aoReceberAgora={setCobrando}
          />
        ))}
      </ul>
      {/* A dica do fim (D-07): “Lançar na Venda” abre o Financeiro com o que falta, e é lá que se divide
          entre pessoas — uma venda por pessoa. */}
      <p data-testid="a-cobrar-dica" className="text-apoio text-tinta-fraca">
        {DICA_FIM_A_COBRAR}
      </p>
      {cobrando !== null ? (
        <FolhaRecebiQueima
          key={cobrando.queimaId}
          queima={cobrando}
          titulo={titulo(cobrando)}
          itens={itens}
          taxaCartaoPontosBase={taxaCartaoPontosBase}
          aoFechar={() => setCobrando(null)}
        />
      ) : null}
    </section>
  );
}

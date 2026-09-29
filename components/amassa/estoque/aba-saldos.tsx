"use client";

import { useState } from "react";

import type { SaldoDoItem } from "@/lib/estoque/consultas";

import { CartaoSaldo } from "./cartao-saldo";
import { FolhaMovimentacao } from "./folha-movimentacao";

export type AbaSaldosProps = {
  saldos: readonly SaldoDoItem[];
};

// A aba Saldos no caminho do traçador (plano 06-01): a lista de cartões e a folha de movimentação,
// aberta pelo "Dar baixa" de um cartão. A busca, o filtro por área, "Acabando", o banner, a tabela do
// desktop e o filtro Ativos · Desativados · Todos entram nos planos seguintes da fase.
//
// A folha é montada com `key` do item: cada abertura nasce limpa (em Saída, sem nada digitado).
export function AbaSaldos({ saldos }: AbaSaldosProps) {
  const [aberto, setAberto] = useState<SaldoDoItem | null>(null);

  return (
    <>
      <ul className="flex flex-col gap-2" aria-label="Saldos do estoque">
        {saldos.map((saldo) => (
          <li key={saldo.id}>
            <CartaoSaldo saldo={saldo} aoDarBaixa={setAberto} />
          </li>
        ))}
      </ul>

      {aberto ? (
        <FolhaMovimentacao key={aberto.id} saldo={aberto} aoFechar={() => setAberto(null)} />
      ) : null}
    </>
  );
}

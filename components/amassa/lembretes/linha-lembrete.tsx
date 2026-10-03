"use client";

import type { LembreteDaTela, PessoaDaCasa } from "@/lib/lembretes/consultas";
import {
  corDaPessoa,
  primeiroNome,
  rotuloDoPrazo,
  situacaoDoPrazo,
} from "@/lib/lembretes/lista";
import { cn } from "@/lib/utils";

export type LinhaLembreteProps = {
  lembrete: LembreteDaTela;
  // O dia civil de Brasília, calculado na PÁGINA (`hojeEmBrasilia`) e descido por prop — esta linha
  // nunca lê o relógio do navegador para decidir vencido/hoje/amanhã.
  hoje: string;
  // As pessoas ATIVAS na ordem de cadastro: a POSIÇÃO de `quem` nesta lista decide a cor do chip
  // (UI-D2) — nunca o nome.
  pessoas: readonly PessoaDaCasa[];
};

// Uma linha de lembrete (06.3-UI-SPEC.md §"A linha do lembrete"). Grade de três colunas no
// contêiner ≥ 340 px (caixa · texto e meta · ações), duas abaixo disso. Plano 03: o texto e a meta
// (rótulo de prazo · chip da pessoa). A caixa de feito, as ações "editar"/"excluir" e a autoria são
// dos planos 04/05 — a 1ª coluna já reserva os 44 px da caixa, como espaço vazio (nenhum controle
// falso no lugar).
//
// O texto e o nome saem SEMPRE como nós de texto do React (T-06.3-14) — nunca HTML cru.
export function LinhaLembrete({ lembrete, hoje, pessoas }: LinhaLembreteProps) {
  const situacao = situacaoDoPrazo(lembrete.paraQuando, hoje);
  const rotulo = rotuloDoPrazo(lembrete.paraQuando, hoje);
  // "geral" (`quem` nulo) não tem chip. Pessoa desativada (fora de `pessoas`, índice −1) mostra o
  // nome dela, com o chip neutro.
  const nomeNoChip =
    lembrete.quem === null
      ? null
      : (primeiroNome(lembrete.quemNome) ?? lembrete.quemNome);
  const indiceDaPessoa =
    lembrete.quem === null
      ? -1
      : pessoas.findIndex((pessoa) => pessoa.id === lembrete.quem);

  return (
    <li
      data-testid="lembrete-linha"
      data-id={lembrete.id}
      data-situacao={situacao}
      className={cn(
        "grid grid-cols-[44px_1fr] items-start gap-2 rounded-md border border-transparent py-1 pr-2 hover:bg-fundo @min-[340px]:grid-cols-[44px_1fr_auto]",
        situacao === "vencido" && "border-erro-fundo bg-erro-fundo/50",
      )}
    >
      <span aria-hidden="true" className="min-h-[44px]" />
      <div className="min-w-0 pt-2">
        <p className="text-corpo text-tinta font-normal [overflow-wrap:anywhere]">
          {lembrete.texto}
        </p>
        {(rotulo !== null || nomeNoChip !== null) && (
          <div className="text-apoio text-tinta-fraca mt-1 flex flex-wrap items-center gap-2 tabular-nums">
            {rotulo !== null && (
              <span
                data-testid="lembrete-prazo"
                className={cn(
                  situacao === "vencido" && "text-erro font-semibold",
                  situacao === "hoje" && "text-atencao font-semibold",
                )}
              >
                {rotulo}
              </span>
            )}
            {nomeNoChip !== null && (
              <span
                data-testid="lembrete-chip"
                className={cn(
                  "rounded-full px-2 font-semibold text-white [overflow-wrap:anywhere]",
                  corDaPessoa(indiceDaPessoa),
                )}
              >
                {nomeNoChip}
              </span>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

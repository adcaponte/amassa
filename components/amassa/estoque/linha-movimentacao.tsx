import type { LinhaDoHistorico } from "@/lib/estoque/consultas";
import {
  descreverMovimentacao,
  quandoTexto,
  type TomDaMovimentacao,
  type TomDoChip,
} from "@/lib/estoque/historico";
import { cn } from "@/lib/utils";

// A cor do número pelo tipo (UI-SPEC §Aba Histórico): entrada em verde (P10), saída na cor da
// tinta, ajuste em terracota (Accent, item 5).
const COR_DA_QUANTIDADE: Record<TomDaMovimentacao, string> = {
  sucesso: "text-sucesso",
  tinta: "text-tinta",
  acento: "text-acento",
};

// Os chips (Apoio 600, `rounded-full`, 4×8px): "do Financeiro" com a borda tracejada terracota (P5),
// "Perda" em erro (P4), "Venda" em sucesso (P11), os neutros ("Estornada", "Estorno", "Saldo
// inicial") em `tinta-fraca` sobre `superficie-2` (P9).
const CLASSE_DO_CHIP: Record<TomDoChip, string> = {
  financeiro: "bg-acento-fundo text-acento border border-dashed border-acento",
  // "da Produção" (Fase 06.1, plano 11): o mesmo desenho do "do Financeiro" — veio de outro módulo.
  producao: "bg-acento-fundo text-acento border border-dashed border-acento",
  perda: "bg-erro-fundo text-erro",
  venda: "bg-sucesso-fundo text-sucesso",
  neutro: "bg-superficie-2 text-tinta-fraca",
};

export type LinhaMovimentacaoProps = {
  linha: LinhaDoHistorico;
  // Na aba Histórico a linha 1 é o nome do material; na folha do material (plano 06-09), que já é
  // de um material só, a linha 1 é omitida e os chips sobem para a linha do detalhe.
  comNome: boolean;
  // O instante de referência do "Hoje"/"Ontem" — lido UMA vez por quem desenha a lista.
  agora: Date;
};

// Uma linha do livro — a MESMA na aba Histórico e na folha do material (plano 06-09). O texto
// inteiro vem de `descreverMovimentacao` (lib/estoque/historico.ts), a única fonte da frase de
// cada tipo; o "quando" vem de `quandoTexto`, no fuso de Brasília.
//
// EST-06: a linha é TEXTO. Não existe nela nenhum elemento interativo nem manipulador de evento —
// nada de editar, apagar, desfazer, menu, deslizar ou toque longo. Se o histórico pudesse ser
// reescrito pela tela, o saldo deixaria de ser confiável; correção é um ajuste, como a nota de
// rodapé explica. O banco também não deixa (`revoke update, delete`, migração 0023).
//
// Coluna da quantidade à esquerda, 76px, número alinhado à direita, `tabular-nums` (UI · overflow ·
// E3: "−1.234,567" e "kg" cabem sem empurrar o texto); linha 2 quebra em qualquer ponto
// (`[overflow-wrap:anywhere]`) para o vínculo de 160 caracteres a 320px (UI · long-text · E3).
export function LinhaMovimentacao({ linha, comNome, agora }: LinhaMovimentacaoProps) {
  const descricao = descreverMovimentacao(linha);

  const chips = descricao.chips.map((chip) => (
    <span
      key={chip.rotulo}
      data-testid="historico-chip"
      className={cn(
        "text-apoio rounded-full px-2 py-1 font-semibold whitespace-nowrap",
        CLASSE_DO_CHIP[chip.tom],
      )}
    >
      {chip.rotulo}
    </span>
  ));

  return (
    <div
      data-testid="historico-linha"
      data-numero={linha.numero}
      data-item-id={linha.itemId}
      className="flex items-start gap-3 p-4"
    >
      <div className="w-[76px] shrink-0 text-right tabular-nums">
        <p
          data-testid="historico-quantidade"
          data-tom={descricao.tom}
          className={cn("text-corpo font-semibold whitespace-nowrap", COR_DA_QUANTIDADE[descricao.tom])}
        >
          {descricao.quantidadeTexto}
        </p>
        <p className="text-apoio text-tinta-fraca">{descricao.unidadeTexto}</p>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {comNome ? (
          <p className="flex flex-wrap items-center gap-2">
            <span
              data-testid="historico-material"
              className="text-corpo text-tinta font-semibold [overflow-wrap:anywhere]"
            >
              {linha.itemNome}
            </span>
            {chips}
          </p>
        ) : descricao.chips.length > 0 ? (
          <p className="flex flex-wrap items-center gap-2">{chips}</p>
        ) : null}
        <p
          data-testid="historico-detalhe"
          className="text-apoio text-tinta-media [overflow-wrap:anywhere]"
        >
          {descricao.linha2}
        </p>
        <p data-testid="historico-quando" className="text-apoio text-tinta-fraca">
          {quandoTexto(linha.criadoEm, agora)} · {linha.registradoPorNome}
        </p>
      </div>
    </div>
  );
}

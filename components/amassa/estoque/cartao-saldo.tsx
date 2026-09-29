"use client";

import { ROTULO_UNIDADE } from "@/lib/cadastros/catalogo";
import { formatarQuantidade, formatarReais } from "@/lib/financeiro/formato";
import { ROTULO_AREA, type AreaFinanceira } from "@/lib/financeiro/textos";
import type { SaldoDoItem } from "@/lib/estoque/consultas";
import { alertaDoItem, custoMedioParaExibir, type SituacaoDoSaldo } from "@/lib/estoque/saldo";
import {
  CHIP_ACABANDO,
  CHIP_DESATIVADO,
  CHIP_SALDO_NEGATIVO,
  META_PECA_PRONTA,
  META_SEM_MINIMO,
  ROTULO_DAR_BAIXA,
  SEM_CUSTO_CONHECIDO,
  textoCustoMedio,
  textoMetaMinimo,
} from "@/lib/estoque/textos";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// Milésimos inteiros → "3", "2,5", "−1" — pt-BR, até 3 casas, com o sinal de menos TIPOGRÁFICO
// ("−", não o hífen) quando negativo (UI-SPEC §Aba Saldos → Cartão). A divisão por 1000 só acontece
// aqui, na hora de MOSTRAR: a conta inteira do saldo é soma de inteiros no banco.
export function formatarMilesimos(milesimos: number): string {
  const absoluto = formatarQuantidade(String(Math.abs(milesimos) / 1000));
  return milesimos < 0 ? `−${absoluto}` : absoluto;
}

// O custo médio como a tela mostra: "R$ 4,20/kg", ou "—" sem nenhuma entrada com preço (D-26).
export function textoDoCustoMedio(saldo: SaldoDoItem): string {
  const custo = custoMedioParaExibir(saldo);
  return custo === null
    ? SEM_CUSTO_CONHECIDO
    : textoCustoMedio(formatarReais(custo), ROTULO_UNIDADE[saldo.unidade]);
}

// A cor do número do saldo pela situação — âmbar para acabando (P2), vermelho para negativo (P3).
export const COR_DO_SALDO: Record<SituacaoDoSaldo, string> = {
  negativo: "text-erro",
  acabando: "text-atencao",
  ok: "text-tinta",
};

// O ponto de 8px da área (decorativo, `aria-hidden`) — o nome vem sempre escrito ao lado; a cor
// nunca carrega a informação sozinha (UI-SPEC §Color, "Área do Financeiro — decorativa").
export function PontoDaArea({ area, className }: { area: AreaFinanceira; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-2 shrink-0 rounded-full", className)}
      style={{ backgroundColor: `var(--color-area-${area})` }}
    />
  );
}

// O chip de UM material: desativado leva só o neutro; negativo vence acabando (D-21 — nunca os
// dois); material bem não leva chip. A situação vem de `alertaDoItem`, nunca de conta própria.
export function ChipDoSaldo({ saldo }: { saldo: SaldoDoItem }) {
  if (!saldo.ativo) {
    return (
      <span
        data-testid="estoque-chip-desativado"
        className="text-apoio bg-superficie-2 text-tinta-fraca rounded-full px-2 py-1 font-semibold"
      >
        {CHIP_DESATIVADO}
      </span>
    );
  }
  const alerta = alertaDoItem(saldo);
  if (alerta === "negativo") {
    return (
      <span
        data-testid="estoque-chip-negativo"
        className="text-apoio bg-erro-fundo text-erro rounded-full px-2 py-1 font-semibold"
      >
        {CHIP_SALDO_NEGATIVO}
      </span>
    );
  }
  if (alerta === "acabando") {
    return (
      <span
        data-testid="estoque-chip-acabando"
        className="text-apoio bg-atencao-fundo text-atencao rounded-full px-2 py-1 font-semibold"
      >
        {CHIP_ACABANDO}
      </span>
    );
  }
  return null;
}

// "mínimo 2 kg" ou "sem mínimo". Só EXIBE o mínimo — se ele alerta ou não é `alertaDoItem`
// quem diz (o banco garante mínimo ≥ 0, então zero é "sem mínimo").
export function textoDoMinimo(saldo: SaldoDoItem): string {
  return saldo.estoqueMinimoMilesimos === 0
    ? META_SEM_MINIMO
    : textoMetaMinimo(
        formatarMilesimos(saldo.estoqueMinimoMilesimos),
        ROTULO_UNIDADE[saldo.unidade],
      );
}

export type CartaoSaldoProps = {
  saldo: SaldoDoItem;
  aoDarBaixa: (saldo: SaldoDoItem) => void;
};

// O cartão da aba Saldos abaixo de 980px (UI-SPEC §"Estados e Comportamento → Aba Saldos
// (Cartão)"): borda esquerda de 4px na cor do alerta; nome (quebra livre, nunca truncado); a linha
// "● {Área} · {categoria da compra} · mínimo {m} {un}" (ou "· sem mínimo") com "· peça pronta" no
// fim; o saldo em Display à direita, com a unidade embaixo; e o rodapé com o chip, "Dar baixa" (só
// ativo — UI-D11) e o custo médio. O cartão inteiro NÃO é clicável — só o botão. Desativado: borda
// neutra, chip "Desativado", sem opacidade reduzida (o texto mantém o contraste).
//
// Os `data-testid` (`estoque-cartao`, `estoque-cartao-saldo`, `estoque-cartao-unidade`,
// `estoque-dar-baixa`) são os do traçador (06-01) e a tabela os repete na linha — os e2e de
// 06-01/06-03 acham o material pelo que estiver VISÍVEL na largura da tela.
export function CartaoSaldo({ saldo, aoDarBaixa }: CartaoSaldoProps) {
  const alerta = alertaDoItem(saldo);
  const unidade = ROTULO_UNIDADE[saldo.unidade];
  const meta = [
    ROTULO_AREA[saldo.area],
    saldo.categoriaCompraNome,
    textoDoMinimo(saldo),
    saldo.ehPecaPronta ? META_PECA_PRONTA : null,
  ]
    .filter((parte): parte is string => Boolean(parte))
    .join(" · ");

  return (
    <article
      data-testid="estoque-cartao"
      data-item-id={saldo.id}
      data-alerta={alerta}
      className={cn(
        "bg-superficie border-borda grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-lg border border-l-4 p-4",
        alerta === "negativo"
          ? "border-l-erro"
          : alerta === "acabando"
            ? "border-l-atencao"
            : "border-l-borda",
      )}
    >
      <p className="text-corpo text-tinta min-w-0 font-semibold [overflow-wrap:anywhere]">
        {saldo.nome}
      </p>
      <div className="row-span-2 text-right">
        <p
          data-testid="estoque-cartao-saldo"
          className={cn("text-display whitespace-nowrap tabular-nums", COR_DO_SALDO[alerta])}
        >
          {formatarMilesimos(saldo.saldoMilesimos)}
        </p>
        <p data-testid="estoque-cartao-unidade" className="text-apoio text-tinta-fraca">
          {unidade}
        </p>
      </div>
      <p
        data-testid="estoque-cartao-meta"
        className="text-apoio text-tinta-fraca flex min-w-0 items-start gap-1 [overflow-wrap:anywhere]"
      >
        <PontoDaArea area={saldo.area} className="mt-1.5" />
        <span className="min-w-0">{meta}</span>
      </p>

      <div className="col-span-2 mt-2 flex flex-wrap items-center gap-2">
        <ChipDoSaldo saldo={saldo} />
        {saldo.ativo ? (
          <Button
            type="button"
            variant="outline"
            className="text-corpo min-h-[44px] px-4 font-semibold"
            aria-label={`${ROTULO_DAR_BAIXA} em ${saldo.nome}`}
            data-testid="estoque-dar-baixa"
            onClick={() => aoDarBaixa(saldo)}
          >
            {ROTULO_DAR_BAIXA}
          </Button>
        ) : null}
        <span
          data-testid="estoque-cartao-custo"
          className="text-apoio text-tinta-fraca ml-auto whitespace-nowrap tabular-nums"
        >
          {textoDoCustoMedio(saldo)}
        </span>
      </div>
    </article>
  );
}

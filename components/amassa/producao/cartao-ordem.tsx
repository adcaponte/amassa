import Link from "next/link";

import { formatarDiaMes } from "@/lib/producao/calendario";
import type { OrdemEmAndamento } from "@/lib/producao/consultas";
import type { LeituraDaOrdem, Selo } from "@/lib/producao/leitura";
import {
  CHIP_DA_CASA,
  CHIP_VENDA_CANCELADA,
  textoAguardandoNoCartao,
  textoDiasNestaEtapa,
  textoEntregaNoCartao,
  textoParcialNoCartao,
  textoPecasNoCartao,
  textoSelo,
} from "@/lib/producao/textos";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import { cn } from "@/lib/utils";

// As cores do selo (UI-SPEC §Color): "no ritmo" sucesso; "+N nesta etapa" atenção; "vai atrasar"
// erro; "aguardando o sinal" e "encerrada" neutros. A cor nunca é a única pista — o texto está
// sempre escrito.
const COR_DO_SELO: Record<Selo["tipo"], string> = {
  "no-ritmo": "bg-sucesso-fundo text-sucesso",
  "passou-nesta-etapa": "bg-atencao-fundo text-atencao",
  "vai-atrasar": "bg-erro-fundo text-erro",
  "aguardando-sinal": "bg-superficie-2 text-tinta-media",
  encerrada: "bg-superficie-2 text-tinta-media",
  cancelada: "bg-superficie-2 text-tinta-media",
};

export function ChipDoSelo({ selo }: { selo: Selo }) {
  return (
    <span
      data-testid="producao-selo"
      data-selo={selo.tipo}
      className={cn(
        "text-apoio inline-flex rounded-full px-2 py-1 font-semibold whitespace-nowrap",
        COR_DO_SELO[selo.tipo],
      )}
    >
      {textoSelo(selo)}
    </span>
  );
}

export type CartaoOrdemProps = {
  ordem: OrdemEmAndamento;
  // No quadro, a leitura da ordem liberada; na seção "Aguardando o sinal" (plano 03), a aguardando —
  // a linha 3 vira "ainda não começou · entrega {dd/mm}".
  leitura: Extract<LeituraDaOrdem, { tipo: "em-andamento" } | { tipo: "aguardando" }>;
  selo: Selo;
};

// O cartão de uma ordem no quadro (UI-SPEC §"Quadro por etapa → Cartão de ordem"): o bloco inteiro é
// um `<Link>` para a ordem — nenhuma ação no cartão ("Terminei" mora na ordem, para não marcar a
// etapa errada rolando o quadro com a mão suja). Nome em Corpo 600 com quebra livre, nunca
// truncado; detalhe; "há N dias nesta etapa · previsto P" e a entrega; o selo. Nenhuma hora
// (PRD-05). O nome acessível do link é o texto do cartão (não sobrescrito). Plano 05: o parcial da
// etapa atual na linha 2, quando houver.
export function CartaoOrdem({ ordem, leitura, selo }: CartaoOrdemProps) {
  // O parcial da etapa ATUAL (plano 05, PRD-06): " · 18 de 30 já passaram" — informativo; vazio ou
  // zero não aparece. Só na ordem liberada (a aguardando não tem etapa atual começada).
  const parcial =
    leitura.tipo === "em-andamento"
      ? (ordem.etapas.find((etapa) => etapa.etapa === leitura.etapa)?.passaram ?? null)
      : null;
  return (
    <Link
      href={rotaDeGestao(`/producao/${ordem.id}`)}
      data-testid="producao-cartao"
      data-ordem-id={ordem.id}
      className="bg-superficie border-borda focus-visible:ring-ring flex min-h-[44px] flex-col gap-1 rounded-md border p-4 text-left focus-visible:ring-2 focus-visible:outline-none md:hover:bg-superficie-2 xl:p-3"
    >
      <span className="text-corpo text-tinta font-semibold [overflow-wrap:anywhere]">
        {ordem.nome}
      </span>
      <span className="text-apoio text-tinta-fraca flex flex-wrap items-center gap-x-1 [overflow-wrap:anywhere]">
        {ordem.tipo === "casa" ? (
          <span className="bg-superficie-2 text-tinta-media rounded-full px-2 font-semibold">
            {CHIP_DA_CASA}
          </span>
        ) : ordem.clienteNome ? (
          <span>{ordem.clienteNome}</span>
        ) : null}
        <span aria-hidden="true">·</span>
        <span>{textoPecasNoCartao(ordem.totalPecas, ordem.totalAMais)}</span>
        {parcial !== null ? (
          <>
            <span aria-hidden="true">·</span>
            <span data-testid="producao-cartao-parcial">
              {textoParcialNoCartao(parcial, ordem.totalPecas + ordem.totalAMais)}
            </span>
          </>
        ) : null}
      </span>
      {leitura.tipo === "aguardando" ? (
        <span data-testid="producao-cartao-aguardando" className="text-apoio text-tinta-fraca">
          {textoAguardandoNoCartao(
            ordem.entregaPrometida ? formatarDiaMes(ordem.entregaPrometida) : null,
          )}
        </span>
      ) : (
        <span className="text-apoio text-tinta-fraca">
          <span data-testid="producao-cartao-dias">
            {textoDiasNestaEtapa(leitura.diasNestaEtapa, leitura.previstoDaEtapa)}
          </span>
          {ordem.entregaPrometida ? (
            <> · {textoEntregaNoCartao(formatarDiaMes(ordem.entregaPrometida))}</>
          ) : null}
        </span>
      )}
      <span className="mt-1 flex flex-wrap gap-2">
        <ChipDoSelo selo={selo} />
        {/* UI-D19: a venda desta ordem LIBERADA foi cancelada no Caixa (D-07) — derivado na leitura;
            a ordem segue até o dono decidir. */}
        {leitura.tipo === "em-andamento" && ordem.vendaCancelada ? (
          <span
            data-testid="cartao-venda-cancelada"
            className="bg-atencao-fundo text-atencao text-apoio inline-flex rounded-full px-2 py-1 font-semibold whitespace-nowrap"
          >
            {CHIP_VENDA_CANCELADA}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

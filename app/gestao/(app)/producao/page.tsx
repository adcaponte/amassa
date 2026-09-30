import Link from "next/link";

import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { hojeEmBrasilia } from "@/lib/financeiro/formato";
import {
  cabemPorFicha,
  contarConcluidasECanceladas,
  listarOrdensEmAndamento,
} from "@/lib/producao/consultas";
import { esperandoOForno, fornadasEstimadas, type FornadasEstimadas } from "@/lib/producao/forno";
import { leituraDaOrdem, seloDaOrdem } from "@/lib/producao/leitura";
import { FILTROS_DO_QUADRO, filtrarOrdens, type FiltroDoQuadro } from "@/lib/producao/quadro";
import {
  CORPO_PRODUCAO_VAZIA,
  rotuloVerConcluidas,
  TITULO_PRODUCAO,
  TITULO_PRODUCAO_VAZIA,
} from "@/lib/producao/textos";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import { Button } from "@/components/ui/button";
import { CabecalhoPagina } from "@/components/amassa/cabecalho-pagina";
import { EstadoVazio } from "@/components/amassa/estado-vazio";
import { BotaoNovaOrdem } from "@/components/amassa/producao/botao-nova-ordem";
import { FolhaNovaOrdem } from "@/components/amassa/producao/folha-nova-ordem";
import {
  PainelProducao,
  type LeituraNoPainel,
} from "@/components/amassa/producao/painel-producao";

// `/gestao/producao` — o quadro (Fase 06.1). `exigirUsuario()` como PRIMEIRA instrução — regra do
// CLAUDE.md, verificada por `npm run verificar-acoes`. "Hoje" é decidido AQUI, no servidor
// (Brasília), e passado ao módulo puro — o cliente nunca decide o dia.
//
// "Ver concluídas e canceladas (N)" (`outline`, 44px) só aparece com N > 0 — também no vazio total,
// para as encerradas nunca ficarem sem caminho quando nada está em andamento.
function VerConcluidas({ quantas }: { quantas: number }) {
  if (quantas === 0) {
    return null;
  }
  return (
    <Button
      asChild
      variant="outline"
      className="text-corpo h-auto min-h-[44px] self-start px-4 font-semibold"
    >
      <Link href={rotaDeGestao("/producao/concluidas")} data-testid="producao-ver-concluidas">
        {rotuloVerConcluidas(quantas)}
      </Link>
    </Button>
  );
}

// Tudo sai de UMA leitura (`listarOrdensEmAndamento`) mais o "cabem" das fichas da fila do forno —
// o mesmo `loading.tsx` e o mesmo `error.tsx` valem para os números, o quadro e a seção
// "Aguardando o sinal". O filtro é do cliente (`PainelProducao`); as fornadas vão prontas para os
// três filtros, para trocar de filtro nunca pedir nada ao servidor (plano 08). Linha do tempo e
// "Imprimir folha geral" chegam nos planos 09 e 13.
export default async function PaginaProducao() {
  await exigirUsuario();
  const hoje = hojeEmBrasilia(new Date());

  const [ordens, encerradas] = await Promise.all([
    listarOrdensEmAndamento(),
    contarConcluidasECanceladas(),
  ]);

  // Sem nenhuma ordem liberada nem aguardando, o único terracota é o "Nova ordem" do vazio — o
  // cabeçalho fica sem botão nenhum (UI-D11). A folha (`?nova=1`) vale nos dois casos.
  if (ordens.length === 0) {
    return (
      <>
        <CabecalhoPagina titulo={TITULO_PRODUCAO} />
        <EstadoVazio
          titulo={TITULO_PRODUCAO_VAZIA}
          corpo={CORPO_PRODUCAO_VAZIA}
          botao={<BotaoNovaOrdem />}
          testId="producao-vazio"
        />
        {encerradas > 0 ? (
          <div className="flex px-6 pb-6 md:px-8">
            <VerConcluidas quantas={encerradas} />
          </div>
        ) : null}
        <FolhaNovaOrdem hoje={hoje} />
      </>
    );
  }

  const leituras: Record<string, LeituraNoPainel> = {};
  for (const ordem of ordens) {
    if (ordem.status !== "ativa") {
      continue;
    }
    const leitura = leituraDaOrdem(ordem, hoje);
    if (leitura.tipo === "em-andamento") {
      leituras[ordem.id] = { leitura, selo: seloDaOrdem(leitura) };
    }
  }

  // A fila do forno inteira e o "cabem" das fichas dela — uma leitura de parâmetros por página.
  const fila = esperandoOForno(ordens);
  const cabem = await cabemPorFicha(
    fila.flatMap((ordem) =>
      ordem.pecasEmResumo.flatMap((peca) => (peca.fichaId === null ? [] : [peca.fichaId])),
    ),
    hoje,
  );
  const fornadasPorFiltro = Object.fromEntries(
    FILTROS_DO_QUADRO.map((filtro) => [
      filtro,
      fornadasEstimadas(filtrarOrdens(fila, filtro), cabem),
    ]),
  ) as Record<FiltroDoQuadro, FornadasEstimadas>;

  return (
    <>
      <CabecalhoPagina titulo={TITULO_PRODUCAO}>
        <BotaoNovaOrdem />
      </CabecalhoPagina>
      <PainelProducao
        ordens={ordens}
        leituras={leituras}
        fornadasPorFiltro={fornadasPorFiltro}
        rodape={encerradas > 0 ? <VerConcluidas quantas={encerradas} /> : undefined}
      />
      <FolhaNovaOrdem hoje={hoje} />
    </>
  );
}

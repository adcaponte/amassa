import { notFound } from "next/navigation";

import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { hojeEmBrasilia } from "@/lib/financeiro/formato";
import { formatarDiaMes } from "@/lib/producao/calendario";
import { obterOrdem } from "@/lib/producao/consultas";
import {
  etapasOrdenadas,
  leituraDaOrdem,
  levouDias,
  seloDaOrdem,
} from "@/lib/producao/leitura";
import {
  ROTULO_VOLTAR_PRODUCAO,
  TITULO_ETAPAS,
  TITULO_PECAS,
  textoAMais,
  textoLinhaDaPeca,
  textoSubLinhaDaPeca,
  textoSubtituloDaOrdem,
} from "@/lib/producao/textos";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import { CabecalhoPagina } from "@/components/amassa/cabecalho-pagina";
import { BotaoTerminei } from "@/components/amassa/producao/botao-terminei";
import { CaixaAguardando } from "@/components/amassa/producao/caixa-aguardando";
import { ChipDoSelo } from "@/components/amassa/producao/cartao-ordem";
import { TrilhaEtapas } from "@/components/amassa/producao/trilha-etapas";

// `/gestao/producao/[id]` — a ordem (Fase 06.1, plano 01: o traçador). `exigirUsuario()` como
// PRIMEIRA instrução — regra do CLAUDE.md. `params` é `Promise` no Next.js 15. Ordem inexistente (ou
// id malformado — os dois respondem igual) → `notFound()`, o 404 do grupo protegido.
//
// Neste plano: o cabeçalho (nome com quebra livre, nunca truncado — `CabecalhoPagina`), o bloco
// "Etapas" com a trilha e o "Terminei: {Etapa}", e as peças; na ordem aguardando o sinal, a caixa
// âmbar com a leitura do sinal no Caixa e os botões de liberar (plano 03). Desfazer, ajuste de
// dias, parcial, a barra fixa do celular, material, cancelar, previsão e a conclusão chegam nos
// planos seguintes. Na etapa Entrega o botão não aparece: a última etapa se conclui (plano 11).
export default async function PaginaOrdem({ params }: { params: Promise<{ id: string }> }) {
  await exigirUsuario();
  const { id } = await params;

  const ordem = await obterOrdem(id);
  if (!ordem) {
    notFound();
  }

  // "Hoje" decidido no SERVIDOR (Brasília) — o cliente nunca decide o dia.
  const hoje = hojeEmBrasilia(new Date());
  const leitura = leituraDaOrdem(ordem, hoje);
  const selo = seloDaOrdem(leitura);
  const etapas = etapasOrdenadas(ordem);
  const levou = levouDias(ordem);
  const podeTerminar =
    leitura.tipo === "em-andamento" && leitura.indice < etapas.length - 1;

  return (
    <>
      <CabecalhoPagina
        titulo={ordem.nome}
        voltar={{ href: rotaDeGestao("/producao"), rotulo: ROTULO_VOLTAR_PRODUCAO }}
      >
        <ChipDoSelo selo={selo} />
      </CabecalhoPagina>

      <div className="grid grid-cols-1 items-start gap-6 px-6 py-6 md:px-8 lg:grid-cols-[1.15fr_1fr]">
        <section
          aria-labelledby="ordem-etapas-titulo"
          className="bg-superficie border-borda flex flex-col gap-4 rounded-lg border p-4"
        >
          <div className="flex flex-col gap-1">
            <h2 id="ordem-etapas-titulo" className="text-titulo text-tinta">
              {TITULO_ETAPAS}
            </h2>
            <p data-testid="ordem-subtitulo" className="text-apoio text-tinta-fraca">
              {textoSubtituloDaOrdem({
                clienteNome: ordem.clienteNome,
                ehDaCasa: ordem.tipo === "casa",
                numero: ordem.numero,
                caminhoCompleto: ordem.caminho === "completo",
                inicioDiaMes: ordem.inicio ? formatarDiaMes(ordem.inicio) : null,
                entregaDiaMes: ordem.entregaPrometida
                  ? formatarDiaMes(ordem.entregaPrometida)
                  : null,
              })}
            </p>
          </div>

          {ordem.status === "aguardando_sinal" || ordem.status === "ativa" ? (
            // Montada nos dois estados, no mesmo lugar: a recusa de um segundo "Liberar" continua
            // visível depois que a tela recarrega a ordem já liberada (ver `CaixaAguardando`).
            <CaixaAguardando
              ordemId={ordem.id}
              aguardando={ordem.status === "aguardando_sinal"}
              sinal={
                ordem.status === "aguardando_sinal" && ordem.sinal
                  ? {
                      avista: ordem.sinal.plano === "avista",
                      parcelaId: ordem.sinal.parcelaId,
                      recebidoEmDiaMes: ordem.sinal.recebidoEm
                        ? formatarDiaMes(ordem.sinal.recebidoEm)
                        : null,
                    }
                  : null
              }
            />
          ) : null}

          <TrilhaEtapas tipo={ordem.tipo} etapas={etapas} leitura={leitura} levou={levou} />

          {podeTerminar && leitura.tipo === "em-andamento" ? (
            <BotaoTerminei ordemId={ordem.id} tipo={ordem.tipo} etapa={leitura.etapa} />
          ) : null}
        </section>

        <section
          aria-labelledby="ordem-pecas-titulo"
          className="bg-superficie border-borda flex flex-col gap-2 rounded-lg border p-4"
        >
          <h2 id="ordem-pecas-titulo" className="text-titulo text-tinta">
            {TITULO_PECAS}
          </h2>
          <ul className="flex flex-col">
            {ordem.pecas.map((peca) => (
              <li
                key={peca.id}
                data-testid="ordem-peca"
                className="border-borda flex flex-col gap-1 border-b py-4 last:border-b-0"
              >
                <span className="text-corpo text-tinta flex flex-wrap items-center gap-2 font-semibold [overflow-wrap:anywhere]">
                  {textoLinhaDaPeca(peca.quantidade, peca.descricao)}
                  {peca.aMais > 0 ? (
                    <span className="text-apoio bg-superficie-2 text-tinta-media rounded-full px-2 font-semibold">
                      {textoAMais(peca.aMais)}
                    </span>
                  ) : null}
                </span>
                {textoSubLinhaDaPeca(peca.cor, peca.personalizacao) ? (
                  <span className="text-apoio text-tinta-fraca [overflow-wrap:anywhere]">
                    {textoSubLinhaDaPeca(peca.cor, peca.personalizacao)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

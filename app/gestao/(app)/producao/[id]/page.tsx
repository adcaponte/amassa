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
  DICA_ETAPA_INTEIRA,
  ROTULO_VOLTAR_PRODUCAO,
  TEXTO_PREVISAO_DE_CONCLUSAO,
  TITULO_ETAPAS,
  textoPrevisao,
  textoSubtituloDaOrdem,
} from "@/lib/producao/textos";
import { totalDeFeitas } from "@/lib/producao/transicoes";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import { cn } from "@/lib/utils";
import { CabecalhoPagina } from "@/components/amassa/cabecalho-pagina";
import { AcoesDaOrdem } from "@/components/amassa/producao/acoes-da-ordem";
import { BlocoPecas } from "@/components/amassa/producao/bloco-pecas";
import { CaixaAguardando } from "@/components/amassa/producao/caixa-aguardando";
import { ChipDoSelo } from "@/components/amassa/producao/cartao-ordem";
import { TrilhaEtapas } from "@/components/amassa/producao/trilha-etapas";

// `/gestao/producao/[id]` — a ordem (Fase 06.1). `exigirUsuario()` como PRIMEIRA instrução — regra
// do CLAUDE.md. `params` é `Promise` no Next.js 15. Ordem inexistente (ou id malformado — os dois
// respondem igual) → `notFound()`, o 404 do grupo protegido.
//
// Até aqui: o cabeçalho (nome com quebra livre, nunca truncado — `CabecalhoPagina`); o bloco
// "Etapas" com o sub-título (UI-D17), a caixa "Aguardando o sinal" (plano 03), a trilha com o −/+
// das etapas futuras e o parcial da atual (plano 05), as ações — "Desfazer a última" e "Terminei",
// numa barra fixa no celular (UI-D3) — e a previsão de conclusão (plano 05); o bloco "Peças" (plano
// 04). Material, cancelar e a conclusão chegam nos planos seguintes. Na etapa Entrega o "Terminei"
// não aparece: a última etapa se conclui (plano 11).
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
  const total = totalDeFeitas(ordem.pecas);
  const ativa = leitura.tipo === "em-andamento";
  const etapaParaTerminar =
    leitura.tipo === "em-andamento" && leitura.indice < etapas.length - 1 ? leitura.etapa : null;
  const feitas = etapas.filter((etapa) => etapa.feitaEm !== null);
  const ultimaFeita = feitas.at(-1);
  const folga = leitura.tipo === "em-andamento" ? textoPrevisao(leitura.folgaDias) : null;

  return (
    <>
      <CabecalhoPagina
        titulo={ordem.nome}
        voltar={{ href: rotaDeGestao("/producao"), rotulo: ROTULO_VOLTAR_PRODUCAO }}
      >
        <ChipDoSelo selo={selo} />
      </CabecalhoPagina>

      <div
        className={cn(
          "grid grid-cols-1 items-start gap-6 px-6 py-6 md:px-8 lg:grid-cols-[1.15fr_1fr]",
          // No celular, a barra de ação fixa cobre o fim da página: reserva a altura dela a mais.
          ativa && "pb-[calc(var(--altura-acao-fixa)+16px)] md:pb-6",
        )}
      >
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

          <TrilhaEtapas
            ordemId={ordem.id}
            tipo={ordem.tipo}
            status={ordem.status}
            etapas={etapas}
            leitura={leitura}
            levou={levou}
            totalDeFeitas={total}
          />

          {ativa ? (
            <AcoesDaOrdem
              ordemId={ordem.id}
              tipo={ordem.tipo}
              etapaParaTerminar={etapaParaTerminar}
              ultimaFeita={
                ultimaFeita?.feitaEm
                  ? { etapa: ultimaFeita.etapa, feitaEmDiaMes: formatarDiaMes(ultimaFeita.feitaEm) }
                  : null
              }
            />
          ) : null}

          {leitura.tipo === "em-andamento" ? (
            <div className="flex flex-col gap-1">
              <p data-testid="ordem-previsao" className="text-apoio text-tinta-media">
                {TEXTO_PREVISAO_DE_CONCLUSAO}{" "}
                <span className="font-semibold">{formatarDiaMes(leitura.previsaoDeConclusao)}</span>
                {folga ? (
                  <>
                    {" · "}
                    <span
                      data-testid="ordem-previsao-folga"
                      className={cn("font-semibold", folga.tipo === "atraso" && "text-erro")}
                    >
                      {folga.texto}
                    </span>
                  </>
                ) : null}
              </p>
              <p className="text-apoio text-tinta-fraca">{DICA_ETAPA_INTEIRA}</p>
            </div>
          ) : null}
        </section>

        <BlocoPecas
          ordemId={ordem.id}
          podeDefinirAMais={
            ordem.tipo === "encomenda" &&
            (ordem.status === "aguardando_sinal" || ordem.status === "ativa")
          }
          pecas={ordem.pecas}
          fotos={ordem.fotos}
          origem={ordem.origem}
        />
      </div>
    </>
  );
}

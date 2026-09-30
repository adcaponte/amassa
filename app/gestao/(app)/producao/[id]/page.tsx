import { Suspense } from "react";
import { notFound } from "next/navigation";

import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { hojeEmBrasilia } from "@/lib/financeiro/formato";
import { formatarDiaMes } from "@/lib/producao/calendario";
import { materialDaOrdem, obterOrdem } from "@/lib/producao/consultas";
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
import { CarregadorDoSeletor } from "@/components/amassa/estoque/carregador-do-seletor";
import { ProvedorDoEstoque } from "@/components/amassa/estoque/provedor-estoque";
import { AvisoVendaCancelada } from "@/components/amassa/producao/aviso-venda-cancelada";
import { BlocoMaterial } from "@/components/amassa/producao/bloco-material";
import { BlocoPecas } from "@/components/amassa/producao/bloco-pecas";
import { CaixaAguardando } from "@/components/amassa/producao/caixa-aguardando";
import { ChipDoSelo } from "@/components/amassa/producao/cartao-ordem";
import { ConfirmarCancelarOrdem } from "@/components/amassa/producao/confirmar-cancelar-ordem";
import { ResultadoDaOrdem } from "@/components/amassa/producao/resultado-da-ordem";
import { TrilhaEtapas } from "@/components/amassa/producao/trilha-etapas";

// `/gestao/producao/[id]` — a ordem (Fase 06.1). `exigirUsuario()` como PRIMEIRA instrução — regra
// do CLAUDE.md. `params` é `Promise` no Next.js 15. Ordem inexistente (ou id malformado — os dois
// respondem igual) → `notFound()`, o 404 do grupo protegido.
//
// Até aqui: o cabeçalho (nome com quebra livre, nunca truncado — `CabecalhoPagina`); o bloco
// "Etapas" com o sub-título (UI-D17), a caixa "Aguardando o sinal" (plano 03), a trilha com o −/+
// das etapas futuras e o parcial da atual (plano 05), as ações — "Desfazer a última" e "Terminei",
// numa barra fixa no celular (UI-D3) — e a previsão de conclusão (plano 05); o bloco "Peças" (plano
// 04); "Cancelar ordem" num bloco próprio, o resultado da cancelada e o aviso de venda cancelada
// no Caixa (plano 06, D-07); o bloco "Material usado" com a baixa pela ordem (plano 10 — a lista do
// seletor "Qual material?" chega pelo MESMO carregador do Estoque, num `Suspense` que não segura a
// página). A conclusão chega no plano seguinte. Na etapa Entrega o "Terminei" não aparece: a última etapa
// se conclui (plano 11).
export default async function PaginaOrdem({ params }: { params: Promise<{ id: string }> }) {
  await exigirUsuario();
  const { id } = await params;

  const [ordem, material] = await Promise.all([obterOrdem(id), materialDaOrdem(id)]);
  if (!ordem || !material) {
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
  // Aguardando ou ativa: a ordem ainda se cancela (PRD-18). Concluída e cancelada não têm ações.
  const emAberto = ordem.status === "aguardando_sinal" || ordem.status === "ativa";
  // D-07: a venda desta ordem LIBERADA foi cancelada no Caixa — derivado na leitura, a ordem não
  // mudou. O aviso traz o "Cancelar ordem" dentro, e o bloco de baixo some.
  const avisoVisivel = ordem.status === "ativa" && ordem.vendaCancelada && ordem.vendaNumero !== null;
  const cancelarNoBloco = emAberto && !avisoVisivel;

  const blocoMaterial = (
    <BlocoMaterial
      ordemId={ordem.id}
      emAberto={emAberto}
      previsto={material.previsto}
      algumaPecaComFicha={material.algumaPecaComFicha}
      ultimoItem={material.ultimoItem}
      baixas={material.baixas.map((baixa) => ({
        id: baixa.id,
        itemId: baixa.itemId,
        nome: baixa.nome,
        unidade: baixa.unidade,
        quantidadeMilesimos: baixa.quantidadeMilesimos,
        material: baixa.material,
        // O dia de Brasília do instante gravado — decidido no servidor.
        diaMes: formatarDiaMes(hojeEmBrasilia(baixa.criadoEm)),
        registradoPorNome: baixa.registradoPorNome,
      }))}
    />
  );

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

          {ordem.vendaCancelada &&
          ordem.vendaNumero !== null &&
          (ordem.status === "ativa" || ordem.status === "cancelada") ? (
            // Montado também depois de cancelada (caixa escondida), no mesmo lugar: a recusa de um
            // segundo "Cancelar ordem" continua visível no diálogo (ver `AvisoVendaCancelada`).
            <AvisoVendaCancelada
              ordemId={ordem.id}
              nome={ordem.nome}
              vendaNumero={ordem.vendaNumero}
              baixasFeitas={ordem.baixasFeitas}
              visivel={avisoVisivel}
            />
          ) : null}

          {ordem.status === "aguardando_sinal" ||
          ordem.status === "ativa" ||
          ordem.status === "cancelada" ? (
            // Montada nos três estados, no mesmo lugar: a recusa de um segundo "Liberar" continua
            // visível depois que a tela recarrega a ordem já liberada — ou já cancelada, junto com a
            // venda no Caixa (D-07) — (ver `CaixaAguardando`).
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

          {ordem.status === "cancelada" && ordem.canceladaEm ? (
            // No lugar das ações e da previsão: a caixa neutra da cancelada (nada fica editável).
            <ResultadoDaOrdem
              resultado={{
                tipo: "cancelada",
                canceladaEmDiaMes: formatarDiaMes(hojeEmBrasilia(ordem.canceladaEm)),
                canceladaPorNome: ordem.canceladaPorNome,
                pelaVendaNumero: ordem.canceladaPelaVenda ? ordem.vendaNumero : null,
              }}
            />
          ) : null}
        </section>

        <div className="flex flex-col gap-6">
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

          {emAberto ? (
            // O seletor "Qual material?" da folha de baixa lê a lista do Estoque pelo provedor da
            // Fase 06, entregue pelo mesmo carregador da aba Saldos (fallback nulo: o bloco aparece
            // já, e o seletor mostra o esqueleto até a lista chegar).
            <ProvedorDoEstoque>
              <Suspense fallback={null}>
                <CarregadorDoSeletor />
              </Suspense>
              {blocoMaterial}
            </ProvedorDoEstoque>
          ) : (
            blocoMaterial
          )}

          {emAberto || ordem.status === "cancelada" ? (
            // O bloco com "Cancelar ordem" (aguardando ou ativa), só o botão, à esquerda — escondido
            // enquanto o aviso de venda cancelada mostra o dele (nunca dois botões iguais). Montado
            // também na cancelada, escondido: a recusa de um segundo "Cancelar" (outro celular)
            // continua visível no diálogo depois que a tela recarrega a ordem já cancelada.
            <div
              data-testid="ordem-bloco-cancelar"
              className={cn(
                "bg-superficie border-borda flex rounded-lg border p-4",
                !cancelarNoBloco && "hidden",
              )}
            >
              <ConfirmarCancelarOrdem
                ordemId={ordem.id}
                nome={ordem.nome}
                baixasFeitas={ordem.baixasFeitas}
                vendaNumero={ordem.vendaNumero}
                vendaCancelada={ordem.vendaCancelada}
                podeCancelar={cancelarNoBloco}
              />
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

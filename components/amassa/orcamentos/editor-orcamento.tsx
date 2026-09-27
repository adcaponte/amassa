import { somarDias } from "@/lib/financeiro/calendario";
import { formatarDataCurta, formatarReais } from "@/lib/financeiro/formato";
import {
  algoMudou,
  sugerirPrecos,
  type LinhaParaAtualizar,
} from "@/lib/orcamentos/atualizacao";
import { planejarAprovacao } from "@/lib/orcamentos/aprovacao";
import { contasDoOrcamento, type LinhaParaContas } from "@/lib/orcamentos/contas";
import {
  listarFotosDoOrcamento,
  type OrcamentoParaEdicao,
  type PecaParaEscolha,
  type RevisaoDoOrcamento,
} from "@/lib/orcamentos/consultas";
import { montarDocumentoDoCliente } from "@/lib/orcamentos/documento-cliente";
import { numeroDeOrcamento, rotuloDeRevisao } from "@/lib/orcamentos/formato";
import { parcelasDoPlano } from "@/lib/orcamentos/plano";
import { lerDoSnapshot, type LinhaCongelada } from "@/lib/orcamentos/snapshot";
import { situacaoDoOrcamento } from "@/lib/orcamentos/situacao";
import {
  DICA_FOTOS_DE_REFERENCIA,
  FRASE_VAZIO_PECAS_DO_ORCAMENTO,
  ROTULO_MAIS_PECA_EXCLUSIVA,
  ROTULO_TODOS,
  TITULO_BLOCO_FOTOS,
  TITULO_BLOCO_PECAS,
  textoAvisoCongelado,
} from "@/lib/orcamentos/textos";
import {
  calcularPeca,
  farolDoPreco,
  type ParametrosDoCalculo,
} from "@/lib/precificacao/calculo";
import type { ParametroVigente } from "@/lib/precificacao/consultas";
import {
  paraContagemInformada,
  paraFichaDeCalculo,
  paraMedidasDaPeca,
  resultadoDaFicha,
  type FichaEmEdicao,
  type ResultadoDaFicha,
} from "@/lib/precificacao/ficha";
import { quantasCabem, type MedidasUteisDoForno } from "@/lib/precificacao/forno";

import { AbrirEscolherPecaBotao, EscolherPeca } from "./escolher-peca";
import { AcoesDoOrcamento } from "./acoes-do-orcamento";
import { CabecalhoDoOrcamento } from "./cabecalho-do-orcamento";
import { ChipDeSituacao } from "./chip-de-situacao";
import { CustosDoProjeto } from "./custos-do-projeto";
import { DialogoAprovar } from "./dialogo-aprovar";
import { DialogoAtualizarPrecos } from "./dialogo-atualizar-precos";
import { FotosDeReferencia } from "./fotos-de-referencia";
import { LinhaDeOrcamento } from "./linha-de-orcamento";
import { SoParaVoce } from "./so-para-voce";
import { TotalEPagamento } from "./total-e-pagamento";
import { VerComoOClienteVe } from "./ver-como-o-cliente-ve";

export type EditorOrcamentoProps = {
  orcamento: OrcamentoParaEdicao;
  pecasParaEscolha: PecaParaEscolha[];
  parametros: ParametrosDoCalculo;
  // A contagem de estimados (D-17) sai daqui — dos 18 parâmetros vigentes, nunca de um número
  // guardado (key_links do 04.5-07-PLAN.md). Enquanto o orçamento é rascunho; o snapshot
  // congelado (plano 08) substitui esta fonte quando ele deixar de ser rascunho.
  parametrosPorChave: Record<string, ParametroVigente>;
  forno: MedidasUteisDoForno;
  taxaCartaoPontosBase: number;
  hoje: string;
  // "Atualizar preços" (04.5-09-PLAN.md, D-23) — o histórico já persistido em
  // `orcamento_revisoes`, para o painel "Só para você".
  revisoes: RevisaoDoOrcamento[];
};

type FichaParaResolver = {
  nome: string;
  argilaMiligramas: number;
  esmalteMiligramas: number;
  horasMilesimos: number;
  larguraMm: number;
  profundidadeMm: number;
  alturaMm: number;
  embalagemCentavos: number;
  cabemBiscoitoInformado: number | null;
  cabemEsmalteInformado: number | null;
};

// A MESMA cadeia que `DialogoFicha`/`ListaPecas` já chamam (quantasCabem → calcularPeca →
// farolDoPreco → resultadoDaFicha) — nunca uma segunda fórmula de preço escrita no editor do
// orçamento. `precoParaFarol` é o preço contra o qual o farol compara: `null` quando só se quer o
// mínimo de hoje (a folha de escolha), o preço da PRÓPRIA linha quando se quer o veredito dela.
function resolverFicha(
  ficha: FichaParaResolver,
  precoParaFarol: number | null,
  parametros: ParametrosDoCalculo,
  forno: MedidasUteisDoForno,
  taxaCartaoPontosBase: number,
): ResultadoDaFicha {
  const fichaEmEdicao: FichaEmEdicao = {
    nome: ficha.nome,
    argilaMiligramas: ficha.argilaMiligramas,
    esmalteMiligramas: ficha.esmalteMiligramas,
    horasMilesimos: ficha.horasMilesimos,
    larguraMm: ficha.larguraMm,
    profundidadeMm: ficha.profundidadeMm,
    alturaMm: ficha.alturaMm,
    embalagemCentavos: ficha.embalagemCentavos,
    cabemBiscoitoInformado: ficha.cabemBiscoitoInformado,
    cabemEsmalteInformado: ficha.cabemEsmalteInformado,
    precoMercadoCentavos: null,
    precoPraticadoCentavos: precoParaFarol,
    exclusiva: false,
    categoriaVendaId: null,
  };

  const cabem = quantasCabem(
    paraMedidasDaPeca(fichaEmEdicao),
    forno,
    paraContagemInformada(fichaEmEdicao),
  );
  const dadosParaCalculo = paraFichaDeCalculo(fichaEmEdicao);
  const resultadoDireto = calcularPeca({
    ficha: dadosParaCalculo,
    cabem,
    parametros,
    taxaCartaoPontosBase,
    canal: "direto",
  });
  const resultadoGaleria = calcularPeca({
    ficha: dadosParaCalculo,
    cabem,
    parametros,
    taxaCartaoPontosBase,
    canal: "galeria",
  });
  const farol = resultadoDireto.ok
    ? farolDoPreco(
        precoParaFarol,
        resultadoDireto.minimoCentavos,
        resultadoDireto.zeroCentavos,
      )
    : null;

  return resultadoDaFicha({ cabem, resultadoDireto, resultadoGaleria, farol });
}

// Reconstrói um `ResultadoDaFicha` a partir de UMA linha congelada (04.5-08-PLAN.md, D-21) — o
// snapshot só guarda os seis campos do briefing (nunca a composição por insumo, que pertence à
// ficha em edição, jamais a uma linha de orçamento); os campos que faltam para fechar o TIPO
// (`fatias`/`minimoGaleriaCentavos`/`forno.porPrateleira`/`forno.niveis`/origens) recebem valor
// neutro porque NENHUM consumidor de uma linha de orçamento (`contasDoOrcamento`,
// `LinhaDeOrcamento`) os lê — só a ficha em edição os lê, e uma linha de orçamento nunca é essa
// tela. Uma linha sem contagem de forno positiva não calculava no instante do congelamento (D-12,
// "uma ficha 'ok' sempre tem as duas contagens maiores que zero") — representada aqui como recusa
// genérica, já que o snapshot não guarda QUAL dos dois motivos era.
function resultadoCongelado(
  linha: LinhaCongelada,
  precoUnitarioCentavos: number,
): ResultadoDaFicha {
  if (linha.quantasCabem.biscoito <= 0 || linha.quantasCabem.esmalte <= 0) {
    return { ok: false, motivo: "divisor-invalido" };
  }

  return {
    ok: true,
    fatias: [],
    custoCentavos: linha.custoCentavos,
    minimoCentavos: linha.minimoCentavos,
    minimoGaleriaCentavos: null,
    zeroCentavos: linha.zeroCentavos,
    farol: farolDoPreco(precoUnitarioCentavos, linha.minimoCentavos, linha.zeroCentavos),
    forno: {
      biscoito: linha.quantasCabem.biscoito,
      esmalte: linha.quantasCabem.esmalte,
      porPrateleira: 0,
      niveis: 0,
      origemBiscoito: "calculado",
      origemEsmalte: "calculado",
    },
  };
}

// Uma linha congelada em branco — usada só como rede de segurança se o número de linhas do
// snapshot algum dia divergir do número de linhas do orçamento (não deveria acontecer: nenhuma
// linha muda depois de congelado), nunca deixando a tela quebrar por um índice ausente.
const LINHA_CONGELADA_EM_BRANCO: LinhaCongelada = {
  nome: "",
  custoCentavos: 0,
  minimoCentavos: 0,
  zeroCentavos: 0,
  horasMilesimos: 0,
  quantasCabem: { biscoito: 0, esmalte: 0 },
};

// O editor do orçamento (Server Component — nenhum estado, nenhum efeito próprio; os blocos que
// precisam de estado são componentes cliente separados, montados por linha ou por bloco, mesma
// disciplina do resto do módulo). A escolha entre calcular ao vivo (rascunho) e ler o congelado
// (qualquer outro status) acontece UMA VEZ aqui, para nome/horas/custo/mínimo/zero/quantasCabem
// de cada linha e para imposto+taxa/estimados do orçamento inteiro (D-21, key_link do plano) — os
// componentes abaixo (`LinhaDeOrcamento`, `contasDoOrcamento`, `SoParaVoce`) só recebem o
// resultado já resolvido, nunca decidem a fonte sozinhos.
export async function EditorOrcamento({
  orcamento,
  pecasParaEscolha,
  parametros,
  parametrosPorChave,
  forno,
  taxaCartaoPontosBase,
  hoje,
  revisoes,
}: EditorOrcamentoProps) {
  // A grade de fotos (04.5-10-PLAN.md) não estava no `Promise.all` original de
  // `app/(app)/financeiro/page.tsx` (files_modified do plano não inclui aquele arquivo) — o
  // próprio `EditorOrcamento`, um Server Component, busca as fotos aqui. Componente async é
  // válido em React Server Components; nada muda para quem o renderiza.
  const fotos = await listarFotosDoOrcamento(orcamento.id);

  const vivo = orcamento.status === "rascunho";
  const situacao = situacaoDoOrcamento(
    {
      status: orcamento.status,
      data: orcamento.data,
      validadeDias: orcamento.validadeDias,
    },
    hoje,
  );
  const validoAte = somarDias(orcamento.data, orcamento.validadeDias);
  // A ÚNICA leitura do snapshot nesta tela — `null` enquanto rascunho (o invariante de banco
  // garante que `orcamento.snapshot` é `null` exatamente quando `vivo`, então nunca chamamos
  // `lerDoSnapshot` à toa).
  const leituraCongelada = vivo ? null : lerDoSnapshot(orcamento.snapshot);

  const linhasResolvidas = orcamento.linhas.map((linha, indice) => {
    if (vivo) {
      return {
        ...linha,
        nomeResolvido: linha.ficha.nome,
        horasMilesimosResolvido: linha.ficha.horasMilesimos,
        resultado: resolverFicha(
          linha.ficha,
          linha.precoUnitarioCentavos,
          parametros,
          forno,
          taxaCartaoPontosBase,
        ),
      };
    }

    const congelada = leituraCongelada!.linhas[indice] ?? LINHA_CONGELADA_EM_BRANCO;
    return {
      ...linha,
      nomeResolvido: congelada.nome,
      horasMilesimosResolvido: congelada.horasMilesimos,
      resultado: resultadoCongelado(congelada, linha.precoUnitarioCentavos),
    };
  });

  const linhasParaContas: LinhaParaContas[] = linhasResolvidas.map((linha) => ({
    nome: linha.nomeResolvido,
    quantidade: linha.quantidade,
    precoUnitarioCentavos: linha.precoUnitarioCentavos,
    horasMilesimos: linha.horasMilesimosResolvido,
    resultado: linha.resultado,
  }));

  // "Atualizar preços" (04.5-09-PLAN.md, D-23): compara peça a peça o mínimo de ANTES (do
  // snapshot, quando congelado — `null` no rascunho, D-23) com o mínimo de HOJE, recalculado com
  // os parâmetros e a ficha ATUAIS pela MESMA cadeia (`resolverFicha`) que a linha viva já usa.
  // Enquanto rascunho, `linhasResolvidas[i].resultado` JÁ é o de hoje — reaproveitado, nunca
  // recalculado duas vezes; congelado, `linha.resultado` ali é o CONGELADO
  // (`resultadoCongelado`), então o de hoje precisa de uma segunda leitura, à parte.
  const linhasParaAtualizar: LinhaParaAtualizar[] = orcamento.linhas.map(
    (linha, indice) => {
      const resultadoDeHoje = vivo
        ? linhasResolvidas[indice].resultado
        : resolverFicha(
            linha.ficha,
            linha.precoUnitarioCentavos,
            parametros,
            forno,
            taxaCartaoPontosBase,
          );

      return {
        linhaId: linha.id,
        nome: linha.ficha.nome,
        precoAtualCentavos: linha.precoUnitarioCentavos,
        minimoDeHojeCentavos: resultadoDeHoje.ok ? resultadoDeHoje.minimoCentavos : 0,
        minimoCongeladoCentavos: vivo
          ? null
          : (leituraCongelada!.linhas[indice]?.minimoCentavos ?? 0),
      };
    },
  );
  const sugestoesDeAtualizacao = sugerirPrecos(linhasParaAtualizar);
  const custosMudaramDesdeOEnvio = algoMudou(sugestoesDeAtualizacao);
  // A contagem de estimados sai dos parâmetros vigentes lidos por `parametrosVigentes` enquanto
  // rascunho — nunca somada por conta própria (key_links do 04.5-07-PLAN.md); congelado, vem do
  // snapshot, exatamente como era no instante do envio (D-21: mudar um parâmetro depois não muda
  // este número).
  const parametrosEstimados = vivo
    ? Object.values(parametrosPorChave).filter((p) => !p.medido).length
    : leituraCongelada!.parametrosEstimados;
  const impostoETaxaPontosBase = vivo
    ? parametros.impostoPontosBase + taxaCartaoPontosBase
    : leituraCongelada!.impostoETaxaPontosBase;

  const contas = contasDoOrcamento(linhasParaContas, {
    custosDeProjeto: orcamento.custosDeProjeto.map((custo) => ({
      valorCentavos: custo.valorCentavos,
    })),
    freteCentavos: orcamento.freteCentavos,
    impostoETaxaPontosBase,
    parametrosEstimados,
  });

  const parcelas = parcelasDoPlano({
    plano: orcamento.plano,
    sinalPercentual: orcamento.sinalPercentual,
    totalCentavos: contas.totalCentavos,
    hoje,
    entregaPrevista: orcamento.entregaPrevista,
  });

  // "Cliente aprovou" (04.5-12-PLAN.md, D-25) — só calculado quando faz sentido abrir o diálogo
  // (status "enviado"). Usa a MESMA `planejarAprovacao` que a transação vai chamar de novo dentro
  // de `aprovarOrcamento` (key_link): o que o dono lê no diálogo é literalmente o que vai ser
  // gravado. `nomeResolvido` aqui é sempre o nome CONGELADO (nunca vivo — só "enviado" chega até
  // aqui, e "enviado" nunca é `vivo`).
  const planoDeAprovacao =
    orcamento.status === "enviado"
      ? planejarAprovacao(
          {
            numero: numeroDeOrcamento(orcamento.ano, orcamento.sequencial),
            titulo: orcamento.titulo,
            plano: orcamento.plano,
            sinalPercentual: orcamento.sinalPercentual,
            freteCentavos: orcamento.freteCentavos,
            entregaPrevista: orcamento.entregaPrevista,
          },
          linhasResolvidas.map((linha) => ({
            nome: linha.nomeResolvido,
            quantidade: linha.quantidade,
            precoUnitarioCentavos: linha.precoUnitarioCentavos,
            cor: linha.cor,
            personalizacao: linha.personalizacao,
          })),
          orcamento.custosDeProjeto.map((custo) => ({
            descricao: custo.descricao,
            valorCentavos: custo.valorCentavos,
          })),
          hoje,
        )
      : null;

  const pecasResolvidas = pecasParaEscolha.map((peca) => {
    const resultado = resolverFicha(peca, null, parametros, forno, taxaCartaoPontosBase);
    return {
      id: peca.id,
      nome: peca.nome,
      minimoCentavos: resultado.ok ? resultado.minimoCentavos : null,
    };
  });

  // "Ver como o cliente vê" (04.5-11-PLAN.md) — `montarDocumentoDoCliente` é a ÚNICA fonte de
  // conteúdo do documento; a estrutura sai daqui com os MESMOS dados que a tela de edição já
  // tem (linhas cruas, custos de projeto, as MESMAS fotos que a grade acima já buscou — nenhuma
  // consulta nova). `VerComoOClienteVe` decide, sozinho e por conta própria, se deve aparecer
  // (`?documento=1`) — este componente é montado SEMPRE, ao lado do editor normal, para a troca
  // de tela ser instantânea (`irParaSemNavegar`, sem chamada nova ao servidor).
  const documentoDoCliente = montarDocumentoDoCliente(
    {
      status: orcamento.status,
      ano: orcamento.ano,
      sequencial: orcamento.sequencial,
      revisao: orcamento.revisao,
      clienteNome: orcamento.clienteNome,
      titulo: orcamento.titulo,
      data: orcamento.data,
      validadeDias: orcamento.validadeDias,
      entregaPrevista: orcamento.entregaPrevista,
      observacoes: orcamento.observacoes,
      plano: orcamento.plano,
      sinalPercentual: orcamento.sinalPercentual,
      freteCentavos: orcamento.freteCentavos,
      snapshot: orcamento.snapshot,
    },
    orcamento.linhas.map((linha) => ({
      nomeDaFicha: linha.ficha.nome,
      cor: linha.cor,
      personalizacao: linha.personalizacao,
      quantidade: linha.quantidade,
      precoUnitarioCentavos: linha.precoUnitarioCentavos,
    })),
    orcamento.custosDeProjeto.map((custo) => ({
      descricao: custo.descricao,
      valorCentavos: custo.valorCentavos,
    })),
    fotos.map((foto) => ({ id: foto.id, legenda: foto.legenda })),
    hoje,
  );

  return (
    <>
      <VerComoOClienteVe orcamentoId={orcamento.id} documento={documentoDoCliente} />
      <div className="flex flex-col gap-4 px-6 py-6 md:px-8">
        <div
          data-testid="orcamento-cabecalho"
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <a
            href="/financeiro?aba=orcamentos"
            className="text-corpo hover:bg-muted flex min-h-[44px] items-center rounded-md px-3"
          >
            {ROTULO_TODOS}
          </a>
          <div className="flex items-center gap-2">
            <span data-testid="orcamento-numero" className="text-corpo text-foreground">
              {`nº ${numeroDeOrcamento(orcamento.ano, orcamento.sequencial)}${rotuloDeRevisao(orcamento.revisao)}`}
            </span>
            <ChipDeSituacao situacao={situacao} />
          </div>
        </div>

        {/* Breakpoint único em 980px (04.5-UI-SPEC.md §Responsivo): uma coluna abaixo, duas a
          partir daí — peças (+ custos do projeto) na esquerda, "Total e pagamento"/"Só para
          você" na direita. */}
        <div className="grid grid-cols-1 items-start gap-4 min-[980px]:grid-cols-[1.15fr_1fr]">
          <div className="flex flex-col gap-4">
            <CabecalhoDoOrcamento
              orcamentoId={orcamento.id}
              vivo={vivo}
              clienteNome={orcamento.clienteNome}
              titulo={orcamento.titulo}
              entregaPrevista={orcamento.entregaPrevista}
              validoAte={validoAte}
              validadeDias={orcamento.validadeDias}
            />

            <section className="border-border flex flex-col gap-3 rounded-lg border p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-titulo text-foreground">{TITULO_BLOCO_PECAS}</h2>
                <span
                  data-testid="orcamento-total-pecas"
                  className="text-corpo text-foreground tabular-nums"
                >
                  {formatarReais(contas.pecasCentavos)}
                </span>
              </div>

              {linhasResolvidas.length === 0 ? (
                <p className="text-apoio text-muted-foreground">
                  {FRASE_VAZIO_PECAS_DO_ORCAMENTO}
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {linhasResolvidas.map((linha) => (
                    <LinhaDeOrcamento
                      key={linha.id}
                      orcamentoId={orcamento.id}
                      id={linha.id}
                      fichaId={linha.fichaId}
                      vivo={vivo}
                      nome={linha.nomeResolvido}
                      quantidade={linha.quantidade}
                      precoUnitarioCentavos={linha.precoUnitarioCentavos}
                      cor={linha.cor}
                      personalizacao={linha.personalizacao}
                      resultado={linha.resultado}
                    />
                  ))}
                </div>
              )}

              {vivo && (
                <div className="flex flex-wrap gap-3">
                  <AbrirEscolherPecaBotao orcamentoId={orcamento.id} />
                  <a
                    href={`/financeiro?aba=orcamentos&orcamento=${orcamento.id}&peca=novo`}
                    className="bg-primary text-primary-foreground hover:bg-primary/80 text-corpo flex min-h-[44px] items-center rounded-md px-4 font-medium"
                  >
                    {ROTULO_MAIS_PECA_EXCLUSIVA}
                  </a>
                  <EscolherPeca orcamentoId={orcamento.id} pecas={pecasResolvidas} />
                </div>
              )}
            </section>

            <section className="border-border flex flex-col gap-3 rounded-lg border p-4">
              <h2 className="text-titulo text-foreground">{TITULO_BLOCO_FOTOS}</h2>
              <p className="text-apoio text-muted-foreground">
                {DICA_FOTOS_DE_REFERENCIA}
              </p>
              <FotosDeReferencia
                orcamentoId={orcamento.id}
                vivo={vivo}
                fotosIniciais={fotos}
              />
            </section>

            <CustosDoProjeto
              orcamentoId={orcamento.id}
              vivo={vivo}
              custos={orcamento.custosDeProjeto}
              freteCentavos={orcamento.freteCentavos}
              plano={orcamento.plano}
              sinalPercentual={orcamento.sinalPercentual}
            />
          </div>

          <div className="flex flex-col gap-4">
            <TotalEPagamento
              orcamentoId={orcamento.id}
              vivo={vivo}
              totalCentavos={contas.totalCentavos}
              plano={orcamento.plano}
              sinalPercentual={orcamento.sinalPercentual}
              freteCentavos={orcamento.freteCentavos}
              observacoes={orcamento.observacoes}
              parcelas={parcelas}
            />
            <SoParaVoce
              custoCentavos={contas.custoCentavos}
              sobraCentavos={contas.sobraCentavos}
              sobraPontosBase={contas.sobraPontosBase}
              horasMilesimos={contas.horasMilesimos}
              fornadasBiscoitoMilesimos={contas.fornadasBiscoitoMilesimos}
              fornadasEsmalteMilesimos={contas.fornadasEsmalteMilesimos}
              parametrosEstimados={contas.parametrosEstimados}
              avisoCongelado={
                vivo ? null : textoAvisoCongelado(formatarDataCurta(orcamento.data))
              }
              revisoes={revisoes.map((revisao) => ({
                revisao: revisao.revisao,
                enviadoEmCivil: revisao.enviadoEmCivil,
                totalCentavos: revisao.totalCentavos,
              }))}
            />

            <AcoesDoOrcamento
              orcamentoId={orcamento.id}
              status={orcamento.status}
              temCliente={Boolean(orcamento.clienteNome?.trim())}
              temPeca={orcamento.linhas.length > 0}
              documentoId={orcamento.documentoId}
              documentoNumero={orcamento.documentoNumero}
              encomendaId={orcamento.encomendaId}
              encomendaStatus={orcamento.encomendaStatus}
              vendaCancelada={orcamento.vendaCancelada}
            />

            {/* Um orçamento aprovado não tem "Atualizar preços" (must_have) — o diálogo nem monta
              nesse status, o mesmo tratamento que `AcoesDoOrcamento` já dá ao botão. */}
            {orcamento.status !== "aprovado" && (
              <DialogoAtualizarPrecos
                orcamentoId={orcamento.id}
                modo={vivo ? "rascunho" : "congelado"}
                sugestoes={sugestoesDeAtualizacao}
                algoMudou={custosMudaramDesdeOEnvio}
                dataCongelamentoFormatada={
                  vivo ? null : formatarDataCurta(orcamento.data)
                }
                novaRevisao={orcamento.revisao + 1}
              />
            )}

            {/* "Cliente aprovou" (04.5-12-PLAN.md) — só monta quando faz sentido abrir
              (`planoDeAprovacao` não é nulo só em "enviado"), mesmo tratamento condicional que
              `DialogoAtualizarPrecos` recebe acima. */}
            {planoDeAprovacao && (
              <DialogoAprovar
                orcamentoId={orcamento.id}
                plano={planoDeAprovacao}
                entregaPrevistaFormatada={formatarDataCurta(orcamento.entregaPrevista)}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

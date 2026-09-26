import { somarDias } from "@/lib/financeiro/calendario";
import { formatarReais } from "@/lib/financeiro/formato";
import { contasDoOrcamento, type LinhaParaContas } from "@/lib/orcamentos/contas";
import type { OrcamentoParaEdicao, PecaParaEscolha } from "@/lib/orcamentos/consultas";
import { numeroDeOrcamento, rotuloDeRevisao } from "@/lib/orcamentos/formato";
import { parcelasDoPlano } from "@/lib/orcamentos/plano";
import {
  FRASE_VAZIO_PECAS_DO_ORCAMENTO,
  ROTULO_CHIP_RASCUNHO,
  ROTULO_MAIS_PECA_EXCLUSIVA,
  ROTULO_TODOS,
  TITULO_BLOCO_PECAS,
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
import { CabecalhoDoOrcamento } from "./cabecalho-do-orcamento";
import { CustosDoProjeto } from "./custos-do-projeto";
import { LinhaDeOrcamento } from "./linha-de-orcamento";
import { SoParaVoce } from "./so-para-voce";
import { TotalEPagamento } from "./total-e-pagamento";

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
    ? farolDoPreco(precoParaFarol, resultadoDireto.minimoCentavos, resultadoDireto.zeroCentavos)
    : null;

  return resultadoDaFicha({ cabem, resultadoDireto, resultadoGaleria, farol });
}

// O editor do orçamento (Server Component — nenhum estado, nenhum efeito próprio; os blocos que
// precisam de estado são componentes cliente separados, montados por linha ou por bloco, mesma
// disciplina do resto do módulo). Metade de cima do orçamento: cabeçalho, "Para quem e para
// quando", "Peças" — a coluna da direita ("Total e pagamento"/"Só para você") fica vazia até o
// plano 07.
export function EditorOrcamento({
  orcamento,
  pecasParaEscolha,
  parametros,
  parametrosPorChave,
  forno,
  taxaCartaoPontosBase,
  hoje,
}: EditorOrcamentoProps) {
  const vivo = orcamento.status === "rascunho";
  const chip = vivo ? ROTULO_CHIP_RASCUNHO : orcamento.status;
  const validoAte = somarDias(orcamento.data, orcamento.validadeDias);

  const linhasCalculadas = orcamento.linhas.map((linha) => ({
    ...linha,
    resultado: resolverFicha(
      linha.ficha,
      linha.precoUnitarioCentavos,
      parametros,
      forno,
      taxaCartaoPontosBase,
    ),
  }));

  const linhasParaContas: LinhaParaContas[] = linhasCalculadas.map((linha) => ({
    nome: linha.ficha.nome,
    quantidade: linha.quantidade,
    precoUnitarioCentavos: linha.precoUnitarioCentavos,
    horasMilesimos: linha.ficha.horasMilesimos,
    resultado: linha.resultado,
  }));
  // A contagem de estimados sai dos parâmetros vigentes lidos por `parametrosVigentes` — nunca
  // somada por conta própria (key_links do 04.5-07-PLAN.md).
  const parametrosEstimados = Object.values(parametrosPorChave).filter((p) => !p.medido).length;

  const contas = contasDoOrcamento(linhasParaContas, {
    custosDeProjeto: orcamento.custosDeProjeto.map((custo) => ({ valorCentavos: custo.valorCentavos })),
    freteCentavos: orcamento.freteCentavos,
    impostoETaxaPontosBase: parametros.impostoPontosBase + taxaCartaoPontosBase,
    parametrosEstimados,
  });

  const parcelas = parcelasDoPlano({
    plano: orcamento.plano,
    sinalPercentual: orcamento.sinalPercentual,
    totalCentavos: contas.totalCentavos,
    hoje,
    entregaPrevista: orcamento.entregaPrevista,
  });

  const pecasResolvidas = pecasParaEscolha.map((peca) => {
    const resultado = resolverFicha(peca, null, parametros, forno, taxaCartaoPontosBase);
    return {
      id: peca.id,
      nome: peca.nome,
      minimoCentavos: resultado.ok ? resultado.minimoCentavos : null,
    };
  });

  return (
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
          <span className="text-apoio bg-muted text-muted-foreground rounded-full px-2 py-0.5">
            {chip}
          </span>
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

            {linhasCalculadas.length === 0 ? (
              <p className="text-apoio text-muted-foreground">{FRASE_VAZIO_PECAS_DO_ORCAMENTO}</p>
            ) : (
              <div className="flex flex-col gap-3">
                {linhasCalculadas.map((linha) => (
                  <LinhaDeOrcamento
                    key={linha.id}
                    orcamentoId={orcamento.id}
                    id={linha.id}
                    fichaId={linha.fichaId}
                    nome={linha.ficha.nome}
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
          />
        </div>
      </div>
    </div>
  );
}

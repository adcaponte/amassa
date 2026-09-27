// RED (TDD): stub temporário para provar que os testes falham antes da implementação real.
import { DIAS_PADRAO, type DuracaoDeEtapa } from "@/lib/encomendas/cronograma";
import { type ParcelaDoPlano, type PlanoDePagamentoDoOrcamento } from "@/lib/orcamentos/plano";

export type LinhaParaAprovacao = {
  nome: string;
  quantidade: number;
  precoUnitarioCentavos: number;
  cor: string | null;
  personalizacao: string | null;
};

export type CustoDeProjetoParaAprovacao = { descricao: string; valorCentavos: number };

export type OrcamentoParaAprovacao = {
  numero: string;
  titulo: string | null;
  plano: PlanoDePagamentoDoOrcamento;
  sinalPercentual: number;
  freteCentavos: number;
  entregaPrevista: string;
};

export type LinhaDaVenda = { descricao: string; quantidade: number; valorCentavos: number };
export type ItemDaEncomenda = { descricao: string; quantidade: number };

export type PlanoDeAprovacao = {
  linhasDaVenda: LinhaDaVenda[];
  totalCentavos: number;
  parcelas: ParcelaDoPlano[];
  nomeDaEncomenda: string;
  itensDaEncomenda: ItemDaEncomenda[];
  etapasDaEncomenda: readonly DuracaoDeEtapa[];
};

export function planejarAprovacao(
  _orcamento: OrcamentoParaAprovacao,
  _linhas: readonly LinhaParaAprovacao[],
  _custosDeProjeto: readonly CustoDeProjetoParaAprovacao[],
  _hoje: string,
): PlanoDeAprovacao {
  return {
    linhasDaVenda: [],
    totalCentavos: 0,
    parcelas: [],
    nomeDaEncomenda: "",
    itensDaEncomenda: [],
    etapasDaEncomenda: DIAS_PADRAO,
  };
}

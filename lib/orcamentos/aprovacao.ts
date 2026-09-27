// Módulo puro (D-14): as ÚNICAS importações de VALOR permitidas aqui são `parcelasDoPlano`
// (`@/lib/orcamentos/plano`) e `DIAS_PADRAO` (`@/lib/encomendas/cronograma`) — as duas de módulos
// puros. O resto é `import type`. Nenhuma leitura do relógio (`hoje`/`entregaPrevista` sempre
// entram por argumento), nenhum React, nenhum cliente de banco.
//
// 🔴 `planejarAprovacao` tem DOIS CONSUMIDORES e UMA ÚNICA VERDADE (D-25, key_link do
// 04.5-12-PLAN.md): `DialogoAprovar` a chama para MOSTRAR exatamente o que vai ser criado, e
// `aprovarOrcamento` (lib/orcamentos/acoes.ts) a chama de novo, DENTRO da transação, para CRIAR de
// verdade. É o que garante que o dono confirmou exatamente o que foi gravado — reimplementar esta
// conta do lado do servidor abriria a porta para o diálogo mentir sobre o que vai acontecer.

import { DIAS_PADRAO, type DuracaoDeEtapa } from "@/lib/encomendas/cronograma";
import {
  parcelasDoPlano,
  type ParcelaDoPlano,
  type PlanoDePagamentoDoOrcamento,
} from "@/lib/orcamentos/plano";

// `encomenda_itens.descricao` (db/schema.ts) aceita até 200 pontos de código — o mesmo teto de
// `lib/orcamentos/esquemas.ts::esquemaLinhaDeOrcamento` (personalização). Truncar aqui garante que
// a encomenda NUNCA falha ao nascer por causa de um texto comprido — a transação inteira (D-25)
// não pode quebrar por um detalhe de rótulo.
const LIMITE_DE_PONTOS_DE_CODIGO_DO_ITEM_DA_ENCOMENDA = 200;

// `documento_linhas.descricao` (db/schema.ts, `lib/financeiro`) aceita até 160 pontos de código —
// um teto MENOR que a soma dos três campos que compõem a descrição de uma peça (nome até 120 +
// cor até 80 + personalização até 200): sem truncar aqui, uma peça muito personalizada — a mais
// especial, a que mais importa acertar — faria a aprovação inteira falhar por causa de um rótulo
// comprido, nunca por causa de dinheiro. Regra 2 (funcionalidade crítica ausente), não pedida
// literalmente pelo `<behavior>` do plano, mas exigida pela restrição real da tabela que recebe
// esta descrição.
const LIMITE_DE_PONTOS_DE_CODIGO_DA_LINHA_DE_VENDA = 160;

// `encomendas.nome` (db/schema.ts) aceita até 120 pontos de código, mas `orcamentos.titulo`
// aceita até 160 — mesma razão do limite acima: truncar em vez de deixar a criação da encomenda
// falhar por causa do título do pedido.
const LIMITE_DE_PONTOS_DE_CODIGO_DO_NOME_DA_ENCOMENDA = 120;

// Trunca em PONTOS DE CÓDIGO (`[...texto]`), nunca em unidades UTF-16 (`String.slice`/`.length`)
// — a mesma disciplina de `lib/orcamentos/esquemas.ts::contarPontosDeCodigo`: cortar por índice de
// UTF-16 poderia partir um caractere composto ao meio. `[...texto]` sempre corta numa fronteira
// segura de ponto de código.
function truncarComSeguranca(texto: string, limite: number): string {
  const pontosDeCodigo = [...texto];
  if (pontosDeCodigo.length <= limite) {
    return texto;
  }
  return pontosDeCodigo.slice(0, limite).join("");
}

// "{nome da peça}" quando não há cor; "{nome da peça} — {cor}" quando há; a personalização entra
// na MESMA descrição, depois da cor, separada por " · " (`<behavior>` do plano, verbatim).
function descricaoDaPeca(nome: string, cor: string | null, personalizacao: string | null): string {
  let descricao = nome;
  if (cor) {
    descricao += ` — ${cor}`;
  }
  if (personalizacao) {
    descricao += ` · ${personalizacao}`;
  }
  return descricao;
}

export type LinhaParaAprovacao = {
  nome: string;
  quantidade: number;
  precoUnitarioCentavos: number;
  cor: string | null;
  personalizacao: string | null;
};

export type CustoDeProjetoParaAprovacao = {
  descricao: string;
  valorCentavos: number;
};

export type OrcamentoParaAprovacao = {
  // Já formatado por quem chama (`numeroDeOrcamento`, `lib/orcamentos/formato.ts`) — este módulo
  // nunca formata número de orçamento: `formato.ts` não é um dos dois módulos puros permitidos
  // aqui (D-14).
  numero: string;
  titulo: string | null;
  plano: PlanoDePagamentoDoOrcamento;
  sinalPercentual: number;
  freteCentavos: number;
  entregaPrevista: string;
};

// Uma linha da venda — `valorCentavos` é o valor da LINHA INTEIRA (quantidade × unitário para uma
// peça; o valor cru para um custo de projeto ou o frete), a MESMA convenção de
// `documentoLinhas.valorCentavos` (D-25/`lib/financeiro/acoes.ts::lancarVenda`) — nunca preço
// unitário.
export type LinhaDaVenda = {
  descricao: string;
  quantidade: number;
  valorCentavos: number;
};

export type ItemDaEncomenda = {
  descricao: string;
  quantidade: number;
};

export type PlanoDeAprovacao = {
  linhasDaVenda: LinhaDaVenda[];
  // Soma exata de `linhasDaVenda` — o total do orçamento, por construção (nunca uma segunda
  // conta independente que poderia divergir).
  totalCentavos: number;
  // De `parcelasDoPlano` (plano 07) — a MESMA função que o documento do cliente (plano 11) usa; a
  // soma delas fecha com `totalCentavos` por construção daquela função, nenhuma nasce paga (o
  // tipo `ParcelaDoPlano` nem tem campo de pagamento).
  parcelas: ParcelaDoPlano[];
  nomeDaEncomenda: string;
  itensDaEncomenda: ItemDaEncomenda[];
  // O cronograma padrão do módulo de Encomendas (D-25: "sem nenhuma alteração") — reexportado
  // daqui para `aprovarOrcamento`/`DialogoAprovar` lerem da MESMA fonte, sem um segundo import
  // direto de `lib/encomendas/cronograma.ts` em cada um.
  etapasDaEncomenda: readonly DuracaoDeEtapa[];
};

// Recebe o orçamento, as linhas já resolvidas (do snapshot, já que aprovar só acontece a partir de
// "enviado" — a tela nunca chama isto com uma linha viva/recalculável), os custos de projeto e o
// "hoje", e devolve o plano inteiro: linhas da venda, parcelas e itens da encomenda.
export function planejarAprovacao(
  orcamento: OrcamentoParaAprovacao,
  linhas: readonly LinhaParaAprovacao[],
  custosDeProjeto: readonly CustoDeProjetoParaAprovacao[],
  hoje: string,
): PlanoDeAprovacao {
  const linhasDaVenda: LinhaDaVenda[] = linhas.map((linha) => ({
    descricao: truncarComSeguranca(
      descricaoDaPeca(linha.nome, linha.cor, linha.personalizacao),
      LIMITE_DE_PONTOS_DE_CODIGO_DA_LINHA_DE_VENDA,
    ),
    quantidade: linha.quantidade,
    valorCentavos: linha.quantidade * linha.precoUnitarioCentavos,
  }));

  for (const custo of custosDeProjeto) {
    linhasDaVenda.push({
      descricao: custo.descricao,
      quantidade: 1,
      valorCentavos: custo.valorCentavos,
    });
  }

  // O frete só vira linha quando maior que zero — frete zero não é uma linha "Frete: R$ 0,00"
  // (`<behavior>` do plano, verbatim).
  if (orcamento.freteCentavos > 0) {
    linhasDaVenda.push({ descricao: "Frete", quantidade: 1, valorCentavos: orcamento.freteCentavos });
  }

  // A soma das linhas da venda é EXATAMENTE o total do orçamento — por construção, nunca uma
  // segunda conta que poderia divergir de `lib/orcamentos/contas.ts::contasDoOrcamento`.
  const totalCentavos = linhasDaVenda.reduce((total, linha) => total + linha.valorCentavos, 0);

  const parcelas = parcelasDoPlano({
    plano: orcamento.plano,
    sinalPercentual: orcamento.sinalPercentual,
    totalCentavos,
    hoje,
    entregaPrevista: orcamento.entregaPrevista,
  });

  // Os itens da encomenda são um por peça, com a MESMA descrição da linha de venda (cor e
  // personalização inclusas) — truncada com segurança para o teto de `encomenda_itens.descricao`
  // (200 pontos de código), separado do teto de 160 de `documento_linhas.descricao` acima.
  const itensDaEncomenda: ItemDaEncomenda[] = linhas.map((linha) => ({
    descricao: truncarComSeguranca(
      descricaoDaPeca(linha.nome, linha.cor, linha.personalizacao),
      LIMITE_DE_PONTOS_DE_CODIGO_DO_ITEM_DA_ENCOMENDA,
    ),
    quantidade: linha.quantidade,
  }));

  // O nome da encomenda é o título do orçamento; vazio (ou só espaços) vira "Orçamento {número}"
  // — nunca vazio, porque o módulo de Encomendas exige nome (`<behavior>` do plano, verbatim).
  const tituloNormalizado = orcamento.titulo?.trim();
  const nomeBase = tituloNormalizado ? tituloNormalizado : `Orçamento ${orcamento.numero}`;
  const nomeDaEncomenda = truncarComSeguranca(
    nomeBase,
    LIMITE_DE_PONTOS_DE_CODIGO_DO_NOME_DA_ENCOMENDA,
  );

  return {
    linhasDaVenda,
    totalCentavos,
    parcelas,
    nomeDaEncomenda,
    itensDaEncomenda,
    // O cronograma da encomenda é o padrão do módulo, sem nenhuma alteração (`<behavior>` do
    // plano, verbatim) — a MESMA constante que `lib/encomendas/acoes.ts::criarEncomenda` recebe
    // do formulário quando ninguém mexe nas 6 etapas.
    etapasDaEncomenda: DIAS_PADRAO,
  };
}

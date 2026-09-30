// Módulo puro (D-14): a ÚNICA importação de VALOR permitida aqui é `parcelasDoPlano`
// (`@/lib/orcamentos/plano`), de módulo puro. O resto é `import type`. Nenhuma leitura do relógio
// (`hoje`/`entregaPrevista` sempre entram por argumento), nenhum React, nenhum cliente de banco.
// Fase 06.1 (plano 03): nada mais vem do módulo antigo de Encomendas — as etapas da ordem nascem
// de `lib/producao/etapas.ts` dentro de `lib/producao/gravacao.ts::criarOrdemDoOrcamento`.
//
// 🔴 `planejarAprovacao` tem DOIS CONSUMIDORES e UMA ÚNICA VERDADE (D-25, key_link do
// 04.5-12-PLAN.md): `DialogoAprovar` a chama para MOSTRAR exatamente o que vai ser criado, e
// `aprovarOrcamento` (lib/orcamentos/acoes.ts) a chama de novo, DENTRO da transação, para CRIAR de
// verdade. É o que garante que o dono confirmou exatamente o que foi gravado — reimplementar esta
// conta do lado do servidor abriria a porta para o diálogo mentir sobre o que vai acontecer.

import {
  parcelasDoPlano,
  type ParcelaDoPlano,
  type PlanoDePagamentoDoOrcamento,
} from "@/lib/orcamentos/plano";

// `ordem_pecas.descricao` (db/schema.ts) aceita até 160 pontos de código. A descrição da peça da
// ordem é SÓ o nome congelado no snapshot — a cor e a personalização têm colunas próprias na peça.
// Truncar aqui garante que a ordem NUNCA falha ao nascer por causa de um nome comprido — a
// transação inteira (D-25) não pode quebrar por um detalhe de rótulo.
const LIMITE_DE_PONTOS_DE_CODIGO_DA_PECA_DA_ORDEM = 160;

// `documento_linhas.descricao` (db/schema.ts, `lib/financeiro`) aceita até 160 pontos de código —
// um teto MENOR que a soma dos três campos que compõem a descrição de uma peça (nome até 120 +
// cor até 80 + personalização até 200): sem truncar aqui, uma peça muito personalizada — a mais
// especial, a que mais importa acertar — faria a aprovação inteira falhar por causa de um rótulo
// comprido, nunca por causa de dinheiro. Regra 2 (funcionalidade crítica ausente), não pedida
// literalmente pelo `<behavior>` do plano, mas exigida pela restrição real da tabela que recebe
// esta descrição.
const LIMITE_DE_PONTOS_DE_CODIGO_DA_LINHA_DE_VENDA = 160;

// `ordens_producao.nome` (db/schema.ts) aceita até 120 pontos de código, mas `orcamentos.titulo`
// aceita até 160 — mesma razão do limite acima: truncar em vez de deixar a criação da ordem
// falhar por causa do título do pedido.
const LIMITE_DE_PONTOS_DE_CODIGO_DO_NOME_DA_ORDEM = 120;

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
  // A ficha da linha (`orcamento_linhas.ficha_id`, obrigatória) — vai para a peça da ordem, que lê
  // as medidas, os gramas e as horas dela ao vivo.
  fichaId: string;
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

// Uma peça da ordem de produção (`ordem_pecas`) — uma por linha do orçamento, na ordem das linhas.
export type PecaDaOrdem = {
  fichaId: string;
  descricao: string;
  quantidade: number;
  cor: string | null;
  personalizacao: string | null;
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
  nomeDaOrdem: string;
  pecasDaOrdem: PecaDaOrdem[];
};

// Recebe o orçamento, as linhas já resolvidas (do snapshot, já que aprovar só acontece a partir de
// "enviado" — a tela nunca chama isto com uma linha viva/recalculável), os custos de projeto e o
// "hoje", e devolve o plano inteiro: linhas da venda, parcelas e as peças da ordem.
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

  // As peças da ordem são uma por linha, na ordem das linhas (custos de projeto e frete não são
  // peça). A descrição é o nome congelado no snapshot; a cor e a personalização vão nos campos
  // próprios da peça, sem concatenar.
  const pecasDaOrdem: PecaDaOrdem[] = linhas.map((linha) => ({
    fichaId: linha.fichaId,
    descricao: truncarComSeguranca(linha.nome, LIMITE_DE_PONTOS_DE_CODIGO_DA_PECA_DA_ORDEM),
    quantidade: linha.quantidade,
    cor: linha.cor,
    personalizacao: linha.personalizacao,
  }));

  // O nome da ordem é o título do orçamento; vazio (ou só espaços) vira "Orçamento {número}" —
  // nunca vazio, porque `ordens_producao.nome` exige de 1 a 120 caracteres.
  const tituloNormalizado = orcamento.titulo?.trim();
  const nomeBase = tituloNormalizado ? tituloNormalizado : `Orçamento ${orcamento.numero}`;
  const nomeDaOrdem = truncarComSeguranca(nomeBase, LIMITE_DE_PONTOS_DE_CODIGO_DO_NOME_DA_ORDEM);

  return {
    linhasDaVenda,
    totalCentavos,
    parcelas,
    nomeDaOrdem,
    pecasDaOrdem,
  };
}

"use client";

import { useEffect, useState } from "react";

import { DICA_PESSOA_TRAVADA, ROTULO_PESSOA_DA_AGENDA } from "@/lib/agenda/textos";
import type { LinhaDaVendaDaAgenda } from "@/lib/agenda/receber";
import { lancarVenda } from "@/lib/financeiro/acoes";
import type { CategoriaParaEscolha, ItemDoCatalogoParaVenda } from "@/lib/financeiro/consultas";
import { repartirDesconto, type Desconto } from "@/lib/financeiro/desconto";
import { converterPercentualParaPontosBase, converterReaisParaCentavos } from "@/lib/financeiro/dinheiro";
import { areasDaVenda, listaEmPortugues } from "@/lib/financeiro/documento";
import {
  efeitoNoEstoque,
  materiaisQueFicamNegativos,
  type ItemParaEfeito,
} from "@/lib/financeiro/efeito-estoque";
import { formatarDataCurta, formatarReais } from "@/lib/financeiro/formato";
import { conferirParcelas, dividirEmDuasFormas, gerarPlano, type PlanoDePagamento } from "@/lib/financeiro/parcelas";
import { CHAVE_RASCUNHO_VENDA, lerRascunho, serializarRascunho, type LinhaDoRascunho } from "@/lib/financeiro/rascunho";
import { FRASE_LINHA_DA_QUEIMA_FALTANDO } from "@/lib/queimas/textos";
import {
  FRASE_VAZIO_VENDA,
  PLACEHOLDER_PESSOA_VENDA,
  ROTULO_AREA,
  ROTULO_DATA,
  ROTULO_LANCAR_VENDA,
  ROTULO_LIMPAR,
  ROTULO_LISTA_COMPLETA_E_ATALHOS,
  ROTULO_PESSOA_OPCIONAL,
  ROTULO_VALOR_LIVRE,
  TITULO_ESTA_VENDA,
  TITULO_O_QUE_FOI_VENDIDO,
  textoDataRetroativa,
  textoAvisoVendaNegativa,
  textoDicaDeAreas,
  type FormaDePagamento,
} from "@/lib/financeiro/textos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BlocoPagamento, type ParcelaDoBloco } from "./bloco-pagamento";
import { CampoDesconto, type ModoDeDesconto } from "./campo-desconto";
import { DialogoValorLivre, type LinhaDeValorLivre } from "./dialogo-valor-livre";
import { EfeitoEstoque } from "./efeito-estoque";
import { FaixaDaAgenda, FaixaDasQueimas } from "./faixa-da-agenda";
import { GradeCatalogo, type FiltroDeArea } from "./grade-catalogo";
import { LinhaCarrinho, type LinhaDoCarrinho } from "./linha-carrinho";
import { ListaCompleta } from "./lista-completa";
import { rotaDeGestao } from "@/lib/rotas/gestao";

const FORMAS_EM_ORDEM: readonly FormaDePagamento[] = ["dinheiro", "pix", "cartao"];

type LinhaLocal =
  | {
      chave: string;
      tipo: "item";
      itemId: string;
      nome: string;
      area: string;
      quantidade: number;
      valorUnitarioTexto: string;
      precoDeTabelaCentavos: number | null;
      // Uma linha da origem (Fase 06.4, plano 05 — antes `daAgenda`). Na Agenda, a PRIMEIRA linha do item
      // do sistema da cobrança — sem o “tirar”, nunca abaixo de 1 (UI-D26). Nas Queimas, toda linha de um
      // dos três itens “Queima externa P/M/G” — removível, com a quantidade editável (D-07, UI-D30).
      daOrigem?: boolean;
    }
  | {
      chave: string;
      tipo: "livre";
      descricao: string;
      categoriaId: string;
      area: string;
      valorCentavos: number;
    };

type LinhaComValidade = LinhaDoCarrinho & { valido: boolean };

function novaChave(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Um valor em centavos vira texto com vírgula decimal — o mesmo formato que
// `converterReaisParaCentavos` (lib/financeiro/dinheiro.ts) sabe ler de volta no servidor.
function centavosParaTexto(centavos: number): string {
  return (centavos / 100).toFixed(2).replace(".", ",");
}

// A Venda aberta por outro módulo — a Agenda (Fase 05, plano 12 — AGE-15, UI-D26) ou as Queimas (Fase
// 06.4, plano 05 — QMC-08, D-07). Tudo resolvido no SERVIDOR pela página (`cobrancaParaVenda` ×
// `queimaParaVenda`): o texto da origem (devolvido a `lancarVenda`, que relê a origem sob a trava do
// módulo dono dela), a faixa, e o “Vence em” do à vista em aberto. `modulo` é a ÚNICA decisão do painel
// sobre a origem — nenhum outro `if` sobre o tipo de cobrança entra aqui.
export type OrigemNoPainel = {
  modulo: "agenda" | "queimas";
  origem: string;
  // Agenda: a descrição da cobrança (a faixa “Da Agenda · {descrição} · {nome}”). Queimas: o título da
  // faixa, pronto (“Das Queimas · {Tipo} de {dd/mm} · {forno}”).
  descricao: string;
  // Agenda: o cliente da cobrança (a pessoa travada). Queimas: `null` (a queima externa não tem cliente).
  nome: string | null;
  // Agenda: o vencimento da mensalidade; a data do evento ou do uso. Queimas: hoje.
  vencimento: string;
  // Agenda: `[itemDoSistemaId]` — a linha de origem é a primeira com este item. Queimas: os três itens.
  itensDaOrigem: string[];
};

// O carrinho com que a Venda da origem começa: a pessoa (travada na Agenda; vazia e livre nas Queimas) e
// as linhas da origem.
export type RascunhoInicialDaVenda = {
  pessoa: string;
  linhas: readonly LinhaDaVendaDaAgenda[];
};

// As linhas da cobrança viram linhas do carrinho: a de origem mostra a descrição da cobrança (o servidor
// grava a mesma) e não leva “tabela R$” (o valor é o da cobrança, quantidade 1 — no uso livre, as horas
// todas); o material cobrado do uso livre entra como linha livre, removível como qualquer outra.
function linhasDoRascunhoInicial(
  rascunho: RascunhoInicialDaVenda,
  origem: OrigemNoPainel,
  catalogo: readonly ItemDoCatalogoParaVenda[],
  categorias: readonly CategoriaParaEscolha[],
): LinhaLocal[] {
  const areaDoItem = new Map<string, string>(catalogo.map((item) => [item.id, item.area]));
  const areaDaCategoria = new Map<string, string>(categorias.map((categoria) => [categoria.id, categoria.area]));
  const itensDaOrigem = new Set(origem.itensDaOrigem);
  let origemMarcada = false;
  return rascunho.linhas.map((linha, indice): LinhaLocal => {
    const chave = `${origem.modulo}-${indice}`;
    if (linha.tipo === "item") {
      // Agenda: só a PRIMEIRA linha do item do sistema. Queimas: toda linha dos três itens.
      const daOrigem = itensDaOrigem.has(linha.itemId) && (origem.modulo === "queimas" || !origemMarcada);
      origemMarcada ||= daOrigem;
      return {
        chave,
        tipo: "item",
        itemId: linha.itemId,
        nome: linha.descricao,
        area: areaDoItem.get(linha.itemId) ?? "geral",
        quantidade: linha.quantidade,
        valorUnitarioTexto: centavosParaTexto(Math.round(linha.valorCentavos / linha.quantidade)),
        precoDeTabelaCentavos: null,
        daOrigem,
      };
    }
    return {
      chave,
      tipo: "livre",
      descricao: linha.descricao,
      categoriaId: linha.categoriaId,
      area: areaDaCategoria.get(linha.categoriaId) ?? "geral",
      valorCentavos: linha.valorCentavos,
    };
  });
}

export type PainelVendaProps = {
  hoje: string;
  categorias: CategoriaParaEscolha[];
  catalogo: ItemDoCatalogoParaVenda[];
  itensParaEfeito: ItemParaEfeito[];
  configuracao: { taxaCartaoPontosBase: number; dataSaldoInicial: string | null };
  // Plano 06-08 (D-21): o saldo de cada material antes da venda (`listarSaldos`); `null` quando a
  // consulta do Estoque falhou — o painel fica como era, sem "fica com" e sem aviso.
  saldos?: ReadonlyMap<string, number> | null;
  // Fase 05, plano 12 (Agenda) e Fase 06.4, plano 05 (Queimas): a Venda aberta por outro módulo. Sem os
  // dois, o painel é a Venda manual de sempre.
  origem?: OrigemNoPainel | null;
  rascunhoInicial?: RascunhoInicialDaVenda | null;
};

// O painel de venda completo (04.4-03-PLAN.md, 04.4-06-PLAN.md): catálogo com atalhos/busca/lista
// completa, valor livre, quantidade e preço editável, dica de múltiplas áreas, data retroativa, o
// pagamento (à vista, sinal, 2x a 12x, "+ outra forma" e o aviso do cartão) e o efeito no estoque.
// O rascunho sobrevive a trocar de aba/recarregar via `lib/financeiro/rascunho.ts`, na mesma aba
// do navegador — o PAGAMENTO fica de fora do rascunho de propósito: mudar de aba e voltar não
// deve reencontrar parcelas geradas para um total que já mudou.
export function PainelVenda({
  hoje,
  categorias,
  catalogo,
  itensParaEfeito,
  configuracao,
  saldos = null,
  origem = null,
  rascunhoInicial = null,
}: PainelVendaProps) {
  // A Venda da origem começa DIRETO do carrinho da origem (calculado já na renderização do servidor —
  // nada de piscar o carrinho em montagem antes, Pitfall 10), com o à vista EM ABERTO vencendo no dia da
  // cobrança (UI-D26). Agenda: a pessoa travada. Queimas: a pessoa vazia e livre (UI-D13).
  const comOrigem = origem !== null && rascunhoInicial !== null;
  const daAgenda = comOrigem && origem.modulo === "agenda";
  const dasQueimas = comOrigem && origem.modulo === "queimas";
  const linhasDaOrigem = (): LinhaLocal[] =>
    origem !== null && rascunhoInicial !== null
      ? linhasDoRascunhoInicial(rascunhoInicial, origem, catalogo, categorias)
      : [];
  const [dialogoValorLivreAberto, setDialogoValorLivreAberto] = useState(false);
  const [dialogoListaAberto, setDialogoListaAberto] = useState(false);
  const [linhas, setLinhas] = useState<LinhaLocal[]>(linhasDaOrigem);
  const [data, setData] = useState(hoje);
  const [pessoa, setPessoa] = useState(rascunhoInicial?.pessoa ?? "");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroDeArea>("tudo");
  const [descontoModo, setDescontoModo] = useState<ModoDeDesconto>("reais");
  const [descontoTexto, setDescontoTexto] = useState("");
  const [plano, setPlano] = useState<PlanoDePagamento>("avista");
  const [formaPagamento, setFormaPagamento] = useState<FormaDePagamento>("pix");
  const [duasFormas, setDuasFormas] = useState(false);
  // A INTENÇÃO do dono sobre o à vista de uma parcela só (04.4-12-PLAN.md): nasce marcada (o caso
  // comum continua um toque só) e sobrevive à regeneração do plano quando o carrinho, a data ou o
  // plano mudam — é por isso que ela mora em estado PRÓPRIO, fora de `parcelasPagamento` (que é
  // recriado do zero a cada regeneração).
  const [pagoAVista, setPagoAVista] = useState(!comOrigem);
  // O "Vence em" digitado à mão para o à vista em aberto — `null` até o dono editar o campo (a
  // parcela então vence na data do documento, o padrão de `gerarPlano`). Sobrevive à regeneração
  // do plano pela MESMA razão de `pagoAVista`: mudar o carrinho não deve apagar uma data já
  // escolhida (04.4-12-PLAN.md).
  const [vencimentoAvistaAberto, setVencimentoAvistaAberto] = useState<string | null>(
    origem?.vencimento ?? null,
  );
  const [parcelasPagamento, setParcelasPagamento] = useState<ParcelaDoBloco[]>([]);
  const [erroDoPlano, setErroDoPlano] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [rascunhoCarregado, setRascunhoCarregado] = useState(false);
  // Havia uma venda em montagem no rascunho comum quando a Venda da origem abriu (a linha da faixa).
  const [haviaVendaEmMontagem, setHaviaVendaEmMontagem] = useState(false);

  // Lê o rascunho UMA vez, ao montar — com os ids do catálogo JÁ carregado, para descartar linha
  // de item que sumiu (lerRascunho). Nunca sobrescreve um rascunho vazio por cima de nada.
  //
  // Com uma origem (Pitfall 10 — Agenda e Queimas): o rascunho comum é LIDO só para saber se havia uma
  // venda em montagem — nunca aplicado, nunca regravado (`rascunhoCarregado` fica falso, e o efeito de
  // gravar abaixo não roda). A venda em montagem fica intacta e volta quando a Venda abrir sem origem.
  useEffect(() => {
    if (comOrigem) {
      const guardado = window.sessionStorage.getItem(CHAVE_RASCUNHO_VENDA) ?? "";
      setHaviaVendaEmMontagem(lerRascunho(guardado, catalogo.map((item) => item.id)).linhas.length > 0);
      return;
    }
    const texto = window.sessionStorage.getItem(CHAVE_RASCUNHO_VENDA) ?? "";
    const catalogoPorId = new Map(catalogo.map((item) => [item.id, item]));
    const categoriaPorId = new Map(categorias.map((categoria) => [categoria.id, categoria]));
    const lido = lerRascunho(texto, catalogo.map((item) => item.id));

    if (lido.data) {
      setData(lido.data);
    }
    if (lido.pessoa) {
      setPessoa(lido.pessoa);
    }
    if (lido.desconto) {
      setDescontoModo(lido.desconto.modo);
      setDescontoTexto(lido.desconto.texto);
    }
    if (lido.linhas.length > 0) {
      const linhasReconstruidas: LinhaLocal[] = lido.linhas.flatMap((linha): LinhaLocal[] => {
        if (linha.tipo === "item") {
          const item = catalogoPorId.get(linha.itemId);
          if (!item) {
            return [];
          }
          return [
            {
              chave: novaChave(),
              tipo: "item",
              itemId: item.id,
              nome: item.nome,
              area: item.area,
              quantidade: linha.quantidade,
              valorUnitarioTexto: linha.valorUnitarioTexto,
              precoDeTabelaCentavos: item.precoVendaCentavos,
            },
          ];
        }
        const categoria = categoriaPorId.get(linha.categoriaId);
        const resultado = converterReaisParaCentavos(linha.valorTexto);
        return [
          {
            chave: novaChave(),
            tipo: "livre",
            descricao: linha.descricao,
            categoriaId: linha.categoriaId,
            area: categoria?.area ?? "geral",
            valorCentavos: resultado.ok && resultado.centavos ? resultado.centavos : 0,
          },
        ];
      });
      setLinhas(linhasReconstruidas);
    }
    setRascunhoCarregado(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Grava o rascunho a cada mudança — só depois da leitura inicial, para não sobrescrever o
  // rascunho gravado com o estado inicial vazio antes de ele ter sido lido.
  useEffect(() => {
    if (!rascunhoCarregado) {
      return;
    }
    const linhasParaGravar: LinhaDoRascunho[] = linhas.map((linha) =>
      linha.tipo === "item"
        ? {
            tipo: "item",
            itemId: linha.itemId,
            quantidade: linha.quantidade,
            valorUnitarioTexto: linha.valorUnitarioTexto,
          }
        : {
            tipo: "livre",
            descricao: linha.descricao,
            categoriaId: linha.categoriaId,
            valorTexto: centavosParaTexto(linha.valorCentavos),
          },
    );
    window.sessionStorage.setItem(
      CHAVE_RASCUNHO_VENDA,
      serializarRascunho({
        data,
        pessoa,
        linhas: linhasParaGravar,
        desconto: descontoTexto.trim() !== "" ? { modo: descontoModo, texto: descontoTexto } : null,
      }),
    );
  }, [linhas, data, pessoa, descontoModo, descontoTexto, rascunhoCarregado]);

  // Cada linha convertida para exibição, ANTES do desconto: subtotal e validade (item precisa de
  // valor > 0).
  const linhasBase: LinhaComValidade[] = linhas.map((linha) => {
    if (linha.tipo === "livre") {
      return {
        chave: linha.chave,
        tipo: "livre" as const,
        nome: linha.descricao,
        area: linha.area,
        subtotalCentavos: linha.valorCentavos,
        subtotalAntesDoDescontoCentavos: linha.valorCentavos,
        valido: true,
      };
    }
    const resultado = converterReaisParaCentavos(linha.valorUnitarioTexto);
    const valorUnitarioCentavos = resultado.ok ? resultado.centavos : null;
    const valido = valorUnitarioCentavos != null && valorUnitarioCentavos > 0;
    const subtotalAntesDoDescontoCentavos = valido ? valorUnitarioCentavos * linha.quantidade : 0;
    return {
      chave: linha.chave,
      tipo: "item" as const,
      nome: linha.nome,
      area: linha.area,
      quantidade: linha.quantidade,
      valorUnitarioTexto: linha.valorUnitarioTexto,
      valorUnitarioCentavos,
      subtotalCentavos: subtotalAntesDoDescontoCentavos,
      subtotalAntesDoDescontoCentavos,
      precoDeTabelaCentavos: linha.precoDeTabelaCentavos,
      valido,
    };
  });

  const todasValidas = linhasBase.every((linha) => linha.valido);
  // A linha de origem da Venda da Agenda (sem o “tirar”, nunca abaixo de 1). Nas Queimas nenhuma linha é
  // fixa: tirar pode, desde que reste uma linha de queima externa (conferido ao lançar).
  const chavesFixas = new Set(
    daAgenda ? linhas.flatMap((linha) => (linha.tipo === "item" && linha.daOrigem ? [linha.chave] : [])) : [],
  );
  // Nas Queimas, uma linha de queima é qualquer linha de um dos três itens — inclusive uma posta de novo
  // pelo catálogo depois de tirada.
  const itensDaOrigem = new Set(origem?.itensDaOrigem ?? []);
  const restaLinhaDaQueima = linhas.some((linha) => linha.tipo === "item" && itensDaOrigem.has(linha.itemId));

  // Desconto (D-09/D-10, Tarefa 3) — a MESMA `repartirDesconto` do servidor, chamada aqui só
  // para MOSTRAR (o servidor refaz a conta do zero, nunca aceita o resultado do cliente).
  let descontoErro: string | null = null;
  let valoresFinaisCentavos = linhasBase.map((linha) => linha.subtotalAntesDoDescontoCentavos);

  if (descontoTexto.trim() !== "") {
    let descontoConvertido: Desconto | null = null;
    if (descontoModo === "reais") {
      const resultado = converterReaisParaCentavos(descontoTexto);
      if (!resultado.ok) {
        descontoErro = resultado.erro;
      } else if (resultado.centavos === null) {
        descontoErro = "Informe um valor de desconto.";
      } else {
        descontoConvertido = { modo: "reais", centavos: resultado.centavos };
      }
    } else {
      const resultado = converterPercentualParaPontosBase(descontoTexto);
      if (!resultado.ok) {
        descontoErro = resultado.erro;
      } else {
        descontoConvertido = { modo: "percentual", pontosBase: resultado.pontosBase };
      }
    }

    if (descontoConvertido && todasValidas) {
      const resultadoDesconto = repartirDesconto(valoresFinaisCentavos, descontoConvertido);
      if (!resultadoDesconto.ok) {
        descontoErro = resultadoDesconto.erro;
      } else {
        valoresFinaisCentavos = resultadoDesconto.valoresFinais;
      }
    }
  }

  const linhasParaExibir: LinhaComValidade[] = linhasBase.map((linha, indice) => ({
    ...linha,
    subtotalCentavos: valoresFinaisCentavos[indice],
  }));

  const totalCentavos = valoresFinaisCentavos.reduce((total, valor) => total + valor, 0);

  // O plano de pagamento (04.4-06-PLAN.md) regenera do zero sempre que o TOTAL, a DATA ou o
  // PLANO mudam — "mudar linhas, data ou plano gera as parcelas de novo" (must_have do plano):
  // qualquer edição manual de uma parcela some nessa hora, inclusive a divisão "+ outra forma".
  // `pagoAVista` é lido de DENTRO do efeito, de propósito FORA da lista de dependências (mesma
  // exceção de `exhaustive-deps` já usada aqui): a regeneração usa a intenção CORRENTE do dono,
  // mas alternar a caixinha (`mudarPagoAVista` abaixo) nunca dispara este efeito sozinho — é
  // exatamente isso que faz o carrinho mudar sem remarcar a caixinha (04.4-12-PLAN.md). Trocar só
  // a FORMA (`mudarFormaPagamento` abaixo) também não passa por aqui — ela só re-rotula as
  // parcelas já existentes, sem mexer em data/valor.
  useEffect(() => {
    if (totalCentavos <= 0) {
      setParcelasPagamento([]);
      setErroDoPlano(null);
      setDuasFormas(false);
      return;
    }
    const resultado = gerarPlano({ plano, totalCentavos, data, forma: formaPagamento, pagaAVista: pagoAVista });
    setDuasFormas(false);
    if (!resultado.ok) {
      setParcelasPagamento([]);
      setErroDoPlano(resultado.erro);
      return;
    }
    setErroDoPlano(null);
    setParcelasPagamento(
      resultado.parcelas.map((parcela, indice) => ({
        // A parcela 0 do à vista EM ABERTO usa o "Vence em" já digitado, se houver — é isso que
        // faz mudar o carrinho não apagar uma data escolhida (04.4-12-PLAN.md).
        vencimento:
          indice === 0 && plano === "avista" && !pagoAVista && vencimentoAvistaAberto
            ? vencimentoAvistaAberto
            : parcela.vencimento,
        valorTexto: centavosParaTexto(parcela.valorCentavos),
        forma: parcela.forma,
        pago: parcela.paga,
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plano, totalCentavos, data]);

  function mudarFormaPagamento(nova: FormaDePagamento) {
    setFormaPagamento(nova);
    if (!duasFormas) {
      setParcelasPagamento((atual) => atual.map((parcela) => ({ ...parcela, forma: nova })));
    }
  }

  // A caixinha "Já recebi" do à vista de uma parcela só: grava a INTENÇÃO e marca/desmarca a
  // própria parcela nos dois sentidos — nunca dispara a regeneração do plano (04.4-12-PLAN.md).
  function mudarPagoAVista(pago: boolean) {
    setPagoAVista(pago);
    setParcelasPagamento((atual) =>
      atual.map((parcela, indice) => (indice === 0 ? { ...parcela, pago } : parcela)),
    );
  }

  function ativarOutraForma() {
    const outraForma = FORMAS_EM_ORDEM.find((valor) => valor !== formaPagamento) ?? "dinheiro";
    // Semeia as duas linhas com a intenção ATUAL do à vista (04.4-12-PLAN.md) — depois de
    // dividida, cada linha vira independente (a caixa de marcação da grade cuida disso).
    const resultado = dividirEmDuasFormas({
      totalCentavos,
      primeiroValorCentavos: Math.ceil(totalCentavos / 2),
      data,
      formas: [formaPagamento, outraForma],
      pagas: [pagoAVista, pagoAVista],
    });
    if (!resultado.ok) {
      setErroDoPlano(resultado.erro);
      return;
    }
    setErroDoPlano(null);
    setDuasFormas(true);
    setParcelasPagamento(
      resultado.parcelas.map((parcela) => ({
        vencimento: parcela.vencimento,
        valorTexto: centavosParaTexto(parcela.valorCentavos),
        forma: parcela.forma,
        pago: parcela.paga,
      })),
    );
  }

  function tirarOutraForma() {
    const resultado = gerarPlano({
      plano: "avista",
      totalCentavos,
      data,
      forma: formaPagamento,
      pagaAVista: pagoAVista,
    });
    setDuasFormas(false);
    if (!resultado.ok) {
      setErroDoPlano(resultado.erro);
      setParcelasPagamento([]);
      return;
    }
    setErroDoPlano(null);
    setParcelasPagamento(
      resultado.parcelas.map((parcela) => ({
        vencimento: !pagoAVista && vencimentoAvistaAberto ? vencimentoAvistaAberto : parcela.vencimento,
        valorTexto: centavosParaTexto(parcela.valorCentavos),
        forma: parcela.forma,
        pago: parcela.paga,
      })),
    );
  }

  function mudarParcela(indice: number, alteracao: Partial<ParcelaDoBloco>) {
    if (indice === 0 && alteracao.vencimento !== undefined) {
      setVencimentoAvistaAberto(alteracao.vencimento);
    }
    setParcelasPagamento((atual) =>
      atual.map((parcela, i) => (i === indice ? { ...parcela, ...alteracao } : parcela)),
    );
  }

  // A MESMA `conferirParcelas` que `BlocoPagamento` chama para MOSTRAR a falta/sobra — chamada
  // aqui de novo só para decidir se "Lançar venda" habilita (o painel é quem controla o estado,
  // BlocoPagamento decide só rótulos e o aviso do cartão).
  const parcelasPagamentoConvertidas = parcelasPagamento.map((parcela) => {
    const resultado = converterReaisParaCentavos(parcela.valorTexto);
    return {
      vencimento: parcela.vencimento,
      valorCentavos: resultado.ok && resultado.centavos ? resultado.centavos : 0,
      pago: parcela.pago,
    };
  });
  const conferenciaDoPagamento =
    !erroDoPlano && parcelasPagamentoConvertidas.length > 0
      ? conferirParcelas({
          totalCentavos,
          parcelas: parcelasPagamentoConvertidas,
          hoje,
          dataSaldoInicial: configuracao.dataSaldoInicial,
        })
      : null;

  const podeLancar =
    linhas.length > 0 &&
    todasValidas &&
    !descontoErro &&
    !erroDoPlano &&
    (conferenciaDoPagamento?.ok ?? false) &&
    !enviando;

  const areas = areasDaVenda(linhas.map((linha) => ({ area: linha.area })));
  const nomesDeAreas = areas.map((area) => ROTULO_AREA[area as keyof typeof ROTULO_AREA] ?? area);

  const efeito = efeitoNoEstoque(
    linhas.map((linha) =>
      linha.tipo === "item"
        ? { itemId: linha.itemId, quantidade: linha.quantidade }
        : { itemId: null, quantidade: 1 },
    ),
    itensParaEfeito,
    "venda",
  );
  // D-21/D-06: o aviso de negativo é só informação — a condição de habilitar "Lançar venda"
  // (`podeLancar`, acima) NÃO olha para isto.
  const materiaisNegativos = materiaisQueFicamNegativos(efeito, saldos);

  function tocarItemDoCatalogo(item: ItemDoCatalogoParaVenda) {
    setLinhas((atual) => {
      const existente = atual.find((linha) => linha.tipo === "item" && linha.itemId === item.id);
      if (existente) {
        return atual.map((linha) =>
          linha === existente && linha.tipo === "item"
            ? { ...linha, quantidade: linha.quantidade + 1 }
            : linha,
        );
      }
      return [
        ...atual,
        {
          chave: novaChave(),
          tipo: "item",
          itemId: item.id,
          nome: item.nome,
          area: item.area,
          quantidade: 1,
          valorUnitarioTexto: item.precoVendaCentavos != null ? centavosParaTexto(item.precoVendaCentavos) : "",
          precoDeTabelaCentavos: item.precoVendaCentavos,
        },
      ];
    });
  }

  function adicionarLinhaLivre(linha: LinhaDeValorLivre) {
    setLinhas((atual) => [
      ...atual,
      {
        chave: novaChave(),
        tipo: "livre",
        descricao: linha.descricao,
        categoriaId: linha.categoriaId,
        area: linha.area,
        valorCentavos: linha.valorCentavos,
      },
    ]);
    setDialogoValorLivreAberto(false);
  }

  function mudarQuantidade(chave: string, delta: 1 | -1) {
    setLinhas((atual) =>
      atual.flatMap((linha) => {
        if (linha.chave !== chave || linha.tipo !== "item") {
          return [linha];
        }
        const novaQuantidade = linha.quantidade + delta;
        if (novaQuantidade < 1) {
          // A linha que veio da Agenda não sai da venda (UI-D26); o servidor recusa do mesmo jeito.
          return daAgenda && linha.daOrigem ? [linha] : [];
        }
        return [{ ...linha, quantidade: novaQuantidade }];
      }),
    );
  }

  function mudarValorUnitario(chave: string, valor: string) {
    setLinhas((atual) =>
      atual.map((linha) => (linha.chave === chave && linha.tipo === "item" ? { ...linha, valorUnitarioTexto: valor } : linha)),
    );
  }

  function tirarLinha(chave: string) {
    setLinhas((atual) =>
      atual.filter(
        (linha) => linha.chave !== chave || (daAgenda && linha.tipo === "item" && linha.daOrigem === true),
      ),
    );
  }

  function limpar() {
    // Na Venda da origem, “Limpar” volta ao carrinho da origem (a linha de origem não sai) e NÃO toca no
    // rascunho comum — a venda em montagem continua guardada (Pitfall 10).
    setLinhas(linhasDaOrigem());
    setData(hoje);
    setPessoa(rascunhoInicial?.pessoa ?? "");
    setBusca("");
    setFiltro("tudo");
    setDescontoModo("reais");
    setDescontoTexto("");
    setErro(null);
    setPlano("avista");
    setFormaPagamento("pix");
    setDuasFormas(false);
    setPagoAVista(!comOrigem);
    setVencimentoAvistaAberto(origem?.vencimento ?? null);
    setParcelasPagamento([]);
    setErroDoPlano(null);
    if (!comOrigem) {
      window.sessionStorage.removeItem(CHAVE_RASCUNHO_VENDA);
    }
  }

  async function aoLancar() {
    setErro(null);
    // Nas Queimas, a venda precisa levar ao menos uma linha de queima externa (o servidor confere de novo,
    // e também que nenhum tamanho passa do que falta agora — essa conta fica só lá).
    if (dasQueimas && !restaLinhaDaQueima) {
      setErro(FRASE_LINHA_DA_QUEIMA_FALTANDO);
      return;
    }
    setEnviando(true);

    const resposta = await lancarVenda({
      data,
      pessoa: pessoa.trim() === "" ? undefined : pessoa,
      linhas: linhas.map((linha) =>
        linha.tipo === "item"
          ? {
              tipo: "item" as const,
              itemId: linha.itemId,
              quantidade: linha.quantidade,
              valorUnitarioTexto: linha.valorUnitarioTexto,
            }
          : {
              tipo: "livre" as const,
              descricao: linha.descricao,
              categoriaId: linha.categoriaId,
              valorTexto: centavosParaTexto(linha.valorCentavos),
            },
      ),
      // O plano de pagamento inteiro (à vista, sinal, Nx ou "+ outra forma") — cada parcela já
      // com a própria forma (D-07), gerado por `gerarPlano`/`dividirEmDuasFormas` e editável à
      // mão pelo bloco de pagamento.
      parcelas: parcelasPagamento.map((parcela) => ({
        vencimento: parcela.vencimento,
        valorTexto: parcela.valorTexto,
        forma: parcela.forma,
        pago: parcela.pago,
      })),
      ...(descontoTexto.trim() !== "" ? { desconto: { modo: descontoModo, texto: descontoTexto } } : {}),
      // Só QUAL origem: na Agenda o servidor sobrescreve pessoa, cliente e a descrição da linha de origem;
      // nas Queimas ele relê o que falta sob a trava e tira as quantidades do vínculo destas linhas.
      ...(origem !== null && comOrigem ? { origem: origem.origem } : {}),
    });

    setEnviando(false);

    if (!resposta.ok) {
      setErro(resposta.erro);
      return;
    }

    if (daAgenda) {
      // A volta à Agenda (UI-D26): “A receber” mostra o toast uma vez. O rascunho comum NÃO é apagado —
      // a venda que estava em montagem continua guardada (Pitfall 10).
      window.location.assign(rotaDeGestao(`/agenda?aba=receber&aviso=lancado&documento=${resposta.dados.id}`));
      return;
    }

    if (dasQueimas) {
      // A volta às Queimas: o índice mostra o aviso uma vez (lido no servidor: o número e se saiu paga) e o
      // que ainda falta continua em “a cobrar”. O rascunho comum NÃO é apagado (Pitfall 10).
      window.location.assign(rotaDeGestao(`/queimas?aviso=lancado&documento=${resposta.dados.id}`));
      return;
    }

    window.sessionStorage.removeItem(CHAVE_RASCUNHO_VENDA);
    // Navegação completa de propósito (nunca `router.push`/`router.refresh`) — a página resolve
    // o aviso no servidor a partir de `?aviso=lancado&documento=<id>`.
    window.location.assign(rotaDeGestao(`/financeiro?aba=venda&aviso=lancado&documento=${resposta.dados.id}`));
  }

  const painel = (
    <div className="grid grid-cols-1 gap-6 px-6 py-6 md:grid-cols-[1.15fr_1fr] md:px-8">
      <section className="border-border bg-card flex flex-col gap-4 rounded-lg border p-4">
        <h2 className="text-titulo text-foreground">{TITULO_O_QUE_FOI_VENDIDO}</h2>

        <GradeCatalogo
          catalogo={catalogo}
          busca={busca}
          aoMudarBusca={setBusca}
          filtro={filtro}
          aoMudarFiltro={setFiltro}
          aoTocarItem={tocarItemDoCatalogo}
        />

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px]"
            onClick={() => setDialogoListaAberto(true)}
          >
            {ROTULO_LISTA_COMPLETA_E_ATALHOS}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px]"
            onClick={() => setDialogoValorLivreAberto(true)}
          >
            {ROTULO_VALOR_LIVRE}
          </Button>
        </div>
      </section>

      <section className="border-border bg-card flex flex-col gap-4 rounded-lg border p-4">
        <h2 className="text-titulo text-foreground">{TITULO_ESTA_VENDA}</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="text-apoio text-muted-foreground flex flex-col gap-1">
            {ROTULO_DATA}
            <Input
              type="date"
              value={data}
              onChange={(evento) => setData(evento.target.value)}
              className="text-corpo min-h-[44px]"
            />
          </label>
          {daAgenda ? (
            // A pessoa TRAVADA (UI-D26): só leitura, com a dica. O nome inteiro rola dentro do campo; o
            // servidor grava o nome do cliente da cobrança de qualquer jeito (T-05-58).
            <label className="text-apoio text-muted-foreground flex min-w-0 flex-col gap-1">
              {ROTULO_PESSOA_DA_AGENDA}
              <Input
                data-testid="pessoa-travada"
                value={pessoa}
                readOnly
                aria-describedby="pessoa-travada-dica"
                onChange={(evento) => setPessoa(evento.target.value)}
                title={pessoa}
                className="text-corpo bg-muted min-h-[44px]"
              />
              <span id="pessoa-travada-dica" data-testid="pessoa-travada-dica">
                {DICA_PESSOA_TRAVADA}
              </span>
            </label>
          ) : (
            <label className="text-apoio text-muted-foreground flex flex-col gap-1">
              {ROTULO_PESSOA_OPCIONAL}
              <Input
                value={pessoa}
                onChange={(evento) => setPessoa(evento.target.value)}
                placeholder={PLACEHOLDER_PESSOA_VENDA}
                className="text-corpo min-h-[44px]"
              />
            </label>
          )}
        </div>

        {data !== hoje && (
          <p className="text-apoio text-muted-foreground">{textoDataRetroativa(formatarDataCurta(data))}</p>
        )}

        {linhas.length === 0 ? (
          <p className="text-corpo text-muted-foreground">{FRASE_VAZIO_VENDA}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {linhasParaExibir.map((linha) => (
              <LinhaCarrinho
                key={linha.chave}
                linha={linha}
                fixa={chavesFixas.has(linha.chave)}
                aoMudarQuantidade={mudarQuantidade}
                aoMudarValorUnitario={mudarValorUnitario}
                aoTirar={tirarLinha}
              />
            ))}
          </ul>
        )}

        <div className="border-border flex items-center justify-between border-t pt-3">
          <span className="text-titulo text-foreground">Total</span>
          <span data-testid="venda-total" className="text-display text-foreground tabular-nums">
            {formatarReais(totalCentavos)}
          </span>
        </div>

        <CampoDesconto
          modo={descontoModo}
          aoMudarModo={setDescontoModo}
          texto={descontoTexto}
          aoMudarTexto={setDescontoTexto}
          erro={descontoErro}
        />

        {areas.length > 1 && (
          <p data-testid="venda-dica-areas" className="text-apoio text-muted-foreground">
            {textoDicaDeAreas(listaEmPortugues(nomesDeAreas))}
          </p>
        )}

        {/* Fio de separação (item das Considerações do dono, 26/09/2026: ajuste fino de
            respiro) — mesmo tom de borda do fio do Total acima, marcando onde acaba "quanto" e
            começa "como paga"; nada mudou nas regras, só o limite ficou visível. */}
        <div className="border-border border-t" aria-hidden="true" />

        <BlocoPagamento
          tipo="venda"
          totalCentavos={totalCentavos}
          taxaPontosBase={configuracao.taxaCartaoPontosBase}
          hoje={hoje}
          dataSaldoInicial={configuracao.dataSaldoInicial}
          plano={plano}
          aoMudarPlano={setPlano}
          forma={formaPagamento}
          aoMudarForma={mudarFormaPagamento}
          duasFormas={duasFormas}
          aoAtivarOutraForma={ativarOutraForma}
          aoTirarOutraForma={tirarOutraForma}
          parcelas={parcelasPagamento}
          aoMudarParcela={mudarParcela}
          aoMudarPagoAVista={mudarPagoAVista}
          erroDeGeracao={erroDoPlano}
        />

        <EfeitoEstoque efeito={efeito} saldos={saldos} />

        {erro && (
          <p role="alert" aria-live="assertive" className="text-apoio text-destructive">
            {erro}
          </p>
        )}

        {/* FORA do `<details>` do efeito, que nasce fechado (Pitfall 16): o aviso de negativo tem
            de ser visto sem abrir nada, logo acima dos botões — e nunca desabilita "Lançar venda". */}
        {materiaisNegativos.length > 0 && (
          <p
            role="status"
            data-testid="venda-aviso-negativo"
            className="text-apoio bg-atencao-fundo text-atencao rounded-md px-3 py-2 break-words"
          >
            {textoAvisoVendaNegativa(materiaisNegativos)}
          </p>
        )}

        <div className="flex gap-2">
          <Button type="button" variant="outline" className="min-h-[44px]" onClick={limpar}>
            {ROTULO_LIMPAR}
          </Button>
          <Button
            type="button"
            variant="default"
            disabled={!podeLancar}
            className="min-h-[44px] flex-1"
            onClick={() => void aoLancar()}
          >
            {ROTULO_LANCAR_VENDA}
          </Button>
        </div>
      </section>

      <DialogoValorLivre
        aberto={dialogoValorLivreAberto}
        categorias={categorias}
        aoFechar={() => setDialogoValorLivreAberto(false)}
        aoConfirmar={adicionarLinhaLivre}
      />

      <ListaCompleta
        aberto={dialogoListaAberto}
        catalogo={catalogo}
        aoFechar={() => setDialogoListaAberto(false)}
        aoTocarItem={tocarItemDoCatalogo}
      />
    </div>
  );

  if (origem === null || !comOrigem) {
    return painel;
  }
  return (
    <div className="flex flex-col">
      <div className="px-6 pt-6 md:px-8">
        {dasQueimas ? (
          <FaixaDasQueimas titulo={origem.descricao} haviaVendaEmMontagem={haviaVendaEmMontagem} />
        ) : (
          <FaixaDaAgenda
            descricao={origem.descricao}
            nome={origem.nome ?? ""}
            haviaVendaEmMontagem={haviaVendaEmMontagem}
          />
        )}
      </div>
      {painel}
    </div>
  );
}

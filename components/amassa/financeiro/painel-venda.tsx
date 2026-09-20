"use client";

import { useEffect, useState } from "react";

import { lancarVenda } from "@/lib/financeiro/acoes";
import type { CategoriaParaEscolha, ItemDoCatalogoParaVenda } from "@/lib/financeiro/consultas";
import { repartirDesconto, type Desconto } from "@/lib/financeiro/desconto";
import { converterPercentualParaPontosBase, converterReaisParaCentavos } from "@/lib/financeiro/dinheiro";
import { areasDaVenda, listaEmPortugues } from "@/lib/financeiro/documento";
import { efeitoNoEstoque, type ItemParaEfeito } from "@/lib/financeiro/efeito-estoque";
import { formatarDataCurta, formatarReais } from "@/lib/financeiro/formato";
import { conferirParcelas, dividirEmDuasFormas, gerarPlano, type PlanoDePagamento } from "@/lib/financeiro/parcelas";
import { CHAVE_RASCUNHO_VENDA, lerRascunho, serializarRascunho, type LinhaDoRascunho } from "@/lib/financeiro/rascunho";
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
  textoDicaDeAreas,
  type FormaDePagamento,
} from "@/lib/financeiro/textos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BlocoPagamento, type ParcelaDoBloco } from "./bloco-pagamento";
import { CampoDesconto, type ModoDeDesconto } from "./campo-desconto";
import { DialogoValorLivre, type LinhaDeValorLivre } from "./dialogo-valor-livre";
import { EfeitoEstoque } from "./efeito-estoque";
import { GradeCatalogo, type FiltroDeArea } from "./grade-catalogo";
import { LinhaCarrinho, type LinhaDoCarrinho } from "./linha-carrinho";
import { ListaCompleta } from "./lista-completa";

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

export type PainelVendaProps = {
  hoje: string;
  categorias: CategoriaParaEscolha[];
  catalogo: ItemDoCatalogoParaVenda[];
  itensParaEfeito: ItemParaEfeito[];
  configuracao: { taxaCartaoPontosBase: number; dataSaldoInicial: string | null };
};

// O painel de venda completo (04.4-03-PLAN.md, 04.4-06-PLAN.md): catálogo com atalhos/busca/lista
// completa, valor livre, quantidade e preço editável, dica de múltiplas áreas, data retroativa, o
// pagamento (à vista, sinal, 2x a 12x, "+ outra forma" e o aviso do cartão) e o efeito no estoque.
// O rascunho sobrevive a trocar de aba/recarregar via `lib/financeiro/rascunho.ts`, na mesma aba
// do navegador — o PAGAMENTO fica de fora do rascunho de propósito: mudar de aba e voltar não
// deve reencontrar parcelas geradas para um total que já mudou.
export function PainelVenda({ hoje, categorias, catalogo, itensParaEfeito, configuracao }: PainelVendaProps) {
  const [dialogoValorLivreAberto, setDialogoValorLivreAberto] = useState(false);
  const [dialogoListaAberto, setDialogoListaAberto] = useState(false);
  const [linhas, setLinhas] = useState<LinhaLocal[]>([]);
  const [data, setData] = useState(hoje);
  const [pessoa, setPessoa] = useState("");
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
  const [pagoAVista, setPagoAVista] = useState(true);
  // O "Vence em" digitado à mão para o à vista em aberto — `null` até o dono editar o campo (a
  // parcela então vence na data do documento, o padrão de `gerarPlano`). Sobrevive à regeneração
  // do plano pela MESMA razão de `pagoAVista`: mudar o carrinho não deve apagar uma data já
  // escolhida (04.4-12-PLAN.md).
  const [vencimentoAvistaAberto, setVencimentoAvistaAberto] = useState<string | null>(null);
  const [parcelasPagamento, setParcelasPagamento] = useState<ParcelaDoBloco[]>([]);
  const [erroDoPlano, setErroDoPlano] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [rascunhoCarregado, setRascunhoCarregado] = useState(false);

  // Lê o rascunho UMA vez, ao montar — com os ids do catálogo JÁ carregado, para descartar linha
  // de item que sumiu (lerRascunho). Nunca sobrescreve um rascunho vazio por cima de nada.
  useEffect(() => {
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
          return [];
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
    setLinhas((atual) => atual.filter((linha) => linha.chave !== chave));
  }

  function limpar() {
    setLinhas([]);
    setData(hoje);
    setPessoa("");
    setBusca("");
    setFiltro("tudo");
    setDescontoModo("reais");
    setDescontoTexto("");
    setErro(null);
    setPlano("avista");
    setFormaPagamento("pix");
    setDuasFormas(false);
    setPagoAVista(true);
    setVencimentoAvistaAberto(null);
    setParcelasPagamento([]);
    setErroDoPlano(null);
    window.sessionStorage.removeItem(CHAVE_RASCUNHO_VENDA);
  }

  async function aoLancar() {
    setErro(null);
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
    });

    setEnviando(false);

    if (!resposta.ok) {
      setErro(resposta.erro);
      return;
    }

    window.sessionStorage.removeItem(CHAVE_RASCUNHO_VENDA);
    // Navegação completa de propósito (nunca `router.push`/`router.refresh`) — a página resolve
    // o aviso no servidor a partir de `?aviso=lancado&documento=<id>`.
    window.location.assign(`/financeiro?aba=venda&aviso=lancado&documento=${resposta.dados.id}`);
  }

  return (
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
          <label className="text-apoio text-muted-foreground flex flex-col gap-1">
            {ROTULO_PESSOA_OPCIONAL}
            <Input
              value={pessoa}
              onChange={(evento) => setPessoa(evento.target.value)}
              placeholder={PLACEHOLDER_PESSOA_VENDA}
              className="text-corpo min-h-[44px]"
            />
          </label>
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

        <EfeitoEstoque efeito={efeito} />

        {erro && (
          <p role="alert" aria-live="assertive" className="text-apoio text-destructive">
            {erro}
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
}

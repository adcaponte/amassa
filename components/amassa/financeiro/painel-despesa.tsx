"use client";

import { useEffect, useRef, useState } from "react";

import { lancarDespesa } from "@/lib/financeiro/acoes";
import type { CategoriaParaEscolha, ItemDoCatalogoParaCompra } from "@/lib/financeiro/consultas";
import type { RascunhoDaCorrecao } from "@/lib/financeiro/correcao";
import { centavosParaCampo, converterQuantidade, converterReaisParaCentavos } from "@/lib/financeiro/dinheiro";
import { efeitoNoEstoque, type ItemParaEfeito } from "@/lib/financeiro/efeito-estoque";
import { formatarDataCurta, formatarReais } from "@/lib/financeiro/formato";
import {
  conferirParcelas,
  dividirEmDuasFormas,
  gerarPlano,
  primeiroValorDaDivisao,
  type PlanoDePagamento,
} from "@/lib/financeiro/parcelas";
import {
  CHAVE_RASCUNHO_DESPESA,
  lerRascunhoDespesa,
  serializarRascunhoDespesa,
  type RascunhoDeDespesa,
} from "@/lib/financeiro/rascunho";
import {
  DICA_EFEITO_ESTOQUE_COMPRA,
  DICA_FORA_DO_RESULTADO,
  FRASE_VAZIO_DESPESA_COMPRA,
  PLACEHOLDER_DESCRICAO_DESPESA,
  ROTULO_AREA,
  ROTULO_CATEGORIA,
  ROTULO_DATA,
  ROTULO_DESCRICAO,
  ROTULO_FORNECEDOR_OPCIONAL,
  ROTULO_GRUPO,
  ROTULO_GRUPO_MODO_DESPESA,
  ROTULO_LANCAR_DESPESA,
  ROTULO_LIMPAR,
  ROTULO_LISTA_COMPLETA_E_ATALHOS,
  ROTULO_FORNECEDOR_OU_PARA_QUEM_OPCIONAL,
  ROTULO_PILULA_COMPRA,
  ROTULO_PILULA_OUTRA,
  ROTULO_VALOR,
  TITULO_EFEITO_ESTOQUE_COMPRA,
  TITULO_ESTA_COMPRA,
  TITULO_O_QUE_CHEGOU,
  TITULO_PAGAMENTO_DESPESA,
  TITULO_QUE_DESPESA_E,
  rotuloLancarCorrecao,
  textoDataRetroativa,
  type FormaDePagamento,
} from "@/lib/financeiro/textos";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FornecedorParaSeletor } from "@/lib/fornecedores/consultas";
import { BlocoPagamento, type ParcelaDoBloco } from "./bloco-pagamento";
import { CampoFornecedor } from "./campo-fornecedor";
import { EfeitoEstoque } from "./efeito-estoque";
import { FaixaDaCorrecao } from "./faixa-da-correcao";
import { GradeCatalogo } from "./grade-catalogo";
import { LinhaCompra } from "./linha-compra";
import { ListaCompleta } from "./lista-completa";
import type { CorrecaoNoPainel } from "./painel-venda";
import { rotaDeGestao } from "@/lib/rotas/gestao";

const FORMAS_EM_ORDEM: readonly FormaDePagamento[] = ["dinheiro", "pix", "cartao"];

type ModoDespesa = "compra" | "outra";

type LinhaDeCompraLocal = {
  chave: string;
  itemId: string;
  nome: string;
  area: string;
  unidade: string;
  quantidadeEstoqueTexto: string;
  valorTotalTexto: string;
};

function novaChave(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// A quantidade gravada (`numeric` com três casas, “5.000”) no formato do campo “quantos” (“5”, “2,25”).
function quantidadeParaCampo(quantidade: string | null): string {
  if (quantidade === null) {
    return "";
  }
  const numero = Number(quantidade);
  return Number.isFinite(numero) && numero > 0 ? String(numero).replace(".", ",") : "";
}

// O ponto de partida do painel. Na correção (Fase 06.5, plano 18 — D-18/UI-D9, POL-08 “inclusive o
// fornecedor”): a original como estava — o modo pelas linhas (material → Compra; a linha única sem item →
// Outra despesa, que é o que `lancarDespesa` grava nesse modo), as linhas de material com a quantidade de
// estoque e o valor da linha antiga (UI-D11), o fornecedor (ligado quando ainda ativo, com o nome de HOJE
// do cadastro — é o que o servidor grava —, senão o nome como texto livre), a data e o pagamento. Fora da
// correção, a Despesa vazia de sempre (o rascunho comum é lido depois, ao montar).
type InicioDaDespesa = {
  modo: ModoDespesa;
  data: string;
  pessoa: string;
  fornecedorId: string | null;
  linhasCompra: LinhaDeCompraLocal[];
  descricaoOutra: string;
  categoriaOutraId: string | null;
  valorOutraTexto: string;
  plano: PlanoDePagamento;
  forma: FormaDePagamento;
  duasFormas: boolean;
  pagoAVista: boolean;
  vencimentoAvistaAberto: string | null;
  parcelas: ParcelaDoBloco[];
};

function inicioDaDespesa(
  hoje: string,
  rascunho: RascunhoDaCorrecao | null,
  catalogoDaCompra: readonly ItemDoCatalogoParaCompra[],
  fornecedores: readonly FornecedorParaSeletor[] | null,
  fornecedorIdInicial: string | null,
): InicioDaDespesa {
  if (rascunho === null) {
    return {
      modo: "compra",
      data: hoje,
      pessoa: "",
      fornecedorId: null,
      linhasCompra: [],
      descricaoOutra: "",
      categoriaOutraId: null,
      valorOutraTexto: "",
      plano: "avista",
      forma: "dinheiro",
      duasFormas: false,
      pagoAVista: true,
      vencimentoAvistaAberto: null,
      parcelas: [],
    };
  }
  const itemPorId = new Map(catalogoDaCompra.map((item) => [item.id, item]));
  const linhasCompra = rascunho.linhas.flatMap((linha, indice): LinhaDeCompraLocal[] => {
    if (linha.tipo !== "item") {
      return [];
    }
    const item = itemPorId.get(linha.itemId);
    return [
      {
        chave: `correcao-${indice}`,
        itemId: linha.itemId,
        nome: item?.nome ?? linha.descricao,
        area: item?.area ?? "geral",
        unidade: item?.unidade ?? "un",
        quantidadeEstoqueTexto: quantidadeParaCampo(linha.quantidadeEstoque),
        valorTotalTexto: centavosParaCampo(linha.valorCentavos),
      },
    ];
  });
  const livre = rascunho.linhas.find((linha) => linha.tipo === "livre");
  const modo: ModoDespesa = linhasCompra.length === 0 && livre !== undefined ? "outra" : "compra";
  const fornecedorLigado =
    fornecedorIdInicial === null
      ? undefined
      : (fornecedores ?? []).find((fornecedor) => fornecedor.id === fornecedorIdInicial);
  const primeira = rascunho.pagamento.parcelas[0];
  const pagoAVista = primeira?.pago ?? true;
  return {
    modo,
    data: rascunho.data,
    pessoa: fornecedorLigado?.nome ?? rascunho.pessoa,
    fornecedorId: fornecedorLigado?.id ?? null,
    linhasCompra,
    descricaoOutra: modo === "outra" && livre ? livre.descricao : "",
    categoriaOutraId: modo === "outra" && livre ? livre.categoriaId : null,
    valorOutraTexto: modo === "outra" && livre ? centavosParaCampo(livre.valorCentavos) : "",
    plano: rascunho.pagamento.plano,
    forma: rascunho.pagamento.forma,
    duasFormas: rascunho.pagamento.duasFormas,
    pagoAVista,
    vencimentoAvistaAberto: !pagoAVista && primeira ? primeira.vencimento : null,
    parcelas: rascunho.pagamento.parcelas.map((parcela) => ({
      vencimento: parcela.vencimento,
      valorTexto: centavosParaCampo(parcela.valorCentavos),
      forma: parcela.forma,
      pago: parcela.pago,
    })),
  };
}

export type PainelDespesaProps = {
  hoje: string;
  categoriasParaDespesa: CategoriaParaEscolha[];
  catalogoDaCompra: ItemDoCatalogoParaCompra[];
  itensParaEfeito: ItemParaEfeito[];
  configuracao: { taxaCartaoPontosBase: number; dataSaldoInicial: string | null };
  // Plano 06-08 (D-21): o saldo de cada material antes da compra, para "fica com …"; `null` quando
  // a consulta do Estoque falhou (o efeito volta ao formato de antes). Sem aviso: compra só soma.
  saldos?: ReadonlyMap<string, number> | null;
  // Fase 06.2, planos 10 e 12 (D-04): os fornecedores ATIVOS para o campo "Fornecedor" dos dois modos;
  // `null` quando a leitura falhou (o campo funciona como texto livre — nunca bloqueia o lançamento).
  fornecedores?: FornecedorParaSeletor[] | null;
  // Fase 06.5, plano 18: a Despesa aberta por “Corrigir” — a original (`rascunhoDaCorrecao`, calculado na
  // página) e o fornecedor ligado dela, quando ainda está entre os ativos. Sem os dois, a Despesa comum.
  correcao?: CorrecaoNoPainel | null;
  rascunhoInicial?: RascunhoDaCorrecao | null;
  fornecedorIdInicial?: string | null;
};

// O painel de Despesa completo (04.4-07-PLAN.md): as duas pílulas (compra · outra), compra de
// material (busca, atalhos, "quantos"/"custou ao todo", o efeito no estoque já aberto) e outra
// despesa (descrição, categoria, valor, a dica do "Fora do resultado"). O MESMO
// `BlocoPagamento`/`lib/financeiro/parcelas.ts` da Venda — nenhuma segunda regra de plano de
// parcelas. O rascunho vive numa chave PRÓPRIA (`CHAVE_RASCUNHO_DESPESA`), com os dois modos
// guardados ao mesmo tempo (trocar de pílula não perde o que foi digitado no outro).
// O terceiro caminho, "Pagar conta que já existe" (link para o Caixa), foi REMOVIDO em 26/09/2026
// por decisão do dono — pareceu inútil e grande no uso real no celular (ver BRIEFING.md §1 e
// 04.4-UI-SPEC.md §Foco Visual Principal para a nota completa). Quem quer pagar uma conta que já
// existe vai por Caixa → "A pagar" → "Paguei".
export function PainelDespesa({
  hoje,
  categoriasParaDespesa,
  catalogoDaCompra,
  itensParaEfeito,
  configuracao,
  saldos = null,
  fornecedores = null,
  correcao = null,
  rascunhoInicial = null,
  fornecedorIdInicial = null,
}: PainelDespesaProps) {
  // A Despesa da correção (plano 18): começa da original e nunca lê nem grava o rascunho comum — a despesa
  // em montagem fica intacta, como na Venda da correção (plano 17).
  const comCorrecao = correcao !== null && rascunhoInicial !== null;
  const inicio = inicioDaDespesa(
    hoje,
    comCorrecao ? rascunhoInicial : null,
    catalogoDaCompra,
    fornecedores,
    fornecedorIdInicial,
  );
  const categoriaOutraInicial = inicio.categoriaOutraId ?? categoriasParaDespesa[0]?.id ?? "";
  const [modo, setModo] = useState<ModoDespesa>(inicio.modo);

  const [dataCompra, setDataCompra] = useState(inicio.data);
  const [pessoaCompra, setPessoaCompra] = useState(inicio.modo === "compra" ? inicio.pessoa : "");
  // O fornecedor ESCOLHIDO na lista do campo "Fornecedor" (D-04) — `null` = texto livre ou campo vazio.
  // Vai para o rascunho (plano 12); ao ler, um id que não está mais entre os ativos é descartado e o
  // nome volta como texto livre (Pitfall 15).
  const [fornecedorCompra, setFornecedorCompra] = useState<string | null>(
    inicio.modo === "compra" ? inicio.fornecedorId : null,
  );
  const [linhasCompra, setLinhasCompra] = useState<LinhaDeCompraLocal[]>(inicio.linhasCompra);
  const [buscaCompra, setBuscaCompra] = useState("");
  const [dialogoListaCompraAberto, setDialogoListaCompraAberto] = useState(false);

  const [dataOutra, setDataOutra] = useState(inicio.data);
  const [pessoaOutra, setPessoaOutra] = useState(inicio.modo === "outra" ? inicio.pessoa : "");
  // O mesmo vínculo no modo "Outra despesa" (plano 12, FRN-12 "em todos os modos"): cada modo guarda o seu.
  const [fornecedorOutra, setFornecedorOutra] = useState<string | null>(
    inicio.modo === "outra" ? inicio.fornecedorId : null,
  );
  const [descricaoOutra, setDescricaoOutra] = useState(inicio.descricaoOutra);
  const [categoriaOutraId, setCategoriaOutraId] = useState(categoriaOutraInicial);
  const [valorOutraTexto, setValorOutraTexto] = useState(inicio.valorOutraTexto);

  const [plano, setPlano] = useState<PlanoDePagamento>(inicio.plano);
  const [formaPagamento, setFormaPagamento] = useState<FormaDePagamento>(inicio.forma);
  const [duasFormas, setDuasFormas] = useState(inicio.duasFormas);
  // A INTENÇÃO do dono sobre o à vista de uma parcela só (04.4-12-PLAN.md) — mesma disciplina da
  // Venda: nasce marcada e sobrevive à regeneração do plano quando o carrinho, a data ou o plano
  // mudam.
  const [pagoAVista, setPagoAVista] = useState(inicio.pagoAVista);
  // O "Vence em" digitado à mão para o à vista em aberto — mesma disciplina da Venda: sobrevive à
  // regeneração do plano quando o carrinho, a data ou o plano mudam.
  const [vencimentoAvistaAberto, setVencimentoAvistaAberto] = useState<string | null>(
    inicio.vencimentoAvistaAberto,
  );
  const [parcelasPagamento, setParcelasPagamento] = useState<ParcelaDoBloco[]>(inicio.parcelas);
  // Na correção, o pagamento começa COMO ESTAVA na original, e a primeira passada do efeito que regenera o
  // plano (abaixo) não pode apagá-lo — o mesmo cuidado da Venda (plano 17): `marcaDaAbertura` guarda plano,
  // total e data da primeira passada, e só a primeira mudança de verdade regenera. Comparar valores deixa o
  // efeito idempotente no modo estrito do React.
  const pagamentoDaOriginalIntacto = useRef(comCorrecao);
  const marcaDaAbertura = useRef<{ plano: PlanoDePagamento; totalCentavos: number; data: string } | null>(null);
  const [erroDoPlano, setErroDoPlano] = useState<string | null>(null);

  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [rascunhoCarregado, setRascunhoCarregado] = useState(false);

  // Lê o rascunho UMA vez, ao montar — os dois modos reconstruídos ao mesmo tempo (chave própria,
  // separada da Venda).
  useEffect(() => {
    if (comCorrecao) {
      // A correção nunca lê nem grava o rascunho comum (`rascunhoCarregado` fica falso).
      return;
    }
    const texto = window.sessionStorage.getItem(CHAVE_RASCUNHO_DESPESA) ?? "";
    const catalogoPorId = new Map(catalogoDaCompra.map((item) => [item.id, item]));
    const lido = lerRascunhoDespesa(
      texto,
      catalogoDaCompra.map((item) => item.id),
      // Os ids dos fornecedores ATIVOS desta mesma página; lista que não carregou → nenhum vínculo
      // sobrevive (o nome fica como texto livre).
      (fornecedores ?? []).map((fornecedor) => fornecedor.id),
    );

    setModo(lido.modo);
    if (lido.compra.data) {
      setDataCompra(lido.compra.data);
    }
    if (lido.compra.pessoa) {
      setPessoaCompra(lido.compra.pessoa);
    }
    if (lido.compra.fornecedorId !== null) {
      setFornecedorCompra(lido.compra.fornecedorId);
    }
    if (lido.compra.linhas.length > 0) {
      const reconstruidas: LinhaDeCompraLocal[] = lido.compra.linhas.flatMap((linha): LinhaDeCompraLocal[] => {
        const item = catalogoPorId.get(linha.itemId);
        if (!item) {
          return [];
        }
        return [
          {
            chave: novaChave(),
            itemId: item.id,
            nome: item.nome,
            area: item.area,
            unidade: item.unidade,
            quantidadeEstoqueTexto: linha.quantidadeEstoqueTexto,
            valorTotalTexto: linha.valorTotalTexto,
          },
        ];
      });
      setLinhasCompra(reconstruidas);
    }
    if (lido.outra.data) {
      setDataOutra(lido.outra.data);
    }
    if (lido.outra.pessoa) {
      setPessoaOutra(lido.outra.pessoa);
    }
    if (lido.outra.fornecedorId !== null) {
      setFornecedorOutra(lido.outra.fornecedorId);
    }
    if (lido.outra.descricao) {
      setDescricaoOutra(lido.outra.descricao);
    }
    if (lido.outra.categoriaId) {
      setCategoriaOutraId(lido.outra.categoriaId);
    }
    if (lido.outra.valorTexto) {
      setValorOutraTexto(lido.outra.valorTexto);
    }

    setRascunhoCarregado(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Grava o rascunho a cada mudança — só depois da leitura inicial (mesma disciplina do
  // rascunho da Venda).
  useEffect(() => {
    if (!rascunhoCarregado) {
      return;
    }
    const rascunho: RascunhoDeDespesa = {
      modo,
      compra: {
        data: dataCompra,
        pessoa: pessoaCompra,
        fornecedorId: fornecedorCompra,
        linhas: linhasCompra.map((linha) => ({
          itemId: linha.itemId,
          quantidadeEstoqueTexto: linha.quantidadeEstoqueTexto,
          valorTotalTexto: linha.valorTotalTexto,
        })),
      },
      outra: {
        data: dataOutra,
        pessoa: pessoaOutra,
        fornecedorId: fornecedorOutra,
        descricao: descricaoOutra,
        categoriaId: categoriaOutraId,
        valorTexto: valorOutraTexto,
      },
    };
    window.sessionStorage.setItem(CHAVE_RASCUNHO_DESPESA, serializarRascunhoDespesa(rascunho));
  }, [
    modo,
    dataCompra,
    pessoaCompra,
    fornecedorCompra,
    linhasCompra,
    dataOutra,
    pessoaOutra,
    fornecedorOutra,
    descricaoOutra,
    categoriaOutraId,
    valorOutraTexto,
    rascunhoCarregado,
  ]);

  const totalCentavosCompra = linhasCompra.reduce((total, linha) => {
    const resultado = converterReaisParaCentavos(linha.valorTotalTexto);
    return total + (resultado.ok && resultado.centavos ? resultado.centavos : 0);
  }, 0);
  const resultadoValorOutra = converterReaisParaCentavos(valorOutraTexto);
  const totalCentavosOutra = resultadoValorOutra.ok && resultadoValorOutra.centavos ? resultadoValorOutra.centavos : 0;

  const totalCentavos = modo === "compra" ? totalCentavosCompra : totalCentavosOutra;
  const dataAtual = modo === "compra" ? dataCompra : dataOutra;

  // O plano de pagamento regenera do ZERO quando total/data/plano mudam — mesma disciplina do
  // pagamento da Venda (04.4-06-PLAN.md). `pagoAVista` é lido de DENTRO do efeito, fora da lista
  // de dependências (mesma exceção já usada na Venda, 04.4-12-PLAN.md): a regeneração usa a
  // intenção CORRENTE do dono, e alternar a caixinha nunca dispara este efeito sozinho.
  useEffect(() => {
    if (pagamentoDaOriginalIntacto.current) {
      const abertura = (marcaDaAbertura.current ??= { plano, totalCentavos, data: dataAtual });
      if (abertura.plano === plano && abertura.totalCentavos === totalCentavos && abertura.data === dataAtual) {
        return;
      }
      pagamentoDaOriginalIntacto.current = false;
    }
    if (totalCentavos <= 0) {
      setParcelasPagamento([]);
      setErroDoPlano(null);
      setDuasFormas(false);
      return;
    }
    const resultado = gerarPlano({
      plano,
      totalCentavos,
      data: dataAtual,
      forma: formaPagamento,
      pagaAVista: pagoAVista,
    });
    setDuasFormas(false);
    if (!resultado.ok) {
      setParcelasPagamento([]);
      setErroDoPlano(resultado.erro);
      return;
    }
    setErroDoPlano(null);
    setParcelasPagamento(
      resultado.parcelas.map((parcela, indice) => ({
        // A parcela 0 do à vista EM ABERTO usa o "Vence em" já digitado, se houver
        // (04.4-12-PLAN.md) — mesma disciplina da Venda.
        vencimento:
          indice === 0 && plano === "avista" && !pagoAVista && vencimentoAvistaAberto
            ? vencimentoAvistaAberto
            : parcela.vencimento,
        valorTexto: centavosParaCampo(parcela.valorCentavos),
        forma: parcela.forma,
        pago: parcela.paga,
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plano, totalCentavos, dataAtual]);

  function mudarFormaPagamento(nova: FormaDePagamento) {
    setFormaPagamento(nova);
    if (!duasFormas) {
      setParcelasPagamento((atual) => atual.map((parcela) => ({ ...parcela, forma: nova })));
    }
  }

  // A caixinha "Já paguei" do à vista de uma parcela só — mesma disciplina da Venda: grava a
  // INTENÇÃO e marca/desmarca a própria parcela, sem disparar a regeneração do plano.
  function mudarPagoAVista(pago: boolean) {
    setPagoAVista(pago);
    setParcelasPagamento((atual) =>
      atual.map((parcela, indice) => (indice === 0 ? { ...parcela, pago } : parcela)),
    );
  }

  function ativarOutraForma() {
    const outraForma = FORMAS_EM_ORDEM.find((valor) => valor !== formaPagamento) ?? "dinheiro";
    // Semeia as duas linhas com a intenção ATUAL do à vista (04.4-12-PLAN.md).
    const resultado = dividirEmDuasFormas({
      totalCentavos,
      primeiroValorCentavos: primeiroValorDaDivisao(totalCentavos),
      data: dataAtual,
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
        valorTexto: centavosParaCampo(parcela.valorCentavos),
        forma: parcela.forma,
        pago: parcela.paga,
      })),
    );
  }

  function tirarOutraForma() {
    const resultado = gerarPlano({
      plano: "avista",
      totalCentavos,
      data: dataAtual,
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
        valorTexto: centavosParaCampo(parcela.valorCentavos),
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

  const linhasCompraValidas = linhasCompra.every((linha) => {
    const qtd = converterQuantidade(linha.quantidadeEstoqueTexto);
    const valor = converterReaisParaCentavos(linha.valorTotalTexto);
    return qtd.ok && valor.ok && valor.centavos != null && valor.centavos > 0;
  });

  const podeLancar =
    !enviando &&
    !erroDoPlano &&
    (conferenciaDoPagamento?.ok ?? false) &&
    (modo === "compra"
      ? linhasCompra.length > 0 && linhasCompraValidas
      : descricaoOutra.trim() !== "" && totalCentavosOutra > 0);

  const efeito =
    modo === "compra"
      ? efeitoNoEstoque(
          linhasCompra.map((linha) => {
            const qtd = converterQuantidade(linha.quantidadeEstoqueTexto);
            const valor = converterReaisParaCentavos(linha.valorTotalTexto);
            return {
              itemId: linha.itemId,
              quantidade: 1,
              quantidadeEstoque: qtd.ok ? qtd.quantidade : null,
              valorCentavos: valor.ok && valor.centavos != null ? valor.centavos : undefined,
            };
          }),
          itensParaEfeito,
          "compra",
        )
      : [];

  function tocarItemDaCompra(item: ItemDoCatalogoParaCompra) {
    setLinhasCompra((atual) => {
      if (atual.some((linha) => linha.itemId === item.id)) {
        return atual;
      }
      return [
        ...atual,
        {
          chave: novaChave(),
          itemId: item.id,
          nome: item.nome,
          area: item.area,
          unidade: item.unidade,
          quantidadeEstoqueTexto: "1",
          valorTotalTexto: "",
        },
      ];
    });
  }

  function mudarQuantos(chave: string, valor: string) {
    setLinhasCompra((atual) =>
      atual.map((linha) => (linha.chave === chave ? { ...linha, quantidadeEstoqueTexto: valor } : linha)),
    );
  }

  function mudarCustou(chave: string, valor: string) {
    setLinhasCompra((atual) =>
      atual.map((linha) => (linha.chave === chave ? { ...linha, valorTotalTexto: valor } : linha)),
    );
  }

  function tirarLinhaCompra(chave: string) {
    setLinhasCompra((atual) => atual.filter((linha) => linha.chave !== chave));
  }

  // Na correção, “Limpar” volta à original inteira (linhas, fornecedor, data e o pagamento como estava) e
  // não toca no rascunho comum. Fora dela, a Despesa vazia de sempre.
  function limpar() {
    if (comCorrecao) {
      setModo(inicio.modo);
    }
    setLinhasCompra(inicio.linhasCompra);
    setDataCompra(inicio.data);
    setPessoaCompra(inicio.modo === "compra" ? inicio.pessoa : "");
    setFornecedorCompra(inicio.modo === "compra" ? inicio.fornecedorId : null);
    setBuscaCompra("");
    setDescricaoOutra(inicio.descricaoOutra);
    setCategoriaOutraId(categoriaOutraInicial);
    setValorOutraTexto(inicio.valorOutraTexto);
    setDataOutra(inicio.data);
    setPessoaOutra(inicio.modo === "outra" ? inicio.pessoa : "");
    setFornecedorOutra(inicio.modo === "outra" ? inicio.fornecedorId : null);
    setErro(null);
    setPlano(inicio.plano);
    setFormaPagamento(inicio.forma);
    setDuasFormas(inicio.duasFormas);
    setPagoAVista(inicio.pagoAVista);
    setVencimentoAvistaAberto(inicio.vencimentoAvistaAberto);
    setParcelasPagamento(inicio.parcelas);
    pagamentoDaOriginalIntacto.current = comCorrecao;
    setErroDoPlano(null);
    if (!comCorrecao) {
      window.sessionStorage.removeItem(CHAVE_RASCUNHO_DESPESA);
    }
  }

  async function aoLancar() {
    setErro(null);
    setEnviando(true);

    const parcelasParaEnviar = parcelasPagamento.map((parcela) => ({
      vencimento: parcela.vencimento,
      valorTexto: parcela.valorTexto,
      forma: parcela.forma,
      pago: parcela.pago,
    }));

    // A correção (plano 18): só o id e a versão que a página leu — o servidor trava a original, reconfere e
    // a cancela na mesma transação em que lança esta (plano 16).
    const vinculo =
      correcao !== null && comCorrecao
        ? { correcao: { documentoId: correcao.documentoId, versao: correcao.versao } }
        : {};

    const resposta =
      modo === "compra"
        ? await lancarDespesa({
            modo: "compra",
            data: dataCompra,
            pessoa: pessoaCompra.trim() === "" ? undefined : pessoaCompra,
            // Só quando ligado: o servidor confere o fornecedor e grava o nome do CADASTRO.
            fornecedorId: fornecedorCompra ?? undefined,
            linhas: linhasCompra.map((linha) => ({
              itemId: linha.itemId,
              quantidadeEstoqueTexto: linha.quantidadeEstoqueTexto,
              valorTotalTexto: linha.valorTotalTexto,
            })),
            parcelas: parcelasParaEnviar,
            ...vinculo,
          })
        : await lancarDespesa({
            modo: "outra",
            data: dataOutra,
            pessoa: pessoaOutra.trim() === "" ? undefined : pessoaOutra,
            // Só quando ligado (plano 12): o mesmo caminho da compra — o servidor confere e congela o nome.
            fornecedorId: fornecedorOutra ?? undefined,
            descricao: descricaoOutra,
            categoriaId: categoriaOutraId,
            valorTexto: valorOutraTexto,
            parcelas: parcelasParaEnviar,
            ...vinculo,
          });

    setEnviando(false);

    if (!resposta.ok) {
      setErro(resposta.erro);
      return;
    }

    if (comCorrecao) {
      // A volta à Despesa comum (sem a faixa, sem `?corrige=`): a página monta o toast “Despesa nº {37}
      // cancelada e nº {39} lançada no lugar · {R$}” lendo o vínculo no banco. `replace`: o “voltar” não
      // reabre a correção de uma original que acabou de ser cancelada. O rascunho comum não foi tocado.
      window.location.replace(
        rotaDeGestao(`/financeiro?aba=despesa&aviso=corrigido&documento=${resposta.dados.id}`),
      );
      return;
    }

    window.sessionStorage.removeItem(CHAVE_RASCUNHO_DESPESA);
    window.location.assign(rotaDeGestao(`/financeiro?aba=despesa&aviso=lancado&documento=${resposta.dados.id}`));
  }

  const categoriaOutraEscolhida = categoriasParaDespesa.find((categoria) => categoria.id === categoriaOutraId);

  const categoriasPorGrupo = new Map<string, CategoriaParaEscolha[]>();
  for (const categoria of categoriasParaDespesa) {
    const lista = categoriasPorGrupo.get(categoria.grupo) ?? [];
    lista.push(categoria);
    categoriasPorGrupo.set(categoria.grupo, lista);
  }

  function pilulaClasse(ativa: boolean): string {
    return cn(
      "text-corpo min-h-[44px] rounded-full border px-4 font-medium",
      ativa
        ? "border-primary bg-accent text-accent-foreground"
        : "border-border bg-secondary text-secondary-foreground",
    );
  }

  return (
    <>
      {comCorrecao && correcao !== null ? (
        // A faixa da correção, ANTES das pílulas e do carrinho na ordem de leitura (UI-SPEC §Teclado).
        <div className="px-6 pt-6 md:px-8">
          <FaixaDaCorrecao
            tipo="despesa"
            originalId={correcao.documentoId}
            numeroOriginal={correcao.numero}
            comEstoque={correcao.comEstoque}
            deFora={correcao.deFora}
          />
        </div>
      ) : null}
      {/* Respiro maior ACIMA (16px) do que ABAIXO (8px) desta fila — Considerações do dono
          (26/09/2026): as pílulas nasciam encostadas na barra de navegação de cima; agora se
          ligam ao conteúdo que controlam, não a ela. */}
      <div className="flex flex-col gap-2 px-6 pt-4 pb-2 md:px-8">
        {/* As DUAS escolhas de verdade da tela (04.4-UI-SPEC.md §Foco Visual), agrupadas com
            nome acessível próprio, em duas colunas de largura igual no celular e na fila de
            sempre a partir de `md`. O atalho "Pagar conta que já existe" que ficava FORA deste
            grupo foi REMOVIDO em 26/09/2026 por decisão do dono — pareceu inútil e grande no uso
            real no celular (ver comentário acima da função). Quem quer pagar uma conta que já
            existe vai por Caixa → "A pagar" → "Paguei". */}
        <div
          role="group"
          aria-label={ROTULO_GRUPO_MODO_DESPESA}
          className="grid grid-cols-2 gap-2 md:flex md:flex-wrap"
        >
          <button
            type="button"
            data-testid="despesa-modo-compra"
            aria-pressed={modo === "compra"}
            onClick={() => setModo("compra")}
            className={pilulaClasse(modo === "compra")}
          >
            {ROTULO_PILULA_COMPRA}
          </button>
          <button
            type="button"
            data-testid="despesa-modo-outra"
            aria-pressed={modo === "outra"}
            onClick={() => setModo("outra")}
            className={pilulaClasse(modo === "outra")}
          >
            {ROTULO_PILULA_OUTRA}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 px-6 py-6 md:grid-cols-[1.15fr_1fr] md:px-8">
        {modo === "compra" ? (
          <section className="border-border bg-card flex flex-col gap-4 rounded-lg border p-4">
            <h2 className="text-titulo text-foreground">{TITULO_O_QUE_CHEGOU}</h2>

            <GradeCatalogo
              modo="compra"
              catalogo={catalogoDaCompra}
              busca={buscaCompra}
              aoMudarBusca={setBuscaCompra}
              filtro="tudo"
              aoMudarFiltro={() => {}}
              aoTocarItem={tocarItemDaCompra}
            />

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px]"
                onClick={() => setDialogoListaCompraAberto(true)}
              >
                {ROTULO_LISTA_COMPLETA_E_ATALHOS}
              </Button>
            </div>
          </section>
        ) : (
          <section className="border-border bg-card flex flex-col gap-4 rounded-lg border p-4">
            <h2 className="text-titulo text-foreground">{TITULO_QUE_DESPESA_E}</h2>

            <Field>
              <FieldLabel htmlFor="despesa-outra-descricao">{ROTULO_DESCRICAO}</FieldLabel>
              <Input
                id="despesa-outra-descricao"
                value={descricaoOutra}
                onChange={(evento) => setDescricaoOutra(evento.target.value)}
                placeholder={PLACEHOLDER_DESCRICAO_DESPESA}
                className="text-corpo min-h-[44px]"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="despesa-outra-categoria">{ROTULO_CATEGORIA}</FieldLabel>
              <Select value={categoriaOutraId} onValueChange={setCategoriaOutraId}>
                <SelectTrigger
                  id="despesa-outra-categoria"
                  aria-label={ROTULO_CATEGORIA}
                  className="min-h-[44px] w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[...categoriasPorGrupo.entries()].map(([grupo, categoriasDoGrupo]) => (
                    <SelectGroup key={grupo}>
                      <SelectLabel>{ROTULO_GRUPO[grupo as keyof typeof ROTULO_GRUPO]}</SelectLabel>
                      {categoriasDoGrupo.map((categoria) => (
                        <SelectItem key={categoria.id} value={categoria.id}>
                          {categoria.nome}
                          {categoria.grupo === "custo"
                            ? ` · ${ROTULO_AREA[categoria.area as keyof typeof ROTULO_AREA]}`
                            : ""}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="despesa-outra-valor">{ROTULO_VALOR}</FieldLabel>
              <Input
                id="despesa-outra-valor"
                inputMode="decimal"
                value={valorOutraTexto}
                onChange={(evento) => setValorOutraTexto(evento.target.value)}
                placeholder="R$"
                className="text-corpo min-h-[44px]"
              />
            </Field>

            {categoriaOutraEscolhida?.grupo === "fora" && (
              <p data-testid="despesa-dica-fora" className="text-apoio text-muted-foreground">
                {DICA_FORA_DO_RESULTADO}
              </p>
            )}
          </section>
        )}

        <section className="border-border bg-card flex flex-col gap-4 rounded-lg border p-4">
          <h2 className="text-titulo text-foreground">
            {modo === "compra" ? TITULO_ESTA_COMPRA : TITULO_PAGAMENTO_DESPESA}
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="text-apoio text-muted-foreground flex flex-col gap-1">
              {ROTULO_DATA}
              <Input
                type="date"
                value={dataAtual}
                onChange={(evento) =>
                  modo === "compra" ? setDataCompra(evento.target.value) : setDataOutra(evento.target.value)
                }
                className="text-corpo min-h-[44px]"
              />
            </label>
            {modo === "compra" ? (
              // O campo "Fornecedor" (Fase 06.2, plano 10 — D-04): o mesmo rótulo de sempre; escolher
              // um fornecedor da lista liga a despesa a ele, escrever o nome continua gravando só o nome.
              // `key` por modo: trocar de pílula começa o campo do outro modo com a lista fechada.
              <CampoFornecedor
                key="compra"
                rotulo={ROTULO_FORNECEDOR_OPCIONAL}
                fornecedores={fornecedores}
                valor={{ texto: pessoaCompra, fornecedorId: fornecedorCompra }}
                aoMudar={(novo) => {
                  setPessoaCompra(novo.texto);
                  setFornecedorCompra(novo.fornecedorId);
                }}
              />
            ) : (
              // O MESMO campo no modo "Outra despesa" (plano 12; D-04 "em todos os modos"; UI-D2): o rótulo
              // diz as duas coisas, porque outra despesa muitas vezes paga quem não é fornecedor.
              <CampoFornecedor
                key="outra"
                rotulo={ROTULO_FORNECEDOR_OU_PARA_QUEM_OPCIONAL}
                fornecedores={fornecedores}
                valor={{ texto: pessoaOutra, fornecedorId: fornecedorOutra }}
                aoMudar={(novo) => {
                  setPessoaOutra(novo.texto);
                  setFornecedorOutra(novo.fornecedorId);
                }}
              />
            )}
          </div>

          {dataAtual !== hoje && (
            <p className="text-apoio text-muted-foreground">{textoDataRetroativa(formatarDataCurta(dataAtual))}</p>
          )}

          {modo === "compra" &&
            (linhasCompra.length === 0 ? (
              <p className="text-corpo text-muted-foreground">{FRASE_VAZIO_DESPESA_COMPRA}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {linhasCompra.map((linha) => (
                  <LinhaCompra
                    key={linha.chave}
                    linha={linha}
                    aoMudarQuantos={mudarQuantos}
                    aoMudarCustou={mudarCustou}
                    aoTirar={tirarLinhaCompra}
                  />
                ))}
              </ul>
            ))}

          <div className="border-border flex items-center justify-between border-t pt-3">
            <span className="text-titulo text-foreground">Total</span>
            <span data-testid="despesa-total" className="text-display text-foreground tabular-nums">
              {formatarReais(totalCentavos)}
            </span>
          </div>

          {/* Fio de separação (item das Considerações do dono, 26/09/2026: ajuste fino de
              respiro) — mesmo tom de borda do fio do Total acima, marcando onde acaba "quanto" e
              começa "como paga"; nada mudou nas regras, só o limite ficou visível. */}
          <div className="border-border border-t" aria-hidden="true" />

          <BlocoPagamento
            tipo="despesa"
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

          {modo === "compra" && (
            <EfeitoEstoque
              efeito={efeito}
              titulo={TITULO_EFEITO_ESTOQUE_COMPRA}
              dica={DICA_EFEITO_ESTOQUE_COMPRA}
              abertoPorPadrao
              testId="despesa-efeito"
              saldos={saldos}
            />
          )}

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
              data-testid={comCorrecao ? "lancar-correcao" : undefined}
            >
              {comCorrecao && correcao !== null ? rotuloLancarCorrecao(correcao.numero) : ROTULO_LANCAR_DESPESA}
            </Button>
          </div>
        </section>
      </div>

      <ListaCompleta
        modo="compra"
        aberto={dialogoListaCompraAberto}
        catalogo={catalogoDaCompra}
        aoFechar={() => setDialogoListaCompraAberto(false)}
        aoTocarItem={tocarItemDaCompra}
      />
    </>
  );
}

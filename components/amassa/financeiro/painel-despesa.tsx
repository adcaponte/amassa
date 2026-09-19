"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { lancarDespesa } from "@/lib/financeiro/acoes";
import type { CategoriaParaEscolha, ItemDoCatalogoParaCompra } from "@/lib/financeiro/consultas";
import { converterQuantidade, converterReaisParaCentavos } from "@/lib/financeiro/dinheiro";
import { efeitoNoEstoque, type ItemParaEfeito } from "@/lib/financeiro/efeito-estoque";
import { formatarDataCurta, formatarReais } from "@/lib/financeiro/formato";
import { conferirParcelas, dividirEmDuasFormas, gerarPlano, type PlanoDePagamento } from "@/lib/financeiro/parcelas";
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
  ROTULO_LANCAR_DESPESA,
  ROTULO_LIMPAR,
  ROTULO_LISTA_COMPLETA_E_ATALHOS,
  ROTULO_PARA_QUEM_OPCIONAL,
  ROTULO_PILULA_COMPRA,
  ROTULO_PILULA_CONTA,
  ROTULO_PILULA_OUTRA,
  ROTULO_VALOR,
  TITULO_EFEITO_ESTOQUE_COMPRA,
  TITULO_ESTA_COMPRA,
  TITULO_O_QUE_CHEGOU,
  TITULO_PAGAMENTO_DESPESA,
  TITULO_QUE_DESPESA_E,
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
import { BlocoPagamento, type ParcelaDoBloco } from "./bloco-pagamento";
import { EfeitoEstoque } from "./efeito-estoque";
import { GradeCatalogo } from "./grade-catalogo";
import { LinhaCompra } from "./linha-compra";
import { ListaCompleta } from "./lista-completa";

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

function centavosParaTexto(centavos: number): string {
  return (centavos / 100).toFixed(2).replace(".", ",");
}

export type PainelDespesaProps = {
  hoje: string;
  categoriasParaDespesa: CategoriaParaEscolha[];
  catalogoDaCompra: ItemDoCatalogoParaCompra[];
  itensParaEfeito: ItemParaEfeito[];
  configuracao: { taxaCartaoPontosBase: number; dataSaldoInicial: string | null };
};

// O painel de Despesa completo (04.4-07-PLAN.md): as três pílulas (compra · outra · "pagar conta
// que já existe", que é só um link para o Caixa), compra de material (busca, atalhos, "quantos"/
// "custou ao todo", o efeito no estoque já aberto) e outra despesa (descrição, categoria, valor,
// a dica do "Fora do resultado"). O MESMO `BlocoPagamento`/`lib/financeiro/parcelas.ts` da Venda
// — nenhuma segunda regra de plano de parcelas. O rascunho vive numa chave PRÓPRIA
// (`CHAVE_RASCUNHO_DESPESA`), com os dois modos guardados ao mesmo tempo (trocar de pílula não
// perde o que foi digitado no outro).
export function PainelDespesa({
  hoje,
  categoriasParaDespesa,
  catalogoDaCompra,
  itensParaEfeito,
  configuracao,
}: PainelDespesaProps) {
  const [modo, setModo] = useState<ModoDespesa>("compra");

  const [dataCompra, setDataCompra] = useState(hoje);
  const [pessoaCompra, setPessoaCompra] = useState("");
  const [linhasCompra, setLinhasCompra] = useState<LinhaDeCompraLocal[]>([]);
  const [buscaCompra, setBuscaCompra] = useState("");
  const [dialogoListaCompraAberto, setDialogoListaCompraAberto] = useState(false);

  const [dataOutra, setDataOutra] = useState(hoje);
  const [pessoaOutra, setPessoaOutra] = useState("");
  const [descricaoOutra, setDescricaoOutra] = useState("");
  const [categoriaOutraId, setCategoriaOutraId] = useState(categoriasParaDespesa[0]?.id ?? "");
  const [valorOutraTexto, setValorOutraTexto] = useState("");

  const [plano, setPlano] = useState<PlanoDePagamento>("avista");
  const [formaPagamento, setFormaPagamento] = useState<FormaDePagamento>("dinheiro");
  const [duasFormas, setDuasFormas] = useState(false);
  const [parcelasPagamento, setParcelasPagamento] = useState<ParcelaDoBloco[]>([]);
  const [erroDoPlano, setErroDoPlano] = useState<string | null>(null);

  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [rascunhoCarregado, setRascunhoCarregado] = useState(false);

  // Lê o rascunho UMA vez, ao montar — os dois modos reconstruídos ao mesmo tempo (chave própria,
  // separada da Venda).
  useEffect(() => {
    const texto = window.sessionStorage.getItem(CHAVE_RASCUNHO_DESPESA) ?? "";
    const catalogoPorId = new Map(catalogoDaCompra.map((item) => [item.id, item]));
    const lido = lerRascunhoDespesa(
      texto,
      catalogoDaCompra.map((item) => item.id),
    );

    setModo(lido.modo);
    if (lido.compra.data) {
      setDataCompra(lido.compra.data);
    }
    if (lido.compra.pessoa) {
      setPessoaCompra(lido.compra.pessoa);
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
        linhas: linhasCompra.map((linha) => ({
          itemId: linha.itemId,
          quantidadeEstoqueTexto: linha.quantidadeEstoqueTexto,
          valorTotalTexto: linha.valorTotalTexto,
        })),
      },
      outra: {
        data: dataOutra,
        pessoa: pessoaOutra,
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
    linhasCompra,
    dataOutra,
    pessoaOutra,
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
  // pagamento da Venda (04.4-06-PLAN.md).
  useEffect(() => {
    if (totalCentavos <= 0) {
      setParcelasPagamento([]);
      setErroDoPlano(null);
      setDuasFormas(false);
      return;
    }
    const resultado = gerarPlano({ plano, totalCentavos, data: dataAtual, forma: formaPagamento });
    setDuasFormas(false);
    if (!resultado.ok) {
      setParcelasPagamento([]);
      setErroDoPlano(resultado.erro);
      return;
    }
    setErroDoPlano(null);
    setParcelasPagamento(
      resultado.parcelas.map((parcela) => ({
        vencimento: parcela.vencimento,
        valorTexto: centavosParaTexto(parcela.valorCentavos),
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

  function ativarOutraForma() {
    const outraForma = FORMAS_EM_ORDEM.find((valor) => valor !== formaPagamento) ?? "dinheiro";
    const resultado = dividirEmDuasFormas({
      totalCentavos,
      primeiroValorCentavos: Math.ceil(totalCentavos / 2),
      data: dataAtual,
      formas: [formaPagamento, outraForma],
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
    const resultado = gerarPlano({ plano: "avista", totalCentavos, data: dataAtual, forma: formaPagamento });
    setDuasFormas(false);
    if (!resultado.ok) {
      setErroDoPlano(resultado.erro);
      setParcelasPagamento([]);
      return;
    }
    setErroDoPlano(null);
    setParcelasPagamento(
      resultado.parcelas.map((parcela) => ({
        vencimento: parcela.vencimento,
        valorTexto: centavosParaTexto(parcela.valorCentavos),
        forma: parcela.forma,
        pago: parcela.paga,
      })),
    );
  }

  function mudarParcela(indice: number, alteracao: Partial<ParcelaDoBloco>) {
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

  function limpar() {
    setLinhasCompra([]);
    setDataCompra(hoje);
    setPessoaCompra("");
    setBuscaCompra("");
    setDescricaoOutra("");
    setCategoriaOutraId(categoriasParaDespesa[0]?.id ?? "");
    setValorOutraTexto("");
    setDataOutra(hoje);
    setPessoaOutra("");
    setErro(null);
    setPlano("avista");
    setFormaPagamento("dinheiro");
    setDuasFormas(false);
    setParcelasPagamento([]);
    setErroDoPlano(null);
    window.sessionStorage.removeItem(CHAVE_RASCUNHO_DESPESA);
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

    const resposta =
      modo === "compra"
        ? await lancarDespesa({
            modo: "compra",
            data: dataCompra,
            pessoa: pessoaCompra.trim() === "" ? undefined : pessoaCompra,
            linhas: linhasCompra.map((linha) => ({
              itemId: linha.itemId,
              quantidadeEstoqueTexto: linha.quantidadeEstoqueTexto,
              valorTotalTexto: linha.valorTotalTexto,
            })),
            parcelas: parcelasParaEnviar,
          })
        : await lancarDespesa({
            modo: "outra",
            data: dataOutra,
            pessoa: pessoaOutra.trim() === "" ? undefined : pessoaOutra,
            descricao: descricaoOutra,
            categoriaId: categoriaOutraId,
            valorTexto: valorOutraTexto,
            parcelas: parcelasParaEnviar,
          });

    setEnviando(false);

    if (!resposta.ok) {
      setErro(resposta.erro);
      return;
    }

    window.sessionStorage.removeItem(CHAVE_RASCUNHO_DESPESA);
    window.location.assign(`/financeiro?aba=despesa&aviso=lancado&documento=${resposta.dados.id}`);
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
      <div className="flex flex-wrap gap-2 px-6 pb-2 md:px-8">
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
        <Link href="/financeiro?aba=caixa" data-testid="despesa-modo-conta" className={pilulaClasse(false)}>
          {ROTULO_PILULA_CONTA}
        </Link>
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
            <label className="text-apoio text-muted-foreground flex flex-col gap-1">
              {modo === "compra" ? ROTULO_FORNECEDOR_OPCIONAL : ROTULO_PARA_QUEM_OPCIONAL}
              <Input
                value={modo === "compra" ? pessoaCompra : pessoaOutra}
                onChange={(evento) =>
                  modo === "compra" ? setPessoaCompra(evento.target.value) : setPessoaOutra(evento.target.value)
                }
                className="text-corpo min-h-[44px]"
              />
            </label>
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
            erroDeGeracao={erroDoPlano}
          />

          {modo === "compra" && (
            <EfeitoEstoque
              efeito={efeito}
              titulo={TITULO_EFEITO_ESTOQUE_COMPRA}
              dica={DICA_EFEITO_ESTOQUE_COMPRA}
              abertoPorPadrao
              testId="despesa-efeito"
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
            >
              {ROTULO_LANCAR_DESPESA}
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

"use client";

import { useEffect, useState } from "react";

import { lancarVenda } from "@/lib/financeiro/acoes";
import type { CategoriaParaEscolha, ItemDoCatalogoParaVenda } from "@/lib/financeiro/consultas";
import { converterReaisParaCentavos } from "@/lib/financeiro/dinheiro";
import { areasDaVenda, listaEmPortugues } from "@/lib/financeiro/documento";
import { efeitoNoEstoque, type ItemParaEfeito } from "@/lib/financeiro/efeito-estoque";
import { formatarDataCurta, formatarReais } from "@/lib/financeiro/formato";
import { CHAVE_RASCUNHO_VENDA, lerRascunho, serializarRascunho, type LinhaDoRascunho } from "@/lib/financeiro/rascunho";
import {
  FRASE_VAZIO_VENDA,
  PLACEHOLDER_PESSOA_VENDA,
  ROTULO_AREA,
  ROTULO_DATA,
  ROTULO_FORMA,
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
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
};

// O painel de venda completo (04.4-03-PLAN.md): catálogo com atalhos/busca/lista completa, valor
// livre, quantidade e preço editável, dica de múltiplas áreas, data retroativa e o efeito no
// estoque. O rascunho sobrevive a trocar de aba/recarregar via `lib/financeiro/rascunho.ts`, na
// mesma aba do navegador.
export function PainelVenda({ hoje, categorias, catalogo, itensParaEfeito }: PainelVendaProps) {
  const [dialogoValorLivreAberto, setDialogoValorLivreAberto] = useState(false);
  const [dialogoListaAberto, setDialogoListaAberto] = useState(false);
  const [linhas, setLinhas] = useState<LinhaLocal[]>([]);
  const [data, setData] = useState(hoje);
  const [pessoa, setPessoa] = useState("");
  const [forma, setForma] = useState<FormaDePagamento>("pix");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroDeArea>("tudo");
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
      serializarRascunho({ data, pessoa, linhas: linhasParaGravar, desconto: null }),
    );
  }, [linhas, data, pessoa, rascunhoCarregado]);

  // Cada linha convertida para exibição: subtotal e validade (item precisa de valor > 0).
  const linhasParaExibir: (LinhaDoCarrinho & { valido: boolean })[] = linhas.map((linha) => {
    if (linha.tipo === "livre") {
      return {
        chave: linha.chave,
        tipo: "livre",
        nome: linha.descricao,
        area: linha.area,
        subtotalCentavos: linha.valorCentavos,
        valido: true,
      };
    }
    const resultado = converterReaisParaCentavos(linha.valorUnitarioTexto);
    const valorUnitarioCentavos = resultado.ok ? resultado.centavos : null;
    const valido = valorUnitarioCentavos != null && valorUnitarioCentavos > 0;
    return {
      chave: linha.chave,
      tipo: "item",
      nome: linha.nome,
      area: linha.area,
      quantidade: linha.quantidade,
      valorUnitarioTexto: linha.valorUnitarioTexto,
      valorUnitarioCentavos,
      subtotalCentavos: valido ? valorUnitarioCentavos * linha.quantidade : 0,
      precoDeTabelaCentavos: linha.precoDeTabelaCentavos,
      valido,
    };
  });

  const totalCentavos = linhasParaExibir.reduce((total, linha) => total + linha.subtotalCentavos, 0);
  const todasValidas = linhasParaExibir.every((linha) => linha.valido);
  const podeLancar = linhas.length > 0 && todasValidas && !enviando;

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
    setErro(null);
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
      // À vista: UMA parcela, paga na data do documento.
      parcelas: [
        {
          vencimento: data,
          valorTexto: centavosParaTexto(totalCentavos),
          forma,
          pago: true,
        },
      ],
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

        {areas.length > 1 && (
          <p data-testid="venda-dica-areas" className="text-apoio text-muted-foreground">
            {textoDicaDeAreas(listaEmPortugues(nomesDeAreas))}
          </p>
        )}

        <fieldset className="flex flex-col gap-2">
          <legend className="text-apoio text-muted-foreground">Forma</legend>
          <div className="flex gap-2">
            {FORMAS_EM_ORDEM.map((valor) => (
              <button
                key={valor}
                type="button"
                aria-pressed={forma === valor}
                onClick={() => setForma(valor)}
                className={cn(
                  "text-corpo min-h-[44px] flex-1 rounded-md border px-3",
                  forma === valor
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border bg-secondary text-secondary-foreground",
                )}
              >
                {ROTULO_FORMA[valor]}
              </button>
            ))}
          </div>
        </fieldset>

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

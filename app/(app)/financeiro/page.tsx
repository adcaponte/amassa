import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { abaDaUrl, formaDaUrl, mesDaUrl } from "@/lib/financeiro/abas";
import { avisoDaUrl } from "@/lib/financeiro/avisos";
import {
  listarCatalogoDaCompra,
  listarCatalogoDaVenda,
  listarCategoriasParaEscolha,
  listarContasEmAberto,
  listarDocumentosDoMes,
  listarDocumentosParaDetalhe,
  listarItensParaEfeito,
  listarMovimentos,
  listarParcelasEmAberto,
  listarParcelasPagasNoMes,
  obterConfiguracaoFinanceira,
  obterDocumentoParaAviso,
  obterParcelaParaAviso,
} from "@/lib/financeiro/consultas";
import { mesAnterior, mesSeguinte } from "@/lib/financeiro/calendario";
import { filtrarExtrato, montarExtrato, resumoDoCaixa } from "@/lib/financeiro/extrato";
import { formatarReais, hojeEmBrasilia } from "@/lib/financeiro/formato";
import { resumoDoMes } from "@/lib/financeiro/mes";
import {
  textoCancelado,
  textoDespesaLancada,
  textoDoDesfazer,
  textoDoPagamento,
  textoVendaLancada,
} from "@/lib/financeiro/textos";
import { AbasFinanceiro } from "@/components/amassa/financeiro/abas-financeiro";
import { AvisoFinanceiro } from "@/components/amassa/financeiro/aviso-financeiro";
import { ExtratoCaixa } from "@/components/amassa/financeiro/extrato-caixa";
import { ListasCaixa } from "@/components/amassa/financeiro/listas-caixa";
import { PainelDespesa } from "@/components/amassa/financeiro/painel-despesa";
import { PainelMes } from "@/components/amassa/financeiro/painel-mes";
import { PainelVenda } from "@/components/amassa/financeiro/painel-venda";
import { TilesCaixa } from "@/components/amassa/financeiro/tiles-caixa";

const FORMAS_DO_FILTRO_EXTRATO = ["todas", "dinheiro", "pix", "cartao"] as const;

// `exigirUsuario()` como PRIMEIRA instrução — mesmo padrão de `app/(app)/abertura/page.tsx`.
// `searchParams` é `Promise` no Next.js 15. `?aba=` decide Venda, Despesa, Caixa ou Mês; o aviso
// pós-navegação é resolvido AQUI, no servidor, a partir de `?aviso=lancado&documento=<id>` — o
// texto pronto desce para `AvisoFinanceiro`, que só mostra o toast, nunca monta a frase sozinho.
export default async function PaginaFinanceiro({
  searchParams,
}: {
  searchParams: Promise<{
    aba?: string;
    aviso?: string;
    documento?: string;
    parcela?: string;
    mes?: string;
    forma?: string;
  }>;
}) {
  await exigirUsuario();

  const { aba, aviso, documento, parcela, mes, forma } = await searchParams;
  const abaAtual = abaDaUrl(aba);
  const abaVenda = abaAtual === "venda";
  const abaDespesa = abaAtual === "despesa";
  const abaCaixa = abaAtual === "caixa";
  const abaMes = abaAtual === "mes";
  const hoje = hojeEmBrasilia(new Date());
  // O MESMO `?mes=` alimenta o extrato do Caixa (D-11/D-12) e a aba Mês — nunca ao mesmo tempo (só
  // uma delas está ativa por navegação), então reaproveitar a mesma chave de URL é seguro. `forma`
  // só existe no extrato (o filtro por forma não faz sentido na tela Mês).
  const mesAtual = mesDaUrl(mes, hoje);
  const formaDoExtrato = formaDaUrl(forma);

  const avisoResolvido = avisoDaUrl({ aviso, documento, parcela });

  // Uma leitura por lista, nunca uma consulta a mais que a aba atual precisa (mesma disciplina de
  // `app/(app)/abertura/page.tsx`). O valor livre aceita categoria de Receitas OU Fora do
  // resultado (suposição 1 do plano 03 — é por aí que um aporte dos sócios entra no caixa); a
  // Despesa "outra" aceita Geral, Custos diretos de uma área OU Fora do resultado (04.4-07-PLAN.md).
  const [
    categoriasParaValorLivre,
    catalogo,
    categoriasParaDespesa,
    catalogoDaCompra,
    itensParaEfeito,
    configuracao,
    movimentos,
    parcelasEmAberto,
    contasEmAberto,
    documentoDoAviso,
    parcelaDoAviso,
    documentosDoMes,
    parcelasPagasNoMes,
  ] = await Promise.all([
    abaVenda ? listarCategoriasParaEscolha(["receita", "fora"]) : Promise.resolve([]),
    abaVenda ? listarCatalogoDaVenda() : Promise.resolve([]),
    abaDespesa ? listarCategoriasParaEscolha(["geral", "custo", "fora"]) : Promise.resolve([]),
    abaDespesa ? listarCatalogoDaCompra() : Promise.resolve([]),
    abaVenda || abaDespesa ? listarItensParaEfeito() : Promise.resolve([]),
    // A Venda e a Despesa também precisam da configuração — o pagamento (04.4-06/07-PLAN.md) lê
    // a taxa do cartão e a data do saldo inicial para o aviso do cartão e a conferência das
    // parcelas.
    abaVenda || abaDespesa || abaCaixa ? obterConfiguracaoFinanceira() : Promise.resolve(null),
    abaCaixa ? listarMovimentos() : Promise.resolve([]),
    abaCaixa ? listarParcelasEmAberto() : Promise.resolve([]),
    abaCaixa ? listarContasEmAberto() : Promise.resolve([]),
    avisoResolvido && (avisoResolvido.tipo === "lancado" || avisoResolvido.tipo === "cancelado")
      ? obterDocumentoParaAviso(avisoResolvido.documentoId)
      : Promise.resolve(null),
    avisoResolvido && (avisoResolvido.tipo === "pago" || avisoResolvido.tipo === "desfeito")
      ? obterParcelaParaAviso(avisoResolvido.parcelaId)
      : Promise.resolve(null),
    abaMes ? listarDocumentosDoMes(mesAtual) : Promise.resolve([]),
    abaMes ? listarParcelasPagasNoMes(mesAtual) : Promise.resolve([]),
  ]);

  // "pago" só aparece se a parcela AINDA está paga com previsto guardado (recarregar depois de
  // desfazer não oferece desfazer de novo — o `key_link` do plano). A diferença (D-01) só entra
  // na frase quando `diferencaCentavos` não é nulo/zero.
  const pagamentoAindaValido =
    avisoResolvido?.tipo === "pago" && parcelaDoAviso?.paga === true && parcelaDoAviso.previstoCentavos !== null;

  const textoDoAviso =
    avisoResolvido?.tipo === "lancado" && documentoDoAviso
      ? abaDespesa
        ? textoDespesaLancada(
            documentoDoAviso.numero,
            formatarReais(documentoDoAviso.totalCentavos),
            documentoDoAviso.parcelasEmAberto,
          )
        : textoVendaLancada(
            documentoDoAviso.numero,
            formatarReais(documentoDoAviso.totalCentavos),
            documentoDoAviso.parcelasEmAberto,
          )
      : avisoResolvido?.tipo === "cancelado" && documentoDoAviso
        ? textoCancelado(documentoDoAviso.numero)
        : avisoResolvido?.tipo === "pago" && pagamentoAindaValido && parcelaDoAviso
          ? textoDoPagamento(
              parcelaDoAviso.tipo,
              formatarReais(parcelaDoAviso.valorCentavos),
              parcelaDoAviso.diferencaCentavos ? formatarReais(Math.abs(parcelaDoAviso.diferencaCentavos)) : null,
              parcelaDoAviso.diferencaCentavos
                ? parcelaDoAviso.diferencaCentavos > 0
                  ? "a mais"
                  : "a menos"
                : null,
            )
          : avisoResolvido?.tipo === "desfeito" && parcelaDoAviso
            ? textoDoDesfazer(formatarReais(parcelaDoAviso.valorCentavos))
            : null;

  // O "Desfazer" (D-03) só é oferecido junto do aviso `pago` ENQUANTO ele continuar válido.
  const desfazerDoAviso =
    avisoResolvido?.tipo === "pago" && pagamentoAindaValido ? { parcelaId: avisoResolvido.parcelaId } : null;

  // O tile "Saldo em caixa" e o extrato saem da MESMA função (`montarExtrato`) sobre a MESMA
  // lista de movimentos lida acima — é isso que torna "o tile bate com o saldo depois do
  // movimento mais recente" verdadeiro por construção (critério 7 do ROADMAP).
  const extrato = abaCaixa && configuracao ? montarExtrato(movimentos, configuracao.saldoInicialCentavos) : null;
  const resumo = extrato
    ? resumoDoCaixa({ saldoAtualCentavos: extrato.saldoAtualCentavos, abertas: parcelasEmAberto })
    : null;

  // D-11/D-12: `filtrarExtrato` recebe as linhas JÁ com o saldo global de `montarExtrato` — só
  // escolhe quais mostrar (mês + forma), nunca recalcula saldo.
  const extratoFiltrado = extrato
    ? filtrarExtrato(extrato.linhas, { mes: mesAtual, forma: formaDoExtrato })
    : null;

  // Um `href` por seta e por pílula de forma — a forma sobrevive à troca de mês, o mês sobrevive
  // à troca de forma (nenhum dos dois componentes conhece a estrutura da URL, só recebe strings
  // prontas).
  function hrefDoExtrato(mesAlvo: string, formaAlvo: typeof formaDoExtrato): string {
    const sufixoForma = formaAlvo === "todas" ? "" : `&forma=${formaAlvo}`;
    return `/financeiro?aba=caixa&mes=${mesAlvo}${sufixoForma}`;
  }
  const hrefMesAnteriorDoExtrato = hrefDoExtrato(mesAnterior(mesAtual), formaDoExtrato);
  const hrefMesSeguinteDoExtrato = hrefDoExtrato(mesSeguinte(mesAtual), formaDoExtrato);
  const hrefPorForma = Object.fromEntries(
    FORMAS_DO_FILTRO_EXTRATO.map((valor) => [valor, hrefDoExtrato(mesAtual, valor)]),
  ) as Record<(typeof FORMAS_DO_FILTRO_EXTRATO)[number], string>;

  // A tela Mês: `resumoDoMes` é a fonte única da regra (lib/financeiro/mes.ts, testada sem
  // banco); a página só lê as duas listas do mês e monta os dois `href` de navegação.
  const resumoMesAtual = abaMes
    ? resumoDoMes({ mes: mesAtual, documentos: documentosDoMes, parcelasPagas: parcelasPagasNoMes })
    : null;
  const hrefMesAnteriorDaTela = `/financeiro?aba=mes&mes=${mesAnterior(mesAtual)}`;
  const hrefMesSeguinteDaTela = `/financeiro?aba=mes&mes=${mesSeguinte(mesAtual)}`;

  // O detalhe do documento ("Ver") acha o documento numa lista JÁ carregada — nunca uma segunda
  // consulta ao abrir (key_link do plano). `idsParaDetalhe` é a UNIÃO dos documentos das contas em
  // aberto com os do extrato filtrado — uma ÚNICA consulta cobre as duas listas.
  const idsParaDetalhe =
    abaCaixa
      ? [
          ...new Set([
            ...contasEmAberto.map((c) => c.documentoId),
            ...(extratoFiltrado?.linhas.map((l) => l.documentoId) ?? []),
          ]),
        ]
      : [];
  const documentosParaDetalhe = abaCaixa
    ? await listarDocumentosParaDetalhe(idsParaDetalhe)
    : new Map();

  return (
    <>
      <AvisoFinanceiro texto={textoDoAviso} desfazer={desfazerDoAviso} />

      <div className="pt-6">
        <AbasFinanceiro abaAtual={abaAtual} />
      </div>

      {abaCaixa ? (
        <div className="flex flex-col gap-6 px-6 py-6 md:px-8">
          {resumo ? <TilesCaixa resumo={resumo} /> : null}
          <ListasCaixa contas={contasEmAberto} documentos={documentosParaDetalhe} hoje={hoje} />
          {extratoFiltrado ? (
            <ExtratoCaixa
              mes={mesAtual}
              forma={formaDoExtrato}
              extrato={extratoFiltrado}
              hrefMesAnterior={hrefMesAnteriorDoExtrato}
              hrefMesSeguinte={hrefMesSeguinteDoExtrato}
              hrefPorForma={hrefPorForma}
              documentos={documentosParaDetalhe}
            />
          ) : null}
        </div>
      ) : abaMes && resumoMesAtual ? (
        <PainelMes
          mes={mesAtual}
          resumo={resumoMesAtual}
          hrefMesAnterior={hrefMesAnteriorDaTela}
          hrefMesSeguinte={hrefMesSeguinteDaTela}
        />
      ) : abaDespesa ? (
        <PainelDespesa
          hoje={hoje}
          categoriasParaDespesa={categoriasParaDespesa}
          catalogoDaCompra={catalogoDaCompra}
          itensParaEfeito={itensParaEfeito}
          configuracao={{
            taxaCartaoPontosBase: configuracao?.taxaCartaoPontosBase ?? 0,
            dataSaldoInicial: configuracao?.dataSaldoInicial ?? null,
          }}
        />
      ) : (
        <PainelVenda
          hoje={hoje}
          categorias={categoriasParaValorLivre}
          catalogo={catalogo}
          itensParaEfeito={itensParaEfeito}
          configuracao={{
            taxaCartaoPontosBase: configuracao?.taxaCartaoPontosBase ?? 0,
            dataSaldoInicial: configuracao?.dataSaldoInicial ?? null,
          }}
        />
      )}
    </>
  );
}

import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { abaDaUrl } from "@/lib/financeiro/abas";
import { avisoDaUrl } from "@/lib/financeiro/avisos";
import {
  listarCatalogoDaCompra,
  listarCatalogoDaVenda,
  listarCategoriasParaEscolha,
  listarContasEmAberto,
  listarDocumentosParaDetalhe,
  listarItensParaEfeito,
  listarMovimentos,
  listarParcelasEmAberto,
  obterConfiguracaoFinanceira,
  obterDocumentoParaAviso,
} from "@/lib/financeiro/consultas";
import { montarExtrato, resumoDoCaixa } from "@/lib/financeiro/extrato";
import { chaveDoMes, formatarReais, hojeEmBrasilia } from "@/lib/financeiro/formato";
import { textoCancelado, textoDespesaLancada, textoVendaLancada } from "@/lib/financeiro/textos";
import { AbasFinanceiro } from "@/components/amassa/financeiro/abas-financeiro";
import { AvisoFinanceiro } from "@/components/amassa/financeiro/aviso-financeiro";
import { ExtratoCaixa } from "@/components/amassa/financeiro/extrato-caixa";
import { ListasCaixa } from "@/components/amassa/financeiro/listas-caixa";
import { PainelDespesa } from "@/components/amassa/financeiro/painel-despesa";
import { PainelVenda } from "@/components/amassa/financeiro/painel-venda";
import { TilesCaixa } from "@/components/amassa/financeiro/tiles-caixa";

// `exigirUsuario()` como PRIMEIRA instrução — mesmo padrão de `app/(app)/abertura/page.tsx`.
// `searchParams` é `Promise` no Next.js 15. `?aba=` decide Venda ou Caixa (nesta tarefa, só as
// duas); o aviso pós-navegação é resolvido AQUI, no servidor, a partir de
// `?aviso=lancado&documento=<id>` — o texto pronto desce para `AvisoFinanceiro`, que só mostra o
// toast, nunca monta a frase sozinho.
export default async function PaginaFinanceiro({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; aviso?: string; documento?: string; parcela?: string }>;
}) {
  await exigirUsuario();

  const { aba, aviso, documento, parcela } = await searchParams;
  const abaAtual = abaDaUrl(aba);
  const abaVenda = abaAtual === "venda";
  const abaDespesa = abaAtual === "despesa";
  const abaCaixa = abaAtual === "caixa";
  const hoje = hojeEmBrasilia(new Date());

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
  ]);

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
        : // "pago"/"desfeito" (04.4-08-PLAN.md, Tarefa 3) ainda não têm consulta própria — chegam
          // na próxima tarefa desta mesma fase.
          null;

  // O tile "Saldo em caixa" e o extrato saem da MESMA função (`montarExtrato`) sobre a MESMA
  // lista de movimentos lida acima — é isso que torna "o tile bate com o saldo depois do
  // movimento mais recente" verdadeiro por construção (critério 7 do ROADMAP).
  const extrato = abaCaixa && configuracao ? montarExtrato(movimentos, configuracao.saldoInicialCentavos) : null;
  const resumo = extrato
    ? resumoDoCaixa({ saldoAtualCentavos: extrato.saldoAtualCentavos, abertas: parcelasEmAberto })
    : null;

  // Extrato mostra o mês corrente, mais recente primeiro — a navegação por mês/filtro por forma
  // (D-11/D-12) entra num plano futuro; o saldo depois de cada linha continua o acumulado GLOBAL
  // (D-12), calculado acima sobre a lista inteira, nunca recalculado sobre o recorte do mês.
  const chaveDoMesAtual = chaveDoMes(hoje);
  const linhasDoMes = extrato
    ? extrato.linhas.filter((linha) => chaveDoMes(linha.pagoEm) === chaveDoMesAtual).reverse()
    : [];

  // O detalhe do documento ("Ver") acha o documento numa lista JÁ carregada — nunca uma segunda
  // consulta ao abrir (key_link do plano). `idsParaDetalhe` é a UNIÃO dos documentos das contas em
  // aberto com os do extrato do mês; uma ÚNICA consulta cobre as duas listas e o extrato.
  const idsParaDetalhe =
    abaCaixa
      ? [...new Set([...contasEmAberto.map((c) => c.documentoId), ...linhasDoMes.map((l) => l.documentoId)])]
      : [];
  const documentosParaDetalhe = abaCaixa
    ? await listarDocumentosParaDetalhe(idsParaDetalhe)
    : new Map();

  return (
    <>
      <AvisoFinanceiro texto={textoDoAviso} />

      <div className="pt-6">
        <AbasFinanceiro abaAtual={abaAtual} />
      </div>

      {abaCaixa ? (
        <div className="flex flex-col gap-6 px-6 py-6 md:px-8">
          {resumo ? <TilesCaixa resumo={resumo} /> : null}
          <ListasCaixa contas={contasEmAberto} documentos={documentosParaDetalhe} hoje={hoje} />
          <ExtratoCaixa linhas={linhasDoMes} documentos={documentosParaDetalhe} />
        </div>
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

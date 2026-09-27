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
import { numeroDeOrcamento } from "@/lib/orcamentos/formato";
import {
  listarOrcamentos,
  listarPecasParaEscolha,
  listarRevisoes,
  obterOrcamentoParaEdicao,
} from "@/lib/orcamentos/consultas";
import {
  FRASE_ERRO_CARREGAR_ORCAMENTO,
  FRASE_ORCAMENTO_NAO_ENCONTRADO,
  ROTULO_TODOS,
  TOAST_ORCAMENTO_ENVIADO,
  TOAST_ORCAMENTO_REABERTO,
  TOAST_ORCAMENTO_RECUSADO,
  TOAST_PRECOS_ATUALIZADOS,
  textoOrcamentoDuplicado,
  textoRevisaoCriada,
  toastAprovado,
} from "@/lib/orcamentos/textos";
import {
  listarCategoriasDeVenda,
  listarFichas,
  listarFichasParaCopiar,
  obterFichaParaEdicao,
  parametrosVigentes,
} from "@/lib/precificacao/consultas";
import { TOAST_PECA_SALVA } from "@/lib/precificacao/textos";
import { AbasFinanceiro } from "@/components/amassa/financeiro/abas-financeiro";
import { AvisoFinanceiro } from "@/components/amassa/financeiro/aviso-financeiro";
import { ExtratoCaixa } from "@/components/amassa/financeiro/extrato-caixa";
import { ListasCaixa } from "@/components/amassa/financeiro/listas-caixa";
import { PainelDespesa } from "@/components/amassa/financeiro/painel-despesa";
import { PainelMes } from "@/components/amassa/financeiro/painel-mes";
import { PainelVenda } from "@/components/amassa/financeiro/painel-venda";
import { TilesCaixa } from "@/components/amassa/financeiro/tiles-caixa";
import { EditorOrcamento } from "@/components/amassa/orcamentos/editor-orcamento";
import { ListaOrcamentos } from "@/components/amassa/orcamentos/lista-orcamentos";
import { DialogoFicha } from "@/components/amassa/precificacao/dialogo-ficha";
import { ListaPecas } from "@/components/amassa/precificacao/lista-pecas";

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
    documentoId?: string;
    parcela?: string;
    mes?: string;
    forma?: string;
    peca?: string;
    exclusivas?: string;
    orcamento?: string;
  }>;
}) {
  await exigirUsuario();

  const { aba, aviso, documento, documentoId, parcela, mes, forma, peca, exclusivas, orcamento } =
    await searchParams;
  const abaAtual = abaDaUrl(aba);
  const abaVenda = abaAtual === "venda";
  const abaDespesa = abaAtual === "despesa";
  const abaCaixa = abaAtual === "caixa";
  const abaMes = abaAtual === "mes";
  const abaOrcamentos = abaAtual === "orcamentos";
  const abaPecas = abaAtual === "pecas";
  const hoje = hojeEmBrasilia(new Date());

  // "Ver venda no Financeiro" (04.5-12-PLAN.md, D-25) — `?documentoId=<uuid>` abre o detalhe
  // daquele documento assim que a aba Caixa carrega (`ListasCaixa`, prop `documentoParaAbrirId`).
  // Chave DIFERENTE de `?documento=<uuid>` (usada por `avisoDaUrl` para nomear um documento num
  // toast) — os dois propósitos nunca coexistem na mesma navegação, mas nomes iguais confundiriam
  // a leitura deste arquivo.
  const REGEX_UUID_DOCUMENTO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const documentoParaAbrirId =
    abaCaixa && documentoId && REGEX_UUID_DOCUMENTO.test(documentoId) ? documentoId : null;

  // `?orcamento=<uuid>` abre o editor daquele orçamento na mesma rota (must_have do
  // 04.5-06-PLAN.md) — um `<Link>` normal, nunca um estado de cliente.
  const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const orcamentoIdParaEditor =
    abaOrcamentos && orcamento && REGEX_UUID.test(orcamento) ? orcamento : null;

  // `?peca=novo` abre o diálogo em branco; `?peca=<uuid>` abre em edição; qualquer outra coisa
  // (ausente, lixo) mantém o diálogo fechado. Disponível na aba Peças OU dentro do editor de um
  // orçamento (D-19: "+ Peça exclusiva deste pedido"/"ver cálculo", 04.5-06-PLAN.md). `?exclusivas=1`
  // alterna o filtro da Lista de Peças (D-19) — um `<Link>` na mesma rota, sem estado de cliente.
  const contextoDeFicha = abaPecas || orcamentoIdParaEditor !== null;
  const pecaNova = contextoDeFicha && peca === "novo";
  const pecaIdParaEditar =
    contextoDeFicha && peca && peca !== "novo" && REGEX_UUID.test(peca) ? peca : null;
  const mostrarExclusivas = exclusivas === "1";
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
    orcamentos,
    orcamentoParaEditar,
    revisoesDoOrcamento,
    pecasParaEscolha,
    categoriasDeVendaParaFicha,
    parametrosParaFicha,
    fichaParaEditar,
    fichas,
    fichasParaCopiar,
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
    // Fase 04.5 — Tarefa 4: só carrega quando a aba Orçamentos está ativa (a lista), mesma
    // disciplina das demais listas acima.
    abaOrcamentos && !orcamentoIdParaEditor ? listarOrcamentos() : Promise.resolve([]),
    // 04.5-06-PLAN.md — o editor: o orçamento e as linhas com a ficha de cada uma.
    orcamentoIdParaEditor ? obterOrcamentoParaEdicao(orcamentoIdParaEditor) : Promise.resolve(null),
    // "Atualizar preços" (04.5-09-PLAN.md) — o histórico de revisões, para o painel "Só para
    // você"; vazio até a primeira revisão ser confirmada.
    orcamentoIdParaEditor ? listarRevisoes(orcamentoIdParaEditor) : Promise.resolve([]),
    // "+ Peça da lista" (04.5-06-PLAN.md) — as fichas não exclusivas, com o mínimo de hoje
    // resolvido pelo próprio `EditorOrcamento` (a mesma cadeia de cálculo do resto do módulo).
    orcamentoIdParaEditor ? listarPecasParaEscolha() : Promise.resolve([]),
    // Fase 04.5 — Tarefa 3 (04.5-04-PLAN.md): só carrega quando o diálogo da ficha pode abrir —
    // na aba Peças, ou dentro do editor de um orçamento (04.5-06-PLAN.md).
    contextoDeFicha ? listarCategoriasDeVenda() : Promise.resolve([]),
    contextoDeFicha ? parametrosVigentes(hoje) : Promise.resolve(null),
    pecaIdParaEditar ? obterFichaParaEdicao(pecaIdParaEditar) : Promise.resolve(null),
    // 04.5-05-PLAN.md — a Lista de Peças. TODAS as fichas (exclusivas inclusas): quem filtra o
    // que aparece é `ListaPecas` (`mostrarExclusivas`), nunca uma segunda consulta ao alternar.
    abaPecas ? listarFichas() : Promise.resolve([]),
    // Só no modo de criação o diálogo oferece "Começar a partir de" — carregado sempre que o
    // diálogo pode abrir (é uma lista pequena, id+nome+campos copiáveis, mesmo padrão de
    // `listarCategoriasDeVenda`).
    contextoDeFicha ? listarFichasParaCopiar() : Promise.resolve([]),
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
            : avisoResolvido?.tipo === "peca-salva"
              ? TOAST_PECA_SALVA
              : avisoResolvido?.tipo === "orcamento-enviado"
                ? TOAST_ORCAMENTO_ENVIADO
                : avisoResolvido?.tipo === "orcamento-reaberto"
                  ? TOAST_ORCAMENTO_REABERTO
                  : avisoResolvido?.tipo === "orcamento-recusado"
                    ? TOAST_ORCAMENTO_RECUSADO
                    : avisoResolvido?.tipo === "orcamento-duplicado" && orcamentoParaEditar
                      ? textoOrcamentoDuplicado(
                          numeroDeOrcamento(orcamentoParaEditar.ano, orcamentoParaEditar.sequencial),
                        )
                      : avisoResolvido?.tipo === "orcamento-atualizado"
                        ? TOAST_PRECOS_ATUALIZADOS
                        : avisoResolvido?.tipo === "orcamento-revisao-criada" && orcamentoParaEditar
                          ? textoRevisaoCriada(orcamentoParaEditar.revisao)
                          : avisoResolvido?.tipo === "orcamento-aprovado" &&
                              orcamentoParaEditar?.documentoNumero
                            ? toastAprovado(
                                orcamentoParaEditar.documentoNumero,
                                orcamentoParaEditar.encomendaId !== null,
                              )
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
  // aberto, dos do extrato filtrado e (04.5-12-PLAN.md) do documento que "Ver venda no Financeiro"
  // pediu para abrir — uma ÚNICA consulta cobre as três origens.
  const idsParaDetalhe =
    abaCaixa
      ? [
          ...new Set([
            ...contasEmAberto.map((c) => c.documentoId),
            ...(extratoFiltrado?.linhas.map((l) => l.documentoId) ?? []),
            ...(documentoParaAbrirId ? [documentoParaAbrirId] : []),
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
          <ListasCaixa
            contas={contasEmAberto}
            documentos={documentosParaDetalhe}
            hoje={hoje}
            documentoParaAbrirId={documentoParaAbrirId}
          />
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
      ) : abaOrcamentos ? (
        orcamentoIdParaEditor ? (
          // O editor de um orçamento (04.5-06-PLAN.md). Sem o orçamento (id inexistente, ou
          // apagado por outra aba entre a navegação e o carregamento): estado de erro nomeando o
          // que aconteceu, com o caminho de volta — nunca uma tela em branco.
          orcamentoParaEditar && parametrosParaFicha?.ok ? (
            <>
              <EditorOrcamento
                orcamento={orcamentoParaEditar}
                pecasParaEscolha={pecasParaEscolha}
                parametros={parametrosParaFicha.calculo}
                parametrosPorChave={parametrosParaFicha.porChave}
                forno={parametrosParaFicha.forno}
                taxaCartaoPontosBase={parametrosParaFicha.taxaCartaoPontosBase}
                hoje={hoje}
                revisoes={revisoesDoOrcamento}
              />
              <DialogoFicha
                abrirComo={pecaNova ? "novo" : (fichaParaEditar ?? null)}
                categoriasDeVenda={categoriasDeVendaParaFicha}
                fichasParaCopiar={fichasParaCopiar}
                parametros={parametrosParaFicha.calculo}
                forno={parametrosParaFicha.forno}
                taxaCartaoPontosBase={parametrosParaFicha.taxaCartaoPontosBase}
                vindoDoOrcamentoId={orcamentoIdParaEditor}
              />
            </>
          ) : (
            <div className="flex flex-col items-start gap-2 px-6 py-6 md:px-8">
              <p className="text-corpo text-foreground">
                {!orcamentoParaEditar ? FRASE_ORCAMENTO_NAO_ENCONTRADO : FRASE_ERRO_CARREGAR_ORCAMENTO}
              </p>
              <a
                href="/financeiro?aba=orcamentos"
                className="border-border hover:bg-muted text-corpo flex min-h-[44px] items-center rounded-md border px-4"
              >
                {ROTULO_TODOS}
              </a>
            </div>
          )
        ) : (
          <ListaOrcamentos orcamentos={orcamentos} hoje={hoje} />
        )
      ) : abaPecas ? (
        // A Lista de Peças (04.5-05-PLAN.md) é self-contida — cabeçalho + botão quando populada,
        // estado vazio + botão quando não há nenhuma, erro quando os parâmetros não carregam —
        // mesmo molde de `ListaOrcamentos`. O diálogo funciona por cima, via `?peca=`.
        <>
          <ListaPecas
            fichas={fichas}
            mostrarExclusivas={mostrarExclusivas}
            parametros={parametrosParaFicha ?? { ok: false, faltando: [] }}
          />
          {parametrosParaFicha?.ok ? (
            <DialogoFicha
              abrirComo={pecaNova ? "novo" : (fichaParaEditar ?? null)}
              categoriasDeVenda={categoriasDeVendaParaFicha}
              fichasParaCopiar={fichasParaCopiar}
              parametros={parametrosParaFicha.calculo}
              forno={parametrosParaFicha.forno}
              taxaCartaoPontosBase={parametrosParaFicha.taxaCartaoPontosBase}
            />
          ) : (pecaNova || pecaIdParaEditar) ? (
            <p className="text-apoio text-muted-foreground mt-4 px-6 md:px-8">
              Não deu para carregar os parâmetros do cálculo. Verifique a internet e tente de novo.
            </p>
          ) : null}
        </>
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

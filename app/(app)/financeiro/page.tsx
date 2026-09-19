import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { abaDaUrl } from "@/lib/financeiro/abas";
import { avisoDaUrl } from "@/lib/financeiro/avisos";
import {
  listarCategoriasParaEscolha,
  listarMovimentos,
  listarParcelasEmAberto,
  obterConfiguracaoFinanceira,
  obterDocumentoParaAviso,
} from "@/lib/financeiro/consultas";
import { montarExtrato, resumoDoCaixa } from "@/lib/financeiro/extrato";
import { chaveDoMes, formatarReais, hojeEmBrasilia } from "@/lib/financeiro/formato";
import { textoVendaLancada } from "@/lib/financeiro/textos";
import { AbasFinanceiro } from "@/components/amassa/financeiro/abas-financeiro";
import { AvisoFinanceiro } from "@/components/amassa/financeiro/aviso-financeiro";
import { ExtratoCaixa } from "@/components/amassa/financeiro/extrato-caixa";
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
  const abaCaixa = abaAtual === "caixa";
  const hoje = hojeEmBrasilia(new Date());

  const avisoResolvido = avisoDaUrl({ aviso, documento, parcela });

  // Uma leitura por lista, nunca uma consulta a mais que a aba atual precisa (mesma disciplina de
  // `app/(app)/abertura/page.tsx`).
  const [categoriasDeReceita, configuracao, movimentos, parcelasEmAberto, documentoDoAviso] =
    await Promise.all([
      abaAtual === "venda" ? listarCategoriasParaEscolha(["receita"]) : Promise.resolve([]),
      abaCaixa ? obterConfiguracaoFinanceira() : Promise.resolve(null),
      abaCaixa ? listarMovimentos() : Promise.resolve([]),
      abaCaixa ? listarParcelasEmAberto() : Promise.resolve([]),
      avisoResolvido ? obterDocumentoParaAviso(avisoResolvido.documentoId) : Promise.resolve(null),
    ]);

  const textoDoAviso =
    avisoResolvido && documentoDoAviso
      ? textoVendaLancada(
          documentoDoAviso.numero,
          formatarReais(documentoDoAviso.totalCentavos),
          documentoDoAviso.parcelasEmAberto,
        )
      : null;

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

  return (
    <>
      <AvisoFinanceiro texto={textoDoAviso} />

      <div className="pt-6">
        <AbasFinanceiro abaAtual={abaAtual} />
      </div>

      {abaCaixa ? (
        <div className="flex flex-col gap-6 px-6 py-6 md:px-8">
          {resumo ? <TilesCaixa resumo={resumo} /> : null}
          <ExtratoCaixa linhas={linhasDoMes} />
        </div>
      ) : (
        <PainelVenda hoje={hoje} categorias={categoriasDeReceita} />
      )}
    </>
  );
}

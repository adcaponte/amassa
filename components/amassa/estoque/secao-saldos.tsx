import {
  custosDasPecasProntas,
  listarEncomendasParaVinculo,
  listarSaldosDaRequisicao,
  type EncomendaParaVinculo,
  type SaldoDoItem,
} from "@/lib/estoque/consultas";
import { hojeEmBrasilia } from "@/lib/financeiro/formato";
import {
  CORPO_ESTOQUE_VAZIO,
  FRASE_ERRO_CARREGAR_SALDOS,
  TITULO_ERRO,
  TITULO_ESTOQUE_VAZIO,
} from "@/lib/estoque/textos";
import { EstadoErro } from "@/components/amassa/estado-erro";
import { EstadoVazio } from "@/components/amassa/estado-vazio";
import { TentarDeNovo } from "@/components/amassa/inicio/tentar-de-novo";

import { AbaSaldos } from "./aba-saldos";
import { EntregaDoEstoque } from "./provedor-estoque";

export type SecaoSaldosProps = {
  acabandoInicial: boolean;
};

// A seção de saldos — Server Component `async`, montada dentro de um `Suspense` da página (o
// esqueleto é `EsqueletoSaldos`). Molde de `inicio/bloco-producao.tsx`: a leitura num
// `try`/`catch`; a falha vai para o log do servidor (nunca detalhe do banco na tela — T-06-20) e a
// tela mostra o `EstadoErro` com a frase humana e "Tentar de novo".
//
// Junto com a lista vêm o que a folha de movimentação precisa (plano 06-06): as encomendas em
// andamento ("Qual encomenda?") e o custo por peça das peças prontas com ficha, com os parâmetros
// de HOJE em Brasília. Tudo vai ao `ProvedorDoEstoque` pela `EntregaDoEstoque` — o seletor "Qual
// material?" usa esta MESMA lista e abre sem consulta nova. Se a leitura falha, o provedor recebe o
// erro: o seletor mostra o mesmo `EstadoErro`, nunca uma lista vazia que pareça "nenhum material".
//
// O banner é derivado da MESMA lista, dentro da `AbaSaldos`: se a consulta falha ou ainda carrega,
// ele não existe — o `EstadoErro` é a única mensagem (UI · error/loading · E2).
export async function SecaoSaldos({ acabandoInicial }: SecaoSaldosProps) {
  let saldos: SaldoDoItem[] = [];
  let encomendas: EncomendaParaVinculo[] = [];
  let custos = new Map<string, number>();
  let falhou = false;

  try {
    saldos = await listarSaldosDaRequisicao();
    const pecasProntas = saldos.filter((saldo) => saldo.ehPecaPronta).map((saldo) => saldo.id);
    [encomendas, custos] = await Promise.all([
      listarEncomendasParaVinculo(),
      custosDasPecasProntas(pecasProntas, hojeEmBrasilia(new Date())),
    ]);
  } catch (erro) {
    console.error("Falha ao carregar os saldos do Estoque:", erro);
    falhou = true;
  }

  if (falhou) {
    return (
      <>
        <EntregaDoEstoque lista={{ estado: "erro" }} />
        <EstadoErro
          titulo={TITULO_ERRO}
          corpo={FRASE_ERRO_CARREGAR_SALDOS}
          acao={<TentarDeNovo />}
          dataTestId="estoque-saldos-erro"
        />
      </>
    );
  }

  const entrega = (
    <EntregaDoEstoque
      lista={{
        estado: "pronta",
        saldos,
        encomendas,
        custosDasPecasProntas: Object.fromEntries(custos),
      }}
    />
  );

  // Nenhum item com estoque próprio: o vazio do traçador (06-01). O botão "+ Novo material" entra
  // no plano 06-09, junto com a folha que ele abre — botão sem destino é defeito.
  if (saldos.length === 0) {
    return (
      <>
        {entrega}
        <EstadoVazio titulo={TITULO_ESTOQUE_VAZIO} corpo={CORPO_ESTOQUE_VAZIO} testId="estoque-vazio" />
      </>
    );
  }

  return (
    <>
      {entrega}
      <AbaSaldos saldos={saldos} acabandoInicial={acabandoInicial} />
    </>
  );
}

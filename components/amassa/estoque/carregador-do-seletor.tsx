import {
  custosDasPecasProntas,
  listarCategoriasDeCompraAtivas,
  listarEncomendasParaVinculo,
  listarSaldosDaRequisicao,
} from "@/lib/estoque/consultas";
import { hojeEmBrasilia } from "@/lib/financeiro/formato";

import { EntregaDoEstoque, type DadosDoEstoque, type ListaDoEstoque } from "./provedor-estoque";

// O que a folha de movimentação, o seletor "Qual material?" e o banner precisam — lido numa função
// só, para a aba Saldos (`SecaoSaldos`) e as outras abas (`CarregadorDoSeletor`) nunca divergirem: a
// lista de saldos pela MESMA consulta em `cache` da requisição (`listarSaldosDaRequisicao`) e, em
// paralelo, as encomendas em andamento e o custo por peça das peças prontas com os parâmetros de
// HOJE em Brasília. O `Map` vira objeto simples antes de atravessar para o cliente. Lança se
// qualquer leitura falhar — quem chama decide a tela de erro.
export async function lerDadosDoEstoque(): Promise<DadosDoEstoque> {
  const saldos = await listarSaldosDaRequisicao();
  const pecasProntas = saldos.filter((saldo) => saldo.ehPecaPronta).map((saldo) => saldo.id);
  const [encomendas, custos, categoriasDeCompra] = await Promise.all([
    listarEncomendasParaVinculo(),
    custosDasPecasProntas(pecasProntas, hojeEmBrasilia(new Date())),
    // As opções do "+ Novo material" (plano 06-09) — uma consulta pequena, junto com o resto.
    listarCategoriasDeCompraAtivas(),
  ]);
  return {
    saldos,
    encomendas,
    custosDasPecasProntas: Object.fromEntries(custos),
    categoriasDeCompra,
  };
}

// Fora da aba Saldos (Histórico, Para onde foi), ninguém entrega a lista ao `ProvedorDoEstoque` —
// e sem ela "Registrar movimentação" abriria um seletor eternamente carregando, e o banner não
// existiria. Este carregador não desenha nada: lê os mesmos dados da aba Saldos e os ENTREGA ao
// provedor. A página o monta num `Suspense` com `fallback={null}` — a aba da vez não espera por ele.
// Se a leitura falhar, o provedor recebe o erro: o seletor mostra o `EstadoErro` com "Tentar de
// novo", nunca uma lista vazia que pareça "nenhum material"; o banner some.
export async function CarregadorDoSeletor() {
  let lista: ListaDoEstoque;
  try {
    lista = { estado: "pronta", ...(await lerDadosDoEstoque()) };
  } catch (erro) {
    console.error("Falha ao carregar a lista do seletor do Estoque:", erro);
    lista = { estado: "erro" };
  }
  return <EntregaDoEstoque lista={lista} />;
}

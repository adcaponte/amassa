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
import { BotaoNovoMaterial } from "./barra-acao-fixa";
import { lerDadosDoEstoque } from "./carregador-do-seletor";
import { EntregaDoEstoque, type DadosDoEstoque } from "./provedor-estoque";

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
// de HOJE em Brasília — lidos por `lerDadosDoEstoque` (carregador-do-seletor.tsx), a MESMA função que
// entrega a lista ao provedor nas outras abas (plano 06-07). Tudo vai ao `ProvedorDoEstoque` pela `EntregaDoEstoque` — o seletor "Qual
// material?" usa esta MESMA lista e abre sem consulta nova. Se a leitura falha, o provedor recebe o
// erro: o seletor mostra o mesmo `EstadoErro`, nunca uma lista vazia que pareça "nenhum material".
//
// O banner é derivado da MESMA lista, pelo provedor, acima das abas (`BannerDoEstoque`, plano 06-07):
// se a consulta falha ou ainda carrega, ele não existe — o `EstadoErro` é a única mensagem (UI ·
// error/loading · E2).
export async function SecaoSaldos({ acabandoInicial }: SecaoSaldosProps) {
  let dados: DadosDoEstoque | null = null;

  try {
    dados = await lerDadosDoEstoque();
  } catch (erro) {
    console.error("Falha ao carregar os saldos do Estoque:", erro);
  }

  if (dados === null) {
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

  const { saldos } = dados;
  const entrega = <EntregaDoEstoque lista={{ estado: "pronta", ...dados }} />;

  // Nenhum item com estoque próprio: o vazio do traçador (06-01), com "+ Novo material" PRIMÁRIO
  // (plano 06-09) — nesse estado a página não desenha a barra fixa nem as ações do cabeçalho, e
  // este é o único terracota da tela (UI-D3).
  if (saldos.length === 0) {
    return (
      <>
        {entrega}
        <EstadoVazio
          titulo={TITULO_ESTOQUE_VAZIO}
          corpo={CORPO_ESTOQUE_VAZIO}
          testId="estoque-vazio"
          botao={<BotaoNovoMaterial destaque />}
        />
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

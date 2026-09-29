import { listarSaldos, type SaldoDoItem } from "@/lib/estoque/consultas";
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

export type SecaoSaldosProps = {
  acabandoInicial: boolean;
};

// A seção de saldos — Server Component `async`, montada dentro de um `Suspense` da página (o
// esqueleto é `EsqueletoSaldos`). Molde de `inicio/bloco-producao.tsx`: `listarSaldos()` num
// `try`/`catch`; a falha vai para o log do servidor (nunca detalhe do banco na tela — T-06-20) e a
// tela mostra o `EstadoErro` com a frase humana e "Tentar de novo".
//
// O banner é derivado da MESMA lista, dentro da `AbaSaldos`: se a consulta falha ou ainda carrega,
// ele não existe — o `EstadoErro` é a única mensagem (UI · error/loading · E2).
export async function SecaoSaldos({ acabandoInicial }: SecaoSaldosProps) {
  let saldos: SaldoDoItem[] = [];
  let falhou = false;

  try {
    saldos = await listarSaldos();
  } catch (erro) {
    console.error("Falha ao carregar os saldos do Estoque:", erro);
    falhou = true;
  }

  if (falhou) {
    return (
      <EstadoErro
        titulo={TITULO_ERRO}
        corpo={FRASE_ERRO_CARREGAR_SALDOS}
        acao={<TentarDeNovo />}
        dataTestId="estoque-saldos-erro"
      />
    );
  }

  // Nenhum item com estoque próprio: o vazio do traçador (06-01). O botão "+ Novo material" entra
  // no plano 06-09, junto com a folha que ele abre — botão sem destino é defeito.
  if (saldos.length === 0) {
    return (
      <EstadoVazio titulo={TITULO_ESTOQUE_VAZIO} corpo={CORPO_ESTOQUE_VAZIO} testId="estoque-vazio" />
    );
  }

  return <AbaSaldos saldos={saldos} acabandoInicial={acabandoInicial} />;
}

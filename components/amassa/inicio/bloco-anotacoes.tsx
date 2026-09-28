import { lerFolhaDaCasa } from "@/lib/anotacoes/consultas";
import { FRASE_ERRO_DO_BLOCO } from "@/lib/anotacoes/textos";
import { EstadoErro } from "@/components/amassa/estado-erro";
import { BlocoDoInicio } from "./bloco-do-inicio";
import { EditorDeAnotacoes } from "./editor-de-anotacoes";
import { TentarDeNovo } from "./tentar-de-novo";

// O quinto bloco do Início (D-08/GES-07): as Anotações da casa. Server Component `async` com
// `try`/`catch` PRÓPRIO, no MESMO molde dos outros quatro blocos (D-09) — um bloco que falha não
// derruba a página. Sem `acaoRotulo`/`acaoHref`: ao contrário de Financeiro/Produção/Estoque, a
// folha não tem uma tela própria para "abrir" — o bloco inteiro É a tela.
export async function BlocoAnotacoes() {
  let falhou = false;
  let textoInicial = "";
  let salvoPorNomeInicial: string | null = null;
  let atualizadoEmInicial = "";

  try {
    const folha = await lerFolhaDaCasa();
    textoInicial = folha.texto;
    salvoPorNomeInicial = folha.salvoPorNome;
    atualizadoEmInicial = folha.atualizadoEm;
  } catch (erro) {
    console.error("Falha ao carregar as anotações da casa no Início:", erro);
    falhou = true;
  }

  return (
    <BlocoDoInicio titulo="Anotações" dataTestId="inicio-bloco-anotacoes">
      {falhou ? (
        <EstadoErro
          titulo="Algo não funcionou."
          corpo={FRASE_ERRO_DO_BLOCO}
          acao={<TentarDeNovo />}
        />
      ) : (
        <EditorDeAnotacoes
          textoInicial={textoInicial}
          salvoPorNomeInicial={salvoPorNomeInicial}
          atualizadoEmInicial={atualizadoEmInicial}
        />
      )}
    </BlocoDoInicio>
  );
}

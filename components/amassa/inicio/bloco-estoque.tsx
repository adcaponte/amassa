import { TEXTOS_DOS_BLOCOS } from "@/lib/inicio/textos";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import { BlocoDoInicio } from "./bloco-do-inicio";

// GES-09: o módulo de Estoque ainda não existe — este bloco não faz consulta nenhuma, mostra só
// o estado vazio (verbatim do protótipo). Quando o Estoque entrar, este bloco ganha a consulta
// real (e um `try`/`catch` próprio, D-09); nada mais muda de forma.
export function BlocoEstoque() {
  return (
    <BlocoDoInicio
      titulo="Estoque acabando"
      acaoRotulo="abrir estoque"
      acaoHref={rotaDeGestao("/estoque")}
      dataTestId="inicio-bloco-estoque"
    >
      <p className="text-corpo text-muted-foreground">{TEXTOS_DOS_BLOCOS.estoque.vazio}</p>
    </BlocoDoInicio>
  );
}

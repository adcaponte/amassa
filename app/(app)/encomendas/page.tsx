import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { CabecalhoPagina } from "@/components/amassa/cabecalho-pagina";
import { EstadoVazio } from "@/components/amassa/estado-vazio";

// `exigirUsuario()` como PRIMEIRA instrução — regra do CLAUDE.md, verificada por
// `npm run verificar-acoes`. Copy literal de 02b-UI-SPEC.md "Estados vazios por tela" (D-05: a
// única frase pré-escrita da fase).
export default async function PaginaEncomendas() {
  await exigirUsuario();

  return (
    <>
      <CabecalhoPagina titulo="Encomendas" />
      <EstadoVazio
        titulo="A roda ainda não gira."
        corpo="Quando a primeira encomenda entrar, o cronograma com as seis etapas aparece bem aqui."
        rotuloBotao="Nova encomenda"
        notaBotao="Chega na Fase 3."
      />
    </>
  );
}

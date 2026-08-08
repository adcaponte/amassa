import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { CabecalhoPagina } from "@/components/amassa/cabecalho-pagina";
import { EstadoVazio } from "@/components/amassa/estado-vazio";

// `exigirUsuario()` como PRIMEIRA instrução — mesmo padrão de app/(app)/encomendas/page.tsx.
export default async function PaginaQueimas() {
  await exigirUsuario();

  return (
    <>
      <CabecalhoPagina titulo="Queimas" />
      <EstadoVazio
        titulo="Nenhum forno cadastrado ainda."
        corpo="Cadastre o primeiro forno para começar a contar as queimas em dois toques."
        rotuloBotao="Novo forno"
        notaBotao="Chega na Fase 4."
      />
    </>
  );
}

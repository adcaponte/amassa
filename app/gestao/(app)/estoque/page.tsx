import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { CabecalhoPagina } from "@/components/amassa/cabecalho-pagina";
import { EstadoVazio } from "@/components/amassa/estado-vazio";

// `exigirUsuario()` como PRIMEIRA instrução — mesmo padrão de app/(app)/encomendas/page.tsx.
export default async function PaginaEstoque() {
  await exigirUsuario();

  return (
    <>
      <CabecalhoPagina titulo="Estoque" />
      <EstadoVazio
        titulo="Nada no estoque ainda."
        corpo="Cadastre o primeiro material — cerâmica, pintura ou bordado — para começar a controlar o saldo."
        rotuloBotao="Novo material"
        notaBotao="Chega na Fase 6."
      />
    </>
  );
}

import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { CabecalhoPagina } from "@/components/amassa/cabecalho-pagina";
import { FormularioTrocaDeSenha } from "@/components/amassa/conta/formulario-troca-de-senha";

// `exigirUsuario()` como PRIMEIRA instrução — a rota não entra em ROTAS_PUBLICAS, então fica
// protegida sem nenhuma configuração adicional. Rota, não diálogo: funciona igual nos dois
// viewports sem duplicar `Dialog` + `Sheet` nem esbarrar nas armadilhas de composição do Radix
// já documentadas em `menu-usuario.tsx`. `app/(app)/error.tsx` e `app/(app)/loading.tsx` já
// cobrem esta rota — nenhum arquivo por rota é necessário aqui.
export default async function PaginaTrocarSenha() {
  await exigirUsuario();

  return (
    <>
      <CabecalhoPagina titulo="Trocar senha" />
      <div className="px-6 py-6 md:px-8">
        <FormularioTrocaDeSenha />
      </div>
    </>
  );
}

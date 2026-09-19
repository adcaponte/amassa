import type { ReactNode } from "react";

import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { TITULO_MODULO } from "@/lib/cadastros/textos";
import { CabecalhoPagina } from "@/components/amassa/cabecalho-pagina";
import { AbasFinanceiro } from "@/components/amassa/financeiro/abas-financeiro";

// `exigirUsuario()` como PRIMEIRA instrução — mesmo padrão de `app/(app)/financeiro/layout.tsx`.
// A MESMA barra de 5 pílulas do Financeiro aparece aqui no topo (D-06, UI-SPEC §"Sub-navegação
// do Financeiro") — para o gestor voltar a Venda/Caixa sem passar pelo menu do usuário.
// `abaAtual={null}`: nenhuma pílula de `?aba=` faz sentido fora de `/financeiro`; só "Cadastros"
// fica selecionada, resolvido dentro do próprio `AbasFinanceiro` via `usePathname()`.
export default async function LayoutCadastros({ children }: { children: ReactNode }) {
  await exigirUsuario();

  return (
    <>
      <CabecalhoPagina titulo={TITULO_MODULO} />
      <div className="pt-6">
        <AbasFinanceiro abaAtual={null} />
      </div>
      {children}
    </>
  );
}

import type { ReactNode } from "react";

import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { TITULO_MODULO } from "@/lib/financeiro/textos";
import { CabecalhoPagina } from "@/components/amassa/cabecalho-pagina";

// `exigirUsuario()` como PRIMEIRA instrução — mesmo padrão de `app/(app)/abertura/layout.tsx`.
export default async function LayoutFinanceiro({ children }: { children: ReactNode }) {
  await exigirUsuario();

  return (
    <>
      <CabecalhoPagina titulo={TITULO_MODULO} />
      {children}
    </>
  );
}

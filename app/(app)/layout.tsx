import type { ReactNode } from "react";

import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { BarraLateral } from "@/components/amassa/barra-lateral";
import { BarraInferior } from "@/components/amassa/barra-inferior";
import { CabecalhoMovel } from "@/components/amassa/cabecalho-movel";

// A casca de navegação que envolve toda rota protegida: barra lateral fixa de 240px no
// desktop, cabeçalho com avatar + barra inferior de 5 itens no celular. `exigirUsuario()`
// como PRIMEIRA instrução do corpo — regra do CLAUDE.md, verificada por
// `npm run verificar-acoes`. As páginas continuam chamando por conta própria; a chamada é
// idempotente e não faz consulta nova ao banco na segunda vez dentro da mesma requisição.
export default async function LayoutApp({ children }: { children: ReactNode }) {
  const usuario = await exigirUsuario();

  return (
    <div className="flex min-h-screen bg-background">
      <BarraLateral nome={usuario.nome} />

      <div className="flex min-w-0 flex-1 flex-col">
        <CabecalhoMovel nome={usuario.nome} />

        <main className="flex-1 pb-[calc(56px+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </main>

        <BarraInferior />
      </div>
    </div>
  );
}

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EstadoErro } from "@/components/amassa/estado-erro";

// 404 da raiz — é este arquivo que o Next.js usa para QUALQUER URL que não case com rota
// nenhuma da aplicação, independente de grupo de rotas (comportamento documentado do App
// Router: o not-found.tsx aninhado em `app/(app)/` só atende chamadas de `notFound()` dentro
// daquele segmento já casado; uma URL sem casamento nenhum nunca chega a entrar na árvore de
// layout do grupo). Por isso este arquivo fica FORA da casca (`app/(app)/layout.tsx` nunca
// roda para ele) — o que o Next.js permite nesse nível é só o layout raiz (`app/layout.tsx`).
//
// T-02b-01 (threat model): por ficar fora do grupo protegido, este arquivo nunca pode exibir
// dado de sessão — só copy estática. O middleware continua rodando antes dele e redireciona
// quem não tem sessão para /login; este componente nunca decide isso.
export default function NaoEncontradoRaiz() {
  return (
    <EstadoErro
      titulo="Esta página não existe."
      corpo="Verifique o endereço ou volte para o painel."
      acao={
        <Button asChild variant="default">
          <Link href="/">Voltar para o painel</Link>
        </Button>
      }
    />
  );
}

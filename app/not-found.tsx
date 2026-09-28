import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EstadoErro } from "@/components/amassa/estado-erro";

// 404 da raiz — é este arquivo que o Next.js usa para QUALQUER URL que não case com rota
// nenhuma da aplicação, independente de grupo de rotas (comportamento documentado do App
// Router: o not-found.tsx aninhado no grupo protegido só atende chamadas de `notFound()` dentro
// daquele segmento já casado; uma URL sem casamento nenhum nunca chega a entrar na árvore de
// layout do grupo). Por isso este arquivo fica FORA da casca — o que o Next.js permite nesse
// nível é só o layout raiz (`app/layout.tsx`).
//
// Fase 04.6 (D-03/GES-06): a partir desta fase, "/" é o SITE PÚBLICO — qualquer visitante da
// internet, sem sessão nenhuma, pode ver este 404 (T-04.6-02). Nada aqui menciona painel,
// plataforma ou gestão, e não há link nenhum para a plataforma: acesso a ela é só por endereço
// direto (decisão do dono), e um 404 hospitaleiro desfaria essa decisão sem ninguém notar. O
// botão volta para a PÁGINA INICIAL DO SITE (`/`), nunca para a plataforma.
//
// T-02b-01 (threat model): por ficar fora do grupo protegido, este arquivo nunca pode exibir
// dado de sessão — só copy estática. O middleware, a partir desta fase, nem roda mais para este
// caminho — o `config.matcher` de `middleware.ts` só alcança o prefixo protegido.
export default function NaoEncontradoRaiz() {
  return (
    <EstadoErro
      dataTestId="quatro-cento-e-quatro-publico"
      titulo="Esta página não existe."
      corpo="Verifique o endereço e tente de novo."
      acao={
        <Button asChild variant="default">
          <Link href="/">Voltar para a página inicial</Link>
        </Button>
      }
    />
  );
}

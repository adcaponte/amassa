import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EstadoErro } from "@/components/amassa/estado-erro";

// 404 dentro da casca protegida — atende chamadas da função `notFound()` disparadas por uma
// página deste grupo (por exemplo, no futuro, uma rota dinâmica como `/encomendas/[id]` cujo id
// não existe). Uma URL que não casa com rota alguma do sistema NÃO passa por aqui: cai direto
// em `app/not-found.tsx` na raiz, porque o Next.js só entra na árvore de layout de um segmento
// depois de casar a URL com ela — sem casamento nenhum, não há layout de grupo para renderizar
// dentro dele (comportamento documentado do App Router, confirmado em execução real para este
// plano, ver 02b-04-SUMMARY.md).
export default function NaoEncontradoApp() {
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

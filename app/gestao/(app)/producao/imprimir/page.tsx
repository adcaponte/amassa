import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { hojeEmBrasilia } from "@/lib/financeiro/formato";
import { ordensParaAFolhaGeral } from "@/lib/producao/consultas";
import { secoesDaFolhaGeral } from "@/lib/producao/folhas";
import {
  CORPO_NADA_PARA_IMPRIMIR,
  ROTULO_VOLTAR_PRODUCAO,
  TITULO_NADA_PARA_IMPRIMIR,
  formatarDataCompleta,
} from "@/lib/producao/textos";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import { Button } from "@/components/ui/button";
import { EstadoVazio } from "@/components/amassa/estado-vazio";
import { BotaoImprimirFolha } from "@/components/amassa/producao/botao-imprimir-folha";
import { FolhaGeralA4 } from "@/components/amassa/producao/folha-geral";
import estilos from "@/components/amassa/producao/folha-a4.module.css";

// `/gestao/producao/imprimir` — a folha geral A4 (Fase 06.1, plano 13, PRD-20), por CSS de
// impressão; substitui a folha de `/gestao/encomendas/imprimir` (ENC-14). `exigirUsuario()` como
// PRIMEIRA instrução (CLAUDE.md; T-06.1-50). Mostra SEMPRE todas as ordens liberadas e aguardando,
// independente do filtro da tela. "Hoje" (a data do cabeçalho, os dias nesta etapa e o rodapé) é
// decidido aqui, no servidor, em Brasília.
export default async function PaginaFolhaGeral() {
  await exigirUsuario();
  const hoje = hojeEmBrasilia(new Date());

  const folha = secoesDaFolhaGeral(await ordensParaAFolhaGeral(), hoje);

  if (folha.vazia) {
    return (
      <EstadoVazio
        titulo={TITULO_NADA_PARA_IMPRIMIR}
        corpo={CORPO_NADA_PARA_IMPRIMIR}
        testId="producao-imprimir-vazio"
      />
    );
  }

  return (
    <div className={estilos.pagina}>
      <div data-testid="folha-barra" className={`${estilos.barra} print:hidden`}>
        <Button
          asChild
          variant="outline"
          className="text-corpo h-auto min-h-[44px] px-4 font-semibold"
        >
          <Link href={rotaDeGestao("/producao")} data-testid="folha-voltar">
            <ChevronLeft aria-hidden="true" className="size-4" />
            {ROTULO_VOLTAR_PRODUCAO}
          </Link>
        </Button>
        <BotaoImprimirFolha />
      </div>
      <FolhaGeralA4 folha={folha} hoje={formatarDataCompleta(hoje)} />
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Printer } from "lucide-react";

import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { hojeEmBrasilia } from "@/lib/financeiro/formato";
import { ordemParaAFolha } from "@/lib/producao/consultas";
import { linhasDaFolhaDaOrdem } from "@/lib/producao/folhas";
import {
  ROTULO_VOLTAR_ORDEM,
  TEXTO_AVISO_IMPRESSAO_A4,
  formatarDataCompleta,
} from "@/lib/producao/textos";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import { Button } from "@/components/ui/button";
import { BotaoImprimirFolha } from "@/components/amassa/producao/botao-imprimir-folha";
import { FolhaDaOrdemA4 } from "@/components/amassa/producao/folha-da-ordem";
import estilos from "@/components/amassa/producao/folha-a4.module.css";

// `/gestao/producao/[id]/imprimir` — a folha da ordem A4 (Fase 06.1, plano 13, PRD-19), por CSS de
// impressão. `exigirUsuario()` como PRIMEIRA instrução (CLAUDE.md; T-06.1-50). Ordem inexistente (ou
// id malformado) → `notFound()`. A leitura (`ordemParaAFolha`) não seleciona nenhuma coluna de
// dinheiro — a folha de bancada é incapaz de mostrar preço ou custo (T-06.1-49). "Hoje" (a data do
// rodapé) é decidido aqui, no servidor, em Brasília.
export default async function PaginaFolhaDaOrdem({ params }: { params: Promise<{ id: string }> }) {
  await exigirUsuario();
  const { id } = await params;

  const ordem = await ordemParaAFolha(id);
  if (!ordem) {
    notFound();
  }
  const hoje = hojeEmBrasilia(new Date());
  const folha = linhasDaFolhaDaOrdem(ordem);

  return (
    <div className={estilos.pagina}>
      <div data-testid="folha-barra" className={`${estilos.barra} print:hidden`}>
        <Button
          asChild
          variant="outline"
          className="text-corpo h-auto min-h-[44px] px-4 font-semibold"
        >
          <Link href={rotaDeGestao(`/producao/${id}`)} data-testid="folha-voltar">
            <ChevronLeft aria-hidden="true" className="size-4" />
            {ROTULO_VOLTAR_ORDEM}
          </Link>
        </Button>
        <BotaoImprimirFolha />
        {/* D-11: a prévia no celular vem explicada. A barra inteira já sai do papel (`.barra` no
            `@media print` do módulo); o `md:hidden` tira o aviso do desktop. */}
        <p
          data-testid="folha-aviso-a4"
          className="text-apoio text-tinta-media flex w-full items-center gap-2 md:hidden print:hidden"
        >
          <Printer aria-hidden="true" className="size-4 shrink-0" />
          {TEXTO_AVISO_IMPRESSAO_A4}
        </p>
      </div>
      <FolhaDaOrdemA4 folha={folha} impressaEm={formatarDataCompleta(hoje)} />
    </div>
  );
}

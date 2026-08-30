import Link from "next/link";

import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { formatarReais, hojeEmBrasilia } from "@/lib/abertura/formato";
import { listarItensDaAbertura } from "@/lib/abertura/consultas";
import { totaisComprometidos } from "@/lib/abertura/parcelas";
import { ROTULO_COMPROMETIDO, ROTULO_NOVO_ITEM, TITULO_MODULO } from "@/lib/abertura/textos";
import { CabecalhoPagina } from "@/components/amassa/cabecalho-pagina";
import { Button } from "@/components/ui/button";
import { FormularioItem } from "@/components/amassa/abertura/formulario-item";
import { ListaItens } from "@/components/amassa/abertura/lista-itens";

// `exigirUsuario()` como PRIMEIRA instrução — mesmo padrão de `app/(app)/queimas/page.tsx`. O
// módulo é alcançado pelo menu do usuário (`components/amassa/menu-usuario.tsx`), nunca pela
// barra inferior — `lib/navegacao/itens.ts` não é tocado (UI-SPEC §"Onde o módulo entra na
// navegação").
//
// Esta fatia entrega SÓ o caminho de criação do item (04.2-01-PLAN.md, objetivo). Nada de abas
// (o plano 04.2-02 as introduz), nada de tarefas, nada de visão por mês. O bloco "Comprometido"
// do painel entra aqui porque é a única leitura que já se sustenta com um item só — os outros
// dois blocos de D-15 são do plano 04.2-04.
export default async function PaginaAbertura() {
  await exigirUsuario();

  // O dia civil de Brasília é calculado UMA VEZ, aqui, na borda — nenhuma função pura abaixo lê
  // o relógio por conta própria (`lib/abertura/parcelas.ts`/`lib/abertura/formato.ts`).
  const hoje = hojeEmBrasilia(new Date());
  const itens = await listarItensDaAbertura();
  const totais = totaisComprometidos(itens);

  return (
    <>
      <CabecalhoPagina titulo={TITULO_MODULO}>
        <Button asChild variant="default" className="min-h-[44px]">
          <Link href="/abertura?item=novo">{ROTULO_NOVO_ITEM}</Link>
        </Button>
      </CabecalhoPagina>

      {/* Montado sempre — mesmo com a lista vazia, `?item=novo` precisa abrir o formulário a
          partir do `EstadoVazio` (o primeiríssimo item), achado do 03-06 replicado em Queimas e
          aqui. */}
      <FormularioItem hoje={hoje} />

      <div className="px-6 pt-6 md:px-8" data-testid="abertura-bloco-comprometido">
        <div className="border-border bg-card rounded-lg border p-4 shadow-sm">
          <div className="text-micro text-muted-foreground font-semibold tracking-wide uppercase">
            {ROTULO_COMPROMETIDO}
          </div>
          <div className="text-titulo mt-1 font-bold tabular-nums">
            {formatarReais(totais.comprometidoEmCentavos)}
          </div>
          <div className="text-apoio text-muted-foreground mt-1 tabular-nums">
            <strong className="font-semibold">{formatarReais(totais.aVistaEmCentavos)}</strong> à
            vista · <strong className="font-semibold">{formatarReais(totais.aPrazoEmCentavos)}</strong>{" "}
            a prazo
          </div>
        </div>
      </div>

      <ListaItens itens={itens} hoje={hoje} />
    </>
  );
}

import Link from "next/link";

import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { DIAS_PADRAO, calcularCronograma, situacaoEm } from "@/lib/encomendas/cronograma";
import { hojeEmBrasilia } from "@/lib/encomendas/formato";
import { ordenarParaGantt } from "@/lib/encomendas/gantt";
import { listarEncomendasDoIndice } from "@/lib/encomendas/consultas";
import {
  FRASE_VAZIO_CORPO,
  FRASE_VAZIO_TITULO,
  ROTULO_NOVA_ENCOMENDA,
} from "@/lib/encomendas/textos";
import { CabecalhoPagina } from "@/components/amassa/cabecalho-pagina";
import { EstadoVazio } from "@/components/amassa/estado-vazio";
import { Button } from "@/components/ui/button";
import { FormularioEncomenda } from "@/components/amassa/encomendas/formulario-encomenda";
import {
  ListaEncomendas,
  type EncomendaDoIndice,
} from "@/components/amassa/encomendas/lista-encomendas";

// `exigirUsuario()` como PRIMEIRA instrução — regra do CLAUDE.md, verificada por
// `npm run verificar-acoes`. `searchParams` é `Promise` no Next.js 15 (precisa de `await`);
// `?nova` é o contrato de URL de D-03.
export default async function PaginaEncomendas({
  searchParams,
}: {
  searchParams: Promise<{ nova?: string }>;
}) {
  await exigirUsuario();
  const { nova } = await searchParams;

  const encomendasDoIndice = await listarEncomendasDoIndice();
  // `hoje` calculado no SERVIDOR (Brasília) e passado para baixo como string — o cliente nunca
  // decide qual é o dia de hoje, porque o fuso do aparelho de quem está no ateliê não é
  // confiável (03-CONTEXT.md, canonical refs).
  const hoje = hojeEmBrasilia(new Date());

  // O Gantt desenha só `rascunho` e `em_producao` (D-06). Sem filtro/histórico ainda (isso é
  // do plano 07), o índice inteiro — Gantt e lista mobile — mostra o mesmo conjunto ativo:
  // ENC-08/ordering exige que as duas metades nunca mostrem ordens diferentes para o mesmo
  // conjunto de encomendas, e não existe ainda nenhum caminho de escrita capaz de levar uma
  // encomenda a `concluida`/`cancelada` a partir desta tela.
  const encomendasAtivas: EncomendaDoIndice[] = encomendasDoIndice
    .filter((encomenda) => encomenda.status === "rascunho" || encomenda.status === "em_producao")
    .map((encomenda) => {
      const cronograma = calcularCronograma(
        encomenda.dataInicio,
        encomenda.etapas.length > 0
          ? encomenda.etapas.map((etapa) => ({ etapa: etapa.etapa, dias: etapa.dias }))
          : DIAS_PADRAO,
      );
      const situacao = situacaoEm(cronograma, encomenda.status, hoje);

      return {
        id: encomenda.id,
        nome: encomenda.nome,
        clienteNome: encomenda.clienteNome,
        status: encomenda.status,
        dataInicio: encomenda.dataInicio,
        cronograma,
        situacao,
      };
    });

  const encomendasOrdenadas = ordenarParaGantt(encomendasAtivas);

  return (
    <>
      <CabecalhoPagina titulo="Encomendas">
        {/* Único botão terracota da tela (03-UI-SPEC.md §Color) — Link, não Button, porque a
            abertura do formulário é um estado endereçável da própria rota (D-03), não um
            diálogo controlado por estado de cliente. */}
        <Button asChild variant="default" className="min-h-[44px]">
          <Link href="/encomendas?nova">{ROTULO_NOVA_ENCOMENDA}</Link>
        </Button>
      </CabecalhoPagina>

      {nova !== undefined && <FormularioEncomenda />}

      {encomendasDoIndice.length === 0 ? (
        // A contagem TOTAL carregada decide o estado vazio, nunca a filtrada (ENC-13/adjacency)
        // — hoje o filtro desta tela é fixo (D-06), então as duas contagens coincidem, mas a
        // condição já está escrita do jeito que continua certa quando o plano 07 trouxer filtro
        // de verdade.
        <EstadoVazio
          titulo={FRASE_VAZIO_TITULO}
          corpo={FRASE_VAZIO_CORPO}
          rotuloBotao={ROTULO_NOVA_ENCOMENDA}
        />
      ) : (
        <ListaEncomendas encomendas={encomendasOrdenadas} hoje={hoje} />
      )}
    </>
  );
}

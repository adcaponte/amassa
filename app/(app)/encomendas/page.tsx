import Link from "next/link";

import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { DIAS_PADRAO, calcularCronograma, situacaoEm } from "@/lib/encomendas/cronograma";
import { hojeEmBrasilia } from "@/lib/encomendas/formato";
import { ordenarParaGantt } from "@/lib/encomendas/gantt";
import { buscarEncomenda, listarEncomendasDoIndice } from "@/lib/encomendas/consultas";
import {
  FRASE_VAZIO_CORPO,
  FRASE_VAZIO_TITULO,
  ROTULO_NOVA_ENCOMENDA,
} from "@/lib/encomendas/textos";
import { CabecalhoPagina } from "@/components/amassa/cabecalho-pagina";
import { EstadoVazio } from "@/components/amassa/estado-vazio";
import { Button } from "@/components/ui/button";
import { BotaoImprimir } from "@/components/amassa/encomendas/botao-imprimir";
import { FormularioEncomenda } from "@/components/amassa/encomendas/formulario-encomenda";
import {
  ListaEncomendas,
  type EncomendaDoIndice,
} from "@/components/amassa/encomendas/lista-encomendas";

// `exigirUsuario()` como PRIMEIRA instrução — regra do CLAUDE.md, verificada por
// `npm run verificar-acoes`. `searchParams` é `Promise` no Next.js 15 (precisa de `await`);
// `?nova` e `?editar={id}` são o contrato de URL de D-03. `FormularioEncomenda` é montado UMA
// vez aqui, fora do condicional vazio/populado — a primeiríssima encomenda do ateliê também
// precisa abrir `?nova` a partir do `EstadoVazio`.
export default async function PaginaEncomendas({
  searchParams,
}: {
  searchParams: Promise<{ nova?: string; editar?: string }>;
}) {
  await exigirUsuario();
  const { editar } = await searchParams;

  // `hoje` calculado no SERVIDOR (Brasília) ANTES da consulta — o cliente nunca decide qual é o
  // dia de hoje (o fuso do aparelho de quem está no ateliê não é confiável, 03-CONTEXT.md,
  // canonical refs), e `listarEncomendasDoIndice` precisa dele para a janela de 12 meses do
  // histórico (D-07/D-11, plano 07).
  const hoje = hojeEmBrasilia(new Date());

  // Busca no SERVIDOR quando `?editar={id}` está presente — a edição por URL direta não
  // depende de a lista do índice já ter carregado (D-03, plano 06).
  const [encomendasDoIndice, encomendaParaEditar] = await Promise.all([
    listarEncomendasDoIndice(hoje),
    editar ? buscarEncomenda(editar) : Promise.resolve(null),
  ]);

  // TODAS as encomendas carregadas (ativas + histórico da janela de 12 meses) ganham
  // cronograma/situação aqui — o filtro de status vive dentro de `lista-encomendas.tsx` agora
  // (D-11, plano 07); o Gantt/lista mobile continuam desenhando só `rascunho`/`em_producao`
  // (D-06), mas essa decisão é de `ListaEncomendas`, não mais deste Server Component.
  const encomendasParaExibicao: EncomendaDoIndice[] = encomendasDoIndice.map((encomenda) => {
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
      // D-13: a busca do plano 07 varre nome, cliente e descrição de item — os itens
      // precisam vir junto da lista do índice, não só na página de detalhe.
      itens: encomenda.itens.map((item) => ({ descricao: item.descricao })),
      // D-07: uma linha de histórico cancelada usa isto para "cancelada em {data}" — Date não
      // atravessa a fronteira Server→Client com a mesma previsibilidade de uma string.
      atualizadoEm: encomenda.atualizadoEm.toISOString(),
    };
  });

  const encomendasOrdenadas = ordenarParaGantt(encomendasParaExibicao);

  // Contagem de ativas para o botão de imprimir (D-18) — as mesmas `rascunho`/`em_producao`
  // que `listarEncomendasAtivas()` devolveria, sem uma segunda consulta ao banco só para isso:
  // `listarEncomendasDoIndice(hoje)` já sempre inclui as duas por inteiro (nunca cortadas pela
  // janela de 12 meses, que só vale para concluída/cancelada).
  const contagemAtivas = encomendasDoIndice.filter(
    (encomenda) => encomenda.status === "rascunho" || encomenda.status === "em_producao",
  ).length;

  return (
    <>
      <CabecalhoPagina titulo="Encomendas">
        <div className="flex flex-wrap items-center gap-3">
          <BotaoImprimir contagemAtivas={contagemAtivas} />
          {/* Único botão terracota da tela (03-UI-SPEC.md §Color) — Link, não Button, porque a
              abertura do formulário é um estado endereçável da própria rota (D-03), não um
              diálogo controlado por estado de cliente. */}
          <Button asChild variant="default" className="min-h-[44px]">
            <Link href="/encomendas?nova">{ROTULO_NOVA_ENCOMENDA}</Link>
          </Button>
        </div>
      </CabecalhoPagina>

      {/* Montado sempre — mesmo com o índice vazio, `?nova` precisa abrir o formulário a partir
          do `EstadoVazio` (a primeiríssima encomenda do ateliê). A abertura em si é derivada da
          URL dentro do próprio componente (D-03), não deste `nova`/`editar` local. */}
      <FormularioEncomenda encomendaParaEditar={encomendaParaEditar} />

      {encomendasDoIndice.length === 0 ? (
        // A contagem TOTAL carregada decide o estado vazio, nunca a filtrada (ENC-13/adjacency)
        // — hoje o filtro desta tela é fixo (D-06), então as duas contagens coincidem, mas a
        // condição já está escrita do jeito que continua certa quando o plano 07 trouxer filtro
        // de verdade.
        <EstadoVazio
          titulo={FRASE_VAZIO_TITULO}
          corpo={FRASE_VAZIO_CORPO}
          rotuloBotao={ROTULO_NOVA_ENCOMENDA}
          hrefBotao="/encomendas?nova"
        />
      ) : (
        <ListaEncomendas encomendas={encomendasOrdenadas} hoje={hoje} />
      )}
    </>
  );
}

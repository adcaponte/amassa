import { Suspense } from "react";
import Link from "next/link";

import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { medirForno } from "@/lib/queimas/contador";
import { modoSemContagemDaUrl } from "@/lib/queimas/contagem";
import { carregarDadosDaFolha, listarFornosDoIndice } from "@/lib/queimas/consultas";
import { ordenarParaBanner } from "@/lib/queimas/filtros";
import { hojeEmBrasilia } from "@/lib/queimas/formato";
import { FRASE_VAZIO_CORPO, FRASE_VAZIO_TITULO, ROTULO_NOVO_FORNO } from "@/lib/queimas/textos";
import { CabecalhoPagina } from "@/components/amassa/cabecalho-pagina";
import { EstadoVazio } from "@/components/amassa/estado-vazio";
import { Button } from "@/components/ui/button";
import { BannerAtencao } from "@/components/amassa/queimas/banner-atencao";
import { FormularioForno } from "@/components/amassa/queimas/formulario-forno";
import { ListaFornos } from "@/components/amassa/queimas/lista-fornos";
import {
  EsqueletoDasListas,
  ListasDoIndice,
} from "@/components/amassa/queimas/listas-do-indice";
import { SeletorQueimas } from "@/components/amassa/queimas/seletor-queimas";

// `exigirUsuario()` como PRIMEIRA instrução — mesmo padrão de app/(app)/encomendas/page.tsx.
// D-02: não existe tela de cadastro de fornos — o botão "Novo forno" abre `?novo` (masculino,
// "forno") na própria rota, mesma convenção de `?nova` em Encomendas.
//
// `searchParams` é `Promise` no Next.js 15+ (molde de Cadastros). `?sem-contagem=todas` (plano 03,
// QMC-02) troca a lista "Sem contagem" para a visão de TODAS — lido UMA vez aqui, pelo
// puro de `lib/queimas/contagem.ts` (só a string exata "todas" vale), e descido por prop.
export default async function PaginaQueimas({
  searchParams,
}: {
  searchParams: Promise<{ "sem-contagem"?: string | string[] }>;
}) {
  await exigirUsuario();

  const parametros = await searchParams;
  const semContagem = modoSemContagemDaUrl(parametros["sem-contagem"]);

  // O dia civil de Brasília desta carga — a janela de "Sem contagem" e a régua vigente da folha são
  // contadas a partir dele.
  const hoje = hojeEmBrasilia(new Date());

  // Os dados da folha "O que queimou?" (Fase 06.4) vêm UMA vez por carga, junto com os fornos, por
  // `Promise.allSettled`: se falharem, o registro em dois toques segue como na Fase 4 — a folha não
  // abre e a queima cai em "Sem contagem" (UI-D19). Nunca derrubam a página.
  const [fornosDoIndice, [dados]] = await Promise.all([
    listarFornosDoIndice(),
    Promise.allSettled([carregarDadosDaFolha(hoje)]),
  ]);
  if (dados.status === "rejected") {
    console.error("Falha ao carregar os dados da folha de contagem no índice:", dados.reason);
  }
  const dadosDaFolha = dados.status === "fulfilled" ? dados.value : null;

  // O banner (FOR-06) é calculado sobre a MESMA lista que alimenta os cartões — nunca uma
  // segunda consulta ao banco. `medirForno` é a mesma função pura que `cartao-forno.tsx` chama
  // por forno; recalcular aqui é barato (dado já em memória) e garante que os dois nunca
  // discordem, já que a mesma entrada sempre devolve a mesma medida.
  const fornosEmAtencao = ordenarParaBanner(
    fornosDoIndice.map((forno) => {
      const medida = medirForno({
        limite: forno.limite,
        ocorrenciasDeQueima: forno.ocorrenciasDeQueima,
        ultimaManutencaoEm: forno.ultimaManutencaoEm,
      });
      return {
        nome: forno.nome,
        ativo: forno.ativo,
        nivel: medida.nivel,
        contador: medida.contador,
        limite: medida.limite,
      };
    }),
  );

  return (
    <>
      <CabecalhoPagina titulo="Queimas">
        <Button asChild variant="default" className="min-h-[44px]">
          <Link href="/gestao/queimas?novo">{ROTULO_NOVO_FORNO}</Link>
        </Button>
      </CabecalhoPagina>

      {/* Seletor de topo (D-01, plano 04-06) — logo abaixo do cabeçalho, nas três telas do
          módulo. "Fornos" fica ativo aqui e em `/queimas/[id]`. */}
      <SeletorQueimas />

      {/* Montado sempre — mesmo com o índice vazio, `?novo` precisa abrir o formulário a partir
          do `EstadoVazio` (o primeiríssimo forno do ateliê), achado do 03-06 replicado aqui. */}
      <FormularioForno />

      {/* Entre o cabeçalho e a lista/vazio (04-05-PLAN.md Tarefa 1) — faz parte do mesmo Server
          Component da página, então entra no `loading.tsx` da rota igual ao resto e some junto
          se `error.tsx` cobrir a tela; devolve `null` sozinho quando N=0. */}
      <BannerAtencao fornos={fornosEmAtencao} />

      {fornosDoIndice.length === 0 ? (
        <EstadoVazio
          titulo={FRASE_VAZIO_TITULO}
          corpo={FRASE_VAZIO_CORPO}
          rotuloBotao={ROTULO_NOVO_FORNO}
          hrefBotao="/gestao/queimas?novo"
        />
      ) : (
        <ListaFornos fornos={fornosDoIndice} dadosDaFolha={dadosDaFolha} />
      )}

      {/* As listas do índice (Fase 06.4, plano 02): "Sem contagem" (e, no plano 04, "Queimas
          externas a cobrar") num `Suspense` próprio — os cartões e o "Queimar" acima nunca esperam
          por elas nem caem com elas. Fora do ramo do vazio: sem forno não há queima, e a lista
          devolve `null` sozinha. */}
      <Suspense fallback={<EsqueletoDasListas />}>
        <ListasDoIndice hoje={hoje} dadosDaFolha={dadosDaFolha} semContagem={semContagem} />
      </Suspense>
    </>
  );
}

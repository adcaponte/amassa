import { and, asc, count, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import {
  documentos,
  fichasPrecificacao,
  fornos,
  itensCatalogo,
  manutencoes,
  ordemPecas,
  parametrosPrecificacao,
  parcelas,
  queimaContagens,
  queimaVendas,
  queimas,
  usuarios,
} from "@/db/schema";
import type { TransacaoDoBanco } from "@/lib/estoque/gravacao";
import { listarOrdensEmAndamento } from "@/lib/producao/consultas";
import { esperandoOForno } from "@/lib/producao/forno";
import { etapaAtual } from "@/lib/producao/leitura";
import {
  JANELA_SEM_CONTAGEM_DIAS,
  chipsDaProducao,
  faltaCobrar,
  janelaSemContagem,
  lancadoAtivo,
  somarDiasCivis,
  totalDasQuantidades,
  type ChipDaOrdem,
  type Contagem,
  type ContagemAnterior,
  type ModoSemContagem,
  type OrdemEsperando,
  type Quantidades,
  type Regua,
  type Tamanho,
  type VendaLigada,
} from "@/lib/queimas/contagem";
import { medirForno, type NivelDeForno } from "@/lib/queimas/contador";
import { ordenarParaBanner } from "@/lib/queimas/filtros";
import { diaCivilEmBrasilia, hojeEmBrasilia } from "@/lib/queimas/formato";
import { janelaDeSeisMeses, type TipoDeQueimaRelatorio } from "@/lib/queimas/relatorios";

// Leitura do índice de `/queimas`. Sem `"use server"` — não é uma Server Action, é uma consulta
// chamada direto do Server Component da página; `lib/queimas/acoes.ts` fica só com escrita.
//
// `contador`/`total`/`nível` NÃO são calculados aqui — são derivados dos dados brutos abaixo por
// `lib/queimas/contador.ts` (`medirForno`), o único lugar que sabe a regra de negócio (CLAUDE.md
// §Regras de negócio: "ficam em módulos puros e testados, nunca dentro de consulta ou
// componente"). Esta consulta reproduz o `left join lateral` de `fornos_medidos`
// (`02-MODELO-DE-DADOS.md` §3, view deliberadamente não criada — Desvio 2 de `04-01-PLAN.md`)
// com duas consultas + agrupamento em memória, no mesmo molde de `anexarItensEEtapas`
// (`lib/encomendas/consultas.ts`): a última manutenção de cada forno (a primeira linha, na
// ordenação `ocorridaEm` decrescente) e as `ocorridaEm` de todas as queimas do forno.
export type FornoMedido = {
  id: string;
  nome: string;
  descricao: string | null;
  limite: number;
  ativo: boolean;
  // Dado BRUTO — todas as `ocorridaEm` das queimas do forno, como string ISO (comparação de
  // `timestamptz` com `timestamptz`, segura). `medirForno` decide quais entram no contador
  // (estritamente depois da última manutenção) e quais só entram no total.
  ocorrenciasDeQueima: string[];
  ultimaManutencaoEm: string | null;
  ultimaManutencaoResponsavel: string | null;
};

export async function listarFornosDoIndice(): Promise<FornoMedido[]> {
  const linhasDeForno = await db.select().from(fornos).orderBy(asc(fornos.nome));

  if (linhasDeForno.length === 0) {
    return [];
  }

  const idsDeForno = linhasDeForno.map((forno) => forno.id);

  const [linhasDeQueima, linhasDeManutencao] = await Promise.all([
    db
      .select({ fornoId: queimas.fornoId, ocorridaEm: queimas.ocorridaEm })
      .from(queimas)
      .where(inArray(queimas.fornoId, idsDeForno)),
    db
      .select()
      .from(manutencoes)
      .where(inArray(manutencoes.fornoId, idsDeForno))
      .orderBy(desc(manutencoes.ocorridaEm)),
  ]);

  // A primeira linha de cada forno nesta lista (já ordenada por `ocorridaEm` decrescente) é a
  // manutenção mais recente — equivalente ao `order by ocorrida_em desc limit 1` da lateral join
  // de `fornos_medidos`.
  const ultimaManutencaoPorForno = new Map<string, (typeof linhasDeManutencao)[number]>();
  for (const manutencao of linhasDeManutencao) {
    if (!ultimaManutencaoPorForno.has(manutencao.fornoId)) {
      ultimaManutencaoPorForno.set(manutencao.fornoId, manutencao);
    }
  }

  return linhasDeForno.map((forno) => {
    const ultimaManutencao = ultimaManutencaoPorForno.get(forno.id) ?? null;

    return {
      id: forno.id,
      nome: forno.nome,
      descricao: forno.descricao,
      limite: forno.limite,
      ativo: forno.ativo,
      ocorrenciasDeQueima: linhasDeQueima
        .filter((queima) => queima.fornoId === forno.id)
        .map((queima) => queima.ocorridaEm.toISOString()),
      ultimaManutencaoEm: ultimaManutencao ? ultimaManutencao.ocorridaEm.toISOString() : null,
      ultimaManutencaoResponsavel: ultimaManutencao ? ultimaManutencao.responsavel : null,
    };
  });
}

// Leitura da página de detalhe (`/queimas/[id]`, plano 04-03). Uma linha do histórico de
// queimas — já com o nome de quem registrou, trazido por `leftJoin` em `usuarios` (nunca uma
// consulta por linha); `registradoPorNome` nulo quando `registradoPor` é nulo (usuário
// removido no futuro) OU quando o próprio `leftJoin` não encontra a linha.
export type QueimaDoHistorico = {
  id: string;
  tipo: (typeof queimas.$inferSelect)["tipo"];
  ocorridaEm: string;
  registradoPorNome: string | null;
  // Fase 06.4 (UI-D20): a contagem da queima, ou `null` (sem contagem — estado válido e permanente).
  contagem: Contagem | null;
  // Plano 04 (D-07): as vendas ligadas à queima (ativas e canceladas) — as tags do Histórico, o piso da
  // folha em "Corrigir contagem" e a frase da exclusão.
  vendas: VendaLigada[];
};

export type ManutencaoDoHistorico = typeof manutencoes.$inferSelect;

export type FornoComHistorico = FornoMedido & {
  queimasRecentes: QueimaDoHistorico[];
  manutencoes: ManutencaoDoHistorico[];
};

// `null` quando o `id` não existe — a página decide entre mostrar o forno ou `notFound()`
// (mesmo contrato de `buscarEncomenda`, `lib/encomendas/consultas.ts`). Depois de confirmar que
// o forno existe, três consultas em `Promise.all`: (1) TODAS as `ocorrida_em` das queimas do
// forno — dado bruto e sem limite, porque `medirForno` precisa do total real para o contador e o
// total na vida, nunca só das 25 exibidas; (2) as últimas 25 queimas com o nome do autor, para a
// lista da tela; (3) todas as manutenções, ordenadas por `ocorridaEm` decrescente — a PRIMEIRA
// linha desta mesma consulta já é a última manutenção (equivalente ao `left join lateral` de
// `fornos_medidos` usado no índice), então uma quarta consulta separada só para
// `ultimaManutencaoEm`/`ultimaManutencaoResponsavel` seria redundante.
export async function buscarForno(id: string): Promise<FornoComHistorico | null> {
  const [linhaDeForno] = await db.select().from(fornos).where(eq(fornos.id, id)).limit(1);

  if (!linhaDeForno) {
    return null;
  }

  const [linhasDeOcorrencia, linhasDeQueimaRecente, linhasDeManutencao] = await Promise.all([
    db.select({ ocorridaEm: queimas.ocorridaEm }).from(queimas).where(eq(queimas.fornoId, id)),
    db
      .select({
        id: queimas.id,
        tipo: queimas.tipo,
        ocorridaEm: queimas.ocorridaEm,
        registradoPorNome: usuarios.nome,
        // Fase 06.4: a contagem de cada uma das 25, pelo mesmo `left join` (sem linha = sem contagem).
        contagemDe: queimaContagens.queimaId,
        internasP: queimaContagens.internasP,
        internasM: queimaContagens.internasM,
        internasG: queimaContagens.internasG,
        externasP: queimaContagens.externasP,
        externasM: queimaContagens.externasM,
        externasG: queimaContagens.externasG,
        saiuCheio: queimaContagens.saiuCheio,
      })
      .from(queimas)
      .leftJoin(usuarios, eq(queimas.registradoPor, usuarios.id))
      .leftJoin(queimaContagens, eq(queimaContagens.queimaId, queimas.id))
      .where(eq(queimas.fornoId, id))
      // `ocorridaEm` decrescente, `id` como segundo critério — duas queimas no mesmo instante
      // (edge probe FOR-09) nunca se fundem e a ordem fica estável entre recargas. O `.limit(25)`
      // é a cláusula do banco, nunca um `slice` em memória.
      .orderBy(desc(queimas.ocorridaEm), desc(queimas.id))
      .limit(25),
    db
      .select()
      .from(manutencoes)
      .where(eq(manutencoes.fornoId, id))
      .orderBy(desc(manutencoes.ocorridaEm), desc(manutencoes.id)),
  ]);

  const ultimaManutencao = linhasDeManutencao[0] ?? null;
  const vendasPorQueima = await lerVendasLigadas(linhasDeQueimaRecente.map((linha) => linha.id));

  return {
    id: linhaDeForno.id,
    nome: linhaDeForno.nome,
    descricao: linhaDeForno.descricao,
    limite: linhaDeForno.limite,
    ativo: linhaDeForno.ativo,
    ocorrenciasDeQueima: linhasDeOcorrencia.map((linha) => linha.ocorridaEm.toISOString()),
    ultimaManutencaoEm: ultimaManutencao ? ultimaManutencao.ocorridaEm.toISOString() : null,
    ultimaManutencaoResponsavel: ultimaManutencao ? ultimaManutencao.responsavel : null,
    queimasRecentes: linhasDeQueimaRecente.map((linha) => ({
      id: linha.id,
      tipo: linha.tipo,
      ocorridaEm: linha.ocorridaEm.toISOString(),
      registradoPorNome: linha.registradoPorNome,
      vendas: vendasPorQueima.get(linha.id) ?? [],
      contagem:
        linha.contagemDe === null
          ? null
          : {
              internasP: linha.internasP ?? 0,
              internasM: linha.internasM ?? 0,
              internasG: linha.internasG ?? 0,
              externasP: linha.externasP ?? 0,
              externasM: linha.externasM ?? 0,
              externasG: linha.externasG ?? 0,
              saiuCheio: linha.saiuCheio ?? true,
            },
    })),
    manutencoes: linhasDeManutencao,
  };
}

// Painel inicial (E11, FOR-13, plano 04-05) — o cartão "Fornos em atenção" de `app/(app)/page.tsx`.
// Consulta de PROPÓSITO PRÓPRIO, separada de `listarFornosDoIndice`: o painel não paga o custo dos
// dados de rodapé (última manutenção/responsável) que só o cartão do índice usa (a mesma
// disciplina de "não confundir duas consultas com propósitos diferentes" do plano 03-08). Só
// fornos ATIVOS entram — um forno desativado não precisa de manutenção urgente (mesma regra de
// `ordenarParaBanner`, que também filtra por `nivel !== "ok"` e ordena crítico-primeiro).
export type FornoEmAtencao = {
  id: string;
  nome: string;
  ativo: true;
  nivel: NivelDeForno;
  contador: number;
  limite: number;
};

export async function fornosQuePrecisamDeAtencao(): Promise<FornoEmAtencao[]> {
  const linhasDeFornoAtivo = await db
    .select({ id: fornos.id, nome: fornos.nome, limite: fornos.limite })
    .from(fornos)
    .where(eq(fornos.ativo, true));

  if (linhasDeFornoAtivo.length === 0) {
    return [];
  }

  const idsDeForno = linhasDeFornoAtivo.map((forno) => forno.id);

  const [linhasDeQueima, linhasDeManutencao] = await Promise.all([
    db
      .select({ fornoId: queimas.fornoId, ocorridaEm: queimas.ocorridaEm })
      .from(queimas)
      .where(inArray(queimas.fornoId, idsDeForno)),
    db
      .select({ fornoId: manutencoes.fornoId, ocorridaEm: manutencoes.ocorridaEm })
      .from(manutencoes)
      .where(inArray(manutencoes.fornoId, idsDeForno))
      .orderBy(desc(manutencoes.ocorridaEm)),
  ]);

  // Mesma redução "primeira linha de cada forno nesta lista já ordenada = manutenção mais
  // recente" de `listarFornosDoIndice` acima.
  const ultimaManutencaoPorForno = new Map<string, string>();
  for (const manutencao of linhasDeManutencao) {
    if (!ultimaManutencaoPorForno.has(manutencao.fornoId)) {
      ultimaManutencaoPorForno.set(manutencao.fornoId, manutencao.ocorridaEm.toISOString());
    }
  }

  // `medirForno` (`lib/queimas/contador.ts`) continua sendo o ÚNICO lugar que decide
  // contador/nível — esta consulta só monta o dado bruto por forno e chama a função pura, nunca
  // reimplementa a regra do corte de data.
  const fornosMedidos = linhasDeFornoAtivo.map((forno) => {
    const medida = medirForno({
      limite: forno.limite,
      ocorrenciasDeQueima: linhasDeQueima
        .filter((queima) => queima.fornoId === forno.id)
        .map((queima) => queima.ocorridaEm.toISOString()),
      ultimaManutencaoEm: ultimaManutencaoPorForno.get(forno.id) ?? null,
    });

    return {
      id: forno.id,
      nome: forno.nome,
      ativo: true as const,
      nivel: medida.nivel,
      contador: medida.contador,
      limite: medida.limite,
    };
  });

  return ordenarParaBanner(fornosMedidos);
}

// Leitura de `/queimas/relatorios` (plano 04-06, FOR-12) — consulta de PROPÓSITO PRÓPRIO, sem
// os dados de rodapé (última manutenção/responsável) que só `listarFornosDoIndice` usa. Carrega
// UMA ÚNICA VEZ a janela mais longa das duas agregações (6 meses civis cobre mais dias que 8
// semanas) — `agregarPorSemana`/`agregarPorMes`/`estatisticasDeQueimas` (`lib/queimas/relatorios.ts`)
// rodam sobre o MESMO conjunto em memória, então alternar Semana/Mês na tela nunca dispara uma
// consulta nova nem pode mudar os números (must_have deste plano).
export type QueimaParaRelatorio = {
  ocorridaEm: string;
  tipo: TipoDeQueimaRelatorio;
  fornoId: string;
  fornoNome: string;
};

export async function carregarQueimasParaRelatorio(): Promise<QueimaParaRelatorio[]> {
  const hoje = hojeEmBrasilia(new Date());
  const [primeiroBalde] = janelaDeSeisMeses(hoje);

  // `inicio` do balde mais antigo é uma data civil `YYYY-MM-DD` de Brasília — convertida para o
  // instante de meia-noite de Brasília (`-03:00`, sem horário de verão desde 2019) antes de
  // comparar com `timestamptz`. Nunca a data corrente do Postgres, que erraria o dia entre 21h e
  // meia-noite de Brasília porque o container roda em UTC (`02-MODELO-DE-DADOS.md` §0).
  const inicioDaJanela = new Date(`${primeiroBalde.inicio}T00:00:00-03:00`);

  // T-04-23 (DoS, mitigate): a janela limita a consulta a ~6 meses em vez do histórico inteiro
  // do ateliê, usando o índice `queimas_data_idx` (`ocorridaEm desc`).
  const linhas = await db
    .select({
      ocorridaEm: queimas.ocorridaEm,
      tipo: queimas.tipo,
      fornoId: queimas.fornoId,
      fornoNome: fornos.nome,
    })
    .from(queimas)
    .innerJoin(fornos, eq(queimas.fornoId, fornos.id))
    .where(gte(queimas.ocorridaEm, inicioDaJanela))
    .orderBy(asc(queimas.ocorridaEm));

  return linhas.map((linha) => ({
    ocorridaEm: linha.ocorridaEm.toISOString(),
    tipo: linha.tipo,
    fornoId: linha.fornoId,
    fornoNome: linha.fornoNome,
  }));
}

// ---------------------------------------------------------------------------------------------
// Fase 06.4, plano 02 — a lista "Sem contagem" do índice (QMC-02, UI-D4). "Sem contagem" = a queima
// não tem linha em `queima_contagens` (`left join … is null`) — estado válido e permanente. De TODOS
// os fornos, ativos e desativados, independente do filtro dos cartões.
//
// Uma leitura (três consultas em `Promise.all`): as candidatas — sem contagem, com `ocorrida_em` nos
// últimos 32 dias (pré-filtro LARGO em instante, a meia-noite de Brasília de hoje − 32; o corte
// exato é do módulo puro, pelo dia civil), com o nome do forno, `ocorrida_em desc, id desc`; a conta
// de TODAS as sem contagem (para o "e mais N"); e se a casa tem mais de um forno (UI-D15: o nome do
// forno só aparece então). "hoje" chega por argumento — nunca a data corrente do Postgres, que roda
// em UTC e erraria o dia das 21h à meia-noite de Brasília.
export type QueimaSemContagem = {
  id: string;
  tipo: (typeof queimas.$inferSelect)["tipo"];
  ocorridaEm: string;
  diaCivil: string;
  fornoId: string;
  fornoNome: string;
};

export type SemContagemDoIndice = {
  linhas: QueimaSemContagem[];
  maisAntigas: number;
  maisDeUmForno: boolean;
};

//
// Plano 03 — `modo`: `"recentes"` (padrão) é exatamente a leitura acima; `"todas"` (o "Ver todas",
// QMC-02) tira o pré-filtro de dias: TODAS as queimas sem contagem, de todos os fornos, ativos e
// desativados — e o puro tira a janela e o teto. Só leitura do que a sessão já vê pelo Histórico.
export async function listarSemContagem(
  hoje: string,
  modo: ModoSemContagem = "recentes",
): Promise<SemContagemDoIndice> {
  const inicioDoPreFiltro = new Date(
    `${somarDiasCivis(hoje, -(JANELA_SEM_CONTAGEM_DIAS + 2))}T00:00:00-03:00`,
  );
  const semContagem = isNull(queimaContagens.queimaId);

  const [candidatas, [total], [fornosDaCasa]] = await Promise.all([
    db
      .select({
        id: queimas.id,
        tipo: queimas.tipo,
        ocorridaEm: queimas.ocorridaEm,
        fornoId: queimas.fornoId,
        fornoNome: fornos.nome,
      })
      .from(queimas)
      .innerJoin(fornos, eq(fornos.id, queimas.fornoId))
      .leftJoin(queimaContagens, eq(queimaContagens.queimaId, queimas.id))
      .where(
        modo === "todas"
          ? semContagem
          : and(semContagem, gte(queimas.ocorridaEm, inicioDoPreFiltro)),
      )
      .orderBy(desc(queimas.ocorridaEm), desc(queimas.id)),
    db
      .select({ quantidade: count() })
      .from(queimas)
      .leftJoin(queimaContagens, eq(queimaContagens.queimaId, queimas.id))
      .where(isNull(queimaContagens.queimaId)),
    db.select({ quantidade: count() }).from(fornos),
  ]);

  const { visiveis, maisAntigas } = janelaSemContagem({
    candidatas: candidatas.map((linha) => {
      const ocorridaEm = linha.ocorridaEm.toISOString();
      return {
        id: linha.id,
        tipo: linha.tipo,
        ocorridaEm,
        diaCivil: diaCivilEmBrasilia(ocorridaEm),
        fornoId: linha.fornoId,
        fornoNome: linha.fornoNome,
      };
    }),
    totalSemContagem: Number(total?.quantidade ?? 0),
    hoje,
    modo,
  });

  return {
    linhas: visiveis,
    maisAntigas,
    maisDeUmForno: Number(fornosDaCasa?.quantidade ?? 0) > 1,
  };
}

// ---------------------------------------------------------------------------------------------
// Fase 06.4, plano 02 — os dados da folha "O que queimou?", carregados UMA vez por carga da página
// (índice e detalhe) e descidos por props até quem abre a folha: nada é buscado no servidor no
// caminho do registro em dois toques (QMC-01). Os planos 03 e 04 acrescentam campos a este MESMO
// objeto (últimas contagens, chips, itens com preço) sem mudar a assinatura dos componentes. Quem
// chama usa `Promise.allSettled`: se esta leitura falhar, o registro segue como na Fase 4 e a folha
// não abre (UI-D19).
export type DadosDaFolha = {
  hoje: string;
  regua: Regua;
  maisDeUmForno: boolean;
  // Plano 03 (QMC-06, D-06): os chips das ordens da Produção esperando cada queima — `queima1` na
  // folha de biscoito, `queima2` na de esmalte (ouro não tem). `null` = a leitura da Produção falhou:
  // a área dos chips não aparece e a folha funciona igual (UI-D28).
  chips: { queima1: ChipDaOrdem[]; queima2: ChipDaOrdem[] } | null;
  // Plano 03 (QMC-05, D-01): as DUAS contagens mais recentes de cada forno + tipo — "Repetir a
  // última" escolhe no cliente (`ultimaContagemDoMesmoTipo`), excluindo a queima da folha.
  ultimasContagens: ContagemAnterior[];
  // Plano 04 (D-05): os três itens "Queima externa P/M/G" com o preço ATUAL — o valor no cabeçalho de
  // Externas da folha, as tags do Histórico e a linha "a cobrar", numa leitura por carga. `null` = a
  // leitura falhou (`console.error` no servidor): a folha só não mostra o valor (UI-D19).
  itens: ItensDasQueimas | null;
};

const CHAVE_REGUA_P = "queima_regua_p_ate";
const CHAVE_REGUA_M = "queima_regua_m_ate";

// A régua vigente em `hoje`: por chave, a linha de maior `vigente_desde <= hoje` (molde
// `parametrosVigentes`, `lib/precificacao/consultas.ts` — `distinct on (chave)`). Faltando uma das
// duas chaves, lança: a folha não pode inventar uma régua.
export async function lerReguaVigente(hoje: string): Promise<Regua> {
  const linhas = await db
    .selectDistinctOn([parametrosPrecificacao.chave], {
      chave: parametrosPrecificacao.chave,
      valorInteiro: parametrosPrecificacao.valorInteiro,
    })
    .from(parametrosPrecificacao)
    .where(
      and(
        inArray(parametrosPrecificacao.chave, [CHAVE_REGUA_P, CHAVE_REGUA_M]),
        lte(parametrosPrecificacao.vigenteDesde, hoje),
      ),
    )
    .orderBy(parametrosPrecificacao.chave, desc(parametrosPrecificacao.vigenteDesde));

  const pAte = linhas.find((linha) => linha.chave === CHAVE_REGUA_P)?.valorInteiro;
  const mAte = linhas.find((linha) => linha.chave === CHAVE_REGUA_M)?.valorInteiro;
  if (pAte === undefined || mAte === undefined) {
    throw new Error(
      `lerReguaVigente: falta a régua vigente em ${hoje} (${CHAVE_REGUA_P}/${CHAVE_REGUA_M} em parametros_precificacao).`,
    );
  }
  return { pAte, mAte };
}

// ---------------------------------------------------------------------------------------------
// Fase 06.4, plano 03 — as ordens da Produção esperando a queima (QMC-06, D-06). SÓ LEITURA: lê
// `ordens_producao`/`ordem_etapas` (por `listarOrdensEmAndamento`, a mesma leitura do quadro),
// `ordem_pecas` e `fichas_precificacao`; nenhum escritor da Produção é importado, e nenhuma ação das
// Queimas recebe id de ordem. A fila é a do quadro (`esperandoOForno`: ativas, etapa atual numa
// queima, na ordem dos cartões); o `passaram` é o da etapa atual.
//
// As peças, numa consulta só para todas as ordens da fila: `feitas = quantidade + a_mais` e a maior
// das três medidas da ficha da peça (`ordem_pecas.ficha_id`) ou, sem ela, da ficha de LINHA do item
// (`fichas_precificacao.item_catalogo_id = ordem_pecas.item_catalogo_id`, única por item — o mesmo
// par ficha/item da conclusão em `lib/producao/consultas.ts`). Sem nenhuma das duas → 0 ("sem
// medida"); uma ficha com as medidas em 0 também.
export async function ordensEsperandoAQueima(): Promise<OrdemEsperando[]> {
  const fila = esperandoOForno(await listarOrdensEmAndamento());
  const comEtapa = fila.flatMap((ordem) => {
    const atual = etapaAtual(ordem);
    if (atual === null || (atual.etapa !== "queima1" && atual.etapa !== "queima2")) {
      return [];
    }
    const etapa = atual.etapa;
    const passaram = ordem.etapas.find((linha) => linha.etapa === etapa)?.passaram ?? 0;
    return [{ ordemId: ordem.id, nome: ordem.nome, etapa, passaram }];
  });
  if (comEtapa.length === 0) {
    return [];
  }

  const fichaDaPeca = alias(fichasPrecificacao, "ficha_da_peca");
  const fichaDaLinha = alias(fichasPrecificacao, "ficha_da_linha");
  const pecas = await db
    .select({
      ordemId: ordemPecas.ordemId,
      quantidade: ordemPecas.quantidade,
      aMais: ordemPecas.aMais,
      maiorMm: sql<number>`coalesce(
        greatest(${fichaDaPeca.larguraMm}, ${fichaDaPeca.profundidadeMm}, ${fichaDaPeca.alturaMm}),
        greatest(${fichaDaLinha.larguraMm}, ${fichaDaLinha.profundidadeMm}, ${fichaDaLinha.alturaMm}),
        0
      )`.mapWith(Number),
    })
    .from(ordemPecas)
    .leftJoin(fichaDaPeca, eq(fichaDaPeca.id, ordemPecas.fichaId))
    .leftJoin(
      fichaDaLinha,
      and(isNull(ordemPecas.fichaId), eq(fichaDaLinha.itemCatalogoId, ordemPecas.itemCatalogoId)),
    )
    .where(
      inArray(
        ordemPecas.ordemId,
        comEtapa.map((ordem) => ordem.ordemId),
      ),
    )
    .orderBy(asc(ordemPecas.ordemId), asc(ordemPecas.posicao));

  const pecasPorOrdem = new Map<string, { feitas: number; maiorMm: number }[]>();
  for (const peca of pecas) {
    const lista = pecasPorOrdem.get(peca.ordemId) ?? [];
    lista.push({ feitas: peca.quantidade + peca.aMais, maiorMm: peca.maiorMm });
    pecasPorOrdem.set(peca.ordemId, lista);
  }

  return comEtapa.map((ordem) => ({ ...ordem, pecas: pecasPorOrdem.get(ordem.ordemId) ?? [] }));
}

// As DUAS contagens mais recentes por (forno, tipo), pela `ocorrida_em` da queima (empate: `id`) — a
// segunda existe para "Repetir a última" excluir a própria queima ao corrigir a mais recente, sem
// voltar ao servidor. `row_number()` por partição, numa consulta só.
export async function lerUltimasContagens(): Promise<ContagemAnterior[]> {
  const ranqueadas = db
    .select({
      queimaId: queimas.id,
      fornoId: queimas.fornoId,
      tipo: queimas.tipo,
      ocorridaEm: queimas.ocorridaEm,
      internasP: queimaContagens.internasP,
      internasM: queimaContagens.internasM,
      internasG: queimaContagens.internasG,
      externasP: queimaContagens.externasP,
      externasM: queimaContagens.externasM,
      externasG: queimaContagens.externasG,
      saiuCheio: queimaContagens.saiuCheio,
      posicao: sql<number>`row_number() over (
        partition by ${queimas.fornoId}, ${queimas.tipo}
        order by ${queimas.ocorridaEm} desc, ${queimas.id} desc
      )`.as("posicao"),
    })
    .from(queimas)
    .innerJoin(queimaContagens, eq(queimaContagens.queimaId, queimas.id))
    .as("ranqueadas");

  const linhas = await db.select().from(ranqueadas).where(lte(ranqueadas.posicao, 2));

  return linhas.map((linha) => {
    // O instante vem como `Date` pelo mapeamento da coluna; `new Date(…)` aceita os dois formatos.
    const ocorridaEm = new Date(linha.ocorridaEm).toISOString();
    return {
      queimaId: linha.queimaId,
      fornoId: linha.fornoId,
      tipo: linha.tipo,
      ocorridaEm,
      diaCivil: diaCivilEmBrasilia(ocorridaEm),
      contagem: {
        internasP: linha.internasP,
        internasM: linha.internasM,
        internasG: linha.internasG,
        externasP: linha.externasP,
        externasM: linha.externasM,
        externasG: linha.externasG,
        saiuCheio: linha.saiuCheio,
      },
    };
  });
}

export async function carregarDadosDaFolha(hoje: string): Promise<DadosDaFolha> {
  const [regua, [fornosDaCasa], ultimasContagens, ordens, itens] = await Promise.all([
    lerReguaVigente(hoje),
    db.select({ quantidade: count() }).from(fornos),
    lerUltimasContagens(),
    // Se a leitura da Produção falhar: `null` com `console.error` no servidor — os chips somem, a
    // folha e o registro nunca caem por isso (UI-D28, T-06.4-19). A régua, ao contrário, derruba os
    // dados da folha inteiros (UI-D19): sem ela não há folha.
    ordensEsperandoAQueima().catch((erro: unknown) => {
      console.error("Falha ao ler as ordens da Produção para os chips da folha de contagem:", erro);
      return null;
    }),
    // Plano 04: os preços também não derrubam a folha — sem eles, só o valor some.
    obterItensDasQueimas().catch((erro: unknown) => {
      console.error("Falha ao ler os itens das Queimas para a folha de contagem:", erro);
      return null;
    }),
  ]);
  const todos = ordens === null ? null : chipsDaProducao(ordens, regua);
  return {
    hoje,
    regua,
    maisDeUmForno: Number(fornosDaCasa?.quantidade ?? 0) > 1,
    chips:
      todos === null
        ? null
        : {
            queima1: todos.filter((chip) => chip.etapa === "queima1"),
            queima2: todos.filter((chip) => chip.etapa === "queima2"),
          },
    ultimasContagens,
    itens,
  };
}

// ---------------------------------------------------------------------------------------------
// Fase 06.4, plano 04 — a cobrança das externas (QMC-07, QMC-08; D-05, D-07).

// Os três itens do Catálogo que as Queimas usam para cobrar (D-05) — achados SÓ pela
// `chave_do_sistema`, nunca pelo nome, que o dono edita em Cadastros. O preço vem daqui: nenhum preço
// de queima no código. Molde `obterItensDoSistema` da Agenda. O leitor é o `db` por padrão;
// `cobrarQueimaNaTransacao` passa a TRANSAÇÃO, para ler os preços depois da trava da queima.
export type ItemDaQueima = {
  id: string;
  nome: string;
  precoVendaCentavos: number | null;
  categoriaVendaId: string;
};

export type ItensDasQueimas = Record<Tamanho, ItemDaQueima>;

type LeitorDeConsulta = Pick<typeof db, "select"> | Pick<TransacaoDoBanco, "select">;

const CHAVE_DO_ITEM: Record<Tamanho, string> = {
  P: "queima_externa_p",
  M: "queima_externa_m",
  G: "queima_externa_g",
};

export const FRASE_ITENS_DAS_QUEIMAS_SUMIRAM =
  "Os itens “Queima externa P/M/G” do Catálogo não foram encontrados — a migração 0030 foi aplicada?";

export async function obterItensDasQueimas(
  leitor: LeitorDeConsulta = db,
): Promise<ItensDasQueimas> {
  const linhas = await (leitor as Pick<TransacaoDoBanco, "select">)
    .select({
      chaveDoSistema: itensCatalogo.chaveDoSistema,
      id: itensCatalogo.id,
      nome: itensCatalogo.nome,
      precoVendaCentavos: itensCatalogo.precoVendaCentavos,
      categoriaVendaId: itensCatalogo.categoriaVendaId,
    })
    .from(itensCatalogo)
    .where(inArray(itensCatalogo.chaveDoSistema, Object.values(CHAVE_DO_ITEM)));

  const porChave = new Map(linhas.map((linha) => [linha.chaveDoSistema, linha] as const));
  const itens: Partial<ItensDasQueimas> = {};
  for (const tamanho of ["P", "M", "G"] as const) {
    const linha = porChave.get(CHAVE_DO_ITEM[tamanho]);
    // Item do sistema aparece na Venda, e o banco exige categoria de venda para isso
    // (`itens_catalogo_aparece_exige_categoria_venda`) — sem ela, o item não serve para cobrar.
    if (!linha || linha.categoriaVendaId === null) {
      console.error(FRASE_ITENS_DAS_QUEIMAS_SUMIRAM, {
        encontrados: linhas.map((encontrada) => encontrada.chaveDoSistema),
      });
      throw new Error(FRASE_ITENS_DAS_QUEIMAS_SUMIRAM);
    }
    itens[tamanho] = {
      id: linha.id,
      nome: linha.nome,
      precoVendaCentavos: linha.precoVendaCentavos,
      categoriaVendaId: linha.categoriaVendaId,
    };
  }
  return itens as ItensDasQueimas;
}

// As vendas ligadas de cada queima pedida — ativas e canceladas, em ordem de número —, com a
// situação de cada uma (cancelada; paga = nenhuma parcela em aberto) e as quantidades do vínculo. Só
// LEITURA (a tela); quem decide sob a trava relê por `travarContagem`.
export async function lerVendasLigadas(
  queimaIds: readonly string[],
): Promise<Map<string, VendaLigada[]>> {
  const porQueima = new Map<string, VendaLigada[]>();
  if (queimaIds.length === 0) {
    return porQueima;
  }
  const ligadas = await db
    .select({
      queimaId: queimaVendas.queimaId,
      documentoId: queimaVendas.documentoId,
      numero: documentos.numero,
      canceladoEm: documentos.canceladoEm,
      quantidadeP: queimaVendas.quantidadeP,
      quantidadeM: queimaVendas.quantidadeM,
      quantidadeG: queimaVendas.quantidadeG,
      emAberto: sql<number>`(
        select count(*) from ${parcelas}
         where ${parcelas.documentoId} = ${queimaVendas.documentoId}
           and ${parcelas.pagoEm} is null
      )`.mapWith(Number),
    })
    .from(queimaVendas)
    .innerJoin(documentos, eq(documentos.id, queimaVendas.documentoId))
    .where(inArray(queimaVendas.queimaId, [...queimaIds]))
    .orderBy(asc(documentos.numero));

  for (const linha of ligadas) {
    const lista = porQueima.get(linha.queimaId) ?? [];
    lista.push({
      documentoId: linha.documentoId,
      numero: linha.numero,
      cancelada: linha.canceladoEm !== null,
      paga: linha.emAberto === 0,
      quantidades: { p: linha.quantidadeP, m: linha.quantidadeM, g: linha.quantidadeG },
    });
    porQueima.set(linha.queimaId, lista);
  }
  return porQueima;
}

// Uma linha de "Queimas externas a cobrar" (QMC-07, UI-D26; D-07).
export type QueimaACobrar = {
  queimaId: string;
  tipo: (typeof queimas.$inferSelect)["tipo"];
  ocorridaEm: string;
  diaCivil: string;
  fornoNome: string;
  externas: Quantidades;
  vendas: VendaLigada[];
  falta: Quantidades;
};

// Toda contagem em que ALGUM tamanho ainda tem falta (falta = externas − Σ das vendas ATIVAS ligadas,
// por tamanho), de todos os fornos, ativos e desativados, a mais ANTIGA primeiro (é dinheiro
// esperando; empate pelo id da queima), sem teto. Duas leituras: as contagens com externas e o forno;
// depois, pelos ids delas, as vendas ligadas. O corte (só quem tem falta) é de `faltaCobrar`.
export async function listarACobrar(): Promise<QueimaACobrar[]> {
  const comExternas = await db
    .select({
      queimaId: queimas.id,
      tipo: queimas.tipo,
      ocorridaEm: queimas.ocorridaEm,
      fornoNome: fornos.nome,
      externasP: queimaContagens.externasP,
      externasM: queimaContagens.externasM,
      externasG: queimaContagens.externasG,
    })
    .from(queimaContagens)
    .innerJoin(queimas, eq(queimas.id, queimaContagens.queimaId))
    .innerJoin(fornos, eq(fornos.id, queimas.fornoId))
    .where(
      sql`${queimaContagens.externasP} + ${queimaContagens.externasM} + ${queimaContagens.externasG} > 0`,
    )
    .orderBy(asc(queimas.ocorridaEm), asc(queimas.id));

  const vendasPorQueima = await lerVendasLigadas(comExternas.map((linha) => linha.queimaId));

  const linhas: QueimaACobrar[] = [];
  for (const linha of comExternas) {
    const externas = { p: linha.externasP, m: linha.externasM, g: linha.externasG };
    const vendas = vendasPorQueima.get(linha.queimaId) ?? [];
    const falta = faltaCobrar(externas, lancadoAtivo(vendas));
    if (totalDasQuantidades(falta) === 0) {
      continue;
    }
    const ocorridaEm = linha.ocorridaEm.toISOString();
    linhas.push({
      queimaId: linha.queimaId,
      tipo: linha.tipo,
      ocorridaEm,
      diaCivil: diaCivilEmBrasilia(ocorridaEm),
      fornoNome: linha.fornoNome,
      externas,
      vendas,
      falta,
    });
  }
  return linhas;
}

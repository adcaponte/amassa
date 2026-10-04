import { and, asc, count, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";

import { db } from "@/db";
import {
  fornos,
  manutencoes,
  parametrosPrecificacao,
  queimaContagens,
  queimas,
  usuarios,
} from "@/db/schema";
import {
  JANELA_SEM_CONTAGEM_DIAS,
  janelaSemContagem,
  somarDiasCivis,
  type Regua,
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
      })
      .from(queimas)
      .leftJoin(usuarios, eq(queimas.registradoPor, usuarios.id))
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

export async function listarSemContagem(hoje: string): Promise<SemContagemDoIndice> {
  const inicioDoPreFiltro = new Date(
    `${somarDiasCivis(hoje, -(JANELA_SEM_CONTAGEM_DIAS + 2))}T00:00:00-03:00`,
  );

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
      .where(and(isNull(queimaContagens.queimaId), gte(queimas.ocorridaEm, inicioDoPreFiltro)))
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

export async function carregarDadosDaFolha(hoje: string): Promise<DadosDaFolha> {
  const [regua, [fornosDaCasa]] = await Promise.all([
    lerReguaVigente(hoje),
    db.select({ quantidade: count() }).from(fornos),
  ]);
  return { hoje, regua, maisDeUmForno: Number(fornosDaCasa?.quantidade ?? 0) > 1 };
}

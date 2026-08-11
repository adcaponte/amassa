import { asc, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { fornos, manutencoes, queimas, usuarios } from "@/db/schema";

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

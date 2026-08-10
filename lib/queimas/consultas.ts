import { asc, desc, inArray } from "drizzle-orm";

import { db } from "@/db";
import { fornos, manutencoes, queimas } from "@/db/schema";

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

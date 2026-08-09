import { and, asc, eq, gte, inArray, or } from "drizzle-orm";

import { db } from "@/db";
import { encomendaEtapas, encomendaItens, encomendas } from "@/db/schema";
import { calcularJanelaDoHistorico } from "./filtros";

// Leitura do índice de `/encomendas`. Sem `"use server"` — não é uma Server Action, é uma
// consulta chamada direto do Server Component da página; `lib/encomendas/acoes.ts` fica só
// com escrita.
export type EncomendaComFilhos = typeof encomendas.$inferSelect & {
  itens: (typeof encomendaItens.$inferSelect)[];
  etapas: (typeof encomendaEtapas.$inferSelect)[];
};

// Compartilhado por `listarEncomendasDoIndice`/`listarEncomendasAtivas`: dadas as linhas de
// `encomendas` já filtradas por cada consulta (propósitos diferentes, WHERE diferente), busca
// itens e etapas em duas consultas por `inArray` e agrupa em memória — nunca `db.query` com
// `relations()` (o schema desta fase não as declara ainda). Extraído aqui só para não repetir
// as mesmas seis linhas duas vezes; o WHERE de cada consulta continua vivendo no chamador,
// nunca aqui — é o que preserva as duas consultas como propósitos DIFERENTES (plano 08).
async function anexarItensEEtapas(
  linhasDeEncomenda: (typeof encomendas.$inferSelect)[],
): Promise<EncomendaComFilhos[]> {
  if (linhasDeEncomenda.length === 0) {
    return [];
  }

  const idsDeEncomenda = linhasDeEncomenda.map((linha) => linha.id);

  const [linhasDeItem, linhasDeEtapa] = await Promise.all([
    db
      .select()
      .from(encomendaItens)
      .where(inArray(encomendaItens.encomendaId, idsDeEncomenda))
      .orderBy(asc(encomendaItens.ordem)),
    db
      .select()
      .from(encomendaEtapas)
      .where(inArray(encomendaEtapas.encomendaId, idsDeEncomenda))
      .orderBy(asc(encomendaEtapas.ordem)),
  ]);

  return linhasDeEncomenda.map((encomenda) => ({
    ...encomenda,
    itens: linhasDeItem.filter((item) => item.encomendaId === encomenda.id),
    etapas: linhasDeEtapa.filter((etapa) => etapa.encomendaId === encomenda.id),
  }));
}

// Ordenado por `data_inicio` ascendente (D-12, padrão), itens e etapas por `ordem`.
//
// Janela de 12 meses (03-UI-SPEC.md "Histórico — Janela carregada — decisão do dono"): TODAS as
// `rascunho`/`em_producao` vêm sempre; `concluida`/`cancelada` só vêm se `data_inicio` estiver
// dentro dos últimos 12 meses a partir de `hoje` — é o teto que impede o conjunto filtrado no
// cliente (D-11) de crescer sem limite conforme os anos passam. A data de corte é calculada em
// TypeScript (`calcularJanelaDoHistorico`, módulo puro) e passada como parâmetro — nunca a
// função de data corrente do Postgres, que devolveria o dia errado entre 21h e meia-noite de
// Brasília porque o contêiner roda em UTC (`02-MODELO-DE-DADOS.md` §0).
export async function listarEncomendasDoIndice(hoje: string): Promise<EncomendaComFilhos[]> {
  const dataDeCorte = calcularJanelaDoHistorico(hoje);

  const linhasDeEncomenda = await db
    .select()
    .from(encomendas)
    .where(
      or(
        inArray(encomendas.status, ["rascunho", "em_producao"]),
        and(
          inArray(encomendas.status, ["concluida", "cancelada"]),
          gte(encomendas.dataInicio, dataDeCorte),
        ),
      ),
    )
    .orderBy(asc(encomendas.dataInicio));

  return anexarItensEEtapas(linhasDeEncomenda);
}

// Escopo PRÓPRIO e fixo da folha impressa (D-18, ENC-14, 03-UI-SPEC.md "Impressão A4"): SEMPRE
// todas as `rascunho` + `em_producao`, sem janela de data e sem parâmetro de filtro — nunca a
// janela de 12 meses nem o filtro/busca/ordenação vigentes na tela do índice. É uma consulta
// DIFERENTE de `listarEncomendasDoIndice(hoje)`, de propósito: confundir as duas faria a folha
// imprimir histórico, ou o índice perder o histórico.
export async function listarEncomendasAtivas(): Promise<EncomendaComFilhos[]> {
  const linhasDeEncomenda = await db
    .select()
    .from(encomendas)
    .where(inArray(encomendas.status, ["rascunho", "em_producao"]))
    .orderBy(asc(encomendas.dataInicio));

  return anexarItensEEtapas(linhasDeEncomenda);
}

// Leitura da página de detalhe (`/encomendas/[id]`, plano 05). `null` quando o `id` não existe —
// a página decide entre mostrar a encomenda ou `notFound()`. O status da linha sempre vem direto
// da coluna: nenhum campo aqui é deduzido de data (D-05 — a proibição vale também na leitura).
export async function buscarEncomenda(id: string): Promise<EncomendaComFilhos | null> {
  const [linhaDeEncomenda] = await db
    .select()
    .from(encomendas)
    .where(eq(encomendas.id, id))
    .limit(1);

  if (!linhaDeEncomenda) {
    return null;
  }

  const [itensDaEncomenda, etapasDaEncomenda] = await Promise.all([
    db
      .select()
      .from(encomendaItens)
      .where(eq(encomendaItens.encomendaId, id))
      .orderBy(asc(encomendaItens.ordem)),
    db
      .select()
      .from(encomendaEtapas)
      .where(eq(encomendaEtapas.encomendaId, id))
      .orderBy(asc(encomendaEtapas.ordem)),
  ]);

  return {
    ...linhaDeEncomenda,
    itens: itensDaEncomenda,
    etapas: etapasDaEncomenda,
  };
}

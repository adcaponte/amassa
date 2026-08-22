// Auxiliar de teste: fala direto com `encomendas`/`encomenda_etapas` pelo cliente `pg` (o
// mesmo pacote de `db/index.ts`), no molde de `tests/e2e/apoio/marcar-rascunho.ts` e
// `tests/e2e/apoio/alternar-ativo.ts`. Existe para provar o gap 16 da verificação (04.1-05):
// a única forma de forçar a ORDEM FÍSICA de tupla a divergir da ordem lógica, num Postgres de
// verdade, é apagar e reinserir — nenhuma escrita da aplicação faz isso.
//
// Conecta só por `DATABASE_URL_TESTE`, nunca `DATABASE_URL` — nunca aponta para o banco real.
import { Client } from "pg";

import { DIAS_PADRAO, ORDEM_DAS_ETAPAS, type DuracaoDeEtapa } from "@/lib/encomendas/cronograma";

async function comCliente<T>(operacao: (cliente: Client) => Promise<T>): Promise<T> {
  const cliente = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
  await cliente.connect();
  try {
    return await operacao(cliente);
  } finally {
    await cliente.end();
  }
}

// Insere uma encomenda e as 6 linhas de `encomenda_etapas` a partir de `DIAS_PADRAO`, com
// `ordem` igual ao índice em `ORDEM_DAS_ETAPAS` — nunca redigitando os números aqui, para a
// fixture nunca divergir dos padrões reais de produção. Devolve o `id` da encomenda criada.
export async function criarEncomendaComEtapasPadrao(
  nome: string,
  dataInicio: string,
): Promise<string> {
  return comCliente(async (cliente) => {
    const resultado = await cliente.query<{ id: string }>(
      `insert into encomendas (nome, data_inicio) values ($1, $2) returning id`,
      [nome, dataInicio],
    );
    const encomendaId = resultado.rows[0].id;

    for (const [indice, etapa] of ORDEM_DAS_ETAPAS.entries()) {
      const duracao = DIAS_PADRAO.find((item) => item.etapa === etapa) as DuracaoDeEtapa;
      await cliente.query(
        `insert into encomenda_etapas (encomenda_id, etapa, dias, espera_dias, ordem)
         values ($1, $2, $3, $4, $5)`,
        [encomendaId, duracao.etapa, duracao.dias, duracao.esperaDias, indice],
      );
    }

    return encomendaId;
  });
}

// Muda a POSIÇÃO FÍSICA das 6 linhas de `encomenda_etapas` da encomenda `encomendaId`, sem
// mudar nenhum valor lógico (`ordem` continua 0..5, na mesma correspondência de etapa). Numa
// única transação: lê as 6 linhas ordenadas por `ordem` DESCENDENTE, apaga as 6, e as reinsere
// uma a uma NESSA MESMA ordem descendente, preservando `id`, `encomenda_id`, `etapa`, `dias` e
// `espera_dias`.
//
// Apagar e reinserir é o que muda a posição física de verdade: as tuplas apagadas viram
// "mortas" (invisíveis a leituras futuras, mas ainda ocupando espaço até um VACUUM) e as novas
// linhas recebem ponteiros de posição NOVOS, no fim do arquivo de dados, na ordem em que foram
// inseridas — que aqui é a ordem descendente de `ordem`, o oposto da ordem lógica. Um `UPDATE`
// no lugar NÃO serviria: quando a atualização cabe na mesma página (HOT — Heap-Only Tuple), o
// Postgres reaproveita o ponteiro antigo da linha, preservando a ordem física de varredura —
// exatamente o que este auxiliar precisa desfazer para provar o defeito.
//
// Só toca `encomenda_etapas` da encomenda recebida — nenhuma outra tabela, nenhuma outra
// encomenda.
export async function inverterOrdemFisicaDasEtapas(encomendaId: string): Promise<void> {
  await comCliente(async (cliente) => {
    await cliente.query("begin");
    try {
      const linhas = await cliente.query<{
        id: string;
        etapa: string;
        dias: number;
        espera_dias: number;
        ordem: number;
      }>(
        `select id, etapa, dias, espera_dias, ordem from encomenda_etapas
         where encomenda_id = $1 order by ordem desc`,
        [encomendaId],
      );

      await cliente.query(`delete from encomenda_etapas where encomenda_id = $1`, [encomendaId]);

      for (const linha of linhas.rows) {
        await cliente.query(
          `insert into encomenda_etapas (id, encomenda_id, etapa, dias, espera_dias, ordem)
           values ($1, $2, $3, $4, $5, $6)`,
          [linha.id, encomendaId, linha.etapa, linha.dias, linha.espera_dias, linha.ordem],
        );
      }

      await cliente.query("commit");
    } catch (erro) {
      await cliente.query("rollback");
      throw erro;
    }
  });
}

// Leitura DELIBERADAMENTE SEM `order by` — a forma exata do defeito do gap 16, antes da
// correção de `lib/encomendas/acoes.ts`. A ausência é intencional: não "conserte" este
// auxiliar acrescentando ordenação, ou o teste que o usa perde o próprio objeto que prova.
export async function lerEtapasSemOrdenar(encomendaId: string): Promise<DuracaoDeEtapa[]> {
  return comCliente(async (cliente) => {
    const resultado = await cliente.query<{ etapa: DuracaoDeEtapa["etapa"]; dias: number; espera_dias: number }>(
      `select etapa, dias, espera_dias from encomenda_etapas where encomenda_id = $1`,
      [encomendaId],
    );
    return resultado.rows.map((linha) => ({
      etapa: linha.etapa,
      dias: linha.dias,
      esperaDias: linha.espera_dias,
    }));
  });
}

// A mesma leitura de `lerEtapasSemOrdenar`, com `order by ordem` — o padrão que
// `lib/encomendas/acoes.ts` e `lib/encomendas/consultas.ts` agora seguem.
export async function lerEtapasOrdenadas(encomendaId: string): Promise<DuracaoDeEtapa[]> {
  return comCliente(async (cliente) => {
    const resultado = await cliente.query<{ etapa: DuracaoDeEtapa["etapa"]; dias: number; espera_dias: number }>(
      `select etapa, dias, espera_dias from encomenda_etapas where encomenda_id = $1 order by ordem`,
      [encomendaId],
    );
    return resultado.rows.map((linha) => ({
      etapa: linha.etapa,
      dias: linha.dias,
      esperaDias: linha.espera_dias,
    }));
  });
}

// Apaga a encomenda de teste — as etapas saem junto por `on delete cascade`.
export async function apagarEncomenda(encomendaId: string): Promise<void> {
  await comCliente((cliente) =>
    cliente.query(`delete from encomendas where id = $1`, [encomendaId]),
  );
}

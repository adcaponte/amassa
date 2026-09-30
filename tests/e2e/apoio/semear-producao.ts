// Auxiliar de teste da Produção (Fase 06.1): semeia ordens e LÊ as etapas direto do banco de teste,
// pelo cliente `pg` — mesmo molde de `tests/e2e/apoio/semear-estoque.ts`. Nomes sempre inventados,
// com prefixo `[e2e]` — nenhum dado real no repositório. As etapas nascem de `etapasIniciais` (o
// módulo puro), a mesma fonte dos dias previstos que a aplicação usa.
//
// Datas civis vêm como texto `YYYY-MM-DD` de quem chama (o dia de Brasília, calculado no teste) —
// nunca `current_date` do Postgres, que roda em UTC e erra o dia à noite.
import { Client } from "pg";

import {
  etapasIniciais,
  type CaminhoOrdem,
  type EtapaProducao,
  type StatusOrdem,
  type TipoOrdem,
} from "@/lib/producao/etapas";

async function comCliente<T>(operacao: (cliente: Client) => Promise<T>): Promise<T> {
  const cliente = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
  await cliente.connect();
  try {
    return await operacao(cliente);
  } finally {
    await cliente.end();
  }
}

// O dia civil de Brasília — a mesma conta de `hojeEmBrasilia` da aplicação.
export function diaEmBrasilia(deslocamentoEmDias = 0): string {
  const agora = new Date(Date.now() + deslocamentoEmDias * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

// "05/03" a partir de `YYYY-MM-DD`.
export function diaMes(data: string): string {
  const [, mes, dia] = data.split("-");
  return `${dia}/${mes}`;
}

export type PecaParaSemear = { descricao: string; quantidade: number; aMais?: number };

export type OrdemParaSemear = {
  nome: string;
  tipo: TipoOrdem;
  caminho: CaminhoOrdem;
  status: StatusOrdem;
  // Nulo só em `aguardando_sinal` (o check `ordens_producao_aguardando_sem_inicio`).
  inicio: string | null;
  // As etapas já feitas, com a data — precisam ser um prefixo do caminho.
  etapasFeitas: { etapa: EtapaProducao; feitaEm: string }[];
  pecas: PecaParaSemear[];
  entregaPrometida?: string | null;
  clienteNome?: string | null;
};

// Uma ordem com as etapas do caminho (com `feita_em` nas feitas) e as peças, numa transação.
// Devolve o id.
export async function semearOrdem(dados: OrdemParaSemear): Promise<string> {
  return comCliente(async (cliente) => {
    await cliente.query("begin");
    try {
      const { rows } = await cliente.query<{ id: string }>(
        `insert into ordens_producao (tipo, caminho, status, nome, cliente_nome, entrega_prometida, inicio)
         values ($1, $2, $3, $4, $5, $6, $7) returning id`,
        [
          dados.tipo,
          dados.caminho,
          dados.status,
          dados.nome,
          dados.clienteNome ?? null,
          dados.entregaPrometida ?? null,
          dados.inicio,
        ],
      );
      const ordemId = rows[0].id;
      const feitas = new Map(dados.etapasFeitas.map((feita) => [feita.etapa, feita.feitaEm]));
      for (const etapa of etapasIniciais(dados.caminho)) {
        await cliente.query(
          `insert into ordem_etapas (ordem_id, etapa, posicao, dias_previstos, feita_em)
           values ($1, $2, $3, $4, $5)`,
          [ordemId, etapa.etapa, etapa.posicao, etapa.diasPrevistos, feitas.get(etapa.etapa) ?? null],
        );
      }
      for (const [posicao, peca] of dados.pecas.entries()) {
        await cliente.query(
          `insert into ordem_pecas (ordem_id, posicao, descricao, quantidade, a_mais)
           values ($1, $2, $3, $4, $5)`,
          [ordemId, posicao, peca.descricao, peca.quantidade, peca.aMais ?? 0],
        );
      }
      await cliente.query("commit");
      return ordemId;
    } catch (erro) {
      await cliente.query("rollback").catch(() => {});
      throw erro;
    }
  });
}

export type EtapaNoBanco = {
  etapa: EtapaProducao;
  posicao: number;
  diasPrevistos: number;
  feitaEm: string | null;
  passaram: number | null;
};

// As etapas da ordem como estão no banco, por posição — `feita_em` como texto `YYYY-MM-DD` (o
// `pg` devolveria `Date` para uma coluna `date`, e o fuso do Node deslocaria o dia).
export async function etapasDaOrdemNoBanco(ordemId: string): Promise<EtapaNoBanco[]> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{
      etapa: EtapaProducao;
      posicao: number;
      dias_previstos: number;
      feita_em: string | null;
      passaram: number | null;
    }>(
      `select etapa, posicao, dias_previstos, feita_em::text as feita_em, passaram
         from ordem_etapas where ordem_id = $1 order by posicao`,
      [ordemId],
    );
    return rows.map((linha) => ({
      etapa: linha.etapa,
      posicao: linha.posicao,
      diasPrevistos: linha.dias_previstos,
      feitaEm: linha.feita_em,
      passaram: linha.passaram,
    }));
  });
}

// ---------------------------------------------------------------------------------------------
// Plano 06.1-03 — a ordem que nasce da aprovação do orçamento
// ---------------------------------------------------------------------------------------------

export type OrdemNoBanco = {
  tipo: TipoOrdem;
  caminho: CaminhoOrdem;
  status: StatusOrdem;
  nome: string;
  clienteNome: string | null;
  entregaPrometida: string | null;
  inicio: string | null;
};

// A linha da ordem como está no banco — datas como texto `YYYY-MM-DD` (mesma razão de
// `etapasDaOrdemNoBanco`). `null` se ela não existe.
export async function ordemNoBanco(ordemId: string): Promise<OrdemNoBanco | null> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{
      tipo: TipoOrdem;
      caminho: CaminhoOrdem;
      status: StatusOrdem;
      nome: string;
      cliente_nome: string | null;
      entrega_prometida: string | null;
      inicio: string | null;
    }>(
      `select tipo, caminho, status, nome, cliente_nome, entrega_prometida::text as entrega_prometida,
              inicio::text as inicio
         from ordens_producao where id = $1`,
      [ordemId],
    );
    const linha = rows[0];
    if (!linha) {
      return null;
    }
    return {
      tipo: linha.tipo,
      caminho: linha.caminho,
      status: linha.status,
      nome: linha.nome,
      clienteNome: linha.cliente_nome,
      entregaPrometida: linha.entrega_prometida,
      inicio: linha.inicio,
    };
  });
}

export type PecaNoBanco = {
  posicao: number;
  fichaId: string | null;
  descricao: string;
  quantidade: number;
  cor: string | null;
  personalizacao: string | null;
};

// As peças da ordem, por posição.
export async function pecasDaOrdemNoBanco(ordemId: string): Promise<PecaNoBanco[]> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{
      posicao: number;
      ficha_id: string | null;
      descricao: string;
      quantidade: number;
      cor: string | null;
      personalizacao: string | null;
    }>(
      `select posicao, ficha_id, descricao, quantidade, cor, personalizacao
         from ordem_pecas where ordem_id = $1 order by posicao`,
      [ordemId],
    );
    return rows.map((linha) => ({
      posicao: linha.posicao,
      fichaId: linha.ficha_id,
      descricao: linha.descricao,
      quantidade: linha.quantidade,
      cor: linha.cor,
      personalizacao: linha.personalizacao,
    }));
  });
}

// As linhas do orçamento na ordem de `ordem` — o que as peças da ordem precisam espelhar.
export async function linhasDoOrcamentoNoBanco(
  orcamentoId: string,
): Promise<{ fichaId: string; quantidade: number; cor: string | null }[]> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{ ficha_id: string; quantidade: number; cor: string | null }>(
      `select ficha_id, quantidade, cor from orcamento_linhas where orcamento_id = $1 order by ordem`,
      [orcamentoId],
    );
    return rows.map((linha) => ({ fichaId: linha.ficha_id, quantidade: linha.quantidade, cor: linha.cor }));
  });
}

// O vínculo gravado no orçamento (`orcamentos.encomenda_id`, o nome histórico do vínculo com a ordem).
export async function vinculoDoOrcamento(orcamentoId: string): Promise<string | null> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{ encomenda_id: string | null }>(
      `select encomenda_id from orcamentos where id = $1`,
      [orcamentoId],
    );
    return rows[0]?.encomenda_id ?? null;
  });
}

// Libera e cancela a ordem direto no banco, respeitando os checks (`cancelada_em` e
// `cancelada_por` junto do status). Só enquanto o "Cancelar ordem" da tela não existe (plano
// 06.1-06): o teste que precisa de uma ordem cancelada confere o que o ORÇAMENTO diz dela, não o
// caminho do cancelamento.
//
// Por que "libera e cancela" (com `inicio` = `liberadaEm` quando ainda não havia): o check
// `ordens_producao_aguardando_sem_inicio` é `(status = 'aguardando_sinal') = (inicio is null)` —
// uma ordem cancelada PRECISA ter início. Cancelar uma ordem ainda aguardando o sinal com o início
// nulo é recusado pelo banco (23514); registrado no SUMMARY do plano 06.1-03 para o plano 06.
export async function cancelarOrdemNoBanco(ordemId: string, liberadaEm: string): Promise<void> {
  await comCliente(async (cliente) => {
    const { rowCount } = await cliente.query(
      `update ordens_producao
          set status = 'cancelada', inicio = coalesce(inicio, $2::date), cancelada_em = now(),
              cancelada_por = (select id from usuarios order by criado_em limit 1)
        where id = $1`,
      [ordemId, liberadaEm],
    );
    if (rowCount !== 1) {
      throw new Error(`cancelarOrdemNoBanco: a ordem ${ordemId} não existe.`);
    }
  });
}

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

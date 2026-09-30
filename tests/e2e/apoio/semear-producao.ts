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

import { buscarCategoriaPorNome, hojeNoAtelie, semearItem, somarDiasAoHoje } from "./semear-financeiro";

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
  // Nulo em `aguardando_sinal`; obrigatório em `ativa`/`concluida`; livre em `cancelada` (o check
  // `ordens_producao_aguardando_sem_inicio`, corrigido no plano 06.1-06).
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
// Por que "libera e cancela" (com `inicio` = `liberadaEm` quando ainda não havia): até o plano
// 06.1-06 o check `ordens_producao_aguardando_sem_inicio` era `(status = 'aguardando_sinal') =
// (inicio is null)`, e uma ordem cancelada PRECISAVA ter início (23514, achado do plano 06.1-03).
// O plano 06 afrouxou o check — a cancelada aceita início nulo — e este atalho ficou como estava:
// a ordem liberada e depois cancelada continua sendo um estado real, e o caso (j) não muda.
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

// ---------------------------------------------------------------------------------------------
// Plano 06.1-03 — fichas e a ordem vinda de orçamento aprovado (reusadas pelos planos 06, 07, 08,
// 10 e 11)
// ---------------------------------------------------------------------------------------------

async function idDoUsuarioDeTeste(cliente: Client): Promise<string> {
  const email = process.env.E2E_EMAIL_TESTE;
  if (!email) {
    throw new Error("semear-producao: a variável E2E_EMAIL_TESTE não está definida.");
  }
  const { rows } = await cliente.query<{ id: string }>(
    "select id from usuarios where lower(email) = lower($1) limit 1",
    [email],
  );
  const id = rows[0]?.id;
  if (!id) {
    throw new Error(`semear-producao: nenhum usuário com o e-mail "${email}".`);
  }
  return id;
}

export type FichaParaSemearNaProducao = {
  nome: string;
  // Exclusiva = peça de um pedido só, sem item do catálogo; de linha = com item do catálogo
  // (`comItem`), sem preço praticado próprio (o check `fichas_precificacao_exclusividade_coerente`).
  exclusiva: boolean;
  comItem: boolean;
  argilaMiligramas: number;
  esmalteMiligramas: number;
  larguraMm: number;
  profundidadeMm: number;
  alturaMm: number;
  horasMilesimos: number;
  cabemBiscoitoInformado?: number | null;
  cabemEsmalteInformado?: number | null;
};

// Uma ficha de precificação com medidas, gramas e horas. De linha (`comItem`): cria antes o item do
// catálogo que ela representa (aparece na venda, "Peças prontas", sem controlar estoque). Devolve os
// dois ids (`itemId` nulo na exclusiva).
export async function semearFicha(
  dados: FichaParaSemearNaProducao,
): Promise<{ fichaId: string; itemId: string | null }> {
  if (dados.exclusiva === dados.comItem) {
    throw new Error("semearFicha: ficha exclusiva não tem item; ficha de linha tem (comItem).");
  }
  const itemId = dados.comItem
    ? await semearItem({
        nome: dados.nome,
        categoriaVenda: "Peças prontas",
        precoCentavos: 8000,
        apareceNaVenda: true,
        atalhoVenda: false,
        controlaEstoque: false,
        atalhoCompra: false,
      })
    : null;

  const fichaId = await comCliente(async (cliente) => {
    const criadoPor = await idDoUsuarioDeTeste(cliente);
    const { rows } = await cliente.query<{ id: string }>(
      `insert into fichas_precificacao
         (nome, argila_miligramas, esmalte_miligramas, horas_milesimos, largura_mm, profundidade_mm,
          altura_mm, cabem_biscoito_informado, cabem_esmalte_informado, preco_praticado_centavos,
          exclusiva, item_catalogo_id, criado_por)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       returning id`,
      [
        dados.nome,
        dados.argilaMiligramas,
        dados.esmalteMiligramas,
        dados.horasMilesimos,
        dados.larguraMm,
        dados.profundidadeMm,
        dados.alturaMm,
        dados.cabemBiscoitoInformado ?? null,
        dados.cabemEsmalteInformado ?? null,
        dados.exclusiva ? 9000 : null,
        dados.exclusiva,
        itemId,
        criadoPor,
      ],
    );
    return rows[0]?.id;
  });
  if (!fichaId) {
    throw new Error(`semearFicha: falha ao inserir a ficha "${dados.nome}".`);
  }
  return { fichaId, itemId };
}

export type PecaDeOrcamentoParaSemear = {
  quantidade: number;
  cor?: string | null;
  personalizacao?: string | null;
  // Horas da ficha exclusiva criada para a peça, em milésimos (padrão 600 = 0,6 h).
  horasMilesimos?: number;
};

export type OrdemDeOrcamentoParaSemear = {
  // O nome da ordem (e o título do orçamento). Quem chama embute "[e2e] … {sufixo}".
  nome: string;
  plano: "sinal" | "avista" | "3x";
  // A parcela 1 da venda (o sinal; no à vista, o pagamento inteiro) já consta como recebida hoje?
  sinalPago: boolean;
  // As peças (uma linha do orçamento, da venda e da ordem por peça, cada uma com a SUA ficha
  // exclusiva). Padrão: uma peça, 2 unidades, sem cor nem personalização. A peça `n` (base 1) se
  // chama "{nome} · peça" na primeira e "{nome} · peça {n}" nas seguintes.
  pecas?: PecaDeOrcamentoParaSemear[];
};

export type OrdemDeOrcamentoSemeada = {
  ordemId: string;
  orcamentoId: string;
  documentoId: string;
  // A parcela `numero = 1` da venda — a do sinal.
  parcelaSinalId: string;
  entregaPrometida: string;
};

export function nomeDaPecaSemeada(nomeDaOrdem: string, indice: number): string {
  return (indice === 0 ? `${nomeDaOrdem} · peça` : `${nomeDaOrdem} · peça ${indice + 1}`).slice(0, 120);
}

// O retrato de "Cliente aprovou" com a caixa da ordem marcada, gravado direto no banco numa
// transação: uma ficha exclusiva por peça; o documento de venda (uma linha por peça em
// "Encomendas") com as parcelas numeradas do plano (a 1 vence hoje e, se `sinalPago`, já recebida
// hoje); a ordem encomenda/completo aguardando o sinal, sem início, com as seis etapas e as peças; e
// o orçamento APROVADO, com o snapshot congelado, as linhas e os dois vínculos. R$ 90,00 por
// unidade (o padrão dá R$ 180,00).
export async function semearOrdemDeOrcamento(
  dados: OrdemDeOrcamentoParaSemear,
): Promise<OrdemDeOrcamentoSemeada> {
  const semeado = await semearOrcamentoAprovado(dados, true);
  if (!semeado.ordemId) {
    throw new Error("semearOrdemDeOrcamento: a ordem não foi criada.");
  }
  return { ...semeado, ordemId: semeado.ordemId };
}

// O mesmo orçamento aprovado, mas SEM ordem de produção (a caixa desmarcada na aprovação):
// `encomenda_id` nulo — a venda existe, a ordem não.
export async function semearOrcamentoAprovadoSemOrdem(
  dados: OrdemDeOrcamentoParaSemear,
): Promise<Omit<OrdemDeOrcamentoSemeada, "ordemId">> {
  const { ordemId: _ordemId, ...resto } = await semearOrcamentoAprovado(dados, false);
  void _ordemId;
  return resto;
}

async function semearOrcamentoAprovado(
  dados: OrdemDeOrcamentoParaSemear,
  comOrdem: boolean,
): Promise<Omit<OrdemDeOrcamentoSemeada, "ordemId"> & { ordemId: string | null }> {
  const hoje = hojeNoAtelie();
  const entregaPrometida = somarDiasAoHoje(40);
  const categoriaEncomendas = await buscarCategoriaPorNome("Encomendas");
  const pecasPedidas = dados.pecas ?? [{ quantidade: 2 }];
  const precoUnitario = 9000;
  const pecas: {
    nome: string;
    fichaId: string;
    quantidade: number;
    cor: string | null;
    personalizacao: string | null;
    horasMilesimos: number;
  }[] = [];
  for (const [indice, peca] of pecasPedidas.entries()) {
    const nome = nomeDaPecaSemeada(dados.nome, indice);
    const horasMilesimos = peca.horasMilesimos ?? 600;
    const { fichaId } = await semearFicha({
      nome,
      exclusiva: true,
      comItem: false,
      argilaMiligramas: 450000,
      esmalteMiligramas: 60000,
      larguraMm: 120,
      profundidadeMm: 90,
      alturaMm: 100,
      horasMilesimos,
    });
    pecas.push({
      nome,
      fichaId,
      quantidade: peca.quantidade,
      cor: peca.cor ?? null,
      personalizacao: peca.personalizacao ?? null,
      horasMilesimos,
    });
  }

  const total = pecas.reduce((soma, peca) => soma + peca.quantidade * precoUnitario, 0);
  const metade = Math.round(total / 2);
  const terco = Math.floor(total / 3);
  const valores: number[] =
    dados.plano === "avista"
      ? [total]
      : dados.plano === "sinal"
        ? [metade, total - metade]
        : [terco, terco, total - 2 * terco];
  const clienteNome = `[e2e] Cliente de ${dados.nome}`.slice(0, 160);

  return comCliente(async (conexao) => {
    const criadoPor = await idDoUsuarioDeTeste(conexao);
    await conexao.query("begin");
    try {
      const { rows: documentos } = await conexao.query<{ id: string }>(
        `insert into documentos (tipo, data, pessoa_nome, criado_por)
         values ('venda'::tipo_documento, $1, $2, $3) returning id`,
        [hoje, clienteNome, criadoPor],
      );
      const documentoId = documentos[0].id;
      for (const [indice, peca] of pecas.entries()) {
        await conexao.query(
          `insert into documento_linhas
             (documento_id, ordem, descricao, categoria_id, quantidade, valor_centavos)
           values ($1, $2, $3, $4, $5, $6)`,
          [documentoId, indice, peca.nome, categoriaEncomendas, peca.quantidade, peca.quantidade * precoUnitario],
        );
      }
      let parcelaSinalId = "";
      for (const [indice, valor] of valores.entries()) {
        const pago = indice === 0 && dados.sinalPago;
        const { rows } = await conexao.query<{ id: string }>(
          `insert into parcelas
             (documento_id, numero, vencimento, valor_centavos, forma, pago_em, pago_por)
           values ($1, $2, $3, $4, 'pix'::forma_pagamento, $5, $6) returning id`,
          [
            documentoId,
            indice + 1,
            indice === 0 ? hoje : entregaPrometida,
            valor,
            pago ? hoje : null,
            pago ? criadoPor : null,
          ],
        );
        if (indice === 0) {
          parcelaSinalId = rows[0].id;
        }
      }

      let ordemId: string | null = null;
      if (comOrdem) {
        const { rows: ordens } = await conexao.query<{ id: string }>(
          `insert into ordens_producao
             (tipo, caminho, status, nome, cliente_nome, entrega_prometida, inicio, criado_por)
           values ('encomenda', 'completo', 'aguardando_sinal', $1, $2, $3, null, $4) returning id`,
          [dados.nome, clienteNome, entregaPrometida, criadoPor],
        );
        ordemId = ordens[0].id;
        for (const etapa of etapasIniciais("completo")) {
          await conexao.query(
            `insert into ordem_etapas (ordem_id, etapa, posicao, dias_previstos) values ($1, $2, $3, $4)`,
            [ordemId, etapa.etapa, etapa.posicao, etapa.diasPrevistos],
          );
        }
        for (const [indice, peca] of pecas.entries()) {
          await conexao.query(
            `insert into ordem_pecas
               (ordem_id, posicao, ficha_id, descricao, quantidade, cor, personalizacao)
             values ($1, $2, $3, $4, $5, $6, $7)`,
            [ordemId, indice, peca.fichaId, peca.nome, peca.quantidade, peca.cor, peca.personalizacao],
          );
        }
      }

      const snapshot = {
        linhas: pecas.map((peca) => ({
          nome: peca.nome,
          custoCentavos: 4000,
          minimoCentavos: 8000,
          zeroCentavos: 5000,
          horasMilesimos: peca.horasMilesimos,
          quantasCabem: { biscoito: 20, esmalte: 15 },
        })),
        impostoETaxaPontosBase: 0,
        parametrosEstimados: 0,
        congeladoEm: new Date().toISOString(),
      };
      const ano = Number(hoje.slice(0, 4));
      // O sequencial disputa com os orçamentos que outros testes criam pela tela: tenta o próximo
      // livre e, na colisão (23505), tenta de novo a partir de um ponto de salvamento.
      let orcamentoId = "";
      for (let tentativa = 0; tentativa < 5 && !orcamentoId; tentativa += 1) {
        await conexao.query("savepoint orcamento");
        try {
          const { rows } = await conexao.query<{ id: string }>(
            `insert into orcamentos
               (ano, sequencial, status, cliente_nome, titulo, data, entrega_prevista, plano,
                congelado_em, snapshot, documento_id, encomenda_id, criado_por)
             values ($1, (select coalesce(max(sequencial), 0) + 1 from orcamentos where ano = $1),
                     'aprovado', $2, $3, $4, $5, $6, now(), $7::jsonb, $8, $9, $10)
             returning id`,
            [
              ano,
              clienteNome,
              dados.nome.slice(0, 160),
              hoje,
              entregaPrometida,
              dados.plano,
              JSON.stringify(snapshot),
              documentoId,
              ordemId,
              criadoPor,
            ],
          );
          orcamentoId = rows[0].id;
          await conexao.query("release savepoint orcamento");
        } catch (erro) {
          await conexao.query("rollback to savepoint orcamento");
          if ((erro as { code?: string }).code !== "23505") {
            throw erro;
          }
        }
      }
      if (!orcamentoId) {
        throw new Error("semearOrdemDeOrcamento: não achei um sequencial livre para o orçamento.");
      }
      for (const [indice, peca] of pecas.entries()) {
        await conexao.query(
          `insert into orcamento_linhas
             (orcamento_id, ficha_id, quantidade, preco_unitario_centavos, cor, personalizacao, ordem)
           values ($1, $2, $3, $4, $5, $6, $7)`,
          [orcamentoId, peca.fichaId, peca.quantidade, precoUnitario, peca.cor, peca.personalizacao, indice],
        );
      }

      await conexao.query("commit");
      return { ordemId, orcamentoId, documentoId, parcelaSinalId, entregaPrometida };
    } catch (erro) {
      await conexao.query("rollback").catch(() => {});
      throw erro;
    }
  });
}

// Plano 06.1-04 — uma foto de referência do orçamento, só a LINHA de `orcamento_fotos` (no molde do
// que o upload grava: nome "<uuid>.jpg" e `ordem` 0..2). O arquivo em disco não existe — o teste
// confere o `href` e o `alt` da miniatura, nunca a imagem. Devolve o id da linha.
export async function semearFotoDeOrcamento(orcamentoId: string): Promise<string> {
  return comCliente(async (cliente) => {
    const anexadoPor = await idDoUsuarioDeTeste(cliente);
    const { rows } = await cliente.query<{ id: string }>(
      `insert into orcamento_fotos (orcamento_id, ordem, arquivo, bytes, anexado_por)
       values ($1, (select count(*) from orcamento_fotos where orcamento_id = $1),
               gen_random_uuid()::text || '.jpg', 0, $2)
       returning id`,
      [orcamentoId, anexadoPor],
    );
    return rows[0].id;
  });
}

// O número de uma venda (`documentos.numero`, a identidade) — para conferir o "venda nº {M}".
export async function numeroDoDocumentoNoBanco(documentoId: string): Promise<number> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{ numero: number }>(
      "select numero from documentos where id = $1",
      [documentoId],
    );
    return Number(rows[0].numero);
  });
}

// O número "ORC-{ano}-{sequencial}" de um orçamento, montado como a aplicação monta.
export async function numeroDoOrcamentoNoBanco(orcamentoId: string): Promise<string> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{ ano: number; sequencial: number }>(
      "select ano, sequencial from orcamentos where id = $1",
      [orcamentoId],
    );
    return `ORC-${rows[0].ano}-${String(rows[0].sequencial).padStart(3, "0")}`;
  });
}

// Muda o início de uma ordem já liberada — só para o e2e provar que um segundo "Liberar" não o
// reescreve (com o início igual a hoje, os dois seriam indistinguíveis).
export async function definirInicioNoBanco(ordemId: string, inicio: string): Promise<void> {
  await comCliente(async (cliente) => {
    const { rowCount } = await cliente.query(
      `update ordens_producao set inicio = $2 where id = $1 and status = 'ativa'`,
      [ordemId, inicio],
    );
    if (rowCount !== 1) {
      throw new Error(`definirInicioNoBanco: a ordem ${ordemId} não existe ou não está ativa.`);
    }
  });
}

// O `pago_em` de uma parcela como texto `YYYY-MM-DD` (ou `null`) — para provar que a Produção só lê
// o Caixa: liberar a ordem não toca na parcela do sinal.
export async function pagoEmDaParcela(parcelaId: string): Promise<string | null> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{ pago_em: string | null }>(
      "select pago_em::text as pago_em from parcelas where id = $1",
      [parcelaId],
    );
    return rows[0]?.pago_em ?? null;
  });
}
// ---------------------------------------------------------------------------------------------
// Plano 06.1-04 — "fazer a mais, de segurança"
// ---------------------------------------------------------------------------------------------

// Libera a ordem direto no banco (o que "Começar assim mesmo" grava), para o teste que precisa de
// uma encomenda ATIVA vinda de orçamento sem repetir o caminho da tela, já provado no plano 03.
export async function liberarOrdemNoBanco(ordemId: string, inicio: string): Promise<void> {
  await comCliente(async (cliente) => {
    const { rowCount } = await cliente.query(
      `update ordens_producao set status = 'ativa', inicio = $2
        where id = $1 and status = 'aguardando_sinal'`,
      [ordemId, inicio],
    );
    if (rowCount !== 1) {
      throw new Error(`liberarOrdemNoBanco: a ordem ${ordemId} não existe ou não aguarda o sinal.`);
    }
  });
}

// O `a_mais` de cada peça da ordem, por posição.
export async function aMaisDasPecasNoBanco(ordemId: string): Promise<number[]> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{ a_mais: number }>(
      "select a_mais from ordem_pecas where ordem_id = $1 order by posicao",
      [ordemId],
    );
    return rows.map((linha) => linha.a_mais);
  });
}

// As quantidades das linhas da venda e do orçamento, na ordem — o que o cliente paga e recebe. O "a
// mais" nunca pode mudá-las (briefing §2.7).
export async function quantidadesDoClienteNoBanco(
  documentoId: string,
  orcamentoId: string,
): Promise<{ venda: number[]; orcamento: number[]; totalDaVendaCentavos: number }> {
  return comCliente(async (cliente) => {
    const venda = await cliente.query<{ quantidade: string; valor_centavos: number }>(
      "select quantidade::text as quantidade, valor_centavos from documento_linhas where documento_id = $1 order by ordem",
      [documentoId],
    );
    const orcamento = await cliente.query<{ quantidade: number }>(
      "select quantidade from orcamento_linhas where orcamento_id = $1 order by ordem",
      [orcamentoId],
    );
    return {
      venda: venda.rows.map((linha) => Number(linha.quantidade)),
      orcamento: orcamento.rows.map((linha) => linha.quantidade),
      totalDaVendaCentavos: venda.rows.reduce((total, linha) => total + Number(linha.valor_centavos), 0),
    };
  });
}

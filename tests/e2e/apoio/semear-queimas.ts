// Auxiliar de teste: insere queimas de ENCHIMENTO num forno, direto no banco de teste, pelo
// cliente `pg` que o projeto já usa (o mesmo pacote de `db/index.ts` e de
// `tests/e2e/apoio/alternar-ativo.ts`).
//
// Por que existir. `tests/e2e/queimas-cartao.spec.ts` precisa de um forno no NÍVEL CRÍTICO para
// provar que o selo "Manutenção vencida" aparece. Como `medirForno` recusa `limite < 10`
// (`lib/queimas/contador.ts`) e `limiarDeAtencao(10)` é `Math.max(1, 0) = 1`, o menor forno
// possível ainda exige DEZ queimas para cruzar o limite — "um limite menor" não é uma saída que
// exista. Registrar as dez pela interface custava dez idas e voltas de Server Action com
// `revalidatePath` + `router.refresh()` a cada uma, VEZES os dois projetos (`desktop` e
// `celular`), contra o servidor Next único que a suíte inteira compartilha. Era, de longe, a
// spec mais pesada da suíte, e a carga que ela impunha aparecia como instabilidade em testes
// vizinhos que nada tinham a ver com fornos.
//
// O que continua sendo toque real. As duas TRAVESSIAS de fronteira — de `ok` para `atenção` e de
// `atenção` para `crítico` — seguem sendo cliques de verdade na interface, pela mesma Server
// Action `registrarQueima` do fluxo de produção. Só o ENCHIMENTO entre elas vem por aqui: são
// queimas de fundo, cujo único papel é fazer o contador chegar perto do limite. A aritmética da
// fronteira em si (89/90/91, 99/100/101) já é provada de forma determinística e sem servidor
// nenhum por `tests/unit/contador.test.ts` contra `lib/queimas/contador.ts` — não é trabalho do
// e2e reprovar isso a dez toques por viewport.
import { expect, type Page } from "@playwright/test";
import { Client } from "pg";

async function comCliente<T>(operacao: (cliente: Client) => Promise<T>): Promise<T> {
  const cliente = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
  await cliente.connect();
  try {
    return await operacao(cliente);
  } finally {
    await cliente.end();
  }
}

// Insere `quantidade` queimas no forno de nome `nomeDoForno`, todas com `ocorrida_em = now()` e
// autoria do usuário de teste — nunca `registrado_por` nulo, que no schema significa "o usuário
// foi removido" (`on delete set null`), não "ninguém registrou".
//
// Fase 06.4: cada queima de enchimento ganha uma CONTAGEM DE FUNDO (`internas_p = 1`), na mesma
// instrução — o enchimento é dado de fundo, não uma queima que alguém deixou de contar, e a lista
// "Sem contagem" do índice (plano 02, janela de 20) nunca pode ser inundada pelas dezenas de queimas
// de fundo dos specs da Fase 4.
//
// Falha ALTO se não inserir exatamente `quantidade` linhas. Um enchimento silenciosamente vazio
// deixaria o forno no nível errado e o teste falharia depois, longe da causa, parecendo
// instabilidade — que é justamente o que este auxiliar existe para não produzir.
export async function semearQueimas(
  nomeDoForno: string,
  quantidade: number,
  emailDoUsuario: string,
): Promise<void> {
  const resultado = await comCliente((cliente) =>
    cliente.query(
      `with novas as (
         insert into queimas (forno_id, tipo, ocorrida_em, registrado_por)
         select forno.id, 'biscoito'::tipo_queima, now(), usuario.id
           from fornos forno
           cross join usuarios usuario
           cross join generate_series(1, $2) as enchimento
          where forno.nome = $1
            and lower(usuario.email) = lower($3)
         returning id
       )
       insert into queima_contagens (queima_id, internas_p)
       select id, 1 from novas`,
      [nomeDoForno, quantidade, emailDoUsuario],
    ),
  );

  if (resultado.rowCount !== quantidade) {
    throw new Error(
      `semearQueimas: esperava inserir ${quantidade} queimas no forno "${nomeDoForno}", ` +
        `mas inseriu ${resultado.rowCount}. Forno ou usuário de teste não encontrado?`,
    );
  }
}

// ---------------------------------------------------------------------------------------------
// Fase 06.4 — a folha "O que queimou?" abre depois de todo registro pela interface.

export type ContagemLida = {
  internas_p: number;
  internas_m: number;
  internas_g: number;
  externas_p: number;
  externas_m: number;
  externas_g: number;
  saiu_cheio: boolean;
  contado_por: string | null;
};

// A contagem gravada de uma queima, ou `null` (sem contagem).
export async function lerContagem(queimaId: string): Promise<ContagemLida | null> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<ContagemLida>(
      `select internas_p, internas_m, internas_g, externas_p, externas_m, externas_g,
              saiu_cheio, contado_por
         from queima_contagens
        where queima_id = $1`,
      [queimaId],
    );
    return rows[0] ?? null;
  });
}

// Quantas linhas de contagem a queima tem (a PK garante no máximo 1 — o teste confere).
export async function contarContagens(queimaId: string): Promise<number> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{ total: string }>(
      "select count(*) as total from queima_contagens where queima_id = $1",
      [queimaId],
    );
    return Number(rows[0]?.total ?? 0);
  });
}

// A queima mais recente do forno de nome `nomeDoForno`, por `ocorrida_em, id`.
export async function ultimaQueimaDoForno(
  nomeDoForno: string,
): Promise<{ id: string; tipo: string } | null> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{ id: string; tipo: string }>(
      `select queima.id, queima.tipo::text as tipo
         from queimas queima
         join fornos forno on forno.id = queima.forno_id
        where forno.nome = $1
        order by queima.ocorrida_em desc, queima.id desc
        limit 1`,
      [nomeDoForno],
    );
    return rows[0] ?? null;
  });
}

// Fecha a folha "O que queimou?" com "Pular" (nada gravado). Os specs da Fase 4 chamam isto logo
// depois do toque no tipo: a folha é modal e, aberta, esconderia o cartão (e o "Queimar" seguinte).
export async function pularContagem(page: Page): Promise<void> {
  const folha = page.getByTestId("folha-contagem");
  await expect(folha).toBeVisible({ timeout: 10000 });
  await folha.getByTestId("contagem-pular").click();
  await expect(folha).toBeHidden({ timeout: 10000 });
}

// ---------------------------------------------------------------------------------------------
// Fase 06.4, plano 02 — "Sem contagem" e a folha completa.

export type TipoQueima = "biscoito" | "esmalte" | "ouro";

// Insere UMA queima do tipo pedido (biscoito por padrão — os planos 03 e 06 passam o tipo que
// precisam), SEM contagem, no forno de nome `nomeDoForno`, com autoria do usuário de teste, em
// `ocorridaEm` (ISO) ou agora. Devolve o id. Falha alto se não inserir.
export async function semearQueimaSemContagem(
  nomeDoForno: string,
  emailDoUsuario: string,
  ocorridaEm?: string,
  tipo: TipoQueima = "biscoito",
): Promise<string> {
  const { rows } = await comCliente((cliente) =>
    cliente.query<{ id: string }>(
      `insert into queimas (forno_id, tipo, ocorrida_em, registrado_por)
       select forno.id, $4::tipo_queima, coalesce($3::timestamptz, now()), usuario.id
         from fornos forno
         cross join usuarios usuario
        where forno.nome = $1
          and lower(usuario.email) = lower($2)
       returning id`,
      [nomeDoForno, emailDoUsuario, ocorridaEm ?? null, tipo],
    ),
  );
  if (rows.length !== 1) {
    throw new Error(
      `semearQueimaSemContagem: esperava inserir 1 queima no forno "${nomeDoForno}", ` +
        `mas inseriu ${rows.length}. Forno ou usuário de teste não encontrado?`,
    );
  }
  return rows[0].id;
}

// Cadastra um forno direto no banco (limite 50). Serve para garantir que a casa tem MAIS DE UM forno
// (UI-D15: só então o nome do forno aparece nas linhas e na folha) sem depender da ordem dos testes.
export async function semearForno(nome: string): Promise<void> {
  const resultado = await comCliente((cliente) =>
    cliente.query("insert into fornos (nome, limite) values ($1, 50)", [nome]),
  );
  if (resultado.rowCount !== 1) {
    throw new Error(`semearForno: não inseriu o forno "${nome}".`);
  }
}

// Plano 06 — o id de um forno pelo nome único (os Números e o medidor abrem o detalhe e procuram o
// cartão `cartao-forno-{id}` / `contagem-forno-{id}`). Falha alto se não achar exatamente um.
export async function idDoForno(nome: string): Promise<string> {
  const { rows } = await comCliente((cliente) =>
    cliente.query<{ id: string }>("select id from fornos where nome = $1", [nome]),
  );
  if (rows.length !== 1) {
    throw new Error(`idDoForno: esperava 1 forno "${nome}", achou ${rows.length}.`);
  }
  return rows[0].id;
}

// Apaga uma queima pelo banco (o cascade leva a contagem) — simula o "Desfazer" vindo de outro
// aparelho com a folha aberta (sonda QMC-03·concurrency).
export async function apagarQueimaNoBanco(queimaId: string): Promise<void> {
  await comCliente((cliente) => cliente.query("delete from queimas where id = $1", [queimaId]));
}

// ---------------------------------------------------------------------------------------------
// Fase 06.4, plano 03 — uma contagem gravada direto no banco, para "Repetir a última" ter de onde
// copiar e para a régua provar que mudar não mexe em contagem já feita. Os seis números (0 quando
// omitidos) e "saiu cheio" (marcado por padrão); quem contou = o usuário de teste. Falha alto se não
// inserir.
export type ContagemParaSemear = {
  internasP?: number;
  internasM?: number;
  internasG?: number;
  externasP?: number;
  externasM?: number;
  externasG?: number;
  saiuCheio?: boolean;
};

export async function semearContagem(
  queimaId: string,
  contagem: ContagemParaSemear,
): Promise<void> {
  const resultado = await comCliente((cliente) =>
    cliente.query(
      `insert into queima_contagens
         (queima_id, internas_p, internas_m, internas_g, externas_p, externas_m, externas_g,
          saiu_cheio, contado_por)
       select $1, $2, $3, $4, $5, $6, $7, $8, usuario.id
         from usuarios usuario
        where lower(usuario.email) = lower($9)`,
      [
        queimaId,
        contagem.internasP ?? 0,
        contagem.internasM ?? 0,
        contagem.internasG ?? 0,
        contagem.externasP ?? 0,
        contagem.externasM ?? 0,
        contagem.externasG ?? 0,
        contagem.saiuCheio ?? true,
        process.env.E2E_EMAIL_TESTE ?? "",
      ],
    ),
  );
  if (resultado.rowCount !== 1) {
    throw new Error(`semearContagem: não gravou a contagem da queima ${queimaId}.`);
  }
}

// ---------------------------------------------------------------------------------------------
// Fase 06.4, plano 04 — a cobrança das externas.
//
// Os preços dos três itens "Queima externa P/M/G" são estado GLOBAL (um item por chave, no banco
// inteiro), e os projetos `desktop` e `celular` rodam ao mesmo tempo — o mesmo molde de
// `travarItemDaHora` (semear-agenda.ts): quem escreve o preço (ou o nome) de um deles, ou depende do
// "sem preço", segura a trava consultiva do começo ao fim e DEVOLVE os preços a nulo e os nomes ao
// original antes de soltar (os itens nascem sem preço na 0030, e outros casos dependem disso). Preços de
// teste inventados, nunca os do protótipo.
export const TRAVA_DOS_PRECOS_DAS_QUEIMAS = 5_064_004;

const CHAVES_DAS_QUEIMAS = { P: "queima_externa_p", M: "queima_externa_m", G: "queima_externa_g" } as const;

export type PrecosDasQueimas = Record<"P" | "M" | "G", number | null>;

export type TravaDosPrecosDasQueimas = {
  definirPrecos: (precos: Partial<PrecosDasQueimas>) => Promise<void>;
  renomear: (tamanho: "P" | "M" | "G", nome: string) => Promise<void>;
  nomes: Record<"P" | "M" | "G", string>;
  soltar: () => Promise<void>;
};

export async function travarPrecosDasQueimas(precos: PrecosDasQueimas): Promise<TravaDosPrecosDasQueimas> {
  const cliente = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
  await cliente.connect();
  await cliente.query("select pg_advisory_lock($1)", [TRAVA_DOS_PRECOS_DAS_QUEIMAS]);
  const { rows } = await cliente.query<{ chave: string; nome: string }>(
    "select chave_do_sistema as chave, nome from itens_catalogo where chave_do_sistema like 'queima_externa_%'",
  );
  const nomeDe = (tamanho: "P" | "M" | "G") =>
    rows.find((linha) => linha.chave === CHAVES_DAS_QUEIMAS[tamanho])?.nome ?? `Queima externa ${tamanho}`;
  const nomes = { P: nomeDe("P"), M: nomeDe("M"), G: nomeDe("G") };

  async function definirPrecos(novos: Partial<PrecosDasQueimas>): Promise<void> {
    for (const tamanho of ["P", "M", "G"] as const) {
      if (novos[tamanho] === undefined) {
        continue;
      }
      await cliente.query("update itens_catalogo set preco_venda_centavos = $1 where chave_do_sistema = $2", [
        novos[tamanho],
        CHAVES_DAS_QUEIMAS[tamanho],
      ]);
    }
  }

  try {
    await definirPrecos(precos);
  } catch (erro) {
    await cliente.query("select pg_advisory_unlock($1)", [TRAVA_DOS_PRECOS_DAS_QUEIMAS]);
    await cliente.end();
    throw erro;
  }

  return {
    definirPrecos,
    nomes,
    renomear: async (tamanho, nome) => {
      await cliente.query("update itens_catalogo set nome = $1 where chave_do_sistema = $2", [
        nome,
        CHAVES_DAS_QUEIMAS[tamanho],
      ]);
    },
    soltar: async () => {
      try {
        for (const tamanho of ["P", "M", "G"] as const) {
          await cliente.query(
            "update itens_catalogo set preco_venda_centavos = null, nome = $1 where chave_do_sistema = $2",
            [nomes[tamanho], CHAVES_DAS_QUEIMAS[tamanho]],
          );
        }
        await cliente.query("select pg_advisory_unlock($1)", [TRAVA_DOS_PRECOS_DAS_QUEIMAS]);
      } finally {
        await cliente.end();
      }
    },
  };
}

// Uma venda ligada a uma queima, como o banco a guarda: o vínculo (`queima_vendas`, com as três
// quantidades e quem lançou) e a venda (`documentos`: número, pessoa, cancelamento; as linhas; as
// parcelas). Em ordem de `criado_em` do vínculo.
export type VendaDaQueimaNoBanco = {
  documentoId: string;
  numero: number;
  quantidadeP: number;
  quantidadeM: number;
  quantidadeG: number;
  lancadoPor: string | null;
  data: string;
  pessoaNome: string | null;
  clienteId: string | null;
  cancelado: boolean;
  linhas: { itemId: string | null; descricao: string; quantidade: number; valorCentavos: number }[];
  parcelas: { vencimento: string; valorCentavos: number; forma: string; pagoEm: string | null }[];
};

export async function lerVendasDaQueima(queimaId: string): Promise<VendaDaQueimaNoBanco[]> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<Omit<VendaDaQueimaNoBanco, "linhas" | "parcelas" | "numero"> & { numero: string }>(
      `select v.documento_id as "documentoId", d.numero, v.quantidade_p as "quantidadeP",
              v.quantidade_m as "quantidadeM", v.quantidade_g as "quantidadeG", v.lancado_por as "lancadoPor",
              to_char(d.data, 'YYYY-MM-DD') as data, d.pessoa_nome as "pessoaNome", d.cliente_id as "clienteId",
              d.cancelado_em is not null as cancelado
         from queima_vendas v join documentos d on d.id = v.documento_id
        where v.queima_id = $1
        order by v.criado_em, d.numero`,
      [queimaId],
    );
    const vendas: VendaDaQueimaNoBanco[] = [];
    for (const linha of rows) {
      const linhas = await cliente.query<VendaDaQueimaNoBanco["linhas"][number]>(
        `select item_id as "itemId", descricao, quantidade, valor_centavos as "valorCentavos"
           from documento_linhas where documento_id = $1 order by ordem`,
        [linha.documentoId],
      );
      const parcelasDaVenda = await cliente.query<VendaDaQueimaNoBanco["parcelas"][number]>(
        `select to_char(vencimento, 'YYYY-MM-DD') as vencimento, valor_centavos as "valorCentavos",
                forma::text as forma, to_char(pago_em, 'YYYY-MM-DD') as "pagoEm"
           from parcelas where documento_id = $1 order by numero`,
        [linha.documentoId],
      );
      vendas.push({
        ...linha,
        numero: Number(linha.numero),
        linhas: linhas.rows.map((item) => ({ ...item, quantidade: Number(item.quantidade) })),
        parcelas: parcelasDaVenda.rows,
      });
    }
    return vendas;
  });
}

// Quantas destas vendas ainda existem em `documentos` (apagar a queima nunca leva venda nenhuma).
export async function contarDocumentos(documentoIds: readonly string[]): Promise<number> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{ total: string }>(
      "select count(*) as total from documentos where id = any($1::uuid[])",
      [documentoIds],
    );
    return Number(rows[0]?.total ?? 0);
  });
}

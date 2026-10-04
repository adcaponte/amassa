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

// Apaga uma queima pelo banco (o cascade leva a contagem) — simula o "Desfazer" vindo de outro
// aparelho com a folha aberta (sonda QMC-03·concurrency).
export async function apagarQueimaNoBanco(queimaId: string): Promise<void> {
  await comCliente((cliente) => cliente.query("delete from queimas where id = $1", [queimaId]));
}

// Prova da limpeza geral (item 10 da fila do Code, quick 261008-6f1): roda o CLI DE VERDADE
// (`npm run limpeza-geral`, o mesmo comando que o Theo roda na `ferramentas`) contra um banco
// PRÓPRIO, criado e apagado aqui — a limpeza é destrutiva e nunca pode tocar o banco que os outros
// passos de `npm run test:migracoes` compartilham (o motivo de `provarRemocaoEmBancoProprio`), nem
// o de produção (recusa o nome `amassa`).
//
// Chamada por `scripts/testar-migracoes.mjs` (`provarLimpezaGeral`), com `DATABASE_URL_TESTE`.
// Também roda sozinha: `DATABASE_URL_TESTE=postgresql://... node scripts/provar-limpeza-geral.mjs`.
// Nomes inventados e genéricos em toda linha criada aqui — o repositório é público.
import { spawnSync, execSync } from "node:child_process";

import { Client } from "pg";

const BANCO_DE_PRODUCAO = "amassa";

function afirmar(condicao, mensagem) {
  if (!condicao) {
    throw new Error(mensagem);
  }
}

// npm é .cmd no Windows — precisa do shell; nenhum argumento desta prova tem espaço.
function rodarNpm(comando, opcoes = {}) {
  execSync(comando, { stdio: "inherit", ...opcoes });
}

// Roda `npm run limpeza-geral -- <argumentos>` e devolve código de saída e a saída inteira
// (stdout + stderr), mesmo quando o script recusa.
function rodarLimpeza(url, argumentos = []) {
  const comando = ["npm run limpeza-geral", argumentos.length > 0 ? `-- ${argumentos.join(" ")}` : ""]
    .join(" ")
    .trim();
  const resultado = spawnSync(comando, {
    shell: true,
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: url },
  });
  return {
    codigoDeSaida: resultado.status ?? 1,
    saida: `${resultado.stdout ?? ""}\n${resultado.stderr ?? ""}`,
  };
}

async function tabelasDoPublic(cliente) {
  const { rows } = await cliente.query(
    `select table_name as nome from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`,
  );
  return rows.map((linha) => linha.nome);
}

// Impressão de CONTEÚDO: md5 de todas as linhas de cada tabela do public e da tabela de migrações
// do Drizzle, e o estado das três numerações.
async function impressao(cliente) {
  const resultado = {};
  const tabelas = [...(await tabelasDoPublic(cliente)).map((nome) => `public.${nome}`), "drizzle.__drizzle_migrations"];
  for (const tabela of tabelas) {
    const [esquema, nome] = tabela.split(".");
    const { rows } = await cliente.query(
      `select count(*)::int as linhas, md5(coalesce(string_agg(t::text, '|' order by t::text), '')) as md5
         from "${esquema}"."${nome}" t`,
    );
    resultado[tabela] = `${rows[0].linhas}:${rows[0].md5}`;
  }
  for (const sequencia of [
    "documentos_numero_seq",
    "movimentacoes_estoque_numero_seq",
    "ordens_producao_numero_seq",
  ]) {
    const { rows } = await cliente.query(`select last_value::text, is_called from ${sequencia}`);
    resultado[`sequence ${sequencia}`] = `${rows[0].last_value}:${rows[0].is_called}`;
  }
  return resultado;
}

function diferencas(antes, depois, so = null) {
  const nomes = new Set([...Object.keys(antes), ...Object.keys(depois)]);
  return [...nomes].filter((nome) => (so === null || so.includes(nome)) && antes[nome] !== depois[nome]);
}

async function contar(cliente, tabela) {
  const { rows } = await cliente.query(`select count(*)::int as total from ${tabela}`);
  return rows[0].total;
}

async function umId(cliente, sql, parametros = []) {
  const { rows } = await cliente.query(sql, parametros);
  afirmar(rows.length > 0, `A semeadura não achou o que precisava: ${sql}`);
  return rows[0].id;
}

// Uma venda/despesa com uma linha e a parcela que fecha a soma — a restrição ADIADA da 0015 só
// deixa comitar assim. Chamada DENTRO de uma transação aberta por quem chama.
async function inserirDocumento(cliente, { tipo, usuarioId, categoriaId, itemId = null, valor, extras = {} }) {
  const colunas = ["tipo", "data", "criado_por", ...Object.keys(extras)];
  const valores = [tipo, usuarioId, ...Object.values(extras)];
  const marcadores = ["$1", "current_date", "$2", ...Object.keys(extras).map((_, indice) => `$${indice + 3}`)];
  const documentoId = await umId(
    cliente,
    `insert into documentos (${colunas.join(", ")}) values (${marcadores.join(", ")}) returning id`,
    valores,
  );
  const linhaId = await umId(
    cliente,
    `insert into documento_linhas (documento_id, ordem, item_id, descricao, categoria_id, valor_centavos)
     values ($1, 1, $2, 'Linha da prova da limpeza', $3, $4) returning id`,
    [documentoId, itemId, categoriaId, valor],
  );
  await cliente.query(
    `insert into parcelas (documento_id, numero, vencimento, valor_centavos, forma, pago_em, pago_por)
     values ($1, 1, current_date, $2, 'pix', current_date, $3)`,
    [documentoId, valor, usuarioId],
  );
  return { documentoId, linhaId };
}

async function semear(cliente) {
  const usuarioId = await umId(
    cliente,
    `insert into usuarios (nome, email, senha_hash) values ('Gestora da Prova', 'gestora.prova@exemplo.com', 'hash-de-prova')
     returning id`,
  );
  const categoriaVenda = await umId(cliente, `select id from categorias where nome = 'Peças prontas'`);
  const clienteId = await umId(
    cliente,
    `insert into clientes (nome, telefone, criado_por) values ('Cliente da Prova', '(00) 00000-0000', $1) returning id`,
    [usuarioId],
  );
  const itemId = await umId(
    cliente,
    `insert into itens_catalogo (nome, categoria_venda_id, preco_venda_centavos, aparece_na_venda)
     values ('Caneca de prova', $1, 4500, true) returning id`,
    [categoriaVenda],
  );

  await cliente.query("begin");
  await inserirDocumento(cliente, {
    tipo: "venda",
    usuarioId,
    categoriaId: categoriaVenda,
    itemId,
    valor: 4500,
    extras: { cliente_id: clienteId, pessoa_nome: "Cliente da Prova" },
  });
  await cliente.query("commit");

  await cliente.query(
    `update itens_catalogo set preco_venda_centavos = 3000 where chave_do_sistema = 'queima_externa_p'`,
  );

  const cotacaoCategoria = await umId(
    cliente,
    `insert into cotacao_categorias (nome) values ('Fornos (prova)') returning id`,
  );
  await cliente.query(
    `insert into cotacoes (categoria_id, empresa, produto, preco_centavos) values ($1, 'Empresa da Prova', 'Forno de prova', 1500000)`,
    [cotacaoCategoria],
  );
  await cliente.query(
    `insert into abertura_itens (nome, categoria, valor_centavos, forma_pagamento, parcelas, primeira_parcela_em)
     values ('Bancada de prova', 'moveis', 80000, 'vista', 1, '2026-11-01')`,
  );
  await cliente.query(
    `insert into configuracao_financeira (taxa_cartao_pontos_base, saldo_inicial_centavos, data_saldo_inicial)
     values (350, 123456, '2026-12-01')`,
  );

  return { usuarioId };
}

async function registrarBackup(cliente, { sucesso = true, horasAtras = 0 } = {}) {
  await cliente.query(
    `insert into execucoes_backup (quando, sucesso, bytes, destino_externo_ok, fotos_bytes, fotos_destino_externo_ok,
                                   anexos_bytes, anexos_destino_externo_ok, mensagem)
     values (now() - make_interval(hours => $1), $2, 1000, true, 0, true, 0, true, 'backup da prova')`,
    [horasAtras, sucesso],
  );
}

async function provar(url, bancoDaProva) {
  const cliente = new Client({ connectionString: url });
  await cliente.connect();
  try {
    await semear(cliente);
    await registrarBackup(cliente);

    const antes = await impressao(cliente);
    const { rows: itensComChaveAntes } = await cliente.query(
      `select md5(string_agg(t::text, '|' order by t::text)) as md5, count(*)::int as total
         from itens_catalogo t where chave_do_sistema is not null`,
    );

    // (e) ensaio
    const ensaio = rodarLimpeza(url);
    afirmar(ensaio.codigoDeSaida === 0, `O ensaio deveria sair 0, saiu ${ensaio.codigoDeSaida}:\n${ensaio.saida}`);
    afirmar(/nada foi gravado/i.test(ensaio.saida), `O ensaio deveria dizer "nada foi gravado":\n${ensaio.saida}`);
    const depoisDoEnsaio = await impressao(cliente);
    afirmar(
      diferencas(antes, depoisDoEnsaio).length === 0,
      `O ensaio mudou o banco: ${diferencas(antes, depoisDoEnsaio).join(", ")}`,
    );
    console.log("  (e) ensaio: nada gravado, banco idêntico, ok");

    // (f) execução
    const execucao = rodarLimpeza(url, ["--confirmar", "--banco", bancoDaProva]);
    afirmar(
      execucao.codigoDeSaida === 0,
      `A limpeza com --confirmar deveria sair 0, saiu ${execucao.codigoDeSaida}:\n${execucao.saida}`,
    );
    afirmar(/Limpeza gravada/.test(execucao.saida), `A limpeza deveria dizer "Limpeza gravada":\n${execucao.saida}`);

    for (const tabela of ["documentos", "documento_linhas", "parcelas", "clientes"]) {
      const total = await contar(cliente, tabela);
      afirmar(total === 0, `Depois da limpeza, ${tabela} deveria ter 0 linhas, tem ${total}.`);
    }
    const depois = await impressao(cliente);
    const ficam = ["public.cotacoes", "public.cotacao_categorias", "public.abertura_itens"];
    afirmar(
      diferencas(antes, depois, ficam).length === 0,
      `A limpeza mexeu no que fica: ${diferencas(antes, depois, ficam).join(", ")}`,
    );
    const { rows: itensComChaveDepois } = await cliente.query(
      `select md5(string_agg(t::text, '|' order by t::text)) as md5, count(*)::int as total
         from itens_catalogo t where chave_do_sistema is not null`,
    );
    afirmar(
      itensComChaveDepois[0].total === 6 && itensComChaveDepois[0].md5 === itensComChaveAntes[0].md5,
      `Os 6 itens do sistema deveriam ficar idênticos (preço inclusive): eram ${itensComChaveAntes[0].total}, ficaram ${itensComChaveDepois[0].total}.`,
    );
    const { rows: configuracao } = await cliente.query(
      "select saldo_inicial_centavos as saldo, taxa_cartao_pontos_base as taxa from configuracao_financeira",
    );
    afirmar(
      configuracao.length === 1 && configuracao[0].saldo === 0 && configuracao[0].taxa === 350,
      `O saldo inicial deveria ir a 0 e a taxa ficar 350: ${JSON.stringify(configuracao)}`,
    );
    console.log("  (f) --confirmar: apagou o que sai, manteve o que fica, saldo 0, ok");
  } finally {
    await cliente.end();
  }
}

async function main() {
  const urlTeste = process.env.DATABASE_URL_TESTE;
  afirmar(urlTeste, "DATABASE_URL_TESTE não está definida — esta prova só roda contra o banco de teste.");

  const url = new URL(urlTeste);
  const bancoOriginal = url.pathname.slice(1);
  const bancoDaProva = `${bancoOriginal}_limpeza`;
  afirmar(
    bancoOriginal !== BANCO_DE_PRODUCAO && bancoDaProva !== BANCO_DE_PRODUCAO,
    "Recusado: esta prova só roda no banco de TESTE, nunca no banco amassa.",
  );

  const urlAdmin = new URL(url);
  urlAdmin.pathname = "/postgres";
  const urlDaProva = new URL(url);
  urlDaProva.pathname = `/${bancoDaProva}`;

  const admin = new Client({ connectionString: urlAdmin.toString() });
  await admin.connect();
  try {
    await admin.query(`drop database if exists "${bancoDaProva}"`);
    await admin.query(`create database "${bancoDaProva}"`);
  } finally {
    await admin.end();
  }

  try {
    console.log(`Provando a limpeza geral em banco próprio ("${bancoDaProva}")...`);
    rodarNpm("npm run db:migrate", { env: { ...process.env, DATABASE_URL: urlDaProva.toString() } });
    await provar(urlDaProva.toString(), bancoDaProva);
  } finally {
    const faxina = new Client({ connectionString: urlAdmin.toString() });
    await faxina.connect();
    try {
      await faxina.query(`drop database if exists "${bancoDaProva}" with (force)`);
    } finally {
      await faxina.end();
    }
  }

  console.log("Limpeza geral provada.");
}

main().catch((erro) => {
  console.error("A prova da limpeza geral falhou:", erro.message);
  process.exitCode = 1;
});

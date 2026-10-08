// Prova da limpeza geral (item 10 da fila do Code, quick 261008-6f1): roda o CLI DE VERDADE
// (`npm run limpeza-geral`, o mesmo comando que o Theo roda na `ferramentas` pelo Roteiro 24)
// contra um banco PRÓPRIO, criado e apagado aqui — a limpeza é destrutiva e nunca pode tocar o
// banco que os outros passos de `npm run test:migracoes` compartilham (o motivo de
// `provarRemocaoEmBancoProprio`), nem o de produção (recusa o nome `amassa`).
//
// O que ela prova, na ordem:
//   - as 46 tabelas do schema public populadas (medido, não confiado);
//   - (a) impressão de conteúdo e de ESTRUTURA (colunas, índices, restrições, gatilhos, privilégios);
//   - (b1)/(b2) `--confirmar` recusa sem backup e com backup de 4 horas, sem gravar nada;
//   - (c) `--confirmar` recusa sem `--banco` e com `--banco` de outro banco;
//   - (d) uma tabela não classificada faz a SQL recusar, no ensaio e no `--confirmar`;
//   - (e) o ensaio não muda nada;
//   - (f) o `--confirmar` apaga o que sai, mantém o que fica, zera o saldo e as numerações, e a
//         estrutura do banco fica idêntica;
//   - (g) as consultas das rotas de saúde continuam respondendo;
//   - (h) rodar de novo não muda nada;
//   - (i) a próxima venda, ordem, movimentação e orçamento recebem o número 1.
//
// Chamada por `scripts/testar-migracoes.mjs` (`provarLimpezaGeral`), com `DATABASE_URL_TESTE`.
// Também roda sozinha: `DATABASE_URL_TESTE=postgresql://... node scripts/provar-limpeza-geral.mjs`.
// Nomes inventados e genéricos em toda linha criada aqui — o repositório é público.
import { execSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { Client } from "pg";

const BANCO_DE_PRODUCAO = "amassa";

// A classificação do Theo de 08/10/2026 — a MESMA de `db/limpeza/limpeza-geral.sql`. A prova a
// repete de propósito: se uma das duas mudar sem a outra, a prova falha.
const APAGA = [
  "ordens_producao", "ordem_pecas", "ordem_etapas",
  "orcamentos", "orcamento_linhas", "orcamento_projeto", "orcamento_revisoes", "orcamento_fotos",
  "documentos", "documento_linhas", "parcelas", "correcoes_de_documento", "contas_fixas",
  "movimentacoes_estoque",
  "ficha_tecnica", "fichas_precificacao",
  "fornos", "queimas", "queima_contagens", "queima_vendas", "manutencoes",
  "turmas", "turma_alunos", "inscricoes", "mensalidades", "eventos", "usos_livres", "usos_livres_material",
  "clientes", "fornecedores", "fornecedor_anexos",
  "lembretes",
];
const FICA = [
  "abertura_itens", "abertura_tarefas", "abertura_configuracao",
  "cotacoes", "cotacao_categorias",
  "categorias", "parametros_precificacao",
  "usuarios", "execucoes_backup", "verificacao_infraestrutura",
];
const SEQUENCIAS = ["documentos_numero_seq", "movimentacoes_estoque_numero_seq", "ordens_producao_numero_seq"];
const TABELA_INTRUSA = "tabela_nao_classificada_da_prova";

let casos = 0;

function afirmar(condicao, mensagem) {
  if (!condicao) {
    throw new Error(mensagem);
  }
}

function caso(rotulo) {
  casos++;
  console.log(`  ${rotulo} ok`);
}

// O ano civil em America/Sao_Paulo, calculado pelo Node — o mesmo critério do app.
function anoEmBrasilia() {
  return Number(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric" }).format(new Date()),
  );
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

// Impressão de CONTEÚDO: contagem e md5 de todas as linhas de cada tabela do public e da tabela de
// migrações do Drizzle, e o estado das três numerações.
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
  for (const sequencia of SEQUENCIAS) {
    const { rows } = await cliente.query(`select last_value::text, is_called from ${sequencia}`);
    resultado[`sequence ${sequencia}`] = `${rows[0].last_value}:${rows[0].is_called}`;
  }
  return resultado;
}

// Impressão de ESTRUTURA do public: colunas, índices, restrições, gatilhos e privilégios.
async function impressaoDaEstrutura(cliente) {
  const consultas = {
    colunas: `select table_name, column_name, data_type, udt_name, is_nullable, column_default, is_identity,
                     identity_generation, is_generated
                from information_schema.columns where table_schema = 'public'`,
    indices: `select tablename, indexname, indexdef from pg_indexes where schemaname = 'public'`,
    restricoes: `select c.relname, k.conname, k.contype, pg_get_constraintdef(k.oid) as definicao
                   from pg_constraint k join pg_class c on c.oid = k.conrelid
                  where k.connamespace = 'public'::regnamespace`,
    gatilhos: `select c.relname, t.tgname, t.tgenabled, pg_get_triggerdef(t.oid) as definicao
                 from pg_trigger t join pg_class c on c.oid = t.tgrelid
                where c.relnamespace = 'public'::regnamespace and not t.tgisinternal`,
    privilegios: `select grantee, table_name, privilege_type from information_schema.role_table_grants
                   where table_schema = 'public'`,
  };
  const resultado = {};
  for (const [nome, sql] of Object.entries(consultas)) {
    const { rows } = await cliente.query(
      `select count(*)::int as linhas, md5(coalesce(string_agg(t::text, '|' order by t::text), '')) as md5
         from (${sql}) t`,
    );
    resultado[nome] = `${rows[0].linhas}:${rows[0].md5}`;
  }
  return resultado;
}

function diferencas(antes, depois, so = null) {
  const nomes = so ?? [...new Set([...Object.keys(antes), ...Object.keys(depois)])];
  return nomes.filter((nome) => antes[nome] !== depois[nome]);
}

function afirmarIgual(antes, depois, contexto, so = null) {
  const mudou = diferencas(antes, depois, so);
  afirmar(mudou.length === 0, `${contexto} mudou: ${mudou.join(", ")}`);
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

async function inserir(cliente, tabela, campos) {
  const colunas = Object.keys(campos);
  const marcadores = colunas.map((_, indice) => `$${indice + 1}`);
  const { rows } = await cliente.query(
    `insert into ${tabela} (${colunas.join(", ")}) values (${marcadores.join(", ")}) returning *`,
    Object.values(campos),
  );
  return rows[0];
}

// Uma venda/despesa com uma linha e a parcela que fecha a soma — a restrição ADIADA da 0015 só
// deixa comitar assim. Abre e fecha a própria transação.
async function inserirDocumento(cliente, { tipo, usuarioId, categoriaId, itemId = null, valor, extras = {} }) {
  await cliente.query("begin");
  try {
    const documento = await inserir(cliente, "documentos", {
      tipo,
      data: "2026-10-01",
      criado_por: usuarioId,
      ...extras,
    });
    const linha = await inserir(cliente, "documento_linhas", {
      documento_id: documento.id,
      ordem: 1,
      item_id: itemId,
      descricao: "Linha da prova da limpeza",
      categoria_id: categoriaId,
      valor_centavos: valor,
    });
    await inserir(cliente, "parcelas", {
      documento_id: documento.id,
      numero: 1,
      vencimento: "2026-10-01",
      valor_centavos: valor,
      forma: "pix",
      pago_em: "2026-10-01",
      pago_por: usuarioId,
    });
    await cliente.query("commit");
    return { documentoId: documento.id, numero: Number(documento.numero), linhaId: linha.id };
  } catch (erro) {
    await cliente.query("rollback");
    throw erro;
  }
}

async function categoria(cliente, nome) {
  return umId(cliente, "select id from categorias where nome = $1", [nome]);
}

// Pelo menos uma linha válida em cada uma das 46 tabelas, com os casos de borda: a cadeia queima →
// contagem → venda; uma correção entre duas vendas; um orçamento aprovado com linha, projeto, foto
// e revisão, ligado a venda e a ordem; ordem com etapas e peças; turma, aluno, evento, inscrição,
// mensalidade, uso livre com material e a movimentação ligada a ele; um estorno (o vínculo do livro
// consigo mesmo); fornecedor com anexo e uma despesa dele; ficha técnica e ficha de precificação
// apontando para ITEM DO SISTEMA (saem; o item fica). `execucoes_backup` fica vazia de propósito —
// o caso (b1) precisa dela sem linha; os backups entram nos casos.
async function semear(cliente) {
  const usuario = await inserir(cliente, "usuarios", {
    nome: "Gestora da Prova",
    email: "gestora.prova@exemplo.com",
    senha_hash: "hash-de-prova",
  });
  const usuarioId = usuario.id;

  const pecasProntas = await categoria(cliente, "Peças prontas");
  const queimaExterna = await categoria(cliente, "Queima externa");
  const insumos = await categoria(cliente, "Argila, esmalte e insumos");
  const aluguel = await categoria(cliente, "Aluguel");

  // FICA — uma linha nova em cada.
  const itemAbertura = await inserir(cliente, "abertura_itens", {
    nome: "Bancada de prova",
    categoria: "moveis",
    valor_centavos: 80000,
    forma_pagamento: "vista",
    parcelas: 1,
    primeira_parcela_em: "2026-11-01",
  });
  await inserir(cliente, "abertura_tarefas", {
    descricao: "Montar a bancada de prova",
    grupo: "montagem",
    prazo_em: "2026-11-20",
    responsavel_id: usuarioId,
    item_id: itemAbertura.id,
  });
  await inserir(cliente, "abertura_configuracao", { inauguracao_em: "2026-12-05" });
  const cotacaoCategoria = await inserir(cliente, "cotacao_categorias", { nome: "Fornos (prova)" });
  await inserir(cliente, "cotacoes", {
    categoria_id: cotacaoCategoria.id,
    empresa: "Empresa da Prova",
    produto: "Forno de prova",
    preco_centavos: 1500000,
  });
  await inserir(cliente, "categorias", { nome: "Categoria da prova", grupo: "receita", area: "loja" });
  await inserir(cliente, "parametros_precificacao", {
    chave: "trabalho_hora",
    valor_inteiro: 4000,
    medido: false,
    vigente_desde: "2026-01-01",
    criado_por: usuarioId,
  });
  await inserir(cliente, "verificacao_infraestrutura", { nota: "linha da prova da limpeza" });

  // ZERA e SEMENTE.
  await inserir(cliente, "configuracao_financeira", {
    taxa_cartao_pontos_base: 350,
    saldo_inicial_centavos: 123456,
    data_saldo_inicial: "2026-12-01",
  });
  await inserir(cliente, "contadores_orcamento", { ano: anoEmBrasilia(), ultimo_numero: 7 });
  await cliente.query("update anotacoes_da_casa set texto = 'Anotação de prova', salvo_por = $1", [usuarioId]);

  // PARCIAL — o preço de um item do sistema muda (e tem de ficar); itens sem chave saem.
  await cliente.query(
    "update itens_catalogo set preco_venda_centavos = 3000 where chave_do_sistema = 'queima_externa_p'",
  );
  const queimaP = await umId(cliente, "select id from itens_catalogo where chave_do_sistema = 'queima_externa_p'");
  const mensalidadeItem = await umId(cliente, "select id from itens_catalogo where chave_do_sistema = 'mensalidade'");
  const itemVenda = await inserir(cliente, "itens_catalogo", {
    nome: "Caneca de prova",
    categoria_venda_id: pecasProntas,
    preco_venda_centavos: 4500,
    aparece_na_venda: true,
  });
  const argila = await inserir(cliente, "itens_catalogo", {
    nome: "Argila de prova",
    controla_estoque: true,
    unidade: "kg",
    categoria_compra_id: insumos,
  });

  // Cadastros.
  const clienteId = (
    await inserir(cliente, "clientes", { nome: "Cliente da Prova", telefone: "(00) 00000-0000", criado_por: usuarioId })
  ).id;
  const fornecedorId = (
    await inserir(cliente, "fornecedores", {
      nome: "Fornecedor da Prova",
      area: "pecas",
      criado_por: usuarioId,
      atualizado_por: usuarioId,
    })
  ).id;
  await inserir(cliente, "fornecedor_anexos", {
    fornecedor_id: fornecedorId,
    nome: "Nota de prova",
    tipo: "nota",
    arquivo_caminho: `${randomUUID()}.pdf`,
    arquivo_tipo: "application/pdf",
    arquivo_bytes: 1234,
    extensao: "pdf",
    criado_por: usuarioId,
  });
  const contaFixaId = (
    await inserir(cliente, "contas_fixas", {
      nome: "Aluguel de prova",
      categoria_id: aluguel,
      valor_esperado_centavos: 100000,
      dia_vencimento: 10,
    })
  ).id;

  // Financeiro — várias vendas para a numeração passar de 1, uma despesa do fornecedor e a da
  // conta fixa, e uma correção entre duas vendas.
  const vendaComCliente = await inserirDocumento(cliente, {
    tipo: "venda",
    usuarioId,
    categoriaId: pecasProntas,
    itemId: itemVenda.id,
    valor: 4500,
    extras: { cliente_id: clienteId, pessoa_nome: "Cliente da Prova" },
  });
  const vendaCorrigida = await inserirDocumento(cliente, {
    tipo: "venda",
    usuarioId,
    categoriaId: pecasProntas,
    itemId: itemVenda.id,
    valor: 9000,
  });
  const vendaDaQueima = await inserirDocumento(cliente, {
    tipo: "venda",
    usuarioId,
    categoriaId: queimaExterna,
    itemId: queimaP,
    valor: 6000,
  });
  const vendaDoOrcamento = await inserirDocumento(cliente, {
    tipo: "venda",
    usuarioId,
    categoriaId: pecasProntas,
    valor: 11000,
  });
  const despesaDoFornecedor = await inserirDocumento(cliente, {
    tipo: "despesa",
    usuarioId,
    categoriaId: insumos,
    itemId: argila.id,
    valor: 5000,
    extras: { fornecedor_id: fornecedorId, pessoa_nome: "Fornecedor da Prova" },
  });
  await inserirDocumento(cliente, {
    tipo: "despesa",
    usuarioId,
    categoriaId: aluguel,
    valor: 100000,
    extras: { conta_fixa_id: contaFixaId, mes_referencia: "2026-10-01" },
  });
  await inserir(cliente, "correcoes_de_documento", {
    original_id: vendaComCliente.documentoId,
    corrigido_id: vendaCorrigida.documentoId,
    criado_por: usuarioId,
  });

  // Fichas — uma exclusiva (para o orçamento e a ordem) e uma ligada ao ITEM DO SISTEMA.
  const fichaExclusiva = await inserir(cliente, "fichas_precificacao", {
    nome: "Ficha exclusiva de prova",
    exclusiva: true,
    criado_por: usuarioId,
  });
  await inserir(cliente, "fichas_precificacao", {
    nome: "Ficha do item do sistema",
    exclusiva: false,
    item_catalogo_id: mensalidadeItem,
    criado_por: usuarioId,
  });
  await inserir(cliente, "ficha_tecnica", { item_id: queimaP, insumo_id: argila.id, quantidade: "0.5" });

  // Produção e orçamento aprovado ligado a venda e ordem.
  const ordem = await inserir(cliente, "ordens_producao", {
    tipo: "encomenda",
    status: "ativa",
    nome: "Encomenda de prova",
    cliente_nome: "Cliente da Prova",
    inicio: "2026-10-01",
    criado_por: usuarioId,
  });
  await inserir(cliente, "ordem_etapas", { ordem_id: ordem.id, etapa: "producao", posicao: 0, dias_previstos: 3 });
  await inserir(cliente, "ordem_pecas", {
    ordem_id: ordem.id,
    posicao: 0,
    ficha_id: fichaExclusiva.id,
    descricao: "Prato de prova",
    quantidade: 2,
  });
  const orcamento = await inserir(cliente, "orcamentos", {
    ano: anoEmBrasilia(),
    sequencial: 7,
    status: "aprovado",
    cliente_nome: "Cliente da Prova",
    data: "2026-10-01",
    entrega_prevista: "2026-11-01",
    snapshot: JSON.stringify({ prova: true }),
    congelado_em: new Date().toISOString(),
    documento_id: vendaDoOrcamento.documentoId,
    encomenda_id: ordem.id,
    criado_por: usuarioId,
  });
  await inserir(cliente, "orcamento_linhas", {
    orcamento_id: orcamento.id,
    ficha_id: fichaExclusiva.id,
    quantidade: 2,
    preco_unitario_centavos: 5000,
    ordem: 0,
  });
  await inserir(cliente, "orcamento_projeto", {
    orcamento_id: orcamento.id,
    descricao: "Projeto de prova",
    valor_centavos: 1000,
    ordem: 0,
  });
  await inserir(cliente, "orcamento_fotos", {
    orcamento_id: orcamento.id,
    ordem: 0,
    arquivo: `${randomUUID()}.jpg`,
    bytes: 2048,
    anexado_por: usuarioId,
  });
  await inserir(cliente, "orcamento_revisoes", {
    orcamento_id: orcamento.id,
    revisao: 1,
    total_centavos: 11000,
    snapshot: JSON.stringify({ prova: true }),
  });

  // Queimas: forno, queima, contagem, a venda das externas, manutenção.
  const forno = await inserir(cliente, "fornos", { nome: "Forno de prova" });
  const queima = await inserir(cliente, "queimas", { forno_id: forno.id, tipo: "biscoito", registrado_por: usuarioId });
  await inserir(cliente, "queima_contagens", { queima_id: queima.id, externas_p: 2, contado_por: usuarioId });
  await inserir(cliente, "queima_vendas", {
    documento_id: vendaDaQueima.documentoId,
    queima_id: queima.id,
    quantidade_p: 2,
    lancado_por: usuarioId,
  });
  await inserir(cliente, "manutencoes", { forno_id: forno.id, queimas_acumuladas: 5, registrado_por: usuarioId });

  // Agenda.
  const turma = await inserir(cliente, "turmas", {
    nome: "Turma de prova",
    dia_semana: 2,
    inicio: "14:00",
    fim: "16:00",
    vagas: 6,
    mensalidade_centavos: 30000,
    dia_vencimento: 10,
    criado_por: usuarioId,
  });
  await inserir(cliente, "turma_alunos", { turma_id: turma.id, cliente_id: clienteId, entrou_em: "2026-10-01" });
  const evento = await inserir(cliente, "eventos", {
    tipo: "turma",
    data: "2026-11-05",
    inicio: "14:00",
    fim: "16:00",
    vagas: 6,
    turma_id: turma.id,
    publico: true,
    criado_por: usuarioId,
  });
  await inserir(cliente, "inscricoes", {
    evento_id: evento.id,
    cliente_id: clienteId,
    tipo: "aluno",
    criado_por: usuarioId,
  });
  await inserir(cliente, "mensalidades", {
    turma_id: turma.id,
    cliente_id: clienteId,
    mes: "2026-10-01",
    valor_centavos: 30000,
    vencimento: "2026-10-10",
  });
  const usoLivre = await inserir(cliente, "usos_livres", {
    cliente_id: clienteId,
    data: "2026-10-02",
    chegada_prevista: "10:00",
    horas_previstas: 2,
    pessoas: 1,
    estado: "no_espaco",
    chegada: "10:05",
    criado_por: usuarioId,
  });

  // Estoque: entrada manual, a compra do fornecedor, uma venda e o ESTORNO dela, a baixa do uso
  // livre e o material da ordem.
  await inserir(cliente, "movimentacoes_estoque", {
    item_id: argila.id,
    origem: "manual",
    tipo: "entrada",
    motivo: "saldo_inicial",
    quantidade_milesimos: 20000,
    valor_centavos: 10000,
    valor_informado_centavos: 10000,
    saldo_contado_milesimos: 20000,
    registrado_por: usuarioId,
  });
  await inserir(cliente, "movimentacoes_estoque", {
    item_id: argila.id,
    origem: "compra",
    tipo: "entrada",
    quantidade_milesimos: 5000,
    valor_centavos: 5000,
    valor_informado_centavos: 5000,
    documento_id: despesaDoFornecedor.documentoId,
    documento_linha_id: despesaDoFornecedor.linhaId,
    registrado_por: usuarioId,
  });
  const saidaDaVenda = await inserir(cliente, "movimentacoes_estoque", {
    item_id: argila.id,
    origem: "venda",
    tipo: "saida",
    area: "pecas",
    quantidade_milesimos: -1000,
    valor_centavos: -500,
    documento_id: vendaCorrigida.documentoId,
    registrado_por: usuarioId,
  });
  await inserir(cliente, "movimentacoes_estoque", {
    item_id: argila.id,
    origem: "venda",
    tipo: "entrada",
    area: "pecas",
    quantidade_milesimos: 1000,
    valor_centavos: 500,
    valor_informado_centavos: 500,
    documento_id: vendaCorrigida.documentoId,
    estorno_de_id: saidaDaVenda.id,
    registrado_por: usuarioId,
  });
  const baixaDoUsoLivre = await inserir(cliente, "movimentacoes_estoque", {
    item_id: argila.id,
    origem: "manual",
    tipo: "saida",
    destino: "uso_livre",
    area: "espaco",
    quantidade_milesimos: -500,
    valor_centavos: -250,
    uso_livre_id: usoLivre.id,
    registrado_por: usuarioId,
  });
  await inserir(cliente, "movimentacoes_estoque", {
    item_id: argila.id,
    origem: "manual",
    tipo: "saida",
    destino: "encomenda",
    area: "pecas",
    quantidade_milesimos: -1000,
    valor_centavos: -500,
    encomenda_id: ordem.id,
    material_da_ordem: "argila",
    registrado_por: usuarioId,
  });
  await inserir(cliente, "usos_livres_material", {
    uso_livre_id: usoLivre.id,
    item_id: argila.id,
    quantidade_milesimos: 500,
    cobrar: false,
    movimentacao_id: baixaDoUsoLivre.id,
  });

  // Início.
  await inserir(cliente, "lembretes", { texto: "Lembrete de prova", quem: usuarioId, criado_por: usuarioId });

  return { usuarioId, pecasProntas, insumos };
}

async function registrarBackup(cliente, { horasAtras = 0 } = {}) {
  await cliente.query(
    `insert into execucoes_backup (quando, sucesso, bytes, destino_externo_ok, fotos_bytes, fotos_destino_externo_ok,
                                   anexos_bytes, anexos_destino_externo_ok, mensagem)
     values (now() - make_interval(hours => $1), true, 1000, true, 0, true, 0, true, 'backup da prova')`,
    [horasAtras],
  );
}

async function tabelasVazias(cliente, ignorar = []) {
  const vazias = [];
  for (const nome of await tabelasDoPublic(cliente)) {
    if (!ignorar.includes(nome) && (await contar(cliente, nome)) === 0) vazias.push(nome);
  }
  return vazias;
}

async function md5DosItensDoSistema(cliente) {
  const { rows } = await cliente.query(
    `select count(*)::int as total, md5(coalesce(string_agg(t::text, '|' order by t::text), '')) as md5
       from itens_catalogo t where chave_do_sistema is not null`,
  );
  return rows[0];
}

function afirmarRecusa(resultado, trechos, contexto) {
  afirmar(resultado.codigoDeSaida !== 0, `${contexto}: deveria recusar (saída ≠ 0) e saiu 0:\n${resultado.saida}`);
  for (const trecho of trechos) {
    afirmar(
      resultado.saida.includes(trecho),
      `${contexto}: a saída deveria conter "${trecho}":\n${resultado.saida}`,
    );
  }
}

async function provar(url, bancoDaProva) {
  const cliente = new Client({ connectionString: url });
  await cliente.connect();
  try {
    const { usuarioId, pecasProntas, insumos } = await semear(cliente);

    // Cobertura medida: toda tabela do public tem linha (menos execucoes_backup, vazia de propósito
    // para o (b1) — ela é conferida antes do (e)).
    const vaziasNoInicio = await tabelasVazias(cliente, ["execucoes_backup"]);
    afirmar(
      vaziasNoInicio.length === 0,
      `A semeadura deixou tabela vazia (a prova não cobriria): ${vaziasNoInicio.join(", ")}`,
    );
    const totalDeTabelas = (await tabelasDoPublic(cliente)).length;
    afirmar(totalDeTabelas === 46, `O schema public deveria ter 46 tabelas, tem ${totalDeTabelas}.`);

    // (a)
    let conteudo = await impressao(cliente);
    const estrutura = await impressaoDaEstrutura(cliente);
    caso("(a) impressão de conteúdo e de estrutura antes:");

    // (b1) sem nenhum backup
    let resultado = rodarLimpeza(url, ["--confirmar", "--banco", bancoDaProva]);
    afirmarRecusa(resultado, ["Recusado", "backup", "Nada foi gravado"], "(b1) sem backup");
    afirmarIgual(conteudo, await impressao(cliente), "(b1) sem backup, o banco");
    caso("(b1) --confirmar sem nenhum backup recusa e não grava:");

    // (b2) o último backup é de 4 horas atrás
    await registrarBackup(cliente, { horasAtras: 4 });
    conteudo = await impressao(cliente);
    resultado = rodarLimpeza(url, ["--confirmar", "--banco", bancoDaProva]);
    afirmarRecusa(resultado, ["Recusado", "backup", "Nada foi gravado"], "(b2) backup de 4 horas");
    afirmarIgual(conteudo, await impressao(cliente), "(b2) backup de 4 horas, o banco");
    caso("(b2) --confirmar com backup de 4 horas recusa e não grava:");

    // (c) com backup de agora, o --banco
    await registrarBackup(cliente);
    conteudo = await impressao(cliente);
    resultado = rodarLimpeza(url, ["--confirmar"]);
    afirmarRecusa(resultado, ["Recusado", "--banco", "Nada foi gravado"], "(c) sem --banco");
    resultado = rodarLimpeza(url, ["--confirmar", "--banco", "outro_banco"]);
    afirmarRecusa(resultado, ["Recusado", "--banco", "Nada foi gravado"], "(c) --banco de outro banco");
    afirmarIgual(conteudo, await impressao(cliente), "(c) recusa do --banco, o banco");
    caso("(c) --confirmar sem --banco e com --banco de outro banco recusa e não grava:");

    // Agora sim, as 46 com linha.
    const vaziasAntes = await tabelasVazias(cliente);
    afirmar(vaziasAntes.length === 0, `Tabela vazia antes da limpeza: ${vaziasAntes.join(", ")}`);

    // (d) tabela não classificada
    await cliente.query(`create table ${TABELA_INTRUSA} (id integer)`);
    const chaves = Object.keys(conteudo);
    for (const argumentos of [[], ["--confirmar", "--banco", bancoDaProva]]) {
      resultado = rodarLimpeza(url, argumentos);
      afirmarRecusa(
        resultado,
        ["Recusado", TABELA_INTRUSA, "Nada foi apagado"],
        `(d) tabela não classificada (${argumentos.length === 0 ? "ensaio" : "--confirmar"})`,
      );
      afirmarIgual(conteudo, await impressao(cliente), "(d) tabela não classificada, o banco", chaves);
    }
    await cliente.query(`drop table ${TABELA_INTRUSA}`);
    afirmarIgual(estrutura, await impressaoDaEstrutura(cliente), "(d) depois de tirar a tabela intrusa, a estrutura");
    caso("(d) tabela não classificada faz a SQL recusar no ensaio e no --confirmar:");

    // (e) ensaio
    const itensDoSistemaAntes = await md5DosItensDoSistema(cliente);
    const { rows: configuracaoAntes } = await cliente.query(
      "select taxa_cartao_pontos_base as taxa, data_saldo_inicial::text as data from configuracao_financeira",
    );
    resultado = rodarLimpeza(url);
    afirmar(resultado.codigoDeSaida === 0, `(e) o ensaio deveria sair 0, saiu ${resultado.codigoDeSaida}:\n${resultado.saida}`);
    for (const trecho of ["Ensaio — nada foi gravado", "antes → depois", "Itens do sistema que ficam", "Queima externa P"]) {
      afirmar(resultado.saida.includes(trecho), `(e) a saída do ensaio deveria conter "${trecho}":\n${resultado.saida}`);
    }
    afirmar(
      /documentos\s+6 → 0/.test(resultado.saida),
      `(e) o ensaio deveria mostrar "documentos 6 → 0":\n${resultado.saida}`,
    );
    afirmarIgual(conteudo, await impressao(cliente), "(e) o ensaio, o conteúdo");
    afirmarIgual(estrutura, await impressaoDaEstrutura(cliente), "(e) o ensaio, a estrutura");
    caso("(e) ensaio mostra antes → depois e os itens do sistema, e não muda nada:");

    // (f) execução
    resultado = rodarLimpeza(url, ["--confirmar", "--banco", bancoDaProva]);
    afirmar(
      resultado.codigoDeSaida === 0,
      `(f) a limpeza com --confirmar deveria sair 0, saiu ${resultado.codigoDeSaida}:\n${resultado.saida}`,
    );
    afirmar(resultado.saida.includes("Limpeza gravada."), `(f) a saída deveria dizer "Limpeza gravada.":\n${resultado.saida}`);
    const depois = await impressao(cliente);
    for (const tabela of [...APAGA, "contadores_orcamento"]) {
      const total = await contar(cliente, tabela);
      afirmar(total === 0, `(f) depois da limpeza, ${tabela} deveria ter 0 linhas, tem ${total}.`);
    }
    const { rows: folha } = await cliente.query("select texto, salvo_por from anotacoes_da_casa");
    afirmar(
      folha.length === 1 && folha[0].texto === "" && folha[0].salvo_por === null,
      `(f) a folha da casa deveria ser uma linha vazia sem autor: ${JSON.stringify(folha)}`,
    );
    const itensDoSistemaDepois = await md5DosItensDoSistema(cliente);
    const totalDeItens = await contar(cliente, "itens_catalogo");
    afirmar(
      itensDoSistemaAntes.total === 6 &&
        totalDeItens === 6 &&
        itensDoSistemaDepois.md5 === itensDoSistemaAntes.md5,
      `(f) itens_catalogo deveria ficar só com os 6 itens do sistema, idênticos (preço inclusive): ` +
        `eram ${itensDoSistemaAntes.total} com chave, ficaram ${totalDeItens} itens.`,
    );
    afirmarIgual(
      conteudo,
      depois,
      "(f) o que fica",
      [...FICA.map((nome) => `public.${nome}`), "drizzle.__drizzle_migrations"],
    );
    const { rows: configuracaoDepois } = await cliente.query(
      `select saldo_inicial_centavos as saldo, taxa_cartao_pontos_base as taxa, data_saldo_inicial::text as data
         from configuracao_financeira`,
    );
    afirmar(
      configuracaoDepois.length === 1 &&
        configuracaoDepois[0].saldo === 0 &&
        configuracaoDepois[0].taxa === configuracaoAntes[0].taxa &&
        configuracaoDepois[0].data === configuracaoAntes[0].data,
      `(f) o saldo inicial deveria ir a 0 com taxa e data iguais: antes ${JSON.stringify(configuracaoAntes)}, ` +
        `depois ${JSON.stringify(configuracaoDepois)}`,
    );
    for (const sequencia of SEQUENCIAS) {
      const { rows } = await cliente.query(`select is_called from ${sequencia}`);
      afirmar(rows[0].is_called === false, `(f) a numeração ${sequencia} deveria voltar a 1.`);
    }
    afirmarIgual(estrutura, await impressaoDaEstrutura(cliente), "(f) a limpeza, a estrutura");
    caso("(f) --confirmar apaga as 32 + contador, folha à semente, 6 itens idênticos, FICA idêntica, saldo 0, estrutura igual:");

    // (g) as consultas das rotas de saúde
    const consultasDeSaude = {
      "/api/health": "select count(*) from verificacao_infraestrutura",
      "/api/health/agenda":
        "select (select id from clientes limit 1), (select cliente_id from documentos limit 1), " +
        "(select uso_livre_id from movimentacoes_estoque limit 1), (select dispensada_em from usos_livres limit 1)",
      "/api/health/backup":
        "select quando, sucesso, destino_externo_ok, mensagem, fotos_destino_externo_ok, anexos_destino_externo_ok " +
        "from execucoes_backup order by quando desc limit 1",
      "/api/health/estoque":
        "select (select id from movimentacoes_estoque limit 1), " +
        "(select estoque_minimo_milesimos from itens_catalogo limit 1), (select ativo from itens_catalogo limit 1)",
      "/api/health/fornecedores":
        "select (select arquivo_caminho from fornecedor_anexos limit 1), (select fornecedor_id from documentos limit 1), " +
        "(select anexos_destino_externo_ok from execucoes_backup limit 1)",
      "/api/health/lembretes": "select feito_por from lembretes limit 1",
      "/api/health/polimento":
        "select (select id from correcoes_de_documento limit 1), " +
        "(select 1 from pg_indexes where schemaname = 'public' and indexname = 'documentos_conta_fixa_mes_ativo_uk')",
      "/api/health/producao":
        "select (select id from ordens_producao limit 1), (select material_da_ordem from movimentacoes_estoque limit 1)",
      "/api/health/queimas":
        "select (select saiu_cheio from queima_contagens limit 1), (select quantidade_p from queima_vendas limit 1), " +
        "(select id from itens_catalogo where chave_do_sistema = 'queima_externa_p' limit 1)",
    };
    for (const [rota, sql] of Object.entries(consultasDeSaude)) {
      try {
        await cliente.query(sql);
      } catch (erro) {
        throw new Error(`(g) a consulta de ${rota} falhou depois da limpeza: ${erro.message}`);
      }
    }
    const { rows: indicePolimento } = await cliente.query(
      "select 1 from pg_indexes where schemaname = 'public' and indexname = 'documentos_conta_fixa_mes_ativo_uk'",
    );
    afirmar(indicePolimento.length === 1, "(g) o índice documentos_conta_fixa_mes_ativo_uk sumiu.");
    const { rows: queimaPDepois } = await cliente.query(
      "select id from itens_catalogo where chave_do_sistema = 'queima_externa_p'",
    );
    afirmar(queimaPDepois.length === 1, "(g) o item queima_externa_p sumiu — /api/health/queimas daria 503.");
    const { rows: regua } = await cliente.query(
      "select distinct chave from parametros_precificacao where chave in ('queima_regua_p_ate', 'queima_regua_m_ate')",
    );
    afirmar(regua.length === 2, "(g) a régua das Queimas sumiu dos Parâmetros.");
    const { rows: folhaPeloApp } = await cliente.query(
      `select a.texto, u.nome, a.atualizado_em from anotacoes_da_casa a
         left join usuarios u on u.id = a.salvo_por limit 1`,
    );
    afirmar(folhaPeloApp.length === 1, "(g) a leitura de lerFolhaDaCasa não achou a folha.");
    const { rows: itensSemCategoria } = await cliente.query(
      `select i.nome from itens_catalogo i left join categorias c on c.id = i.categoria_venda_id
        where i.chave_do_sistema is not null and c.id is null`,
    );
    afirmar(
      itensSemCategoria.length === 0,
      `(g) item do sistema sem categoria de venda: ${itensSemCategoria.map((item) => item.nome).join(", ")}`,
    );
    caso("(g) as consultas das 9 rotas de saúde respondem; queima_externa_p, índice, régua e folha presentes:");

    // (h) idempotência
    resultado = rodarLimpeza(url, ["--confirmar", "--banco", bancoDaProva]);
    afirmar(
      resultado.codigoDeSaida === 0,
      `(h) a segunda limpeza deveria sair 0, saiu ${resultado.codigoDeSaida}:\n${resultado.saida}`,
    );
    afirmarIgual(depois, await impressao(cliente), "(h) a segunda limpeza, o conteúdo");
    caso("(h) rodar --confirmar de novo não muda nada:");

    // (i) a numeração volta a 1 — e a gravação comum volta a funcionar.
    const vendaNova = await inserirDocumento(cliente, {
      tipo: "venda",
      usuarioId,
      categoriaId: pecasProntas,
      valor: 1000,
    });
    afirmar(vendaNova.numero === 1, `(i) a próxima venda deveria ser a nº 1, foi a ${vendaNova.numero}.`);
    const ordemNova = await inserir(cliente, "ordens_producao", {
      tipo: "casa",
      status: "ativa",
      nome: "Ordem nova de prova",
      inicio: "2026-12-01",
      criado_por: usuarioId,
    });
    afirmar(Number(ordemNova.numero) === 1, `(i) a próxima ordem deveria ser a nº 1, foi a ${ordemNova.numero}.`);
    const itemNovo = await inserir(cliente, "itens_catalogo", {
      nome: "Esmalte de prova",
      controla_estoque: true,
      unidade: "kg",
      categoria_compra_id: insumos,
    });
    const movimentacaoNova = await inserir(cliente, "movimentacoes_estoque", {
      item_id: itemNovo.id,
      origem: "manual",
      tipo: "entrada",
      quantidade_milesimos: 1000,
      valor_centavos: 100,
      valor_informado_centavos: 100,
      registrado_por: usuarioId,
    });
    afirmar(
      Number(movimentacaoNova.numero) === 1,
      `(i) a próxima movimentação deveria ser a nº 1, foi a ${movimentacaoNova.numero}.`,
    );
    // O mesmo upsert de `lib/orcamentos/numero.ts`.
    const { rows: contador } = await cliente.query(
      `insert into contadores_orcamento (ano, ultimo_numero) values ($1, 1)
       on conflict (ano) do update set ultimo_numero = contadores_orcamento.ultimo_numero + 1
       returning ultimo_numero`,
      [anoEmBrasilia()],
    );
    afirmar(contador[0].ultimo_numero === 1, `(i) o próximo orçamento deveria ser o nº 1, foi o ${contador[0].ultimo_numero}.`);
    caso("(i) próxima venda, ordem, movimentação e orçamento recebem o nº 1:");
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

  console.log(`Limpeza geral provada: 46 tabelas, ${casos} casos.`);
}

main().catch((erro) => {
  console.error("A prova da limpeza geral falhou:", erro.message);
  process.exitCode = 1;
});

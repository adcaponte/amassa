// Prova, contra um Postgres de verdade e com DUAS TRANSAÇÕES QUE SE SOBREPÕEM DE FATO, as corridas da
// Agenda que a revisão de código da Fase 5 achou (05-REVIEW-A.md). Roda o código da aplicação — as
// funções de `lib/agenda/gravacao.ts` e o `gravarVenda` do Financeiro —, não uma cópia do SQL.
//
// Chamado por `scripts/testar-migracoes.mjs` (`npm run test:migracoes`, parte do `npm run verificar` e do
// CI) depois das migrações, com `DATABASE_URL` apontando para o banco de TESTE. Nunca rode contra o banco
// de produção: o script se recusa se o banco conectado se chamar `amassa`.
//
// Por que não o e2e de toque duplo: o Next executa as Server Actions de um navegador uma depois da
// outra, então nenhuma delas espera a trava da outra. Aqui a primeira transação TRAVA e fica parada numa
// barreira; a segunda começa e fica esperando a trava (conferido em `pg_stat_activity`); só então a
// primeira grava a venda e confirma. É exatamente o caminho do EvalPlanQual que deixava a segunda ler a
// venda NULA.
import { randomUUID } from "node:crypto";

import { Client } from "pg";

import { db, pool } from "@/db";
import {
  garantirMensalidadesDoMes,
  RecusaDaAgenda,
  tirarDatasFuturasDaTurma,
  travarCobranca,
  travarInscricaoComVenda,
  travarTurma,
  vendaAtivaEmDataFutura,
  vincularCobranca,
  type ReferenciaDaCobranca,
  type TransacaoDoBanco,
} from "@/lib/agenda/gravacao";
import { gravarVenda } from "@/lib/financeiro/gravacao";

const BANCO_DE_PRODUCAO = "amassa";

function afirmar(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) {
    throw new Error(mensagem);
  }
}

function hojeEmBrasilia(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function somarDias(data: string, dias: number): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  const resultado = new Date(Date.UTC(ano, mes - 1, dia + dias));
  return resultado.toISOString().slice(0, 10);
}

type Barreira = { promessa: Promise<void>; soltar: () => void };

function barreira(): Barreira {
  let soltar: () => void = () => {};
  const promessa = new Promise<void>((resolver) => {
    soltar = resolver;
  });
  return { promessa, soltar };
}

type Desfecho<T> = { ok: true; valor: T } | { ok: false; erro: unknown };

// Nenhuma promessa que fica esperando uma trava pode rejeitar sem dono (o Node derrubaria o processo).
function semRejeicaoSolta<T>(promessa: Promise<T>): Promise<Desfecho<T>> {
  return promessa.then(
    (valor) => ({ ok: true as const, valor }),
    (erro: unknown) => ({ ok: false as const, erro }),
  );
}

// Espera até haver `quantas` conexões deste banco paradas numa trava de linha.
async function esperarAlguemNaTrava(observador: Client, contexto: string, quantas = 1): Promise<void> {
  for (let tentativa = 0; tentativa < 400; tentativa++) {
    const { rows } = await observador.query<{ total: string }>(
      `select count(*)::text as total from pg_stat_activity
        where datname = current_database() and wait_event_type = 'Lock' and pid <> pg_backend_pid()`,
    );
    if (Number(rows[0]?.total ?? 0) >= quantas) {
      return;
    }
    await new Promise((resolver) => setTimeout(resolver, 25));
  }
  throw new Error(`${contexto}: a segunda transação deveria estar esperando a trava, e não ficou.`);
}

type Semente = {
  usuarioId: string;
  clienteIds: string[];
  turmaIds: string[];
  eventoIds: string[];
};

const semente: Semente = { usuarioId: "", clienteIds: [], turmaIds: [], eventoIds: [] };

async function semearCliente(conexao: Client, nome: string): Promise<string> {
  const { rows } = await conexao.query<{ id: string }>("insert into clientes (nome) values ($1) returning id", [nome]);
  const id = rows[0].id;
  semente.clienteIds.push(id);
  return id;
}

async function semearTurma(conexao: Client, nome: string, datas: readonly string[]): Promise<{ turmaId: string; eventoIds: string[] }> {
  const { rows } = await conexao.query<{ id: string }>(
    `insert into turmas (nome, dia_semana, inicio, fim, vagas, mensalidade_centavos, dia_vencimento, publica)
     values ($1, 3, '19:00', '21:00', 8, 25000, 10, false) returning id`,
    [nome],
  );
  const turmaId = rows[0].id;
  semente.turmaIds.push(turmaId);
  const eventoIds: string[] = [];
  for (const data of datas) {
    const evento = await conexao.query<{ id: string }>(
      `insert into eventos (tipo, data, inicio, fim, turma_id, vagas, publico)
       values ('turma', $1, '19:00', '21:00', $2, 8, false) returning id`,
      [data, turmaId],
    );
    eventoIds.push(evento.rows[0].id);
  }
  return { turmaId, eventoIds };
}

async function categoriaDoItem(conexao: Client, chave: string): Promise<string> {
  const { rows } = await conexao.query<{ categoria: string }>(
    "select categoria_venda_id as categoria from itens_catalogo where chave_do_sistema = $1",
    [chave],
  );
  afirmar(rows[0]?.categoria, `O item do sistema “${chave}” não tem categoria de venda.`);
  return rows[0].categoria;
}

// A metade "Lançar na Venda" de `lancarVenda` (lib/financeiro/acoes.ts): trava e confere a cobrança
// (`vincularCobranca`), grava a venda com o MESMO escritor e grava o vínculo — na mesma transação. A
// `pausa`, se houver, segura a transação DEPOIS da trava e ANTES da venda.
async function lancarNaVenda(
  tx: TransacaoDoBanco,
  origem: ReferenciaDaCobranca,
  categoriaId: string,
  valorCentavos: number,
  pausa?: { travou: () => void; esperar: Promise<void> },
): Promise<{ id: string; numero: number }> {
  const vinculo = await vincularCobranca(tx, origem);
  if (pausa) {
    pausa.travou();
    await pausa.esperar;
  }
  const hoje = hojeEmBrasilia();
  const venda = await gravarVenda(
    tx,
    {
      data: hoje,
      pessoaNome: vinculo.clienteNome,
      clienteId: vinculo.clienteId,
      linhas: [
        {
          tipo: "item",
          itemId: vinculo.itemDoSistemaId,
          descricao: vinculo.descricao,
          categoriaId,
          quantidade: 1,
          valorCentavos,
        },
      ],
      parcelas: [{ vencimento: hoje, valorCentavos, forma: "pix", pago: false }],
    },
    { registradoPor: semente.usuarioId, taxaCartaoPontosBase: 0 },
  );
  await vinculo.gravar(venda.id);
  return venda;
}

// A primeira transação: trava a cobrança e para na barreira. Devolve a promessa dela (já sem rejeição
// solta), a barreira para soltá-la e a garantia de que a trava já é dela.
async function primeiraTravaEPara(
  origem: ReferenciaDaCobranca,
  categoriaId: string,
  valorCentavos: number,
): Promise<{ desfecho: Promise<Desfecho<{ id: string; numero: number }>>; soltar: () => void }> {
  const travou = barreira();
  const segurar = barreira();
  const desfecho = semRejeicaoSolta(
    db.transaction((tx) =>
      lancarNaVenda(tx, origem, categoriaId, valorCentavos, { travou: travou.soltar, esperar: segurar.promessa }),
    ),
  );
  // Se a primeira falhar antes de travar, a barreira nunca abriria: corre contra o desfecho.
  const antes = await Promise.race([travou.promessa.then(() => null), desfecho]);
  if (antes !== null) {
    throw new Error(`A primeira transação falhou antes de travar: ${String(antes.ok ? "?" : antes.erro)}`);
  }
  return { desfecho, soltar: segurar.soltar };
}

async function vendasAtivasDoCliente(conexao: Client, clienteId: string): Promise<number> {
  const { rows } = await conexao.query<{ total: string }>(
    "select count(*)::text as total from documentos where cliente_id = $1 and cancelado_em is null",
    [clienteId],
  );
  return Number(rows[0]?.total ?? 0);
}

// CR-01 — dois "Lançar na Venda" na MESMA mensalidade, sobrepostos: uma venda ativa só, e o segundo
// recusa com o número da primeira.
async function provarDuasVendasNaMesmaMensalidade(conexao: Client, observador: Client): Promise<void> {
  console.log("    CR-01: dois lançamentos sobrepostos na mesma mensalidade...");
  const clienteId = await semearCliente(conexao, "[prova] Corrida da mensalidade");
  const { turmaId } = await semearTurma(conexao, "[prova] Turma da corrida", []);
  const mensalidade = await conexao.query<{ id: string }>(
    `insert into mensalidades (turma_id, cliente_id, mes, valor_centavos, vencimento)
     values ($1, $2, '2099-01-01', 25000, '2099-01-10') returning id`,
    [turmaId, clienteId],
  );
  const origem: ReferenciaDaCobranca = { tipo: "mensalidade", id: mensalidade.rows[0].id };
  const categoriaId = await categoriaDoItem(conexao, "mensalidade");

  const primeira = await primeiraTravaEPara(origem, categoriaId, 25000);
  const segunda = semRejeicaoSolta(db.transaction((tx) => lancarNaVenda(tx, origem, categoriaId, 25000)));
  await esperarAlguemNaTrava(observador, "CR-01 (mensalidade)");
  primeira.soltar();

  const [resultadoDaPrimeira, resultadoDaSegunda] = await Promise.all([primeira.desfecho, segunda]);
  afirmar(resultadoDaPrimeira.ok, `CR-01: a primeira venda deveria gravar — ${String(!resultadoDaPrimeira.ok && resultadoDaPrimeira.erro)}`);
  afirmar(
    !resultadoDaSegunda.ok && resultadoDaSegunda.erro instanceof RecusaDaAgenda,
    "CR-01: o segundo lançamento sobreposto deveria ser RECUSADO (a cobrança já virou venda) — ele passou e gravou outra venda.",
  );
  const frase = resultadoDaSegunda.erro.frase;
  afirmar(
    frase.includes(`nº ${resultadoDaPrimeira.valor.numero}`),
    `CR-01: a recusa deveria citar a venda nº ${resultadoDaPrimeira.valor.numero}, disse “${frase}”.`,
  );
  const ativas = await vendasAtivasDoCliente(conexao, clienteId);
  afirmar(ativas === 1, `CR-01: a mensalidade deveria ter UMA venda ativa, tem ${ativas}.`);
}

// CR-01 — o caso "relançar": a cobrança aponta uma venda CANCELADA, a primeira transação a relança e a
// segunda (o "Recebi agora", que decide por `travarCobranca`) tem de ver a venda NOVA, ativa, com número.
async function provarRelancamentoVistoPeloRecebiAgora(conexao: Client, observador: Client): Promise<void> {
  console.log("    CR-01: relançar uma venda cancelada × “Recebi agora” sobreposto...");
  const clienteId = await semearCliente(conexao, "[prova] Corrida do relançamento");
  const { turmaId } = await semearTurma(conexao, "[prova] Turma do relançamento", []);
  const mensalidade = await conexao.query<{ id: string }>(
    `insert into mensalidades (turma_id, cliente_id, mes, valor_centavos, vencimento)
     values ($1, $2, '2099-02-01', 18000, '2099-02-10') returning id`,
    [turmaId, clienteId],
  );
  const origem: ReferenciaDaCobranca = { tipo: "mensalidade", id: mensalidade.rows[0].id };
  const categoriaId = await categoriaDoItem(conexao, "mensalidade");

  // A venda antiga, lançada e cancelada no Caixa.
  const antiga = await db.transaction((tx) => lancarNaVenda(tx, origem, categoriaId, 18000));
  await conexao.query("update documentos set cancelado_em = now(), cancelado_por = $2 where id = $1", [
    antiga.id,
    semente.usuarioId,
  ]);

  const primeira = await primeiraTravaEPara(origem, categoriaId, 18000);
  const leitura = semRejeicaoSolta(db.transaction((tx) => travarCobranca(tx, origem)));
  await esperarAlguemNaTrava(observador, "CR-01 (relançamento)");
  primeira.soltar();
  const [resultadoDaPrimeira, lida] = await Promise.all([primeira.desfecho, leitura]);
  afirmar(resultadoDaPrimeira.ok, "CR-01: o relançamento deveria gravar.");
  afirmar(lida.ok && lida.valor !== null, "CR-01: a cobrança travada deveria ser lida.");
  afirmar(
    lida.valor.documentoId === resultadoDaPrimeira.valor.id &&
      lida.valor.numeroDaVenda === resultadoDaPrimeira.valor.numero &&
      lida.valor.canceladoEm === null,
    `CR-01: depois de esperar a trava, o “Recebi agora” deveria ver a venda nova nº ${resultadoDaPrimeira.valor.numero} ativa — viu documento ${lida.valor.documentoId}, número ${lida.valor.numeroDaVenda}, cancelada em ${lida.valor.canceladoEm}.`,
  );
}

// CR-01 — "Tirar da lista" sobreposto a um lançamento da MESMA inscrição de oficina: a leitura sob a
// trava tem de ver a venda ativa (e "Tirar da lista" recusa pela D-08), nunca `venda = null`.
async function provarTirarDaListaVeAVenda(conexao: Client, observador: Client): Promise<void> {
  console.log("    CR-01: “Tirar da lista” × lançamento sobreposto na mesma inscrição...");
  const clienteId = await semearCliente(conexao, "[prova] Corrida da inscrição");
  const evento = await conexao.query<{ id: string }>(
    `insert into eventos (tipo, data, inicio, fim, titulo, vagas, preco_centavos, publico)
     values ('avulsa', $1, '14:00', '17:00', '[prova] Oficina da corrida', 6, 9000, false) returning id`,
    [somarDias(hojeEmBrasilia(), 30)],
  );
  const inscricao = await conexao.query<{ id: string }>(
    `insert into inscricoes (evento_id, cliente_id, tipo, cobrar, valor_centavos)
     values ($1, $2, 'oficina', true, 9000) returning id`,
    [evento.rows[0].id, clienteId],
  );
  semente.eventoIds.push(evento.rows[0].id);
  const origem: ReferenciaDaCobranca = { tipo: "inscricao", id: inscricao.rows[0].id };
  const categoriaId = await categoriaDoItem(conexao, "inscricao_oficina");

  const primeira = await primeiraTravaEPara(origem, categoriaId, 9000);
  const leitura = semRejeicaoSolta(db.transaction((tx) => travarInscricaoComVenda(tx, origem.id)));
  await esperarAlguemNaTrava(observador, "CR-01 (tirar da lista)");
  primeira.soltar();
  const [resultadoDaPrimeira, lida] = await Promise.all([primeira.desfecho, leitura]);
  afirmar(resultadoDaPrimeira.ok, "CR-01: o lançamento da inscrição deveria gravar.");
  afirmar(lida.ok && lida.valor !== null, "CR-01: a inscrição travada deveria ser lida.");
  afirmar(
    lida.valor.venda !== null &&
      lida.valor.venda.numero === resultadoDaPrimeira.valor.numero &&
      !lida.valor.venda.cancelada,
    `CR-01: depois de esperar a trava, “Tirar da lista” deveria ver a venda nº ${resultadoDaPrimeira.valor.numero} ativa — viu ${JSON.stringify(lida.valor.venda)}. Com venda nula ele apagaria uma venda ativa (D-08).`,
  );
}

// WR-01 — "Desativar turma" sobreposto a um lançamento de uma experimental cobrada numa data FUTURA da
// turma: a desativação conferiu "nenhuma venda ativa" sob a trava da TURMA, mas o lançamento só trava a
// INSCRIÇÃO. Ela tem de recusar (D-08) — nunca apagar a inscrição que acabou de virar venda.
async function provarDesativarNaoApagaVendaNova(conexao: Client, observador: Client): Promise<void> {
  console.log("    WR-01: “Desativar turma” × lançamento sobreposto numa data futura...");
  const hoje = hojeEmBrasilia();
  const clienteId = await semearCliente(conexao, "[prova] Corrida da desativação");
  const { turmaId, eventoIds } = await semearTurma(conexao, "[prova] Turma da desativação", [somarDias(hoje, 14)]);
  const inscricao = await conexao.query<{ id: string }>(
    `insert into inscricoes (evento_id, cliente_id, tipo, cobrar, valor_centavos)
     values ($1, $2, 'experimental', true, 6000) returning id`,
    [eventoIds[0], clienteId],
  );
  const origem: ReferenciaDaCobranca = { tipo: "inscricao", id: inscricao.rows[0].id };
  const categoriaId = await categoriaDoItem(conexao, "inscricao_oficina");

  const primeira = await primeiraTravaEPara(origem, categoriaId, 6000);
  // A metade de banco de `desativarTurma` (lib/agenda/acoes.ts), na mesma ordem.
  const desativacao = semRejeicaoSolta(
    db.transaction(async (tx) => {
      const turma = await travarTurma(tx, turmaId);
      afirmar(turma, "WR-01: a turma de prova sumiu.");
      const antes = await vendaAtivaEmDataFutura(tx, turmaId, hoje);
      afirmar(antes === null, "WR-01: antes do lançamento confirmar, não há venda ativa — a prova montou errado.");
      return tirarDatasFuturasDaTurma(tx, turmaId, hoje);
    }),
  );
  await esperarAlguemNaTrava(observador, "WR-01 (desativar)");
  primeira.soltar();
  const [resultadoDaPrimeira, resultadoDaDesativacao] = await Promise.all([primeira.desfecho, desativacao]);
  afirmar(resultadoDaPrimeira.ok, "WR-01: o lançamento da experimental deveria gravar.");
  afirmar(
    !resultadoDaDesativacao.ok && resultadoDaDesativacao.erro instanceof RecusaDaAgenda,
    "WR-01: a desativação sobreposta deveria ser RECUSADA (a inscrição virou venda) — ela apagou as datas.",
  );
  afirmar(
    resultadoDaDesativacao.erro.frase.includes(`nº ${resultadoDaPrimeira.valor.numero}`),
    `WR-01: a recusa deveria citar a venda nº ${resultadoDaPrimeira.valor.numero}, disse “${resultadoDaDesativacao.erro.frase}”.`,
  );
  const ficou = await conexao.query<{ documento_id: string | null }>(
    "select documento_id from inscricoes where id = $1",
    [origem.id],
  );
  afirmar(
    ficou.rows[0]?.documento_id === resultadoDaPrimeira.valor.id,
    "WR-01: a inscrição ligada à venda ativa deveria continuar na agenda.",
  );
}

// WR-03 — "sem aula, sem mensalidade" (decisão do dono, 02/10/2026): a D-02 (`garantirMensalidadesDoMes`)
// só faz nascer a mensalidade de um mês com PELO MENOS UMA data não cancelada da turma; `entrou_em < dia 1`
// e a idempotência continuam valendo. Um mês longe (2099) para não cruzar com nenhum outro dado.
async function provarSemAulaSemMensalidade(conexao: Client): Promise<void> {
  console.log("    WR-03: sem aula no mês, sem mensalidade (D-02)...");
  const antiga = await semearCliente(conexao, "[prova] Aluna de antes do mês");
  const doDiaPrimeiro = await semearCliente(conexao, "[prova] Aluna do dia 1");
  const { turmaId } = await semearTurma(conexao, "[prova] Turma sem aula no mês", []);
  await conexao.query(
    `insert into turma_alunos (turma_id, cliente_id, entrou_em) values ($1, $2, '2099-04-10'), ($1, $3, '2099-05-01')`,
    [turmaId, antiga, doDiaPrimeiro],
  );
  async function doMes(clienteId: string): Promise<{ valor: number; vencimento: string }[]> {
    const { rows } = await conexao.query<{ valor: number; vencimento: string }>(
      `select valor_centavos as valor, vencimento::text as vencimento from mensalidades
        where turma_id = $1 and cliente_id = $2 and mes = '2099-05-01'`,
      [turmaId, clienteId],
    );
    return rows;
  }
  async function novaData(data: string, cancelada: boolean): Promise<void> {
    await conexao.query(
      `insert into eventos (tipo, data, inicio, fim, turma_id, vagas, publico, cancelado_em, cancelado_por)
       values ('turma', $1, '19:00', '21:00', $2, 8, false, ${cancelada ? "now(), $3::uuid" : "null, null"})`,
      cancelada ? [data, turmaId, semente.usuarioId] : [data, turmaId],
    );
  }

  // Nenhuma data no mês.
  afirmar((await garantirMensalidadesDoMes(db, "2099-05", turmaId)) === 0, "WR-03: mês sem data nenhuma não pode cobrar.");
  // Só uma data CANCELADA no mês, e uma data no mês SEGUINTE (o dia 1 de junho é de junho).
  await novaData("2099-05-13", true);
  await novaData("2099-06-01", false);
  afirmar(
    (await garantirMensalidadesDoMes(db, "2099-05", turmaId)) === 0 && (await doMes(antiga)).length === 0,
    "WR-03: data cancelada no mês (ou data só no mês seguinte) não pode fazer nascer mensalidade.",
  );
  // Uma data de pé no mês: nasce UMA, só para quem entrou antes do dia 1, com o valor e o vencimento da turma.
  await novaData("2099-05-20", false);
  afirmar((await garantirMensalidadesDoMes(db, "2099-05", turmaId)) === 1, "WR-03: com aula no mês, a mensalidade nasce.");
  afirmar((await garantirMensalidadesDoMes(db, "2099-05", turmaId)) === 0, "WR-03: rodar de novo não pode criar outra.");
  const nascida = await doMes(antiga);
  afirmar(
    nascida.length === 1 && nascida[0].valor === 25000 && nascida[0].vencimento === "2099-05-10",
    `WR-03: a mensalidade de maio deveria ser UMA, de R$ 250,00, vencendo em 10/05 — veio ${JSON.stringify(nascida)}.`,
  );
  afirmar((await doMes(doDiaPrimeiro)).length === 0, "WR-03: quem entrou NO dia 1 continua fora da D-02 (a entrada decide).");
}

async function faxina(conexao: Client): Promise<void> {
  try {
    await conexao.query("begin");
    const documentos = await conexao.query<{ id: string }>("select id from documentos where cliente_id = any($1::uuid[])", [
      semente.clienteIds,
    ]);
    const documentoIds = documentos.rows.map((linha) => linha.id);
    await conexao.query("delete from inscricoes where cliente_id = any($1::uuid[])", [semente.clienteIds]);
    await conexao.query("delete from mensalidades where cliente_id = any($1::uuid[])", [semente.clienteIds]);
    await conexao.query("delete from turma_alunos where cliente_id = any($1::uuid[])", [semente.clienteIds]);
    await conexao.query("delete from eventos where turma_id = any($1::uuid[]) or id = any($2::uuid[])", [
      semente.turmaIds,
      semente.eventoIds,
    ]);
    await conexao.query("delete from turmas where id = any($1::uuid[])", [semente.turmaIds]);
    // A mesma faxina de `testar-migracoes.mjs`: a soma do documento é conferida por gatilho adiado.
    await conexao.query("alter table documento_linhas disable trigger conferir_soma_apos_linha");
    await conexao.query("alter table parcelas disable trigger conferir_soma_apos_parcela");
    await conexao.query("delete from parcelas where documento_id = any($1::uuid[])", [documentoIds]);
    await conexao.query("delete from documento_linhas where documento_id = any($1::uuid[])", [documentoIds]);
    await conexao.query("delete from documentos where id = any($1::uuid[])", [documentoIds]);
    await conexao.query("alter table documento_linhas enable trigger conferir_soma_apos_linha");
    await conexao.query("alter table parcelas enable trigger conferir_soma_apos_parcela");
    await conexao.query("delete from clientes where id = any($1::uuid[])", [semente.clienteIds]);
    await conexao.query("delete from usuarios where id = $1", [semente.usuarioId]);
    await conexao.query("commit");
  } catch (erro) {
    await conexao.query("rollback").catch(() => {});
    // Nunca relançado: o banco de teste é efêmero, e a falha de verdade é a da prova.
    console.error(`Corridas da Agenda: a faxina não apagou o dado de prova — ${String(erro)}`);
  }
}

async function main(): Promise<void> {
  const conexao = new Client({ connectionString: process.env.DATABASE_URL });
  const observador = new Client({ connectionString: process.env.DATABASE_URL });
  await conexao.connect();
  await observador.connect();
  let codigo = 1;
  try {
    const { rows } = await conexao.query<{ banco: string }>("select current_database() as banco");
    afirmar(rows[0]?.banco !== BANCO_DE_PRODUCAO, "Recusado: este script só roda no banco de TESTE.");

    const usuario = await conexao.query<{ id: string }>(
      `insert into usuarios (nome, email, senha_hash)
       values ('Prova das corridas da Agenda', $1, 'hash-fake-de-teste')
       returning id`,
      [`corridas-da-agenda-${randomUUID()}@exemplo.test`],
    );
    semente.usuarioId = usuario.rows[0].id;

    console.log("  Corridas da Agenda (05-REVIEW-A), com transações sobrepostas de verdade:");
    await provarDuasVendasNaMesmaMensalidade(conexao, observador);
    await provarRelancamentoVistoPeloRecebiAgora(conexao, observador);
    await provarTirarDaListaVeAVenda(conexao, observador);
    await provarDesativarNaoApagaVendaNova(conexao, observador);
    await provarSemAulaSemMensalidade(conexao);
    console.log("  Corridas da Agenda: todas as afirmações passaram.");
    codigo = 0;
  } catch (erro) {
    console.error("Corridas da Agenda falharam:", erro instanceof Error ? erro.message : erro);
  } finally {
    await faxina(conexao);
    await conexao.end();
    await observador.end();
    await pool.end();
  }
  process.exit(codigo);
}

void main();

// Prova, contra um Postgres de verdade e com DUAS TRANSAÇÕES QUE SE SOBREPÕEM DE FATO, as corridas da
// cobrança das externas das Queimas (Fase 06.4, plano 04 — D-07, decisão do dono de 04/10/2026: várias
// vendas por queima, uma por pessoa, cada uma com a sua quantidade por tamanho). Roda o CÓDIGO da
// aplicação — `travarContagem`, `gravarContagem`, `apagarContagemNaTransacao`, `cobrarQueimaNaTransacao`
// (o corpo do "Recebi agora") e `obterItensDasQueimas`, que ela chama sob a trava —, não uma cópia do SQL.
//
// Chamado por `scripts/testar-migracoes.mjs` (`npm run test:migracoes`, parte do `npm run verificar` e do
// CI) depois das migrações, com `DATABASE_URL` apontando para o banco de TESTE. Nunca rode contra o banco
// de produção: o script se recusa se o banco conectado se chamar `amassa`.
//
// Por que não o e2e de toque duplo: o Next executa as Server Actions de um navegador uma depois da
// outra, então nenhuma delas espera a trava da outra (e o `useRef` da folha já barra o segundo toque).
// Aqui a primeira transação TRAVA a queima e fica parada numa barreira; a segunda começa e fica esperando
// a trava (conferido em `pg_stat_activity`); só então a primeira grava e confirma. A regra que se prova:
// a soma lançada em vendas ATIVAS nunca passa das externas contadas, em NENHUM tamanho — a trava é por
// queima, a regra é por tamanho.
//
// A idempotência (sonda QMC-08·idempotency) é uma SEGUNDA chamada direta e sequencial de
// `cobrarQueimaNaTransacao`: a Server Action exige sessão (`exigirUsuario`) e não roda fora de uma
// requisição — o corpo dela, sim.
import { randomUUID } from "node:crypto";

import { Client } from "pg";

import { db, pool } from "@/db";
import type { Contagem, Quantidades } from "@/lib/queimas/contagem";
import { obterItensDasQueimas } from "@/lib/queimas/consultas";
import {
  apagarContagemNaTransacao,
  cobrarQueimaNaTransacao,
  gravarContagem,
  RecusaDasQueimas,
  travarContagem,
  type TransacaoDoBanco,
} from "@/lib/queimas/gravacao";

const BANCO_DE_PRODUCAO = "amassa";

// Preços de prova inventados (nunca os do protótipo), postos nos três itens e devolvidos na faxina.
const PRECOS_DE_PROVA = { P: 1300, M: 2900, G: 4100 } as const;

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

// Espera até haver `quantas` conexões deste banco paradas numa trava.
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
  fornoId: string;
  queimaIds: string[];
  documentoIds: string[];
  itensOriginais: { chave: string; nome: string; preco: number | null }[];
};

const semente: Semente = { usuarioId: "", fornoId: "", queimaIds: [], documentoIds: [], itensOriginais: [] };

// Uma queima de prova no forno de prova, com a contagem pedida (ou sem contagem).
async function semearQueima(conexao: Client, externas: Quantidades | null): Promise<string> {
  const { rows } = await conexao.query<{ id: string }>(
    "insert into queimas (forno_id, tipo, registrado_por) values ($1, 'biscoito', $2) returning id",
    [semente.fornoId, semente.usuarioId],
  );
  const queimaId = rows[0].id;
  semente.queimaIds.push(queimaId);
  if (externas !== null) {
    await conexao.query(
      `insert into queima_contagens (queima_id, externas_p, externas_m, externas_g, contado_por)
       values ($1, $2, $3, $4, $5)`,
      [queimaId, externas.p, externas.m, externas.g, semente.usuarioId],
    );
  }
  return queimaId;
}

function so(p: number, m = 0, g = 0): Quantidades {
  return { p, m, g };
}

// O corpo do "Recebi agora" (`receberQueimaAgora` sem a sessão), na forma pix, sem pessoa.
function cobrar(tx: TransacaoDoBanco, queimaId: string, quantidades: Quantidades) {
  return cobrarQueimaNaTransacao(tx, {
    queimaId,
    forma: "pix",
    quantidades,
    clienteId: null,
    hoje: hojeEmBrasilia(),
    registradoPor: semente.usuarioId,
    taxaCartaoPontosBase: 0,
    dataSaldoInicial: null,
  });
}

function guardarVenda(desfecho: Desfecho<{ documentoId: string; numero: number }>): void {
  if (desfecho.ok) {
    semente.documentoIds.push(desfecho.valor.documentoId);
  }
}

// A primeira transação: trava a QUEIMA (a mesma trava que `cobrarQueimaNaTransacao` toma de novo — já
// é dela, não espera) e para na barreira; depois roda `corpo` na MESMA transação. Devolve a promessa dela
// (sem rejeição solta) e a barreira para soltá-la.
async function primeiraTravaEPara<T>(
  queimaId: string,
  corpo: (tx: TransacaoDoBanco) => Promise<T>,
): Promise<{ desfecho: Promise<Desfecho<T>>; soltar: () => void }> {
  const travou = barreira();
  const segurar = barreira();
  const desfecho = semRejeicaoSolta(
    db.transaction(async (tx) => {
      await travarContagem(tx, queimaId);
      travou.soltar();
      await segurar.promessa;
      return corpo(tx);
    }),
  );
  // Se a primeira falhar antes de travar, a barreira nunca abriria: corre contra o desfecho.
  const antes = await Promise.race([travou.promessa.then(() => null), desfecho]);
  if (antes !== null) {
    throw new Error(`A primeira transação falhou antes de travar: ${String(antes.ok ? "?" : antes.erro)}`);
  }
  return { desfecho, soltar: segurar.soltar };
}

type Vinculo = { documentoId: string; p: number; m: number; g: number; cancelado: boolean };

async function vinculos(conexao: Client, queimaId: string): Promise<Vinculo[]> {
  const { rows } = await conexao.query<Vinculo>(
    `select v.documento_id as "documentoId", v.quantidade_p as p, v.quantidade_m as m, v.quantidade_g as g,
            d.cancelado_em is not null as cancelado
       from queima_vendas v join documentos d on d.id = v.documento_id
      where v.queima_id = $1 order by d.numero`,
    [queimaId],
  );
  return rows;
}

function somaAtiva(lista: readonly Vinculo[]): Quantidades {
  return lista
    .filter((vinculo) => !vinculo.cancelado)
    .reduce((soma, vinculo) => ({ p: soma.p + vinculo.p, m: soma.m + vinculo.m, g: soma.g + vinculo.g }), so(0));
}

function frase(desfecho: Desfecho<unknown>): string {
  return !desfecho.ok && desfecho.erro instanceof RecusaDasQueimas ? desfecho.erro.frase : "";
}

// (1) Recebi × Recebi pedindo a MESMA peça: 3 P contadas, as duas pedem 2 P. A segunda espera a trava,
// relê o que falta (1 P) e recusa; a soma ativa de P fica em 2.
async function provarMesmaPeca(conexao: Client, observador: Client): Promise<void> {
  console.log("    (1) “Recebi agora” × “Recebi agora” na mesma peça (2 P e 2 P de 3 P)...");
  const queimaId = await semearQueima(conexao, so(3));
  const primeira = await primeiraTravaEPara(queimaId, (tx) => cobrar(tx, queimaId, so(2)));
  const segunda = semRejeicaoSolta(db.transaction((tx) => cobrar(tx, queimaId, so(2))));
  await esperarAlguemNaTrava(observador, "(1)");
  primeira.soltar();
  const [a, b] = await Promise.all([primeira.desfecho, segunda]);
  guardarVenda(a);
  guardarVenda(b);
  afirmar(a.ok, `(1): a primeira cobrança deveria gravar — ${String(!a.ok && a.erro)}`);
  afirmar(
    !b.ok && b.erro instanceof RecusaDasQueimas,
    "(1): a segunda cobrança sobreposta deveria ser RECUSADA — ela passou e a soma lançada passou das externas.",
  );
  afirmar(frase(b).includes("só faltam 1 P"), `(1): a recusa deveria dizer o que falta (1 P), disse “${frase(b)}”.`);
  const lista = await vinculos(conexao, queimaId);
  afirmar(lista.length === 1 && somaAtiva(lista).p === 2, `(1): Σ ativa de P deveria ser 2 num vínculo, veio ${JSON.stringify(lista)}.`);
}

// (2) Recebi × Recebi pedindo partes que CABEM juntas: 1 P e 2 P de 3 P. A trava serializa, mas a regra é
// por tamanho: as duas passam e a soma é exatamente 3, em dois vínculos.
async function provarPartesQueCabem(conexao: Client, observador: Client): Promise<void> {
  console.log("    (2) “Recebi agora” × “Recebi agora” com partes que cabem (1 P e 2 P de 3 P)...");
  const queimaId = await semearQueima(conexao, so(3));
  const primeira = await primeiraTravaEPara(queimaId, (tx) => cobrar(tx, queimaId, so(1)));
  const segunda = semRejeicaoSolta(db.transaction((tx) => cobrar(tx, queimaId, so(2))));
  await esperarAlguemNaTrava(observador, "(2)");
  primeira.soltar();
  const [a, b] = await Promise.all([primeira.desfecho, segunda]);
  guardarVenda(a);
  guardarVenda(b);
  afirmar(a.ok && b.ok, `(2): as duas cobranças deveriam passar — ${String(!a.ok ? a.erro : !b.ok ? b.erro : "")}`);
  const lista = await vinculos(conexao, queimaId);
  afirmar(
    lista.length === 2 && somaAtiva(lista).p === 3,
    `(2): deveriam ser dois vínculos somando 3 P, veio ${JSON.stringify(lista)}.`,
  );
}

// (3) Recebi (trava e para) × corrigir a contagem para baixo do que ficará lançado: a gravação espera,
// vê a venda nova e recusa com a frase do piso; a contagem não muda.
async function provarPisoSobCorrida(conexao: Client, observador: Client): Promise<void> {
  console.log("    (3) “Recebi agora” × corrigir as externas para baixo do lançado...");
  const queimaId = await semearQueima(conexao, so(3));
  const primeira = await primeiraTravaEPara(queimaId, (tx) => cobrar(tx, queimaId, so(2)));
  const baixar: Contagem = {
    internasP: 0,
    internasM: 0,
    internasG: 0,
    externasP: 1,
    externasM: 0,
    externasG: 0,
    saiuCheio: true,
  };
  const gravacao = semRejeicaoSolta(db.transaction((tx) => gravarContagem(tx, queimaId, baixar, semente.usuarioId)));
  await esperarAlguemNaTrava(observador, "(3)");
  primeira.soltar();
  const [a, b] = await Promise.all([primeira.desfecho, gravacao]);
  guardarVenda(a);
  afirmar(a.ok, `(3): a cobrança deveria gravar — ${String(!a.ok && a.erro)}`);
  afirmar(
    !b.ok && b.erro instanceof RecusaDasQueimas && frase(b).startsWith("Já foram lançadas 2 externas P"),
    `(3): a correção para 1 P deveria ser recusada pelo piso (2 P lançadas), veio “${frase(b) || String(!b.ok ? b.erro : "passou")}”.`,
  );
  const { rows } = await conexao.query<{ p: number }>("select externas_p as p from queima_contagens where queima_id = $1", [
    queimaId,
  ]);
  afirmar(rows[0]?.p === 3, `(3): a contagem não podia mudar (3 P), está ${rows[0]?.p}.`);
}

// (4) Recebi (trava e para) × apagar a contagem: o apagar espera, vê a venda ativa e recusa (a frase do
// plano 02); contagem e vínculo continuam. É também o backstop da U48 (a folha nunca chega a isso).
async function provarApagarSobCorrida(conexao: Client, observador: Client): Promise<void> {
  console.log("    (4) “Recebi agora” × apagar a contagem...");
  const queimaId = await semearQueima(conexao, so(3));
  const primeira = await primeiraTravaEPara(queimaId, (tx) => cobrar(tx, queimaId, so(1)));
  const apagar = semRejeicaoSolta(db.transaction((tx) => apagarContagemNaTransacao(tx, queimaId)));
  await esperarAlguemNaTrava(observador, "(4)");
  primeira.soltar();
  const [a, b] = await Promise.all([primeira.desfecho, apagar]);
  guardarVenda(a);
  afirmar(a.ok, `(4): a cobrança deveria gravar — ${String(!a.ok && a.erro)}`);
  afirmar(
    !b.ok && frase(b) === `As externas desta queima já foram lançadas na venda nº ${a.valor.numero}. Para apagar a contagem, cancele a venda no Caixa.`,
    `(4): o apagar deveria ser recusado com a venda nº ${a.valor.numero}, veio “${frase(b) || "passou"}”.`,
  );
  const { rows } = await conexao.query<{ total: string }>("select count(*)::text as total from queima_contagens where queima_id = $1", [
    queimaId,
  ]);
  afirmar(rows[0]?.total === "1", "(4): a contagem deveria continuar.");
  afirmar((await vinculos(conexao, queimaId)).length === 1, "(4): o vínculo deveria continuar.");
}

// (5) Recebi (trava e para) × `delete from queimas` noutra conexão: a exclusão espera a trava; depois,
// contagem e vínculos somem (cascade) e a venda criada CONTINUA em `documentos`.
async function provarExcluirQueimaSobCorrida(conexao: Client, observador: Client, outra: Client): Promise<void> {
  console.log("    (5) “Recebi agora” × excluir a queima...");
  const queimaId = await semearQueima(conexao, so(3));
  const primeira = await primeiraTravaEPara(queimaId, (tx) => cobrar(tx, queimaId, so(3)));
  const exclusao = semRejeicaoSolta(outra.query("delete from queimas where id = $1", [queimaId]));
  await esperarAlguemNaTrava(observador, "(5)");
  primeira.soltar();
  const [a, b] = await Promise.all([primeira.desfecho, exclusao]);
  guardarVenda(a);
  afirmar(a.ok, `(5): a cobrança deveria gravar — ${String(!a.ok && a.erro)}`);
  afirmar(b.ok && b.valor.rowCount === 1, `(5): a exclusão deveria passar depois da trava — ${String(!b.ok && b.erro)}`);
  const contagens = await conexao.query<{ total: string }>(
    "select count(*)::text as total from queima_contagens where queima_id = $1",
    [queimaId],
  );
  const ligados = await conexao.query<{ total: string }>("select count(*)::text as total from queima_vendas where queima_id = $1", [
    queimaId,
  ]);
  const venda = await conexao.query<{ total: string }>("select count(*)::text as total from documentos where id = $1", [
    a.valor.documentoId,
  ]);
  afirmar(contagens.rows[0]?.total === "0" && ligados.rows[0]?.total === "0", "(5): contagem e vínculos deveriam sumir (cascade).");
  afirmar(venda.rows[0]?.total === "1", "(5): a venda deveria CONTINUAR em documentos — excluir a queima nunca leva venda.");
}

// (6) Duas gravações de contagem sobrepostas na mesma queima (sem contagem ainda): a trava da queima
// serializa — uma linha só, com os números da última a confirmar, nunca 23505 para o usuário.
async function provarDuasGravacoes(conexao: Client, observador: Client): Promise<void> {
  console.log("    (6) gravar a contagem × gravar a contagem...");
  const queimaId = await semearQueima(conexao, null);
  const contagem = (internasP: number): Contagem => ({
    internasP,
    internasM: 0,
    internasG: 0,
    externasP: 0,
    externasM: 0,
    externasG: 0,
    saiuCheio: true,
  });
  const primeira = await primeiraTravaEPara(queimaId, (tx) => gravarContagem(tx, queimaId, contagem(4), semente.usuarioId));
  const segunda = semRejeicaoSolta(db.transaction((tx) => gravarContagem(tx, queimaId, contagem(9), semente.usuarioId)));
  await esperarAlguemNaTrava(observador, "(6)");
  primeira.soltar();
  const [a, b] = await Promise.all([primeira.desfecho, segunda]);
  afirmar(a.ok && b.ok, `(6): as duas gravações deveriam passar — ${String(!a.ok ? a.erro : !b.ok ? b.erro : "")}`);
  afirmar(a.valor.criada && !b.valor.criada, "(6): a primeira cria, a segunda corrige a mesma linha.");
  const { rows } = await conexao.query<{ p: number }>("select internas_p as p from queima_contagens where queima_id = $1", [
    queimaId,
  ]);
  afirmar(rows.length === 1 && rows[0].p === 9, `(6): uma linha só, com os números da segunda (9), veio ${JSON.stringify(rows)}.`);
}

// (7) Venda cancelada libera a quantidade (D-07): a venda que levava as 3 P é cancelada pela conexão do
// dono, como o Caixa faz (`cancelado_em`/`cancelado_por`); cobrar 3 P de novo passa — Σ ativa = 3, dois
// vínculos, um cancelado. (8) Idempotência: logo depois, uma SEGUNDA chamada direta e sequencial com as
// mesmas 3 P é recusada (“… já foram todas lançadas — venda nº N. …”) e continua UM vínculo ativo.
async function provarCanceladaLiberaEIdempotencia(conexao: Client): Promise<void> {
  console.log("    (7) venda cancelada devolve a quantidade (cobrar as 3 P de novo passa)...");
  const queimaId = await semearQueima(conexao, so(3));
  const antiga = await db.transaction((tx) => cobrar(tx, queimaId, so(3)));
  semente.documentoIds.push(antiga.documentoId);
  await conexao.query("update documentos set cancelado_em = now(), cancelado_por = $2 where id = $1", [
    antiga.documentoId,
    semente.usuarioId,
  ]);
  const nova = await db.transaction((tx) => cobrar(tx, queimaId, so(3)));
  semente.documentoIds.push(nova.documentoId);
  let lista = await vinculos(conexao, queimaId);
  afirmar(
    lista.length === 2 && lista.filter((vinculo) => vinculo.cancelado).length === 1 && somaAtiva(lista).p === 3,
    `(7): deveriam ser dois vínculos, um cancelado, somando 3 P ativas — veio ${JSON.stringify(lista)}.`,
  );

  console.log("    (8) idempotência: cobrar de novo, em seguida, o já lançado é recusado...");
  const repetida = await semRejeicaoSolta(db.transaction((tx) => cobrar(tx, queimaId, so(3))));
  guardarVenda(repetida);
  afirmar(
    !repetida.ok &&
      frase(repetida) ===
        `As externas desta queima já foram todas lançadas — venda nº ${nova.numero}. A tela foi atualizada.`,
    `(8): cobrar de novo o já lançado deveria ser recusado citando a venda nº ${nova.numero}, veio “${frase(repetida) || "passou"}”.`,
  );
  lista = await vinculos(conexao, queimaId);
  afirmar(
    lista.filter((vinculo) => !vinculo.cancelado).length === 1,
    `(8): deveria continuar UM vínculo ativo, veio ${JSON.stringify(lista)}.`,
  );
}

async function porPrecosDeProva(conexao: Client): Promise<void> {
  const { rows } = await conexao.query<{ chave: string; nome: string; preco: number | null }>(
    `select chave_do_sistema as chave, nome, preco_venda_centavos as preco
       from itens_catalogo where chave_do_sistema like 'queima_externa_%'`,
  );
  afirmar(rows.length === 3, `Os três itens “Queima externa P/M/G” deveriam existir — achei ${rows.length}.`);
  semente.itensOriginais = rows;
  for (const tamanho of ["P", "M", "G"] as const) {
    await conexao.query("update itens_catalogo set preco_venda_centavos = $1 where chave_do_sistema = $2", [
      PRECOS_DE_PROVA[tamanho],
      `queima_externa_${tamanho.toLowerCase()}`,
    ]);
  }
  // O leitor da aplicação acha os três pela chave, com o preço de prova.
  const itens = await obterItensDasQueimas();
  afirmar(itens.P.precoVendaCentavos === PRECOS_DE_PROVA.P, "obterItensDasQueimas deveria ler o preço de prova do P.");
}

async function faxina(conexao: Client): Promise<void> {
  try {
    await conexao.query("begin");
    await conexao.query("delete from queimas where id = any($1::uuid[])", [semente.queimaIds]);
    if (semente.fornoId !== "") {
      await conexao.query("delete from fornos where id = $1", [semente.fornoId]);
    }
    // A mesma faxina de `testar-migracoes.mjs`: a soma do documento é conferida por gatilho adiado.
    await conexao.query("alter table documento_linhas disable trigger conferir_soma_apos_linha");
    await conexao.query("alter table parcelas disable trigger conferir_soma_apos_parcela");
    await conexao.query("delete from parcelas where documento_id = any($1::uuid[])", [semente.documentoIds]);
    await conexao.query("delete from documento_linhas where documento_id = any($1::uuid[])", [semente.documentoIds]);
    await conexao.query("delete from documentos where id = any($1::uuid[])", [semente.documentoIds]);
    await conexao.query("alter table documento_linhas enable trigger conferir_soma_apos_linha");
    await conexao.query("alter table parcelas enable trigger conferir_soma_apos_parcela");
    for (const item of semente.itensOriginais) {
      await conexao.query("update itens_catalogo set preco_venda_centavos = $1, nome = $2 where chave_do_sistema = $3", [
        item.preco,
        item.nome,
        item.chave,
      ]);
    }
    // A usuária de prova FICA (e-mail único por execução): nenhum caminho de código apaga linha de
    // `usuarios` (AUTH-09) — o banco de teste é efêmero.
    await conexao.query("commit");
  } catch (erro) {
    await conexao.query("rollback").catch(() => {});
    // Nunca relançado: o banco de teste é efêmero, e a falha de verdade é a da prova.
    console.error(`Corridas das Queimas: a faxina não apagou o dado de prova — ${String(erro)}`);
  }
}

async function main(): Promise<void> {
  const conexao = new Client({ connectionString: process.env.DATABASE_URL });
  const observador = new Client({ connectionString: process.env.DATABASE_URL });
  const outra = new Client({ connectionString: process.env.DATABASE_URL });
  await conexao.connect();
  await observador.connect();
  await outra.connect();
  let codigo = 1;
  try {
    const { rows } = await conexao.query<{ banco: string }>("select current_database() as banco");
    afirmar(rows[0]?.banco !== BANCO_DE_PRODUCAO, "Recusado: este script só roda no banco de TESTE.");

    const usuario = await conexao.query<{ id: string }>(
      `insert into usuarios (nome, email, senha_hash)
       values ('Prova das corridas das Queimas', $1, 'hash-fake-de-teste')
       returning id`,
      [`corridas-das-queimas-${randomUUID()}@exemplo.test`],
    );
    semente.usuarioId = usuario.rows[0].id;
    const forno = await conexao.query<{ id: string }>(
      "insert into fornos (nome, limite) values ($1, 50) returning id",
      [`[mig] Forno das corridas ${randomUUID().slice(0, 8)}`],
    );
    semente.fornoId = forno.rows[0].id;
    await porPrecosDeProva(conexao);

    console.log("  Corridas das Queimas (06.4-04, D-07), com transações sobrepostas de verdade:");
    await provarMesmaPeca(conexao, observador);
    await provarPartesQueCabem(conexao, observador);
    await provarPisoSobCorrida(conexao, observador);
    await provarApagarSobCorrida(conexao, observador);
    await provarExcluirQueimaSobCorrida(conexao, observador, outra);
    await provarDuasGravacoes(conexao, observador);
    await provarCanceladaLiberaEIdempotencia(conexao);
    console.log("  Corridas das Queimas: todas as afirmações passaram.");
    codigo = 0;
  } catch (erro) {
    console.error("Corridas das Queimas falharam:", erro instanceof Error ? erro.message : erro);
  } finally {
    await faxina(conexao);
    await conexao.end();
    await observador.end();
    await outra.end();
    await pool.end();
  }
  process.exit(codigo);
}

void main();

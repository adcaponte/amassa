// Prova, contra um Postgres de verdade e com DUAS TRANSAÇÕES QUE SE SOBREPÕEM DE FATO, o núcleo do
// “Corrigir” um lançamento (Fase 06.5, plano 16 — D-18 com a UI-D9 do dono, 05/10/2026, POL-08): a
// original só é cancelada NA MESMA TRANSAÇÃO em que a corrigida é lançada, e uma original é corrigida
// UMA vez. Roda o CÓDIGO da aplicação — `lancarCorrecaoNaTransacao`, `versaoAtualDoDocumento` (a mesma
// leitura que a página do plano 17 faz com o `db`), `cancelarDocumentoNaTransacao` e `gravarVenda` —,
// não uma cópia do SQL.
//
// Chamado por `scripts/testar-migracoes.mjs` (`npm run test:migracoes`, parte do `npm run verificar` e do
// CI) depois das migrações, com `DATABASE_URL` apontando para o banco de TESTE. Nunca rode contra o banco
// de produção: o script se recusa se o banco conectado se chamar `amassa`.
//
// Por que não o e2e de toque duplo: o Next executa as Server Actions de um navegador uma depois da outra.
// Aqui a primeira transação TRAVA a original e fica parada numa barreira; a segunda começa e fica
// esperando a trava (conferido em `pg_stat_activity`); só então a primeira lança e confirma. A ação
// (`lancarVenda` com `correcao`) exige sessão e não roda fora de uma requisição — o corpo transacional
// dela, sim.
//
// O que se afirma, em todos os casos: nenhum estado em que a original está cancelada sem a nova (ou a
// nova existe sem a original cancelada), nenhuma segunda correção da mesma original, nenhum impasse
// (40P01), e toda recusa sem NADA gravado.
import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { Client } from "pg";

import { db, pool } from "@/db";
import { documentos } from "@/db/schema";
import {
  cancelarDocumentoNaTransacao,
  DocumentoJaCancelado,
  gravarVenda,
  lancarCorrecaoNaTransacao,
  RecusaDaCorrecao,
  versaoAtualDoDocumento,
  type TransacaoDoBanco,
} from "@/lib/financeiro/gravacao";
import type { MotivoDaRecusaDaCorrecao } from "@/lib/financeiro/correcao";

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

// Espera até haver uma conexão deste banco parada numa trava.
async function esperarAlguemNaTrava(observador: Client, contexto: string): Promise<void> {
  for (let tentativa = 0; tentativa < 400; tentativa++) {
    const { rows } = await observador.query<{ total: string }>(
      `select count(*)::text as total from pg_stat_activity
        where datname = current_database() and wait_event_type = 'Lock' and pid <> pg_backend_pid()`,
    );
    if (Number(rows[0]?.total ?? 0) >= 1) {
      return;
    }
    await new Promise((resolver) => setTimeout(resolver, 25));
  }
  throw new Error(`${contexto}: a segunda transação deveria estar esperando a trava, e não ficou.`);
}

// O SQLSTATE do Postgres, que o Drizzle embrulha em `cause`.
function codigoDoErro(erro: unknown): string | undefined {
  const comCausa = erro as { code?: unknown; cause?: { code?: unknown } } | null;
  const codigo = comCausa?.cause?.code ?? comCausa?.code;
  return typeof codigo === "string" ? codigo : undefined;
}

function descrever(desfecho: Desfecho<unknown>): string {
  if (desfecho.ok) {
    return "passou";
  }
  const erro = desfecho.erro;
  if (erro instanceof RecusaDaCorrecao) {
    return `recusa ${erro.motivo}`;
  }
  const nome = erro instanceof Error ? `${erro.constructor.name}: ${erro.message}` : String(erro);
  return `${nome} (SQLSTATE ${codigoDoErro(erro) ?? "—"})`;
}

function motivo(desfecho: Desfecho<unknown>): MotivoDaRecusaDaCorrecao | null {
  return !desfecho.ok && desfecho.erro instanceof RecusaDaCorrecao ? desfecho.erro.motivo : null;
}

function semImpasse(contexto: string, ...desfechos: Desfecho<unknown>[]): void {
  for (const desfecho of desfechos) {
    afirmar(
      desfecho.ok || codigoDoErro(desfecho.erro) !== "40P01",
      `${contexto}: uma das transações caiu em IMPASSE (40P01) — a ordem de travas inverteu.`,
    );
  }
}

type Semente = {
  usuarioId: string;
  categoriaId: string;
  documentoIds: string[];
  orcamentoIds: string[];
};

const semente: Semente = { usuarioId: "", categoriaId: "", documentoIds: [], orcamentoIds: [] };

// Uma venda de valor livre, pelo escritor da aplicação. `paga`: à vista já recebida (o caso comum).
async function semearVenda(pessoaNome: string, opcoes: { paga: boolean }): Promise<{ id: string; numero: number }> {
  const hoje = hojeEmBrasilia();
  const venda = await db.transaction((tx) =>
    gravarVenda(
      tx,
      {
        data: hoje,
        pessoaNome,
        linhas: [{ tipo: "livre", descricao: "Prova da correção", categoriaId: semente.categoriaId, valorCentavos: 7000 }],
        parcelas: [{ vencimento: hoje, valorCentavos: 7000, forma: "pix", pago: opcoes.paga }],
      },
      { registradoPor: semente.usuarioId, taxaCartaoPontosBase: 0 },
    ),
  );
  semente.documentoIds.push(venda.id);
  return venda;
}

// A correção como `lancarVenda` a faz (sem a sessão e sem a validação do formulário): a nova é a venda de
// R$ 80,00 que a tela preenchida mandaria, com `pessoaNome` = `marca` para o caso achar quantas nasceram.
function corrigir(tx: TransacaoDoBanco, originalId: string, versao: string, marca: string) {
  const hoje = hojeEmBrasilia();
  return lancarCorrecaoNaTransacao(tx, {
    originalId,
    versao,
    tipo: "venda",
    usuarioId: semente.usuarioId,
    gravarNova: async (txDaNova) => {
      const nova = await gravarVenda(
        txDaNova,
        {
          data: hoje,
          pessoaNome: marca,
          linhas: [{ tipo: "livre", descricao: "Prova da correção", categoriaId: semente.categoriaId, valorCentavos: 8000 }],
          parcelas: [{ vencimento: hoje, valorCentavos: 8000, forma: "pix", pago: true }],
        },
        { registradoPor: semente.usuarioId, taxaCartaoPontosBase: 0 },
      );
      semente.documentoIds.push(nova.id);
      return nova;
    },
  });
}

// A primeira transação: trava a ORIGINAL com a mesma trava que `lancarCorrecaoNaTransacao` toma de novo (já
// é dela, não espera) e para na barreira; depois roda `corpo` na MESMA transação.
async function primeiraTravaEPara<T>(
  originalId: string,
  corpo: (tx: TransacaoDoBanco) => Promise<T>,
): Promise<{ desfecho: Promise<Desfecho<T>>; soltar: () => void }> {
  const travou = barreira();
  const segurar = barreira();
  const desfecho = semRejeicaoSolta(
    db.transaction(async (tx) => {
      await tx.select({ id: documentos.id }).from(documentos).where(eq(documentos.id, originalId)).for("update");
      travou.soltar();
      await segurar.promessa;
      return corpo(tx);
    }),
  );
  const antes = await Promise.race([travou.promessa.then(() => null), desfecho]);
  if (antes !== null) {
    throw new Error(`A primeira transação falhou antes de travar: ${descrever(antes)}`);
  }
  return { desfecho, soltar: segurar.soltar };
}

type Estado = {
  originalCancelada: boolean;
  canceladaPor: string | null;
  vinculos: { corrigidoId: string; criadoPor: string }[];
  novas: { id: string; numero: number; cancelada: boolean }[];
};

// O retrato do banco para uma original e a marca das novas.
async function estado(conexao: Client, originalId: string, marca: string): Promise<Estado> {
  const original = await conexao.query<{ cancelada: boolean; cancelado_por: string | null }>(
    "select cancelado_em is not null as cancelada, cancelado_por from documentos where id = $1",
    [originalId],
  );
  const vinculos = await conexao.query<{ corrigidoId: string; criadoPor: string }>(
    `select corrigido_id as "corrigidoId", criado_por as "criadoPor"
       from correcoes_de_documento where original_id = $1`,
    [originalId],
  );
  const novas = await conexao.query<{ id: string; numero: number; cancelada: boolean }>(
    "select id, numero, cancelado_em is not null as cancelada from documentos where pessoa_nome = $1 order by numero",
    [marca],
  );
  return {
    originalCancelada: original.rows[0]?.cancelada ?? false,
    canceladaPor: original.rows[0]?.cancelado_por ?? null,
    vinculos: vinculos.rows,
    novas: novas.rows,
  };
}

// A invariante: ou NADA aconteceu (original ativa, nenhuma nova, nenhum vínculo), ou TUDO aconteceu UMA vez
// (original cancelada por quem corrigiu, uma nova ativa, um vínculo apontando para ela).
function afirmarTudoOuNada(contexto: string, retrato: Estado, esperado: "tudo" | "nada"): void {
  if (esperado === "nada") {
    afirmar(
      !retrato.originalCancelada && retrato.novas.length === 0 && retrato.vinculos.length === 0,
      `${contexto}: deveria NÃO ter gravado nada, veio ${JSON.stringify(retrato)}.`,
    );
    return;
  }
  afirmar(
    retrato.originalCancelada && retrato.canceladaPor === semente.usuarioId,
    `${contexto}: a original deveria estar cancelada por quem corrigiu, veio ${JSON.stringify(retrato)}.`,
  );
  afirmar(
    retrato.novas.length === 1 && !retrato.novas[0].cancelada,
    `${contexto}: deveria existir UMA nova, ativa, veio ${JSON.stringify(retrato.novas)}.`,
  );
  afirmar(
    retrato.vinculos.length === 1 &&
      retrato.vinculos[0].corrigidoId === retrato.novas[0].id &&
      retrato.vinculos[0].criadoPor === semente.usuarioId,
    `${contexto}: deveria existir UM vínculo, para a nova, veio ${JSON.stringify(retrato.vinculos)}.`,
  );
}

function marcaNova(caso: string): string {
  return `[mig] Correção ${caso} ${randomUUID().slice(0, 8)}`;
}

// (a) A correção simples: a versão que a página leria, e a correção sozinha.
async function provarCorrecaoSimples(conexao: Client): Promise<void> {
  console.log("    (a) correção simples — a original cancelada, a nova ativa, um vínculo...");
  const original = await semearVenda("[mig] Original (a)", { paga: true });
  const versao = await versaoAtualDoDocumento(db, original.id);
  afirmar(versao !== null, "(a): a versão da original deveria existir.");
  const marca = marcaNova("(a)");
  const desfecho = await semRejeicaoSolta(db.transaction((tx) => corrigir(tx, original.id, versao, marca)));
  afirmar(desfecho.ok, `(a): a correção deveria passar — ${descrever(desfecho)}`);
  afirmar(
    desfecho.valor.numeroOriginal === original.numero,
    `(a): o número da original devolvido deveria ser ${original.numero}, veio ${desfecho.valor.numeroOriginal}.`,
  );
  const retrato = await estado(conexao, original.id, marca);
  afirmarTudoOuNada("(a)", retrato, "tudo");
  afirmar(retrato.novas[0].numero === desfecho.valor.numero, "(a): o número da nova devolvido não é o gravado.");
  // A original cancelada mudou de versão: a página leria outra (é o que tira o “Corrigir” da tela).
  afirmar((await versaoAtualDoDocumento(db, original.id)) !== versao, "(a): a versão da original cancelada deveria mudar.");
}

// (b) DUAS correções sobrepostas da mesma original (toque duplo, dois celulares): a primeira trava e para;
// a segunda espera a trava; a primeira lança e confirma. A segunda relê sob a trava e cai em `ja_corrigida`,
// com o número da nova; uma nova só, um vínculo só, nenhum 40P01.
async function provarDuasCorrecoes(conexao: Client, observador: Client): Promise<void> {
  console.log("    (b) duas correções sobrepostas da MESMA original — só uma passa...");
  const original = await semearVenda("[mig] Original (b)", { paga: true });
  const versao = await versaoAtualDoDocumento(db, original.id);
  afirmar(versao !== null, "(b): a versão da original deveria existir.");
  const marca = marcaNova("(b)");
  const primeira = await primeiraTravaEPara(original.id, (tx) => corrigir(tx, original.id, versao, marca));
  const segunda = semRejeicaoSolta(db.transaction((tx) => corrigir(tx, original.id, versao, marca)));
  await esperarAlguemNaTrava(observador, "(b)");
  primeira.soltar();
  const [a, b] = await Promise.all([primeira.desfecho, segunda]);
  semImpasse("(b)", a, b);
  afirmar(a.ok, `(b): a primeira correção deveria passar — ${descrever(a)}`);
  afirmar(motivo(b) === "ja_corrigida", `(b): a segunda deveria ser recusada com ja_corrigida, veio ${descrever(b)}.`);
  const recusa = (b as { ok: false; erro: RecusaDaCorrecao }).erro;
  afirmar(
    recusa.detalhe.numeroNova === a.valor.numero && recusa.detalhe.numeroOriginal === original.numero,
    `(b): a recusa deveria citar a nº ${a.valor.numero} (nova) e a nº ${original.numero}, veio ${JSON.stringify(recusa.detalhe)}.`,
  );
  afirmarTudoOuNada("(b)", await estado(conexao, original.id, marca), "tudo");
}

// (c) Versão velha: a tela abriu a correção, e uma parcela foi recebida antes do “Lançar” → `mudou`, nada
// gravado, a original continua valendo.
async function provarVersaoVelha(conexao: Client): Promise<void> {
  console.log("    (c) versão velha (a parcela foi recebida depois de abrir) → mudou, nada gravado...");
  const original = await semearVenda("[mig] Original (c)", { paga: false });
  const versaoVista = await versaoAtualDoDocumento(db, original.id);
  afirmar(versaoVista !== null, "(c): a versão da original deveria existir.");
  // O “Recebi” de outro celular, entre abrir e lançar.
  await conexao.query("update parcelas set pago_em = $2, pago_por = $3 where documento_id = $1", [
    original.id,
    hojeEmBrasilia(),
    semente.usuarioId,
  ]);
  const marca = marcaNova("(c)");
  const desfecho = await semRejeicaoSolta(db.transaction((tx) => corrigir(tx, original.id, versaoVista, marca)));
  afirmar(motivo(desfecho) === "mudou", `(c): deveria ser recusada com mudou, veio ${descrever(desfecho)}.`);
  afirmarTudoOuNada("(c)", await estado(conexao, original.id, marca), "nada");
  // Relida (a tela de novo), passa.
  const versaoNova = await versaoAtualDoDocumento(db, original.id);
  afirmar(versaoNova !== null && versaoNova !== versaoVista, "(c): a versão deveria ter mudado com o recebimento.");
  const relida = await semRejeicaoSolta(db.transaction((tx) => corrigir(tx, original.id, versaoNova, marca)));
  afirmar(relida.ok, `(c): com a versão relida, a correção deveria passar — ${descrever(relida)}`);
  afirmarTudoOuNada("(c) relida", await estado(conexao, original.id, marca), "tudo");
}

// (d) Original que veio de um orçamento aprovado (UI-D10) → `origem`, nada gravado, mesmo com a versão certa.
async function provarOrigemDoOrcamento(conexao: Client): Promise<void> {
  console.log("    (d) original de orçamento aprovado → origem, nada gravado...");
  const original = await semearVenda("[mig] Original (d)", { paga: true });
  const sequencial = 900_000 + Math.floor(Math.random() * 90_000);
  const { rows } = await conexao.query<{ id: string }>(
    `insert into orcamentos (ano, sequencial, status, data, entrega_prevista, snapshot, congelado_em, documento_id, criado_por)
     values (2099, $1, 'aprovado', $2, $2, '{}'::jsonb, now(), $3, $4) returning id`,
    [sequencial, hojeEmBrasilia(), original.id, semente.usuarioId],
  );
  semente.orcamentoIds.push(rows[0].id);
  const versao = await versaoAtualDoDocumento(db, original.id);
  afirmar(versao !== null, "(d): a versão da original deveria existir.");
  const marca = marcaNova("(d)");
  const desfecho = await semRejeicaoSolta(db.transaction((tx) => corrigir(tx, original.id, versao, marca)));
  afirmar(motivo(desfecho) === "origem", `(d): deveria ser recusada com origem, veio ${descrever(desfecho)}.`);
  const recusa = (desfecho as { ok: false; erro: RecusaDaCorrecao }).erro;
  afirmar(
    recusa.detalhe.origem === "orcamento" &&
      recusa.detalhe.orcamento?.ano === 2099 &&
      recusa.detalhe.orcamento.sequencial === sequencial,
    `(d): a recusa deveria dizer o orçamento 2099/${sequencial}, veio ${JSON.stringify(recusa.detalhe)}.`,
  );
  afirmarTudoOuNada("(d)", await estado(conexao, original.id, marca), "nada");
}

// (e) Cancelamento pelo Caixa × correção, sobrepostos, nos dois sentidos. Cancelar primeiro: a correção
// espera a trava e cai em `cancelada` (sem vínculo), nada novo. Corrigir primeiro: o cancelamento espera e
// cai em “já cancelado” — a original NUNCA fica cancelada sem a nova, nem com duas.
async function provarCancelamentoXCorrecao(conexao: Client, observador: Client): Promise<void> {
  console.log("    (e) cancelar pelo Caixa × corrigir, sobrepostos, nos dois sentidos...");
  {
    const original = await semearVenda("[mig] Original (e1)", { paga: true });
    const versao = await versaoAtualDoDocumento(db, original.id);
    afirmar(versao !== null, "(e1): a versão da original deveria existir.");
    const marca = marcaNova("(e1)");
    const primeira = await primeiraTravaEPara(original.id, (tx) =>
      cancelarDocumentoNaTransacao(tx, original.id, semente.usuarioId),
    );
    const segunda = semRejeicaoSolta(db.transaction((tx) => corrigir(tx, original.id, versao, marca)));
    await esperarAlguemNaTrava(observador, "(e1)");
    primeira.soltar();
    const [a, b] = await Promise.all([primeira.desfecho, segunda]);
    semImpasse("(e1)", a, b);
    afirmar(a.ok, `(e1): o cancelamento deveria passar — ${descrever(a)}`);
    afirmar(motivo(b) === "cancelada", `(e1): a correção deveria cair em cancelada, veio ${descrever(b)}.`);
    const retrato = await estado(conexao, original.id, marca);
    afirmar(
      retrato.originalCancelada && retrato.novas.length === 0 && retrato.vinculos.length === 0,
      `(e1): a original cancelada pelo Caixa, sem nova nem vínculo, veio ${JSON.stringify(retrato)}.`,
    );
  }
  {
    const original = await semearVenda("[mig] Original (e2)", { paga: true });
    const versao = await versaoAtualDoDocumento(db, original.id);
    afirmar(versao !== null, "(e2): a versão da original deveria existir.");
    const marca = marcaNova("(e2)");
    const primeira = await primeiraTravaEPara(original.id, (tx) => corrigir(tx, original.id, versao, marca));
    const segunda = semRejeicaoSolta(
      db.transaction((tx) => cancelarDocumentoNaTransacao(tx, original.id, semente.usuarioId)),
    );
    await esperarAlguemNaTrava(observador, "(e2)");
    primeira.soltar();
    const [a, b] = await Promise.all([primeira.desfecho, segunda]);
    semImpasse("(e2)", a, b);
    afirmar(a.ok, `(e2): a correção deveria passar — ${descrever(a)}`);
    afirmar(
      !b.ok && b.erro instanceof DocumentoJaCancelado,
      `(e2): o cancelamento sobreposto deveria cair em “já cancelado”, veio ${descrever(b)}.`,
    );
    afirmarTudoOuNada("(e2)", await estado(conexao, original.id, marca), "tudo");
  }
}

async function faxina(conexao: Client): Promise<void> {
  try {
    await conexao.query("begin");
    // `correcoes_de_documento` só cresce para `amassa_app` (a 0031 revoga update/delete); a faxina roda
    // com o dono do banco de teste.
    await conexao.query(
      "delete from correcoes_de_documento where original_id = any($1::uuid[]) or corrigido_id = any($1::uuid[])",
      [semente.documentoIds],
    );
    await conexao.query("delete from orcamentos where id = any($1::uuid[])", [semente.orcamentoIds]);
    // A mesma faxina de `testar-migracoes.mjs`: a soma do documento é conferida por gatilho adiado.
    await conexao.query("alter table documento_linhas disable trigger conferir_soma_apos_linha");
    await conexao.query("alter table parcelas disable trigger conferir_soma_apos_parcela");
    await conexao.query("delete from parcelas where documento_id = any($1::uuid[])", [semente.documentoIds]);
    await conexao.query("delete from documento_linhas where documento_id = any($1::uuid[])", [semente.documentoIds]);
    await conexao.query("delete from documentos where id = any($1::uuid[])", [semente.documentoIds]);
    await conexao.query("alter table documento_linhas enable trigger conferir_soma_apos_linha");
    await conexao.query("alter table parcelas enable trigger conferir_soma_apos_parcela");
    if (semente.categoriaId !== "") {
      await conexao.query("delete from categorias where id = $1", [semente.categoriaId]);
    }
    // A usuária de prova FICA (e-mail único por execução): nenhum caminho de código apaga linha de
    // `usuarios` (AUTH-09) — o banco de teste é efêmero.
    await conexao.query("commit");
  } catch (erro) {
    await conexao.query("rollback").catch(() => {});
    // Nunca relançado: o banco de teste é efêmero, e a falha de verdade é a da prova.
    console.error(`Corridas da correção: a faxina não apagou o dado de prova — ${String(erro)}`);
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
       values ('Prova das corridas da correção', $1, 'hash-fake-de-teste')
       returning id`,
      [`corridas-da-correcao-${randomUUID()}@exemplo.test`],
    );
    semente.usuarioId = usuario.rows[0].id;
    const categoria = await conexao.query<{ id: string }>(
      "insert into categorias (nome, grupo, area) values ($1, 'receita', 'pecas') returning id",
      [`[mig] Receita da correção ${randomUUID().slice(0, 8)}`],
    );
    semente.categoriaId = categoria.rows[0].id;

    console.log("  Corridas da correção (06.5-16, D-18/UI-D9), com transações sobrepostas de verdade:");
    // Cada caso semeia a sua original: uma falha não contamina o seguinte. Roda TODOS e junta as falhas.
    const casos: [string, () => Promise<void>][] = [
      ["(a)", () => provarCorrecaoSimples(conexao)],
      ["(b)", () => provarDuasCorrecoes(conexao, observador)],
      ["(c)", () => provarVersaoVelha(conexao)],
      ["(d)", () => provarOrigemDoOrcamento(conexao)],
      ["(e)", () => provarCancelamentoXCorrecao(conexao, observador)],
    ];
    const falhas: string[] = [];
    for (const [nome, caso] of casos) {
      try {
        await caso();
      } catch (erro) {
        falhas.push(`${nome} ${erro instanceof Error ? erro.message : String(erro)}`);
      }
    }
    if (falhas.length > 0) {
      throw new Error(`${falhas.length} caso(s) falharam:\n      ${falhas.join("\n      ")}`);
    }
    console.log("  Corridas da correção: todas as afirmações passaram (nenhum 40P01).");
    codigo = 0;
  } catch (erro) {
    console.error("Corridas da correção falharam:", erro instanceof Error ? erro.message : erro);
  } finally {
    await faxina(conexao);
    await conexao.end();
    await observador.end();
    await pool.end();
  }
  process.exit(codigo);
}

void main();

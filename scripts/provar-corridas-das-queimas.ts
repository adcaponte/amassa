// Prova, contra um Postgres de verdade e com DUAS TRANSAÇÕES QUE SE SOBREPÕEM DE FATO, as corridas da
// cobrança das externas das Queimas (Fase 06.4, plano 04 — D-07, decisão do dono de 04/10/2026: várias
// vendas por queima, uma por pessoa, cada uma com a sua quantidade por tamanho). Roda o CÓDIGO da
// aplicação — `travarContagem`, `gravarContagem`, `apagarContagemNaTransacao`, `cobrarQueimaNaTransacao`
// (o corpo do "Recebi agora") e `obterItensDasQueimas`, que ela chama sob a trava —, não uma cópia do SQL.
// Desde o plano 05, também a metade das Queimas do "Lançar na Venda" (`vincularQueimaNaVenda` →
// `conferir` → `gravarVenda` → `gravar`, a mesma sequência de `lancarVenda`): os casos (9) e (10) provam que
// "Recebi agora" e "Lançar na Venda" sobrepostos nunca passam das externas em nenhum tamanho.
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
//
// Quick 261005-2yu (05/10/2026), 06.4-WR-01/02/03 — a CONCORRÊNCIA OTIMISTA: cada pedido manda o retrato
// que a tela dele VIU ao abrir (a contagem `esperada`; as `vendasVistas`), e o servidor recusa sob a
// trava quando isso mudou. Nos casos sobrepostos abaixo, o pedido que espera a trava abriu ANTES de a
// outra transação confirmar — então viu `null`/`[]`. Mudaram de sentido: (1) e (9b) — o segundo
// "Recebi agora" continua recusado, mas pela tela velha (cita a venda nova) em vez de "só faltam"; (2) — o
// segundo "Recebi agora" agora é RECUSADO (antes passava) e só passa de novo com a tela relida; (6) — a
// segunda gravação da contagem agora é RECUSADA (antes sobrescrevia em silêncio, que era o defeito do
// WR-01). Casos novos: (6b) corrigir/apagar com retrato velho, (11) excluir a queima sob corrida e (12) o
// "Recebi agora" repetido depois de uma resposta perdida. A invariante da D-07 (Σ ativa ≤ externas, por
// tamanho) continua afirmada em todos.
import { randomUUID } from "node:crypto";

import { Client } from "pg";

import { db, pool } from "@/db";
import { gravarVenda, type LinhaDoPedidoDeVenda } from "@/lib/financeiro/gravacao";
import type { Contagem, Quantidades } from "@/lib/queimas/contagem";
import { obterItensDasQueimas } from "@/lib/queimas/consultas";
import {
  apagarContagemNaTransacao,
  cobrarQueimaNaTransacao,
  excluirQueimaNaTransacao,
  gravarContagem,
  RecusaDasQueimas,
  travarContagem,
  vincularQueimaNaVenda,
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

// O corpo do "Recebi agora" (`receberQueimaAgora` sem a sessão), na forma pix, sem pessoa. `vistas` = as
// vendas ativas que a folha mostrou ao abrir (quick 261005-2yu) — `[]` quando ela abriu antes de qualquer
// venda.
function cobrar(tx: TransacaoDoBanco, queimaId: string, quantidades: Quantidades, vistas: readonly number[] = []) {
  return cobrarQueimaNaTransacao(tx, {
    queimaId,
    forma: "pix",
    quantidades,
    clienteId: null,
    vendasVistas: vistas,
    hoje: hojeEmBrasilia(),
    registradoPor: semente.usuarioId,
    taxaCartaoPontosBase: 0,
    dataSaldoInicial: null,
  });
}

// A metade das Queimas do "Lançar na Venda" (`lancarVenda` em lib/financeiro/acoes.ts, sem a sessão e sem a
// validação do formulário): trava e confere a queima (`vincularQueimaNaVenda`), monta as linhas da venda com
// os itens do Catálogo (as quantidades pedidas, ao preço de prova), tira delas as quantidades do vínculo
// (`conferir` — recusa acima do que falta), grava a venda com o MESMO escritor e grava o vínculo — na mesma
// transação. A venda nasce como a da tela: à vista EM ABERTO, hoje, sem pessoa.
async function lancar(
  tx: TransacaoDoBanco,
  queimaId: string,
  quantidades: Quantidades,
): Promise<{ documentoId: string; numero: number }> {
  const vinculo = await vincularQueimaNaVenda(tx, queimaId);
  const itens = await obterItensDasQueimas(tx);
  const linhas: LinhaDoPedidoDeVenda[] = [];
  for (const [tamanho, chave] of [
    ["P", "p"],
    ["M", "m"],
    ["G", "g"],
  ] as const) {
    if (quantidades[chave] <= 0) {
      continue;
    }
    linhas.push({
      tipo: "item",
      itemId: itens[tamanho].id,
      descricao: itens[tamanho].nome,
      categoriaId: itens[tamanho].categoriaVendaId,
      quantidade: quantidades[chave],
      valorCentavos: quantidades[chave] * PRECOS_DE_PROVA[tamanho],
    });
  }
  const doVinculo = vinculo.conferir(linhas);
  const hoje = hojeEmBrasilia();
  const total = linhas.reduce((soma, linha) => soma + linha.valorCentavos, 0);
  const venda = await gravarVenda(
    tx,
    {
      data: hoje,
      pessoaNome: null,
      linhas,
      parcelas: [{ vencimento: hoje, valorCentavos: total, forma: "pix", pago: false }],
    },
    { registradoPor: semente.usuarioId, taxaCartaoPontosBase: 0 },
  );
  await vinculo.gravar(venda.id, doVinculo, semente.usuarioId);
  return { documentoId: venda.id, numero: venda.numero };
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

// A recusa é de TELA VELHA (quick 261005-2yu)?
function telaMudou(desfecho: Desfecho<unknown>): boolean {
  return !desfecho.ok && desfecho.erro instanceof RecusaDasQueimas && desfecho.erro.detalhe?.telaMudou === true;
}

// A contagem que `semearQueima` grava (só externas; o resto no padrão do banco).
function contagemSemeada(externas: Quantidades): Contagem {
  return {
    internasP: 0,
    internasM: 0,
    internasG: 0,
    externasP: externas.p,
    externasM: externas.m,
    externasG: externas.g,
    saiuCheio: true,
  };
}

// (1) Recebi × Recebi pedindo a MESMA peça: 3 P contadas, as duas pedem 2 P. A segunda espera a trava,
// relê e recusa; a soma ativa de P fica em 2. Desde o quick 261005-2yu a recusa é a da TELA VELHA (a
// segunda folha abriu sem venda nenhuma e agora há a venda nº N) — antes era "só faltam 1 P".
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
  afirmar(
    telaMudou(b) && frase(b).includes(`venda nº ${a.valor.numero}`),
    `(1): a recusa deveria ser de tela velha citando a venda nº ${a.valor.numero}, disse “${frase(b)}”.`,
  );
  const lista = await vinculos(conexao, queimaId);
  afirmar(lista.length === 1 && somaAtiva(lista).p === 2, `(1): Σ ativa de P deveria ser 2 num vínculo, veio ${JSON.stringify(lista)}.`);
}

// (2) Recebi × Recebi pedindo partes que CABEM juntas: 1 P e 2 P de 3 P. Até o quick 261005-2yu as duas
// passavam. Agora a segunda — cuja folha abriu antes da primeira venda — é RECUSADA pela tela velha: o
// servidor não distingue "outra pessoa cobrou outra parte" de "o meu toque anterior já valeu" (WR-02), e
// decidir pelo que a pessoa VIU é o lado seguro. Com a tela relida (vistas = [nº da primeira]), os 2 P
// passam: a regra continua por tamanho, e a soma fecha exatamente em 3, em dois vínculos.
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
  afirmar(a.ok, `(2): a primeira cobrança deveria passar — ${String(!a.ok && a.erro)}`);
  afirmar(telaMudou(b), `(2): a segunda (folha aberta antes da primeira venda) deveria ser recusada pela tela velha, veio “${frase(b) || "passou"}”.`);
  let lista = await vinculos(conexao, queimaId);
  afirmar(lista.length === 1 && somaAtiva(lista).p === 1, `(2): depois da recusa, um vínculo com 1 P, veio ${JSON.stringify(lista)}.`);
  const relida = await semRejeicaoSolta(db.transaction((tx) => cobrar(tx, queimaId, so(2), [a.valor.numero])));
  guardarVenda(relida);
  afirmar(relida.ok, `(2): com a tela relida, os 2 P deveriam passar — ${String(!relida.ok && relida.erro)}`);
  lista = await vinculos(conexao, queimaId);
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
  // A folha abriu com a contagem semeada — e a cobrança não mexe na contagem: a conferência da tela passa e
  // quem recusa é o piso, como antes.
  const gravacao = semRejeicaoSolta(
    db.transaction((tx) => gravarContagem(tx, queimaId, baixar, contagemSemeada(so(3)), semente.usuarioId)),
  );
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
  const apagar = semRejeicaoSolta(
    db.transaction((tx) => apagarContagemNaTransacao(tx, queimaId, contagemSemeada(so(3)))),
  );
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

// (6) Duas gravações de contagem sobrepostas na mesma queima (sem contagem ainda), as duas de folhas que
// abriram sem contagem (`esperada: null`): a trava da queima serializa, a primeira cria e a SEGUNDA É
// RECUSADA (`fraseContagemMudou`, `telaMudou`) — fica uma linha só, com os números da primeira; nunca 23505
// para o usuário. Até o quick 261005-2yu a segunda passava e sobrescrevia a primeira em silêncio: era
// exatamente o defeito do 06.4-WR-01.
async function provarDuasGravacoes(conexao: Client, observador: Client): Promise<void> {
  console.log("    (6) gravar a contagem × gravar a contagem (as duas folhas abriram sem contagem)...");
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
  const primeira = await primeiraTravaEPara(queimaId, (tx) =>
    gravarContagem(tx, queimaId, contagem(4), null, semente.usuarioId),
  );
  const segunda = semRejeicaoSolta(
    db.transaction((tx) => gravarContagem(tx, queimaId, contagem(9), null, semente.usuarioId)),
  );
  await esperarAlguemNaTrava(observador, "(6)");
  primeira.soltar();
  const [a, b] = await Promise.all([primeira.desfecho, segunda]);
  afirmar(a.ok && a.valor.criada, `(6): a primeira gravação deveria criar a contagem — ${String(!a.ok && a.erro)}`);
  afirmar(
    telaMudou(b) && frase(b).includes("agora estão gravadas 4 peças"),
    `(6): a segunda (folha aberta sem contagem) deveria ser RECUSADA pela tela velha, veio “${frase(b) || "passou"}”.`,
  );
  afirmar(
    !b.ok && b.erro instanceof RecusaDasQueimas && b.erro.detalhe?.contagemAtual?.internasP === 4,
    "(6): a recusa deveria trazer a contagem gravada agora (4 P), para a folha passar a esperar por ela.",
  );
  const { rows } = await conexao.query<{ p: number }>("select internas_p as p from queima_contagens where queima_id = $1", [
    queimaId,
  ]);
  afirmar(rows.length === 1 && rows[0].p === 4, `(6): uma linha só, com os números da primeira (4), veio ${JSON.stringify(rows)}.`);
}

// (6b) Corrigir e apagar com retrato velho, em sequência (quick 261005-2yu, 06.4-WR-01): grava A
// (esperada null); grava B esperando A → passa; grava C esperando A → recusado (a gravada é B), a linha
// fica B. Apagar esperando A → recusado; apagar esperando B → passa.
async function provarRetratoVelhoDaContagem(conexao: Client): Promise<void> {
  console.log("    (6b) corrigir e apagar a contagem com o retrato velho da folha...");
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
  const A = contagem(5);
  const B = contagem(7);
  const C = contagem(11);
  const lerP = async () =>
    (await conexao.query<{ p: number }>("select internas_p as p from queima_contagens where queima_id = $1", [queimaId])).rows;

  const gravouA = await semRejeicaoSolta(db.transaction((tx) => gravarContagem(tx, queimaId, A, null, semente.usuarioId)));
  afirmar(gravouA.ok && gravouA.valor.criada, `(6b): A deveria ser criada — ${String(!gravouA.ok && gravouA.erro)}`);
  const gravouB = await semRejeicaoSolta(db.transaction((tx) => gravarContagem(tx, queimaId, B, A, semente.usuarioId)));
  afirmar(gravouB.ok && !gravouB.valor.criada, `(6b): B (esperando A) deveria corrigir — ${String(!gravouB.ok && gravouB.erro)}`);
  const gravouC = await semRejeicaoSolta(db.transaction((tx) => gravarContagem(tx, queimaId, C, A, semente.usuarioId)));
  afirmar(
    telaMudou(gravouC) && frase(gravouC).includes("agora estão gravadas 7 peças"),
    `(6b): C (esperando A, gravada B) deveria ser recusada pela tela velha, veio “${frase(gravouC) || "passou"}”.`,
  );
  let linhas = await lerP();
  afirmar(linhas.length === 1 && linhas[0].p === 7, `(6b): a linha deveria continuar B (7), veio ${JSON.stringify(linhas)}.`);

  const apagouComA = await semRejeicaoSolta(db.transaction((tx) => apagarContagemNaTransacao(tx, queimaId, A)));
  afirmar(telaMudou(apagouComA), `(6b): apagar esperando A (gravada B) deveria ser recusado, veio “${frase(apagouComA) || "passou"}”.`);
  linhas = await lerP();
  afirmar(linhas.length === 1, "(6b): a recusa do apagar não podia apagar nada.");
  const apagouComB = await semRejeicaoSolta(db.transaction((tx) => apagarContagemNaTransacao(tx, queimaId, B)));
  afirmar(apagouComB.ok && apagouComB.valor.apagou, `(6b): apagar esperando B deveria passar — ${String(!apagouComB.ok && apagouComB.erro)}`);
  linhas = await lerP();
  afirmar(linhas.length === 0, `(6b): depois de apagar, nenhuma linha — veio ${JSON.stringify(linhas)}.`);
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

// (9) "Recebi agora" × "Lançar na Venda" pedindo a MESMA peça, nos dois sentidos: 3 P contadas, os dois
// pedem 2 P. Quem chega depois espera a trava da queima, relê e recusa; Σ ativa de P = 2, um vínculo.
// (9a) o "Recebi" trava primeiro (o "Lançar" recusa com o que falta); (9b) o "Lançar" trava primeiro —
// desde o quick 261005-2yu, o "Recebi" de uma folha aberta antes da venda nova recusa pela TELA VELHA
// (cita a venda), não mais por "só faltam 1 P". O "Lançar na Venda" não manda retrato (fora dos avisos).
async function provarRecebiXLancarMesmaPeca(conexao: Client, observador: Client): Promise<void> {
  console.log("    (9a) “Recebi agora” × “Lançar na Venda” na mesma peça (Recebi primeiro, 2 P e 2 P de 3 P)...");
  let queimaId = await semearQueima(conexao, so(3));
  let primeira = await primeiraTravaEPara(queimaId, (tx) => cobrar(tx, queimaId, so(2)));
  const lancarDepois = semRejeicaoSolta(db.transaction((tx) => lancar(tx, queimaId, so(2))));
  await esperarAlguemNaTrava(observador, "(9a)");
  primeira.soltar();
  let [a, b] = await Promise.all([primeira.desfecho, lancarDepois]);
  guardarVenda(a);
  guardarVenda(b);
  afirmar(a.ok, `(9a): o “Recebi agora” deveria gravar — ${String(!a.ok && a.erro)}`);
  afirmar(
    !b.ok && b.erro instanceof RecusaDasQueimas,
    "(9a): o “Lançar na Venda” sobreposto deveria ser RECUSADO — ele passou e a soma lançada passou das externas.",
  );
  afirmar(
    frase(b) === "Desta queima só faltam 1 P para cobrar — diminua as linhas de queima externa e lance de novo.",
    `(9a): a recusa deveria dizer o que falta (1 P), disse “${frase(b)}”.`,
  );
  let lista = await vinculos(conexao, queimaId);
  afirmar(lista.length === 1 && somaAtiva(lista).p === 2, `(9a): Σ ativa de P deveria ser 2 num vínculo, veio ${JSON.stringify(lista)}.`);

  console.log("    (9b) “Lançar na Venda” × “Recebi agora” na mesma peça (Lançar primeiro)...");
  queimaId = await semearQueima(conexao, so(3));
  primeira = await primeiraTravaEPara(queimaId, (tx) => lancar(tx, queimaId, so(2)));
  const recebiDepois = semRejeicaoSolta(db.transaction((tx) => cobrar(tx, queimaId, so(2))));
  await esperarAlguemNaTrava(observador, "(9b)");
  primeira.soltar();
  [a, b] = await Promise.all([primeira.desfecho, recebiDepois]);
  guardarVenda(a);
  guardarVenda(b);
  afirmar(a.ok, `(9b): o “Lançar na Venda” deveria gravar — ${String(!a.ok && a.erro)}`);
  afirmar(
    telaMudou(b) && a.ok && frase(b).includes(`venda nº ${a.valor.numero}`),
    `(9b): o “Recebi agora” sobreposto deveria ser recusado pela tela velha citando a venda nova, veio “${frase(b) || "passou"}”.`,
  );
  lista = await vinculos(conexao, queimaId);
  afirmar(lista.length === 1 && somaAtiva(lista).p === 2, `(9b): Σ ativa de P deveria ser 2 num vínculo, veio ${JSON.stringify(lista)}.`);
}

// (10) "Recebi agora" 1 P × "Lançar na Venda" 2 P de 3 P, sobrepostos: as partes cabem juntas — os dois
// passam, dois vínculos, e a Σ ativa de P é exatamente 3 (= externas).
async function provarRecebiXLancarPartesQueCabem(conexao: Client, observador: Client): Promise<void> {
  console.log("    (10) “Recebi agora” 1 P × “Lançar na Venda” 2 P de 3 P (cabem juntas)...");
  const queimaId = await semearQueima(conexao, so(3));
  const primeira = await primeiraTravaEPara(queimaId, (tx) => cobrar(tx, queimaId, so(1)));
  const segunda = semRejeicaoSolta(db.transaction((tx) => lancar(tx, queimaId, so(2))));
  await esperarAlguemNaTrava(observador, "(10)");
  primeira.soltar();
  const [a, b] = await Promise.all([primeira.desfecho, segunda]);
  guardarVenda(a);
  guardarVenda(b);
  afirmar(a.ok && b.ok, `(10): os dois deveriam passar — ${String(!a.ok ? a.erro : !b.ok ? b.erro : "")}`);
  const lista = await vinculos(conexao, queimaId);
  afirmar(
    lista.length === 2 && somaAtiva(lista).p === 3,
    `(10): deveriam ser dois vínculos somando 3 P (= externas), veio ${JSON.stringify(lista)}.`,
  );
}

// (11) "Recebi agora" (trava e para) × EXCLUIR A QUEIMA pela ação (`excluirQueimaNaTransacao`, quick
// 261005-2yu, 06.4-WR-03), de uma tela que não mostrava venda nenhuma (`[]`): a exclusão espera a trava,
// vê a venda nova e é RECUSADA citando o número — a queima e o vínculo continuam. Excluir com a venda vista
// (`[nº]`) passa: o vínculo some (cascade) e a venda CONTINUA em `documentos`.
async function provarExcluirQueimaComVendaNova(conexao: Client, observador: Client): Promise<void> {
  console.log("    (11) “Recebi agora” × excluir a queima por uma tela que não via a venda...");
  const queimaId = await semearQueima(conexao, so(3));
  const primeira = await primeiraTravaEPara(queimaId, (tx) => cobrar(tx, queimaId, so(2)));
  const exclusao = semRejeicaoSolta(db.transaction((tx) => excluirQueimaNaTransacao(tx, queimaId, [])));
  await esperarAlguemNaTrava(observador, "(11)");
  primeira.soltar();
  const [a, b] = await Promise.all([primeira.desfecho, exclusao]);
  guardarVenda(a);
  afirmar(a.ok, `(11): a cobrança deveria gravar — ${String(!a.ok && a.erro)}`);
  afirmar(
    telaMudou(b) && frase(b).includes(`venda nº ${a.valor.numero}`),
    `(11): a exclusão deveria ser recusada citando a venda nº ${a.valor.numero}, veio “${frase(b) || "passou"}”.`,
  );
  const queima = await conexao.query<{ total: string }>("select count(*)::text as total from queimas where id = $1", [queimaId]);
  afirmar(queima.rows[0]?.total === "1", "(11): a queima deveria continuar depois da recusa.");
  afirmar((await vinculos(conexao, queimaId)).length === 1, "(11): o vínculo deveria continuar depois da recusa.");

  const comVista = await semRejeicaoSolta(
    db.transaction((tx) => excluirQueimaNaTransacao(tx, queimaId, [a.valor.numero])),
  );
  afirmar(comVista.ok, `(11): excluir com a venda vista deveria passar — ${String(!comVista.ok && comVista.erro)}`);
  const ligados = await conexao.query<{ total: string }>("select count(*)::text as total from queima_vendas where queima_id = $1", [
    queimaId,
  ]);
  const venda = await conexao.query<{ total: string }>("select count(*)::text as total from documentos where id = $1", [
    a.valor.documentoId,
  ]);
  afirmar(ligados.rows[0]?.total === "0", "(11): o vínculo deveria sumir com a queima (cascade).");
  afirmar(venda.rows[0]?.total === "1", "(11): a venda deveria CONTINUAR em documentos.");
}

// (12) "Recebi agora" REPETIDO depois de uma resposta perdida (quick 261005-2yu, 06.4-WR-02): 5 P. A folha
// abriu sem venda (`[]`) e as vistas ficam congeladas. O primeiro toque grava a venda nº N (a resposta se
// perde); o segundo toque, da MESMA folha (`[]`), é RECUSADO citando o nº N — nunca uma segunda venda
// paga das mesmas peças; Σ ativa P = 2. Uma folha relida (`[N]`) cobra 2 P de novo de propósito: Σ = 4.
async function provarRecebiRepetido(conexao: Client): Promise<void> {
  console.log("    (12) “Recebi agora” repetido da mesma folha depois de uma resposta perdida...");
  const queimaId = await semearQueima(conexao, so(5));
  const primeiro = await semRejeicaoSolta(db.transaction((tx) => cobrar(tx, queimaId, so(2), [])));
  guardarVenda(primeiro);
  afirmar(primeiro.ok, `(12): o primeiro toque deveria gravar — ${String(!primeiro.ok && primeiro.erro)}`);
  const repetido = await semRejeicaoSolta(db.transaction((tx) => cobrar(tx, queimaId, so(2), [])));
  guardarVenda(repetido);
  afirmar(
    telaMudou(repetido) && frase(repetido).includes(`venda nº ${primeiro.valor.numero}`),
    `(12): o toque repetido deveria ser recusado citando a venda nº ${primeiro.valor.numero}, veio “${frase(repetido) || "passou"}”.`,
  );
  let lista = await vinculos(conexao, queimaId);
  afirmar(somaAtiva(lista).p === 2 && lista.length === 1, `(12): Σ ativa de P deveria ser 2 num vínculo, veio ${JSON.stringify(lista)}.`);
  const relida = await semRejeicaoSolta(db.transaction((tx) => cobrar(tx, queimaId, so(2), [primeiro.valor.numero])));
  guardarVenda(relida);
  afirmar(relida.ok, `(12): com a folha relida, cobrar 2 P de novo deveria passar — ${String(!relida.ok && relida.erro)}`);
  lista = await vinculos(conexao, queimaId);
  afirmar(somaAtiva(lista).p === 4 && lista.length === 2, `(12): Σ ativa de P deveria ser 4 em dois vínculos, veio ${JSON.stringify(lista)}.`);
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

    console.log("  Corridas das Queimas (06.4-04 e 06.4-05, D-07; quick 261005-2yu), com transações sobrepostas de verdade:");
    // Cada caso semeia a sua queima: uma falha não contamina o seguinte. Roda TODOS e junta as falhas
    // (quick 261005-2yu) — parar no primeiro escondia quantos casos uma regressão derruba.
    const casos: [string, () => Promise<void>][] = [
      ["(1)", () => provarMesmaPeca(conexao, observador)],
      ["(2)", () => provarPartesQueCabem(conexao, observador)],
      ["(3)", () => provarPisoSobCorrida(conexao, observador)],
      ["(4)", () => provarApagarSobCorrida(conexao, observador)],
      ["(5)", () => provarExcluirQueimaSobCorrida(conexao, observador, outra)],
      ["(6)", () => provarDuasGravacoes(conexao, observador)],
      ["(6b)", () => provarRetratoVelhoDaContagem(conexao)],
      ["(7)/(8)", () => provarCanceladaLiberaEIdempotencia(conexao)],
      ["(9)", () => provarRecebiXLancarMesmaPeca(conexao, observador)],
      ["(10)", () => provarRecebiXLancarPartesQueCabem(conexao, observador)],
      ["(11)", () => provarExcluirQueimaComVendaNova(conexao, observador)],
      ["(12)", () => provarRecebiRepetido(conexao)],
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

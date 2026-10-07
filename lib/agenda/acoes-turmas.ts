"use server";

// Ações da Agenda — as TURMAS: lançar, editar, marcar mais semanas, desativar, entrar e sair
// (D-24/P10, plano 06.5-27 — saíram de `acoes.ts`, que agora é o índice).

import { and, eq, gt, isNull, max } from "drizzle-orm";

import { db } from "@/db";
import { eventos, mensalidades, turmaAlunos, turmas } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { FRASE_CLIENTE_NAO_EXISTE } from "@/lib/clientes/textos";
import { codigoDoErroPostgres } from "@/lib/erro/postgres";
import { hojeEmBrasilia } from "@/lib/financeiro/formato";
import { formatarDiaMes } from "@/lib/producao/calendario";

import { datasDaTurmaNoMes, fechadosEntre } from "./consultas";
import {
  esquemaDesativarTurma,
  esquemaEditarTurma,
  esquemaEntrarNaTurma,
  esquemaLancarTurma,
  esquemaMarcarMaisSemanas,
  esquemaSairDaTurma,
} from "./esquemas";
import {
  garantirMensalidadesDoMes,
  inscreverAlunoDaquiParaFrente,
  inscreverAlunosNasDatas,
  marcarDatasDaTurma,
  RecusaDaAgenda,
  tirarAlunoDasDatasFuturas,
  travarDatasFuturasDaTurma,
  apagarDatasDaTurma,
  contarPerdasAoDesativar,
  perdasCobertas,
  travarCliente,
  travarTurma,
  vendaAtivaEmDataFutura,
  type PerdasAoDesativar,
} from "./gravacao";
import { mesDaData, valorProporcional, vencimentoDaMensalidade } from "./mensalidade";
import { chaveDoEnvio, umaVezPorEnvio } from "./envios";
import {
  aPartirDeParaEstender,
  datasDaTurma,
  datasEmDiaFechado,
  type FechadoDoDia,
} from "./turma";
import {
  FRASE_FALHA_AO_DESATIVAR_TURMA,
  FRASE_FALHA_AO_ENTRAR_NA_TURMA,
  FRASE_FALHA_AO_LANCAR,
  FRASE_FALHA_AO_MARCAR_SEMANAS,
  FRASE_FALHA_AO_SAIR_DA_TURMA,
  FRASE_FALHA_AO_SALVAR_TURMA,
  FRASE_LANCAMENTO_NAO_EXISTE,
  FRASE_TURMA_JA_DESATIVADA,
  fraseDesativarComVendaAtiva,
  fraseJaEstaNaTurma,
  fraseJaNaoEstaNaTurma,
} from "./textos";

import {
  errosPorCampo,
  primeiraMensagemDeErro,
  type ResultadoDeAcao,
  type ResultadoDoLancamento,
} from "./acoes-comum";
import { revalidarTelasDaAgenda } from "./acoes-servidor";

export type TurmaLancada = {
  turmaId: string;
  // Quantas datas foram marcadas e a primeira delas (a semana para onde a tela vai).
  datas: number;
  primeira: string;
  // As datas marcadas que caem num dia fechado (D-13), para o toast — marcadas mesmo assim.
  emDiaFechado: FechadoDoDia[];
};

// "Lançar turma" (AGE-03, D-03). `exigirUsuario()` primeiro (T-05-28), Zod no servidor (T-05-29:
// semanas 1..52, vencimento 1..28, vagas 1..999). NUMA transação: a turma e as N datas
// (`datasDaTurma` — a primeira ocorrência do dia da semana a partir de "Primeira aula a partir de",
// uma por semana), com horário, vagas e `publico` copiados da turma e `on conflict (turma_id, data)
// do nothing`. NÃO pula nem cancela dia fechado (D-13): lê os fechados do intervalo e devolve as
// datas que caem neles, para o toast avisar. Sem aluno nenhum: os alunos entram pela ficha (plano
// 07) e nenhuma mensalidade nasce aqui.
export async function lancarTurma(entradaBruta: unknown): Promise<ResultadoDoLancamento<TurmaLancada>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaLancarTurma.safeParse(entradaBruta);
  if (!resultado.success) {
    return {
      ok: false,
      erro: primeiraMensagemDeErro(resultado),
      campos: errosPorCampo(resultado.error.issues),
    };
  }
  const dados = resultado.data;
  // WR-06 (revisão B): a resposta perdida no celular não vira um segundo lançamento — `lib/agenda/envios.ts`.
  return umaVezPorEnvio(chaveDoEnvio(usuario.id, "lancarTurma", entradaBruta, dados), async () => {
    const datas = datasDaTurma({ diaDaSemana: dados.diaSemana, aPartirDe: dados.aPartirDe, semanas: dados.semanas });

    let lancada: Omit<TurmaLancada, "emDiaFechado">;
    try {
      lancada = await db.transaction(async (tx) => {
        const [turma] = await tx
          .insert(turmas)
          .values({
            nome: dados.nome,
            diaSemana: dados.diaSemana,
            inicio: dados.inicio,
            fim: dados.fim,
            vagas: dados.vagas,
            mensalidadeCentavos: dados.mensalidadeCentavos,
            diaVencimento: dados.diaVencimento,
            publica: dados.publica,
            criadoPor: usuario.id,
          })
          .returning({ id: turmas.id });
        const criadas = await marcarDatasDaTurma(
          tx,
          { id: turma.id, inicio: dados.inicio, fim: dados.fim, vagas: dados.vagas, publica: dados.publica },
          datas,
          usuario.id,
        );
        return { turmaId: turma.id, datas: criadas.length, primeira: datas[0] };
      });
    } catch (erro) {
      console.error(
        `Falha ao lançar a turma (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
        erro,
      );
      return { ok: false, erro: FRASE_FALHA_AO_LANCAR };
    }

    revalidarTelasDaAgenda({ publico: dados.publica });

    // Fora da transação e do `try` dela: a turma já está gravada — uma falha ao ler os fechados só
    // tira o aviso do toast (a tag "dia fechado" aparece no cartão de qualquer jeito).
    let emDiaFechado: FechadoDoDia[] = [];
    try {
      emDiaFechado = datasEmDiaFechado(datas, await fechadosEntre(datas[0], datas[datas.length - 1]));
    } catch (erro) {
      console.error("Falha ao ler os dias fechados depois de lançar a turma:", erro);
    }
    return { ok: true, dados: { ...lancada, emDiaFechado } };
  });
}

export type TurmaSalva = { mensalidadeMudou: boolean; datasAtualizadas: number };

// "Salvar turma" (D-03). `exigirUsuario()` primeiro (T-05-28), Zod no servidor. Sob a trava da
// TURMA: recusa a desativada; grava a turma e, nas datas com `data > hoje` (inclusive as canceladas — WR-02), o
// horário, as vagas e o público (hoje e o passado ficam como foram — Assumption A9). O nome não é
// copiado: as datas leem o nome da turma ao vivo. A mensalidade nova vale a partir do próximo mês,
// porque cada mensalidade copia o valor da turma ao nascer — e a guarda do Pitfall 6 (plano 07):
// ANTES de gravar o valor novo, na mesma transação, `garantirMensalidadesDoMes` faz nascer a do mês
// corrente desta turma com o valor ANTIGO, mesmo que ninguém tenha aberto a Agenda no mês.
export async function editarTurma(entradaBruta: unknown): Promise<ResultadoDoLancamento<TurmaSalva>> {
  await exigirUsuario();

  const resultado = esquemaEditarTurma.safeParse(entradaBruta);
  if (!resultado.success) {
    return {
      ok: false,
      erro: primeiraMensagemDeErro(resultado),
      campos: errosPorCampo(resultado.error.issues),
    };
  }
  const dados = resultado.data;
  const hoje = hojeEmBrasilia(new Date());

  let publico = dados.publica;
  let salva: TurmaSalva;
  try {
    salva = await db.transaction(async (tx): Promise<TurmaSalva> => {
      const turma = await travarTurma(tx, dados.turmaId);
      if (!turma) {
        throw new RecusaDaAgenda(FRASE_LANCAMENTO_NAO_EXISTE);
      }
      if (!turma.ativa) {
        throw new RecusaDaAgenda(FRASE_TURMA_JA_DESATIVADA);
      }
      // Sai do site quem deixou de ser pública: revalida se ela era OU passou a ser.
      publico = turma.publica || dados.publica;
      await garantirMensalidadesDoMes(tx, mesDaData(hoje), turma.id);
      await tx
        .update(turmas)
        .set({
          nome: dados.nome,
          inicio: dados.inicio,
          fim: dados.fim,
          vagas: dados.vagas,
          mensalidadeCentavos: dados.mensalidadeCentavos,
          diaVencimento: dados.diaVencimento,
          publica: dados.publica,
        })
        .where(eq(turmas.id, turma.id));
      // WR-02 (revisão da Fase 5): as datas futuras CANCELADAS também acompanham a turma. Antes elas
      // ficavam com o horário, as vagas e o `publico` de quando foram canceladas, e "Desfazer
      // cancelamento" trazia de volta o velho — uma turma que virou privada reaparecia no site. A trava
      // de cada data (a mesma de `cancelarData`) serializa os dois. A contagem do toast segue sendo a
      // das datas de pé.
      const atualizadas = await tx
        .update(eventos)
        .set({ inicio: dados.inicio, fim: dados.fim, vagas: dados.vagas, publico: dados.publica })
        .where(and(eq(eventos.turmaId, turma.id), gt(eventos.data, hoje)))
        .returning({ id: eventos.id, canceladoEm: eventos.canceladoEm });
      return {
        mensalidadeMudou: turma.mensalidadeCentavos !== dados.mensalidadeCentavos,
        datasAtualizadas: atualizadas.filter((data) => data.canceladoEm === null).length,
      };
    });
  } catch (erro) {
    if (erro instanceof RecusaDaAgenda) {
      revalidarTelasDaAgenda({ publico: false });
      return { ok: false, erro: erro.frase };
    }
    console.error(
      `Falha ao salvar a turma (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR_TURMA };
  }

  revalidarTelasDaAgenda({ publico });
  return { ok: true, dados: salva };
}

export type SemanasMarcadas = { datas: number; ate: string | null; alunosInscritos: number };

// "Marcar mais N semanas" (D-03, AGE-03 · adjacency/idempotency/concurrency). `exigirUsuario()`
// primeiro, Zod (1..52). Sob a trava da TURMA (a mesma de "entrar na turma", plano 07): começa em
// `aPartirDeParaEstender(última data, hoje)` — o dia seguinte à última data marcada, ou hoje se ela
// já passou; a última nunca é marcada de novo —, grava com `on conflict (turma_id, data) do nothing`
// e, NA MESMA transação, inscreve os alunos ativos nas datas criadas (Pitfall 5). Dois gestores ao
// mesmo tempo: o segundo espera a trava, lê a última data nova e continua depois dela — nenhuma data
// se repete.
export async function marcarMaisSemanas(entradaBruta: unknown): Promise<ResultadoDoLancamento<SemanasMarcadas>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaMarcarMaisSemanas.safeParse(entradaBruta);
  if (!resultado.success) {
    return {
      ok: false,
      erro: primeiraMensagemDeErro(resultado),
      campos: errosPorCampo(resultado.error.issues),
    };
  }
  const dados = resultado.data;
  const hoje = hojeEmBrasilia(new Date());

  let publico = false;
  let marcadas: SemanasMarcadas;
  try {
    marcadas = await db.transaction(async (tx): Promise<SemanasMarcadas> => {
      const turma = await travarTurma(tx, dados.turmaId);
      if (!turma) {
        throw new RecusaDaAgenda(FRASE_LANCAMENTO_NAO_EXISTE);
      }
      if (!turma.ativa) {
        throw new RecusaDaAgenda(FRASE_TURMA_JA_DESATIVADA);
      }
      publico = turma.publica;
      const [ultima] = await tx
        .select({ data: max(eventos.data) })
        .from(eventos)
        .where(eq(eventos.turmaId, turma.id));
      const datas = datasDaTurma({
        diaDaSemana: turma.diaSemana,
        aPartirDe: aPartirDeParaEstender(ultima?.data ?? null, hoje),
        semanas: dados.semanas,
      });
      const criadas = await marcarDatasDaTurma(tx, turma, datas, usuario.id);
      const alunosInscritos = await inscreverAlunosNasDatas(
        tx,
        turma.id,
        criadas.map((criada) => criada.id),
        usuario.id,
      );
      return {
        datas: criadas.length,
        ate: criadas.length > 0 ? criadas[criadas.length - 1].data : null,
        alunosInscritos,
      };
    });
  } catch (erro) {
    if (erro instanceof RecusaDaAgenda) {
      revalidarTelasDaAgenda({ publico: false });
      return { ok: false, erro: erro.frase };
    }
    console.error(
      `Falha ao marcar mais semanas (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_MARCAR_SEMANAS };
  }

  revalidarTelasDaAgenda({ publico });
  return { ok: true, dados: marcadas };
}

export type TurmaDesativada =
  | { situacao: "desativada"; datasTiradas: number }
  // WR-04: nada gravado — o que sai agora passou do que a confirmação mostrou; a tela mostra estes números.
  | { situacao: "confirmar"; perdas: PerdasAoDesativar };

// "Desativar turma" (D-03) — NUNCA apaga a turma (`revoke delete` em `turmas`), o que já aconteceu
// nem as mensalidades nascidas (T-05-31). `exigirUsuario()` primeiro. Sob a trava da TURMA:
// - não existe / já desativada → a frase;
// - alguma inscrição de data futura ligada a venda NÃO cancelada → recusa com a data e o número da
//   venda (D-08: a venda só se desfaz no Caixa);
// - tira as datas com `data > hoje` e as inscrições delas (Assumption A14 — não as cancela, para a
//   semana não encher de datas riscadas; as reposições voltam a ser crédito por derivação) e grava
//   `ativa = false`, `desativada_em`, `desativada_por`. Hoje e o passado ficam.
// - WR-04 (revisão): com as datas e as inscrições delas TRAVADAS (`travarDatasFuturasDaTurma`, que também
//   reconfere a venda ativa — WR-01), reconta o que sai; se passou do que a confirmação mostrou
//   (`confirmado`), não grava e devolve os números de agora (molde de `cancelarData`).
export async function desativarTurma(entradaBruta: unknown): Promise<ResultadoDeAcao<TurmaDesativada>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaDesativarTurma.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const hoje = hojeEmBrasilia(new Date());

  let publico = false;
  let desativada: TurmaDesativada;
  try {
    desativada = await db.transaction(async (tx): Promise<TurmaDesativada> => {
      const turma = await travarTurma(tx, resultado.data.turmaId);
      if (!turma) {
        throw new RecusaDaAgenda(FRASE_LANCAMENTO_NAO_EXISTE);
      }
      if (!turma.ativa) {
        throw new RecusaDaAgenda(FRASE_TURMA_JA_DESATIVADA);
      }
      publico = turma.publica;
      const venda = await vendaAtivaEmDataFutura(tx, turma.id, hoje);
      if (venda !== null) {
        throw new RecusaDaAgenda(fraseDesativarComVendaAtiva(formatarDiaMes(venda.data), venda.numero));
      }
      const travadas = await travarDatasFuturasDaTurma(tx, turma.id, hoje);
      const perdas = await contarPerdasAoDesativar(tx, turma.id, hoje);
      if (!perdasCobertas(perdas, resultado.data.confirmado ?? null)) {
        return { situacao: "confirmar", perdas };
      }
      const datasTiradas = await apagarDatasDaTurma(tx, turma.id, hoje, travadas);
      await tx
        .update(turmas)
        .set({ ativa: false, desativadaEm: new Date(), desativadaPor: usuario.id })
        .where(eq(turmas.id, turma.id));
      return { situacao: "desativada", datasTiradas };
    });
  } catch (erro) {
    if (erro instanceof RecusaDaAgenda) {
      // A frase fica no diálogo; a folha se atualiza ao fechá-lo (molde de "Tirar da lista").
      return { ok: false, erro: erro.frase };
    }
    console.error(
      `Falha ao desativar a turma (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_DESATIVAR_TURMA };
  }

  // As datas futuras saem do site.
  if (desativada.situacao === "desativada") {
    revalidarTelasDaAgenda({ publico });
  }
  return { ok: true, dados: desativada };
}

// O que "entrar na turma" decidiu sobre a mensalidade do mês da entrada (o toast diz qual):
// - `proporcional`: entrou no meio — {restantes} de {noMes} aulas, o valor já arredondado;
// - `cheia`: entrou antes da primeira aula do mês (ou no dia dela);
// - `nenhuma`: não sobra aula da turma no mês — a mensalidade começa no mês seguinte (D-02);
// - `ja-existia`: a mensalidade deste mês já tinha nascido (voltou no mesmo mês em que saiu) — a chave
//   única não deixa nascer a segunda, e a que existia continua como estava.
export type EntradaNaTurma = {
  nome: string;
  // "AAAA-MM" — o mês da entrada.
  mes: string;
  mensalidade:
    | { caso: "proporcional"; valorCentavos: number; restantes: number; noMes: number }
    | { caso: "cheia"; valorCentavos: number }
    | { caso: "nenhuma" }
    | { caso: "ja-existia" };
};

// Entrar na turma pela ficha (AGE-07). `exigirUsuario()` primeiro (T-05-32), Zod com só os dois ids
// (T-05-33). NUMA transação, na ordem global de travas TURMA → CLIENTE:
// - trava a TURMA (a mesma de "Marcar mais semanas" — Pitfall 5: entrar e estender ao mesmo tempo
//   terminam com a pessoa em todas as datas novas) e recusa turma inexistente ou desativada;
// - trava o CLIENTE (`for no key update`);
// - grava o vínculo com `entrou_em = hoje`; o índice parcial `turma_alunos_ativo_uk` não deixa nascer o
//   segundo vínculo ativo (dois toques, duas abas) — nada inserido → "{nome} já está nesta turma";
// - inscreve a pessoa como `aluno` nas datas de hoje em diante, não canceladas;
// - lê as datas NÃO canceladas da turma no mês e decide a mensalidade pelo módulo puro
//   (`valorProporcional` — inteiros, meio para cima); se houver, grava com
//   `on conflict (turma_id, cliente_id, mes) do nothing`, com o vencimento no dia da turma.
// O valor, as datas e o vencimento são todos lidos aqui, sob a trava — nada vem da tela.
export async function entrarNaTurma(entradaBruta: unknown): Promise<ResultadoDeAcao<EntradaNaTurma>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaEntrarNaTurma.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;
  const hoje = hojeEmBrasilia(new Date());
  const mes = mesDaData(hoje);

  let publico = false;
  let entrada: EntradaNaTurma;
  try {
    entrada = await db.transaction(async (tx): Promise<EntradaNaTurma> => {
      const turma = await travarTurma(tx, dados.turmaId);
      if (!turma) {
        throw new RecusaDaAgenda(FRASE_LANCAMENTO_NAO_EXISTE);
      }
      if (!turma.ativa) {
        throw new RecusaDaAgenda(FRASE_TURMA_JA_DESATIVADA);
      }
      publico = turma.publica;
      const cliente = await travarCliente(tx, dados.clienteId);
      if (!cliente) {
        throw new RecusaDaAgenda(FRASE_CLIENTE_NAO_EXISTE);
      }

      const [vinculo] = await tx
        .insert(turmaAlunos)
        .values({ turmaId: turma.id, clienteId: cliente.id, entrouEm: hoje })
        .onConflictDoNothing()
        .returning({ id: turmaAlunos.id });
      if (!vinculo) {
        throw new RecusaDaAgenda(fraseJaEstaNaTurma(cliente.nome));
      }

      await inscreverAlunoDaquiParaFrente(tx, {
        turmaId: turma.id,
        clienteId: cliente.id,
        hoje,
        criadoPor: usuario.id,
      });

      const valor = valorProporcional({
        valorCentavos: turma.mensalidadeCentavos,
        datasDoMes: await datasDaTurmaNoMes(tx, turma.id, mes),
        entrouEm: hoje,
      });
      if (valor.tipo === "nenhuma") {
        return { nome: cliente.nome, mes, mensalidade: { caso: "nenhuma" } };
      }
      const [criada] = await tx
        .insert(mensalidades)
        .values({
          turmaId: turma.id,
          clienteId: cliente.id,
          mes: `${mes}-01`,
          valorCentavos: valor.valorCentavos,
          aulasRestantes: valor.tipo === "proporcional" ? valor.restantes : null,
          aulasNoMes: valor.tipo === "proporcional" ? valor.noMes : null,
          vencimento: vencimentoDaMensalidade(turma.diaVencimento, mes),
        })
        .onConflictDoNothing({ target: [mensalidades.turmaId, mensalidades.clienteId, mensalidades.mes] })
        .returning({ id: mensalidades.id });
      if (!criada) {
        return { nome: cliente.nome, mes, mensalidade: { caso: "ja-existia" } };
      }
      return {
        nome: cliente.nome,
        mes,
        mensalidade:
          valor.tipo === "proporcional"
            ? {
                caso: "proporcional",
                valorCentavos: valor.valorCentavos,
                restantes: valor.restantes,
                noMes: valor.noMes,
              }
            : { caso: "cheia", valorCentavos: valor.valorCentavos },
      };
    });
  } catch (erro) {
    if (erro instanceof RecusaDaAgenda) {
      // A tela estava velha (já na turma, turma desativada): ela se atualiza junto com a frase.
      revalidarTelasDaAgenda({ publico: false });
      return { ok: false, erro: erro.frase };
    }
    console.error(
      `Falha ao entrar na turma (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_ENTRAR_NA_TURMA };
  }

  // As vagas da turma no site mudam (D-12, plano 15).
  revalidarTelasDaAgenda({ publico });
  return { ok: true, dados: entrada };
}

export type SaidaDaTurma = { nome: string; aulasTiradas: number };

// Sair da turma pela ficha (AGE-07), depois da confirmação. `exigirUsuario()` primeiro. Sob as travas
// TURMA → CLIENTE: grava `saiu_em = hoje` no vínculo ativo (NUNCA apaga o vínculo — `revoke delete`)
// e tira a pessoa só das inscrições `aluno` sem presença nas datas depois de hoje
// (`tirarAlunoDasDatasFuturas`). O passado, a aula de hoje, as reposições marcadas e a mensalidade já
// nascida ficam. Vínculo ativo inexistente → "{nome} já não está nesta turma". Turma desativada não
// recusa: sair dela não tira nada que não devesse.
export async function sairDaTurma(entradaBruta: unknown): Promise<ResultadoDeAcao<SaidaDaTurma>> {
  await exigirUsuario();

  const resultado = esquemaSairDaTurma.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;
  const hoje = hojeEmBrasilia(new Date());

  let publico = false;
  let saida: SaidaDaTurma;
  try {
    saida = await db.transaction(async (tx): Promise<SaidaDaTurma> => {
      const turma = await travarTurma(tx, dados.turmaId);
      if (!turma) {
        throw new RecusaDaAgenda(FRASE_LANCAMENTO_NAO_EXISTE);
      }
      publico = turma.publica;
      const cliente = await travarCliente(tx, dados.clienteId);
      if (!cliente) {
        throw new RecusaDaAgenda(FRASE_CLIENTE_NAO_EXISTE);
      }
      const saiu = await tx
        .update(turmaAlunos)
        .set({ saiuEm: hoje })
        .where(
          and(eq(turmaAlunos.turmaId, turma.id), eq(turmaAlunos.clienteId, cliente.id), isNull(turmaAlunos.saiuEm)),
        )
        .returning({ id: turmaAlunos.id });
      if (saiu.length === 0) {
        throw new RecusaDaAgenda(fraseJaNaoEstaNaTurma(cliente.nome));
      }
      const aulasTiradas = await tirarAlunoDasDatasFuturas(tx, { turmaId: turma.id, clienteId: cliente.id, hoje });
      return { nome: cliente.nome, aulasTiradas };
    });
  } catch (erro) {
    if (erro instanceof RecusaDaAgenda) {
      revalidarTelasDaAgenda({ publico: false });
      return { ok: false, erro: erro.frase };
    }
    console.error(
      `Falha ao sair da turma (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_SAIR_DA_TURMA };
  }

  revalidarTelasDaAgenda({ publico });
  return { ok: true, dados: saida };
}

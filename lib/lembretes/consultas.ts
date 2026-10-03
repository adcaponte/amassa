// As leituras dos Lembretes (Fase 06.3). SEM a diretiva de Server Action: são chamadas por Server
// Components que já passaram pela cerca de `/gestao` (o layout chama `exigirUsuario()`) — uma
// exportação de arquivo com a diretiva viraria endpoint chamável pelo navegador, e
// `npm run verificar-acoes` reprovaria as leituras por não começarem por `exigirUsuario()`.
//
// Os nomes vêm de `usuarios` por `leftJoin` SEM filtrar `ativo` (molde `listarTarefasDaAbertura`):
// quem foi desativado continua nomeado nos lembretes antigos. Nada aqui usa a data corrente do
// Postgres (ele roda em UTC) — "hoje" é sempre parâmetro, vindo da página.
import { and, asc, desc, eq, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { lembretes, usuarios } from "@/db/schema";

import { LIMITE_DE_FEITOS_NO_INICIO, type FiltrosDosLembretes } from "./lista";

// Um lembrete como a tela o mostra. Instantes em texto ISO (atravessam a fronteira servidor →
// cliente sem virar `Date` de um lado e texto do outro); `paraQuando` é o dia civil `AAAA-MM-DD`.
export type LembreteDaTela = {
  id: string;
  texto: string;
  paraQuando: string | null;
  quem: string | null;
  quemNome: string | null;
  criadoEm: string;
  criadoPorNome: string | null;
  feitoEm: string | null;
  feitoPorNome: string | null;
};

// O que o bloco do Início recebe — um OBJETO, para os planos 03 e 04 acrescentarem campos (os
// feitos recentes, a lista de pessoas) sem mudar a assinatura de `ListaDoInicio`.
export type LembretesDoInicio = {
  abertos: LembreteDaTela[];
  // Os `LIMITE_DE_FEITOS_NO_INICIO` (5, D-02) feitos mais recentes, `feito_em desc, id desc` — a
  // sanfona "Feitos" do Início. Sem prazo de sumir: o feito antigo só sai daqui quando outros mais
  // novos o empurram.
  feitosRecentes: LembreteDaTela[];
  // Quantos feitos existem ao todo: o "Feitos (N)" e o "e mais N em “ver todos”".
  totalDeFeitos: number;
};

// O Início carrega TODOS os abertos até este teto (não só os 6 visíveis): a contagem do cabeçalho
// e o "e mais N" precisam continuar certos depois de toques otimistas (A5 da pesquisa).
export const TETO_DE_ABERTOS_NO_INICIO = 500;

const pessoaDoLembrete = alias(usuarios, "pessoa_do_lembrete");
const autoriaDoLembrete = alias(usuarios, "autoria_do_lembrete");
const autoriaDoFeito = alias(usuarios, "autoria_do_feito");

function instanteEmTexto(instante: Date | null): string | null {
  return instante === null ? null : instante.toISOString();
}

// A mesma seleção para toda leitura que devolve `LembreteDaTela`: os três nomes pelos mesmos
// `alias`, sem filtrar `ativo`.
function selecionarLembretes() {
  return db
    .select({
      id: lembretes.id,
      texto: lembretes.texto,
      paraQuando: lembretes.paraQuando,
      quem: lembretes.quem,
      quemNome: pessoaDoLembrete.nome,
      criadoEm: lembretes.criadoEm,
      criadoPorNome: autoriaDoLembrete.nome,
      feitoEm: lembretes.feitoEm,
      feitoPorNome: autoriaDoFeito.nome,
    })
    .from(lembretes)
    .leftJoin(pessoaDoLembrete, eq(lembretes.quem, pessoaDoLembrete.id))
    .leftJoin(autoriaDoLembrete, eq(lembretes.criadoPor, autoriaDoLembrete.id))
    .leftJoin(autoriaDoFeito, eq(lembretes.feitoPor, autoriaDoFeito.id));
}

type LinhaSelecionada = Awaited<ReturnType<typeof selecionarLembretes>>[number];

function paraATela(linha: LinhaSelecionada): LembreteDaTela {
  return {
    id: linha.id,
    texto: linha.texto,
    paraQuando: linha.paraQuando,
    quem: linha.quem,
    quemNome: linha.quemNome,
    criadoEm: linha.criadoEm.toISOString(),
    criadoPorNome: linha.criadoPorNome,
    feitoEm: instanteEmTexto(linha.feitoEm),
    feitoPorNome: linha.feitoPorNome,
  };
}

// Os abertos (`feito_em is null`) na ordem do BRIEFING §3: prazo crescente (vencidos primeiro), os
// sem data por último, empate por `criado_em` e, por fim, `id` (desempate estável). E, no mesmo
// passo, os feitos mais recentes e quantos feitos há (plano 06.3-04).
export async function lerLembretesDoInicio(): Promise<LembretesDoInicio> {
  const [abertos, feitosRecentes, [totais]] = await Promise.all([
    selecionarLembretes()
      .where(isNull(lembretes.feitoEm))
      .orderBy(
        sql`${lembretes.paraQuando} asc nulls last`,
        asc(lembretes.criadoEm),
        asc(lembretes.id),
      )
      .limit(TETO_DE_ABERTOS_NO_INICIO),
    selecionarLembretes()
      .where(isNotNull(lembretes.feitoEm))
      .orderBy(desc(lembretes.feitoEm), desc(lembretes.id))
      .limit(LIMITE_DE_FEITOS_NO_INICIO),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(lembretes)
      .where(isNotNull(lembretes.feitoEm)),
  ]);

  return {
    abertos: abertos.map(paraATela),
    feitosRecentes: feitosRecentes.map(paraATela),
    totalDeFeitos: totais?.total ?? 0,
  };
}

// "Ver todos" (`/gestao/lembretes`, plano 06.3-05, LMB-09): os filtros JÁ validados por
// `filtrosDaUrl` (puro, `./lista`) viram SQL — `situacao` decide `feito_em is null`/`is not null` e
// a ordem (abertos: a do briefing, igual à do Início; feitos: `feito_em desc, id desc`, igual à da
// sanfona); `quem` "todos" não filtra, "geral" é `quem is null` e um uuid vai por `eq` (parâmetro do
// Drizzle — nenhum texto da URL concatenado no SQL, T-06.3-22). `limit(quantos + 1)` no molde de
// Clientes (`lib/clientes/consultas.ts`): a linha a mais só diz que `haMais` e sai da lista. O teto de
// `quantos` (500) vem de `filtrosDaUrl` (T-06.3-24).
export type LembretesDaPagina = {
  linhas: LembreteDaTela[];
  haMais: boolean;
};

export async function listarLembretes(filtros: FiltrosDosLembretes): Promise<LembretesDaPagina> {
  const condicoes: SQL[] = [
    filtros.situacao === "feitos" ? isNotNull(lembretes.feitoEm) : isNull(lembretes.feitoEm),
  ];
  if (filtros.quem === "geral") {
    condicoes.push(isNull(lembretes.quem));
  } else if (filtros.quem !== "todos") {
    condicoes.push(eq(lembretes.quem, filtros.quem));
  }

  const ordem =
    filtros.situacao === "feitos"
      ? [desc(lembretes.feitoEm), desc(lembretes.id)]
      : [sql`${lembretes.paraQuando} asc nulls last`, asc(lembretes.criadoEm), asc(lembretes.id)];

  const linhas = await selecionarLembretes()
    .where(and(...condicoes))
    .orderBy(...ordem)
    .limit(filtros.quantos + 1);

  return {
    linhas: linhas.slice(0, filtros.quantos).map(paraATela),
    haMais: linhas.length > filtros.quantos,
  };
}

// Um lembrete como a tela o mostra, pelo id — ou `null` se ele não existe (outra pessoa o
// excluiu). As ações de `./acoes` devolvem a linha ATUAL por aqui: quem marcou e quando são do
// banco, nunca do aparelho.
export async function obterLembreteDaTela(id: string): Promise<LembreteDaTela | null> {
  const [linha] = await selecionarLembretes().where(eq(lembretes.id, id)).limit(1);
  return linha ? paraATela(linha) : null;
}

// Uma pessoa da casa como as pílulas e os chips a usam.
export type PessoaDaCasa = { id: string; nome: string };

// As pessoas que as pílulas de "De quem é o lembrete" oferecem — SEMPRE de `usuarios` com
// `ativo = true`, nunca nomes no código (cópia do molde `listarGestoresAtivos` de
// `lib/abertura/consultas.ts`, não import: a Abertura é módulo temporário). A ordem é a de
// CADASTRO (`criado_em`, desempate por `id`), não a alfabética: a posição de cada pessoa nesta
// lista decide a cor do chip (UI-D2, `corDaPessoa`), e as pílulas seguem a mesma ordem.
// Quem foi desativado sai daqui, mas continua nomeado nos lembretes antigos (o `leftJoin` de
// `lerLembretesDoInicio` não filtra `ativo`) — com o chip neutro.
export async function listarPessoasDaCasa(): Promise<PessoaDaCasa[]> {
  return db
    .select({ id: usuarios.id, nome: usuarios.nome })
    .from(usuarios)
    .where(eq(usuarios.ativo, true))
    .orderBy(asc(usuarios.criadoEm), asc(usuarios.id));
}

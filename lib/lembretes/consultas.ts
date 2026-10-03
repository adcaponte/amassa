// As leituras dos Lembretes (Fase 06.3). SEM a diretiva de Server Action: são chamadas por Server
// Components que já passaram pela cerca de `/gestao` (o layout chama `exigirUsuario()`) — uma
// exportação de arquivo com a diretiva viraria endpoint chamável pelo navegador, e
// `npm run verificar-acoes` reprovaria as leituras por não começarem por `exigirUsuario()`.
//
// Os nomes vêm de `usuarios` por `leftJoin` SEM filtrar `ativo` (molde `listarTarefasDaAbertura`):
// quem foi desativado continua nomeado nos lembretes antigos. Nada aqui usa a data corrente do
// Postgres (ele roda em UTC) — "hoje" é sempre parâmetro, vindo da página.
import { asc, eq, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { lembretes, usuarios } from "@/db/schema";

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

// Os abertos (`feito_em is null`) na ordem do BRIEFING §3: prazo crescente (vencidos primeiro), os
// sem data por último, empate por `criado_em` e, por fim, `id` (desempate estável).
export async function lerLembretesDoInicio(): Promise<LembretesDoInicio> {
  const linhas = await db
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
    .leftJoin(autoriaDoFeito, eq(lembretes.feitoPor, autoriaDoFeito.id))
    .where(isNull(lembretes.feitoEm))
    .orderBy(sql`${lembretes.paraQuando} asc nulls last`, asc(lembretes.criadoEm), asc(lembretes.id))
    .limit(TETO_DE_ABERTOS_NO_INICIO);

  return {
    abertos: linhas.map((linha) => ({
      id: linha.id,
      texto: linha.texto,
      paraQuando: linha.paraQuando,
      quem: linha.quem,
      quemNome: linha.quemNome,
      criadoEm: linha.criadoEm.toISOString(),
      criadoPorNome: linha.criadoPorNome,
      feitoEm: instanteEmTexto(linha.feitoEm),
      feitoPorNome: linha.feitoPorNome,
    })),
  };
}

import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { aberturaConfiguracao, aberturaItens, aberturaTarefas, usuarios } from "@/db/schema";
import type { ItemParaCalculo } from "@/lib/abertura/parcelas";
import type { CategoriaDeItem, GrupoDeTarefa } from "@/lib/abertura/textos";

// Leitura da aba de itens de `/abertura`. Sem `"use server"` — não é uma Server Action, é uma
// consulta chamada direto do Server Component da página; `lib/abertura/acoes.ts` fica só com
// escrita (mesmo molde de `lib/queimas/consultas.ts`).
//
// `ItemDaAbertura` inclui os campos brutos do banco MAIS `ItemParaCalculo` (o formato mínimo que
// `lib/abertura/parcelas.ts` consome) — esta consulta NÃO calcula nada: parcela, soma de grupo e
// total são derivados por `calcularParcelas`/`totaisComprometidos` a partir deste dado bruto, o
// único lugar que sabe a regra de negócio.
export type ItemDaAbertura = ItemParaCalculo & {
  id: string;
  nome: string;
  categoria: CategoriaDeItem;
  entregaPrevistaEm: string | null;
  resolvido: boolean;
};

export async function listarItensDaAbertura(): Promise<ItemDaAbertura[]> {
  const linhas = await db.select().from(aberturaItens).orderBy(asc(aberturaItens.nome));

  return linhas.map((linha) => ({
    id: linha.id,
    nome: linha.nome,
    categoria: linha.categoria,
    valorEmCentavos: linha.valorCentavos,
    formaPagamento: linha.formaPagamento,
    parcelas: linha.parcelas,
    primeiraParcelaEm: linha.primeiraParcelaEm,
    entregaPrevistaEm: linha.entregaPrevistaEm,
    resolvido: linha.resolvido,
  }));
}

// D-18/ABE-11 (Tarefa 2, 04.2-03-PLAN.md): a linha ou `null` — é o que preenche o formulário em
// modo de edição (`?item=<id>`). Um identificador que não corresponde a nenhuma linha devolve
// `null`, e a página abre o formulário vazio em modo de criação em vez de quebrar.
export async function obterItemDeAbertura(id: string): Promise<ItemDaAbertura | null> {
  const [linha] = await db.select().from(aberturaItens).where(eq(aberturaItens.id, id)).limit(1);

  if (!linha) {
    return null;
  }

  return {
    id: linha.id,
    nome: linha.nome,
    categoria: linha.categoria,
    valorEmCentavos: linha.valorCentavos,
    formaPagamento: linha.formaPagamento,
    parcelas: linha.parcelas,
    primeiraParcelaEm: linha.primeiraParcelaEm,
    entregaPrevistaEm: linha.entregaPrevistaEm,
    resolvido: linha.resolvido,
  };
}

export type GestorAtivo = { id: string; nome: string };

// A lista que o campo de responsável do formulário oferece (D-11) — SEMPRE de `usuarios` com
// `ativo = true`, nunca um vetor de nomes no código (os quatro nomes do protótipo são simulação
// declarada no próprio protótipo). Esta é uma das DUAS leituras deliberadamente diferentes: esta
// filtra por `ativo`, `listarTarefasDaAbertura` abaixo não filtra — é o contraste que faz o
// histórico de autoria não quebrar quando um gestor é desativado.
export async function listarGestoresAtivos(): Promise<GestorAtivo[]> {
  return db
    .select({ id: usuarios.id, nome: usuarios.nome })
    .from(usuarios)
    .where(eq(usuarios.ativo, true))
    .orderBy(asc(usuarios.nome));
}

// Leitura da aba de tarefas de `/abertura`. `TarefaDaAbertura` inclui os campos brutos MAIS o
// nome do responsável e o nome do item vinculado, já resolvidos por `leftJoin` — nenhuma regra
// de negócio nasce aqui: urgência, ordenação e agrupamento são derivados a partir deste dado
// bruto por `lib/abertura/prazos.ts`, o único lugar que sabe a regra.
export type TarefaDaAbertura = {
  id: string;
  descricao: string;
  grupo: GrupoDeTarefa;
  prazoEm: string;
  concluida: boolean;
  responsavelId: string | null;
  responsavelNome: string | null;
  itemId: string | null;
  itemNome: string | null;
};

// O `leftJoin` com `usuarios` NÃO filtra por `ativo` — um gestor desativado continua nomeado nas
// tarefas dele (consequência declarada de D-11: desativar nunca apaga, para o histórico de
// autoria não quebrar). Uma consulta por lista, com dois `leftJoin`, nunca uma consulta por
// linha (T-04.2-11) — mesmo padrão de `listarFornosDoIndice` (`lib/queimas/consultas.ts`).
export async function listarTarefasDaAbertura(): Promise<TarefaDaAbertura[]> {
  const linhas = await db
    .select({
      id: aberturaTarefas.id,
      descricao: aberturaTarefas.descricao,
      grupo: aberturaTarefas.grupo,
      prazoEm: aberturaTarefas.prazoEm,
      concluida: aberturaTarefas.concluida,
      responsavelId: aberturaTarefas.responsavelId,
      responsavelNome: usuarios.nome,
      itemId: aberturaTarefas.itemId,
      itemNome: aberturaItens.nome,
    })
    .from(aberturaTarefas)
    .leftJoin(usuarios, eq(aberturaTarefas.responsavelId, usuarios.id))
    .leftJoin(aberturaItens, eq(aberturaTarefas.itemId, aberturaItens.id));

  return linhas.map((linha) => ({
    id: linha.id,
    descricao: linha.descricao,
    grupo: linha.grupo,
    prazoEm: linha.prazoEm,
    concluida: linha.concluida,
    responsavelId: linha.responsavelId,
    responsavelNome: linha.responsavelNome ?? null,
    itemId: linha.itemId,
    itemNome: linha.itemNome ?? null,
  }));
}

export type TarefaParaEditar = {
  id: string;
  descricao: string;
  grupo: GrupoDeTarefa;
  prazoEm: string;
  responsavelId: string | null;
  itemId: string | null;
  concluida: boolean;
};

// D-18/ABE-11 (Tarefa 2, 04.2-03-PLAN.md): a linha CRUA (sem `leftJoin`) — é o que preenche o
// formulário em modo de edição (`?tarefa=<id>`). Um identificador que não corresponde a nenhuma
// linha devolve `null`, e a página abre o formulário vazio em modo de criação em vez de quebrar.
export async function obterTarefaDeAbertura(id: string): Promise<TarefaParaEditar | null> {
  const [linha] = await db
    .select()
    .from(aberturaTarefas)
    .where(eq(aberturaTarefas.id, id))
    .limit(1);

  if (!linha) {
    return null;
  }

  return {
    id: linha.id,
    descricao: linha.descricao,
    grupo: linha.grupo,
    prazoEm: linha.prazoEm,
    responsavelId: linha.responsavelId,
    itemId: linha.itemId,
    concluida: linha.concluida,
  };
}

export type ConfiguracaoDaAbertura = { inauguracaoEm: string };

// D-17/ABE-14 (Tarefa 3, 04.2-04-PLAN.md): a data de inauguração, ou `null` quando a tabela está
// vazia — o estado logo depois da migração, que não semeia nenhuma linha. Esta consulta NÃO
// ESCREVE nada: uma leitura que cria a linha quando não a encontra é uma escrita disfarçada, e
// faria a primeira visita de qualquer gestor gravar uma data que ninguém deu.
export async function obterConfiguracaoDaAbertura(): Promise<ConfiguracaoDaAbertura | null> {
  const [linha] = await db
    .select({ inauguracaoEm: aberturaConfiguracao.inauguracaoEm })
    .from(aberturaConfiguracao)
    .limit(1);

  if (!linha) {
    return null;
  }

  return { inauguracaoEm: linha.inauguracaoEm };
}

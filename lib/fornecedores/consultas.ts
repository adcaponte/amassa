// As leituras do cadastro de fornecedores (Fase 06.2). SEM a diretiva de Server Action (molde de
// `lib/clientes/consultas.ts`, T-06.2-02): são chamadas por Server Components que já chamaram
// `exigirUsuario()` (a página de Cadastros) e, nos planos seguintes, por `lib/fornecedores/acoes.ts`,
// que também já chamou. Uma exportação de arquivo com a diretiva viraria endpoint chamável pelo
// navegador — com telefone, e-mail e observações de quem vende para o ateliê.
//
// A lista traz TODOS (ativos e desativados): o filtro "mostrar desativados" e a busca são do cliente
// (plano 03), e a ficha de um desativado continua abrindo pelo `?fornecedor=`.
import { count, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { fornecedorAnexos, fornecedores, usuarios } from "@/db/schema";
import { hojeEmBrasilia } from "@/lib/financeiro/formato";

import type { AreaDoFornecedor, TipoDeAnexo } from "./esquemas";

export type FornecedorDaLista = {
  id: string;
  nome: string;
  vende: string | null;
  area: AreaDoFornecedor;
  cidadeEntrega: string | null;
  ativo: boolean;
  quantosAnexos: number;
};

export type FichaDoFornecedor = {
  id: string;
  nome: string;
  vende: string | null;
  area: AreaDoFornecedor;
  cidadeEntrega: string | null;
  whatsapp: string | null;
  pessoaContato: string | null;
  email: string | null;
  site: string | null;
  pagamentoPrazo: string | null;
  observacoes: string | null;
  ativo: boolean;
  criadoEm: Date;
};

// A ordem da tela: alfabética em pt-BR sem diferença de caixa nem de acento ("argilas" junto de
// "Argilas"), desempate pelo id — dois nomes iguais (um ativo e um desativado) sempre na mesma ordem.
// Feita aqui, uma vez, no servidor: a lista desenha nesta ordem e a página escolhe a ficha aberta
// (o primeiro ATIVO) na MESMA ordem, sem duas cópias da regra.
const COMPARADOR_DE_NOMES = new Intl.Collator("pt-BR", { sensitivity: "base" });

function compararFornecedores(a: { nome: string; id: string }, b: { nome: string; id: string }): number {
  const porNome = COMPARADOR_DE_NOMES.compare(a.nome, b.nome);
  if (porNome !== 0) {
    return porNome;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// A lista da sub-aba: todos os fornecedores, com a contagem de anexos (`left join` + `count` — quem
// não tem anexo conta 0), já na ordem da tela.
export async function listarFornecedores(): Promise<FornecedorDaLista[]> {
  const linhas = await db
    .select({
      id: fornecedores.id,
      nome: fornecedores.nome,
      vende: fornecedores.vende,
      area: fornecedores.area,
      cidadeEntrega: fornecedores.cidadeEntrega,
      ativo: fornecedores.ativo,
      quantosAnexos: count(fornecedorAnexos.id),
    })
    .from(fornecedores)
    .leftJoin(fornecedorAnexos, eq(fornecedorAnexos.fornecedorId, fornecedores.id))
    .groupBy(fornecedores.id);

  return linhas
    .map((linha) => ({ ...linha, quantosAnexos: Number(linha.quantosAnexos) }))
    .sort(compararFornecedores);
}

// A ficha inteira de um fornecedor — `null` se o id não está no cadastro (link velho ou digitado).
// O id chega já validado como uuid (`idDaUrl`); o texto da URL nunca entra numa consulta.
export async function obterFornecedor(id: string): Promise<FichaDoFornecedor | null> {
  const [linha] = await db
    .select({
      id: fornecedores.id,
      nome: fornecedores.nome,
      vende: fornecedores.vende,
      area: fornecedores.area,
      cidadeEntrega: fornecedores.cidadeEntrega,
      whatsapp: fornecedores.whatsapp,
      pessoaContato: fornecedores.pessoaContato,
      email: fornecedores.email,
      site: fornecedores.site,
      pagamentoPrazo: fornecedores.pagamentoPrazo,
      observacoes: fornecedores.observacoes,
      ativo: fornecedores.ativo,
      criadoEm: fornecedores.criadoEm,
    })
    .from(fornecedores)
    .where(eq(fornecedores.id, id));
  return linha ?? null;
}

// ——— O caminho do byte (plano 06.2-05). Chamadas SÓ pelos Route Handlers dos anexos, que já chamaram
// `exigirUsuario()` (a mesma disciplina do resto deste arquivo). A lista dos anexos da ficha (`anexosDoFornecedor`) está no fim do arquivo (plano 06). ———

export type AnexoParaLeitura = {
  nome: string;
  arquivoCaminho: string;
  arquivoTipo: string;
  arquivoBytes: number;
  extensao: string;
};

// O que a rota de leitura precisa para servir um anexo — `null` se o id não está na tabela. O id chega
// já validado como uuid pela rota; o caminho no disco sai daqui (o nome que o SERVIDOR gravou), nunca
// da requisição.
export async function obterAnexoParaLeitura(id: string): Promise<AnexoParaLeitura | null> {
  const [linha] = await db
    .select({
      nome: fornecedorAnexos.nome,
      arquivoCaminho: fornecedorAnexos.arquivoCaminho,
      arquivoTipo: fornecedorAnexos.arquivoTipo,
      arquivoBytes: fornecedorAnexos.arquivoBytes,
      extensao: fornecedorAnexos.extensao,
    })
    .from(fornecedorAnexos)
    .where(eq(fornecedorAnexos.id, id));
  return linha ?? null;
}

export type SituacaoParaEnvio = "ativo" | "desativado" | "inexistente";

// A conferência barata ANTES de o PUT gravar um byte no disco: fornecedor que não existe → 404,
// desativado → 409. A transação do PUT confere de novo, com trava (`for share`), na hora de inserir.
export async function situacaoParaEnvio(fornecedorId: string): Promise<SituacaoParaEnvio> {
  const [linha] = await db
    .select({ ativo: fornecedores.ativo })
    .from(fornecedores)
    .where(eq(fornecedores.id, fornecedorId));
  if (!linha) {
    return "inexistente";
  }
  return linha.ativo ? "ativo" : "desativado";
}

// ——— Os anexos da ficha (plano 06.2-06). Chamada pela ficha (Server Component da página de Cadastros,
// que já chamou `exigirUsuario()`). ———

export type AnexoDaFicha = {
  id: string;
  nome: string;
  tipo: TipoDeAnexo;
  // Dia civil "YYYY-MM-DD" (só tabela de preços) — nulo = vale pela data de envio.
  valeDesde: string | null;
  nota: string | null;
  arquivoBytes: number;
  extensao: string;
  // Quem subiu (o nome do usuário) e quando: o instante em ISO 8601 (a tela formata no fuso de
  // Brasília) e o dia civil de Brasília desse instante (plano 08: a data de envio que a tabela vigente
  // usa quando não há "vale desde" — nunca o dia UTC).
  criadoPorNome: string;
  criadoEm: string;
  enviadoEm: string;
};

// Os anexos de um fornecedor, do mais recente para o mais antigo (`criado_em` desc; desempate pelo id,
// para dois envios no mesmo instante sempre na mesma ordem), com o nome de quem subiu (`criado_por` é
// NOT NULL e referencia `usuarios` — o `join` interno não perde linha). Fornecedor sem anexo → lista
// vazia. O caminho no disco NÃO sai daqui: a tela só precisa do id para montar o link da rota.
export async function anexosDoFornecedor(fornecedorId: string): Promise<AnexoDaFicha[]> {
  const linhas = await db
    .select({
      id: fornecedorAnexos.id,
      nome: fornecedorAnexos.nome,
      tipo: fornecedorAnexos.tipo,
      valeDesde: fornecedorAnexos.valeDesde,
      nota: fornecedorAnexos.nota,
      arquivoBytes: fornecedorAnexos.arquivoBytes,
      extensao: fornecedorAnexos.extensao,
      criadoPorNome: usuarios.nome,
      criadoEm: fornecedorAnexos.criadoEm,
    })
    .from(fornecedorAnexos)
    .innerJoin(usuarios, eq(usuarios.id, fornecedorAnexos.criadoPor))
    .where(eq(fornecedorAnexos.fornecedorId, fornecedorId))
    .orderBy(desc(fornecedorAnexos.criadoEm), desc(fornecedorAnexos.id));
  return linhas.map((linha) => ({
    ...linha,
    criadoEm: linha.criadoEm.toISOString(),
    enviadoEm: hojeEmBrasilia(linha.criadoEm),
  }));
}

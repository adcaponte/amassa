"use server";

// As ações do cadastro de fornecedores (Fase 06.2). Toda ação exportada começa por
// `exigirUsuario()` na primeira linha (T-06.2-01, cobrado por `npm run verificar-acoes`) e valida a
// entrada com o `esquemaFornecedor` do plano 01 — o MESMO Zod que espelha os checks da `0028`. A
// folha nunca decide autoria, datas nem `ativo`: quem cadastrou é o usuário da sessão, as datas são
// do banco e todo fornecedor nasce ativo.
//
// Fornecedor não se apaga (FRN-03): não existe ação de apagar, e o banco também nega
// (`revoke delete on fornecedores from amassa_app`, provado no `test:migracoes`).
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { fornecedores } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { codigoDoErroPostgres } from "@/lib/erro/postgres";
import { rotaDeGestao } from "@/lib/rotas/gestao";

import { esquemaFornecedor, type CampoDoFornecedor } from "./esquemas";
import { FRASE_FALHA_AO_SALVAR, FRASE_NOME_REPETIDO } from "./textos";

// O envelope das ações do cadastro — molde de `ResultadoDoCadastro` (`lib/clientes/acoes.ts`): além
// do `erro` (a primeira frase), o erro de CADA campo, para a folha mostrar embaixo do campo.
export type ResultadoDoFornecedor<T> =
  | { ok: true; dados: T }
  | { ok: false; erro: string; campos?: Partial<Record<CampoDoFornecedor, string>> };

const CAMPOS_DO_FORNECEDOR: readonly CampoDoFornecedor[] = [
  "nome",
  "vende",
  "area",
  "cidadeEntrega",
  "whatsapp",
  "pessoaContato",
  "email",
  "site",
  "pagamentoPrazo",
  "observacoes",
];

function ehCampoDoFornecedor(valor: unknown): valor is CampoDoFornecedor {
  return typeof valor === "string" && (CAMPOS_DO_FORNECEDOR as readonly string[]).includes(valor);
}

type ProblemaDeValidacao = { path: PropertyKey[]; message: string };

// NÃO exportada (uma exportação deste arquivo vira endpoint).
function recusaDeValidacao(problemas: readonly ProblemaDeValidacao[]): {
  ok: false;
  erro: string;
  campos: Partial<Record<CampoDoFornecedor, string>>;
} {
  const campos: Partial<Record<CampoDoFornecedor, string>> = {};
  for (const problema of problemas) {
    const campo = problema.path[0];
    if (ehCampoDoFornecedor(campo) && campos[campo] === undefined) {
      campos[campo] = problema.message;
    }
  }
  return { ok: false, erro: problemas[0]?.message ?? FRASE_FALHA_AO_SALVAR, campos };
}

// SQLSTATE 23505 = unique_violation — o índice único parcial `fornecedores_nome_ativo_uk`
// (`lower(trim(nome))` entre os ATIVOS) é quem decide, não a tela: dois toques, duas abas ou dois
// gestores ao mesmo tempo terminam com UM fornecedor e a frase para o outro. Lido por
// `codigoDoErroPostgres` — o Drizzle embrulha o SQLSTATE em `erro.cause.code`.
function ehNomeRepetido(erro: unknown): boolean {
  return codigoDoErroPostgres(erro) === "23505";
}

// Cadastrar um fornecedor (FRN-01/FRN-02). Devolve o id do novo — a tela navega para a ficha dele.
export async function criarFornecedor(entrada: unknown): Promise<ResultadoDoFornecedor<{ id: string }>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaFornecedor.safeParse(entrada);
  if (!resultado.success) {
    return recusaDeValidacao(resultado.error.issues);
  }

  try {
    const [criado] = await db
      .insert(fornecedores)
      .values({ ...resultado.data, criadoPor: usuario.id, atualizadoPor: usuario.id })
      .returning({ id: fornecedores.id });

    revalidatePath(rotaDeGestao("/cadastros"));
    return { ok: true, dados: { id: criado.id } };
  } catch (erro) {
    if (ehNomeRepetido(erro)) {
      return { ok: false, erro: FRASE_NOME_REPETIDO, campos: { nome: FRASE_NOME_REPETIDO } };
    }
    console.error("Falha ao cadastrar o fornecedor:", codigoDoErroPostgres(erro), erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

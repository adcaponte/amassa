"use server";

// As ações do cadastro de fornecedores (Fase 06.2). Toda ação exportada começa por
// `exigirUsuario()` na primeira linha (T-06.2-01, cobrado por `npm run verificar-acoes`) e valida a
// entrada com o `esquemaFornecedor` do plano 01 — o MESMO Zod que espelha os checks da `0028`. A
// folha nunca decide autoria, datas nem `ativo`: quem cadastrou é o usuário da sessão, as datas são
// do banco e todo fornecedor nasce ativo.
//
// Fornecedor não se apaga (FRN-03): não existe ação de apagar, e o banco também nega
// (`revoke delete on fornecedores from amassa_app`, provado no `test:migracoes`).
import { promises as fs } from "node:fs";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { fornecedorAnexos, fornecedores } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { codigoDoErroPostgres } from "@/lib/erro/postgres";
import { rotaDeGestao } from "@/lib/rotas/gestao";

import { caminhoDoAnexo } from "./caminho-anexos";
import {
  esquemaAtivoDoFornecedor,
  esquemaEditarFornecedor,
  esquemaFornecedor,
  esquemaRemoverAnexo,
  type CampoDoFornecedor,
} from "./esquemas";
import {
  FRASE_FALHA_AO_DESATIVAR,
  FRASE_FALHA_AO_REATIVAR,
  FRASE_FALHA_AO_SALVAR,
  FRASE_FALHA_AO_TIRAR,
  FRASE_FICHA_NAO_EXISTE,
  FRASE_NOME_REPETIDO,
  FRASE_REATIVAR_NOME_REPETIDO,
} from "./textos";

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

// ——— Manter o cadastro (plano 06.2-04): editar, desativar e reativar. Fornecedor não se apaga. ———
//
// A trava das duas ações é `for no key update`, NUNCA a exclusiva de linha (`for update`):
// `fornecedores` é alvo de chave estrangeira de inserts concorrentes (`fornecedor_anexos`,
// `documentos`), cuja checagem toma `for key share` na linha do fornecedor. A exclusiva conflita com
// `for key share` — desativar no meio de um upload ou de uma despesa fecharia impasse; `no key update`
// não conflita e continua serializando duas decisões sobre o MESMO fornecedor (molde
// `lib/estoque/gravacao.ts`, Pitfall 2). `atualizado_em` é do gatilho `tocar_atualizado_em` (0028).

// Depois de mexer num fornecedor: Cadastros (a lista e a ficha) e o Financeiro (o campo "Fornecedor"
// da Despesa lista só os ativos — D-04).
function revalidarTelasDoFornecedor() {
  revalidatePath(rotaDeGestao("/cadastros"));
  revalidatePath(rotaDeGestao("/financeiro"));
}

// Editar um fornecedor (FRN-02/FRN-03): os mesmos campos e tetos do cadastrar. Editar um desativado
// grava e ele continua desativado — `ativo` não é campo da folha.
export async function editarFornecedor(entrada: unknown): Promise<ResultadoDoFornecedor<{ id: string }>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaEditarFornecedor.safeParse(entrada);
  if (!resultado.success) {
    return recusaDeValidacao(resultado.error.issues);
  }
  const { id, ...campos } = resultado.data;

  try {
    const resposta = await db.transaction(async (tx): Promise<ResultadoDoFornecedor<{ id: string }>> => {
      const [atual] = await tx
        .select({ id: fornecedores.id })
        .from(fornecedores)
        .where(eq(fornecedores.id, id))
        .for("no key update");
      if (!atual) {
        return { ok: false, erro: FRASE_FICHA_NAO_EXISTE };
      }

      await tx
        .update(fornecedores)
        .set({ ...campos, atualizadoPor: usuario.id })
        .where(eq(fornecedores.id, id));
      return { ok: true, dados: { id } };
    });

    if (resposta.ok) {
      revalidarTelasDoFornecedor();
    }
    return resposta;
  } catch (erro) {
    if (ehNomeRepetido(erro)) {
      return { ok: false, erro: FRASE_NOME_REPETIDO, campos: { nome: FRASE_NOME_REPETIDO } };
    }
    console.error("Falha ao editar o fornecedor:", codigoDoErroPostgres(erro), erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// Desativar (`ativo: false`) ou reativar (`ativo: true`) — UMA ação que grava o ESTADO DESEJADO,
// nunca "inverter": duas abas desatualizadas que desativam o mesmo fornecedor gravam `false` duas
// vezes e as duas respondem `ok` (idempotente — FRN-03). Desativar não apaga nada: os anexos, as
// observações e as despesas ligadas ficam.
//
// Reativar um fornecedor cujo nome hoje é de outro ATIVO (comparado por `lower(trim(nome))`, D-06)
// bate no índice único parcial (23505) e volta com a frase própria, sem reativar (Pitfall 11) — quem
// decide é o banco, não a tela.
export async function definirFornecedorAtivo(
  entrada: unknown,
): Promise<ResultadoDoFornecedor<{ id: string; ativo: boolean }>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaAtivoDoFornecedor.safeParse(entrada);
  if (!resultado.success) {
    return { ok: false, erro: resultado.error.issues[0]?.message ?? FRASE_FALHA_AO_SALVAR };
  }
  const { id, ativo } = resultado.data;

  try {
    const resposta = await db.transaction(
      async (tx): Promise<ResultadoDoFornecedor<{ id: string; ativo: boolean }>> => {
        const [atual] = await tx
          .select({ id: fornecedores.id })
          .from(fornecedores)
          .where(eq(fornecedores.id, id))
          .for("no key update");
        if (!atual) {
          return { ok: false, erro: FRASE_FICHA_NAO_EXISTE };
        }

        await tx
          .update(fornecedores)
          .set({ ativo, atualizadoPor: usuario.id })
          .where(eq(fornecedores.id, id));
        return { ok: true, dados: { id, ativo } };
      },
    );

    if (resposta.ok) {
      revalidarTelasDoFornecedor();
    }
    return resposta;
  } catch (erro) {
    if (ativo && ehNomeRepetido(erro)) {
      return { ok: false, erro: FRASE_REATIVAR_NOME_REPETIDO };
    }
    console.error(
      ativo ? "Falha ao reativar o fornecedor:" : "Falha ao desativar o fornecedor:",
      codigoDoErroPostgres(erro),
      erro,
    );
    return { ok: false, erro: ativo ? FRASE_FALHA_AO_REATIVAR : FRASE_FALHA_AO_DESATIVAR };
  }
}

// ——— Tirar um anexo (plano 06.2-08; FRN-10) — o único "apagar" do módulo, e a tela só o chama depois
// da confirmação que diz o nome do anexo e o que se perde. ———

export type ResultadoDeTirarAnexo =
  | { ok: true; dados: { id: string; jaTirado: boolean } }
  | { ok: false; erro: string };

// Tira o anexo `id`: a LINHA sai primeiro, numa instrução só (`delete … returning arquivo_caminho`), e o
// ARQUIVO depois, fora de qualquer transação, pelo nome que o BANCO devolveu e que passa por
// `caminhoDoAnexo` (a regex do nome — nada da requisição vira caminho, T-06.2-31). É o molde de
// `removerFotoDeOrcamento`: se o processo morrer entre os dois, sobra um arquivo órfão (inofensivo, e o
// backup o copia), nunca uma linha que o GET serviria apontando para um arquivo que não existe.
//
// `ENOENT` (o arquivo já não estava no disco) é ignorado; outro erro de disco vai só para o log — a
// linha já saiu e a ficha está certa (T-06.2-33, aceito). Tirar o que já foi tirado (toque duplo, duas
// abas) não apaga nada e responde `jaTirado` — a tela atualiza a ficha e mostra a frase própria, nunca
// um erro 500. Desativado ou não, o fornecedor deixa tirar (UI-D24: tirar é limpar).
export async function removerAnexo(entrada: unknown): Promise<ResultadoDeTirarAnexo> {
  await exigirUsuario();

  const resultado = esquemaRemoverAnexo.safeParse(entrada);
  if (!resultado.success) {
    return { ok: false, erro: resultado.error.issues[0]?.message ?? FRASE_FALHA_AO_TIRAR };
  }
  const { id } = resultado.data;

  let arquivo: string | null;
  try {
    const [apagada] = await db
      .delete(fornecedorAnexos)
      .where(eq(fornecedorAnexos.id, id))
      .returning({ arquivoCaminho: fornecedorAnexos.arquivoCaminho });
    arquivo = apagada?.arquivoCaminho ?? null;
  } catch (erro) {
    console.error("Falha ao tirar o anexo do fornecedor:", codigoDoErroPostgres(erro), erro);
    return { ok: false, erro: FRASE_FALHA_AO_TIRAR };
  }

  revalidatePath(rotaDeGestao("/cadastros"));

  if (arquivo === null) {
    return { ok: true, dados: { id, jaTirado: true } };
  }

  try {
    await fs.unlink(caminhoDoAnexo(arquivo));
  } catch (erroDeDisco) {
    if ((erroDeDisco as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("Falha ao apagar do disco o arquivo do anexo tirado (a linha já saiu):", erroDeDisco);
    }
  }

  return { ok: true, dados: { id, jaTirado: false } };
}

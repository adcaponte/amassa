"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { cotacaoCategorias, cotacoes } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";

import { esquemaCategoriaDeCotacao, esquemaCotacao } from "./esquemas";
import { FRASE_FALHA_AO_SALVAR } from "./textos";

// Mesma forma de `lib/abertura/acoes.ts`/`lib/queimas/acoes.ts` (D-15) — cada módulo redeclara
// hoje, não há local compartilhado.
export type ResultadoDeAcao<T> = { ok: true; dados: T } | { ok: false; erro: string };

function primeiraMensagemDeErro(resultado: { error: { issues: { message: string }[] } }): string {
  return resultado.error.issues[0]?.message ?? "Não deu para validar os dados enviados.";
}

// SQLSTATE 23503 = foreign_key_violation — mesmo helper de `lib/abertura/acoes.ts`: a categoria
// deixou de existir entre abrir o formulário e salvar (a chave estrangeira de `cotacoes.categoriaId`
// barra a escrita, e este erro vira frase humana, nunca erro cru).
function ehViolacaoDeChaveEstrangeira(erro: unknown): boolean {
  return typeof erro === "object" && erro !== null && "code" in erro && erro.code === "23503";
}

// Único caminho de criação de categoria (D-14, <10s). `exigirUsuario()` é a PRIMEIRA instrução
// do corpo (D-22, portão de máquina em `npm run verificar-acoes`). Sem transação: uma inserção de
// uma linha só, com identificador gerado pelo BANCO — duas pessoas criando categorias ao mesmo
// tempo terminam com as duas, sem colisão (must_have de backstop deste plano).
export async function criarCategoriaDeCotacao(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string }>> {
  await exigirUsuario();

  const resultado = esquemaCategoriaDeCotacao.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  try {
    const [linha] = await db
      .insert(cotacaoCategorias)
      .values({ nome: dados.nome })
      .returning({ id: cotacaoCategorias.id });

    revalidatePath("/abertura");
    return { ok: true, dados: { id: linha.id } };
  } catch (erro) {
    console.error("Falha ao gravar categoria de cotação:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// Único caminho de criação de cotação nesta fatia. `exigirUsuario()` é a PRIMEIRA instrução do
// corpo. Devolve o identificador da cotação E o da categoria — quem chama precisa do segundo
// para navegar de volta para `/abertura?aba=cotacoes&categoria=<id>` depois de gravar (D-23:
// navegação completa).
export async function criarCotacao(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string; categoriaId: string }>> {
  await exigirUsuario();

  const resultado = esquemaCotacao.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  try {
    const [linha] = await db
      .insert(cotacoes)
      .values({
        categoriaId: dados.categoriaId,
        empresa: dados.empresa,
        produto: dados.produto,
        precoCentavos: dados.preco,
        situacao: dados.situacao,
        diferenciais: dados.diferenciais,
        assistencia: dados.assistencia,
        pagamento: dados.pagamento,
        contato: dados.contato,
        observacoes: dados.observacoes,
        alertas: dados.alertas,
      })
      .returning({ id: cotacoes.id, categoriaId: cotacoes.categoriaId });

    revalidatePath("/abertura");
    return { ok: true, dados: { id: linha.id, categoriaId: linha.categoriaId } };
  } catch (erro) {
    if (ehViolacaoDeChaveEstrangeira(erro)) {
      return {
        ok: false,
        erro: "Essa categoria não existe mais. Recarregue a página e tente de novo.",
      };
    }
    console.error("Falha ao gravar cotação:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { encomendaEtapas, encomendaItens, encomendas } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";

import { DIAS_PADRAO } from "./cronograma";
import { esquemaEncomenda } from "./esquemas";

// A primeira escrita de produto do sistema. `db.transaction` cobre as três tabelas — meia
// encomenda gravada é pior que nenhuma (T-03-04). `esquemaEncomenda` (lib/encomendas/esquemas.ts)
// é o ponto único de validação que D-15 exige: o ajuste rápido do plano 03 importa de lá, nunca
// reimplementa a regra.
export type ResultadoDeAcao<T> = { ok: true; dados: T } | { ok: false; erro: string };

// Assinatura de dois argumentos (estado anterior + FormData) — o formato que `useActionState`
// exige, pronta para o dia em que o formulário precisar mostrar o erro sem recarregar a página
// (plano 06). Hoje `formulario-encomenda.tsx` chama via `criarEncomenda.bind(null, null)`, o
// que permite manter o componente um Server Component sem precisar do hook agora.
export async function criarEncomenda(
  _estadoAnterior: unknown,
  dadosDoFormulario: FormData,
): Promise<ResultadoDeAcao<{ id: string }>> {
  // PRIMEIRA instrução do corpo — sem nenhuma linha antes, nem para ler o FormData. Regra do
  // CLAUDE.md, verificada por `npm run verificar-acoes` (T-03-01).
  const usuarioAtual = await exigirUsuario();

  const clienteNomeBruto = dadosDoFormulario.get("clienteNome");

  // As 6 etapas não aparecem no formulário desta fatia (03-UI-SPEC.md "Formulário — Modal /
  // Folha": entram com os padrões pelo servidor; o plano 06 traz os campos). Construídas aqui,
  // na ordem fixa de `DIAS_PADRAO`, e validadas pelo mesmo `esquemaEncomenda` que o ajuste
  // rápido do plano 03 vai usar para as suas — nunca uma segunda cópia da regra.
  const etapasComPadrao = DIAS_PADRAO.map((duracao) => ({
    etapa: duracao.etapa,
    dias: duracao.dias,
  }));

  const resultado = esquemaEncomenda.safeParse({
    nome: dadosDoFormulario.get("nome"),
    clienteNome:
      typeof clienteNomeBruto === "string" && clienteNomeBruto.trim() !== ""
        ? clienteNomeBruto
        : undefined,
    dataInicio: dadosDoFormulario.get("dataInicio"),
    itens: [
      {
        descricao: dadosDoFormulario.get("itemDescricao"),
        quantidade: Number(dadosDoFormulario.get("itemQuantidade")),
      },
    ],
    etapas: etapasComPadrao,
  });

  if (!resultado.success) {
    return {
      ok: false,
      erro: resultado.error.issues[0]?.message ?? "Não deu para validar os dados do formulário.",
    };
  }

  const dados = resultado.data;

  try {
    await db.transaction(async (tx) => {
      const [linhaEncomenda] = await tx
        .insert(encomendas)
        .values({
          nome: dados.nome,
          clienteNome: dados.clienteNome ?? null,
          dataInicio: dados.dataInicio,
          criadoPor: usuarioAtual.id,
        })
        .returning({ id: encomendas.id });

      await tx.insert(encomendaItens).values(
        dados.itens.map((item, indice) => ({
          encomendaId: linhaEncomenda.id,
          descricao: item.descricao,
          quantidade: item.quantidade,
          ordem: indice,
        })),
      );

      await tx.insert(encomendaEtapas).values(
        dados.etapas.map((etapa, indice) => ({
          encomendaId: linhaEncomenda.id,
          etapa: etapa.etapa,
          dias: etapa.dias,
          ordem: indice,
        })),
      );
    });
  } catch (erro) {
    // Erro de banco (restrição violada, conexão perdida, etc.) — nunca engolido, mesmo
    // estreitamento por instanceof do estilo de `lib/auth/acoes.ts`: registrado e relançado
    // para o Next.js mostrar a tela de erro, não uma resposta silenciosa de "deu certo".
    console.error("Falha ao gravar encomenda:", erro);
    throw erro;
  }

  // Fora do `try`: `redirect()` lança um erro de controle de fluxo do próprio Next.js, que
  // precisaria continuar subindo — mantê-lo fora evita confundi-lo com um erro de banco.
  revalidatePath("/encomendas");
  redirect("/encomendas");
}

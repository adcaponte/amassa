// Módulo puro de Fornecedores — o campo "Fornecedor" da Despesa do Financeiro (Fase 06.2, plano 10;
// FRN-12, D-04). Só um import, de `./busca` (a MESMA `normalizar` da lista de Cadastros); nenhuma linha
// alcança React, Next, drizzle-orm, pg ou `@/db` (teste de pureza em
// `tests/unit/fornecedores-campo.test.ts`). O combobox (`components/amassa/financeiro/campo-fornecedor.tsx`)
// só chama.
//
// A lista é a dos fornecedores ATIVOS, carregada uma vez com a página do Financeiro
// (`listarFornecedoresParaSeletor`): a filtragem é local, sem espera ao digitar (06.2-UI-SPEC.md,
// "Despesa do Financeiro — o campo Fornecedor").
import { normalizar } from "./busca";

// O que o campo precisa de cada fornecedor ativo — o mesmo formato de `FornecedorParaSeletor`
// (`lib/fornecedores/consultas.ts`), declarado aqui para o módulo puro não importar o arquivo que lê o
// banco.
export type FornecedorDoCampo = {
  id: string;
  nome: string;
  vende: string | null;
  cidadeEntrega: string | null;
};

// No máximo 8 sugestões (06.2-UI-SPEC.md); havendo mais, `haMais` (a linha "Há mais fornecedores —
// continue digitando." é do plano 12).
export const MAXIMO_DE_SUGESTOES = 8;

export type SugestoesDoCampo<T extends FornecedorDoCampo> = {
  opcoes: T[];
  haMais: boolean;
};

// Ordem alfabética em pt-BR sem diferença de caixa nem de acento, desempate pelo id — a mesma regra da
// lista de Cadastros.
function compararPorNome(a: FornecedorDoCampo, b: FornecedorDoCampo): number {
  const porNome = a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });
  if (porNome !== 0) {
    return porNome;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// As sugestões para o texto digitado: quem tem o texto (normalizado — sem acento, caixa nem espaços
// sobrando) no NOME ou no que VENDE (UI-D5: quem lança uma compra de argila pode não lembrar o nome da
// loja). Cidade não conta aqui (a lista de Cadastros procura por ela; o campo da Despesa, não). Texto
// vazio → todos. Devolve os mesmos objetos que recebeu, em ordem alfabética, no máximo 8.
export function sugestoesDoCampo<T extends FornecedorDoCampo>(
  fornecedores: readonly T[],
  texto: string,
): SugestoesDoCampo<T> {
  const termo = normalizar(texto);
  const casam = fornecedores
    .filter(
      (fornecedor) =>
        termo === "" ||
        normalizar(fornecedor.nome).includes(termo) ||
        normalizar(fornecedor.vende ?? "").includes(termo),
    )
    .sort(compararPorNome);
  return {
    opcoes: casam.slice(0, MAXIMO_DE_SUGESTOES),
    haMais: casam.length > MAXIMO_DE_SUGESTOES,
  };
}

// Os três estados do vínculo deste plano (o plano 12 acrescenta os outros):
//   - "vazio": nada escrito (nenhum fornecedor é o padrão);
//   - "ligado": escolhido da lista — a despesa grava `fornecedor_id` e o nome do cadastro;
//   - "texto-livre": escrito sem escolher — grava só `pessoa_nome`, como sempre. Mesmo que o texto
//     seja igual ao nome de um fornecedor ativo: NADA se liga sozinho (UI-D4).
export type SituacaoDoVinculo = "vazio" | "ligado" | "texto-livre";

export function situacaoDoVinculo(campo: { texto: string; fornecedorId: string | null }): SituacaoDoVinculo {
  if (campo.fornecedorId !== null) {
    return "ligado";
  }
  return campo.texto.trim() === "" ? "vazio" : "texto-livre";
}

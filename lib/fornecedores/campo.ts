// Módulo puro de Fornecedores — o campo "Fornecedor" da Despesa do Financeiro (Fase 06.2, plano 10;
// FRN-12, D-04; completado no plano 12). Dois imports: `./busca` (a MESMA `normalizar` da lista de
// Cadastros) e as frases do campo em `@/lib/financeiro/textos` (só strings; o único import dele é de
// TIPO). Nenhuma linha alcança React, Next, drizzle-orm, pg ou `@/db` (teste de pureza em
// `tests/unit/fornecedores-campo.test.ts`). O combobox (`components/amassa/financeiro/campo-fornecedor.tsx`)
// só chama.
//
// A lista é a dos fornecedores ATIVOS, carregada uma vez com a página do Financeiro
// (`listarFornecedoresParaSeletor`): a filtragem é local, sem espera ao digitar (06.2-UI-SPEC.md,
// "Despesa do Financeiro — o campo Fornecedor").
import {
  FRASE_CAMPO_CADASTRO_VAZIO,
  FRASE_CAMPO_HA_MAIS,
  fraseCampoSemResultado,
} from "@/lib/financeiro/textos";

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
// continue digitando." vem de `mensagemDoPainel`).
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

// O fornecedor ativo cujo nome é IGUAL ao texto escrito, comparando por `normalizar` (sem acento, caixa
// nem espaços sobrando) — só quando há exatamente UM: dois ativos com o mesmo nome normalizado não dão
// aviso nenhum (não há como dizer qual). Um item com `ativo: false` não conta (a lista do campo já é só
// de ativos; a regra fica explícita aqui). Texto vazio → nenhum. Serve ao aviso da linha de vínculo e ao
// destaque da opção com a lista aberta — NUNCA liga sozinho (UI-D4).
export function fornecedorComNomeIgual<T extends { nome: string; ativo?: boolean }>(
  fornecedores: readonly T[],
  texto: string,
): T | null {
  const termo = normalizar(texto);
  if (termo === "") {
    return null;
  }
  const iguais = fornecedores.filter(
    (fornecedor) => fornecedor.ativo !== false && normalizar(fornecedor.nome) === termo,
  );
  return iguais.length === 1 ? iguais[0] : null;
}

// Os seis estados da linha de vínculo embaixo do campo (06.2-UI-SPEC.md, "Despesa do Financeiro — o
// campo Fornecedor"; plano 12):
//   - "erro": a lista de fornecedores não carregou (`null`) — o campo é texto livre e a frase de erro
//     fica embaixo dele, com ou sem texto;
//   - "ligado": escolhido da lista — a despesa grava `fornecedor_id` e o nome do cadastro;
//   - "vazio": nada escrito (nenhum fornecedor é o padrão);
//   - "cadastro-vazio": texto escrito, nenhum fornecedor ativo — nenhuma linha (a frase é do painel);
//   - "texto-igual-ao-cadastro": o texto é o nome de UM ativo, sem ter escolhido — o aviso em `atencao`;
//     `nome` é o nome do cadastro;
//   - "texto-livre": escrito sem escolher — grava só `pessoa_nome`, como sempre.
// NADA se liga sozinho (UI-D4): só a escolha na lista dá "ligado".
export type SituacaoDoVinculo =
  | { estado: "vazio" }
  | { estado: "ligado" }
  | { estado: "texto-livre" }
  | { estado: "texto-igual-ao-cadastro"; nome: string }
  | { estado: "cadastro-vazio" }
  | { estado: "erro" };

export function situacaoDoVinculo(campo: {
  texto: string;
  fornecedorId: string | null;
  fornecedores: readonly { nome: string; ativo?: boolean }[] | null;
}): SituacaoDoVinculo {
  if (campo.fornecedores === null) {
    return { estado: "erro" };
  }
  if (campo.fornecedorId !== null) {
    return { estado: "ligado" };
  }
  if (campo.texto.trim() === "") {
    return { estado: "vazio" };
  }
  if (!campo.fornecedores.some((fornecedor) => fornecedor.ativo !== false)) {
    return { estado: "cadastro-vazio" };
  }
  const igual = fornecedorComNomeIgual(campo.fornecedores, campo.texto);
  if (igual !== null) {
    return { estado: "texto-igual-ao-cadastro", nome: igual.nome };
  }
  return { estado: "texto-livre" };
}

// A frase do painel de sugestões (fora do `listbox`, molde `situacao()` de `seletor-pessoa.tsx`), ou
// `null` quando não há o que dizer:
//   - nenhum fornecedor ativo → a frase do cadastro vazio (com ou sem texto);
//   - texto sem nenhuma sugestão → a frase do sem resultado, com o texto como foi escrito (sem as pontas);
//   - mais de 8 → a linha não selecionável "Há mais fornecedores — continue digitando.";
//   - lista que não carregou (`null`) → nada: não há painel (a frase de erro fica embaixo do campo).
export function mensagemDoPainel(entrada: {
  fornecedores: readonly { nome: string; ativo?: boolean }[] | null;
  texto: string;
  sugestoes: { opcoes: readonly unknown[]; haMais: boolean };
}): string | null {
  if (entrada.fornecedores === null) {
    return null;
  }
  if (!entrada.fornecedores.some((fornecedor) => fornecedor.ativo !== false)) {
    return FRASE_CAMPO_CADASTRO_VAZIO;
  }
  if (entrada.sugestoes.opcoes.length === 0) {
    return fraseCampoSemResultado(entrada.texto.trim());
  }
  return entrada.sugestoes.haMais ? FRASE_CAMPO_HA_MAIS : null;
}

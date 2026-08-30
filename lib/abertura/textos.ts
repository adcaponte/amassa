// As frases fixas e os rótulos do módulo Abertura do Espaço — só `import type` é permitido
// aqui (nenhum import de valor), no molde de `lib/queimas/textos.ts`: o módulo não lê React
// nem o cliente do banco.
import type { categoriaItemAbertura, grupoTarefaAbertura } from "@/db/schema";
import type { Urgencia } from "@/lib/abertura/prazos";

export type CategoriaDeItem = (typeof categoriaItemAbertura.enumValues)[number];
export type GrupoDeTarefa = (typeof grupoTarefaAbertura.enumValues)[number];

export const TITULO_MODULO = "Abertura do Espaço";

// D-08 — os seis rótulos, na mesma ordem em que os grupos aparecem na lista (ORDEM_DAS_
// CATEGORIAS). O valor do enum é sem acento e em minúsculas; o rótulo em português com acento
// vive só aqui, nunca no banco.
export const ROTULO_CATEGORIA: Record<CategoriaDeItem, string> = {
  moveis: "Móveis",
  equipamentos: "Equipamentos",
  material: "Material",
  utensilios: "Utensílios",
  obra: "Obra",
  outros: "Outros",
};

export const ORDEM_DAS_CATEGORIAS: readonly CategoriaDeItem[] = [
  "moveis",
  "equipamentos",
  "material",
  "utensilios",
  "obra",
  "outros",
];

export const ROTULO_NOVO_ITEM = "+ Adicionar item";
export const ROTULO_SALVAR_ITEM = "Adicionar item";

export const FRASE_FALHA_AO_SALVAR = "Não deu para salvar. Verifique a internet e tente de novo.";

// D-18/ABE-11 (Tarefa 2 do 04.2-03-PLAN.md): `atualizarItemDeAbertura`/`atualizarTarefaDeAbertura`
// devolvem esta frase quando o `update` não afeta nenhuma linha — a linha foi removida por outra
// pessoa entre a montagem do formulário e o envio.
export const FRASE_ITEM_NAO_EXISTE_MAIS = "Esse item não existe mais. Recarregue a página.";
export const FRASE_TAREFA_NAO_EXISTE_MAIS = "Essa tarefa não existe mais. Recarregue a página.";

export const ROTULO_SALVAR_ALTERACOES = "Salvar alterações";

// Estado vazio da aba de itens (UI-SPEC §"Estados vazios") — verbatim.
export const FRASE_VAZIO_TITULO = "Nada aqui ainda.";
export const FRASE_VAZIO_CORPO = "Comece pelo que você já sabe que precisa comprar.";

// Estado de erro da rota (UI-SPEC §"Estados de erro") — verbatim, mesmo par de
// `lib/queimas/textos.ts`/`lib/encomendas/textos.ts`.
export const FRASE_ERRO_TITULO = "Algo não funcionou.";
export const FRASE_ERRO_CORPO =
  "Não deu para carregar a abertura do espaço. Verifique a internet e tente de novo.";

export const ROTULO_COMPROMETIDO = "Comprometido";
export const ROTULO_A_VISTA = "à vista";
export const ROTULO_A_PRAZO = "a prazo";

// D-09 — os seis grupos de tarefa, na mesma ordem em que aparecem na lista agrupada (a mesma
// ordem, duplicada deliberadamente, vive em `lib/abertura/prazos.ts` como `Grupo`/ordem interna
// de iteração — aquele módulo não importa daqui, ver o comentário de lá). O valor do enum é sem
// acento e em minúsculas; o rótulo em português com acento vive só aqui, nunca no banco.
export const ROTULO_GRUPO: Record<GrupoDeTarefa, string> = {
  obra: "Obra",
  documentacao: "Documentação",
  aquisicao: "Aquisição",
  montagem: "Montagem",
  divulgacao: "Divulgação",
  outros: "Outros",
};

export const ORDEM_DOS_GRUPOS: readonly GrupoDeTarefa[] = [
  "obra",
  "documentacao",
  "aquisicao",
  "montagem",
  "divulgacao",
  "outros",
];

export const ROTULO_SEM_RESPONSAVEL = "Ninguém ainda";
// D-13 — a primeira opção do campo "Ligada a algum item?" do formulário de tarefa: o vínculo é
// opcional, e uma tarefa sem item é "solta", nunca um campo esquecido.
export const ROTULO_SEM_VINCULO = "Nenhum — tarefa solta";
export const ROTULO_NOVA_TAREFA = "+ Adicionar tarefa";
export const ROTULO_SALVAR_TAREFA = "Adicionar tarefa";

// Estado vazio da aba de tarefas (UI-SPEC §"Estados vazios") — verbatim.
export const FRASE_VAZIO_TITULO_TAREFAS = "Nenhuma tarefa.";
export const FRASE_VAZIO_CORPO_TAREFAS = "Anote o que precisa acontecer até a abertura.";

// Rótulos acessíveis da caixa de marcação (`caixa-marcacao.tsx`) — trocam com o estado atual,
// nunca um rótulo genérico ("Marcar"/"Desmarcar" sozinho não diz SOBRE O QUÊ, CLAUDE.md
// §Acessibilidade). `nome` é o nome do item ou a descrição da tarefa.
export function rotuloCaixaItem(nome: string, resolvido: boolean): string {
  return resolvido ? `Desmarcar: ${nome}` : `Marcar como resolvido: ${nome}`;
}

export function rotuloCaixaTarefa(nome: string, concluida: boolean): string {
  return concluida ? `Reabrir: ${nome}` : `Concluir: ${nome}`;
}

// Rótulos acessíveis dos dois botões só com ícone de `ferramentas-linha.tsx` (plano
// 04.2-03/Tarefa 2) — nomeiam a linha, nunca só "Editar"/"Remover" sozinho.
export function rotuloEditar(nome: string): string {
  return `Editar ${nome}`;
}

export function rotuloRemover(nome: string): string {
  return `Remover ${nome}`;
}

// Traduz `Urgencia` (`lib/abertura/prazos.ts`) no texto exato do protótipo (`urgencia(t)`) —
// `switch` exaustivo sobre `tipo`, sem `default`: um ramo novo na união vira erro de compilação
// aqui, nunca um texto genérico em silêncio.
export function textoDaUrgencia(urgencia: Urgencia): string {
  switch (urgencia.tipo) {
    case "feita":
      return "feita";
    case "atrasada":
      return urgencia.dias === 1 ? "ontem" : `${urgencia.dias} dias atrás`;
    case "hoje":
      return "hoje";
    case "futura":
      return urgencia.dias === 1 ? "amanhã" : `em ${urgencia.dias} dias`;
  }
}

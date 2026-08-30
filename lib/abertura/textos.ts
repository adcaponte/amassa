// As frases fixas e os rótulos do módulo Abertura do Espaço — só `import type` é permitido
// aqui (nenhum import de valor), no molde de `lib/queimas/textos.ts`: o módulo não lê React
// nem o cliente do banco.
import type { categoriaItemAbertura, grupoTarefaAbertura } from "@/db/schema";
import type { ContagemRegressiva, Urgencia } from "@/lib/abertura/prazos";

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

// D-15/ABE-12 (Tarefa 2, 04.2-04-PLAN.md): os rótulos dos outros dois blocos do painel — o
// segundo bloco foi deliberadamente trocado de "falta comprar" para "sai neste mês" (o quanto
// falta comprar já se lê na lista; o quanto sai este mês não se lia em lugar nenhum).
export const ROTULO_SAI_NESTE_MES = "Sai neste mês";
export const ROTULO_PROXIMO_MES = "próximo mês";
export const ROTULO_PRECISA_DE_ATENCAO = "Precisa de atenção";

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

// Estado vazio da aba "Por mês" (UI-SPEC §"Estados vazios", D-16) — verbatim. Sem botão: não há
// como "adicionar um mês", o fluxo nasce de cadastrar um item na aba Itens.
export const FRASE_VAZIO_TITULO_MESES = "Sem nada a pagar ainda.";
export const FRASE_VAZIO_CORPO_MESES = "Cadastre um item com data e o fluxo aparece aqui.";

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

// D-14/ABE-10 (Tarefa 3): texto EXATO do protótipo (bloco `data-apagar-item`) — nomeia o item E
// o valor que sai do total, na voz do produto (UI-SPEC §"Voz da interface").
export function fraseConfirmarRemoverItem(nome: string, valorFormatado: string): string {
  return `Remover "${nome}"? Ele sai da lista e do total de ${valorFormatado}.`;
}

// A segunda metade da frase ("mas não são apagadas") é a parte que não pode faltar (D-14): sem
// ela, o gestor lê "ficam soltas" e desiste de remover por medo de perder trabalho.
export function fraseTarefasQueFicamSoltas(quantidade: number): string {
  return quantidade === 1
    ? "1 tarefa ligada a ele fica solta, mas não é apagada."
    : `${quantidade} tarefas ligadas a ele ficam soltas, mas não são apagadas.`;
}

export function fraseConfirmarRemoverTarefa(descricao: string): string {
  return `Remover a tarefa "${descricao}"?`;
}

// D-17/ABE-14 (Tarefa 3, 04.2-04-PLAN.md): o cabeçalho editável da data de inauguração.
export const ROTULO_ALTERAR_INAUGURACAO = "Alterar a data de inauguração";
// Enquanto a configuração está vazia (o estado logo depois da migração) — nenhuma data é
// inventada em lugar nenhum, o cabeçalho PEDE a data.
export const FRASE_DEFINIR_INAUGURACAO = "Defina a data de inauguração";

// Os quatro rótulos possíveis da contagem regressiva (`contagemRegressiva`,
// `lib/abertura/prazos.ts`), verbatim do protótipo — `switch` exaustivo sobre `tipo`, sem
// `default`: um ramo novo na união vira erro de compilação aqui, nunca um texto genérico em
// silêncio (mesma disciplina de `textoDaUrgencia` abaixo).
export function rotuloContagemRegressiva(contagem: ContagemRegressiva): string {
  switch (contagem.tipo) {
    case "faltam":
      return "dias";
    case "hoje":
      return "é hoje";
    case "passou":
      return contagem.dias === 1 ? "dia atrás" : "dias atrás";
  }
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

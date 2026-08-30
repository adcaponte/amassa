// Módulo puro: recebe dados, devolve dados. O único import permitido no arquivo inteiro é
// `diferencaEmDias` de `lib/abertura/parcelas.ts` — uma única aritmética de calendário no
// módulo, nunca uma terceira cópia (a segunda já vive em `lib/encomendas/cronograma.ts`). Nada
// de React, nada do cliente do banco, nenhuma leitura de relógio: `hoje` entra sempre por
// argumento como string `YYYY-MM-DD`.
//
// Esta é a regra de negócio das TAREFAS até a inauguração (D-09/D-10/D-13): a classificação de
// urgência de uma tarefa, a ordenação dentro de um grupo, o agrupamento por área e a contagem
// de tarefas abertas por item vinculado.
import { diferencaEmDias } from "./parcelas";

// Os seis grupos de D-09, como union de literais — duplicado deliberadamente do enum
// `grupoTarefaAbertura` (`db/schema.ts`)/`GrupoDeTarefa` (`lib/abertura/textos.ts`), na mesma
// disciplina de `CATEGORIAS` em `lib/abertura/esquemas.ts`: este módulo não importa nada além
// de `diferencaEmDias`, então a lista de valores possíveis vive aqui também, e a compatibilidade
// estrutural do TypeScript (mesmos literais) é o que faz os dois lados baterem sem um import
// cruzado entre módulos puros.
export type Grupo =
  | "obra"
  | "documentacao"
  | "aquisicao"
  | "montagem"
  | "divulgacao"
  | "outros";

// Ordem interna de iteração de `agruparTarefasPorGrupo` — mesmos seis valores e mesma ordem de
// `ORDEM_DOS_GRUPOS` (`lib/abertura/textos.ts`), mas uma constante própria: este módulo não
// importa de `textos.ts` (só de `parcelas.ts`, ver comentário acima).
const ORDEM_INTERNA_DOS_GRUPOS: readonly Grupo[] = [
  "obra",
  "documentacao",
  "aquisicao",
  "montagem",
  "divulgacao",
  "outros",
];

// União discriminada, um ramo por linha do protótipo (`urgencia(t)`) — o `switch` de quem
// formata (`lib/abertura/textos.ts` → `textoDaUrgencia`) é exaustivo sobre `tipo`, para um caso
// novo nunca cair num texto genérico em silêncio.
export type Urgencia =
  | { tipo: "feita" }
  | { tipo: "atrasada"; dias: number }
  | { tipo: "hoje" }
  | { tipo: "futura"; dias: number };

export type TarefaParaUrgencia = {
  concluida: boolean;
  prazoEm: string;
};

// Concluída devolve `feita` ANTES de qualquer comparação de data, como no protótipo — uma
// tarefa concluída nunca é atrasada, mesmo com o prazo muito vencido no passado.
export function urgenciaDaTarefa(tarefa: TarefaParaUrgencia, hoje: string): Urgencia {
  if (tarefa.concluida) {
    return { tipo: "feita" };
  }
  if (tarefa.prazoEm < hoje) {
    return { tipo: "atrasada", dias: diferencaEmDias(hoje, tarefa.prazoEm) };
  }
  if (tarefa.prazoEm === hoje) {
    return { tipo: "hoje" };
  }
  return { tipo: "futura", dias: diferencaEmDias(tarefa.prazoEm, hoje) };
}

export type TarefaParaOrdenar = {
  concluida: boolean;
  prazoEm: string;
};

// Abertas antes de concluídas, e dentro de cada bloco por `prazoEm` crescente — comparado como
// string (`localeCompare`), que para `YYYY-MM-DD` é a ordem cronológica exata e não precisa de
// `Date`. Devolve um vetor NOVO; nunca ordena no lugar (D-10: agrupar não pode enterrar o
// atrasado no meio da lista, e mutar a entrada de quem chama seria uma surpresa silenciosa à
// parte).
export function ordenarTarefasDoGrupo<T extends TarefaParaOrdenar>(tarefas: readonly T[]): T[] {
  return [...tarefas].sort((a, b) => {
    if (a.concluida !== b.concluida) {
      return a.concluida ? 1 : -1;
    }
    return a.prazoEm.localeCompare(b.prazoEm);
  });
}

export type TarefaParaAgrupar = TarefaParaOrdenar & {
  grupo: Grupo;
};

export type GrupoDeTarefasAgrupadas<T> = {
  grupo: Grupo;
  tarefas: T[];
  concluidas: number;
  total: number;
  atrasadas: number;
};

// Devolve os grupos na ordem de D-09, pulando grupo sem tarefa — grupo vazio não desenha
// cabeçalho nenhum (protótipo, `desenhar()`: `GRUPOS.filter(g=>tfs.some(...))`). `atrasadas`
// conta as tarefas NÃO concluídas com `prazoEm` anterior a `hoje` — é o número que o cabeçalho
// grita (D-10), e a razão de D-10 existir: agrupar sem ele enterraria o atrasado no meio de uma
// lista.
export function agruparTarefasPorGrupo<T extends TarefaParaAgrupar>(
  tarefas: readonly T[],
  hoje: string,
): GrupoDeTarefasAgrupadas<T>[] {
  const grupos: GrupoDeTarefasAgrupadas<T>[] = [];

  for (const grupo of ORDEM_INTERNA_DOS_GRUPOS) {
    const tarefasDoGrupo = tarefas.filter((tarefa) => tarefa.grupo === grupo);
    if (tarefasDoGrupo.length === 0) {
      continue;
    }

    const concluidas = tarefasDoGrupo.filter((tarefa) => tarefa.concluida).length;
    const atrasadas = tarefasDoGrupo.filter(
      (tarefa) => !tarefa.concluida && tarefa.prazoEm < hoje,
    ).length;

    grupos.push({
      grupo,
      tarefas: ordenarTarefasDoGrupo(tarefasDoGrupo),
      concluidas,
      total: tarefasDoGrupo.length,
      atrasadas,
    });
  }

  return grupos;
}

// D-04/D-07/ABE-04 — os TRÊS fatos que precisam valer AO MESMO TEMPO para um item aparecer como
// "não chegou": existe `entregaPrevistaEm`, o item NÃO está `resolvido`, e `entregaPrevistaEm` é
// ESTRITAMENTE anterior a `hoje` (a entrega prevista para hoje ainda não venceu — vencer é a
// data já ter passado, não ser hoje). Tirar qualquer um dos três produz um alerta que nunca
// apaga (sem o segundo fato) ou que nunca aparece (sem o primeiro ou o terceiro) — por isso os
// três têm caso próprio no teste. A marcação (`resolvido`) é a ÚNICA coisa que apaga o alerta
// (D-07): não existe um segundo estado de item além de "resolvido".
export type ItemParaEntrega = {
  entregaPrevistaEm: string | null;
  resolvido: boolean;
};

export function entregaVencida(item: ItemParaEntrega, hoje: string): boolean {
  return item.entregaPrevistaEm !== null && !item.resolvido && item.entregaPrevistaEm < hoje;
}

// A contagem usada pelo cabeçalho de grupo da lista de itens (Tarefa 1 deste plano) e pelo
// bloco "precisa de atenção" do painel (plano 04.2-04, D-15) — a mesma regra dos três fatos
// acima, nunca reimplementada num segundo lugar.
export function contarEntregasVencidas<T extends ItemParaEntrega>(
  itens: readonly T[],
  hoje: string,
): number {
  return itens.filter((item) => entregaVencida(item, hoje)).length;
}

export type TarefaParaContarPorItem = {
  concluida: boolean;
  itemId: string | null;
};

// Contagem de tarefas NÃO concluídas por `itemId`, ignorando as de `itemId` nulo — consumida
// pela linha do item (D-13/Tarefa 2): o item mostra quantas tarefas ABERTAS ainda carrega, sem
// o que um item marcado como comprado parece encerrado enquanto a instalação não aconteceu.
// Nunca uma chave com valor 0: um item sem nenhuma tarefa aberta simplesmente não entra no
// mapa, o que faz a tela não desenhar etiqueta nenhuma para ele (em vez de desenhar "0 tarefas
// abertas"). Não muta a lista recebida.
export function contarTarefasAbertasPorItem<T extends TarefaParaContarPorItem>(
  tarefas: readonly T[],
): Map<string, number> {
  const contagem = new Map<string, number>();

  for (const tarefa of tarefas) {
    if (tarefa.itemId === null || tarefa.concluida) {
      continue;
    }
    contagem.set(tarefa.itemId, (contagem.get(tarefa.itemId) ?? 0) + 1);
  }

  return contagem;
}

export type TarefaParaContarLigadas = {
  itemId: string | null;
};

// D-14/ABE-10 (Tarefa 3, 04.2-03-PLAN.md): contagem de TODAS as tarefas ligadas a um item —
// concluídas OU abertas, ao contrário de `contarTarefasAbertasPorItem` acima — porque remover o
// item solta TODAS elas (a restrição `on delete set null` não distingue estado). É esta
// contagem que a confirmação de remoção mostra ANTES de o gestor confirmar; a contagem real,
// lida de dentro da MESMA transação que remove, é quem decide o aviso final (`removerItemDeAbertura`,
// `lib/abertura/acoes.ts`) — as duas podem divergir se outra pessoa mexeu no meio, e a de dentro
// da transação é a verdade.
export function contarTarefasLigadasPorItem<T extends TarefaParaContarLigadas>(
  tarefas: readonly T[],
): Map<string, number> {
  const contagem = new Map<string, number>();

  for (const tarefa of tarefas) {
    if (tarefa.itemId === null) {
      continue;
    }
    contagem.set(tarefa.itemId, (contagem.get(tarefa.itemId) ?? 0) + 1);
  }

  return contagem;
}

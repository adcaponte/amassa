// Módulo puro da Agenda — a presença de uma pessoa numa data. Só importa os tipos da Agenda;
// nenhuma linha alcança React, Next, drizzle-orm, pg ou `@/db`.
//
// Pattern 2 da pesquisa — ESTADO DESEJADO, nunca "inverter": o cliente manda o valor que quer
// (`"veio" | "faltou" | null`), e o "desmarcar" é ele mandar `null` ao tocar no segmento já
// marcado. Duas chamadas com o mesmo valor convergem sempre — toque duplo e dois celulares nunca
// invertem a marcação (AGE-08 · idempotency, · concurrency: o último a gravar vence).
import { TIPOS_DE_INSCRICAO, type Presenca, type TipoInscricao } from "./tipos";

export type PresencaAtual = {
  presenca: Presenca | null;
  direitoARepor: boolean;
};

export type PresencaPlanejada = {
  presenca: Presenca | null;
  direitoARepor: boolean;
};

// O que gravar. Sair de "faltou" limpa o direito a repor na MESMA instrução (o `check`
// `inscricoes_direito_so_com_falta` recusaria o contrário); permanecer em "faltou" mantém o direito
// que já havia; chegar em "faltou" começa sem — marcar o direito é outro toque.
export function planejarPresenca(atual: PresencaAtual, desejada: Presenca | null): PresencaPlanejada {
  const direitoARepor = desejada === "faltou" && atual.presenca === "faltou" ? atual.direitoARepor : false;
  return { presenca: desejada, direitoARepor };
}

export type InscritoParaOrdenar = {
  id: string;
  nome: string;
  tipo: TipoInscricao;
};

const POSICAO_DO_TIPO: ReadonlyMap<TipoInscricao, number> = new Map(
  TIPOS_DE_INSCRICAO.map((tipo, indice) => [tipo, indice]),
);

const COMPARADOR_DE_NOMES = new Intl.Collator("pt-BR", { sensitivity: "base" });

// Alunos, depois reposições, depois experimentais, depois inscrições de oficina (a ordem do enum);
// dentro do grupo por nome, sem diferença de acento nem de caixa; desempate por id — a lista não
// pula entre recarregamentos. Devolve uma lista nova.
export function ordenarInscritos<T extends InscritoParaOrdenar>(inscritos: readonly T[]): T[] {
  return [...inscritos].sort((a, b) => {
    const porTipo = (POSICAO_DO_TIPO.get(a.tipo) ?? 0) - (POSICAO_DO_TIPO.get(b.tipo) ?? 0);
    if (porTipo !== 0) {
      return porTipo;
    }
    const porNome = COMPARADOR_DE_NOMES.compare(a.nome, b.nome);
    if (porNome !== 0) {
      return porNome;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

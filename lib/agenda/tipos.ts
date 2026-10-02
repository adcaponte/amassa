// Módulo puro da Agenda — as uniões do domínio. Zero import: nenhuma linha alcança React, Next,
// drizzle-orm, pg ou `@/db` (grep de aceite do plano 05-01), mesma disciplina de
// `lib/estoque/pedidos.ts`. As uniões são REDECLARADAS à mão, espelhando os enums da migração 0026
// (`tipo_evento`, `tipo_inscricao`, `presenca`, `estado_uso_livre`) — nenhum import de `@/db/schema`
// é permitido aqui; `tests/unit/agenda-paridade.test.ts` compara as listas com os `enumValues`.

// O que ocupa uma data na agenda: a data de uma turma fixa, uma aula/oficina avulsa, ou o dia
// fechado (sem aula — "dia todo"). O uso livre do espaço é tabela própria (`usos_livres`).
export const TIPOS_DE_EVENTO = ["turma", "avulsa", "fechado"] as const;
export type TipoEvento = (typeof TIPOS_DE_EVENTO)[number];

// Por que a pessoa está na lista daquela data: aluno da turma, reposição de uma falta, aula
// experimental (D-07) ou inscrição numa oficina avulsa.
export const TIPOS_DE_INSCRICAO = ["aluno", "reposicao", "experimental", "oficina"] as const;
export type TipoInscricao = (typeof TIPOS_DE_INSCRICAO)[number];

// A marcação de presença. "Nada marcado" é `null` — nunca um terceiro valor do enum.
export const PRESENCAS = ["veio", "faltou"] as const;
export type Presenca = (typeof PRESENCAS)[number];

// O ciclo do uso livre: reservado → no espaço → encerrado (AGE-13).
export const ESTADOS_DE_USO_LIVRE = ["reservado", "no_espaco", "encerrado"] as const;
export type EstadoUsoLivre = (typeof ESTADOS_DE_USO_LIVRE)[number];

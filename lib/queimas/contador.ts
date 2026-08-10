// Módulo puro: recebe dados, devolve dados. Zero imports (regra de `lib/encomendas/cronograma.ts`
// / `lib/backup/frescor.ts`, CLAUDE.md §Regras de negócio) — sem React, sem cliente de banco, sem
// `date-fns`. A regra central do contador de `amassa-plataforma/02-MODELO-DE-DADOS.md` §3:
//
//   contador = número de queimas do forno com ocorrida_em > (data da última manutenção)
//
// Sem manutenção, conta todas. Comparação de `timestamptz` com `timestamptz` como string ISO é
// segura (ordenação lexicográfica de ISO-8601 coincide com ordenação temporal).

export type NivelDeForno = "ok" | "atencao" | "critico";

// `Math.max(1, ...)` é a rede de proteção do módulo puro e é preservado mesmo parecendo
// redundante (limite mínimo do schema já é 10, então `limite - 10` nunca seria negativo na
// prática — mas o piso continua aqui porque é a regra literal do protótipo, e um piso que só
// "parece" necessário é exatamente o tipo de coisa que desaparece numa reescrita descuidada).
export function limiarDeAtencao(limite: number): number {
  return Math.max(1, limite - 10);
}

export type MedidaDoForno = {
  contador: number;
  total: number;
  atencao: number;
  limite: number;
  nivel: NivelDeForno;
};

export type EntradaDeMedicao = {
  limite: number;
  // Todas as `ocorrida_em` das queimas do forno, como string ISO — dado bruto, nunca
  // pré-agregado por quem chama (a regra do corte mora só aqui).
  ocorrenciasDeQueima: string[];
  ultimaManutencaoEm: string | null;
};

// Guarda de entrada: `limite < 10` lança — uma condição por `if`, nunca um `default` silencioso
// que coage o valor (a mesma disciplina de `calcularCronograma`,
// `lib/encomendas/cronograma.ts`). Chamar duas vezes com a mesma entrada devolve o mesmo
// resultado: a função não lê o relógio por dentro, o instante de corte já chega pronto em
// `ultimaManutencaoEm`.
export function medirForno(entrada: EntradaDeMedicao): MedidaDoForno {
  if (entrada.limite < 10) {
    throw new RangeError("O limite de um forno não pode ser menor que 10.");
  }

  const total = entrada.ocorrenciasDeQueima.length;

  // Sem manutenção: conta TODAS as queimas (equivalente a comparar contra `-infinity`, como
  // `fornos_medidos` faz com `coalesce(ult.ocorrida_em, '-infinity'::timestamptz)`).
  const contador =
    entrada.ultimaManutencaoEm === null
      ? total
      : entrada.ocorrenciasDeQueima.filter((ocorrida) => ocorrida > entrada.ultimaManutencaoEm!)
          .length;

  const atencao = limiarDeAtencao(entrada.limite);
  const nivel: NivelDeForno =
    contador >= entrada.limite ? "critico" : contador >= atencao ? "atencao" : "ok";

  return { contador, total, atencao, limite: entrada.limite, nivel };
}

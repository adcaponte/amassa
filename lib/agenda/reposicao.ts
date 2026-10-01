// Módulo puro da Agenda — o crédito de reposição (AGE-09). Zero import: nenhuma linha alcança React,
// Next, drizzle-orm, pg ou `@/db`, e nenhuma lê o relógio.
//
// Pattern 3 da pesquisa — o crédito é DERIVADO das linhas, nunca um contador gravado à parte
// (BRIEFING §4: "guardar os dois lados"). Os dois lados são contagens de `inscricoes` em datas NÃO
// canceladas, feitas pela consulta (`creditosDoCliente`, `creditosPorCliente`):
//   - faltas com direito: `presenca = 'faltou'` e `direito_a_repor`;
//   - reposições usadas: `tipo = 'reposicao'`.
// Por isso tirar uma reposição, cancelar a data dela ou desativar a turma (que apaga as datas futuras)
// devolve o crédito sozinho; e cancelar a data da falta o tira — data cancelada pelo ateliê nunca conta
// falta (AGE-04).

export type ContagensDeReposicao = {
  faltasComDireito: number;
  reposicoesUsadas: number;
};

export type CreditosDeReposicao = {
  comDireito: number;
  usadas: number;
  // O que a pessoa ainda pode repor — nunca abaixo de zero na tela.
  saldo: number;
  // Havia mais reposições do que faltas com direito (um direito desmarcado depois de usado, por
  // exemplo). A tela mostra 0; a ação de colocar como reposição recusa, porque o saldo é 0.
  excedido: boolean;
};

function conferirContagem(nome: string, valor: number): void {
  if (!Number.isInteger(valor) || valor < 0) {
    throw new RangeError(`Contagem inválida de ${nome} (inteiro ≥ 0): ${valor}`);
  }
}

export function creditosDeReposicao({ faltasComDireito, reposicoesUsadas }: ContagensDeReposicao): CreditosDeReposicao {
  conferirContagem("faltas com direito", faltasComDireito);
  conferirContagem("reposições usadas", reposicoesUsadas);
  const diferenca = faltasComDireito - reposicoesUsadas;
  return {
    comDireito: faltasComDireito,
    usadas: reposicoesUsadas,
    saldo: Math.max(0, diferenca),
    excedido: diferenca < 0,
  };
}

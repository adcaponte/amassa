// Módulo puro do Comparador de Compras (D-11): ordena uma lista de cotações por preço, sem
// nunca ler relógio nem banco — zero imports, nenhuma instância de `Date`, mesma disciplina de
// `lib/cotacoes/preco.ts` e `lib/abertura/parcelas.ts`. É isso que permite provar D-11 sem
// servidor, em milissegundos, e é por isso que a ordenação roda no cliente sem uma segunda
// versão da regra.

// O mínimo que a ordenação precisa saber de uma cotação — nunca o tipo completo de
// `lib/cotacoes/consultas.ts`, para este módulo continuar puro e não acoplado ao formato de
// leitura do banco. `criadoEm` chega como TEXTO (ISO), nunca uma instância de `Date`.
export type CotacaoParaOrdenar = {
  id: string;
  precoCentavos: number | null;
  criadoEm: string;
};

export type OrdemDasCotacoes = "cadastro" | "crescente" | "decrescente";

// Desempate SEMPRE pela ordem de cadastro (a posição de chegada em `cotacoes`, já ordenada por
// `criadoEm` na consulta) — nunca por `criadoEm` comparado aqui como string/data, para a lista
// não dançar entre dois renders quando duas cotações têm preços iguais.
function porOrdemDeCadastro(lista: readonly CotacaoParaOrdenar[]): Map<string, number> {
  const posicoes = new Map<string, number>();
  lista.forEach((cotacao, indice) => posicoes.set(cotacao.id, indice));
  return posicoes;
}

// A regra que D-11 existe para proteger: ausência de preço não é um preço baixo nem um preço
// alto — ela é sempre a ÚLTIMA, nos dois sentidos. Implementado separando as com preço das sem
// preço e concatenando, nunca com um número sentinela (um sentinela grande resolve o sentido
// crescente e quebra o decrescente, que é exatamente o defeito que D-11 existe para evitar).
//
// Genérico em `T` (Tarefa 1, 04.3-04): a UI liga esta função direto ao tipo COMPLETO de `Cotacao`
// (`lib/cotacoes/consultas.ts`), que tem muito mais campos que `CotacaoParaOrdenar` — sem o
// genérico, o retorno "esqueceria" empresa/produto/situação/os seis campos longos, e o chamador
// precisaria de uma segunda passagem para recuperá-los. `T extends CotacaoParaOrdenar` continua
// travando a função ao mínimo que ela realmente lê (`id`/`precoCentavos`/`criadoEm`) — nenhuma
// mudança de COMPORTAMENTO, só de tipo; os testes de `tests/unit/cotacoes-ordenacao.test.ts`
// continuam passando sem alteração.
export function ordenarCotacoes<T extends CotacaoParaOrdenar>(
  cotacoes: readonly T[],
  ordem: OrdemDasCotacoes,
): T[] {
  if (ordem === "cadastro") {
    return [...cotacoes];
  }

  const posicaoDeCadastro = porOrdemDeCadastro(cotacoes);
  const comPreco = cotacoes.filter((cotacao) => cotacao.precoCentavos !== null);
  const semPreco = cotacoes
    .filter((cotacao) => cotacao.precoCentavos === null)
    // Mesmo sem preço, a ordem entre elas é sempre a de cadastro — nunca a ordem em que o
    // `.filter` as encontrou (que já é essa, mas o `sort` deixa explícito e imune a uma futura
    // mudança de implementação de `.filter`).
    .sort((a, b) => posicaoDeCadastro.get(a.id)! - posicaoDeCadastro.get(b.id)!);

  const sinal = ordem === "crescente" ? 1 : -1;
  const comPrecoOrdenadas = [...comPreco].sort((a, b) => {
    const diferenca = (a.precoCentavos! - b.precoCentavos!) * sinal;
    if (diferenca !== 0) {
      return diferenca;
    }
    // Empate de preço: desempata pela ordem de cadastro, de forma estável.
    return posicaoDeCadastro.get(a.id)! - posicaoDeCadastro.get(b.id)!;
  });

  return [...comPrecoOrdenadas, ...semPreco];
}

// Auxiliar de teste de `cadastros/contas-fixas`: insere e apaga, direto no banco de teste, uma
// conta fixa INATIVA — mesmo padrão de `tests/e2e/apoio/semear-financeiro.ts` (cliente `pg` que o
// projeto já usa) e de `tests/e2e/apoio/apagar-referencia.ts` (apagar direto no banco, quando a
// interface não oferece exclusão real).
//
// Por que direto no banco, e não desativando pela tela: a prova de acessibilidade
// (tests/e2e/acessibilidade.spec.ts) precisa de uma conta fixa JÁ INATIVA no primeiro
// carregamento de `/cadastros?sub=fixas` — o caminho pela UI (criar ativa, depois clicar
// "Desativar") funciona, mas dobra o número de passos de rede sem necessidade nenhuma para um
// teste que não está provando o fluxo de desativação em si (isso já é coberto por
// `tests/e2e/cadastros-contas-fixas.spec.ts`).
//
// Por que APAGA no final, nunca só desativa: `contas_fixas` não tem exclusão pela interface
// (04.4-UI-SPEC.md: "sempre desativa, nunca apaga de verdade" — regra do domínio, para o dono).
// Mas isto é dado de TESTE, não um registro real do ateliê — deixá-lo desativado para sempre
// infla a tabela a cada execução da suíte e um dia quebra a contagem que
// `cadastros-contas-fixas.spec.ts` faz de "toda conta ativa" em "Gerar as contas". Apagar de
// volta, sempre em `finally`, mantém a tabela do banco de teste do tamanho que os outros e2e
// esperam.
import { Client } from "pg";

import { buscarCategoriaPorNome } from "./semear-financeiro";

async function comCliente<T>(operacao: (cliente: Client) => Promise<T>): Promise<T> {
  const cliente = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
  await cliente.connect();
  try {
    return await operacao(cliente);
  } finally {
    await cliente.end();
  }
}

export type ContaFixaParaSemear = {
  nome: string;
  categoria: string;
  valorCentavos: number;
  diaVencimento: number;
};

// Insere já com `ativa = false` — é exatamente o estado que produz a linha esmaecida
// (`lista-contas-fixas.tsx`) que a prova de contraste precisa encontrar na tela. Falha alto se
// não inserir exatamente 1 linha, mesma disciplina de `semearItem`.
export async function criarContaFixaInativa(dados: ContaFixaParaSemear): Promise<string> {
  const categoriaId = await buscarCategoriaPorNome(dados.categoria);

  const id = await comCliente(async (cliente) => {
    const resultado = await cliente.query<{ id: string }>(
      `insert into contas_fixas
         (nome, categoria_id, valor_esperado_centavos, dia_vencimento, ativa)
       values ($1, $2, $3, $4, false)
       returning id`,
      [dados.nome, categoriaId, dados.valorCentavos, dados.diaVencimento],
    );
    return resultado.rows[0]?.id;
  });

  if (!id) {
    throw new Error(`criarContaFixaInativa: falha ao inserir a conta fixa "${dados.nome}".`);
  }
  return id;
}

// Apaga uma conta fixa pelo `nome`, mesma disciplina de `apagarFornoPeloNome`
// (tests/e2e/apoio/apagar-referencia.ts) — falha alto se não apagar exatamente uma linha, para um
// apagamento silenciosamente vazio nunca mascarar um teste que já passou pelo motivo errado.
export async function apagarContaFixaPeloNome(nome: string): Promise<void> {
  const resultado = await comCliente((cliente) =>
    cliente.query(`delete from contas_fixas where nome = $1`, [nome]),
  );

  if (resultado.rowCount !== 1) {
    throw new Error(
      `apagarContaFixaPeloNome: esperava apagar 1 linha da tabela "contas_fixas" com nome ` +
        `"${nome}", mas apagou ${resultado.rowCount}.`,
    );
  }
}

// Auxiliar de teste: insere tarefas de ENCHIMENTO da Abertura do Espaço direto no banco de
// teste, pelo cliente `pg` que o projeto já usa (o mesmo pacote de `db/index.ts` e de
// `tests/e2e/apoio/semear-queimas.ts`).
//
// Por que existir. `tests/e2e/abertura-tarefas.spec.ts` precisa de três tarefas do MESMO grupo,
// com prazos diferentes (vencida, hoje, futura), para provar a ORDENAÇÃO por urgência dentro do
// grupo e a CONTAGEM de atrasadas no cabeçalho (D-10). A aritmética em si (`urgenciaDaTarefa`,
// `ordenarTarefasDoGrupo`, `agruparTarefasPorGrupo`) já é provada de forma determinística e sem
// servidor nenhum por `tests/unit/abertura-prazos.test.ts` — não é trabalho do e2e reprová-la a
// clique por viewport, pelo mesmo raciocínio de `semear-queimas.ts`.
//
// O que continua sendo toque real. O CADASTRO de tarefa em si — com responsável escolhido e com
// "Ninguém ainda" — segue sendo clique de verdade na interface, pela mesma Server Action
// `criarTarefaDeAbertura` do fluxo de produção. Só o ENCHIMENTO de ordenação vem por aqui.
import { Client } from "pg";

async function comCliente<T>(operacao: (cliente: Client) => Promise<T>): Promise<T> {
  const cliente = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
  await cliente.connect();
  try {
    return await operacao(cliente);
  } finally {
    await cliente.end();
  }
}

export type TarefaParaSemear = {
  descricao: string;
  // O valor do enum `grupo_tarefa_abertura` (`db/schema.ts`) — sem acento, minúsculo.
  grupo: string;
  // Dia civil `YYYY-MM-DD` — nunca timestamptz (o prazo de tarefa é `date`, CLAUDE.md §Fuso).
  prazoEm: string;
  concluida?: boolean;
};

// Insere `tarefas.length` linhas em `abertura_tarefas`, todas sem responsável e sem item —
// nomes e descrições inventados e genéricos, nunca o de uma pessoa real (o repositório é
// público). Falha ALTO se não inserir exatamente a quantidade prometida: um enchimento
// silenciosamente incompleto deixaria a ordenação errada e o teste falharia longe da causa,
// parecendo instabilidade — que é justamente o que este auxiliar existe para não produzir.
export async function semearTarefasDeAbertura(tarefas: readonly TarefaParaSemear[]): Promise<void> {
  if (tarefas.length === 0) {
    return;
  }

  const resultado = await comCliente((cliente) =>
    cliente.query(
      `insert into abertura_tarefas (descricao, grupo, prazo_em, concluida)
       select dado.descricao, dado.grupo::grupo_tarefa_abertura, dado.prazo_em::date, dado.concluida
         from jsonb_to_recordset($1::jsonb)
           as dado(descricao text, grupo text, prazo_em text, concluida boolean)`,
      [
        // `jsonb_to_recordset` casa as colunas do `AS` pelo NOME EXATO da chave do JSON — as
        // chaves aqui precisam ser `snake_case` (`prazo_em`), não `prazoEm` (a forma de
        // `TarefaParaSemear`), senão a coluna chega `null` em silêncio e a inserção falha na
        // restrição `not null` só depois, longe da causa real.
        JSON.stringify(
          tarefas.map((tarefa) => ({
            descricao: tarefa.descricao,
            grupo: tarefa.grupo,
            prazo_em: tarefa.prazoEm,
            concluida: tarefa.concluida ?? false,
          })),
        ),
      ],
    ),
  );

  if (resultado.rowCount !== tarefas.length) {
    throw new Error(
      `semearTarefasDeAbertura: esperava inserir ${tarefas.length} tarefas, mas inseriu ` +
        `${resultado.rowCount}. Migração 0010/0011 aplicada no banco de teste?`,
    );
  }
}

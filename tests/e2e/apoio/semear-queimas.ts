// Auxiliar de teste: insere queimas de ENCHIMENTO num forno, direto no banco de teste, pelo
// cliente `pg` que o projeto já usa (o mesmo pacote de `db/index.ts` e de
// `tests/e2e/apoio/alternar-ativo.ts`).
//
// Por que existir. `tests/e2e/queimas-cartao.spec.ts` precisa de um forno no NÍVEL CRÍTICO para
// provar que o selo "Manutenção vencida" aparece. Como `medirForno` recusa `limite < 10`
// (`lib/queimas/contador.ts`) e `limiarDeAtencao(10)` é `Math.max(1, 0) = 1`, o menor forno
// possível ainda exige DEZ queimas para cruzar o limite — "um limite menor" não é uma saída que
// exista. Registrar as dez pela interface custava dez idas e voltas de Server Action com
// `revalidatePath` + `router.refresh()` a cada uma, VEZES os dois projetos (`desktop` e
// `celular`), contra o servidor Next único que a suíte inteira compartilha. Era, de longe, a
// spec mais pesada da suíte, e a carga que ela impunha aparecia como instabilidade em testes
// vizinhos que nada tinham a ver com fornos.
//
// O que continua sendo toque real. As duas TRAVESSIAS de fronteira — de `ok` para `atenção` e de
// `atenção` para `crítico` — seguem sendo cliques de verdade na interface, pela mesma Server
// Action `registrarQueima` do fluxo de produção. Só o ENCHIMENTO entre elas vem por aqui: são
// queimas de fundo, cujo único papel é fazer o contador chegar perto do limite. A aritmética da
// fronteira em si (89/90/91, 99/100/101) já é provada de forma determinística e sem servidor
// nenhum por `tests/unit/contador.test.ts` contra `lib/queimas/contador.ts` — não é trabalho do
// e2e reprovar isso a dez toques por viewport.
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

// Insere `quantidade` queimas no forno de nome `nomeDoForno`, todas com `ocorrida_em = now()` e
// autoria do usuário de teste — nunca `registrado_por` nulo, que no schema significa "o usuário
// foi removido" (`on delete set null`), não "ninguém registrou".
//
// Falha ALTO se não inserir exatamente `quantidade` linhas. Um enchimento silenciosamente vazio
// deixaria o forno no nível errado e o teste falharia depois, longe da causa, parecendo
// instabilidade — que é justamente o que este auxiliar existe para não produzir.
export async function semearQueimas(
  nomeDoForno: string,
  quantidade: number,
  emailDoUsuario: string,
): Promise<void> {
  const resultado = await comCliente((cliente) =>
    cliente.query(
      `insert into queimas (forno_id, tipo, ocorrida_em, registrado_por)
       select forno.id, 'biscoito'::tipo_queima, now(), usuario.id
         from fornos forno
         cross join usuarios usuario
         cross join generate_series(1, $2) as enchimento
        where forno.nome = $1
          and lower(usuario.email) = lower($3)`,
      [nomeDoForno, quantidade, emailDoUsuario],
    ),
  );

  if (resultado.rowCount !== quantidade) {
    throw new Error(
      `semearQueimas: esperava inserir ${quantidade} queimas no forno "${nomeDoForno}", ` +
        `mas inseriu ${resultado.rowCount}. Forno ou usuário de teste não encontrado?`,
    );
  }
}

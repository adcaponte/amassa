// As leituras do cadastro de pessoas (D-01). SEM a diretiva de Server Action (Pattern 4): são
// chamadas por Server Components que já chamaram `exigirUsuario()` (T-05-20 — telefone e nome só em
// `/gestao`), e por `lib/clientes/acoes.ts`, que também já chamou. Uma exportação de arquivo com a
// diretiva viraria endpoint chamável pelo navegador.
//
// A busca e o aviso de homônimo comparam `nome_normalizado()` (criada à mão na `0026`: minúsculas,
// sem acento, espaços colapsados) dos DOIS lados — "joao" acha "João". O texto do usuário entra
// sempre como PARÂMETRO do `sql` do Drizzle, nunca concatenado (T-05-19).
import { and, asc, eq, ne, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { clientes } from "@/db/schema";
import { palavrasDaBusca } from "@/lib/busca/casa-com-busca";

import { escaparPadraoDeBusca } from "./lista";

// A transação de `editarCliente` também lê homônimos — o tipo aceita o `db` ou uma transação dele.
type Executor = Pick<typeof db, "select">;

export type ClienteDaLista = {
  id: string;
  nome: string;
  telefone: string | null;
};

export type ListaDeClientes = {
  clientes: ClienteDaLista[];
  // Existe pelo menos mais um além dos `quantos` pedidos — o "Mostrar mais 50" só aparece assim.
  haMais: boolean;
};

// A lista das duas telas (Cadastros → Clientes e Agenda → Pessoas): ordem alfabética pelo nome
// normalizado, desempate pelo id (UI-D23 — homônimos ficam juntos, sempre na mesma ordem), `quantos`
// por vez. Com busca, acha por PEDAÇOS do nome — cada palavra digitada, em qualquer ordem —, sem
// acento e sem diferença de maiúscula.
// `restricao` é uma condição a mais, escrita por quem chama: o seletor de pessoa da Agenda (plano
// 05) tira assim quem já está inscrito na data, sem este módulo conhecer as tabelas da Agenda.
export async function listarClientes({
  busca,
  quantos,
  restricao,
}: {
  busca: string;
  quantos: number;
  restricao?: SQL;
}): Promise<ListaDeClientes> {
  // Uma condição `like` POR PALAVRA, todas precisam casar, em qualquer ordem (D-17): "teixeira
  // bruna" acha "Bruna Teixeira". `palavrasDaBusca` segue a regra de `nome_normalizado()` e para em
  // 10 palavras (T-06.5-19). Cada palavra entra como PARÂMETRO, escapada (T-06.5-18). Sem palavra
  // nenhuma, sem filtro de nome.
  const porPalavra = palavrasDaBusca(busca).map(
    (palavra) =>
      sql`nome_normalizado(${clientes.nome}) like '%' || nome_normalizado(${escaparPadraoDeBusca(palavra)}) || '%' escape '\\'`,
  );
  const filtro = and(...porPalavra, restricao);

  const linhas = await db
    .select({ id: clientes.id, nome: clientes.nome, telefone: clientes.telefone })
    .from(clientes)
    .where(filtro)
    .orderBy(sql`nome_normalizado(${clientes.nome})`, asc(clientes.id))
    // Um a mais do que o pedido: diz se há mais sem uma segunda consulta de contagem.
    .limit(quantos + 1);

  return { clientes: linhas.slice(0, quantos), haMais: linhas.length > quantos };
}

// Um cliente pelo id — `null` se ele não existe (link velho).
export async function obterCliente(id: string): Promise<ClienteDaLista | null> {
  const [linha] = await db
    .select({ id: clientes.id, nome: clientes.nome, telefone: clientes.telefone })
    .from(clientes)
    .where(eq(clientes.id, id));
  return linha ?? null;
}

// Quantos homônimos o aviso mostra no máximo — o telefone de cada um distingue (D-16).
const TETO_DE_HOMONIMOS = 10;

// Os cadastros com o MESMO nome normalizado (D-16: índice não único, homônimo permitido, só avisa).
// `excetoId` tira o próprio cadastro quando se está editando.
export async function buscarHomonimos(
  nome: string,
  excetoId?: string,
  executor: Executor = db,
): Promise<ClienteDaLista[]> {
  const mesmoNome = sql`nome_normalizado(${clientes.nome}) = nome_normalizado(${nome})`;
  return executor
    .select({ id: clientes.id, nome: clientes.nome, telefone: clientes.telefone })
    .from(clientes)
    .where(excetoId === undefined ? mesmoNome : and(mesmoNome, ne(clientes.id, excetoId)))
    .orderBy(asc(clientes.criadoEm), asc(clientes.id))
    .limit(TETO_DE_HOMONIMOS);
}

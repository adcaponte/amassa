// As leituras do cadastro de pessoas (D-01). SEM a diretiva de Server Action (Pattern 4): são
// chamadas por Server Components que já chamaram `exigirUsuario()` (T-05-20 — telefone e nome só em
// `/gestao`), e por `lib/clientes/acoes.ts`, que também já chamou. Uma exportação de arquivo com a
// diretiva viraria endpoint chamável pelo navegador.
//
// A busca e o aviso de homônimo comparam `nome_normalizado()` (criada à mão na `0026`: minúsculas,
// sem acento, espaços colapsados) dos DOIS lados — "joao" acha "João". O texto do usuário entra
// sempre como PARÂMETRO do `sql` do Drizzle, nunca concatenado (T-05-19).
import { and, asc, eq, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { clientes } from "@/db/schema";

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
// por vez. Com busca, acha por PEDAÇO do nome, sem acento e sem diferença de maiúscula.
export async function listarClientes({
  busca,
  quantos,
}: {
  busca: string;
  quantos: number;
}): Promise<ListaDeClientes> {
  const termo = busca.trim();
  const filtro =
    termo === ""
      ? undefined
      : sql`nome_normalizado(${clientes.nome}) like '%' || nome_normalizado(${escaparPadraoDeBusca(termo)}) || '%' escape '\\'`;

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

// Auxiliar de teste de Fornecedores (Fase 06.2): semeia fornecedores e LÊ o que a tela gravou, direto
// do banco de teste, pelo cliente `pg` — mesmo molde de `tests/e2e/apoio/semear-agenda.ts`. Nomes
// sempre inventados, com prefixo `[e2e]` — nenhum dado real no repositório (o repositório é público),
// e nenhum nome do protótipo.
//
// `criado_por`/`atualizado_por` são NOT NULL (0028): a semente grava o id do usuário do e2e (o que o
// globalSetup garante, `E2E_EMAIL_TESTE`), lido do banco — o mesmo que a tela gravaria.
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

// O id do usuário do e2e — quem a tela grava como `criado_por` quando o teste cadastra pela folha.
export async function idDoUsuarioDoTeste(): Promise<string> {
  const email = process.env.E2E_EMAIL_TESTE;
  if (!email) {
    throw new Error("idDoUsuarioDoTeste: E2E_EMAIL_TESTE ausente — quem a define é o globalSetup.");
  }
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{ id: string }>(
      "select id from usuarios where lower(email) = lower($1)",
      [email],
    );
    const id = rows[0]?.id;
    if (!id) {
      throw new Error(`idDoUsuarioDoTeste: nenhum usuário com o e-mail "${email}".`);
    }
    return id;
  });
}

export type AreaDoFornecedorNoTeste = "pecas" | "cafeteria" | "loja" | "espaco" | "geral";

export type FornecedorParaSemear = {
  nome: string;
  vende?: string | null;
  area?: AreaDoFornecedorNoTeste;
  cidadeEntrega?: string | null;
  whatsapp?: string | null;
  pessoaContato?: string | null;
  email?: string | null;
  site?: string | null;
  pagamentoPrazo?: string | null;
  observacoes?: string | null;
  ativo?: boolean;
};

export async function semearFornecedor(dados: FornecedorParaSemear): Promise<string> {
  const usuarioId = await idDoUsuarioDoTeste();
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{ id: string }>(
      `insert into fornecedores
         (nome, vende, area, cidade_entrega, whatsapp, pessoa_contato, email, site, pagamento_prazo,
          observacoes, ativo, criado_por, atualizado_por)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
       returning id`,
      [
        dados.nome,
        dados.vende ?? null,
        dados.area ?? "pecas",
        dados.cidadeEntrega ?? null,
        dados.whatsapp ?? null,
        dados.pessoaContato ?? null,
        dados.email ?? null,
        dados.site ?? null,
        dados.pagamentoPrazo ?? null,
        dados.observacoes ?? null,
        dados.ativo ?? true,
        usuarioId,
      ],
    );
    const id = rows[0]?.id;
    if (!id) {
      throw new Error(`semearFornecedor: falha ao inserir "${dados.nome}".`);
    }
    return id;
  });
}

export type FornecedorNoBanco = {
  id: string;
  nome: string;
  vende: string | null;
  area: AreaDoFornecedorNoTeste;
  ativo: boolean;
  criadoPor: string;
  atualizadoPor: string;
};

// O que o banco tem para um id — `null` se não existe.
export async function fornecedorNoBanco(id: string): Promise<FornecedorNoBanco | null> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<FornecedorNoBanco>(
      `select id, nome, vende, area, ativo, criado_por as "criadoPor", atualizado_por as "atualizadoPor"
         from fornecedores where id = $1`,
      [id],
    );
    return rows[0] ?? null;
  });
}

// Quantos fornecedores (ativos ou não) têm este nome, sem caixa e sem espaço em volta — a mesma
// expressão do índice único `fornecedores_nome_ativo_uk`.
export async function contarFornecedoresComNome(nome: string): Promise<number> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{ total: string }>(
      "select count(*) as total from fornecedores where lower(trim(nome)) = lower(trim($1))",
      [nome],
    );
    return Number(rows[0]?.total ?? 0);
  });
}

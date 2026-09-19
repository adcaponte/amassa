// Auxiliar de teste do módulo Financeiro: insere categorias/itens/ficha técnica/taxa direto no
// banco de teste, pelo cliente `pg` que o projeto já usa (mesmo padrão de
// `tests/e2e/apoio/semear-abertura.ts`/`semear-queimas.ts`). Nasce COMPLETO neste plano
// (04.4-03-PLAN.md) — os planos seguintes só importam; se precisarem de outra semeadura, criam
// arquivo próprio (evita dois planos da mesma onda mexendo no mesmo auxiliar).
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

// Acha uma categoria pelo NOME exato (as 24 categorias da semente de produção — migração 0016 —
// também existem no banco de teste, aplicada pelo mesmo `db/migrate.ts`). Falha alto se não
// achar: um teste que semeia um item contra uma categoria inexistente reprovaria bem mais tarde,
// com uma mensagem que parece bug de aplicação em vez de banco de teste desatualizado.
export async function buscarCategoriaPorNome(nome: string): Promise<string> {
  const id = await comCliente(async (cliente) => {
    const resultado = await cliente.query<{ id: string }>(
      "select id from categorias where nome = $1 limit 1",
      [nome],
    );
    return resultado.rows[0]?.id ?? null;
  });
  if (!id) {
    throw new Error(
      `buscarCategoriaPorNome: nenhuma categoria chamada "${nome}" — migração 0016 aplicada no banco de teste?`,
    );
  }
  return id;
}

export type FichaParaSemear = { insumoId: string; quantidade: string };

export type ItemParaSemear = {
  nome: string;
  // Nome exato da categoria de venda (resolvido por `buscarCategoriaPorNome`) — omitido quando o
  // item não aparece na venda.
  categoriaVenda?: string;
  // Omitido ou `null` = "valor na hora" (preço decidido no balcão).
  precoCentavos?: number | null;
  apareceNaVenda: boolean;
  atalhoVenda: boolean;
  controlaEstoque: boolean;
  unidade?: "un" | "g" | "kg" | "ml" | "l" | "m";
  categoriaCompra?: string;
  atalhoCompra: boolean;
  ficha?: FichaParaSemear[];
};

// Insere um item do catálogo (e, se `ficha` vier preenchida, a ficha técnica dele) — falha alto
// se não inserir exatamente uma linha.
export async function semearItem(dados: ItemParaSemear): Promise<string> {
  const categoriaVendaId = dados.categoriaVenda
    ? await buscarCategoriaPorNome(dados.categoriaVenda)
    : null;
  const categoriaCompraId = dados.categoriaCompra
    ? await buscarCategoriaPorNome(dados.categoriaCompra)
    : null;

  const id = await comCliente(async (cliente) => {
    const resultado = await cliente.query<{ id: string }>(
      `insert into itens_catalogo
         (nome, categoria_venda_id, preco_venda_centavos, aparece_na_venda, atalho_venda,
          controla_estoque, unidade, categoria_compra_id, atalho_compra)
       values ($1, $2, $3, $4, $5, $6, $7::unidade_estoque, $8, $9)
       returning id`,
      [
        dados.nome,
        categoriaVendaId,
        dados.precoCentavos ?? null,
        dados.apareceNaVenda,
        dados.atalhoVenda,
        dados.controlaEstoque,
        dados.unidade ?? null,
        categoriaCompraId,
        dados.atalhoCompra,
      ],
    );
    return resultado.rows[0]?.id;
  });

  if (!id) {
    throw new Error(`semearItem: falha ao inserir o item "${dados.nome}".`);
  }

  const ficha = dados.ficha ?? [];
  if (ficha.length > 0) {
    const linhasInseridas = await comCliente(async (cliente) => {
      const resultado = await cliente.query(
        `insert into ficha_tecnica (item_id, insumo_id, quantidade)
         select $1, dado.insumo_id, dado.quantidade::numeric
           from jsonb_to_recordset($2::jsonb) as dado(insumo_id uuid, quantidade text)`,
        [id, JSON.stringify(ficha.map((f) => ({ insumo_id: f.insumoId, quantidade: f.quantidade })))],
      );
      return resultado.rowCount;
    });
    if (linhasInseridas !== ficha.length) {
      throw new Error(
        `semearItem: esperava inserir ${ficha.length} linha(s) de ficha técnica para "${dados.nome}", mas inseriu ${linhasInseridas}.`,
      );
    }
  }

  return id;
}

// Muda o preço de tabela DEPOIS de o item já existir — usado para provar que a venda já lançada
// não muda (BRIEFING §5).
export async function definirPrecoDoItem(id: string, centavos: number): Promise<void> {
  await comCliente((cliente) =>
    cliente.query("update itens_catalogo set preco_venda_centavos = $1 where id = $2", [
      centavos,
      id,
    ]),
  );
}

// 3,5% em pontos-base — a MESMA taxa em toda a suíte do plano 02 (regra já registrada em
// 04.4-02-SUMMARY.md: todo teste que escreve a taxa escreve 350), para nenhum teste desta fase
// depender de qual taxa "está lá" no momento em que roda.
export const TAXA_DE_TESTE = 350;

export async function garantirTaxaDeTeste(): Promise<void> {
  await comCliente((cliente) =>
    cliente.query(
      `insert into configuracao_financeira (linha_unica, taxa_cartao_pontos_base)
       values (true, $1)
       on conflict (linha_unica) do update set taxa_cartao_pontos_base = excluded.taxa_cartao_pontos_base`,
      [TAXA_DE_TESTE],
    ),
  );
}

// O CI roda em UTC e o servidor em Brasília — perto da meia-noite, um "hoje" calculado em UTC
// erra o dia civil e reprova o teste sem defeito nenhum. `Intl.DateTimeFormat` com o fuso
// explícito é o mesmo cuidado de `lib/financeiro/formato.ts::hojeEmBrasilia`, redeclarado aqui
// porque este arquivo roda fora do bundle da aplicação (script de apoio ao e2e).
export function hojeNoAtelie(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Soma `n` dias de calendário (pode ser negativo) ao dia civil de `hojeNoAtelie()`, em aritmética
// UTC pura — nunca desloca de fuso porque nunca lê o relógio de novo.
export function somarDiasAoHoje(n: number): string {
  const [ano, mes, dia] = hojeNoAtelie().split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia + n));
  return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(data);
}

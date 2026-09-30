// Auxiliar de teste do Estoque (Fase 06): semeia materiais e LÊ o livro direto do banco de teste,
// pelo cliente `pg` — mesmo molde de `tests/e2e/apoio/semear-financeiro.ts`, cujo `semearItem` é
// reusado (o material É um item do catálogo com estoque próprio — D-01; não existe tabela de
// materiais). Nomes sempre inventados, com prefixo `[e2e]` — nenhum dado real no repositório.
//
// O livro só se escreve pela tela (a porta única `lib/estoque/gravacao.ts`): este auxiliar lê o
// livro para o teste conferir o que ficou gravado. A ÚNICA exceção é `semearMovimentacoesEmMassa`
// (plano 06-07), que insere entradas manuais válidas em volume só para provar a paginação do
// Histórico — 51 folhas pela tela custariam minutos e não provariam nada a mais.
import { Client } from "pg";

import { semearItem } from "./semear-financeiro";
import { diaEmBrasilia, semearOrdem } from "./semear-producao";

async function comCliente<T>(operacao: (cliente: Client) => Promise<T>): Promise<T> {
  const cliente = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
  await cliente.connect();
  try {
    return await operacao(cliente);
  } finally {
    await cliente.end();
  }
}

export type MaterialParaSemear = {
  nome: string;
  unidade: "un" | "g" | "kg" | "ml" | "l" | "m";
  // Nome exato de uma categoria de COMPRA da semente 0016 (ex.: "Argila, esmalte e insumos").
  categoriaCompra: string;
  minimoMilesimos?: number;
};

// Um material: controla estoque, não aparece na venda. Devolve o id do item.
export async function semearMaterial(dados: MaterialParaSemear): Promise<string> {
  const id = await semearItem({
    nome: dados.nome,
    apareceNaVenda: false,
    atalhoVenda: false,
    controlaEstoque: true,
    unidade: dados.unidade,
    categoriaCompra: dados.categoriaCompra,
    atalhoCompra: false,
  });

  if (dados.minimoMilesimos !== undefined) {
    await comCliente((cliente) =>
      cliente.query("update itens_catalogo set estoque_minimo_milesimos = $1 where id = $2", [
        dados.minimoMilesimos,
        id,
      ]),
    );
  }
  return id;
}

export type MovimentacaoNoBanco = {
  id: string;
  numero: number;
  origem: string;
  tipo: string;
  destino: string | null;
  area: string | null;
  quantidadeMilesimos: number;
  valorCentavos: number;
  valorInformadoCentavos: number | null;
  // Vínculos com o Financeiro (plano 06-03): venda e compra apontam o documento e a linha; o
  // estorno aponta a movimentação que ele espelha.
  documentoId: string | null;
  documentoLinhaId: string | null;
  estornoDeId: string | null;
};

// As linhas do livro de um item, na ORDEM DO LIVRO (`numero`, nunca `criado_em`). `bigint` volta
// como texto do `pg` — convertido aqui.
export async function movimentacoesDoItem(itemId: string): Promise<MovimentacaoNoBanco[]> {
  return comCliente(async (cliente) => {
    const resultado = await cliente.query<{
      id: string;
      numero: string;
      origem: string;
      tipo: string;
      destino: string | null;
      area: string | null;
      quantidade_milesimos: string;
      valor_centavos: string;
      valor_informado_centavos: string | null;
      documento_id: string | null;
      documento_linha_id: string | null;
      estorno_de_id: string | null;
    }>(
      `select id, numero, origem, tipo, destino, area, quantidade_milesimos, valor_centavos,
              valor_informado_centavos, documento_id, documento_linha_id, estorno_de_id
         from movimentacoes_estoque
        where item_id = $1
        order by numero`,
      [itemId],
    );
    return resultado.rows.map((linha) => ({
      id: linha.id,
      numero: Number(linha.numero),
      origem: linha.origem,
      tipo: linha.tipo,
      destino: linha.destino,
      area: linha.area,
      quantidadeMilesimos: Number(linha.quantidade_milesimos),
      valorCentavos: Number(linha.valor_centavos),
      valorInformadoCentavos:
        linha.valor_informado_centavos === null ? null : Number(linha.valor_informado_centavos),
      documentoId: linha.documento_id,
      documentoLinhaId: linha.documento_linha_id,
      estornoDeId: linha.estorno_de_id,
    }));
  });
}

// O saldo do item pela MESMA regra da aplicação: a soma do livro.
export async function saldoNoBanco(itemId: string): Promise<number> {
  return comCliente(async (cliente) => {
    const resultado = await cliente.query<{ saldo: string }>(
      "select coalesce(sum(quantidade_milesimos), 0) as saldo from movimentacoes_estoque where item_id = $1",
      [itemId],
    );
    return Number(resultado.rows[0]?.saldo ?? 0);
  });
}

// Desativa um material direto no banco de teste — SÓ para montar o cenário do filtro
// "Desativados" (plano 06-04). A ação de desativar de verdade, com a confirmação da UI-SPEC, é do
// plano 06-08; este auxiliar não a substitui nem a prova.
export async function desativarNoBanco(itemId: string): Promise<void> {
  await comCliente((cliente) =>
    cliente.query("update itens_catalogo set ativo = false where id = $1", [itemId]),
  );
}

// Uma ordem de produção DA CASA, ATIVA (começou hoje, nenhuma etapa feita), para o vínculo "Qual
// ordem?" da saída "Consumo em encomenda" (Fase 06.1, plano 02 — substitui o auxiliar antigo,
// que semeava a tabela `encomendas`). Nome inventado, prefixo `[e2e]`. Devolve o id.
export async function semearOrdemAtiva(nome: string): Promise<string> {
  return semearOrdem({
    nome,
    tipo: "casa",
    caminho: "completo",
    status: "ativa",
    inicio: diaEmBrasilia(),
    etapasFeitas: [],
    pecas: [{ descricao: "[e2e] Caneca da ordem", quantidade: 4 }],
  });
}

export type DadosDaFicha = {
  argilaMiligramas: number;
  esmalteMiligramas: number;
  horasMilesimos: number;
  embalagemCentavos: number;
  // "Já contei" — quantas cabem por fornada, para o custo não depender das medidas do forno.
  cabemPorFornada: number;
};

const FICHA_PADRAO: DadosDaFicha = {
  argilaMiligramas: 400000,
  esmalteMiligramas: 50000,
  horasMilesimos: 500,
  embalagemCentavos: 200,
  cabemPorFornada: 10,
};

// Liga uma ficha de precificação NÃO exclusiva ao item — é isso que faz dele uma "peça pronta"
// (D-29) e dá o custo por peça que a entrada manual traz preenchido (EST-21, plano 06-06). A ficha
// é criada em nome do primeiro usuário do banco de teste (o `criado_por` é obrigatório).
export async function ligarFichaDePrecificacao(
  itemId: string,
  dados: Partial<DadosDaFicha> = {},
): Promise<string> {
  const ficha = { ...FICHA_PADRAO, ...dados };
  return comCliente(async (cliente) => {
    const resultado = await cliente.query<{ id: string }>(
      `insert into fichas_precificacao
         (nome, argila_miligramas, esmalte_miligramas, horas_milesimos, embalagem_centavos,
          largura_mm, profundidade_mm, altura_mm,
          cabem_biscoito_informado, cabem_esmalte_informado, exclusiva, item_catalogo_id,
          criado_por)
       values ($1, $2, $3, $4, $5, 100, 100, 100, $6, $6, false, $7,
               (select id from usuarios order by criado_em limit 1))
       returning id`,
      [
        `[e2e] Ficha ${itemId.slice(0, 8)}`,
        ficha.argilaMiligramas,
        ficha.esmalteMiligramas,
        ficha.horasMilesimos,
        ficha.embalagemCentavos,
        ficha.cabemPorFornada,
        itemId,
      ],
    );
    return resultado.rows[0].id;
  });
}

// As notas e os vínculos gravados nas linhas do livro (plano 06-06): o nome da encomenda congelado
// em `nota`, a turma, "o que aconteceu?", o motivo do ajuste e o SALDO CONTADO do ajuste.
export type VinculoNoBanco = {
  nota: string | null;
  encomendaId: string | null;
  saldoContadoMilesimos: number | null;
  motivo: string | null;
};

export async function vinculosDoItem(itemId: string): Promise<VinculoNoBanco[]> {
  return comCliente(async (cliente) => {
    const resultado = await cliente.query<{
      nota: string | null;
      encomenda_id: string | null;
      saldo_contado_milesimos: string | null;
      motivo: string | null;
    }>(
      `select nota, encomenda_id, saldo_contado_milesimos, motivo::text as motivo
         from movimentacoes_estoque
        where item_id = $1
        order by numero`,
      [itemId],
    );
    return resultado.rows.map((linha) => ({
      nota: linha.nota,
      encomendaId: linha.encomenda_id,
      saldoContadoMilesimos:
        linha.saldo_contado_milesimos === null ? null : Number(linha.saldo_contado_milesimos),
      motivo: linha.motivo,
    }));
  });
}

// Insere `quantas` entradas manuais de 1 unidade por R$ 1,00 (valor informado igual ao gravado,
// preço constante: o custo médio fica coerente) num item DO PRÓPRIO TESTE, em nome da conta de
// `usuarioEmail` — SÓ para provar a paginação do Histórico (50 por vez + "Mostrar mais 50",
// plano 06-07). Um `insert` só, pela `generate_series`; cada linha ganha o seu `numero` da
// identity. Respeita todos os `check`s da 0023 (entrada manual: sem destino, sem área, com valor
// informado).
export async function semearMovimentacoesEmMassa(
  itemId: string,
  quantas: number,
  usuarioEmail: string,
): Promise<void> {
  await comCliente((cliente) =>
    cliente.query(
      `insert into movimentacoes_estoque
         (item_id, origem, tipo, quantidade_milesimos, valor_centavos, valor_informado_centavos,
          registrado_por)
       select $1, 'manual', 'entrada', 1000, 100, 100,
              (select id from usuarios where lower(email) = lower($3))
         from generate_series(1, $2::int)`,
      [itemId, quantas, usuarioEmail],
    ),
  );
}

// O nome da conta de teste, como o Histórico o mostra em "Hoje, 14:32 · {nome}".
export async function nomeDoUsuario(email: string): Promise<string> {
  return comCliente(async (cliente) => {
    const resultado = await cliente.query<{ nome: string }>(
      "select nome from usuarios where lower(email) = lower($1)",
      [email],
    );
    return resultado.rows[0]?.nome ?? "";
  });
}

// Um material SEM nenhuma movimentação (plano 06-10) — o que "Ainda sem contagem" e a primeira
// abertura pedem. É o próprio `semearMaterial` (que nunca escreve no livro); o nome existe para o
// teste dizer o que precisa, e para continuar certo se um dia `semearMaterial` passar a dar saldo.
export async function semearMaterialSemMovimentacao(dados: MaterialParaSemear): Promise<string> {
  return semearMaterial(dados);
}

export type ContagemNoBanco = {
  origem: string;
  tipo: string;
  motivo: string | null;
  quantidadeMilesimos: number;
  valorInformadoCentavos: number | null;
  saldoContadoMilesimos: number | null;
};

// O que a contagem gravou para um item: motivo e saldo contado, na ordem do livro (plano 06-10).
export async function contagensDoItem(itemId: string): Promise<ContagemNoBanco[]> {
  return comCliente(async (cliente) => {
    const resultado = await cliente.query<{
      origem: string;
      tipo: string;
      motivo: string | null;
      quantidade_milesimos: string;
      valor_informado_centavos: string | null;
      saldo_contado_milesimos: string | null;
    }>(
      `select origem, tipo, motivo, quantidade_milesimos, valor_informado_centavos,
              saldo_contado_milesimos
         from movimentacoes_estoque
        where item_id = $1
        order by numero`,
      [itemId],
    );
    return resultado.rows.map((linha) => ({
      origem: linha.origem,
      tipo: linha.tipo,
      motivo: linha.motivo,
      quantidadeMilesimos: Number(linha.quantidade_milesimos),
      valorInformadoCentavos:
        linha.valor_informado_centavos === null ? null : Number(linha.valor_informado_centavos),
      saldoContadoMilesimos:
        linha.saldo_contado_milesimos === null ? null : Number(linha.saldo_contado_milesimos),
    }));
  });
}

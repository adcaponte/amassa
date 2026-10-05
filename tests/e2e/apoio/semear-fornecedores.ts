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

// Quantos fornecedores (ativos ou não) têm este nome, sem caixa, acento nem espaço sobrando — a
// mesma expressão do índice único `fornecedores_nome_ativo_uk` (`nome_normalizado`, D-06).
export async function contarFornecedoresComNome(nome: string): Promise<number> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{ total: string }>(
      "select count(*) as total from fornecedores where nome_normalizado(nome) = nome_normalizado($1)",
      [nome],
    );
    return Number(rows[0]?.total ?? 0);
  });
}

// O `ativo` de um fornecedor no banco (plano 06.2-04) — `null` se a linha NÃO existe. Desativar nunca
// apaga (FRN-03): depois de desativar, o teste espera `false`, nunca `null`.
export async function ativoNoBanco(id: string): Promise<boolean | null> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{ ativo: boolean }>("select ativo from fornecedores where id = $1", [
      id,
    ]);
    return rows[0]?.ativo ?? null;
  });
}

export type AnexoNoBanco = {
  id: string;
  nome: string;
  tipo: "tabela" | "catalogo" | "nota" | "outro";
  valeDesde: string | null;
  nota: string | null;
  arquivoCaminho: string;
  arquivoTipo: string;
  arquivoBytes: number;
  extensao: string;
  criadoPor: string;
};

// Os anexos de um fornecedor como o banco os tem (plano 06.2-05), do mais antigo ao mais novo. A data
// sai como texto (`to_char`), nunca convertida pelo fuso do processo do teste.
export async function anexosNoBanco(fornecedorId: string): Promise<AnexoNoBanco[]> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<AnexoNoBanco>(
      `select id, nome, tipo, to_char(vale_desde, 'YYYY-MM-DD') as "valeDesde", nota,
              arquivo_caminho as "arquivoCaminho", arquivo_tipo as "arquivoTipo",
              arquivo_bytes as "arquivoBytes", extensao, criado_por as "criadoPor"
         from fornecedor_anexos where fornecedor_id = $1
        order by criado_em, id`,
      [fornecedorId],
    );
    return rows;
  });
}

// Quantos anexos um fornecedor tem — o "nada gravado" das recusas olha só o fornecedor do teste.
export async function contarAnexos(fornecedorId: string): Promise<number> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{ total: string }>(
      "select count(*) as total from fornecedor_anexos where fornecedor_id = $1",
      [fornecedorId],
    );
    return Number(rows[0]?.total ?? 0);
  });
}

// Uma LINHA de anexo cujo arquivo não existe no disco (UI E4·error: restauração parcial do backup). Só
// o banco é semeado — nenhum arquivo é escrito em disco por aqui (no CI o app roda num contêiner). O
// nome do arquivo é um uuid novo, que nunca foi gravado. `extensao` "xlsx" (quick 261005-2yu) semeia uma
// planilha — a linha mostra "Baixar", que navega na MESMA aba (06.2-WR-02).
export async function semearAnexoSemArquivo(
  fornecedorId: string,
  nome: string,
  extensao: "pdf" | "xlsx" = "pdf",
): Promise<string> {
  const usuarioId = await idDoUsuarioDoTeste();
  const mime =
    extensao === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf";
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{ id: string }>(
      `insert into fornecedor_anexos
         (fornecedor_id, nome, tipo, arquivo_caminho, arquivo_tipo, arquivo_bytes, extensao, criado_por)
       values ($1, $2, 'catalogo', gen_random_uuid()::text || '.' || $4, $5, 1024, $4, $3)
       returning id`,
      [fornecedorId, nome, usuarioId, extensao, mime],
    );
    const id = rows[0]?.id;
    if (!id) {
      throw new Error(`semearAnexoSemArquivo: falha ao inserir "${nome}".`);
    }
    return id;
  });
}

// ——— A tabela vigente e o tirar anexo (plano 06.2-08). ———

// Envelhece (ou adianta) o "vale desde" de um anexo de tabela — o anexo sobe pela folha ou pelo PUT, e
// só a DATA é trocada aqui. `data` é um dia civil "YYYY-MM-DD" calculado por `somarDiasAoHoje` (o dia de
// Brasília), nunca pelo dia UTC. Só serve para `tipo = 'tabela'` (o check da 0028 recusa nos outros).
export async function definirValeDesdeNoBanco(anexoId: string, data: string): Promise<void> {
  await comCliente(async (cliente) => {
    const { rowCount } = await cliente.query("update fornecedor_anexos set vale_desde = $2::date where id = $1", [
      anexoId,
      data,
    ]);
    if (rowCount !== 1) {
      throw new Error(`definirValeDesdeNoBanco: nenhum anexo com o id "${anexoId}".`);
    }
  });
}

// Se a LINHA do anexo ainda existe no banco — depois de tirar, o teste espera `false`.
export async function anexoExisteNoBanco(id: string): Promise<boolean> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{ existe: boolean }>(
      "select exists (select 1 from fornecedor_anexos where id = $1) as existe",
      [id],
    );
    return rows[0]?.existe ?? false;
  });
}

// Desativa (ou reativa) um fornecedor direto no banco — para o caso "desativado COM anexo" (UI-D24): o
// PUT recusa fornecedor desativado, então o anexo sobe antes, com ele ativo, e só depois ele é desativado.
export async function definirAtivoNoBanco(id: string, ativo: boolean): Promise<void> {
  await comCliente(async (cliente) => {
    const { rowCount } = await cliente.query("update fornecedores set ativo = $2 where id = $1", [id, ativo]);
    if (rowCount !== 1) {
      throw new Error(`definirAtivoNoBanco: nenhum fornecedor com o id "${id}".`);
    }
  });
}

// ——— A despesa ligada ao fornecedor (plano 06.2-10, D-04). ———

export type DocumentoNoBanco = {
  tipo: "venda" | "despesa";
  fornecedorId: string | null;
  pessoaNome: string | null;
};

// O que o banco tem de um documento do Financeiro — o vínculo com o fornecedor e o nome gravado. `null`
// se o id não existe.
export async function documentoNoBanco(id: string): Promise<DocumentoNoBanco | null> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<DocumentoNoBanco>(
      `select tipo, fornecedor_id as "fornecedorId", pessoa_nome as "pessoaNome"
         from documentos where id = $1`,
      [id],
    );
    return rows[0] ?? null;
  });
}

// O id do ÚNICO documento que tem uma linha com esta descrição — a compra lançada pela tela, achada pelo
// nome do material semeado (único por teste). A URL com `?documento=` não serve: o aviso do Financeiro a
// limpa no mesmo instante em que mostra o toast.
export async function idDoDocumentoComLinha(descricao: string): Promise<string> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{ id: string }>(
      "select distinct documento_id as id from documento_linhas where descricao = $1",
      [descricao],
    );
    if (rows.length !== 1) {
      throw new Error(`idDoDocumentoComLinha: esperava 1 documento com a linha "${descricao}", achou ${rows.length}.`);
    }
    return rows[0].id;
  });
}

// Renomeia um fornecedor direto no banco — para provar que a despesa já lançada guarda o nome antigo.
export async function renomearFornecedorNoBanco(id: string, nome: string): Promise<void> {
  await comCliente(async (cliente) => {
    const { rowCount } = await cliente.query("update fornecedores set nome = $2 where id = $1", [id, nome]);
    if (rowCount !== 1) {
      throw new Error(`renomearFornecedorNoBanco: nenhum fornecedor com o id "${id}".`);
    }
  });
}

// ——— "Compras dele" (plano 06.2-11, FRN-13). ———

export type DespesaDoFornecedorParaSemear = {
  fornecedorId: string;
  // O nome congelado em `pessoa_nome` — o do cadastro, como `lancarDespesa` grava.
  nome: string;
  // Dia civil "YYYY-MM-DD" — calculado por `hojeNoAtelie`/`somarDiasAoHoje` (Brasília), nunca o dia UTC.
  data: string;
  valorCentavos: number;
  // O texto da única linha ("Outra despesa": sem item) — quem chama embute "[e2e] … {sufixo}".
  descricao: string;
};

// Uma despesa ligada a um fornecedor, direto no banco de teste — o molde de `semear-documento-antigo.ts`:
// uma transação, documento → linha → parcela paga, com a soma das parcelas igual à das linhas (a
// restrição adiada `conferir_soma_do_documento()` confere no `commit`). Serve para datar a despesa no
// passado (31/12 do ano anterior, 01/01) e para ter muitas sem passar 12 vezes pela tela. Devolve o id.
export async function semearDespesaDoFornecedor(dados: DespesaDoFornecedorParaSemear): Promise<string> {
  const usuarioId = await idDoUsuarioDoTeste();
  return comCliente(async (cliente) => {
    const categoria = await cliente.query<{ id: string }>(
      "select id from categorias where nome = 'Argila, esmalte e insumos' limit 1",
    );
    const categoriaId = categoria.rows[0]?.id;
    if (!categoriaId) {
      throw new Error("semearDespesaDoFornecedor: a categoria “Argila, esmalte e insumos” (0016) não existe.");
    }

    await cliente.query("begin");
    try {
      const { rows } = await cliente.query<{ id: string }>(
        `insert into documentos (tipo, data, pessoa_nome, fornecedor_id, criado_por)
         values ('despesa'::tipo_documento, $1, $2, $3, $4)
         returning id`,
        [dados.data, dados.nome, dados.fornecedorId, usuarioId],
      );
      const documentoId = rows[0].id;

      await cliente.query(
        `insert into documento_linhas (documento_id, ordem, descricao, categoria_id, quantidade, valor_centavos)
         values ($1, 0, $2, $3, 1, $4)`,
        [documentoId, dados.descricao, categoriaId, dados.valorCentavos],
      );

      await cliente.query(
        `insert into parcelas (documento_id, numero, vencimento, valor_centavos, forma, pago_em, pago_por)
         values ($1, 1, $2, $3, 'pix'::forma_pagamento, $2, $4)`,
        [documentoId, dados.data, dados.valorCentavos, usuarioId],
      );

      await cliente.query("commit");
      return documentoId;
    } catch (erro) {
      await cliente.query("rollback");
      throw erro;
    }
  });
}

// Cancela um documento como o Caixa grava (`cancelarDocumento`): `cancelado_em` e `cancelado_por`
// juntos (o check `documentos_cancelado_em_e_por_juntos`), nada apagado. Só para despesa sem
// movimentação de estoque (as semeadas acima) — o estorno do Estoque é da ação, não daqui.
export async function cancelarNoBanco(documentoId: string): Promise<void> {
  const usuarioId = await idDoUsuarioDoTeste();
  await comCliente(async (cliente) => {
    const { rowCount } = await cliente.query(
      "update documentos set cancelado_em = now(), cancelado_por = $2 where id = $1 and cancelado_em is null",
      [documentoId, usuarioId],
    );
    if (rowCount !== 1) {
      throw new Error(`cancelarNoBanco: nenhum documento não cancelado com o id "${documentoId}".`);
    }
  });
}

// ——— O campo "Fornecedor" em todos os modos da Despesa (plano 06.2-12, Pitfall 15). ———

// Desativa um fornecedor direto no banco, no meio de um fluxo da tela (entre escolher e lançar, ou entre
// gravar o rascunho e recarregar) — o mesmo `ativo = false` que "Desativar" grava pela ficha.
export async function desativarFornecedorNoBanco(id: string): Promise<void> {
  await definirAtivoNoBanco(id, false);
}

// Quantos documentos têm uma linha com esta descrição — prova que um lançamento NÃO aconteceu (0) ou
// aconteceu uma vez só (1). A descrição carrega o sufixo único do teste.
export async function contarDocumentosComLinha(descricao: string): Promise<number> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{ quantos: string }>(
      "select count(distinct documento_id) as quantos from documento_linhas where descricao = $1",
      [descricao],
    );
    return Number(rows[0]?.quantos ?? 0);
  });
}

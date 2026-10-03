// Auxiliar de teste dos Lembretes (Fase 06.3): LÊ o que a tela gravou, direto do banco de teste, pelo
// cliente `pg` — mesmo molde de `tests/e2e/apoio/semear-fornecedores.ts`. Textos sempre inventados,
// com prefixo `[e2e]` — nenhum dado real no repositório (o repositório é público), e nenhum texto,
// nome ou fornecedor do protótipo.
//
// `criado_por` é NOT NULL (0029): quem a tela grava é o usuário do e2e (o que o globalSetup garante,
// `E2E_EMAIL_TESTE`) — `idDoUsuarioDoTeste` vem de `./semear-fornecedores`, sem cópia.
//
// "Hoje", quando um teste precisar, vem de `hojeNoAtelie()`/`somarDiasAoHoje()`
// (`./semear-financeiro`), nunca do dia UTC do relógio.
import { Client } from "pg";

export { idDoUsuarioDoTeste } from "./semear-fornecedores";

async function comCliente<T>(operacao: (cliente: Client) => Promise<T>): Promise<T> {
  const cliente = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
  await cliente.connect();
  try {
    return await operacao(cliente);
  } finally {
    await cliente.end();
  }
}

// Uma linha de `lembretes` como o banco a guarda (dia civil em texto; instantes como o `pg` os
// devolve). `null` quando a linha não existe.
export type LembreteNoBanco = {
  id: string;
  texto: string;
  para_quando: string | null;
  quem: string | null;
  criado_por: string;
  feito_em: Date | null;
  feito_por: string | null;
};

const COLUNAS = "id, texto, para_quando::text as para_quando, quem, criado_por, feito_em, feito_por";

export async function lerLembrete(id: string): Promise<LembreteNoBanco | null> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<LembreteNoBanco>(
      `select ${COLUNAS} from lembretes where id = $1`,
      [id],
    );
    return rows[0] ?? null;
  });
}

// Pelo texto (os testes usam texto único, com sufixo do projeto e do instante).
export async function lerLembretePorTexto(texto: string): Promise<LembreteNoBanco | null> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<LembreteNoBanco>(
      `select ${COLUNAS} from lembretes where texto = $1 order by criado_em desc limit 1`,
      [texto],
    );
    return rows[0] ?? null;
  });
}

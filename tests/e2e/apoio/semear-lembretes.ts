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

import { idDoUsuarioDoTeste } from "./semear-fornecedores";

export { idDoUsuarioDoTeste };

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

const COLUNAS =
  "id, texto, para_quando::text as para_quando, quem, criado_por, feito_em, feito_por";

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
export async function lerLembretePorTexto(
  texto: string,
): Promise<LembreteNoBanco | null> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<LembreteNoBanco>(
      `select ${COLUNAS} from lembretes where texto = $1 order by criado_em desc limit 1`,
      [texto],
    );
    return rows[0] ?? null;
  });
}

// ---------------------------------------------------------------------------------------------
// A trava dos Lembretes (plano 06.3-03, Pitfall 5 da pesquisa). "6 + e mais N", "N abertos · M
// vencidos" e o estado vazio são contagens GLOBAIS da tabela `lembretes` — não existe uma linha
// "própria de cada teste" para isolar. Os projetos `desktop` e `celular` rodam em paralelo contra o
// MESMO banco; sem exclusão mútua, um projeto semeando 7 lembretes no meio da contagem do outro
// produziria um "8 abertos" FALSO — não é instabilidade, é a disputa por estado global que o
// CLAUDE.md manda resolver com ordem explícita, nunca `--grep`.
//
// Regra: TODO spec `lembretes-*` que escreve na tabela usa ESTA MESMA trava, em `beforeAll`/
// `afterAll` de um `describe` com `mode: "serial"`, e só chama `limparLembretes()` dentro dela.
// Molde: `./travar-anotacoes.ts`. Chave nova, conferida contra as em uso (`819_224`, `726623`,
// `480_260_811`, `5_020_014`, `5_020_017`) com
// `grep -rn "pg_advisory_lock\|CHAVE_\|TRAVA_" tests/e2e/apoio`.
export const CHAVE_LOCK_LEMBRETES = 6_030_003;

let clienteDoLock: Client | null = null;

export async function travarLembretesParaTeste(): Promise<void> {
  clienteDoLock = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
  await clienteDoLock.connect();
  await clienteDoLock.query("select pg_advisory_lock($1)", [CHAVE_LOCK_LEMBRETES]);
}

export async function destravarLembretesDeTeste(): Promise<void> {
  if (!clienteDoLock) return;
  await clienteDoLock.query("select pg_advisory_unlock($1)", [CHAVE_LOCK_LEMBRETES]);
  await clienteDoLock.end();
  clienteDoLock = null;
}

// Esvazia a tabela. SÓ dentro da trava. Seguro porque a tabela é desta fase (nenhum outro módulo
// lê ou escreve nela) e o banco do e2e é efêmero — nunca o banco real.
export async function limparLembretes(): Promise<void> {
  await comCliente((cliente) => cliente.query("delete from lembretes"));
}

export type LembreteParaSemear = {
  texto: string;
  // Dia civil `AAAA-MM-DD` — de `hojeNoAtelie()`/`somarDiasAoHoje(n)`, nunca do dia UTC do relógio.
  paraQuando?: string | null;
  quem?: string | null;
  // Instante ISO; sem ele, o `now()` do banco.
  criadoEm?: string;
  // Instante ISO; com ele, `feito_por` = o usuário do e2e (o check `lembretes_feito_coerente`).
  feitoEm?: string | null;
};

// Insere um lembrete com `criado_por` = o usuário do e2e. Devolve o id.
export async function semearLembrete(dados: LembreteParaSemear): Promise<string> {
  const usuarioId = await idDoUsuarioDoTeste();
  return comCliente(async (cliente) => {
    const feitoEm = dados.feitoEm ?? null;
    const { rows } = await cliente.query<{ id: string }>(
      `insert into lembretes (texto, para_quando, quem, criado_em, criado_por, feito_em, feito_por)
       values ($1, $2::date, $3, coalesce($4::timestamptz, now()), $5, $6::timestamptz, $7)
       returning id`,
      [
        dados.texto,
        dados.paraQuando ?? null,
        dados.quem ?? null,
        dados.criadoEm ?? null,
        usuarioId,
        feitoEm,
        feitoEm === null ? null : usuarioId,
      ],
    );
    return rows[0].id;
  });
}

export async function contarLembretes(): Promise<number> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{ total: string }>(
      "select count(*)::text as total from lembretes",
    );
    return Number(rows[0]?.total ?? "0");
  });
}

// ---------------------------------------------------------------------------------------------
// Pessoas de teste (plano 06.3-03): as pílulas de "De quem é o lembrete" vêm de `usuarios` ativos,
// então o caso "a pessoa foi desativada entre abrir a página e guardar" precisa de uma pessoa que
// possa ser desativada sem derrubar a sessão do e2e. Criada direto em `usuarios`, com nome `[e2e]`,
// e-mail único num domínio que não existe (`.invalid`, RFC 2606) e um `senha_hash` que NÃO é hash
// de senha nenhuma — ninguém entra com essa conta. Usuário nunca se apaga (AUTH-09): desativar é só
// `ativo = false`, no molde de `./alternar-ativo.ts`.
export async function criarPessoaDeTeste(nome: string): Promise<string> {
  const email = `e2e-pessoa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.invalid`;
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{ id: string }>(
      `insert into usuarios (nome, email, senha_hash, ativo)
       values ($1, $2, '[e2e] não é hash de senha — ninguém entra com esta conta', true)
       returning id`,
      [nome, email],
    );
    return rows[0].id;
  });
}

export async function desativarPessoaDeTeste(id: string): Promise<void> {
  await comCliente((cliente) =>
    cliente.query("update usuarios set ativo = false where id = $1", [id]),
  );
}

// Simula OUTRA pessoa excluindo o lembrete (plano 06.3-04): apaga a linha direto no banco de teste,
// por baixo da tela que ainda a mostra. Só dentro da trava.
export async function apagarLembreteDireto(id: string): Promise<void> {
  await comCliente((cliente) => cliente.query("delete from lembretes where id = $1", [id]));
}

// Vários lembretes de uma vez, numa conexão só (plano 06.3-05: os 51 abertos do "Mostrar mais 50").
// Mesma regra de `semearLembrete`: `criado_por` (e `feito_por`, quando feito) = o usuário do e2e.
// Devolve os ids na ordem da lista. Só dentro da trava.
export async function semearVariosLembretes(
  lista: readonly LembreteParaSemear[],
): Promise<string[]> {
  const usuarioId = await idDoUsuarioDoTeste();
  return comCliente(async (cliente) => {
    const ids: string[] = [];
    for (const dados of lista) {
      const feitoEm = dados.feitoEm ?? null;
      const { rows } = await cliente.query<{ id: string }>(
        `insert into lembretes (texto, para_quando, quem, criado_em, criado_por, feito_em, feito_por)
         values ($1, $2::date, $3, coalesce($4::timestamptz, now()), $5, $6::timestamptz, $7)
         returning id`,
        [
          dados.texto,
          dados.paraQuando ?? null,
          dados.quem ?? null,
          dados.criadoEm ?? null,
          usuarioId,
          feitoEm,
          feitoEm === null ? null : usuarioId,
        ],
      );
      ids.push(rows[0].id);
    }
    return ids;
  });
}

// `anotacoes_da_casa` é uma folha ÚNICA, compartilhada por toda a casa (D-08) — não existe uma
// linha "própria de cada teste" para isolar, no mesmo problema que `execucoes_backup` já
// resolveu (ver o comentário de `registrar-backup.ts`). Os dois projetos do Playwright (desktop e
// celular) rodam `anotacoes.spec.ts` em paralelo entre si; sem exclusão mútua, um projeto
// gravando um texto no meio do caso "salvar duas vezes o mesmo texto" do outro produziria um
// aviso de conflito FALSO (ou mascararia um verdadeiro) — não seria instabilidade de ambiente, é
// a mesma classe de disputa por estado global que o CLAUDE.md manda resolver com ordem explícita,
// nunca `--grep`. Um advisory lock do Postgres serializa o arquivo inteiro entre os dois
// projetos, ao custo de rodar em série em vez de paralelo — aceitável para uma dúzia de casos
// rápidos contra uma tabela de uma linha.
import { Client } from "pg";

const CHAVE_LOCK_ANOTACOES_DA_CASA = 819_224;

let clienteDoLock: Client | null = null;

export async function travarAnotacoesParaTeste(): Promise<void> {
  clienteDoLock = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
  await clienteDoLock.connect();
  await clienteDoLock.query("select pg_advisory_lock($1)", [CHAVE_LOCK_ANOTACOES_DA_CASA]);
}

export async function destravarAnotacoesDeTeste(): Promise<void> {
  if (!clienteDoLock) return;
  await clienteDoLock.query("select pg_advisory_unlock($1)", [CHAVE_LOCK_ANOTACOES_DA_CASA]);
  await clienteDoLock.end();
  clienteDoLock = null;
}

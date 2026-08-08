// Auxiliar de teste: escreve e apaga linhas em `execucoes_backup`, no banco de teste, pelo
// cliente `pg` que o projeto já usa (mesmo padrão de `alternar-ativo.ts`). É a única tabela
// do sistema em que apagar linha de teste é aceitável — ao contrário de `usuarios`, ela é um
// registro operacional (o que o script de backup relatou em cada execução), não histórico de
// autoria; não existe uma "AUTH-09" para backups.
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

export type RegistroBackup = {
  quando: Date;
  sucesso: boolean;
  destinoExternoOk: boolean;
  mensagem?: string | null;
};

export async function registrarBackup(registro: RegistroBackup): Promise<string> {
  return comCliente(async (cliente) => {
    const resultado = await cliente.query(
      `insert into execucoes_backup (quando, sucesso, destino_externo_ok, mensagem)
       values ($1, $2, $3, $4)
       returning id`,
      [registro.quando, registro.sucesso, registro.destinoExternoOk, registro.mensagem ?? null],
    );
    return resultado.rows[0].id as string;
  });
}

export async function removerBackup(id: string): Promise<void> {
  await comCliente((cliente) =>
    cliente.query("delete from execucoes_backup where id = $1", [id]),
  );
}

export async function limparTodasAsExecucoesDeBackup(): Promise<void> {
  await comCliente((cliente) => cliente.query("delete from execucoes_backup"));
}

// `execucoes_backup` não tem uma chave natural de particionamento (ao contrário de
// `usuarios`, particionável por e-mail — ver o comentário de topo de `sessao.spec.ts`):
// `/api/health/backup` sempre lê a ÚLTIMA linha da tabela inteira, então não existe uma linha
// "própria de cada projeto" para isolar. Os dois projetos do Playwright (desktop e celular)
// rodam `backup.spec.ts` em paralelo entre si; sem exclusão mútua, um projeto inserindo uma
// linha no meio do caso "tabela vazia" do outro quebraria a asserção sem ser um bug real da
// aplicação. Um advisory lock do Postgres serializa a execução do arquivo inteiro entre os
// dois projetos — o segundo espera o primeiro terminar — ao custo de rodar em série em vez de
// paralelo, aceitável para cinco casos rápidos contra uma tabela de uma linha.
const CHAVE_LOCK_EXECUCOES_BACKUP = 726623;

let clienteDoLock: Client | null = null;

export async function travarExecucoesBackupParaTeste(): Promise<void> {
  clienteDoLock = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
  await clienteDoLock.connect();
  await clienteDoLock.query("select pg_advisory_lock($1)", [CHAVE_LOCK_EXECUCOES_BACKUP]);
}

export async function destravarExecucoesBackupDeTeste(): Promise<void> {
  if (!clienteDoLock) return;
  await clienteDoLock.query("select pg_advisory_unlock($1)", [CHAVE_LOCK_EXECUCOES_BACKUP]);
  await clienteDoLock.end();
  clienteDoLock = null;
}

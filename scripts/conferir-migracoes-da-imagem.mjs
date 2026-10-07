// Confere que a imagem `ferramentas` aplicou EXATAMENTE as migrações deste commit (06.5-WR-04, quick
// 261007-shs; decisão do dono, 07/10/2026; WINDOWS #13).
//
// Para que serve: a imagem `ferramentas` é a que o dono roda À MÃO em produção, depois do backup, para
// migrar o banco real (o Roteiro de cada fase). Até 07/10/2026 ela era promovida a `:ferramentas` sem nunca
// ter sido executada no pipeline: um Dockerfile que deixasse de copiar `db/migrations/`, ou que copiasse
// uma versão velha, passava verde e só aparecia no Roteiro, com o backup feito e o dono olhando. Agora o job
// `banco` migra o Postgres EFÊMERO dele PELA imagem (pelo digest que `construir` subiu) e este script lê o
// que ela gravou em `drizzle.__drizzle_migrations` e compara com o checkout: uma linha por entrada de
// `db/migrations/meta/_journal.json`, com o mesmo `created_at` (= o `when` da entrada) e o mesmo `hash`
// (= sha256 do conteúdo inteiro do `.sql`, a conta do migrador do Drizzle — `drizzle-orm/migrator.js`).
//
// Uso: `DATABASE_URL=<banco de TESTE> node scripts/conferir-migracoes-da-imagem.mjs`. Recusa o banco
// `amassa` (o de produção), no molde das provas de corrida. Sai 0 com “N migrações conferidas, iguais às do
// commit”; sai 1 listando cada problema.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import pg from "pg";

const BANCO_DE_PRODUCAO = "amassa";
const PASTA_DAS_MIGRACOES = "db/migrations";

// `{ tag, when, hash }` por entrada do jornal, com o hash calculado do `.sql` do disco do MESMO jeito que o
// migrador do Drizzle calcula (texto do arquivo inteiro, sha256 em hexadecimal).
export function lerJornalDoCheckout(pasta) {
  const jornal = JSON.parse(readFileSync(join(pasta, "meta", "_journal.json"), "utf8"));
  return jornal.entries.map((entrada) => {
    const conteudo = readFileSync(join(pasta, `${entrada.tag}.sql`)).toString();
    return { tag: entrada.tag, when: entrada.when, hash: createHash("sha256").update(conteudo).digest("hex") };
  });
}

// Puro: a lista de problemas, em frases humanas; vazia quando a imagem aplicou exatamente o commit.
// `aplicadas` vem de `drizzle.__drizzle_migrations` — `created_at` é `bigint`, e o `pg` o entrega como texto.
export function compararMigracoes({ jornal, aplicadas }) {
  const problemas = [];
  const aplicadaPorQuando = new Map(aplicadas.map((linha) => [Number(linha.created_at), linha]));
  const quandosDoJornal = new Set(jornal.map((entrada) => entrada.when));

  for (const entrada of jornal) {
    const aplicada = aplicadaPorQuando.get(entrada.when);
    if (!aplicada) {
      problemas.push(
        `A imagem não aplicou a migração ${entrada.tag}, que está no commit — a pasta db/migrations da imagem está faltando ou velha.`,
      );
      continue;
    }
    if (aplicada.hash !== entrada.hash) {
      problemas.push(
        `O arquivo da migração ${entrada.tag} na imagem difere do commit (hash ${aplicada.hash.slice(0, 12)}… na imagem, ${entrada.hash.slice(0, 12)}… no commit).`,
      );
    }
  }
  for (const linha of aplicadas) {
    if (!quandosDoJornal.has(Number(linha.created_at))) {
      problemas.push(
        `O banco tem uma migração que o commit não conhece (created_at ${linha.created_at}, hash ${String(linha.hash).slice(0, 12)}…).`,
      );
    }
  }
  return problemas;
}

async function main() {
  const conexao = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await conexao.connect();
  try {
    const { rows: banco } = await conexao.query("select current_database() as nome");
    if (banco[0]?.nome === BANCO_DE_PRODUCAO) {
      console.error("Recusado: este script só roda no banco de TESTE, nunca no de produção.");
      return 1;
    }
    const { rows: aplicadas } = await conexao.query(
      "select hash, created_at from drizzle.__drizzle_migrations order by created_at",
    );
    const jornal = lerJornalDoCheckout(PASTA_DAS_MIGRACOES);
    const problemas = compararMigracoes({ jornal, aplicadas });
    if (problemas.length > 0) {
      console.error(`A imagem ferramentas NÃO aplicou as migrações deste commit (${problemas.length} problema(s)):`);
      for (const problema of problemas) {
        console.error(`  - ${problema}`);
      }
      return 1;
    }
    console.log(`${jornal.length} migrações conferidas, iguais às do commit (última: ${jornal.at(-1)?.tag}).`);
    return 0;
  } finally {
    await conexao.end();
  }
}

// Só roda quando é o script chamado — importado pelo teste unitário, não conecta em nada.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(
    (codigo) => process.exit(codigo),
    (erro) => {
      console.error("Falha ao conferir as migrações da imagem:", erro instanceof Error ? erro.message : erro);
      process.exit(1);
    },
  );
}

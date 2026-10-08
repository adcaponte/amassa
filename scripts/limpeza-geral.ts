// Limpeza geral dos dados antes da inauguração (item 10 da fila do Code; decisões do Theo de
// 08/10/2026). Roda `db/limpeza/limpeza-geral.sql` numa transação só, pela imagem `ferramentas`,
// com a conexão de DONO (`DATABASE_URL_MIGRACAO` do `.env`, que o serviço entrega como
// `DATABASE_URL`):
//
//   ensaio (padrão — mostra antes → depois e DESFAZ):
//     docker compose run --rm ferramentas npm run limpeza-geral
//
//   gravar (só depois do backup conferido, Roteiro 24):
//     docker compose run --rm ferramentas npm run limpeza-geral -- --confirmar --banco amassa
//
// Quem roda é o Theo, à mão, seguindo o Roteiro 24 (`docs/operacao/24-limpeza-geral.md`). O que
// apaga, o que fica e o que zera está no cabeçalho da SQL. A prova é
// `scripts/provar-limpeza-geral.mjs`, dentro de `npm run test:migracoes`.
//
// De propósito este script NÃO carrega `.env.local`: ferramenta destrutiva não pega banco
// implícito. Sem `DATABASE_URL` no ambiente, ele se recusa.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { Client } from "pg";

const ARQUIVO_SQL = path.join("db", "limpeza", "limpeza-geral.sql");
const HORAS_MAXIMAS_DO_BACKUP = 3;
const SEQUENCIAS = [
  { nome: "documentos_numero_seq", rotulo: "venda/despesa" },
  { nome: "ordens_producao_numero_seq", rotulo: "ordem de produção" },
  { nome: "movimentacoes_estoque_numero_seq", rotulo: "movimentação do estoque" },
] as const;

const USO =
  "Uso: npm run limpeza-geral                                   (ensaio — nada é gravado)\n" +
  "     npm run limpeza-geral -- --confirmar --banco <nome>     (grava — só depois do backup)";

type Argumentos = { confirmar: boolean; banco: string | undefined };

function lerArgumentos(lista: string[]): Argumentos {
  let confirmar = false;
  let banco: string | undefined;
  const desconhecidos: string[] = [];

  for (let indice = 0; indice < lista.length; indice++) {
    const argumento = lista[indice];
    if (argumento === "--confirmar") {
      confirmar = true;
    } else if (argumento === "--banco") {
      const proximo = lista[indice + 1];
      if (proximo === undefined || proximo.startsWith("--")) {
        falharComUso(["--banco precisa do nome do banco logo depois (ex.: --banco amassa)."]);
      }
      banco = proximo;
      indice++;
    } else if (argumento.startsWith("--banco=")) {
      banco = argumento.slice("--banco=".length);
    } else {
      desconhecidos.push(argumento);
    }
  }

  if (desconhecidos.length > 0) {
    falharComUso([`Argumento que este comando não conhece: ${desconhecidos.join(" ")}.`]);
  }
  return { confirmar, banco };
}

function falharComUso(mensagens: string[]): never {
  console.error(USO);
  for (const mensagem of mensagens) {
    console.error(`  - ${mensagem}`);
  }
  process.exit(1);
}

// `host:porta/banco`, nunca usuário nem senha.
function destinoSemCredenciais(url: string): string {
  try {
    const endereco = new URL(url);
    const porta = endereco.port || "5432";
    return `${endereco.hostname}:${porta}${endereco.pathname}`;
  } catch {
    return "(endereço do banco ilegível)";
  }
}

class Recusa extends Error {}

type Retrato = {
  contagens: Map<string, number>;
  itensDoSistema: { nome: string; chave: string; preco: number | null }[];
  configuracao: { saldo: number; taxa: number; data: string | null } | null;
  fichasDeItensDoSistema: { tecnica: number; precificacao: number };
};

async function tirarRetrato(cliente: Client): Promise<Retrato> {
  const { rows: tabelas } = await cliente.query<{ nome: string }>(
    `select table_name as nome from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
      order by table_name`,
  );
  const contagens = new Map<string, number>();
  for (const { nome } of tabelas) {
    const { rows } = await cliente.query<{ total: string }>(
      `select count(*) as total from "${nome.replaceAll('"', '""')}"`,
    );
    contagens.set(nome, Number(rows[0].total));
  }

  const { rows: itens } = await cliente.query<{ nome: string; chave: string; preco: number | null }>(
    `select nome, chave_do_sistema as chave, preco_venda_centavos as preco
       from itens_catalogo where chave_do_sistema is not null order by chave_do_sistema`,
  );

  const { rows: configuracao } = await cliente.query<{ saldo: number; taxa: number; data: string | null }>(
    `select saldo_inicial_centavos as saldo, taxa_cartao_pontos_base as taxa,
            to_char(data_saldo_inicial, 'DD/MM/YYYY') as data
       from configuracao_financeira limit 1`,
  );

  const { rows: fichas } = await cliente.query<{ tecnica: string; precificacao: string }>(
    `select
       (select count(*) from ficha_tecnica f join itens_catalogo i on i.id in (f.item_id, f.insumo_id)
         where i.chave_do_sistema is not null) as tecnica,
       (select count(*) from fichas_precificacao f join itens_catalogo i on i.id = f.item_catalogo_id
         where i.chave_do_sistema is not null) as precificacao`,
  );

  return {
    contagens,
    itensDoSistema: itens,
    configuracao: configuracao[0] ?? null,
    fichasDeItensDoSistema: {
      tecnica: Number(fichas[0].tecnica),
      precificacao: Number(fichas[0].precificacao),
    },
  };
}

function reais(centavos: number | null): string {
  if (centavos === null) return "sem preço";
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function imprimirRelatorio(antes: Retrato, depois: Retrato) {
  console.log("");
  console.log("Tabela                          antes → depois");
  const largura = Math.max(...[...antes.contagens.keys()].map((nome) => nome.length), 30);
  for (const [nome, totalAntes] of antes.contagens) {
    const totalDepois = depois.contagens.get(nome) ?? 0;
    const marca = totalAntes !== totalDepois ? "   (muda)" : "";
    console.log(`  ${nome.padEnd(largura)}  ${totalAntes} → ${totalDepois}${marca}`);
  }

  console.log("");
  console.log(`Itens do sistema que ficam no catálogo (${depois.itensDoSistema.length}):`);
  for (const item of depois.itensDoSistema) {
    console.log(`  - ${item.nome} (${item.chave}) — ${reais(item.preco)}`);
  }
  const { tecnica, precificacao } = antes.fichasDeItensDoSistema;
  if (tecnica + precificacao > 0) {
    console.log(
      `  (saem ${tecnica} linha(s) de ficha técnica e ${precificacao} ficha(s) de precificação ` +
        "ligadas a esses itens — os itens ficam.)",
    );
  }

  console.log("");
  if (antes.configuracao) {
    const { saldo, taxa, data } = antes.configuracao;
    const saldoDepois = depois.configuracao?.saldo ?? 0;
    console.log(
      `Saldo inicial do caixa: ${reais(saldo)} → ${reais(saldoDepois)} ` +
        `(a taxa do cartão, ${(taxa / 100).toLocaleString("pt-BR")}%, e a data do saldo, ${data ?? "sem data"}, ficam).`,
    );
  } else {
    console.log("Saldo inicial do caixa: nunca foi configurado — já é R$ 0,00.");
  }

  console.log(
    `Numeração: a próxima ${SEQUENCIAS.map((sequencia) => sequencia.rotulo).join(", ")} e o próximo ` +
      "orçamento do ano recebem o número 1.",
  );
}

async function conferirAntesDeGravar(cliente: Client, bancoInformado: string | undefined) {
  const { rows: banco } = await cliente.query<{ nome: string }>("select current_database() as nome");
  const bancoConectado = banco[0].nome;
  if (bancoInformado === undefined) {
    throw new Recusa(
      `Recusado: para gravar, diga o nome do banco com --banco (o banco conectado é "${bancoConectado}"). ` +
        "Nada foi gravado.",
    );
  }
  if (bancoInformado !== bancoConectado) {
    throw new Recusa(
      `Recusado: --banco "${bancoInformado}" não é o banco conectado ("${bancoConectado}"). ` +
        "Confira para onde o comando aponta. Nada foi gravado.",
    );
  }

  const { rows: backups } = await cliente.query<{
    sucesso: boolean;
    destino_externo_ok: boolean;
    fotos_destino_externo_ok: boolean;
    anexos_destino_externo_ok: boolean;
    recente: boolean;
    horas: string;
  }>(
    `select sucesso, destino_externo_ok, fotos_destino_externo_ok, anexos_destino_externo_ok,
            quando > now() - make_interval(hours => $1) as recente,
            round(extract(epoch from now() - quando) / 3600, 1)::text as horas
       from execucoes_backup order by quando desc limit 1`,
    [HORAS_MAXIMAS_DO_BACKUP],
  );
  const comoResolver =
    "Rode ./scripts/backup.sh --agora no servidor e confira o resultado (Roteiro 24) antes de gravar. " +
    "Nada foi gravado.";
  const ultimo = backups[0];
  if (!ultimo) {
    throw new Recusa(`Recusado: não há nenhum backup registrado. ${comoResolver}`);
  }
  if (!ultimo.sucesso) {
    throw new Recusa(`Recusado: o último backup falhou. ${comoResolver}`);
  }
  if (!ultimo.destino_externo_ok || !ultimo.fotos_destino_externo_ok || !ultimo.anexos_destino_externo_ok) {
    throw new Recusa(
      "Recusado: o último backup não chegou inteiro ao destino externo (banco, fotos ou anexos). " +
        comoResolver,
    );
  }
  if (!ultimo.recente) {
    throw new Recusa(
      `Recusado: o último backup é de há ${ultimo.horas.replace(".", ",")} horas — precisa ser de menos de ` +
        `${HORAS_MAXIMAS_DO_BACKUP} horas. ${comoResolver}`,
    );
  }
}

async function main() {
  const argumentos = lerArgumentos(process.argv.slice(2));

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "Recusado: DATABASE_URL não está definida. Este comando não adivinha o banco — rode-o pela " +
        "ferramentas (docker compose run --rm ferramentas npm run limpeza-geral), que já entrega a " +
        "conexão de dono. Nada foi gravado.",
    );
    process.exitCode = 1;
    return;
  }

  const caminhoSql = path.join(process.cwd(), ARQUIVO_SQL);
  if (!existsSync(caminhoSql)) {
    console.error(
      `Não achei ${ARQUIVO_SQL} — a imagem ferramentas está velha. Rode "docker compose pull ferramentas" ` +
        "(Roteiro 24) e tente de novo. Nada foi gravado.",
    );
    process.exitCode = 1;
    return;
  }
  const sql = readFileSync(caminhoSql, "utf8");

  console.log(`Banco: ${destinoSemCredenciais(url)}`);
  console.log(argumentos.confirmar ? "Modo: GRAVAR (--confirmar)." : "Modo: ensaio — nada será gravado.");

  const cliente = new Client({ connectionString: url });
  let transacaoAberta = false;
  try {
    await cliente.connect();
    await cliente.query("begin");
    transacaoAberta = true;
    await cliente.query("set local lock_timeout = '15s'");
    await cliente.query("set local statement_timeout = '5min'");

    if (argumentos.confirmar) {
      await conferirAntesDeGravar(cliente, argumentos.banco);
    }

    const antes = await tirarRetrato(cliente);
    await cliente.query(sql);
    const depois = await tirarRetrato(cliente);
    imprimirRelatorio(antes, depois);
    console.log("");

    if (argumentos.confirmar) {
      await cliente.query("commit");
      transacaoAberta = false;
      console.log("Limpeza gravada.");
    } else {
      await cliente.query("rollback");
      transacaoAberta = false;
      const { rows } = await cliente.query<{ nome: string }>("select current_database() as nome");
      console.log(
        `Ensaio — nada foi gravado. Para gravar: npm run limpeza-geral -- --confirmar --banco ${rows[0].nome}`,
      );
    }
  } catch (erro) {
    if (transacaoAberta) {
      try {
        await cliente.query("rollback");
      } catch {
        // A conexão pode ter caído — sem commit, o Postgres desfaz sozinho.
      }
    }
    const codigo = (erro as { code?: unknown }).code;
    if (erro instanceof Recusa) {
      console.error(erro.message);
    } else if (codigo === "55P03") {
      console.error(
        "O banco estava ocupado com outra operação; espere um minuto e rode de novo. Nada foi gravado.",
      );
    } else if (codigo === "57014") {
      console.error("A limpeza passou de 5 minutos e foi interrompida. Nada foi gravado.");
    } else {
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      console.error(mensagem);
      if (!mensagem.includes("Nada foi apagado") && !mensagem.includes("Nada foi gravado")) {
        console.error("Nada foi gravado.");
      }
    }
    process.exitCode = 1;
  } finally {
    await cliente.end().catch(() => {});
  }
}

void main();

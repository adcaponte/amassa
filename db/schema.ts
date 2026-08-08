import {
  bigint,
  boolean,
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Tabela deliberadamente mínima: existe apenas para provar que `drizzle-kit generate`
// produz uma migração real e que `/api/health` consegue fazer uma consulta real ao
// Postgres. Nenhuma tabela de produto é modelada nesta fase — isso é Fase 2 em diante.
export const verificacaoInfraestrutura = pgTable("verificacao_infraestrutura", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  nota: text("nota"),
});

// Um único papel hoje ("gestor"), deliberadamente — ver 02-MODELO-DE-DADOS.md §0 sobre por
// que adicionar um valor no futuro precisa de uma migração isolada com `alter type`.
export const papelUsuario = pgEnum("papel_usuario", ["gestor"]);

// A tabela de contas do sistema. Criação e redefinição de senha só por linha de comando
// (`scripts/criar-usuario.ts`) — não existe tela de cadastro. Desativar é `ativo = false`;
// nenhum caminho de código apaga uma linha desta tabela (AUTH-09, provado em
// `tests/unit/auth-borda.test.ts`).
export const usuarios = pgTable(
  "usuarios",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    nome: text("nome").notNull(),
    // Unicidade pelo índice funcional abaixo, não por restrição de coluna — a comparação
    // precisa ignorar caixa (ver `usuarios_email_idx`).
    email: text("email").notNull(),
    senhaHash: text("senha_hash").notNull(),
    papel: papelUsuario("papel").notNull().default("gestor"),
    ativo: boolean("ativo").notNull().default(true),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    uniqueIndex("usuarios_email_idx").on(sql`lower(${tabela.email})`),
    check("usuarios_nome_comprimento", sql`length(trim(${tabela.nome})) between 2 and 120`),
  ],
);

// Uma linha por execução do script `backup.sh` (01-ARQUITETURA.md §9) — `/api/health/backup`
// lê sempre a última, nunca a última bem-sucedida, para que um backup que falhou ontem
// apareça como falha hoje, não sumir atrás do sucesso de anteontem.
//
// Deliberadamente SEM `atualizado_em` e SEM trigger: esta tabela só recebe INSERT, cada
// execução é uma linha nova e nenhuma linha é alterada depois de escrita — a mesma exceção
// que `02-MODELO-DE-DADOS.md` §0 abre para `movimentacoes_estoque`.
export const execucoesBackup = pgTable(
  "execucoes_backup",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    // Momento da execução, não uma data civil — por isso timestamptz com o instante atual,
    // nunca hoje_brasilia() (que devolve `date`).
    quando: timestamp("quando", { withTimezone: true }).notNull().defaultNow(),
    sucesso: boolean("sucesso").notNull(),
    // Nulo quando a execução falhou antes de gerar arquivo — não tem tamanho para relatar.
    bytes: bigint("bytes", { mode: "number" }),
    // Padrão pessimista deliberado: um registro escrito pela metade (processo interrompido
    // entre o dump local e o envio externo) precisa parecer falha, nunca sucesso.
    destinoExternoOk: boolean("destino_externo_ok").notNull().default(false),
    mensagem: text("mensagem"),
  },
  (tabela) => [
    // A única consulta que esta tabela recebe: a última execução, por `quando` decrescente.
    index("execucoes_backup_quando_idx").on(tabela.quando.desc()),
  ],
);

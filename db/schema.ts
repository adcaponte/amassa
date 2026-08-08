import { boolean, check, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
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

import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
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

// Fase 3 — Gestor de Encomendas. SQL literal em amassa-plataforma/02-MODELO-DE-DADOS.md §1; as
// datas de cada etapa NÃO são armazenadas aqui — são calculadas em cascata a partir de
// `dataInicio` pelo módulo puro `lib/encomendas/cronograma.ts` (evita duas versões da verdade
// quando `dias` muda).
export const statusEncomenda = pgEnum("status_encomenda", [
  "rascunho",
  "em_producao",
  "concluida",
  "cancelada",
]);
export const etapaEncomenda = pgEnum("etapa_encomenda", [
  "producao",
  "secagem",
  "queima1",
  "esmaltacao",
  "queima2",
  "entrega",
]);

// Uma encomenda do ateliê: nome, cliente (texto livre — sem ficha de cadastro nesta versão,
//00-BRIEFING.md §5), data de início e status. `status` nasce `em_producao` (não `rascunho`) —
// o formulário de criação desta fatia sempre grava uma encomenda pronta para o cronograma
// rodar; `rascunho` existe no enum para o plano 03/04 tratarem sem migração nova.
export const encomendas = pgTable(
  "encomendas",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    nome: text("nome").notNull(),
    clienteNome: text("cliente_nome"),
    // `mode: "string"` — o dia civil trafega como `YYYY-MM-DD` do banco à interface, nunca
    // vira `Date`: um `Date` cruzando o fuso do runtime desloca o dia (PD-05 do plano).
    dataInicio: date("data_inicio", { mode: "string" }).notNull(),
    status: statusEncomenda("status").notNull().default("em_producao"),
    observacoes: text("observacoes"),
    // `set null`, não `cascade`: desativar/remover um usuário no futuro não pode apagar as
    // encomendas que ele criou (o histórico do ateliê sobrevive à conta que registrou).
    criadoPor: uuid("criado_por").references(() => usuarios.id, { onDelete: "set null" }),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    check("encomendas_nome_comprimento", sql`length(trim(${tabela.nome})) between 1 and 120`),
    index("encomendas_data_inicio_idx").on(tabela.dataInicio),
    index("encomendas_status_idx").on(tabela.status),
  ],
);

// Cada linha de item de uma encomenda ("40 × caneca cônica"). `ordem` decide a posição na
// lista do formulário e é o que a reordenação por setas (D-16, plano 06) grava.
export const encomendaItens = pgTable(
  "encomenda_itens",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    encomendaId: uuid("encomenda_id")
      .notNull()
      .references(() => encomendas.id, { onDelete: "cascade" }),
    descricao: text("descricao").notNull(),
    quantidade: integer("quantidade").notNull(),
    ordem: integer("ordem").notNull().default(0),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    check(
      "encomenda_itens_descricao_comprimento",
      sql`length(trim(${tabela.descricao})) between 1 and 200`,
    ),
    check("encomenda_itens_quantidade_positiva", sql`${tabela.quantidade} > 0`),
    index("encomenda_itens_encomenda_idx").on(tabela.encomendaId),
  ],
);

// As 6 etapas fixas de cada encomenda (produção · secagem · queima1 · esmaltação · queima2 ·
// entrega), uma linha por etapa por encomenda (`unique`). `dias` é a duração — para os três
// marcos (queima1/queima2/entrega) só 0 ou 1 é válido, e `marcos_zero_ou_um` é a defesa no
// nível do banco para o dia em que um caminho de escrita novo esquecer o Zod (T-03-03).
export const encomendaEtapas = pgTable(
  "encomenda_etapas",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    encomendaId: uuid("encomenda_id")
      .notNull()
      .references(() => encomendas.id, { onDelete: "cascade" }),
    etapa: etapaEncomenda("etapa").notNull(),
    dias: integer("dias").notNull().default(1),
    ordem: integer("ordem").notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    unique("encomenda_etapas_encomenda_etapa_uk").on(tabela.encomendaId, tabela.etapa),
    check(
      "marcos_zero_ou_um",
      sql`${tabela.etapa} not in ('queima1','queima2','entrega') or ${tabela.dias} in (0, 1)`,
    ),
    check("encomenda_etapas_dias_nao_negativo", sql`${tabela.dias} >= 0`),
    index("encomenda_etapas_encomenda_idx").on(tabela.encomendaId),
  ],
);

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
// entrega), uma linha por etapa por encomenda (`unique`). `dias` é a duração; a partir da fase
// 04.1 (D-06) os três marcos (queima1/queima2/entrega) SEMPRE acontecem e SEMPRE duram 1 dia —
// `marcos_sempre_um_dia` é a defesa no nível do banco para o dia em que um caminho de escrita
// novo esquecer o Zod (T-04.1-05). `espera_dias` é a espera ANTES do marco, nunca a duração dele
// (D-07) — quantos dias a peça fica parada depois que a etapa anterior termina e antes daquele
// marco acontecer. Continua sendo um contador RELATIVO de dias, nunca uma data: nenhuma data de
// marco é armazenada aqui, só calculada em cascata por `lib/encomendas/cronograma.ts` a partir
// de `encomendas.data_inicio` (D-01). `espera_so_em_marco` garante que produção, secagem e
// esmaltação — trabalho contínuo, não espera (D-03) — nunca gravam espera diferente de 0.
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
    esperaDias: integer("espera_dias").notNull().default(0),
    ordem: integer("ordem").notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    unique("encomenda_etapas_encomenda_etapa_uk").on(tabela.encomendaId, tabela.etapa),
    check(
      "marcos_sempre_um_dia",
      sql`${tabela.etapa} not in ('queima1','queima2','entrega') or ${tabela.dias} = 1`,
    ),
    check("encomenda_etapas_dias_nao_negativo", sql`${tabela.dias} >= 0`),
    check(
      "encomenda_etapas_espera_no_intervalo",
      sql`${tabela.esperaDias} >= 0 and ${tabela.esperaDias} <= 365`,
    ),
    check(
      "espera_so_em_marco",
      sql`${tabela.etapa} in ('queima1','queima2','entrega') or ${tabela.esperaDias} = 0`,
    ),
    index("encomenda_etapas_encomenda_idx").on(tabela.encomendaId),
  ],
);

// Fase 4 — Contador de Queima (módulo de Fornos). SQL literal em
// amassa-plataforma/02-MODELO-DE-DADOS.md §3. Migração 0007_queimas (não 0004 — ver Desvio 1 de
// 04-01-PLAN.md: o `.planning/ROADMAP.md` nomeia a migração antes da ordem de execução ter sido
// antecipada; 0000-0006 já existem no repositório). Checkpoint 04-01/Tarefa 1: gerar agora,
// aplicar em produção só no plano de fechamento (04-07), depois de um backup, à mão.
//
// `ocorrida_em`/`ocorridaEm` é timestamptz (instante), NUNCA date (dia civil) — o oposto de
// `encomendas.dataInicio`: uma queima acontece num momento preciso do dia, não é um marco de
// calendário. A view de apoio `fornos_medidos` do documento fonte NÃO é criada (Desvio 2): o
// módulo puro `lib/queimas/contador.ts` já calcula nível a partir de dados carregados, e
// `lib/queimas/consultas.ts` reproduz o mesmo `left join lateral` — uma view a mais seria um
// segundo lugar com a mesma regra, fora de `TABELAS_ESPERADAS` e invisível a `test:migracoes`.
export const tipoQueima = pgEnum("tipo_queima", ["biscoito", "esmalte", "ouro"]);

// Um forno do ateliê. `limite`/`ativo` editáveis só pela página do próprio forno (D-02: não
// existe tela de cadastro dedicada — o botão do índice cria com os padrões, e o resto se edita
// depois). `onDelete: "cascade"` fica como rede para exclusão manual no banco; a aplicação nunca
// oferece apagar um forno (04-CONTEXT.md §Fora desta fase).
export const fornos = pgTable(
  "fornos",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    nome: text("nome").notNull(),
    descricao: text("descricao"),
    limite: integer("limite").notNull().default(100),
    ativo: boolean("ativo").notNull().default(true),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    check("fornos_nome_comprimento", sql`length(trim(${tabela.nome})) between 1 and 80`),
    check("fornos_limite_minimo", sql`${tabela.limite} >= 10`),
  ],
);

// Uma queima registrada num forno — o fluxo de dois toques (D-04) grava uma linha aqui na hora
// do toque; "Desfazer" apaga a linha (excluirQueima), nunca o inverso. `registradoPor` é sempre
// `usuarioAtual.id` de `exigirUsuario()`, nunca aceito do cliente (T-04-02) — `set null`
// preserva a queima quando um usuário for desativado/removido no futuro.
export const queimas = pgTable(
  "queimas",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    fornoId: uuid("forno_id")
      .notNull()
      .references(() => fornos.id, { onDelete: "cascade" }),
    tipo: tipoQueima("tipo").notNull(),
    ocorridaEm: timestamp("ocorrida_em", { withTimezone: true }).notNull().defaultNow(),
    registradoPor: uuid("registrado_por").references(() => usuarios.id, { onDelete: "set null" }),
    observacoes: text("observacoes"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    index("queimas_forno_data_idx").on(tabela.fornoId, tabela.ocorridaEm.desc()),
    index("queimas_data_idx").on(tabela.ocorridaEm.desc()),
  ],
);

// Fase 4.2 — Abertura do Espaço. MÓDULO TEMPORÁRIO (D-01/ABE-15): as três tabelas abaixo saem
// por inteiro, numa migração de remoção, no dia em que o espaço abrir — nenhuma delas sobrevive
// à vida útil deste módulo. O prefixo `abertura_` no nome do Postgres não é estética: é o que
// torna a remoção do plano 04.2-05 uma lista curta e inequívoca.
export const categoriaItemAbertura = pgEnum("categoria_item_abertura", [
  "moveis",
  "equipamentos",
  "material",
  "utensilios",
  "obra",
  "outros",
]);
export const formaPagamentoAbertura = pgEnum("forma_pagamento_abertura", ["vista", "prazo"]);
// Consumido pelo plano 04.2-02 (tarefas) — criado já aqui para que as três tabelas do módulo
// nasçam numa migração só, o que faz a remoção do plano 04.2-05 também ser uma só.
export const grupoTarefaAbertura = pgEnum("grupo_tarefa_abertura", [
  "obra",
  "documentacao",
  "aquisicao",
  "montagem",
  "divulgacao",
  "outros",
]);

// Um item a comprar para a abertura do espaço. Parcelas são CALCULADAS, nunca armazenadas
// linha a linha (D-05, `lib/abertura/parcelas.ts`) — esta tabela guarda só valor total, número
// de parcelas e a data da primeira. `resolvido` (D-07) é consumido a partir do plano 04.2-03.
export const aberturaItens = pgTable(
  "abertura_itens",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    nome: text("nome").notNull(),
    categoria: categoriaItemAbertura("categoria").notNull(),
    valorCentavos: integer("valor_centavos").notNull(),
    formaPagamento: formaPagamentoAbertura("forma_pagamento").notNull(),
    parcelas: integer("parcelas").notNull().default(1),
    // Dia civil, nunca timestamptz — o dia de hoje entra sempre por argumento na aplicação,
    // calculado em America/Sao_Paulo na borda (`hojeEmBrasilia`), nunca `current_date` cru.
    primeiraParcelaEm: date("primeira_parcela_em", { mode: "string" }).notNull(),
    // Opcional (D-04/ABE-03): item pago e ainda não entregue é o pior dos dois mundos, e sem
    // esta data separada isso não aparece em lugar nenhum.
    entregaPrevistaEm: date("entrega_prevista_em", { mode: "string" }),
    resolvido: boolean("resolvido").notNull().default(false),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    check("abertura_itens_nome_comprimento", sql`length(trim(${tabela.nome})) between 1 and 120`),
    // Teto de dez milhões de reais (10^9 centavos): mantém a conta longe do limite do inteiro
    // de 32 bits e um valor acima disso é erro de digitação, não compra de ateliê.
    check(
      "abertura_itens_valor_nao_negativo",
      sql`${tabela.valorCentavos} >= 0 and ${tabela.valorCentavos} <= 1000000000`,
    ),
    // Teto de 36 parcelas (o mesmo `max` do campo do protótipo) — também a defesa de
    // disponibilidade do módulo (T-04.2-03): sem teto, um número grande no campo faria a visão
    // por mês do plano 04.2-04 desenhar milhares de linhas a partir de uma linha só do banco.
    check("abertura_itens_parcelas_no_intervalo", sql`${tabela.parcelas} between 1 and 36`),
    check(
      "abertura_itens_vista_uma_parcela",
      sql`${tabela.formaPagamento} <> 'vista' or ${tabela.parcelas} = 1`,
    ),
    check(
      "abertura_itens_prazo_duas_ou_mais",
      sql`${tabela.formaPagamento} <> 'prazo' or ${tabela.parcelas} >= 2`,
    ),
    index("abertura_itens_categoria_idx").on(tabela.categoria, tabela.nome),
  ],
);

// Uma tarefa até a inauguração (plano 04.2-02). `responsavelId`/`itemId` aceitam nulo de
// propósito: "ninguém ainda" é estado válido (D-11), e remover um item solta a tarefa em vez de
// apagá-la (D-14) — por isso `set null` nos dois, nunca `cascade`.
export const aberturaTarefas = pgTable(
  "abertura_tarefas",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    descricao: text("descricao").notNull(),
    grupo: grupoTarefaAbertura("grupo").notNull(),
    prazoEm: date("prazo_em", { mode: "string" }).notNull(),
    responsavelId: uuid("responsavel_id").references(() => usuarios.id, { onDelete: "set null" }),
    itemId: uuid("item_id").references(() => aberturaItens.id, { onDelete: "set null" }),
    concluida: boolean("concluida").notNull().default(false),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    check(
      "abertura_tarefas_descricao_comprimento",
      sql`length(trim(${tabela.descricao})) between 1 and 160`,
    ),
    index("abertura_tarefas_grupo_prazo_idx").on(tabela.grupo, tabela.prazoEm),
    index("abertura_tarefas_item_idx").on(tabela.itemId),
  ],
);

// A data de inauguração (D-17/ABE-14, consumida pelo plano 04.2-04). O par `unique` + `check`
// garante que a tabela nunca tem mais de uma linha. A migração NÃO semeia linha nenhuma: sem
// data definida, a leitura devolve nulo e a tela pede a data — inventar um `default` aqui seria
// gravar uma informação que ninguém deu.
export const aberturaConfiguracao = pgTable(
  "abertura_configuracao",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    linhaUnica: boolean("linha_unica").notNull().default(true),
    inauguracaoEm: date("inauguracao_em", { mode: "string" }).notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    unique("abertura_configuracao_linha_unica_uk").on(tabela.linhaUnica),
    check("abertura_configuracao_linha_unica", sql`${tabela.linhaUnica}`),
  ],
);

// Uma manutenção zera o contador do forno *por consequência do corte de data*, nunca por
// exclusão — `queimasAcumuladas` grava o valor que o contador tinha naquele instante, para o
// histórico completo do forno continuar consultável mesmo depois do corte.
export const manutencoes = pgTable(
  "manutencoes",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    fornoId: uuid("forno_id")
      .notNull()
      .references(() => fornos.id, { onDelete: "cascade" }),
    ocorridaEm: timestamp("ocorrida_em", { withTimezone: true }).notNull().defaultNow(),
    responsavel: text("responsavel"),
    observacoes: text("observacoes"),
    queimasAcumuladas: integer("queimas_acumuladas").notNull(),
    registradoPor: uuid("registrado_por").references(() => usuarios.id, { onDelete: "set null" }),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    check(
      "manutencoes_queimas_acumuladas_nao_negativo",
      sql`${tabela.queimasAcumuladas} >= 0`,
    ),
    index("manutencoes_forno_idx").on(tabela.fornoId, tabela.ocorridaEm.desc()),
  ],
);

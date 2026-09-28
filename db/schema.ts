import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
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
    // Fase 04.5 (migração 0017, D-28): nulo significa "não houve tentativa registrada" — é o
    // que mantém as linhas escritas ANTES desta fase legíveis (o backup de fotos não existia
    // ainda). Toda execução NOVA do `backup.sh` escreve `true` ou `false`, nunca nulo — o par
    // é lido junto do dump do Postgres pela MESMA linha, sem uma segunda tabela por dataset
    // (RESEARCH.md, Pitfall 5).
    fotosBytes: bigint("fotos_bytes", { mode: "number" }),
    fotosDestinoExternoOk: boolean("fotos_destino_externo_ok"),
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

// Fase 4.3 — Comparador de Compras (aba dentro do módulo Abertura do Espaço, D-02). As duas
// tabelas abaixo NÃO fazem parte do módulo temporário acima, e isso é deliberado (D-03): elas
// ARQUIVAM, nunca são apagadas. Três decisões merecem comentário porque um leitor futuro vai
// estranhar:
//
// (a) `cotacoes.categoriaId` referencia `cotacaoCategorias` EM CASCATA — o oposto de
// `aberturaTarefas.itemId` (`set null`) acima. Aqui perder a categoria É perder as cotações
// dela, de propósito (D-15: a confirmação de exclusão da categoria diz quantas cotações se
// perdem antes de o usuário confirmar).
//
// (b) As duas tabelas NÃO levam o prefixo `abertura_`, ao contrário de todo o bloco anterior.
// Neste projeto esse prefixo significa "sai quando o módulo for desmontado" — e a remoção do
// módulo (`db/remocao/remover-abertura-do-espaco.sql`) varre exatamente as tabelas prefixadas.
// Estas duas são arquivadas, não apagadas (D-03), então um nome prefixado mentiria sobre o
// ciclo de vida delas e convidaria alguém a "completar" a lista de remoção por prefixo num dia
// corrido. `npm run test:migracoes` prova a sobrevivência das duas depois da remoção da
// Abertura (D-26).
//
// (c) Nenhuma chave estrangeira daqui para `aberturaItens` nem `aberturaTarefas` (D-04) — é
// isso que permite (b) sem cascata cruzada: o comparador é independente da lista de compras.
export const situacaoCotacao = pgEnum("situacao_cotacao", ["cotando", "favorito", "descartado"]);

// Uma categoria de cotação (o protótipo as chama de "tabelas"): nome e ordem de exibição, que é
// a própria ordem de criação (UI-SPEC §Assunções item 6, D-14 — sem reordenação, não é
// critério).
export const cotacaoCategorias = pgTable(
  "cotacao_categorias",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    nome: text("nome").notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    check(
      "cotacao_categorias_nome_comprimento",
      sql`length(trim(${tabela.nome})) between 1 and 60`,
    ),
    index("cotacao_categorias_criado_em_idx").on(tabela.criadoEm),
  ],
);

// Uma cotação (item) dentro de uma categoria: empresa, especificação, preço (D-07: anulável —
// nulo é "sob consulta", nunca zero) e os seis campos longos de D-06. `produto` e os seis
// campos longos nascem com padrão de texto vazio (nunca nulo) — o formulário sempre envia os
// seis, mesmo em branco, e um valor ausente e um valor vazio são a mesma informação aqui.
export const cotacoes = pgTable(
  "cotacoes",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    categoriaId: uuid("categoria_id")
      .notNull()
      .references(() => cotacaoCategorias.id, { onDelete: "cascade" }),
    empresa: text("empresa").notNull(),
    produto: text("produto").notNull().default(""),
    // Anulável de propósito (D-07): nulo = "sob consulta", exibido como "—". Nunca confundir
    // com zero, que é um preço de graça — informação diferente.
    precoCentavos: integer("preco_centavos"),
    situacao: situacaoCotacao("situacao").notNull().default("cotando"),
    diferenciais: text("diferenciais").notNull().default(""),
    assistencia: text("assistencia").notNull().default(""),
    pagamento: text("pagamento").notNull().default(""),
    contato: text("contato").notNull().default(""),
    observacoes: text("observacoes").notNull().default(""),
    alertas: text("alertas").notNull().default(""),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    check("cotacoes_empresa_comprimento", sql`length(trim(${tabela.empresa})) between 1 and 160`),
    check("cotacoes_produto_comprimento", sql`length(${tabela.produto}) <= 200`),
    check("cotacoes_diferenciais_comprimento", sql`length(${tabela.diferenciais}) <= 2000`),
    check("cotacoes_assistencia_comprimento", sql`length(${tabela.assistencia}) <= 2000`),
    check("cotacoes_pagamento_comprimento", sql`length(${tabela.pagamento}) <= 2000`),
    check("cotacoes_contato_comprimento", sql`length(${tabela.contato}) <= 2000`),
    check("cotacoes_observacoes_comprimento", sql`length(${tabela.observacoes}) <= 2000`),
    check("cotacoes_alertas_comprimento", sql`length(${tabela.alertas}) <= 2000`),
    // Mesmo teto de dez milhões de reais (10^9 centavos) de `abertura_itens.valor_centavos`,
    // pelo mesmo motivo: mantém a conta longe do limite do inteiro de 32 bits.
    check(
      "cotacoes_preco_no_intervalo",
      sql`${tabela.precoCentavos} is null or (${tabela.precoCentavos} >= 0 and ${tabela.precoCentavos} <= 1000000000)`,
    ),
    index("cotacoes_categoria_idx").on(tabela.categoriaId, tabela.criadoEm),
  ],
);

// Fase 04.4 — Financeiro (migração 0014_financeiro). Estas tabelas são PERMANENTES: ao
// contrário do bloco da Abertura do Espaço acima, nenhuma delas sai numa migração de remoção.
// `itens_catalogo` é o cadastro único de itens da plataforma inteira — o módulo Estoque (fase
// futura) liga saldo, custo médio e movimentações a esta MESMA tabela (`controla_estoque`,
// `unidade`, `categoria_compra_id`), nunca a uma segunda tabela "materiais".
//
// Dinheiro é inteiro em centavos em toda coluna de valor, com teto de 10^9 (dez milhões de
// reais), seguindo `abertura_itens.valor_centavos`/`cotacoes.preco_centavos` — o `numeric(12,2)`
// do briefing original foi descartado de propósito (04.4-CONTEXT.md, Claude's Discretion).
// Quantidade de estoque/ficha técnica é `numeric(12,3)` (0,04 kg existe).
//
// Nenhuma chave estrangeira usa `cascade` — nada do financeiro se apaga, então toda referência é
// a padrão (restringe). Nenhuma chave estrangeira liga estas tabelas a `abertura_*`/`cotacao*` —
// a virada (plano futuro) guarda só um texto de origem (`chave_de_importacao`), nunca uma
// referência, porque a Abertura é módulo temporário e não pode levar o Financeiro junto no dia
// em que for desmontada.
export const grupoCategoria = pgEnum("grupo_categoria", ["receita", "custo", "geral", "fora"]);
export const areaFinanceira = pgEnum("area_financeira", [
  "cafeteria",
  "espaco",
  "pecas",
  "loja",
  "geral",
]);
export const formaPagamento = pgEnum("forma_pagamento", ["dinheiro", "pix", "cartao"]);
export const tipoDocumento = pgEnum("tipo_documento", ["venda", "despesa"]);
// A lista de unidades do protótipo do Estoque (`.planning/phases/06-estoque/prototipo.html`) —
// exibida com "L" maiúsculo só na tela, nunca no banco.
export const unidadeEstoque = pgEnum("unidade_estoque", ["un", "g", "kg", "ml", "l", "m"]);

// Uma categoria de venda/despesa: pertence a um grupo e a uma área (D-14/04.4-CONTEXT.md). O
// gestor nunca escolhe a área ao lançar — ela vem sempre da categoria (BRIEFING §2). O grupo
// `geral`/`fora` SEMPRE anda com área `geral`; o grupo `receita`/`custo` SEMPRE anda com uma das
// quatro áreas de verdade — a restrição de coerência abaixo prova isso no banco, não só no Zod.
// `chaveDoSistema` marca a única categoria achada por código, nunca por nome editável pelo dono
// (D-01/D-02/D-14): "diferenca" é a categoria "Juros, multas e descontos" da semente 0016.
export const categorias = pgTable(
  "categorias",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    nome: text("nome").notNull(),
    grupo: grupoCategoria("grupo").notNull(),
    area: areaFinanceira("area").notNull(),
    ativa: boolean("ativa").notNull().default(true),
    chaveDoSistema: text("chave_do_sistema"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    check("categorias_nome_comprimento", sql`length(trim(${tabela.nome})) between 1 and 120`),
    unique("categorias_chave_do_sistema_uk").on(tabela.chaveDoSistema),
    check(
      "categorias_chave_do_sistema_valida",
      sql`${tabela.chaveDoSistema} is null or ${tabela.chaveDoSistema} = 'diferenca'`,
    ),
    // Equivalência (não um "OU" solto): grupo em (geral, fora) SE E SOMENTE SE área = geral.
    check(
      "categorias_grupo_area_coerente",
      sql`(${tabela.grupo} in ('geral','fora')) = (${tabela.area} = 'geral')`,
    ),
    uniqueIndex("categorias_nome_normalizado_idx").on(sql`lower(trim(${tabela.nome}))`),
  ],
);

// O cadastro único de itens da plataforma (venda E compra). `aparece_na_venda`/`controla_estoque`
// não são exclusivos (um item pode vender e controlar estoque ao mesmo tempo) mas pelo menos um
// dos dois tem de ser verdadeiro — um item que não vende e não controla estoque não serve para
// nada neste módulo. `precoVendaCentavos` nulo = "valor na hora" (preço decidido no balcão).
export const itensCatalogo = pgTable(
  "itens_catalogo",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    nome: text("nome").notNull(),
    categoriaVendaId: uuid("categoria_venda_id").references(() => categorias.id),
    precoVendaCentavos: integer("preco_venda_centavos"),
    aparecenaVenda: boolean("aparece_na_venda").notNull().default(false),
    atalhoVenda: boolean("atalho_venda").notNull().default(false),
    controlaEstoque: boolean("controla_estoque").notNull().default(false),
    atalhoCompra: boolean("atalho_compra").notNull().default(false),
    unidade: unidadeEstoque("unidade"),
    categoriaCompraId: uuid("categoria_compra_id").references(() => categorias.id),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    check("itens_catalogo_nome_comprimento", sql`length(trim(${tabela.nome})) between 1 and 120`),
    check(
      "itens_catalogo_preco_no_intervalo",
      sql`${tabela.precoVendaCentavos} is null or (${tabela.precoVendaCentavos} >= 1 and ${tabela.precoVendaCentavos} <= 1000000000)`,
    ),
    check(
      "itens_catalogo_aparece_exige_categoria_venda",
      sql`not ${tabela.aparecenaVenda} or ${tabela.categoriaVendaId} is not null`,
    ),
    check(
      "itens_catalogo_controla_exige_unidade_e_categoria_compra",
      sql`not ${tabela.controlaEstoque} or (${tabela.unidade} is not null and ${tabela.categoriaCompraId} is not null)`,
    ),
    check(
      "itens_catalogo_aparece_ou_controla",
      sql`${tabela.aparecenaVenda} or ${tabela.controlaEstoque}`,
    ),
    check(
      "itens_catalogo_atalho_venda_exige_aparece",
      sql`not ${tabela.atalhoVenda} or ${tabela.aparecenaVenda}`,
    ),
    check(
      "itens_catalogo_atalho_compra_exige_controla",
      sql`not ${tabela.atalhoCompra} or ${tabela.controlaEstoque}`,
    ),
  ],
);

// Um nível só (D-01 do briefing §4/plano 03): o cálculo do efeito no estoque nunca recursa.
// `insumoId` também referencia `itens_catalogo` — o insumo É um item do catálogo, marcado
// `controla_estoque`.
export const fichaTecnica = pgTable(
  "ficha_tecnica",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    itemId: uuid("item_id")
      .notNull()
      .references(() => itensCatalogo.id),
    insumoId: uuid("insumo_id")
      .notNull()
      .references(() => itensCatalogo.id),
    quantidade: numeric("quantidade", { precision: 12, scale: 3 }).notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    unique("ficha_tecnica_item_insumo_uk").on(tabela.itemId, tabela.insumoId),
    check("ficha_tecnica_item_diferente_insumo", sql`${tabela.itemId} <> ${tabela.insumoId}`),
    check("ficha_tecnica_quantidade_positiva", sql`${tabela.quantidade} > 0`),
  ],
);

// Uma conta que se repete todo mês (aluguel, água e luz...). "Gerar as contas de <mês>" (plano
// 07) cria um `documentos` de despesa por conta ativa — idempotente por (conta_fixa_id,
// mes_referencia), a restrição única de `documentos` abaixo.
export const contasFixas = pgTable(
  "contas_fixas",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    nome: text("nome").notNull(),
    categoriaId: uuid("categoria_id")
      .notNull()
      .references(() => categorias.id),
    valorEsperadoCentavos: integer("valor_esperado_centavos").notNull(),
    diaVencimento: integer("dia_vencimento").notNull(),
    ativa: boolean("ativa").notNull().default(true),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    check("contas_fixas_nome_comprimento", sql`length(trim(${tabela.nome})) between 1 and 120`),
    check(
      "contas_fixas_valor_no_intervalo",
      sql`${tabela.valorEsperadoCentavos} >= 1 and ${tabela.valorEsperadoCentavos} <= 1000000000`,
    ),
    check(
      "contas_fixas_dia_vencimento_no_intervalo",
      sql`${tabela.diaVencimento} between 1 and 31`,
    ),
  ],
);

// Uma venda ou uma despesa — o "lançamento" que o gestor vê. `numero` é gerado pelo banco
// (`generated always as identity`, opção A do checkpoint do dono, 04.4-01-SUMMARY.md): uma
// sequência SÓ, para vendas e despesas juntas, sempre crescente, nunca repete, pode pular quando
// um lançamento falha no meio. O total do documento é SEMPRE a soma das linhas — nunca uma
// coluna gravada aqui (BRIEFING §5). `chaveDeImportacao` é texto puro (nunca uma chave
// estrangeira) para a virada da Abertura (plano futuro) não criar dependência entre os módulos.
export const documentos = pgTable(
  "documentos",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    numero: integer("numero").notNull().generatedAlwaysAsIdentity(),
    tipo: tipoDocumento("tipo").notNull(),
    // Dia civil, nunca timestamptz — o "hoje" do módulo é `hojeEmBrasilia(new Date())`,
    // calculado na borda, nunca `current_date` cru nem `new Date()` dentro de módulo puro.
    data: date("data", { mode: "string" }).notNull(),
    pessoaNome: text("pessoa_nome"),
    titulo: text("titulo"),
    contaFixaId: uuid("conta_fixa_id").references(() => contasFixas.id),
    mesReferencia: date("mes_referencia", { mode: "string" }),
    chaveDeImportacao: text("chave_de_importacao"),
    canceladoEm: timestamp("cancelado_em", { withTimezone: true }),
    canceladoPor: uuid("cancelado_por").references(() => usuarios.id),
    criadoPor: uuid("criado_por")
      .notNull()
      .references(() => usuarios.id),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    unique("documentos_numero_uk").on(tabela.numero),
    unique("documentos_conta_fixa_mes_uk").on(tabela.contaFixaId, tabela.mesReferencia),
    unique("documentos_chave_de_importacao_uk").on(tabela.chaveDeImportacao),
    check(
      "documentos_pessoa_nome_comprimento",
      sql`${tabela.pessoaNome} is null or length(trim(${tabela.pessoaNome})) between 1 and 160`,
    ),
    check(
      "documentos_titulo_comprimento",
      sql`${tabela.titulo} is null or length(trim(${tabela.titulo})) between 1 and 160`,
    ),
    check(
      "documentos_mes_referencia_primeiro_dia",
      sql`${tabela.mesReferencia} is null or extract(day from ${tabela.mesReferencia}) = 1`,
    ),
    check(
      "documentos_conta_fixa_e_mes_juntos",
      sql`(${tabela.contaFixaId} is null and ${tabela.mesReferencia} is null) or (${tabela.contaFixaId} is not null and ${tabela.mesReferencia} is not null)`,
    ),
    check(
      "documentos_cancelado_em_e_por_juntos",
      sql`(${tabela.canceladoEm} is null and ${tabela.canceladoPor} is null) or (${tabela.canceladoEm} is not null and ${tabela.canceladoPor} is not null)`,
    ),
    index("documentos_data_idx").on(tabela.data),
    index("documentos_tipo_data_idx").on(tabela.tipo, tabela.data),
  ],
);

// Uma parcela é QUANDO e COMO o dinheiro entra/sai — a forma de pagamento mora AQUI, nunca no
// documento (D-07 do 04.4-CONTEXT.md): uma venda pode ter uma parcela no Pix e outra em dinheiro
// (D-08, pagamento misto). `valorPrevistoCentavos`/`formaPrevista` só existem depois de um
// "Paguei"/"Recebi" com valor diferente do esperado — é o que faz o "Desfazer" (D-03) ser o
// inverso exato: sem guardar o valor original aqui, desfazer vira migração de dado depois.
export const parcelas = pgTable(
  "parcelas",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    documentoId: uuid("documento_id")
      .notNull()
      .references(() => documentos.id),
    numero: integer("numero").notNull(),
    vencimento: date("vencimento", { mode: "string" }).notNull(),
    valorCentavos: integer("valor_centavos").notNull(),
    forma: formaPagamento("forma").notNull(),
    pagoEm: date("pago_em", { mode: "string" }),
    pagoPor: uuid("pago_por").references(() => usuarios.id),
    // Congelada no momento do pagamento no cartão (BRIEFING §5) — mudar a taxa em Cadastros
    // depois não reescreve o passado.
    taxaPontosBase: integer("taxa_pontos_base"),
    valorPrevistoCentavos: integer("valor_previsto_centavos"),
    formaPrevista: formaPagamento("forma_prevista"),
    rotulo: text("rotulo"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    unique("parcelas_documento_numero_uk").on(tabela.documentoId, tabela.numero),
    check(
      "parcelas_valor_no_intervalo",
      sql`${tabela.valorCentavos} >= 1 and ${tabela.valorCentavos} <= 1000000000`,
    ),
    check(
      "parcelas_taxa_no_intervalo",
      sql`${tabela.taxaPontosBase} is null or (${tabela.taxaPontosBase} >= 0 and ${tabela.taxaPontosBase} <= 10000)`,
    ),
    check(
      "parcelas_valor_previsto_no_intervalo",
      sql`${tabela.valorPrevistoCentavos} is null or (${tabela.valorPrevistoCentavos} >= 1 and ${tabela.valorPrevistoCentavos} <= 1000000000)`,
    ),
    check(
      "parcelas_rotulo_comprimento",
      sql`${tabela.rotulo} is null or length(trim(${tabela.rotulo})) between 1 and 40`,
    ),
    check(
      "parcelas_taxa_exige_pago_no_cartao",
      sql`${tabela.taxaPontosBase} is null or (${tabela.pagoEm} is not null and ${tabela.forma} = 'cartao')`,
    ),
    check(
      "parcelas_previsto_e_forma_prevista_juntos",
      sql`(${tabela.valorPrevistoCentavos} is null and ${tabela.formaPrevista} is null) or (${tabela.valorPrevistoCentavos} is not null and ${tabela.formaPrevista} is not null)`,
    ),
    check(
      "parcelas_previsto_exige_pago",
      sql`${tabela.valorPrevistoCentavos} is null or ${tabela.pagoEm} is not null`,
    ),
    index("parcelas_pago_em_idx").on(tabela.pagoEm),
    index("parcelas_documento_idx").on(tabela.documentoId),
    index("parcelas_vencimento_em_aberto_idx")
      .on(tabela.vencimento)
      .where(sql`${tabela.pagoEm} is null`),
  ],
);

// Cada linha de um documento (o que foi vendido/comprado). `valorCentavos` é o valor da LINHA
// INTEIRA, já com desconto — nunca preço unitário: o desconto proporcional (D-09/D-10) não
// divide por quantidade em centavos exatos. `parcelaDiferencaId` marca a ÚNICA linha que pode
// ter valor negativo (D-01/D-02) — a "diferença" que um "Paguei/Recebi" com valor divergente
// acrescenta sozinho, sempre na categoria de `chave_do_sistema = 'diferenca'`.
export const documentoLinhas = pgTable(
  "documento_linhas",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    documentoId: uuid("documento_id")
      .notNull()
      .references(() => documentos.id),
    ordem: integer("ordem").notNull().default(0),
    itemId: uuid("item_id").references(() => itensCatalogo.id),
    descricao: text("descricao").notNull(),
    categoriaId: uuid("categoria_id")
      .notNull()
      .references(() => categorias.id),
    quantidade: integer("quantidade").notNull().default(1),
    quantidadeEstoque: numeric("quantidade_estoque", { precision: 12, scale: 3 }),
    valorCentavos: integer("valor_centavos").notNull(),
    parcelaDiferencaId: uuid("parcela_diferenca_id").references(() => parcelas.id),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    unique("documento_linhas_parcela_diferenca_uk").on(tabela.parcelaDiferencaId),
    check(
      "documento_linhas_descricao_comprimento",
      sql`length(trim(${tabela.descricao})) between 1 and 160`,
    ),
    check(
      "documento_linhas_quantidade_no_intervalo",
      sql`${tabela.quantidade} between 1 and 99999`,
    ),
    check(
      "documento_linhas_quantidade_estoque_positiva",
      sql`${tabela.quantidadeEstoque} is null or ${tabela.quantidadeEstoque} > 0`,
    ),
    check(
      "documento_linhas_valor_conforme_diferenca",
      sql`(${tabela.parcelaDiferencaId} is null and ${tabela.valorCentavos} between 0 and 1000000000) or (${tabela.parcelaDiferencaId} is not null and ${tabela.valorCentavos} between -1000000000 and 1000000000 and ${tabela.valorCentavos} <> 0)`,
    ),
    index("documento_linhas_documento_ordem_idx").on(tabela.documentoId, tabela.ordem),
    index("documento_linhas_categoria_idx").on(tabela.categoriaId),
  ],
);

// Linha única de configuração (mesmo padrão de `aberturaConfiguracao` acima). A migração NÃO
// semeia linha nenhuma: ausente = taxa 0, saldo 0, sem data — nunca um valor inventado.
export const configuracaoFinanceira = pgTable(
  "configuracao_financeira",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    linhaUnica: boolean("linha_unica").notNull().default(true),
    // 0 a 10000 pontos-base (3,5% = 350).
    taxaCartaoPontosBase: integer("taxa_cartao_pontos_base").notNull().default(0),
    saldoInicialCentavos: integer("saldo_inicial_centavos").notNull().default(0),
    dataSaldoInicial: date("data_saldo_inicial", { mode: "string" }),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    unique("configuracao_financeira_linha_unica_uk").on(tabela.linhaUnica),
    check("configuracao_financeira_linha_unica", sql`${tabela.linhaUnica}`),
    check(
      "configuracao_financeira_taxa_no_intervalo",
      sql`${tabela.taxaCartaoPontosBase} between 0 and 10000`,
    ),
    check(
      "configuracao_financeira_saldo_no_intervalo",
      sql`${tabela.saldoInicialCentavos} >= -1000000000 and ${tabela.saldoInicialCentavos} <= 1000000000`,
    ),
  ],
);

// Fase 04.5 — Financeiro, parte 2: Precificação e Orçamento (migração 0017). O traçador da fase
// (04.5-01-PLAN.md): oito tabelas novas, todas PERMANENTES, mesmo espírito do bloco do
// Financeiro acima (nenhuma sai numa migração de remoção, nenhuma chave estrangeira usa
// `cascade`). Dinheiro em centavos inteiros com teto de 10^9; percentual em pontos-base inteiros
// (3,5% = 350, mesma convenção de `configuracao_financeira.taxa_cartao_pontos_base` — D-16: a
// taxa do cartão NÃO é duplicada aqui, `calcularPeca` a recebe por argumento); medidas físicas em
// milímetros/miligramas/milésimos, nunca ponto flutuante numa coluna que entra em cálculo.
export const statusOrcamento = pgEnum("status_orcamento", [
  "rascunho",
  "enviado",
  "aprovado",
  "recusado",
]);
export const planoPagamentoOrcamento = pgEnum("plano_pagamento_orcamento", [
  "sinal",
  "avista",
  "3x",
]);

// Parâmetros do cálculo de precificação, COM HISTÓRICO (D-15): mudar um valor cria uma linha
// nova com data, nunca sobrescreve — o gatilho `recusar_mudanca_de_valor_do_parametro()`
// (migração 0018) recusa qualquer `update` que altere `valor_inteiro`/`vigente_desde`; só
// `medido` é atualizável. `chave` é uma das 18 chaves fechadas de
// `lib/precificacao/parametros.ts::CATALOGO_DE_PARAMETROS` (plano 04.5-01, Tarefa 2) — o `check`
// abaixo espelha essa lista literalmente, e a semente de `0019` também: três lugares, uma
// verdade, divergir quebra `npm run test:migracoes`. `criadoPor` nulo = nasceu com a migração de
// semente (0019), que não tem usuário logado.
export const parametrosPrecificacao = pgTable(
  "parametros_precificacao",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    chave: text("chave").notNull(),
    valorInteiro: integer("valor_inteiro").notNull(),
    medido: boolean("medido").notNull().default(false),
    vigenteDesde: date("vigente_desde", { mode: "string" }).notNull(),
    criadoPor: uuid("criado_por").references(() => usuarios.id),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    unique("parametros_precificacao_chave_vigencia_uk").on(tabela.chave, tabela.vigenteDesde),
    check(
      "parametros_precificacao_chave_valida",
      sql`${tabela.chave} in (
        'material_argila','material_esmalte','trabalho_hora','forno_tarifa_energia',
        'forno_kwh_biscoito','forno_kwh_esmalte','forno_largura_util','forno_profundidade_util',
        'forno_altura_util','forno_folga_entre_pecas','forno_prateleira_e_pilar',
        'forno_fator_biscoito','forno_desgaste_por_fornada','perda_unica','preco_lucro',
        'preco_folga_negociacao','preco_imposto_sobre_venda','preco_comissao_galeria'
      )`,
    ),
    check(
      "parametros_precificacao_valor_no_intervalo",
      sql`${tabela.valorInteiro} between 0 and 1000000000`,
    ),
    index("parametros_precificacao_chave_vigencia_idx").on(
      tabela.chave,
      tabela.vigenteDesde.desc(),
    ),
  ],
);

// Ficha de precificação de uma peça (D-18/D-19): argila/esmalte em miligramas, horas em
// milésimos, medidas em milímetros (a tela pede cm, a conversão é na borda). Ficha "de linha"
// (`itemCatalogoId` preenchido) tem o preço praticado NO `itens_catalogo` — uma verdade só, por
// isso `precoPraticadoCentavos` é exigido nulo nesse caso (D-18); ficha exclusiva
// (`exclusiva = true`) não referencia catálogo nenhum e guarda o próprio preço praticado.
export const fichasPrecificacao = pgTable(
  "fichas_precificacao",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    nome: text("nome").notNull(),
    argilaMiligramas: integer("argila_miligramas").notNull().default(0),
    esmalteMiligramas: integer("esmalte_miligramas").notNull().default(0),
    horasMilesimos: integer("horas_milesimos").notNull().default(0),
    larguraMm: integer("largura_mm").notNull().default(0),
    profundidadeMm: integer("profundidade_mm").notNull().default(0),
    alturaMm: integer("altura_mm").notNull().default(0),
    embalagemCentavos: integer("embalagem_centavos").notNull().default(0),
    // "Já contei" (D-12): substitui o calculado por `quantasCabem`, independentemente um do
    // outro. Anuláveis — nulo = "não contei, calcule pelas medidas".
    cabemBiscoitoInformado: integer("cabem_biscoito_informado"),
    cabemEsmalteInformado: integer("cabem_esmalte_informado"),
    precoMercadoCentavos: integer("preco_mercado_centavos"),
    precoPraticadoCentavos: integer("preco_praticado_centavos"),
    exclusiva: boolean("exclusiva").notNull().default(false),
    itemCatalogoId: uuid("item_catalogo_id").references(() => itensCatalogo.id),
    criadoPor: uuid("criado_por")
      .notNull()
      .references(() => usuarios.id),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    check(
      "fichas_precificacao_nome_comprimento",
      sql`length(trim(${tabela.nome})) between 1 and 120`,
    ),
    check(
      "fichas_precificacao_argila_no_intervalo",
      sql`${tabela.argilaMiligramas} between 0 and 10000000`,
    ),
    check(
      "fichas_precificacao_esmalte_no_intervalo",
      sql`${tabela.esmalteMiligramas} between 0 and 10000000`,
    ),
    check(
      "fichas_precificacao_horas_no_intervalo",
      sql`${tabela.horasMilesimos} between 0 and 10000000`,
    ),
    check(
      "fichas_precificacao_largura_no_intervalo",
      sql`${tabela.larguraMm} between 0 and 10000000`,
    ),
    check(
      "fichas_precificacao_profundidade_no_intervalo",
      sql`${tabela.profundidadeMm} between 0 and 10000000`,
    ),
    check(
      "fichas_precificacao_altura_no_intervalo",
      sql`${tabela.alturaMm} between 0 and 10000000`,
    ),
    check(
      "fichas_precificacao_embalagem_no_intervalo",
      sql`${tabela.embalagemCentavos} between 0 and 1000000000`,
    ),
    check(
      "fichas_precificacao_cabem_biscoito_nao_negativo",
      sql`${tabela.cabemBiscoitoInformado} is null or ${tabela.cabemBiscoitoInformado} >= 0`,
    ),
    check(
      "fichas_precificacao_cabem_esmalte_nao_negativo",
      sql`${tabela.cabemEsmalteInformado} is null or ${tabela.cabemEsmalteInformado} >= 0`,
    ),
    check(
      "fichas_precificacao_preco_mercado_no_intervalo",
      sql`${tabela.precoMercadoCentavos} is null or (${tabela.precoMercadoCentavos} >= 0 and ${tabela.precoMercadoCentavos} <= 1000000000)`,
    ),
    check(
      "fichas_precificacao_preco_praticado_no_intervalo",
      sql`${tabela.precoPraticadoCentavos} is null or (${tabela.precoPraticadoCentavos} >= 0 and ${tabela.precoPraticadoCentavos} <= 1000000000)`,
    ),
    unique("fichas_precificacao_item_catalogo_uk").on(tabela.itemCatalogoId),
    // D-18 no banco, não só na tela: ficha exclusiva não tem item de catálogo; ficha de linha
    // tem item de catálogo E não guarda preço praticado próprio (o preço é o do item).
    check(
      "fichas_precificacao_exclusividade_coerente",
      sql`(${tabela.exclusiva} and ${tabela.itemCatalogoId} is null) or (not ${tabela.exclusiva} and ${tabela.itemCatalogoId} is not null and ${tabela.precoPraticadoCentavos} is null)`,
    ),
  ],
);

// Um orçamento (D-05/D-06/D-07/D-21/D-22). `sequencial` nasce de
// `lib/orcamentos/numero.ts::proximoSequencialDeOrcamento`, dentro da MESMA transação que grava
// esta linha — nunca de uma contagem lida antes (D-06). `snapshot`/`congeladoEm` gravam juntos,
// só quando "Marcar como enviado" congela (D-21): a restrição de coerência abaixo faz
// "rascunho calcula ao vivo, enviado está congelado" ser invariante de banco, não só de tela.
// `documentoId`/`encomendaId` são os vínculos da aprovação (D-25), gravados nos dois sentidos.
export const orcamentos = pgTable(
  "orcamentos",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    ano: integer("ano").notNull(),
    sequencial: integer("sequencial").notNull(),
    revisao: integer("revisao").notNull().default(1),
    status: statusOrcamento("status").notNull().default("rascunho"),
    clienteNome: text("cliente_nome"),
    titulo: text("titulo"),
    data: date("data", { mode: "string" }).notNull(),
    validadeDias: integer("validade_dias").notNull().default(10),
    entregaPrevista: date("entrega_prevista", { mode: "string" }).notNull(),
    plano: planoPagamentoOrcamento("plano").notNull().default("sinal"),
    sinalPercentual: integer("sinal_percentual").notNull().default(50),
    freteCentavos: integer("frete_centavos").notNull().default(0),
    observacoes: text("observacoes"),
    congeladoEm: timestamp("congelado_em", { withTimezone: true }),
    snapshot: jsonb("snapshot"),
    documentoId: uuid("documento_id").references(() => documentos.id),
    encomendaId: uuid("encomenda_id").references(() => encomendas.id),
    criadoPor: uuid("criado_por")
      .notNull()
      .references(() => usuarios.id),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    unique("orcamentos_ano_sequencial_uk").on(tabela.ano, tabela.sequencial),
    unique("orcamentos_documento_id_uk").on(tabela.documentoId),
    unique("orcamentos_encomenda_id_uk").on(tabela.encomendaId),
    check(
      "orcamentos_cliente_nome_comprimento",
      sql`${tabela.clienteNome} is null or length(trim(${tabela.clienteNome})) between 1 and 160`,
    ),
    check(
      "orcamentos_titulo_comprimento",
      sql`${tabela.titulo} is null or length(trim(${tabela.titulo})) between 1 and 160`,
    ),
    check(
      "orcamentos_observacoes_comprimento",
      sql`${tabela.observacoes} is null or length(trim(${tabela.observacoes})) between 1 and 300`,
    ),
    check("orcamentos_validade_dias_no_intervalo", sql`${tabela.validadeDias} between 1 and 365`),
    check(
      "orcamentos_sinal_percentual_no_intervalo",
      sql`${tabela.sinalPercentual} between 1 and 100`,
    ),
    check("orcamentos_frete_no_intervalo", sql`${tabela.freteCentavos} between 0 and 1000000000`),
    check("orcamentos_revisao_minima", sql`${tabela.revisao} >= 1`),
    check(
      "orcamentos_rascunho_sem_snapshot",
      sql`(${tabela.status} = 'rascunho') = (${tabela.snapshot} is null)`,
    ),
    check(
      "orcamentos_snapshot_e_congelado_juntos",
      sql`(${tabela.snapshot} is null) = (${tabela.congeladoEm} is null)`,
    ),
    check(
      "orcamentos_documento_exige_aprovado",
      sql`${tabela.documentoId} is null or ${tabela.status} = 'aprovado'`,
    ),
    index("orcamentos_ano_sequencial_idx").on(tabela.ano.desc(), tabela.sequencial.desc()),
  ],
);

// Uma linha de peça dentro do orçamento (`ordem` decide a posição na lista).
export const orcamentoLinhas = pgTable(
  "orcamento_linhas",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orcamentoId: uuid("orcamento_id")
      .notNull()
      .references(() => orcamentos.id),
    fichaId: uuid("ficha_id")
      .notNull()
      .references(() => fichasPrecificacao.id),
    quantidade: integer("quantidade").notNull(),
    precoUnitarioCentavos: integer("preco_unitario_centavos").notNull(),
    cor: text("cor"),
    personalizacao: text("personalizacao"),
    ordem: integer("ordem").notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    check("orcamento_linhas_quantidade_no_intervalo", sql`${tabela.quantidade} between 1 and 100000`),
    check(
      "orcamento_linhas_preco_no_intervalo",
      sql`${tabela.precoUnitarioCentavos} between 0 and 1000000000`,
    ),
    check(
      "orcamento_linhas_cor_comprimento",
      sql`${tabela.cor} is null or length(trim(${tabela.cor})) between 1 and 80`,
    ),
    check(
      "orcamento_linhas_personalizacao_comprimento",
      sql`${tabela.personalizacao} is null or length(trim(${tabela.personalizacao})) between 1 and 200`,
    ),
    unique("orcamento_linhas_orcamento_ordem_uk").on(tabela.orcamentoId, tabela.ordem),
    index("orcamento_linhas_orcamento_idx").on(tabela.orcamentoId),
  ],
);

// Custo de projeto do orçamento — molde, protótipo, carimbo etc. (`ordem` decide a posição).
export const orcamentoProjeto = pgTable(
  "orcamento_projeto",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orcamentoId: uuid("orcamento_id")
      .notNull()
      .references(() => orcamentos.id),
    descricao: text("descricao").notNull(),
    valorCentavos: integer("valor_centavos").notNull(),
    ordem: integer("ordem").notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    check(
      "orcamento_projeto_descricao_comprimento",
      sql`length(trim(${tabela.descricao})) between 1 and 120`,
    ),
    check(
      "orcamento_projeto_valor_no_intervalo",
      sql`${tabela.valorCentavos} between 0 and 1000000000`,
    ),
    unique("orcamento_projeto_orcamento_ordem_uk").on(tabela.orcamentoId, tabela.ordem),
    index("orcamento_projeto_orcamento_idx").on(tabela.orcamentoId),
  ],
);

// Foto de referência do orçamento (D-26/D-27), até 3 por orçamento (`ordem between 0 and 2`, o
// limite mora no banco, não só na tela). `arquivo` guarda só o NOME gerado pelo servidor
// (`<uuid>.jpg`) — o `check` de formato fecha a porta de travessia de caminho (`../`) antes de
// qualquer código de leitura existir (a leitura é do plano 10).
export const orcamentoFotos = pgTable(
  "orcamento_fotos",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orcamentoId: uuid("orcamento_id")
      .notNull()
      .references(() => orcamentos.id),
    ordem: integer("ordem").notNull(),
    arquivo: text("arquivo").notNull(),
    legenda: text("legenda"),
    bytes: integer("bytes").notNull(),
    larguraPx: integer("largura_px"),
    alturaPx: integer("altura_px"),
    anexadoPor: uuid("anexado_por")
      .notNull()
      .references(() => usuarios.id),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    check("orcamento_fotos_ordem_no_intervalo", sql`${tabela.ordem} between 0 and 2`),
    unique("orcamento_fotos_orcamento_ordem_uk").on(tabela.orcamentoId, tabela.ordem),
    unique("orcamento_fotos_arquivo_uk").on(tabela.arquivo),
    check(
      "orcamento_fotos_legenda_comprimento",
      sql`${tabela.legenda} is null or length(trim(${tabela.legenda})) between 1 and 80`,
    ),
    check("orcamento_fotos_bytes_no_intervalo", sql`${tabela.bytes} between 0 and 1000000000`),
    check(
      "orcamento_fotos_largura_positiva",
      sql`${tabela.larguraPx} is null or ${tabela.larguraPx} > 0`,
    ),
    check(
      "orcamento_fotos_altura_positiva",
      sql`${tabela.alturaPx} is null or ${tabela.alturaPx} > 0`,
    ),
    check(
      "orcamento_fotos_arquivo_formato",
      sql`${tabela.arquivo} ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'`,
    ),
    index("orcamento_fotos_orcamento_idx").on(tabela.orcamentoId),
  ],
);

// Histórico de revisão de "Atualizar preços" (D-07/D-23) — SEM `atualizado_em` e sem gatilho,
// a mesma exceção "só inserção" que `execucoes_backup` já usa: cada revisão é uma linha nova,
// nenhuma linha é alterada depois de escrita. `snapshot` aqui é o congelamento da revisão
// ANTERIOR, guardado no momento em que uma nova revisão nasce.
export const orcamentoRevisoes = pgTable(
  "orcamento_revisoes",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orcamentoId: uuid("orcamento_id")
      .notNull()
      .references(() => orcamentos.id),
    revisao: integer("revisao").notNull(),
    enviadoEm: timestamp("enviado_em", { withTimezone: true }),
    totalCentavos: integer("total_centavos").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    unique("orcamento_revisoes_orcamento_revisao_uk").on(tabela.orcamentoId, tabela.revisao),
    check(
      "orcamento_revisoes_total_no_intervalo",
      sql`${tabela.totalCentavos} between 0 and 1000000000`,
    ),
    index("orcamento_revisoes_orcamento_idx").on(tabela.orcamentoId),
  ],
);

// Tabela de uma linha por ano, para a numeração `ORC-{ano}-{sequencial}` (D-06, RESEARCH.md
// Pattern 1). Incrementada por `insert ... on conflict do update ... returning` DENTRO da mesma
// transação que grava o orçamento (`lib/orcamentos/numero.ts`) — nunca `select max(...)+1`.
// Nenhuma coluna de data: é um contador, não um registro de histórico.
export const contadoresOrcamento = pgTable(
  "contadores_orcamento",
  {
    ano: integer("ano").primaryKey(),
    ultimoNumero: integer("ultimo_numero").notNull().default(0),
  },
  (tabela) => [
    check("contadores_orcamento_ano_no_intervalo", sql`${tabela.ano} between 2020 and 2200`),
    check(
      "contadores_orcamento_ultimo_numero_no_intervalo",
      sql`${tabela.ultimoNumero} between 0 and 999999`,
    ),
  ],
);

// Fase 04.6, plano 07 — Anotações da casa (migração 0022, D-08/GES-10): uma folha só,
// compartilhada por toda a casa — o que um escreve, o outro vê. `linhaUnica` + `unique` + `check`
// é o MESMO molde de `aberturaConfiguracao`/`configuracaoFinanceira` acima: a garantia de linha
// única mora no BANCO, não na disciplina da aplicação. `salvoPor` é ANULÁVEL — nulo significa
// "ninguém salvou ainda", o estado que a semente da migração 0022 cria (mesmo comentário de
// `parametrosPrecificacao.criadoPor` acima: nulo = nasceu com a migração, sem usuário logado).
//
// 🔴 `atualizadoEm` É A MARCA DE VERSÃO usada para detectar escrita velha (D-08): quem gravá-lo à
// mão, em vez de deixar o gatilho `tocar_atualizado_em_anotacoes_da_casa` (migração 0022) fazer
// isso, transforma a detecção numa comparação que a própria aplicação controla — e ela deixa de
// detectar qualquer coisa. `decidirGravacao` (lib/anotacoes/folha.ts) compara este valor DENTRO
// da transação que grava, depois de travar a linha com `select ... for update` — comparado fora
// da transação, a janela entre ler e escrever é exatamente o defeito que D-08 pede para fechar.
// `texto` tem `check` de comprimento espelhando o limite do Zod (`LIMITE_DE_CARACTERES` em
// `lib/anotacoes/folha.ts`, 10.000) — `length()` do Postgres conta caracteres, não bytes.
export const anotacoesDaCasa = pgTable(
  "anotacoes_da_casa",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    linhaUnica: boolean("linha_unica").notNull().default(true),
    texto: text("texto").notNull().default(""),
    salvoPor: uuid("salvo_por").references(() => usuarios.id),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    unique("anotacoes_da_casa_linha_unica_uk").on(tabela.linhaUnica),
    check("anotacoes_da_casa_linha_unica", sql`${tabela.linhaUnica}`),
    check("anotacoes_da_casa_texto_comprimento", sql`length(${tabela.texto}) <= 10000`),
  ],
);

import {
  type AnyPgColumn,
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

// ---------------------------------------------------------------------------------------------
// Fase 06.1 — Produção (migração 0024_producao). O redesenho das Encomendas: a ordem de produção
// deixa de ter um cronograma CALCULADO pelo calendário e passa a ter etapas MARCADAS como feitas
// (`ordem_etapas.feita_em`, a data real, decidida no servidor). A etapa atual é a primeira sem
// `feita_em`; nada aqui deduz a etapa da data (PRD-12).
//
// - D-01: a `0024` só cria, religa e grava o dado do D-02; as tabelas velhas de Encomendas
//   (`encomendas`, `encomenda_itens`, `encomenda_etapas`) e os tipos `status_encomenda` e
//   `etapa_encomenda` saíram deste arquivo no plano 06.1-14, e quem as apaga do banco é a
//   `0025_remover-encomendas`. Gerar as duas num diff só faria o `drizzle-kit` perguntar "criada
//   ou renomeada?" (06.1-RESEARCH.md, Pitfall 3).
// - D-02: orçamento aprovado e ativo com encomenda provisória ganha, NA migração, a ordem
//   "aguardando o sinal" — com o MESMO id da encomenda (bloco à mão da `0024`).
// - D-09: a `0024` e a `0025` vão na mesma publicação e são aplicadas numa sessão só de
//   `db:migrate`, pelo dono, depois de backup (Roteiro 16, plano 06.1-15).
// - D-10: os dias previstos padrão (5/15/1/1/4/6) moram em `lib/producao/etapas.ts`
//   (`DIAS_PREVISTOS_PADRAO`); o bloco (b) da `0024` repete os números e um teste compara.
// - Os dois vínculos que apontavam para `encomendas` (`orcamentos.encomenda_id` e
//   `movimentacoes_estoque.encomenda_id`) MANTÊM O NOME e passam a apontar para
//   `ordens_producao` — "encomenda_id" é o nome histórico do vínculo com a ordem de produção.
//   Decisão do plano 06.1-01: renomear faria o `drizzle-kit` perguntar (Pitfall 3), o destino
//   "Consumo em encomenda" do livro continua existindo com esse nome, e o Estoque, que está no
//   ar e verificado, não precisa mudar de nome de campo. Sem `on delete`: ordem não se apaga
//   (`revoke delete` das três tabelas para `amassa_app`, à mão na `0024`) — só se cancela.
//
// `etapa_producao` tem os MESMOS seis valores do antigo `etapa_encomenda`: é o que mantém os
// tokens `--color-{etapa}` de `app/globals.css` (os "NÃO ALTERAR") valendo sem tradução.
// ---------------------------------------------------------------------------------------------
export const tipoOrdem = pgEnum("tipo_ordem", ["encomenda", "casa"]);
export const caminhoOrdem = pgEnum("caminho_ordem", ["completo", "biscoito"]);
export const statusOrdem = pgEnum("status_ordem", [
  "aguardando_sinal",
  "ativa",
  "concluida",
  "cancelada",
]);
export const etapaProducao = pgEnum("etapa_producao", [
  "producao",
  "secagem",
  "queima1",
  "esmaltacao",
  "queima2",
  "entrega",
]);
export const destinoExtras = pgEnum("destino_extras", ["estoque", "sem_destino"]);
// Qual material do previsto uma baixa "consumo em encomenda" cobre (a ficha diz "argila" e
// "esmalte" sem dizer qual item do estoque — a escolha é de quem dá a baixa).
export const materialDaOrdem = pgEnum("material_da_ordem", ["argila", "esmalte"]);

// A ordem de produção: encomenda (tem cliente) ou produção da casa. `inicio` nulo = aguardando o
// sinal (o prazo ainda não conta); `concluida_em` e `cancelada_em` andam junto do status — os
// `check`s abaixo fazem disso invariante do banco, não só da tela. Datas civis em `date`
// (`mode: "string"`, `YYYY-MM-DD` do banco à tela); o cancelamento é um momento (`timestamptz`).
export const ordensProducao = pgTable(
  "ordens_producao",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    // "ordem nº 9" — gerado pelo banco, nunca pela aplicação.
    numero: integer("numero").notNull().generatedAlwaysAsIdentity(),
    tipo: tipoOrdem("tipo").notNull(),
    caminho: caminhoOrdem("caminho").notNull().default("completo"),
    status: statusOrdem("status").notNull(),
    nome: text("nome").notNull(),
    clienteNome: text("cliente_nome"),
    entregaPrometida: date("entrega_prometida", { mode: "string" }),
    inicio: date("inicio", { mode: "string" }),
    concluidaEm: date("concluida_em", { mode: "string" }),
    entregaParcial: boolean("entrega_parcial").notNull().default(false),
    canceladaEm: timestamp("cancelada_em", { withTimezone: true }),
    canceladaPor: uuid("cancelada_por").references(() => usuarios.id),
    // D-07: a ordem ainda aguardando o sinal cancelada JUNTO com a venda no Caixa.
    canceladaPelaVenda: boolean("cancelada_pela_venda").notNull().default(false),
    // `set null` (como era na antiga `encomendas`): desativar/remover uma conta nunca apaga o
    // histórico.
    criadoPor: uuid("criado_por").references(() => usuarios.id, { onDelete: "set null" }),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    unique("ordens_producao_numero_uk").on(tabela.numero),
    check(
      "ordens_producao_nome_comprimento",
      sql`length(trim(${tabela.nome})) between 1 and 120`,
    ),
    check(
      "ordens_producao_cliente_comprimento",
      sql`${tabela.clienteNome} is null or length(trim(${tabela.clienteNome})) between 1 and 160`,
    ),
    check(
      "ordens_producao_cliente_so_em_encomenda",
      sql`${tabela.tipo} = 'encomenda' or ${tabela.clienteNome} is null`,
    ),
    // Aguardando o sinal não tem início; ativa e concluída têm. A cancelada aceita os dois: a que
    // caiu ainda aguardando (D-07, "Cancelar ordem") fica sem início, a liberada guarda o dela.
    check(
      "ordens_producao_aguardando_sem_inicio",
      sql`(${tabela.status} = 'aguardando_sinal' and ${tabela.inicio} is null) or (${tabela.status} in ('ativa', 'concluida') and ${tabela.inicio} is not null) or ${tabela.status} = 'cancelada'`,
    ),
    check(
      "ordens_producao_concluida_com_data",
      sql`(${tabela.status} = 'concluida') = (${tabela.concluidaEm} is not null)`,
    ),
    check(
      "ordens_producao_cancelada_com_data",
      sql`(${tabela.status} = 'cancelada') = (${tabela.canceladaEm} is not null)`,
    ),
    check(
      "ordens_producao_cancelada_por",
      sql`${tabela.canceladaEm} is null or ${tabela.canceladaPor} is not null`,
    ),
    check(
      "ordens_producao_parcial_so_concluida",
      sql`not ${tabela.entregaParcial} or ${tabela.status} = 'concluida'`,
    ),
    check(
      "ordens_producao_pela_venda_so_cancelada",
      sql`not ${tabela.canceladaPelaVenda} or ${tabela.status} = 'cancelada'`,
    ),
    index("ordens_producao_status_idx").on(tabela.status),
    // A perda medida dos últimos 6 meses (D-08) lê por data de conclusão.
    index("ordens_producao_concluida_em_idx").on(tabela.concluidaEm),
  ],
);

// As etapas do caminho da ordem (6 no completo, 4 no que termina no biscoito), uma linha por
// etapa. `feita_em` é o dia REAL em que a etapa foi marcada como feita; `passaram` é o parcial
// informativo da etapa atual ("já passaram 30 de 40"), apagado quando ela termina. As regras que o
// banco não expressa (as feitas formam um prefixo do caminho; `feita_em` não decresce; `passaram`
// só na etapa atual) moram no módulo puro `lib/producao/` e nos testes dele.
export const ordemEtapas = pgTable(
  "ordem_etapas",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    ordemId: uuid("ordem_id")
      .notNull()
      .references(() => ordensProducao.id),
    etapa: etapaProducao("etapa").notNull(),
    posicao: integer("posicao").notNull(),
    diasPrevistos: integer("dias_previstos").notNull(),
    feitaEm: date("feita_em", { mode: "string" }),
    passaram: integer("passaram"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    unique("ordem_etapas_ordem_etapa_uk").on(tabela.ordemId, tabela.etapa),
    unique("ordem_etapas_ordem_posicao_uk").on(tabela.ordemId, tabela.posicao),
    check("ordem_etapas_posicao_faixa", sql`${tabela.posicao} between 0 and 5`),
    check("ordem_etapas_dias_previstos_faixa", sql`${tabela.diasPrevistos} between 1 and 365`),
    check(
      "ordem_etapas_passaram_nao_negativo",
      sql`${tabela.passaram} is null or ${tabela.passaram} >= 0`,
    ),
  ],
);

// Fase 4 — Contador de Queima (módulo de Fornos). SQL literal em
// amassa-plataforma/02-MODELO-DE-DADOS.md §3. Migração 0007_queimas (não 0004 — ver Desvio 1 de
// 04-01-PLAN.md: o `.planning/ROADMAP.md` nomeia a migração antes da ordem de execução ter sido
// antecipada; 0000-0006 já existem no repositório). Checkpoint 04-01/Tarefa 1: gerar agora,
// aplicar em produção só no plano de fechamento (04-07), depois de um backup, à mão.
//
// `ocorrida_em`/`ocorridaEm` é timestamptz (instante), NUNCA date (dia civil) — o oposto de
// `ordens_producao.inicio` (e da antiga `encomendas.data_inicio`): uma queima acontece num
// momento preciso do dia, não é um marco de calendário. A view de apoio `fornos_medidos` do documento fonte NÃO é criada (Desvio 2): o
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
    // Fase 06 — Estoque (migração 0023, D-01/D-20): o Estoque NÃO tem cadastro próprio; acrescenta
    // ao item só o que é dele. Mínimo em MILÉSIMOS inteiros da unidade (mesma escala de
    // `movimentacoes_estoque.quantidade_milesimos`); zero = "nunca avisa" (EST-04). `ativo` no
    // MESMO padrão de `categorias.ativa`: item com movimentação ou venda se desativa, nunca se
    // apaga (o `revoke delete` da 0015 continua valendo). Nenhuma coluna de SALDO aqui — o saldo é
    // sempre a soma do livro (EST-02).
    estoqueMinimoMilesimos: bigint("estoque_minimo_milesimos", { mode: "number" })
      .notNull()
      .default(0),
    observacoes: text("observacoes"),
    ativo: boolean("ativo").notNull().default(true),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    check("itens_catalogo_nome_comprimento", sql`length(trim(${tabela.nome})) between 1 and 120`),
    check(
      "itens_catalogo_minimo_nao_negativo",
      sql`${tabela.estoqueMinimoMilesimos} >= 0`,
    ),
    check(
      "itens_catalogo_observacoes_comprimento",
      sql`${tabela.observacoes} is null or length(trim(${tabela.observacoes})) between 1 and 500`,
    ),
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

// Fase 06.1 — as peças de uma ordem de produção (migração 0024_producao). A ficha é REFERÊNCIA,
// não cópia: material previsto e fornadas leem a ficha ao vivo. Peça da casa escolhida em "Itens
// do estoque", sem ficha, leva só o item (D-13); peça em texto livre não leva nenhum dos dois
// (D-04). `descricao` é congelada (o nome do snapshot do orçamento, da ficha ou o texto livre).
// `perdidas`, `para_estoque` e `sem_destino` nascem nulos e são preenchidos JUNTOS na conclusão.
export const ordemPecas = pgTable(
  "ordem_pecas",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    ordemId: uuid("ordem_id")
      .notNull()
      .references(() => ordensProducao.id),
    posicao: integer("posicao").notNull(),
    fichaId: uuid("ficha_id").references(() => fichasPrecificacao.id),
    itemCatalogoId: uuid("item_catalogo_id").references(() => itensCatalogo.id),
    descricao: text("descricao").notNull(),
    quantidade: integer("quantidade").notNull(),
    aMais: integer("a_mais").notNull().default(0),
    cor: text("cor"),
    personalizacao: text("personalizacao"),
    perdidas: integer("perdidas"),
    destinoExtras: destinoExtras("destino_extras"),
    paraEstoque: integer("para_estoque"),
    semDestino: integer("sem_destino"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    unique("ordem_pecas_ordem_posicao_uk").on(tabela.ordemId, tabela.posicao),
    check("ordem_pecas_posicao_nao_negativa", sql`${tabela.posicao} >= 0`),
    check(
      "ordem_pecas_descricao_comprimento",
      sql`length(trim(${tabela.descricao})) between 1 and 160`,
    ),
    check("ordem_pecas_quantidade_faixa", sql`${tabela.quantidade} between 1 and 100000`),
    check("ordem_pecas_a_mais_faixa", sql`${tabela.aMais} between 0 and 100000`),
    check(
      "ordem_pecas_cor_comprimento",
      sql`${tabela.cor} is null or length(trim(${tabela.cor})) between 1 and 80`,
    ),
    check(
      "ordem_pecas_personalizacao_comprimento",
      sql`${tabela.personalizacao} is null or length(trim(${tabela.personalizacao})) between 1 and 200`,
    ),
    check(
      "ordem_pecas_perdidas_faixa",
      sql`${tabela.perdidas} is null or ${tabela.perdidas} between 0 and ${tabela.quantidade} + ${tabela.aMais}`,
    ),
    check(
      "ordem_pecas_conclusao_junta",
      sql`(${tabela.perdidas} is null and ${tabela.paraEstoque} is null and ${tabela.semDestino} is null) or (${tabela.perdidas} is not null and ${tabela.paraEstoque} is not null and ${tabela.semDestino} is not null)`,
    ),
    check(
      "ordem_pecas_destinos_cabem",
      sql`${tabela.paraEstoque} is null or (${tabela.paraEstoque} >= 0 and ${tabela.semDestino} >= 0 and ${tabela.paraEstoque} + ${tabela.semDestino} <= ${tabela.quantidade} + ${tabela.aMais} - ${tabela.perdidas})`,
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
    // Fase 06.1 (migração 0024): "encomenda_id" é o nome histórico do vínculo com a ORDEM DE
    // PRODUÇÃO — aponta para `ordens_producao` desde a 0024 (ver o comentário de `ordensProducao`).
    encomendaId: uuid("encomenda_id").references(() => ordensProducao.id),
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

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Fase 06 — Estoque (migração 0023_estoque). O LIVRO IMUTÁVEL de onde o saldo sai.
//
// D-01 (ADENDO §1): NÃO existe tabela de materiais — o Estoque trabalha sobre `itens_catalogo`
// com `controla_estoque`. EST-02: NÃO existe coluna de saldo nem view de saldos em lugar nenhum —
// o saldo é `SUM(quantidade_milesimos)` e o valor em estoque é `SUM(valor_centavos)` sobre esta
// tabela, lidos por `lib/estoque/consultas.ts::listarSaldos`. Correção é um AJUSTE (linha nova);
// cancelamento é um ESTORNO (linha nova que aponta para a original por `estorno_de_id`). A migração
// 0023 revoga `update` e `delete` de `amassa_app` — é o `revoke` que a 0003 antecipava.
//
// D-02 (ADENDO §3): a origem é `venda` · `compra` · `producao` · `manual`. `producao` existe no
// modelo mas nada a produz até o redesenho da Produção.
//
// Deliberadamente SEM `atualizado_em` e SEM gatilho de toque — a exceção que
// `02-MODELO-DE-DADOS.md` §0 abre para esta tabela (a mesma de `execucoes_backup` acima): linha
// escrita nunca é alterada.
//
// A ORDEM do livro é `numero` (identity), NUNCA `criado_em`: `now()` é o instante de INÍCIO da
// transação — todas as linhas de uma venda empatam, e uma transação que começou antes e comitou
// depois ficaria "antes" (06-RESEARCH.md §Pergunta 4).
//
// 🔴 D-33 — ordem de publicação: o código que grava aqui de dentro da venda e da compra QUEBRA TODA
// VENDA se chegar à produção antes da migração. Backup → migração 0023 → conferência de fora → só
// então o código (roteiro do plano 06-11). A migração só ACRESCENTA, então o código antigo roda com
// ela aplicada.
//
// Quantidade em MILÉSIMOS inteiros e dinheiro em CENTAVOS inteiros, ambos `bigint` (Pitfall 11: a
// linha de venda aceita 99.999 unidades e a ficha 999.999 por unidade — passa de 2^31). O valor de
// cada linha é decidido por `lib/estoque/custo.ts` (custo médio móvel, D-25), sob a trava de
// `lib/estoque/gravacao.ts` — a única porta de escrita desta tabela.
export const origemMovimentacao = pgEnum("origem_movimentacao", [
  "venda",
  "compra",
  "producao",
  "manual",
]);
export const tipoMovimentacao = pgEnum("tipo_movimentacao", ["entrada", "saida", "ajuste"]);
// Os cinco destinos da saída MANUAL (D-15), cada um com a área que paga em
// `lib/estoque/destinos.ts` (D-14). "Venda na loja" não existe: venda só nasce no Financeiro.
export const destinoSaida = pgEnum("destino_saida", [
  "aula",
  "encomenda",
  "cafeteria",
  "atelie",
  "perda",
]);
export const motivoMovimentacao = pgEnum("motivo_movimentacao", ["saldo_inicial", "peca_pronta"]);

export const movimentacoesEstoque = pgTable(
  "movimentacoes_estoque",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    numero: bigint("numero", { mode: "number" }).notNull().generatedAlwaysAsIdentity(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => itensCatalogo.id),
    origem: origemMovimentacao("origem").notNull(),
    tipo: tipoMovimentacao("tipo").notNull(),
    motivo: motivoMovimentacao("motivo"),
    destino: destinoSaida("destino"),
    // A área do Financeiro que PAGOU esta saída: saída manual pelo destino (D-14), venda pela
    // categoria de venda da linha (D-27). Decidida no servidor, nunca aceita do cliente.
    area: areaFinanceira("area"),
    // Com sinal: entrada > 0, saída < 0, ajuste qualquer (a diferença contra o saldo do instante).
    quantidadeMilesimos: bigint("quantidade_milesimos", { mode: "number" }).notNull(),
    // Efeito COM SINAL no valor em estoque (custo médio do instante, D-07).
    valorCentavos: bigint("valor_centavos", { mode: "number" }).notNull(),
    // O que se pagou/digitou numa entrada ("quanto custou ao todo", nota da compra). Pode diferir
    // de `valor_centavos` quando a entrada chega com saldo negativo e reprecifica (caso 4).
    valorInformadoCentavos: bigint("valor_informado_centavos", { mode: "number" }),
    // O que se contou na prateleira — obrigatório no ajuste, permitido no saldo inicial.
    saldoContadoMilesimos: bigint("saldo_contado_milesimos", { mode: "number" }),
    documentoId: uuid("documento_id").references(() => documentos.id),
    documentoLinhaId: uuid("documento_linha_id").references(() => documentoLinhas.id),
    // Fase 06.1 (migração 0024): "encomenda_id" é o nome histórico do vínculo com a ORDEM DE
    // PRODUÇÃO — aponta para `ordens_producao` desde a 0024. Até a 0023 apontava para `encomendas`
    // com `on delete set null` (Pitfall 10 da Fase 06: `excluirEncomenda` apagava de verdade). A
    // ordem não se apaga (`revoke delete` para `amassa_app`), então o vínculo não tem `on delete`.
    // Na saída manual é o "Consumo em encomenda" ligado à ordem; na entrada `producao` (peça
    // pronta que entra no Estoque na conclusão) é obrigatório — os `check`s abaixo.
    encomendaId: uuid("encomenda_id").references(() => ordensProducao.id),
    // Qual material do previsto da ordem esta baixa cobre (Fase 06.1) — só na saída manual
    // "consumo em encomenda" ligada a uma ordem.
    materialDaOrdem: materialDaOrdem("material_da_ordem"),
    // Texto livre curto: turma (até a Agenda existir), "o que aconteceu?", motivo do ajuste.
    nota: text("nota"),
    // Um estorno por original (restrição única abaixo).
    estornoDeId: uuid("estorno_de_id").references((): AnyPgColumn => movimentacoesEstoque.id),
    registradoPor: uuid("registrado_por")
      .notNull()
      .references(() => usuarios.id),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    unique("movimentacoes_estoque_numero_uk").on(tabela.numero),
    unique("movimentacoes_estoque_estorno_de_uk").on(tabela.estornoDeId),
    check("movimentacoes_estoque_quantidade_nao_zero", sql`${tabela.quantidadeMilesimos} <> 0`),
    check(
      "movimentacoes_estoque_sinal_do_tipo",
      sql`(${tabela.tipo} = 'entrada' and ${tabela.quantidadeMilesimos} > 0) or (${tabela.tipo} = 'saida' and ${tabela.quantidadeMilesimos} < 0) or ${tabela.tipo} = 'ajuste'`,
    ),
    // Venda só sai (ou estorna entrando); compra só entra (ou estorna saindo); produção só entra;
    // manual nunca é estorno (correção manual é ajuste).
    check(
      "movimentacoes_estoque_origem_tipo_estorno",
      sql`(${tabela.origem} = 'venda' and ((${tabela.tipo} = 'saida' and ${tabela.estornoDeId} is null) or (${tabela.tipo} = 'entrada' and ${tabela.estornoDeId} is not null))) or (${tabela.origem} = 'compra' and ((${tabela.tipo} = 'entrada' and ${tabela.estornoDeId} is null) or (${tabela.tipo} = 'saida' and ${tabela.estornoDeId} is not null))) or (${tabela.origem} = 'producao' and ${tabela.tipo} = 'entrada' and ${tabela.estornoDeId} is null) or (${tabela.origem} = 'manual' and ${tabela.estornoDeId} is null)`,
    ),
    check(
      "movimentacoes_estoque_documento_da_origem",
      sql`(${tabela.documentoId} is not null) = (${tabela.origem} in ('venda', 'compra'))`,
    ),
    check(
      "movimentacoes_estoque_destino_da_saida_manual",
      sql`(${tabela.destino} is not null) = (${tabela.origem} = 'manual' and ${tabela.tipo} = 'saida')`,
    ),
    check(
      "movimentacoes_estoque_destino_exige_area",
      sql`${tabela.destino} is null or ${tabela.area} is not null`,
    ),
    check(
      "movimentacoes_estoque_venda_exige_area",
      sql`${tabela.origem} <> 'venda' or ${tabela.area} is not null`,
    ),
    // Fase 06.1: substitui `movimentacoes_estoque_encomenda_so_no_destino_encomenda` — o vínculo
    // com a ordem vale na saída "consumo em encomenda" E na entrada da produção.
    check(
      "movimentacoes_estoque_ordem_so_no_destino_encomenda_ou_producao",
      sql`${tabela.encomendaId} is null or ${tabela.destino} = 'encomenda' or ${tabela.origem} = 'producao'`,
    ),
    check(
      "movimentacoes_estoque_producao_com_ordem",
      sql`${tabela.origem} <> 'producao' or ${tabela.encomendaId} is not null`,
    ),
    check(
      "movimentacoes_estoque_material_da_ordem_so_na_baixa",
      sql`${tabela.materialDaOrdem} is null or (${tabela.origem} = 'manual' and ${tabela.destino} = 'encomenda' and ${tabela.encomendaId} is not null)`,
    ),
    check(
      "movimentacoes_estoque_valor_informado_da_entrada",
      sql`(${tabela.valorInformadoCentavos} is not null) = (${tabela.tipo} = 'entrada')`,
    ),
    check(
      "movimentacoes_estoque_valor_informado_nao_negativo",
      sql`${tabela.valorInformadoCentavos} is null or ${tabela.valorInformadoCentavos} >= 0`,
    ),
    check(
      "movimentacoes_estoque_saldo_contado_nao_negativo",
      sql`${tabela.saldoContadoMilesimos} is null or ${tabela.saldoContadoMilesimos} >= 0`,
    ),
    check(
      "movimentacoes_estoque_ajuste_exige_saldo_contado",
      sql`${tabela.tipo} <> 'ajuste' or ${tabela.saldoContadoMilesimos} is not null`,
    ),
    check(
      "movimentacoes_estoque_saldo_contado_so_ajuste_ou_inicial",
      sql`${tabela.saldoContadoMilesimos} is null or ${tabela.tipo} = 'ajuste' or ${tabela.motivo} = 'saldo_inicial'`,
    ),
    check(
      "movimentacoes_estoque_motivo_so_manual",
      sql`${tabela.motivo} is null or ${tabela.origem} = 'manual'`,
    ),
    check(
      "movimentacoes_estoque_motivo_do_tipo",
      sql`${tabela.motivo} is null or (${tabela.motivo} = 'saldo_inicial' and ${tabela.tipo} in ('entrada', 'ajuste')) or (${tabela.motivo} = 'peca_pronta' and ${tabela.tipo} = 'entrada')`,
    ),
    check(
      "movimentacoes_estoque_nota_comprimento",
      sql`${tabela.nota} is null or length(trim(${tabela.nota})) between 1 and 160`,
    ),
    index("movimentacoes_estoque_item_numero_idx").on(tabela.itemId, tabela.numero),
    index("movimentacoes_estoque_documento_idx").on(tabela.documentoId),
    index("movimentacoes_estoque_criado_em_idx").on(tabela.criadoEm),
  ],
);

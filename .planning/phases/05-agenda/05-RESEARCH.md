# Phase 5: Agenda - Research

**Researched:** 2026-10-01
**Domain:** Módulo novo dentro do Next.js 16.3.5 / React 19 / Drizzle 0.45 / Postgres 17 já em produção:
um calendário (turmas, avulsas, uso livre, fechados) com presença e reposição em módulo puro, um
cadastro de clientes transversal (D-01), cobrança que **sempre** vira Venda do Financeiro (sem
guardar dinheiro), baixa de estoque com destino novo no enum (D-06), mensalidade idempotente pelo
banco (D-02), e a primeira leitura de banco do site público (ISR na raiz) — sem pacote novo.
**Confidence:** HIGH nas treze perguntas de integração (cada uma respondida lendo o código nesta
sessão, com arquivo e linha); HIGH na mecânica do enum (reproduzida num Postgres 17.10 real nesta
sessão); HIGH no comportamento de cache/ISR (documentação do próprio Next 16.3.5, embarcada em
`node_modules/next/dist/docs`); MEDIUM no modelo de dados e no desenho de `lib/agenda/` (recomendação
dentro do "Claude's Discretion"); LOW nas dez tensões de produto listadas em "Open Questions", que
precisam do dono.

<user_constraints>
## User Constraints (from CONTEXT.md)

> Copiado de `05-CONTEXT.md` (discussão com o dono no chat, 01/10/2026, ~01h35–02h UTC, por
> formulário). **Em conflito com o briefing, o CONTEXT vence**; o protótipo vence sobre a interface,
> o briefing vence sobre regra de dado.

### Locked Decisions

#### Travadas pelo briefing de 26/09/2026 (não reabrir)
As nove decisões do §2 (dois formatos de aula com material incluso · uso livre por hora cheia,
matéria-prima cobrada ou inclusa item a item · só o ateliê lança · presença por pessoa · reposição
sem validade · vencimento 1–28 por turma · mensalidade proporcional · sem controle de lotação · site
só com aulas e oficinas, uso livre como texto) e as regras de §3 a §9. Estão nos AGE-01..20.

#### Pessoas — o cadastro de clientes (buraco do briefing, fora da §11)
- **D-01:** O "cadastro de clientes do Financeiro" que a §4 pressupõe **não existe**: a Venda guarda
  o nome em texto livre (`documentos.pessoa_nome`), como o Orçamento (`orcamentos.cliente_nome`) e a
  Produção (`ordens_producao.cliente_nome`); o `04.4-CONTEXT.md` tirou "cadastro de Pessoas" do
  escopo de propósito. Decisão do dono: **o cadastro de clientes nasce nesta fase** — uma tabela de
  clientes (nome; telefone opcional), visível em Cadastros, que passa a ser **o** cadastro de pessoas
  do sistema; a Agenda é a primeira a usá-lo ("+ Pessoa" da aba Pessoas cria aqui). As Vendas
  criadas pela Agenda gravam o **vínculo com o cliente além do `pessoa_nome`** (que continua
  preenchido, para o Financeiro seguir funcionando igual). **A Venda manual, o Orçamento e a
  Produção continuam com texto livre nesta fase**; ligá-los ao cadastro é trabalho de outra fase
  (ver Deferred). Cumpre o "sem cadastro paralelo": não haverá outro. — **Reversibility:** one-way —
  tabela nova e coluna de vínculo em `documentos` por migração aplicada pelo dono; desfazer depois de
  haver dado exige migração de dado.

#### Mensalidade (§11.1)
- **D-02:** A mensalidade do mês **nasce ao abrir a tela, de forma idempotente** — sem rotina no dia
  1 (o projeto não tem `cron` nem worker na aplicação, Out of Scope). Ao abrir a Agenda ("A
  receber", a ficha da pessoa, o Início), o servidor cria as mensalidades do mês corrente que faltam,
  uma por aluno e mês, com a garantia **no banco** (chave única + `on conflict do nothing`), no
  padrão de `gerarContasDoMes` (`lib/cadastros/acoes.ts`) — nunca uma leitura prévia de "já
  existe?". O dono perguntou se é o do protótipo: o protótipo **não simula a virada do mês** (as
  mensalidades vêm dos dados de exemplo; só a entrada na turma cria uma, linha 331), mas mostra o
  resultado — mensalidades já em "A receber", sem botão de gerar —, que só esta opção reproduz.
  Ao entrar na turma no meio do mês continua valendo o proporcional (AGE-07), e a chave única evita
  que o "ao abrir" crie uma segunda mensalidade para esse aluno.

#### Turma (§11.2)
- **D-03:** A turma fixa ganha uma **folha própria, simples** (aberta da aula e da ficha da
  pessoa): **editar** nome, horário, vagas, mensalidade, dia de vencimento e público; **"Marcar mais
  N semanas"**; **desativar** (sai das datas futuras e do site; o passado fica; nunca apaga). Mudar
  horário ou vagas vale para as datas futuras; mudar a mensalidade vale do **próximo mês** em diante
  (a do mês corrente, já nascida, não muda).

#### Item do Catálogo da mensalidade (§11.3)
- **D-04:** **Um item "Mensalidade" só** no Catálogo (categoria das aulas, área Espaço), e **não** um
  item por turma como o briefing propunha. A linha da Venda leva a descrição com a turma e o mês
  ("Mensalidade · Torno iniciante · outubro") e o valor **vem da turma** (ou do proporcional). Por
  quê: o Mês do Financeiro agrupa por **categoria**, não por item (`lib/financeiro/mes.ts`), então
  um item por turma não muda o relatório; e o valor já é campo da turma (§3) — item por turma
  poria o mesmo preço em dois lugares. Soma por turma, se um dia for preciso, sai da própria Agenda
  (o vínculo mensalidade ↔ venda é guardado). Vale o mesmo raciocínio para "Inscrição em oficina"
  (um item, preço vindo do evento) e "Uso livre (hora)" (um item, cujo **preço de venda é o preço
  da hora** — cadastro, nunca código).

#### Início (§11.4)
- **D-05:** O bloco "Agenda de hoje" do Início passa a ler as consultas da Agenda (GES-09) e lista os
  eventos do dia como no `prototipo-gestao.html` da 04.6. A linha permanente **"Agora no espaço: N
  pessoas"** soma: as pessoas de todo **uso livre com "Chegou" e ainda não encerrado** + os
  **inscritos de toda aula/oficina cujo horário cobre o momento atual**, sem contar quem já está
  marcado "Faltou". A aula conta pelo horário porque ninguém marca chegada de aluno. Continua
  contagem, sem fração (decisão do dono de 29/09, `lib/agenda/espaco.ts`).

#### Estoque (buraco achado na discussão)
- **D-06:** O material do uso livre sai do Estoque com um **destino novo, "Uso livre do espaço"**,
  pago pela **área Espaço**, com **vínculo ao uso livre** que o gerou. O destino "uso do espaço" que
  o briefing cita não existe: hoje há "Consumo em aula" (Espaço) e "Uso do ateliê" (Peças)
  (`lib/estoque/destinos.ts`). Separar de "Consumo em aula" é o que deixa o Estoque dizer quanto o
  uso livre consome por mês — o número que o §6 quer para decidir se passa a cobrar material. —
  **Reversibility:** one-way — valor novo no enum `destino_saida` e coluna de vínculo em
  `movimentacoes_estoque`, por migração aplicada pelo dono; enum do Postgres não perde valor sem
  recriar o tipo.

#### Aula experimental (buraco achado na discussão)
- **D-07:** Quem entra **só numa data de turma fixa** (experimental/avulsa — não é aluno e não é
  reposição) tem a cobrança **decidida na hora**: ao colocar a pessoa, a folha pergunta **"cobrar"
  ou "gratuita"**. "Cobrar" sugere o valor de uma aula (mensalidade ÷ aulas da turma no mês,
  arredondado ao centavo), **editável**, e vai para "A receber" como uma inscrição — "Recebi agora"
  / "Lançar na Venda", como o resto. O protótipo não cobrava nada; o briefing não dizia. Mesmo
  padrão do "cobrar / incluso" do material (AGE-14).

### Claude's Discretion
- O número do WhatsApp do site: o briefing diz "é cadastro"; a 04.6 decidiu (D-17) que ele mora em
  `conteudo/site.ts` (`CONTEUDO_SITE.zap`), lido por `lib/site/whatsapp.ts`. **Manter o da 04.6** —
  é o conteúdo do site, editado num lugar só; não criar segundo lugar.
- Onde fica a página pública do calendário (seção da raiz e/ou rota própria) e a revalidação por
  tempo (SIT-02: "lê o banco com cache e revalidação por tempo, nunca a cada visita") — pesquisa e
  planejamento decidem, seguindo `components/site/aulas-e-oficinas.tsx`, que hoje mostra o estado
  "sem Agenda" (SIT-07).
- Modelo de dados exato (o §9 do briefing é sugestão), nomes de tabela em português.
- Como o "Lançar na Venda" abre o rascunho preenchido da Venda.

### Deferred Ideas (OUT OF SCOPE)
- **Ligar a Venda manual, o Orçamento e a Produção ao cadastro de clientes** (seletor de cliente no
  lugar do texto livre) — consequência da D-01; fase própria ou Polimento.
- Tudo o que o §10 do briefing lista: reserva online · pacotes/planos · lembrete automático por
  WhatsApp · lista de espera · cobrança automática de mensalidade · integração com Queimas.

### Também fora (achado desta pesquisa, não pedido por AGE nem D)
- Vínculo real da saída "Consumo em aula" com a turma/data (hoje é texto livre, `lib/estoque/destinos.ts:18-21`).
  Caberia numa coluna `evento_id` no livro e num seletor na folha do Estoque; nenhum AGE pede e não
  é barato (mexe na folha do Estoque, que está no ar e verificada). Fica para depois.
- Editar uma aula/oficina avulsa já lançada (o protótipo só cancela — linha 352). Não entra.

### Precedência (a mesma em todas as fases)
`prototipo.html` vence na interface; `BRIEFING.md` vence em regra de dado; `05-CONTEXT.md` vence
sobre o briefing. Os conflitos achados estão em "Open Questions", com recomendação — nenhuma decisão
travada foi reaberta.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AGE-01 | Um calendário, quatro tipos, só o ateliê lança, folha "Lançar na agenda" | Modelo: `eventos` (turma/avulsa/fechado) + `usos_livres`; protótipo `folhaNovo` (313-320); Pergunta 12 |
| AGE-02 | Vista semana (padrão no celular, "+ lançar" por dia, "Hoje") e mês (pontos por tipo; toque abre a semana) | `lib/agenda/semana.ts` (o nome que o CLAUDE.md já reserva); `?vista=`/`?semana=`/`?mes=` em `lib/agenda/abas.ts`; protótipo 255-260 |
| AGE-03 | Turma fixa com N semanas (padrão 8), estender depois; folha da turma (D-03) | Pergunta 9; `lib/agenda/turma.ts::datasDaTurma/proximasDatas`; `unique(turma_id, data)` + `on conflict do nothing` |
| AGE-04 | Cada data de turma é evento próprio; cancelar pelo ateliê não conta falta | `eventos.turma_id`; cancelar limpa presença/direito (protótipo 352); créditos derivados ignoram data cancelada |
| AGE-05 | Cancelar nunca apaga (desfazível); só reserva não iniciada e fechado se removem, com confirmação | `cancelado_em/por`; `delete` só em `usos_livres` (estado `reservado`) e `eventos` (tipo `fechado`), conferido sob trava |
| AGE-06 | Pessoas = cadastro de clientes (D-01); busca; tags "a repor"/"a receber"; ficha | Pergunta 1; `clientes` + `nome_normalizado()` (02-MODELO-DE-DADOS.md:47-51) para busca sem acento |
| AGE-07 | Entra/sai da turma pela ficha; proporcional ao entrar; sai das datas futuras | `turma_alunos`; `lib/agenda/mensalidade.ts::valorProporcional`; protótipo 331 |
| AGE-08 | Veio/Faltou em um toque, tocar de novo desmarca; "marcar presença" em data passada | Ação recebe o estado DESEJADO (molde `definirContaFixaAtiva`, `lib/cadastros/acoes.ts:791-794`); `lib/agenda/presenca.ts` |
| AGE-09 | Reposição: falta com direito gera 1 crédito sem validade; crédito = faltas com direito − reposições, os dois lados guardados | `inscricoes.direito_a_repor` + `inscricoes.tipo = 'reposicao'`; `lib/agenda/reposicao.ts`; trava do cliente (Pitfall 7) |
| AGE-10 | "Colocar alguém": primeiro quem tem a repor; depois qualquer um (experimental/inscrição); oficina "tirar da lista" | `tipo_inscricao`; D-07 (`cobrar`, `valor_centavos`); Open Question 1 (tirar depois de lançado) |
| AGE-11 | Sem lotação do espaço; n / vagas por aula; lista cheia avisa e não bloqueia | Nenhum `check` de vagas; `lib/agenda/vagas.ts::listaCheia` só para o aviso; Open Question 5 (dia fechado) |
| AGE-12 | Avulsa: nome, data, horário, vagas, preço por pessoa, público; inscrição paga à parte | `eventos` tipo `avulsa` com `preco_centavos`; inscrição copia o preço na hora |
| AGE-13 | Uso livre Reservado → Chegou → Encerrado; horas cheias = teto((saída − chegada)/60); valor = horas × pessoas × preço da hora + material cobrado | Pergunta 7; `lib/agenda/uso-livre.ts`; preço da hora congelado no encerramento (item "Uso livre (hora)") |
| AGE-14 | Material: cada linha vira saída manual destino novo, vínculo, custo médio — inclusive o incluso; "cobrar" soma preço × quantidade | Pergunta 5 (D-06, enum + `uso_livre_id`); Pergunta 2 (material cobrado é linha **livre**, nunca linha de item); Open Question 6 |
| AGE-15 | "A receber"; "Recebi agora" (Venda paga hoje) e "Lançar na Venda" (rascunho); vínculo; "pago" derivado | Perguntas 2, 3 e 4; `lib/financeiro/gravacao.ts::gravarVenda` (extraído de `lancarVenda`); Open Question 1 |
| AGE-16 | Lote de mensalidades: uma Venda por aluno, parcela no dia da turma; nasce no dia 1 sem duplicar | Pergunta 8 (D-02); Pergunta 3 (lote pelo escritor compartilhado, numa transação) |
| AGE-17 | Itens do Catálogo criados pela fase, editáveis; nenhum preço no código | Pergunta 6; semente na `0026` com `preco_venda_centavos` nulo; chave estável (Open Question 9) |
| AGE-18 | Site: calendário público (Próximas + mês), vagas, WhatsApp, uso livre, sem nome; número é cadastro | Pergunta 10 (ISR na raiz, `revalidatePath("/")` nas ações); Open Questions 3 e 4 (preço no site × D-18 da 04.6) |
| AGE-19 | Aba Números, só leitura, mês até hoje | `lib/agenda/numeros.ts` (puro) + uma consulta por indicador |
| AGE-20 | Regras em `lib/agenda/` puro com "hoje" por parâmetro; centavos e milésimos; cancelar nunca apaga venda nem movimentação | §"O módulo puro `lib/agenda/`"; FK sem `on delete` de `movimentacoes_estoque.uso_livre_id` e `*.documento_id` |
</phase_requirements>

## Summary

A fase é, no banco, **um cadastro novo transversal** (`clientes`, D-01) e **sete tabelas da Agenda**
(`turmas`, `turma_alunos`, `eventos`, `inscricoes`, `mensalidades`, `usos_livres`,
`usos_livres_material`), **três colunas em tabelas que estão no ar** (`documentos.cliente_id`,
`movimentacoes_estoque.uso_livre_id`, `itens_catalogo.chave_do_sistema`), **um valor novo no enum**
`destino_saida` (D-06), a função `nome_normalizado()` que o modelo de dados já previa para "a fase da
Agenda" (`db/migrations/0002_base-comum-datas-e-trigger.sql:4-6`; receita em
`amassa-plataforma/02-MODELO-DE-DADOS.md:47-51`) e a semente dos três itens do Catálogo (D-04/AGE-17)
— tudo numa migração `0026_agenda.sql`. Nenhum pacote novo.

A Agenda **não escreve dinheiro por conta própria**: "Recebi agora", "Lançar na Venda" e o lote de
mensalidades criam Vendas pelo **mesmo escritor** que `lancarVenda` usa, extraído para
`lib/financeiro/gravacao.ts` (sem `use server`, no molde de `lib/estoque/gravacao.ts` e
`lib/producao/gravacao.ts`), e o vínculo (mensalidade/inscrição/uso livre → `documentos.id`) é gravado
**na mesma transação**, com uma atualização condicional que impede duas vendas para a mesma cobrança.
"Pago" nunca é gravado na Agenda: é derivado de `documentos.cancelado_em` + `parcelas.pago_em`. O
"Lançar na Venda" abre a tela de Venda do Financeiro **preenchida por um token de origem na URL**
(`?origem=mensalidade:<id>`), que o servidor resolve — o cliente nunca manda descrição, cliente nem
valor-base da cobrança.

Os quatro riscos que mais podem derrubar a fase: (1) **o `ALTER TYPE … ADD VALUE` roda dentro da
transação única do migrador do Drizzle, e o Postgres 17 recusa qualquer `check` que cite o valor novo
como literal na mesma transação** (`ERROR: unsafe use of new value "uso_livre"` — reproduzido nesta
sessão); a saída é comparar como texto (`destino::text = 'uso_livre'`), também reproduzida; (2)
**colunas novas em `documentos` e `movimentacoes_estoque` quebram TODA venda e TODA baixa** entre o
deploy do código e o `db:migrate`, porque o `insert` do Drizzle lista todas as colunas do esquema
compilado (`node_modules/drizzle-orm/pg-core/dialect.js:356-390`); (3) **o material cobrado no uso
livre não pode ser linha de item da venda** — a linha de venda só aceita quantidade inteira
(`documento_linhas_quantidade_no_intervalo`, `db/schema.ts:918-921`) e a venda de um item que controla
estoque dá baixa sozinha (`lib/financeiro/efeito-estoque.ts:109-112`), o que somaria uma segunda saída
à do D-06; (4) **a raiz do site é `force-static` e provada sem banco** (`app/page.tsx:19`,
`tests/unit/site-isolamento.test.ts`, `scripts/testar-site-sem-banco.mjs`) — a seção viva precisa de
ISR com queda para o estado "sem Agenda", e a cerca do teste de isolamento tem de ser reescrita de
propósito, não afrouxada.

**Primary recommendation:** `lib/agenda/` puro e testado primeiro; depois a `0026` (com os `check`s do
enum em texto, `TABELAS_ESPERADAS` e as conferências em `test:migracoes`) junto com `clientes` em
Cadastros e o escritor compartilhado da Venda; depois as telas na ordem Agenda (semana/mês/folhas) →
Pessoas → A receber → Números → Início → site; e o roteiro do dono (`docs/operacao/17-migracao-agenda.md`)
com `/api/health/agenda` provando a migração.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Datas da turma, proporcional, horas cheias, créditos, vagas, situação da cobrança, semana/mês, números | API / Backend (módulo puro `lib/agenda/*`) | Browser (só desenha) | Regra de negócio em módulo puro que recebe "hoje"/"agora" (CLAUDE.md, AGE-20) |
| Lançar/cancelar/remover, presença, colocar/tirar, entrar/sair da turma, chegou/encerrar | API (Server Actions `lib/agenda/acoes.ts`) | Database (`unique`, `check`, travas `for no key update`) | `exigirUsuario()` na 1ª linha; decisão sob trava |
| Mensalidade do mês (D-02) | Database (`insert … select … on conflict do nothing`) | API (`lib/agenda/gravacao.ts`, chamado no carregamento) | Idempotência pelo banco, nunca por leitura prévia |
| Cobrança → Venda (Recebi agora, lote) | API (`lib/financeiro/gravacao.ts::gravarVenda`, recebe `tx`) | Database (restrição adiada da soma, 0015) | Um escritor de venda só; vínculo na mesma transação |
| "Lançar na Venda" | Frontend Server (página do Financeiro resolve `?origem=`) | Browser (`PainelVenda` preenchido) → API (`lancarVenda` com `origem`) | Reaproveita a tela de ajuste que já existe |
| "Pago" | Database (leitura: `documentos` + `parcelas`) | API (puro `situacaoDaCobranca`) | Derivado; a Agenda não guarda dinheiro (§5) |
| Material do uso livre → Estoque | API (`lib/estoque/gravacao.ts::gravarMovimentacoes`) | Database (enum + `uso_livre_id` + `check`s) | Porta única do livro; área decidida por `areaDoDestino` |
| Cadastro de clientes | API (`lib/cadastros/acoes.ts` ou `lib/clientes/`) | Frontend Server (Cadastros → Clientes; Agenda → Pessoas) | Transversal (D-01): mora fora da Agenda |
| Bloco "Agenda de hoje" + "Agora no espaço" | Frontend Server (Server Component com `try/catch` próprio) | API (`lib/agenda/consultas.ts` + puro `espaco.ts`) | GES-08/GES-09 |
| Calendário público | Frontend Server (ISR da raiz, `revalidate` + `revalidatePath("/")`) | Browser (navegação de mês/dia num Client Component) | SIT-02: lê o banco com cache, nunca a cada visita; continua de pé sem banco |

## Standard Stack

Nenhuma biblioteca nova. Tudo já está no `package.json` (lido nesta sessão).

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.3.5 `[VERIFIED: node_modules/next/package.json]` | App Router, Server Actions, ISR (`revalidate`, `revalidatePath`) | Já é o framework (o CLAUDE.md diz "15+") |
| react | 19.1.0 `[VERIFIED: package.json]` | Telas; `useTransition` + `router.refresh()` no toque | Molde de `components/amassa/producao/botao-terminei.tsx:94-121` |
| drizzle-orm | 0.45.2 `[VERIFIED: package.json]` | Tabelas, `tx`, `.for("no key update")`, `insert().select()` + `onConflictDoNothing` | `buildInsertQuery({ …, select, onConflict })` lido em `dialect.js:356-370` |
| drizzle-kit | 0.31.10 `[VERIFIED: package.json]` | `npm run db:generate -- --name agenda` → `0026_agenda.sql` | Resto à mão, molde `0023`/`0024` |
| pg | 8.22.0 `[VERIFIED: package.json]` | Driver, READ COMMITTED | Nada muda em `db/index.ts` |
| zod | 4.4.3 `[VERIFIED: package.json]` | Validação no servidor | Regra do projeto |
| vitest | 4.1.10 `[VERIFIED: package.json]` | `tests/unit/agenda-*.test.ts` | Molde dos `producao-*.test.ts` |
| @playwright/test | ^1.62.1 `[VERIFIED: package.json]` | e2e, cadeia `vazio-*` | — |
| lucide-react | 1.28.0 `[VERIFIED: package.json]` | Ícones (`CalendarDays` já mapeado em `barra-inferior.tsx:27`) | — |

### Supporting (já no projeto, reaproveitar)
| Módulo | Purpose | When to Use |
|--------|---------|-------------|
| `lib/estoque/gravacao.ts::gravarMovimentacoes` + `lib/estoque/pedidos.ts::pedidoDeSaidaManual` | Porta única do livro | Material do uso livre (AGE-14) |
| `lib/estoque/destinos.ts::areaDoDestino` | Área que paga a saída | Destino novo `uso_livre` → `espaco` |
| `lib/financeiro/parcelas.ts::conferirParcelas` | Soma e regras de parcela | Escritor compartilhado (já chamado por `lancarVenda` e `aprovarOrcamento`) |
| `lib/financeiro/consultas.ts::obterConfiguracaoFinanceira` | Taxa do cartão, saldo inicial | "Recebi agora" no cartão congela a taxa |
| `lib/financeiro/formato.ts::hojeEmBrasilia/formatarReais/nomeDoMes` | "Hoje" na borda, dinheiro pt-BR | Todas as telas e ações |
| `lib/financeiro/calendario.ts::primeiroDiaDoMes/ultimoDiaDoMes/somarDias` | Aritmética civil | Mês da mensalidade, vencimento |
| `lib/producao/calendario.ts::diasEntre/somarDias/ehDataCivil` | Aritmética civil inteira | Semana, datas da turma (reaproveitar em vez de uma 4ª cópia) |
| `lib/financeiro/navegacao.ts::hrefDoCaixa` | URL do Caixa | Link "ver no Caixa" do item lançado |
| `lib/erro/postgres.ts::codigoDoErroPostgres` | SQLSTATE em `erro.cause.code` | Log de falha |
| `lib/rotas/gestao.ts::rotaDeGestao` | Montagem de URL | Todo link novo |
| `lib/site/whatsapp.ts::hrefDoWhatsapp` + `conteudo/site.ts` (`CONTEUDO_SITE.zap`, `MENSAGENS_DO_WHATSAPP`) | WhatsApp do site (D-17 da 04.6) | Cartões do calendário público |
| `components/amassa/{estado-vazio,estado-erro,cabecalho-pagina}.tsx`, `inicio/{bloco-do-inicio,tentar-de-novo,bloco-esqueleto}.tsx` | Estados obrigatórios | Toda tela e o bloco do Início |
| `components/ui/dialog.tsx` | As "folhas" | Molde de `components/amassa/producao/folha-nova-ordem.tsx:543-739` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `eventos` (turma/avulsa/fechado) + `usos_livres` separado | Uma tabela `eventos` com tudo, como o protótipo | O uso livre tem pessoa, estado, horas e material — metade das colunas seriam nulas e os `check`s viram uma árvore |
| Escritor de venda extraído (`gravarVenda(tx, …)`) | A Agenda chamar `lancarVenda` (Server Action) | `lancarVenda` força `descricao: item.nome` (`acoes.ts:215`), não grava `cliente_id` e abre a própria transação — o vínculo não seria atômico |
| Escritor de venda extraído | Copiar o insert de documento/linhas/parcelas (como `aprovarOrcamento` e `gerarContasDoMes` fizeram) | Seria o 4º escritor paralelo (`lib/cadastros/acoes.ts:869`, `lib/orcamentos/acoes.ts:1253`, `lib/financeiro/acoes.ts:194`); a taxa do cartão e o estoque divergiriam |
| `time` + `date` | `timestamptz` para início/fim/chegada/saída | O que se guarda é hora de parede digitada ("19:00", "Saiu às 17:30"), não instante de máquina; `timestamptz` obriga conversão de fuso em toda leitura |
| ISR na raiz | Rota pública própria (`/agenda`) dinâmica | A rota nova entra em `ROTAS_PUBLICAS`, no `sitemap` e no SEO; e "a cada visita" contraria SIT-02 |
| ISR na raiz | Ilha cliente buscando `/api/agenda-publica` | Mantém a raiz 100% estática, mas o briefing do site pede "renderização no servidor, cache curto" (`BRIEFING-site.md:65`) e a agenda some sem JS |
| `chave_do_sistema` em `itens_catalogo` | Achar os itens pelo nome | O nome é editável em Cadastros; `aprovarOrcamento` já acha "Encomendas" por nome e o comentário admite que renomear quebra a aprovação (`lib/orcamentos/acoes.ts:1180-1184`) |

**Installation:** nenhuma.

## Package Legitimacy Audit

Nenhum pacote externo é instalado nesta fase.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| — | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## As treze perguntas de integração — respondidas pelo código

### Pergunta 1 — O cadastro de clientes (D-01)

**O que existe hoje** `[VERIFIED: db/schema.ts lido nesta sessão]`:
- `documentos.pessoaNome: text("pessoa_nome")` (`db/schema.ts:776`), com o check
  `` check("documentos_pessoa_nome_comprimento", sql`${tabela.pessoaNome} is null or length(trim(${tabela.pessoaNome})) between 1 and 160`) ``
  (`793-796`). Nenhuma tabela de pessoas, nenhuma coluna `cliente_id` em lugar nenhum.
- A extensão `unaccent` foi criada na base comum "pré-requisito de `nome_normalizado()`, que é da
  fase da Agenda — não criada aqui" (`db/migrations/0002_base-comum-datas-e-trigger.sql:4-6`). A
  função nunca foi criada (grep de `nome_normalizado` em `db/migrations/*.sql`: só o comentário e o
  índice `categorias_nome_normalizado_idx`, que é outra coisa — `lower(trim(nome))`). A receita está
  pronta em `amassa-plataforma/02-MODELO-DE-DADOS.md:47-51`, verbatim:
  ```sql
  create or replace function nome_normalizado(t text)
  returns text language sql immutable strict parallel safe as $$
    select lower(public.unaccent('public.unaccent'::regdictionary,
                                 regexp_replace(trim(t), '\s+', ' ', 'g')));
  $$;
  ```
  (o documento explica: `unaccent()` não é `immutable`; a forma de dois argumentos com o dicionário
  explícito é o que permite indexar).

**Forma recomendada** `[ASSUMED — proposta desta pesquisa]`: `clientes` (`id` uuid · `nome` text not
null, **1..160** — o mesmo teto de `documentos.pessoa_nome`, para o nome sempre caber na venda ·
`telefone` text null, 1..40, texto livre · `criado_por` → `usuarios` · `criado_em`, `atualizado_em` +
gatilho `tocar_atualizado_em`). Índice **não único** `clientes_nome_normalizado_idx` em
`nome_normalizado(nome)`; a busca da aba Pessoas usa `nome_normalizado(nome) like nome_normalizado($1) || '%'`
(e `'%' || … || '%'` para "contém") — "Joao" acha "João" no celular. `revoke delete on clientes from amassa_app`
(pessoa não se apaga: vendas, presenças e mensalidades apontam para ela). Sem `ativo` nesta fase
(Assumption A3).

**Vínculo em `documentos`**: `cliente_id uuid null references clientes(id)` (sem `on delete`) e
`check (cliente_id is null or pessoa_nome is not null)`. O `pessoa_nome` continua sendo gravado com o
nome do cliente **congelado no momento da venda** (o Caixa, o extrato, o PDF e o Mês leem
`pessoa_nome` — nada deles muda). Só quem grava `cliente_id` nesta fase: o escritor compartilhado
chamado pela Agenda e `lancarVenda` quando vier com `origem` (Pergunta 3). Índice
`documentos_cliente_idx` (a ficha da pessoa lista as vendas dela).

**Onde aparece em Cadastros**: a união fechada de sub-abas é
`export type SubCadastros = "catalogo" | "categorias" | "fixas" | "taxas" | "parametros";`
(`lib/cadastros/abas.ts:2`), normalizada por `subDaUrl` (`7-13`), e a página carrega uma lista por
sub-aba (`app/gestao/(app)/cadastros/page.tsx:36-47`, comentário). Acrescentar `"clientes"` à união e
ao `subDaUrl`, uma lista + "Novo cliente" + editar (nome, telefone) — a mesma folha do "+ Pessoa" da
Agenda. Recomendação: o código do cadastro mora em **`lib/clientes/`** (consultas, ações, esquemas,
texto) e não em `lib/agenda/`, porque a D-01 o torna transversal; a Agenda e Cadastros importam de lá.

**Duplicata por nome**: o AGD-14 antigo pedia "aviso de possível duplicata por nome normalizado"
(`.planning/REQUIREMENTS.md:189`). Vale a pena manter como **aviso, não bloqueio** — ver Open Question 8.

**Próxima migração**: o diário termina em
`{ "idx": 25, "version": "7", "when": 1790765091259, "tag": "0025_remover-encomendas", "breakpoints": true }`
(`db/migrations/meta/_journal.json`, lido) → a da fase é **`0026_agenda`** (uma só basta; não há
destruição, ao contrário da 06.1).

### Pergunta 2 — "Recebi agora" sem escritor paralelo

**Como a venda é gravada hoje** (`lib/financeiro/acoes.ts`, lido): `lancarVenda` (`67-312`) valida
fora da transação (Zod `esquemaVenda`, data, desconto, `conferirParcelas` em `111-123`, categorias e
itens carregados do banco em `129-189`) e, na transação (`192-297`): insere o documento com
`pessoaNome: dados.pessoa` (`193-201`), as linhas — **linha de item grava `descricao: item.nome`**
(`215`), nunca uma descrição do cliente —, a baixa de estoque das linhas de item por
`pedidosDaVenda` + `gravarMovimentacoes` (`243-272`), e as parcelas com
`pagoEm: parcela.pago ? parcela.vencimento : null` (`289`) e a taxa congelada
`taxaPontosBase: pagaNoCartao ? configuracao.taxaCartaoPontosBase : null` (`291`).

**Escritores de venda que já existem** (grep de `insert(documentos)`): `lib/financeiro/acoes.ts:194`
(venda) e `:465` (despesa), `lib/orcamentos/acoes.ts:1253` (aprovação), `lib/cadastros/acoes.ts:869`
(contas fixas) e o script da virada. A aprovação do orçamento é o precedente mais próximo — cria a
venda **dentro da própria transação** e guarda o vínculo no lado dela (`orcamentos.documento_id`) —
mas copiou o insert. **Não repetir**: extrair o miolo de `lancarVenda` (documento → linhas → estoque →
parcelas) para `lib/financeiro/gravacao.ts::gravarVenda(tx, pedido, contexto)`, **sem** `use server`
(o mesmo motivo de `lib/estoque/gravacao.ts:4-9`: toda exportação de arquivo `use server` vira
endpoint e o `verificar-acoes` cobra `exigirUsuario()` nela). `lancarVenda` passa a validar e chamar
`gravarVenda`; os testes dela continuam valendo.

Formato do pedido (proposta): `{ data, pessoaNome, clienteId | null, linhas: ({ tipo: "item", itemId,
descricao, categoriaId, quantidade, valorCentavos } | { tipo: "livre", descricao, categoriaId,
valorCentavos })[], parcelas: { vencimento, valorCentavos, forma, pago }[] }` + contexto
`{ registradoPor, taxaCartaoPontosBase }`. A `descricao` da linha de item passa a vir do chamador —
`lancarVenda` continua mandando `item.nome`; a Agenda manda "Mensalidade · Torno iniciante · outubro"
(D-04, até 160 caracteres, `documento_linhas_descricao_comprimento`, `db/schema.ts:914-917`).

**"Recebi agora"** = uma ação da Agenda (`receberAgora({ cobranca: { tipo, id }, forma })`):
`exigirUsuario()` → Zod → `hoje` → configuração lida **fora** da transação (como `lancarVenda`, `105`)
→ `db.transaction`: trava a cobrança (`for no key update`) → confere "ainda não lançada" (ou lançada
numa venda cancelada — Open Question 1) → monta as linhas **do banco** (nunca do cliente) →
`conferirParcelas` → `gravarVenda` com **uma** parcela `{ vencimento: hoje, valorCentavos: total,
forma, pago: true }` (o `pagoEm` vira `hoje`, `289`) → grava o vínculo. A forma vem de
`z.enum(["dinheiro","pix","cartao"])` — os mesmos valores de
`export const formaPagamento = pgEnum("forma_pagamento", ["dinheiro", "pix", "cartao"]);`
(`db/schema.ts:589`). No cartão, a taxa vigente é congelada pelo próprio `gravarVenda` (a regra de `291`).

**Estoque que a venda dispara**: nenhum, para os três itens da fase. `efeitoNoEstoque` só baixa item
com ficha técnica ou com `controlaEstoque`
(`lib/financeiro/efeito-estoque.ts:97-115`, comentário verbatim da `115`:
`// Nem ficha, nem controla estoque (ex.: "Hora de uso do espaço") → nenhuma entrada.`). Os itens
"Mensalidade", "Inscrição em oficina" e "Uso livre (hora)" nascem com `controla_estoque = false` e sem
ficha. **O material cobrado é outra história** — ver Pitfall 3: ele entra na venda como **linha
livre** (sem `item_id`), nunca como linha do item de estoque.

### Pergunta 3 — "Lançar na Venda" e o lote de mensalidades

**Como a tela de Venda funciona hoje** `[VERIFIED: components/amassa/financeiro/painel-venda.tsx, lib/financeiro/rascunho.ts, lib/financeiro/abas.ts lidos]`:
- **Não existe rascunho no servidor.** O carrinho é estado do cliente, salvo em `sessionStorage` sob
  `export const CHAVE_RASCUNHO_VENDA = "amassa-financeiro-rascunho-venda";` (`rascunho.ts:7`), lido
  uma vez ao montar (`painel-venda.tsx:135-188`) e regravado a cada mudança (`192-220`). O pagamento
  fica fora do rascunho de propósito (`94-96`).
- **Não existe preenchimento por URL**: `abaDaUrl` só lê `?aba=` (`abas.ts:12-19`); a página do
  Financeiro (498 linhas) não tem outro parâmetro de Venda.
- O à vista nasce **pago** (`const [pagoAVista, setPagoAVista] = useState(true);`, `121`) e o "Vence em"
  do à vista em aberto mora em `vencimentoAvistaAberto` (`126`, usado em `327-330`).
- Depois de lançar: `window.location.assign(rotaDeGestao(\`/financeiro?aba=venda&aviso=lancado&documento=${resposta.dados.id}\`))` (`590`).

**Três mecanismos possíveis** para a Agenda saber qual venda nasceu:

| | Como | A favor | Contra |
|---|---|---|---|
| A | A Agenda cria a venda em aberto ela mesma e abre o Caixa focado nela (`hrefDoCaixa({ parcelaFoco })`) | Atômico, simples | Não é "rascunho para ajustar": a venda já existe; desconto/sinal/2x exigiriam cancelar e relançar (não há "editar venda" no Financeiro) |
| **B** | **Token de origem na URL** — `/gestao/financeiro?aba=venda&origem=mensalidade:<uuid>`; a página resolve a cobrança no servidor e entrega o carrinho pronto ao `PainelVenda`; `lancarVenda` recebe `origem` e grava o vínculo **na mesma transação** | É literalmente o que o briefing (§5) e o protótipo (toast da linha 359: "abre a Venda com…") descrevem; reaproveita desconto, sinal, Nx e "+ outra forma" | Mexe no maior componente do Financeiro (767 linhas) e em `lancarVenda`; o Financeiro passa a importar um ajudante da Agenda (precedente: `cancelarDocumento` importa `lib/producao/gravacao.ts`, `acoes.ts:19`) |
| C | Uma folha "Lançar na Venda" dentro da Agenda, reaproveitando `BlocoPagamento` | Atômico, sem tocar no `PainelVenda` | Duplica a tela de venda (catálogo, desconto) ou entrega uma venda capada; não é "abrir a Venda" |

**Recomendação: B** (o "Claude's Discretion" da CONTEXT pergunta justamente *como* abrir o rascunho
da Venda). Desenho:
1. `lib/financeiro/navegacao.ts` ganha `hrefDaVendaComOrigem({ tipo, id })` (molde `hrefDoCaixa`,
   `URLSearchParams`); `origemDaUrl` (puro) normaliza `?origem=` para uma união fechada
   `"mensalidade" | "inscricao" | "uso_livre"` + uuid, senão `null`.
2. A página do Financeiro, com `origem`, chama `lib/agenda/consultas.ts::cobrancaParaVenda(origem, hoje)`
   → `{ clienteId, clienteNome, linhas, vencimento, jaLancada }` e passa `rascunhoInicial` + `origem`
   ao `PainelVenda`. Já lançada → aviso "Este item já virou a venda nº N" com link para o Caixa.
3. `PainelVenda` com `origem`: começa do rascunho da origem (não do `sessionStorage` — ver Pitfall
   10), **pessoa travada** no nome do cliente, à vista **em aberto** (`pagoAVista = false`) com
   `vencimentoAvistaAberto` = dia de vencimento da turma (mensalidade) ou data do evento/uso, e manda
   `origem` no `lancarVenda`. Valor e quantidade editáveis; a linha de origem não sai do carrinho.
4. `esquemaVendaEntrada` ganha `origem` opcional. `lancarVenda` com `origem`, **primeiro** dentro da
   transação: `vincularCobranca(tx, origem, documentoId)` (em `lib/agenda/gravacao.ts`, sem
   `use server`) trava a cobrança, confere que ainda está livre, e o servidor **sobrescreve**
   `pessoaNome`/`clienteId` pelo cliente da cobrança e a descrição da linha de origem pela descrição
   derivada no servidor. Linha de origem ausente do pedido → recusa.
5. Sucesso com origem → volta para `/gestao/agenda?aba=receber&aviso=lancado&documento=<id>`.

**Lote de mensalidades** (AGE-16) — não passa pela tela de Venda: ação `lancarMensalidadesEmLote({ mes })`
no molde de `gerarContasDoMes` (`lib/cadastros/acoes.ts:830-917`): uma transação; trava as
mensalidades em aberto do mês em ordem de id (`for no key update`); para cada uma, `gravarVenda` com
uma linha (item "Mensalidade", descrição D-04, valor da mensalidade) e uma parcela **em aberto**
`{ vencimento: mensalidade.vencimento, forma: "pix", pago: false }` (o `"pix"` é só o valor inicial,
como na aprovação do orçamento — `lib/orcamentos/acoes.ts:1248-1251`); grava o vínculo. "Uma Venda por
aluno" = uma venda **por mensalidade** (Assumption A6). Mensalidade já lançada entre abrir e tocar →
pulada e contada ("3 lançadas; 1 já estava lançada").

### Pergunta 4 — "Pago" derivado e a venda cancelada no Caixa

**Consulta** (uma por lista, com `left join`):
```sql
select m.id,
       d.id as documento_id, d.numero, d.cancelado_em,
       count(p.id) filter (where p.pago_em is null) as parcelas_em_aberto
  from mensalidades m
  left join documentos d on d.id = m.documento_id
  left join parcelas  p on p.documento_id = d.id
 group by m.id, d.id
```
→ puro `situacaoDaCobranca({ documentoId, canceladoEm, parcelasEmAberto })`:
`a_receber` (sem venda) · `venda_cancelada` (`cancelado_em` não nulo) · `pago` (nenhuma parcela em
aberto) · `lancado` (alguma em aberto — inclui o sinal pago e o saldo devendo). Os três rótulos do
protótipo são `const PAGO={nao:['a receber','venc'],lanc:['lançado na Venda',''],pago:['pago','ok']};`
(`prototipo.html:212`). Usa os índices `parcelas_documento_idx` (`db/schema.ts:878`).

**O que acontece quando o Caixa cancela a venda**: `cancelarDocumento` (`lib/financeiro/acoes.ts:613-683`)
trava o documento, chama o efeito da Produção (D-07 da 06.1, `644`), estorna o estoque e grava
`cancelado_em`. **O código não decide nada para a Agenda** — e a regra muda o que o sistema cobra.
É a **Open Question 1**. A recomendação não grava nada em `cancelarDocumento` (derivado na leitura),
o que mantém a ordem de travas `DOCUMENTO → ORDEM → ITENS` intacta.

### Pergunta 5 — Estoque (D-06): destino novo, vínculo e a migração do enum

**Hoje** `[VERIFIED: db/schema.ts:1499-1505, lib/estoque/destinos.ts:30-36 lidos]`:
```ts
export const destinoSaida = pgEnum("destino_saida", [
  "aula",
  "encomenda",
  "cafeteria",
  "atelie",
  "perda",
]);
```
```ts
export const DESTINOS_DE_SAIDA: readonly DescricaoDoDestino[] = [
  { valor: "aula", rotulo: "Consumo em aula", area: "espaco", vinculo: "turma" },
  { valor: "encomenda", rotulo: "Consumo em encomenda", area: "pecas", vinculo: "encomenda" },
  { valor: "cafeteria", rotulo: "Consumo na cafeteria", area: "cafeteria", vinculo: null },
  { valor: "atelie", rotulo: "Uso do ateliê", area: "pecas", vinculo: null },
  { valor: "perda", rotulo: "Perda ou quebra", area: "pecas", vinculo: "o-que-aconteceu" },
];
```
A saída manual é montada por `pedidoDeSaidaManual({ itemId, milesimos, destino, nota, encomendaId, materialDaOrdem })`
(`lib/estoque/pedidos.ts:107-127`), que põe `area: areaDoDestino(dados.destino)` (`122`) e descarta o
`encomendaId` fora do destino `encomenda` (`115`). O valor sai do custo médio sob a trava
(`gravarMovimentacoes`, `lib/estoque/gravacao.ts:198-269`), e o `insert` lista os campos do pedido
(`226-250`). Os `check`s que tocam o destino (`db/schema.ts:1573-1598`):
`movimentacoes_estoque_destino_da_saida_manual` — `(destino is not null) = (origem = 'manual' and tipo = 'saida')`;
`movimentacoes_estoque_destino_exige_area`;
`movimentacoes_estoque_ordem_so_no_destino_encomenda_ou_producao`.

**O que a migração precisa** (`0026`):
1. `ALTER TYPE "public"."destino_saida" ADD VALUE 'uso_livre';` (gerado pelo `drizzle-kit` ao
   acrescentar o valor no `pgEnum` — Assumption A1 sobre o texto exato).
2. Coluna `uso_livre_id uuid null references usos_livres(id)` (sem `on delete`: uso encerrado não se
   apaga; a FK é a trava que impede remover um uso que já tem baixa).
3. Dois `check`s novos, **comparando o enum como texto**:
   `movimentacoes_estoque_uso_livre_so_no_destino_uso_livre` — `uso_livre_id is null or destino::text = 'uso_livre'`;
   `movimentacoes_estoque_destino_uso_livre_com_vinculo` — `destino is null or destino::text <> 'uso_livre' or uso_livre_id is not null`.
4. `pedidoDeSaidaManual` ganha `usoLivreId` (posto só com `destino === "uso_livre"`, como o
   `encomendaId`) e `gravarMovimentacoes` grava `usoLivreId: pedido.usoLivreId ?? null`.

**Por que "como texto" — reproduzido nesta sessão num `postgres:17-alpine` (17.10), o mesmo da
`docker/compose.yml:3` (`image: postgres:17-alpine`):**
```
BEGIN
ALTER TYPE
psql:/enum.sql:7: ERROR:  unsafe use of new value "uso_livre" of enum type destino_saida
HINT:  New enum values must be committed before they can be used.
ROLLBACK
BEGIN
ALTER TYPE
ALTER TABLE            -- check (uso_id is null or destino::text = 'uso_livre')
COMMIT
INSERT 0 1             -- ('uso_livre', uuid) passa depois do commit
ERROR:  new row for relation "mov" violates check constraint "b_check"   -- ('aula', uuid) recusado
```
O migrador do Drizzle aplica **todas** as pendentes numa transação só
(`node_modules/drizzle-orm/pg-core/dialect.js:59-71`, `session.transaction(async (tx) => { for await (const migration of migrations) …`),
então "uma migração isolada só com o `alter type`" (a nota de `02-MODELO-DE-DADOS.md:143-146`) **não
resolve** se as duas forem publicadas juntas — só resolveria com duas sessões de `db:migrate`. O
`::text` resolve numa sessão. Corolário: **a migração não pode inserir nem atualizar dado com
`'uso_livre'`** (não há semente que precise).

**A folha do Estoque não oferece o destino novo.** `DESTINOS_DE_SAIDA` é usado por três consumidores
(grep): a grade da folha de baixa (`components/amassa/estoque/grade-destinos.tsx:18-43`), o esquema da
ação (`lib/estoque/esquemas.ts:93-96`, `ehDestinoDeSaida`) e o "Para onde foi"
(`components/amassa/estoque/secao-para-onde-foi.tsx:64`, `agregarParaOndeFoi(saidas, { destinos: DESTINOS_DE_SAIDA })`).
O agregador **descarta em silêncio** destino que não está na lista
(`lib/estoque/historico.ts:370-374`: `const barra = acumulado.get(chave); if (!barra) { continue; }`).
Logo: `DESTINOS_DE_SAIDA` ganha o sexto valor
`{ valor: "uso_livre", rotulo: "Uso livre do espaço", area: "espaco", vinculo: "uso-livre" }` (é o que faz o
"Para onde foi" mostrar o consumo do uso livre — o motivo da D-06), e nasce
`DESTINOS_DA_FOLHA_DO_ESTOQUE` (os cinco de hoje) para a grade e para o Zod da folha
(`ehDestinoDaFolha`): só a Agenda grava `uso_livre`, sempre com vínculo. O teste
`tests/unit/estoque-destinos.test.ts:13-21` ("tem os cinco destinos…") muda; acrescentar um teste de
paridade `DESTINOS_DE_SAIDA.map(d => d.valor)` = `destinoSaida.enumValues`.

**"Consumo em aula" ganhar vínculo real**: fora do escopo (ver Deferred desta pesquisa).

### Pergunta 6 — Os itens do Catálogo e as categorias

**Categorias que já servem** — semente `db/migrations/0016_categorias-iniciais.sql:13-25`, verbatim
das duas linhas: `('Uso do espaço', 'receita', 'espaco'),` e `('Aulas e oficinas', 'receita', 'espaco'),`.
Área Espaço nas duas (D-04 diz "categoria das aulas, área Espaço").

| Item (semente) | Categoria de venda | Preço | Flags |
|---|---|---|---|
| Mensalidade | Aulas e oficinas | `null` ("valor na hora", `db/schema.ts:631-634`) — o valor vem da turma | `aparece_na_venda = true`, `controla_estoque = false` |
| Inscrição em oficina | Aulas e oficinas | `null` — vem do evento | idem |
| Uso livre (hora) | Uso do espaço | `null` na semente; **o dono preenche em Cadastros** (AGE-17: "nenhum preço no código") | idem |

`aparece_na_venda = true` é obrigatório para o `lancarVenda` aceitar a linha
(`if (!item || !item.ativo || !item.aparecenaVenda || !item.categoriaVendaId)`, `acoes.ts:183`) e exige
categoria (`itens_catalogo_aparece_exige_categoria_venda`, `db/schema.ts:678-681`).

**Semente na migração, no molde da `0023`** (`0023_estoque.sql:135-146`: `insert … select … where not exists`
pelo nome normalizado): (a) garantir as duas categorias (se o dono renomeou ou apagou, recriar — senão a
subconsulta devolve nulo e o `check` acima derruba a migração inteira); (b) inserir os três itens com
`categoria_venda_id = (select id from categorias where lower(trim(nome)) = lower(trim('Aulas e oficinas')))`.

**Como a Agenda acha os itens depois**: nunca pelo nome (editável). Hoje
`categorias.chave_do_sistema` só aceita um valor —
`` check("categorias_chave_do_sistema_valida", sql`${tabela.chaveDoSistema} is null or ${tabela.chaveDoSistema} = 'diferenca'`) ``
(`db/schema.ts:618-621`) — e `itens_catalogo` não tem chave nenhuma. Recomendação (Open Question 9):
`itens_catalogo.chave_do_sistema text null`, `unique`, `check (… in ('mensalidade','inscricao_oficina','uso_livre_hora'))`,
com um gatilho no molde de `travar_grupo_e_area_da_categoria` (`0015_gatilhos-financeiro.sql:155-193`):
item com chave **não se desativa nem deixa de aparecer na venda** (a frase P0001 chega à tela pelo
tratamento que `lib/cadastros/acoes.ts` já faz); nome, preço e categoria continuam editáveis. As
categorias **não** ganham chave: o item aponta para a categoria pelo id, e é a categoria do item que vai
para a linha da venda (como em `lancarVenda`, `216`).

### Pergunta 7 — Modelo de tempo

- **Datas civis**: `data date` em `eventos` e `usos_livres`; `mes date` (dia 1, `check extract(day …) = 1`,
  molde de `documentos_mes_referencia_primeiro_dia`, `db/schema.ts:801-804`); `vencimento date`;
  `entrou_em/saiu_em date` em `turma_alunos`.
- **Horas de parede**: `time` (sem fuso) para `turmas.inicio/fim`, `eventos.inicio/fim`,
  `usos_livres.chegada_prevista/chegada/saida`. É o que o gestor digita ("Começa 14:00", "Saiu às
  17:30" — `prototipo.html:304, 317`), e a conta de horas cheias é sobre minutos do dia. Nenhuma coluna
  `time` existe hoje no esquema (Pitfall 9: o `pg` devolve `"19:00:00"`). Recomendação contra
  `timestamptz` na seção Alternatives; a regra do CLAUDE.md ("momentos no tempo são `timestamptz`") fica
  para os carimbos (`cancelado_em`, `criado_em`), que continuam `timestamptz`.
- **Nada atravessa a meia-noite**: `check (fim > inicio)` e `check (saida > chegada)` (Assumption A8).
- **Horas cheias**: `Math.ceil((saidaMin − chegadaMin) / 60)`, saída ≤ chegada → recusa ("A saída
  precisa ser depois da chegada.", `prototipo.html:354`); exatos 60 min = 1; 61 = 2. O protótipo faz
  `const horas=e=>Math.ceil((min(e.fim)-min(e.ini))/60);` (`271`).
- **"Hoje" e "agora" na borda**: `hojeEmBrasilia(new Date())` (`lib/financeiro/formato.ts:15-22`) e uma
  irmã nova `agoraEmBrasilia(agora: Date) → { data, minutos }` no mesmo molde (`Intl.DateTimeFormat`
  com `timeZone: "America/Sao_Paulo"`, `hour12: false`), recebendo o instante por argumento. Os módulos
  puros recebem `hoje`/`agora`.
- **No e2e**: "hoje" sempre de `hojeNoAtelie()` (`tests/e2e/apoio/semear-financeiro.ts:163-170`) e
  `somarDiasAoHoje(n)` (`174-178`) — nunca `toISOString()`. "Agora" para "Agora no espaço" precisa de um
  `agoraNoAtelie()` irmão (Pitfall 12: perto da meia-noite um evento "agora ± 1h" não cabe no dia).

### Pergunta 8 — A mensalidade nascendo "ao abrir" (D-02) neste Next

**O que o Next 16.3.5 diz** `[CITED: node_modules/next/dist/docs/01-app/02-guides/data-security.md:567-601]`:
"Mutations (e.g. logging out users, updating databases, invalidating caches) should never be a
side-effect, either in Server or Client Components. Next.js explicitly prevents setting cookies or
triggering cache revalidation within render methods". E `revalidatePath` "can be called in Server
Functions and Route Handlers" (`03-api-reference/04-functions/revalidatePath.md`) — não no render.
Nada no projeto usa cache (grep de `revalidate`/`unstable_cache`/`"use cache"` em `app lib components`:
zero), e as páginas de `/gestao` são dinâmicas (chamam `exigirUsuario()`, que lê a sessão).

**Três lugares possíveis:**
| | Onde | A favor | Contra |
|---|---|---|---|
| **A** | **No carregador de dados**: `garantirMensalidadesDoMes(hoje)` (em `lib/agenda/gravacao.ts`) chamado pelo Server Component de "A receber", da ficha da pessoa e do bloco do Início, **antes** de ler | Um `insert … select … on conflict do nothing`; a leitura logo depois já enxerga; sem segundo render; a lista nunca aparece sem a mensalidade | Contraria a orientação geral do Next (efeito no render); um GET autenticado de outro site (cookie `Lax` em navegação de topo) dispararia o insert — que é exatamente o que abrir a tela faria |
| B | Server Action chamada num `useEffect` ao montar, e `router.refresh()` se criou alguma | Segue a orientação (POST) | Dois renders no 1º acesso do mês; "A receber" pisca sem as mensalidades; mais um caminho para o e2e esperar |
| C | Mensalidade "virtual": derivada na leitura e só materializada quando alguém age | Zero escrita na leitura | Contraria o texto da D-02 ("o servidor cria … com a garantia no banco"); a D-03 ("a do mês corrente, já nascida, não muda") precisa de uma linha nascida |

**Recomendação: A**, com a justificativa escrita no código: a escrita é **idempotente por
construção** e materializa um fato determinístico do mês — rodá-la duas vezes, por dois celulares, por
um prefetch ou por um GET forjado dá o mesmo banco. Não chamar `revalidatePath` nela (proibido no
render e desnecessário: a mesma requisição lê depois de escrever). A prefetch de `<Link>` para rota
dinâmica não executa o corpo da página (Assumption A5).

**A instrução, uma só, atômica** (sem transação explícita): ver Code Examples. O que ela faz: para
cada vínculo **ativo no dia 1 do mês** (`entrou_em <= dia 1` e `saiu_em is null or saiu_em >= dia 1`)
de turma **ativa**, insere `(turma_id, cliente_id, mes, valor_centavos = turma.mensalidade_centavos,
vencimento = dia de vencimento no mês)` com `on conflict (turma_id, cliente_id, mes) do nothing`. Quem
entrou **durante** o mês não é tocado por ela: a ação "entrar na turma" já criou a proporcional na
mesma transação da entrada (AGE-07), e a chave única garante que o "ao abrir" nunca crie a segunda.

**Corolário para a D-03** (Pitfall 6): a ação "editar a turma" chama `garantirMensalidadesDoMes` **para
aquela turma, dentro da própria transação, antes** de gravar o valor novo — senão, se ninguém abriu a
Agenda no mês, a mensalidade "já nascida" nasceria depois com o preço novo.

### Pergunta 9 — Datas da turma, "mais N semanas", edição, desativação, dia fechado

- **Gerar**: puro `datasDaTurma({ diaDaSemana, aPartirDe, semanas })` → as N primeiras datas com aquele
  dia da semana a partir de `aPartirDe` (inclusive). O protótipo gera a partir de hoje
  (`for(let d=HOJE,n=0;n<NS;d=mais(d,1))if(dt(d).getDay()===t.dow){…n++}`, `prototipo.html:344`), padrão 8
  (`value="8" min="1" max="52"`, `316`). Dia da semana 0..6 com 0 = domingo (o `getDay()` do protótipo,
  `DOWL` em `206`).
- **Gravar**: `unique (turma_id, data)` em `eventos` (índice parcial `where turma_id is not null`) +
  `on conflict do nothing` → "Lançar" e "Marcar mais N semanas" nunca duplicam, nem com dois toques.
- **"Marcar mais N semanas"**: N datas a partir do dia seguinte à **última data já marcada** da turma (ou de
  hoje, se a última já passou). **Inscreve os alunos ativos nas datas novas** na mesma transação
  (Pitfall 5).
- **Editar horário/vagas/público**: `update eventos … where turma_id = $1 and data > hoje and cancelado_em is null`
  (as datas de hoje e do passado ficam como foram — Assumption A9). Editar o nome: só na turma (as datas
  leem o nome da turma ao vivo).
- **Editar a mensalidade**: ver Pergunta 8, corolário.
- **Desativar** (D-03): `turmas.ativa = false`, `desativada_em`; as datas **futuras** (`data > hoje`) saem com
  as inscrições delas — inclusive reposições marcadas, que **voltam a ser crédito** porque o crédito é
  derivado das linhas (Pergunta/Pattern 3). A folha avisa quantas datas e quantas reposições saem antes de
  confirmar (regra de exclusão do projeto). O passado e a turma ficam.
- **Entrar/sair**: entrar inscreve nas datas `>= hoje` (protótipo `e.d>=HOJE`, `331`); sair tira das datas
  `> hoje` só as inscrições de tipo `aluno` (o protótipo mantém reposição: `e.insc.filter(i=>i.p!==p||i.rep)`,
  `331`). As duas comparações são as do protótipo, de propósito.
- **Dia fechado × datas de turma**: o protótipo diz na folha do bloqueio "avisa se alguém lançar algo por
  cima" (`298`), mas não implementa o aviso, e a geração de datas **não pula** bloqueio (`344`); o §2.8 diz
  "nenhum aviso de sobreposição" — que fala de lotação/sobreposição entre eventos, não de dia fechado. Não
  são o mesmo assunto, mas o que fazer com uma data de turma que cai num dia fechado muda o que se grava →
  **Open Question 5**.

### Pergunta 10 — O calendário público (AGE-18)

**Hoje** `[VERIFIED: app/page.tsx, components/site/aulas-e-oficinas.tsx, tests/unit/site-isolamento.test.ts, scripts/testar-site-sem-banco.mjs, docker/Dockerfile lidos]`:
- `export const dynamic = "force-static";` (`app/page.tsx:19`) — o HTML sai inteiro do `next build`.
- `AulasEOficinas` mostra três cartões de texto, dois botões de WhatsApp e
  `agAviso: "O calendário com as datas e vagas entra aqui em breve."` (`conteudo/site.ts`); o comentário
  (`aulas-e-oficinas.tsx:20-25`) já diz o destino: "um componente novo de leitura ao vivo entra no lugar —
  Server Component lendo as consultas públicas daquele módulo com cache curto e revalidação por tempo".
- A cerca: `ESPECIFICADORES_PROIBIDOS = ["@/db", "drizzle-orm", "pg", "next-auth", "next/headers", "@/lib/auth/"]`
  no grafo de `app/page.tsx` (`site-isolamento.test.ts:17-24`), e um teste próprio
  "nenhum arquivo de components/site/ importa lib/agenda" (`225-236`), além de "nenhum `use server`",
  "nenhum `dangerouslySetInnerHTML`" e "nenhuma string `/gestao`".
- A prova de fora: `testar-site-sem-banco.mjs` constrói **com** o banco efêmero (`65-66`), sobe, derruba o
  Postgres (`102`) e pede `/` de novo (`105`).
- O build de produção **não tem banco**: `DATABASE_URL e AUTH_SECRET são segredos de verdade: NUNCA
  entram aqui como ARG` (`docker/Dockerfile`, estágio `construtor`), e `db/index.ts` cria o `Pool` de forma
  preguiçosa (sem conectar ao importar) — a consulta no build falha com conexão recusada.
- O número do WhatsApp: `zap: "5562900000000",` (`conteudo/site.ts:125`), lido por `hrefDoWhatsapp`
  (`lib/site/whatsapp.ts:9-18`). Manter (Claude's Discretion).

**Recomendação — seção viva na própria raiz, por ISR** `[CITED: node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md:104 e incremental-static-regeneration.md:467]`:
- Manter `force-static` e acrescentar `export const revalidate = 300` (5 min). O Next 16 permite
  `revalidate`/`revalidatePath` em página `force-static` ("It is possible to revalidate, revalidatePath,
  or revalidateTag, in pages or layouts rendered with force-static").
- A seção chama **uma** consulta pública (`lib/agenda/publico/consultas.ts`) dentro de `try/catch`; em erro
  (build sem banco, Postgres fora) cai no `AulasEOficinas` de hoje — o estado aprovado "sem Agenda", não
  um calendário vazio nem quebrado. O próprio Next mantém a última página boa quando a regeneração **lança**
  ("If an error is thrown while attempting to revalidate data, the last successfully generated data will
  continue to be served"); com o `catch` a queda vira o estado sem Agenda por até 5 min — Assumption A10.
- Toda ação da Agenda que muda o que é público (lançar/cancelar/editar evento ou turma pública,
  colocar/tirar alguém — muda as vagas —, fechar dia) chama `revalidatePath("/")`. A próxima visita
  regenera.
- A consulta pública **só seleciona** título, data, início, fim, vagas, preço, tipo, turma (dia da semana,
  mensalidade) e a **contagem** de inscritos — nunca `clientes`, `telefone`, `nome`, presença,
  `pessoa_nome`, uso livre, nem o **motivo** do dia fechado (o protótipo mostra só "Fechado neste dia.",
  `prototipo.html:282`). Filtros: `publico = true`, `cancelado_em is null`, `data >= hoje`, e turma `ativa`.
  Janela: de hoje até o fim do 6º mês (o calendário navega dentro dela; fora, "Ainda sem datas marcadas" —
  Assumption A11).
- A navegação de mês e o "toque no dia" são estado de cliente (Client Component recebendo os dados prontos):
  nenhuma requisição por mês, nada de `searchParams` (que tornaria a raiz dinâmica).
- A cerca é **reescrita, não afrouxada**: o grafo de `app/page.tsx` pode alcançar `@/db` **só** através de
  `lib/agenda/publico/consultas.ts` (lista de exceção nomeada, como a de `verificar-acoes`), e continua
  proibindo `next-auth`, `next/headers`, `@/lib/auth/`, `use server`, `/gestao`; o teste "nenhum arquivo de
  components/site/ importa lib/agenda" vira "só importa `lib/agenda/publico`". Um teste de forma afirma
  que o tipo devolvido pela consulta pública não tem campo de pessoa.
- **Rota própria**: não. Ela entraria em `ROTAS_PUBLICAS`, no `sitemap` (SIT-08) e na árvore de rotas
  (`tests/unit/arvore-de-rotas.test.ts`) sem ganho — o calendário cabe na seção `#agenda`, que os botões
  fixos do site já alcançam (SIT-05).
- Conflito com a D-18 da 04.6 ("Sem preço no site") → **Open Question 3**; o que mostrar quando não há
  nenhum evento público, e como contar vagas de turma → **Open Question 4**.

### Pergunta 11 — O bloco "Agenda de hoje" do Início (D-05)

- Hoje: `BlocoAgendaDeHoje` não consulta nada e mostra `ocupacaoDoEspaco(0)` + a frase vazia
  (`components/amassa/inicio/bloco-agenda-de-hoje.tsx:19-37`); o comentário (`14-18`) já prevê "ganha a
  consulta real (e um `try`/`catch` próprio, D-09)". As frases são
  `agenda: { vazio: "Nada marcado para hoje. O espaço está livre.", erro: "Não deu para carregar a agenda de hoje." }`
  (`lib/inicio/textos.ts:15-18`).
- Molde exato: `BlocoProducao` (`components/amassa/inicio/bloco-producao.tsx:40-131`) — Server Component
  `async`, `try { resultado = puro(await consulta()) } catch { console.error; resultado = null }`, e
  `EstadoErro` + `TentarDeNovo` dentro do bloco; o esqueleto já está no `Suspense` da página
  (`app/gestao/(app)/page.tsx:59-61`). O bloco recebe `hoje` e `agora` da página (que já calcula `hoje`, `29`).
- GES-09: o bloco lê **só** `lib/agenda/consultas.ts::agendaDeHoje(hoje, agora)` (que também chama
  `garantirMensalidadesDoMes` — D-02 lista o Início) e o puro `lib/agenda/espaco.ts`. Linhas como o
  `prototipo-gestao.html:209,219`: hora início/fim, título, e "n de vagas" (aula/oficina) ou "N pessoas ·
  reservado/no espaço" (uso livre). "Agora no espaço" fica **sempre** visível (D-07 da 04.6), contagem
  sem fração (`lib/agenda/espaco.ts:6-17`).
- "Agora no espaço" (D-05), no puro `pessoasAgoraNoEspaco({ usosLivres, aulas, agora })`: Σ `pessoas` dos
  usos livres em `no_espaco` **de hoje** (Open Question 10) + nº de inscrições das aulas/oficinas de hoje,
  não canceladas, com `inicio <= agora < fim`, excluídas as marcadas `faltou`.
- O e2e `@vazio-global` do Início (`tests/e2e/inicio.spec.ts:69-91`) continua valendo: banco sem evento →
  "0 pessoas" e a frase vazia.

### Pergunta 12 — Navegação e telas

- `/gestao/agenda` hoje é só o estado vazio "Chega na Fase 5" (`app/gestao/(app)/agenda/page.tsx:6-20`). A
  Agenda já está nas duas barras: `{ href: "/gestao/agenda", rotulo: "Agenda", icone: "agenda" }`
  (`lib/navegacao/itens.ts:51` e `60`). Nada muda na casca.
- As cinco abas do protótipo (Agenda · Pessoas · A receber · No site · Números) são **pílulas no topo** da
  tela, não uma barra inferior: `desenhar()` monta `<div class="pilulas">` (`prototipo.html:290-291`); o CSS
  `nav.abas` fixo (`30-32`) não é usado na marcação. Não conflita com a barra inferior da casca.
- Abas por URL, molde `lib/estoque/abas.ts:7-21` (`ValorDaUrl`, `textoUnico`, padrão no desconhecido):
  `lib/agenda/abas.ts` com `abaDaAgendaDaUrl` (`agenda | pessoas | receber | site | numeros`, padrão
  `agenda`), `vistaDaUrl` (`semana | mes`), `semanaDaUrl` (normaliza para a segunda-feira) e `mesDaUrl`
  (molde `lib/financeiro/abas.ts:29-34`). O "No site" da gestão desenha o **mesmo** componente do site
  público com a consulta ao vivo (sem cache), para o gestor ver o que vai ao ar.
- Folhas = `Dialog` (molde `folha-nova-ordem.tsx`): Lançar (4 tipos), Evento (presença/colocar/cancelar),
  Uso livre (chegou/material/encerrar/receber), Turma (D-03), Pessoa (ficha), Pessoa nova, Recebi agora
  (forma). Estados obrigatórios: `loading.tsx`/`error.tsx` na rota (molde `app/gestao/(app)/estoque/`) e o
  vazio de cada aba ("nada marcado" por dia, "Ninguém devendo.", "Ninguém com esse nome." — verbatim do
  protótipo `260, 264, 274`).
- O e2e `casca.spec.ts` tem a Agenda como último placeholder (`TELAS_DE_MODULO`, `91-100`: "Nenhuma turma na
  grade ainda." / "Chega na Fase 5.") — sai; `acessibilidade.spec.ts:69` e `casca.spec.ts:104` continuam
  cobrindo `/gestao/agenda` (axe e 320px).

### Pergunta 13 — Testes

- **`test:migracoes`**: `TABELAS_ESPERADAS` (`scripts/testar-migracoes.mjs:26-86`) termina hoje em
  `"ordens_producao", "ordem_etapas", "ordem_pecas",` e ganha `clientes, turmas, turma_alunos, eventos,
  inscricoes, mensalidades, usos_livres, usos_livres_material` (8). `conferirBanco()` (`4835-4871`) ganha
  `conferirAgenda(cliente)`: `revoke delete` das tabelas que não se apagam (42501 para `amassa_app`),
  `unique` de mensalidade/data de turma (23505), os `check`s do enum em texto (23514 para `uso_livre`
  sem vínculo e vínculo sem `uso_livre`), `documentos.cliente_id` exigindo `pessoa_nome`, a semente dos
  três itens e das categorias, `nome_normalizado('  JOÃO  da  Silva ') = 'joao da silva'`, e a idempotência
  do `insert … on conflict do nothing` da D-02 rodado duas vezes. Os testes rodam como o dono das
  tabelas para semear e como `amassa_app` para provar o `revoke` (molde de `conferirProducao`, `3197`).
- **`verificar-acoes`** (`scripts/verificar-acoes.mjs:1-35`, lido): toda função de arquivo `use server`
  cujo grafo de imports alcança `@/db` precisa de `exigirUsuario()` como **primeira** instrução,
  decidido pela árvore sintática. Por isso `lib/agenda/gravacao.ts`, `lib/financeiro/gravacao.ts` e
  `lib/agenda/publico/consultas.ts` não têm a diretiva.
- **A cadeia do Playwright** (`playwright.config.ts:65-94`): `vazio-celular → vazio-desktop →
  vazio-historico → { desktop, celular } → parametros-desktop → parametros-celular`; `desktop`/`celular`
  com `grepInvert: [/@vazio-(global|historico)/, /@parametro-global/]`. Regras para `agenda-*.spec.ts`:
  só `@vazio-global` afirma ausência global ("nada marcado" numa semana, "Ninguém devendo.", "A receber"
  com R$ 0,00) e só lê; os números da aba Números e o "Agora no espaço" exato são contagens globais →
  `test.describe.serial("… @vazio-historico")` que semeia e confere; o resto afirma **o próprio item**
  achado por nome único (`"[e2e] Torno " + randomUUID().slice(0, 8)`).
- **O site no e2e**: o CI roda a imagem Docker construída **sem banco** (`.github/workflows/entrega.yml:129`),
  então a raiz começa no estado "sem Agenda" até a primeira revalidação. O teste do calendário público cria
  o evento **pela tela** (a ação chama `revalidatePath("/")`) e só então abre `/`; semear direto no banco não
  aparece no site por até 5 min (Pitfall 11). `site-secoes.spec.ts:74-76` (três cartões e a frase "em
  breve") continua verdadeiro **com o banco sem evento público** — se a Open Question 4 for pela
  recomendação; senão, muda.
- **e2e de data**: `hojeNoAtelie()`/`somarDiasAoHoje()` (`semear-financeiro.ts:163-178`); semeador novo
  `tests/e2e/apoio/semear-agenda.ts` (molde `semear-producao.ts`).

## Modelo de dados recomendado (Claude's Discretion)

Nomes em português (CLAUDE.md). Todos os nomes de tabela, coluna e valor de enum abaixo são **proposta
desta pesquisa** `[ASSUMED]`, exceto os reaproveitados de código lido (anotados). Dinheiro `integer` em
centavos com teto 10^9 (como `parcelas`); quantidade de material `bigint` em milésimos (como o livro).

**Enums novos:** `tipo_evento`: `turma`, `avulsa`, `fechado` (as chaves do protótipo `TIPO`, `prototipo.html:211`,
menos `livre`, que é tabela própria) · `tipo_inscricao`: `aluno`, `reposicao`, `experimental`, `oficina` ·
`presenca`: `veio`, `faltou` · `estado_uso_livre`: `reservado`, `no_espaco`, `encerrado`.
**Enum existente:** `destino_saida` + `uso_livre` (D-06).

| Tabela | Colunas | Restrições |
|---|---|---|
| `clientes` | `id`, `nome` (1..160), `telefone` null (1..40), `criado_por`, `criado_em`, `atualizado_em` | índice `nome_normalizado(nome)`; `revoke delete` |
| `turmas` | `id`, `nome` (1..120), `dia_semana` smallint 0..6, `inicio` time, `fim` time, `vagas` int 1..999, `mensalidade_centavos` int, `dia_vencimento` int, `publica` bool, `ativa` bool default true, `desativada_em` timestamptz null, `criado_por`, datas | `fim > inicio`; `dia_vencimento between 1 and 28` (§2.6); `ativa = (desativada_em is null)`; `revoke delete` |
| `turma_alunos` | `id`, `turma_id`, `cliente_id`, `entrou_em` date, `saiu_em` date null, datas | `saiu_em is null or saiu_em >= entrou_em`; **único parcial** `(turma_id, cliente_id) where saiu_em is null`; `revoke delete` (sair = `saiu_em`) |
| `eventos` | `id`, `tipo`, `data`, `inicio` time null, `fim` time null, `titulo` text null, `turma_id` null, `vagas` null, `preco_centavos` null, `publico` bool, `cancelado_em` timestamptz null, `cancelado_por` null, `criado_por`, datas | `(tipo = 'turma') = (turma_id is not null)`; `tipo = 'fechado'` ⇒ `inicio/fim/vagas/preco` nulos e `publico = false` e `titulo` (motivo) 1..120; `tipo <> 'fechado'` ⇒ `inicio`, `fim`, `vagas` não nulos e `fim > inicio`; `tipo = 'avulsa'` ⇒ `titulo` e `preco_centavos` não nulos; cancelado em/por juntos; `tipo = 'fechado'` ⇒ nunca cancelado (remove-se); **único parcial** `(turma_id, data) where turma_id is not null`; índice `(data)` |
| `inscricoes` | `id`, `evento_id`, `cliente_id`, `tipo`, `presenca` null, `direito_a_repor` bool default false, `cobrar` bool default false, `valor_centavos` null, `documento_id` null → documentos, datas | `unique(evento_id, cliente_id)`; `direito_a_repor` ⇒ `presenca = 'faltou'` e `tipo in ('aluno','experimental')` (ver nota); `tipo = 'reposicao'` ⇒ `not cobrar and valor is null`; `cobrar = (valor_centavos is not null)`; `tipo = 'oficina'` ⇒ `cobrar`; `documento_id` ⇒ `cobrar`; índices `(cliente_id)`, `(documento_id)` |
| `mensalidades` | `id`, `turma_id`, `cliente_id`, `mes` date, `valor_centavos`, `aulas_restantes` int null, `aulas_no_mes` int null, `vencimento` date, `documento_id` null, `criado_em` | `unique(turma_id, cliente_id, mes)` (**a chave da D-02**); `extract(day from mes) = 1`; os dois `aulas_*` juntos (nulos = mês cheio) e `0 < restantes < no_mes`; `revoke delete` |
| `usos_livres` | `id`, `cliente_id`, `data`, `chegada_prevista` time, `horas_previstas` int 1..12, `pessoas` int 1..50, `estado`, `chegada` time null, `saida` time null, `horas_cheias` int null, `preco_hora_centavos` int null, `documento_id` null, `criado_por`, datas | `estado = 'reservado'` ⇒ `chegada` nula; `estado <> 'reservado'` ⇒ `chegada` não nula; `(estado = 'encerrado') = (saida is not null)` e o mesmo para `horas_cheias` e `preco_hora_centavos`; `saida > chegada`; `documento_id` ⇒ `encerrado`; índice `(data)` |
| `usos_livres_material` | `id`, `uso_livre_id`, `item_id` → itens_catalogo, `quantidade_milesimos` bigint > 0, `cobrar` bool, `preco_unitario_centavos` null, `valor_centavos` null, `movimentacao_id` null → movimentacoes_estoque, datas | `cobrar = (preco_unitario_centavos is not null)` (congelado no encerramento — Open Question 6); `valor` junto do preço; `unique(movimentacao_id)` |
| `documentos` (existente) | + `cliente_id` null → clientes | `cliente_id is null or pessoa_nome is not null`; índice |
| `movimentacoes_estoque` (existente) | + `uso_livre_id` null → usos_livres | os dois `check`s em texto (Pergunta 5); índice |
| `itens_catalogo` (existente) | + `chave_do_sistema` text null | `unique`; `check (… in ('mensalidade','inscricao_oficina','uso_livre_hora'))`; gatilho de trava (Open Question 9) |

Nota sobre `direito_a_repor`: a regra "só em turma fixa" é de outra tabela (o tipo do evento); o banco
garante `direito_a_repor ⇒ presenca = 'faltou'` e o tipo `aluno` ou `experimental`; "só data de turma
não cancelada" fica no módulo puro + teste.

**O que se apaga (e o que não):** `delete` concedido a `amassa_app` só em `eventos` (o fechado — AGE-05),
`usos_livres` (a reserva não iniciada — AGE-05), `inscricoes` ("tirar da lista", sair da turma, datas
futuras de turma desativada) e `usos_livres_material` ("tirar" antes de encerrar, `prototipo.html:300`). A
ação decide sob trava; as FKs sem `on delete` de `movimentacoes_estoque.uso_livre_id` e de
`*.documento_id` impedem fisicamente apagar o que já gerou baixa ou venda pelo lado referenciado. Gatilho
`tocar_atualizado_em` nas tabelas novas com `atualizado_em` (molde `0024`, bloco (5)).

**Rota de saúde:** `app/api/health/agenda/route.ts` no molde exato de `app/api/health/producao/route.ts`
(lido): `select id from clientes limit 1`, `select cliente_id from documentos limit 1`,
`select uso_livre_id from movimentacoes_estoque limit 1`; 503 com motivo fixo "O banco não tem a
estrutura da Agenda — a migração 0026 foi aplicada?"; corpo só `{ status }`. Entra na lista pública de
`tests/unit/arvore-de-rotas.test.ts:23-34`.

## O módulo puro `lib/agenda/`

Regras de pureza (as de `lib/estoque/pedidos.ts:1-10` e `lib/estoque/destinos.ts:1-4`): nada de React,
Next, drizzle-orm, pg ou `@/db`; uniões redeclaradas à mão espelhando os enums (teste de paridade com
`db/schema.ts`, molde `tests/unit/producao-etapas.test.ts:25-27`); datas `YYYY-MM-DD` e minutos inteiros;
"hoje" e "agora" sempre por argumento; imports só de outros módulos puros (`lib/producao/calendario.ts`,
`lib/financeiro/calendario.ts`). Teste de pureza por leitura do arquivo (molde
`tests/unit/producao-horas.test.ts:55-60`).

| Arquivo | Funções | O que os testes provam |
|---|---|---|
| `semana.ts` (o nome reservado no CLAUDE.md) | `segundaDaSemana(data)`, `diasDaSemana(segunda)`, `gradeDoMes(mes)` (42 células, segunda primeiro, corta a 6ª linha fora do mês como o protótipo `258`), `agruparPorDia(itens)`, `ordenarNoDia` | virada de mês/ano; 29/02; domingo pertence à semana anterior; ordem por `inicio`, fechado ("dia todo") primeiro |
| `horario.ts` | `minutosDe("19:00" \| "19:00:00")`, `horaDe(minutos)`, `cobreOAgora(inicio, fim, agoraMin)` | formato do `pg` com segundos; fim exclusivo; 00:00 |
| `turma.ts` | `datasDaTurma({ diaDaSemana, aPartirDe, semanas })`, `aPartirDeParaEstender(ultimaData, hoje)`, `rotuloDaTurma` ("toda terça, 19h às 21h") | `aPartirDe` no próprio dia da semana entra; 52 semanas; domingo = 0; estender sem data marcada começa hoje |
| `mensalidade.ts` | `valorProporcional({ valorCentavos, datasDoMes, entrouEm })` → `{ valorCentavos, restantes, noMes } \| cheia`, `vencimentoNoMes(dia, mes)`, `valorDaAula(mensalidade, aulasNoMes)` (D-07) | `restantes = datas não canceladas >= entrouEm`; `restantes = noMes` ⇒ cheia; `noMes = 0` ⇒ cheia (Assumption A7); arredondamento ao centavo meio-para-cima; dia 28 em fevereiro; D-07 com 1 aula |
| `uso-livre.ts` | `horasCheias(chegada, saida)`, `valorDoMaterial(milesimos, precoUnitario)`, `valorDoUsoLivre({ horas, pessoas, precoHora, materiais })`, `proximoEstado(estado, acao)` | 60 → 1, 61 → 2, 0 e negativo recusam; `horas × pessoas × preço` **uma vez** (AGE-13); material incluso não soma; 1,2 kg × R$ 18,00 = R$ 21,60; transições só Reservado → No espaço → Encerrado |
| `reposicao.ts` | `creditosDeReposicao({ faltasComDireito, reposicoesUsadas })` → `{ saldo, comDireito, usadas }` | os dois lados devolvidos; reposição em data cancelada não conta; falta em data cancelada não conta; saldo nunca abaixo de 0 na tela, mas a ação recusa o que o deixaria negativo |
| `presenca.ts` | `planejarPresenca(inscricao, desejada)`, `precisaMarcarPresenca(evento, hoje)` | tocar de novo = `null`; sair de `faltou` limpa o direito; data passada com alguém sem marcação; cancelada nunca pede |
| `vagas.ts` | `vagasRestantes(vagas, inscritos)`, `rotuloDeVagas(restantes)`, `listaCheia` | os quatro textos do protótipo (`277`: esgotado · última vaga · últimas 2 vagas · n vagas); negativo = esgotado; aviso não bloqueia |
| `receber.ts` | `situacaoDaCobranca(...)`, `itensAReceber(...)` (ordem por vencimento/data, `prototipo.html:266-270`), `descricaoDaLinha(cobranca)` ("Mensalidade · Torno iniciante · outubro") | 160 caracteres no máximo; evento cancelado sai de "A receber" (protótipo `268`); reposição e gratuita nunca entram |
| `espaco.ts` (existe) | `ocupacaoDoEspaco` (mantida) + `pessoasAgoraNoEspaco` | D-05: faltou não conta; cancelada não conta; uso de ontem em aberto não conta (OQ 10); fim exclusivo |
| `numeros.ts` | `numerosDoMes({ ... }, hoje)` | os cinco indicadores do protótipo `285-288`: horas-pessoa e visitas, % presença e faltas, a repor em aberto, pessoas diferentes, barra por dia da semana (seg..dom) |
| `publico.ts` | `agendaPublica(eventos, turmas, hoje)` → `{ proximas, dias }` | turma fixa aparece uma vez ("toda terça…"); só públicos, não cancelados, de hoje em diante; fechado marcado sem motivo; **nenhum campo de pessoa no tipo** |
| `abas.ts` | `abaDaAgendaDaUrl`, `vistaDaUrl`, `semanaDaUrl`, `mesDaUrl` | desconhecido → padrão; lista repetida → padrão |
| `textos.ts` | Todas as frases pt-BR | verbatim do protótipo onde houver |

Fora do puro: `esquemas.ts` (Zod), `consultas.ts` (leitura, sem `use server`), `gravacao.ts` (escrita com
`tx`, sem `use server`: `garantirMensalidadesDoMes`, `vincularCobranca`, `travarCobranca`), `acoes.ts`
(`use server`, toda função abre com `exigirUsuario()`), `publico/consultas.ts` (a única leitura que o site
alcança).

**Onde cada AGE/D aterrissa** (resumo):

| Item | Banco | Puro | Ação/consulta | Tela |
|---|---|---|---|---|
| D-01 | `clientes`, `documentos.cliente_id` | — | `lib/clientes/*`; `gravarVenda` grava `cliente_id` | Agenda → Pessoas; Cadastros → Clientes |
| D-02 | `mensalidades` `unique(turma, cliente, mes)` | `vencimentoNoMes` | `garantirMensalidadesDoMes` no carregamento | A receber, ficha, Início |
| D-03 | `turmas`, `eventos.turma_id` | `turma.ts` | editar/estender/desativar | Folha da turma |
| D-04 | 3 itens + `chave_do_sistema` | `descricaoDaLinha` | `gravarVenda` com descrição | — |
| D-05 | — | `pessoasAgoraNoEspaco` | `agendaDeHoje` | Bloco do Início |
| D-06 | enum + `uso_livre_id` | — | `encerrarUsoLivre` → `gravarMovimentacoes` | Folha do uso livre; Estoque "Para onde foi" |
| D-07 | `inscricoes.tipo = 'experimental'`, `cobrar`, `valor_centavos` | `valorDaAula` | `colocarNaData` | Folha do evento |
| AGE-01..05, 11, 12 | `eventos`, `inscricoes` | `semana`, `vagas` | lançar/cancelar/remover | Agenda (semana/mês), folhas |
| AGE-06..10 | `clientes`, `turma_alunos`, `inscricoes` | `mensalidade`, `presenca`, `reposicao` | entrar/sair, presença, colocar/tirar | Pessoas, ficha, folha do evento |
| AGE-13, 14 | `usos_livres`, `usos_livres_material`, livro | `uso-livre` | chegou/material/encerrar | Folha do uso livre |
| AGE-15, 16 | `*.documento_id` | `receber` | receberAgora, lote, `lancarVenda` com origem | A receber; Venda |
| AGE-17 | semente da `0026` | — | — | Cadastros → Catálogo |
| AGE-18 | — | `publico` | `publico/consultas` + ISR | Site `#agenda`; aba No site |
| AGE-19 | — | `numeros` | uma consulta por indicador | Números |
| AGE-20 | FKs sem `on delete` | todo `lib/agenda/*` | — | — |

## Architecture Patterns

### System Architecture Diagram

```
 Gestor (celular) ──► /gestao/agenda?aba=…  (Server Component: exigirUsuario → hoje/agora na borda)
      │                   ├─ garantirMensalidadesDoMes(hoje)  ── insert…select…on conflict do nothing ──► mensalidades
      │                   ├─ consultas (semana/mês, pessoas, a receber, números) ──► lib/agenda/* (puro) ──► telas
      │                   └─ "No site": mesmo componente do site, leitura ao vivo
      │
      ├─ Folhas ──► Server Actions lib/agenda/acoes.ts  (exigirUsuario → Zod → tx: trava → planejar* puro → grava)
      │     lançar · cancelar/remover · presença · colocar/tirar · entrar/sair · turma (D-03) · chegou · encerrar
      │                     │                                              │
      │                     │  encerrar uso livre ─► pedidoDeSaidaManual(destino uso_livre, usoLivreId)
      │                     │                        └─► lib/estoque/gravacao.ts::gravarMovimentacoes (trava ITENS)
      │                     │                                └─► movimentacoes_estoque (uso_livre_id, área espaco)
      │                     └─ revalidatePath("/gestao/agenda", "/gestao", e "/" se mudou o que é público)
      │
      ├─ "Recebi agora" / lote ─► tx: trava cobrança → lib/financeiro/gravacao.ts::gravarVenda → grava documento_id
      │                                                    └─► documentos (cliente_id) · documento_linhas · parcelas
      │
      └─ "Lançar na Venda" ─► /gestao/financeiro?aba=venda&origem=mensalidade:<id>
                                 └─ página resolve a cobrança → PainelVenda preenchido (ajustar)
                                       └─► lancarVenda({…, origem}) ─ tx: vincularCobranca (trava) → gravarVenda → vínculo

 Caixa ("Recebi", "Cancelar venda") ─► parcelas.pago_em / documentos.cancelado_em ─► "pago" DERIVADO na Agenda

 Visitante ─► /  (force-static + revalidate 300) ─► seção #agenda ─ try: lib/agenda/publico/consultas (sem pessoa)
                                                               └ catch: AulasEOficinas (estado "sem Agenda")
 Início ─► BlocoAgendaDeHoje (try/catch próprio) ─► agendaDeHoje(hoje, agora) ─► pessoasAgoraNoEspaco (puro)
```

### Recommended Project Structure
```
lib/agenda/
├── semana.ts  horario.ts  turma.ts  mensalidade.ts  uso-livre.ts  reposicao.ts
├── presenca.ts  vagas.ts  receber.ts  espaco.ts  numeros.ts  publico.ts  abas.ts   # PUROS
├── textos.ts                 # frases pt-BR
├── esquemas.ts               # Zod das ações
├── consultas.ts              # leituras (sem "use server")
├── gravacao.ts               # escrita com tx (sem "use server"): garantirMensalidadesDoMes, vincularCobranca
├── acoes.ts                  # "use server": toda função abre com exigirUsuario()
└── publico/consultas.ts      # a ÚNICA leitura que o site alcança (sem pessoa)
lib/clientes/{consultas,acoes,esquemas,textos}.ts      # D-01, transversal
lib/financeiro/gravacao.ts                              # gravarVenda(tx, …) extraído de lancarVenda
app/gestao/(app)/agenda/{page,loading,error}.tsx
app/api/health/agenda/route.ts
components/amassa/agenda/*                               # semana, mês, folhas, abas, a receber, números
components/site/agenda-publica*.tsx                      # Server (lê) + Client (navega mês/dia)
db/migrations/0026_agenda.sql                            # gerado + à mão
docs/operacao/17-migracao-agenda.md                      # roteiro do dono
```

### Pattern 1: Cobrança → Venda numa transação, com vínculo condicional
**What:** trava a cobrança, confere que está livre, grava a venda pelo escritor único, grava o vínculo.
**When:** "Recebi agora", lote, e `lancarVenda` com `origem`.
**Ordem de travas:** COBRANÇA → (documento novo, que ninguém vê) → ITENS. Nenhum caminho da Agenda trava um
documento existente, então não há ciclo com `cancelarDocumento` (DOCUMENTO → ORDEM → ITENS).

### Pattern 2: Estado desejado, nunca "inverter"
Presença, `direito_a_repor`, `cobrar` do material, `publica` da turma: o cliente manda o valor que quer
(`"veio" | "faltou" | null`), molde `definirContaFixaAtiva` (`lib/cadastros/acoes.ts:791-794`: "Recebe o
estado DESEJADO, nunca 'inverte' … duas chamadas com o mesmo valor convergem sempre"). Duplo toque e dois
celulares convergem.

### Pattern 3: Crédito de reposição derivado das linhas
Nunca uma coluna "saldo". Crédito = `count(faltou ∧ direito, data não cancelada)` −
`count(tipo = 'reposicao', data não cancelada)`. Tirar uma reposição, cancelar a data dela ou desativar a
turma devolve o crédito sozinho. "Guardar os dois lados" (§4) é guardar as linhas.

### Pattern 4: Escrita compartilhada fora de arquivo `use server`
`gravarVenda`, `garantirMensalidadesDoMes`, `vincularCobranca`, a consulta pública: sem a diretiva (molde
`lib/producao/gravacao.ts:1-8`). Toda exportação de `use server` vira endpoint.

### Pattern 5: O módulo nunca lê o relógio
`hojeEmBrasilia(new Date())` e `agoraEmBrasilia(new Date())` só na página/ação; tudo em `lib/agenda/*` puro
recebe por argumento.

### Anti-Patterns to Avoid
- **Ler "já existe?" antes de inserir mensalidade ou data de turma:** a garantia é a chave única (D-02).
- **Material cobrado como linha de item do estoque:** baixa em dobro e quantidade inteira (Pitfall 3).
- **`for update` em `clientes`/`usos_livres`/`mensalidades`:** essas linhas são alvo de FK de inserts
  concorrentes (`for key share`); use `for no key update` (o porquê em `lib/estoque/gravacao.ts:18-25`).
- **Gravar "pago" na Agenda:** é derivado do Financeiro (§5).
- **Literal do enum novo em `check`/`insert` da `0026`:** "unsafe use of new value" (Pitfall 1).
- **`revalidatePath` dentro do render:** proibido pelo Next; a mensalidade do D-02 não precisa.
- **Nome, telefone ou motivo de fechado na consulta pública:** a defesa é não selecionar.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Gravar venda, linhas, parcelas, taxa do cartão | Outro insert de `documentos` | `gravarVenda(tx, …)` extraído de `lancarVenda` | Já há três cópias; taxa congelada e estoque ficam iguais em todo lugar |
| Conferir parcelas | Soma própria | `conferirParcelas` (`lib/financeiro/parcelas.ts:171-221`) | Mesma frase de recusa no sistema inteiro |
| Gravar no livro | `insert(movimentacoesEstoque)` | `gravarMovimentacoes` + `pedidoDeSaidaManual` | Porta única (grep de aceite da Fase 06); custo médio sob trava |
| Área da saída | Escolher na Agenda | `areaDoDestino("uso_livre")` = `espaco` | D-14 da Fase 06 |
| Busca sem acento | `lower()` + `replace` no JS | `nome_normalizado()` + índice | Receita pronta (02-MODELO-DE-DADOS.md:42-58) |
| Idempotência | Leitura prévia | `unique` + `on conflict do nothing` | D-02; dois celulares |
| "Hoje" | `new Date().toISOString()` | `hojeEmBrasilia` / `hojeNoAtelie()` | Das 21h às 24h o dia UTC é outro |
| SQLSTATE | `erro.code` | `codigoDoErroPostgres` (`lib/erro/postgres.ts:11`) | O Drizzle embrulha em `erro.cause.code` |
| Link de WhatsApp | Concatenação | `hrefDoWhatsapp` + `CONTEUDO_SITE.zap` | D-17 da 04.6 |
| Estados do bloco do Início | Envelope novo | `BlocoDoInicio`, `EstadoErro`, `TentarDeNovo`, `BlocoEsqueleto` | GES-08 |
| URLs | Literal `"/gestao/agenda"` | `rotaDeGestao("/agenda")`, `hrefDoCaixa`, `hrefDaVendaComOrigem` | `sem-rota-antiga.test.ts` |
| Cache do site | Cache próprio em memória | ISR do Next (`revalidate` + `revalidatePath`) | Sobrevive ao banco cair, documentado |

**Key insight:** quase nada nesta fase é novo no sistema — venda, livro, idempotência, travas, estados e
ISR já têm molde. O que é novo é o calendário em si (datas, presença, créditos, horas) e cabe inteiro no
módulo puro.

## Common Pitfalls

### Pitfall 1: O enum novo usado na mesma transação
**What goes wrong:** `ALTER TYPE destino_saida ADD VALUE 'uso_livre'` seguido de um `check (… destino = 'uso_livre')`
derruba a `0026` inteira com `unsafe use of new value`.
**Why:** o migrador aplica todas as pendentes numa transação (`dialect.js:59-71`) e o Postgres 17 só aceita
o valor novo depois do commit — reproduzido nesta sessão.
**How to avoid:** `check` com `destino::text = 'uso_livre'` (passa, reproduzido); nenhuma semente com o valor.
O `db/schema.ts` escreve o mesmo `sql` com `::text`, para o `drizzle-kit` não ver diferença depois.
**Warning signs:** `npm run test:migracoes` falha em "Aplicando migrações".

### Pitfall 2: Coluna nova em tabela quente quebra toda venda e toda baixa
**What goes wrong:** publicado o código com `documentos.cliente_id` e `movimentacoes_estoque.uso_livre_id` no
esquema, e a `0026` ainda não aplicada, **todo** `insert` nessas tabelas falha (`column "cliente_id" does not
exist`) — venda, despesa, aprovação de orçamento, contas fixas, baixa, conclusão da Produção.
**Why:** o `insert` do Drizzle lista todas as colunas do esquema compilado e manda `default` nas ausentes
(`dialect.js:356-390`).
**How to avoid:** a ordem de publicação é a **Open Question 7**; o roteiro mede com `/api/health/agenda`.

### Pitfall 3: Material cobrado entrando na venda como item de estoque
**What goes wrong:** baixa em dobro (a venda dá saída de 1 unidade inteira por linha —
`efeito-estoque.ts:109-112` — além da saída do D-06) e "1,2 kg" não cabe em `quantidade` inteira
(`documento_linhas_quantidade_no_intervalo`, `between 1 and 99999`, `db/schema.ts:918-921`).
**How to avoid:** cada material cobrado vira **linha livre** (`item_id` nulo) "Argila branca · 1,2 kg", valor =
`valorDoMaterial`, na categoria definida pela Open Question 6. A baixa é só a do encerramento.

### Pitfall 4: O "Para onde foi" esconde o uso livre
**What goes wrong:** o destino novo fora de `DESTINOS_DE_SAIDA` some do agregador sem erro
(`historico.ts:370-374`) — a D-06 perde o motivo de existir.
**How to avoid:** seis destinos na lista de descrição; cinco na lista da folha; teste de paridade com o enum.

### Pitfall 5: Datas novas sem os alunos
**What goes wrong:** "Marcar mais N semanas" cria datas vazias; os alunos somem das aulas de novembro.
**How to avoid:** a mesma transação inscreve todo `turma_alunos` ativo (sem `saiu_em`) nas datas criadas,
`on conflict (evento_id, cliente_id) do nothing`.

### Pitfall 6: A mensalidade "já nascida" que ainda não nasceu
**What goes wrong:** o dono muda a mensalidade no dia 12 e ninguém abriu "A receber" desde o dia 1 → a do mês
nasce depois, já com o valor novo (contra a D-03).
**How to avoid:** `editarTurma` chama `garantirMensalidadesDoMes` daquela turma na mesma transação, antes do
`update`.

### Pitfall 7: Crédito de reposição gasto duas vezes
**What goes wrong:** dois celulares põem a mesma pessoa como reposição em duas datas ao mesmo tempo com 1
crédito; o saldo vai a −1.
**How to avoid:** a ação trava a linha do **cliente** com `for no key update` (não `for update`: as inscrições
novas pedem `for key share` nela), recalcula o crédito sob a trava e só então insere.

### Pitfall 8: Venda em dobro para a mesma cobrança
**What goes wrong:** duplo toque em "Recebi agora", ou "Recebi agora" num celular e "Lançar na Venda" no outro.
**How to avoid:** trava da cobrança + conferência "livre" sob a trava, na mesma transação da venda; o segundo
cai em "Este item já foi lançado (venda nº N)". O lote pula as já lançadas.

### Pitfall 9: `time` volta com segundos
**What goes wrong:** `"19:00:00"` do `pg` comparado com `"19:00"` do formulário; `<input type="time">` com
valor `"19:00:00"` mostra segundos em alguns navegadores.
**How to avoid:** `minutosDe` aceita os dois; a consulta formata (`to_char(inicio, 'HH24:MI')`) ou o puro corta.

### Pitfall 10: O rascunho da Venda em montagem sobrescrito
**What goes wrong:** o gestor tinha um carrinho no `sessionStorage` e toca "Lançar na Venda" na Agenda — o
preenchimento da origem apaga o carrinho (ou o carrinho se mistura com a origem).
**How to avoid:** com `origem`, o painel não lê nem grava a chave do rascunho comum (usa a sua, ou nenhuma) e,
se houver carrinho não vazio, avisa antes; decidir o texto na UI-SPEC.

### Pitfall 11: O site não mostra o que o e2e semeou
**What goes wrong:** o teste insere um evento público direto no banco e abre `/` — vê o estado "sem Agenda"
(página em cache, construída sem banco no CI).
**How to avoid:** criar pela tela (a ação chama `revalidatePath("/")`); nunca afirmar o site a partir de semente
crua. Conferir também que o contêiner `standalone` consegue gravar o cache do ISR (`.next` é do usuário
`nextjs`, `docker/Dockerfile`, `COPY --chown=nextjs:nodejs`) — a primeira execução no CI prova.

### Pitfall 12: "Agora" no e2e perto da meia-noite
**What goes wrong:** um evento "agora − 1h até agora + 1h" às 23h30 tem `fim` no dia seguinte → `check (fim > inicio)`
recusa a semente.
**How to avoid:** `agoraNoAtelie()` no apoio; perto das bordas, encaixar o intervalo dentro do dia (início 00:00
ou fim 23:59) — a lógica exaustiva fica no unitário de `pessoasAgoraNoEspaco`.

### Pitfall 13: A raiz deixando de ser provada sem banco
**What goes wrong:** a seção viva lança erro no build (sem `DATABASE_URL`) e o `docker build` falha; ou alguém
afrouxa `site-isolamento.test.ts` tirando `@/db` da lista.
**How to avoid:** `try/catch` com queda no estado "sem Agenda"; exceção nomeada de **um arquivo** no teste;
rodar `npm run test:site-sem-banco` no último plano (não faz parte do `verificar`, `testar-site-sem-banco.mjs:10-13`).

### Pitfall 14: Item do sistema desativado em Cadastros
**What goes wrong:** o dono desativa "Mensalidade" → toda cobrança passa a falhar com "Um dos itens saiu do
catálogo" (`lancarVenda`, `acoes.ts:183-188`).
**How to avoid:** a trava da Open Question 9 (gatilho P0001 + ação de Cadastros que esconde "desativar").

### Pitfall 15: `.next/types` velhos e a cadeia do Playwright
Depois de trocar de branch, TS2307 no `verificar`: apagar `.next/types` (memória do projeto). E um `--grep` de
spec da Agenda **não** arrasta a suíte inteira enquanto ela não tiver `@parametro-global`.

## Code Examples

### D-02 — a mensalidade do mês numa instrução
```ts
// lib/agenda/gravacao.ts (SEM "use server") — chamado pelo carregador de "A receber", da ficha e do
// Início, e por editarTurma (só a turma editada). Idempotente pela chave única.
// Fonte do molde: lib/cadastros/acoes.ts:868-879 (onConflictDoNothing) + dialect.js:356-370 (insert…select).
export async function garantirMensalidadesDoMes(
  executor: TransacaoDoBanco | typeof db,
  mes: string,            // "AAAA-MM-01"
  ultimoDia: string,      // "AAAA-MM-31"
  turmaId?: string,
): Promise<void> {
  await executor.execute(sql`
    insert into mensalidades (turma_id, cliente_id, mes, valor_centavos, vencimento)
    select t.id, a.cliente_id, ${mes}::date, t.mensalidade_centavos,
           make_date(extract(year from ${mes}::date)::int, extract(month from ${mes}::date)::int, t.dia_vencimento)
      from turma_alunos a
      join turmas t on t.id = a.turma_id
     where t.ativa
       and a.entrou_em <= ${mes}::date
       and (a.saiu_em is null or a.saiu_em >= ${mes}::date)
       ${turmaId ? sql`and t.id = ${turmaId}` : sql``}
    on conflict (turma_id, cliente_id, mes) do nothing
  `);
}
```
(`dia_vencimento` vai até 28, então `make_date` nunca cai num dia inexistente. Nomes de coluna = proposta.)

### D-06 — o trecho da `0026` que precisa de mão
```sql
ALTER TYPE "public"."destino_saida" ADD VALUE 'uso_livre';--> statement-breakpoint
ALTER TABLE "movimentacoes_estoque" ADD COLUMN "uso_livre_id" uuid;--> statement-breakpoint
-- NUNCA o literal do enum aqui: a migração roda na MESMA transação do ADD VALUE ("unsafe use of
-- new value", Postgres 17). Comparar como TEXTO não instancia o valor do enum.
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_uso_livre_so_no_destino_uso_livre"
  CHECK ("movimentacoes_estoque"."uso_livre_id" is null or "movimentacoes_estoque"."destino"::text = 'uso_livre');--> statement-breakpoint
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_destino_uso_livre_com_vinculo"
  CHECK ("movimentacoes_estoque"."destino" is null or "movimentacoes_estoque"."destino"::text <> 'uso_livre'
         or "movimentacoes_estoque"."uso_livre_id" is not null);
```

### Encerrar o uso livre (forma)
```ts
// lib/agenda/acoes.ts ("use server")
export async function encerrarUsoLivre(entradaBruta: unknown) {
  const usuario = await exigirUsuario();                       // 1ª instrução (verificar-acoes)
  const dados = esquemaEncerrar.safeParse(entradaBruta);        // { usoLivreId, saida: "HH:MM" }
  // …
  await db.transaction(async (tx) => {
    const [uso] = await tx.select(/* … */).from(usosLivres)
      .where(eq(usosLivres.id, dados.usoLivreId)).for("no key update");
    const plano = planejarEncerramento(uso, materiais, dados.saida, precoHora);  // PURO
    if (plano.tipo === "recusa") throw new RecusaDaAgenda(plano.frase);
    const pedidos = materiais.map((m) =>
      pedidoDeSaidaManual({ itemId: m.itemId, milesimos: m.quantidadeMilesimos,
                            destino: "uso_livre", usoLivreId: uso.id, nota: plano.nota }));
    const gravadas = await gravarMovimentacoes(tx, pedidos, { registradoPor: usuario.id }); // trava ITENS
    // grava movimentacao_id de cada material, saida, horas_cheias, preco_hora_centavos, estado 'encerrado'
  });
  revalidatePath(rotaDeGestao("/agenda")); revalidatePath(rotaDeGestao("/estoque")); revalidatePath(rotaDeGestao("/"));
}
```

### Vínculo condicional (vale para os três tipos)
```sql
-- Dentro da transação da venda, ANTES de gravar a venda (ordem COBRANÇA → DOCUMENTO NOVO → ITENS):
select c.id, c.documento_id, d.cancelado_em
  from mensalidades c left join documentos d on d.id = c.documento_id
 where c.id = $1
   for no key update of c;
-- livre = documento_id is null  (ou cancelado_em is not null, se a Open Question 1 for pela recomendação)
-- … gravarVenda(tx, …) …
update mensalidades set documento_id = $doc where id = $1;
```

### A seção viva do site
```tsx
// components/site/agenda-publica.tsx — Server Component (sem "use server", sem next/headers)
import { lerAgendaPublica } from "@/lib/agenda/publico/consultas";   // exceção nomeada da cerca
import { agendaPublica } from "@/lib/agenda/publico";                 // puro
export async function AgendaPublica({ hoje }: { hoje: string }) {
  let dados;
  try {
    dados = agendaPublica(await lerAgendaPublica(hoje), hoje);
  } catch (erro) {
    console.error("Agenda pública indisponível — mostrando o estado sem Agenda:", erro);
    return <AulasEOficinas />;                                          // o estado aprovado de hoje
  }
  if (dados.proximas.length === 0) return <AulasEOficinas />;          // Open Question 4
  return <CalendarioPublico dados={dados} />;                           // Client: navega mês/dia
}
// app/page.tsx: mantém `export const dynamic = "force-static";` e acrescenta `export const revalidate = 300;`
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `alter type … add value` proibido em transação | Permitido desde o PG 12, mas o valor só pode ser **usado** depois do commit | PostgreSQL 12 | Uma migração basta, com `check` em texto (reproduzido no 17.10) |
| Modelo antigo da Agenda: `alunas`, matrículas, `garantir_aulas_da_semana()` (`02-MODELO-DE-DADOS.md:248-394`) | `clientes` transversal (D-01), datas de turma materializadas por N semanas | 26/09 e 01/10/2026 (briefing + CONTEXT) | Não reaproveitar `alunas`/`alunas_da_aula` do documento; só a função `nome_normalizado` |
| Next 15: `revalidate` sempre disponível | Next 16: `dynamic`/`revalidate` somem **só com `cacheComponents`** ligado (`route-segment-config/index.md:19`) | Next 16.0 | O projeto não liga `cacheComponents` (`next.config.ts`, lido) — o modelo "anterior" vale |
| AGD-01..16 (grade por turno, quatro estados de presença) | AGE-01..20 | 01/10/2026 | Nada do modelo antigo foi executado |

**Deprecated/outdated:** `components/site/aulas-e-oficinas.tsx` deixa de ser "o" estado da seção e vira a
queda (sem banco / sem evento público). O teste "nenhum arquivo de components/site/ importa lib/agenda" é
substituído, não apagado.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | O `drizzle-kit 0.31.10` gera `ALTER TYPE … ADD VALUE 'uso_livre'` (e não recria o tipo) ao acrescentar o valor ao `pgEnum` | Pergunta 5 | Se recriar o tipo, o arquivo é reescrito à mão; o `test:migracoes` detecta |
| A2 | Nomes de tabela/coluna/enum do modelo (`clientes`, `inscricoes`, `tipo_evento`, `no_espaco`…) | Modelo de dados | Só nome — trocável antes da migração existir |
| A3 | `clientes` sem `ativo` nesta fase (erro de cadastro se corrige editando o nome) | Pergunta 1 | Lista de Pessoas cresce com duplicatas sem como esconder; coluna depois = migração pequena |
| A4 | Busca de Pessoas por prefixo/contém sobre `nome_normalizado` basta (sem `pg_trgm`) | Pergunta 1 | Com milhares de clientes o "contém" faz varredura; aceitável no volume do ateliê |
| A5 | Prefetch de `<Link>` para rota dinâmica não executa o corpo da página (só até o `loading`) | Pergunta 8 | Se executar, a escrita idempotente roda a mais — sem efeito no dado |
| A6 | "Uma Venda por aluno" no lote = uma por mensalidade (aluno em duas turmas = duas vendas, cada uma no dia da sua turma) | Pergunta 3 | Se o dono quiser uma venda só com duas linhas e duas parcelas, muda o lote (não o banco) |
| A7 | Proporcional usa as datas **marcadas e não canceladas** do mês (como o protótipo, `331`); mês sem nenhuma data marcada = mensalidade cheia | Módulo puro | Turma com só 2 das 4 datas marcadas no mês dá proporcional "2 de 2" errado — o gestor deve marcar semanas suficientes |
| A8 | Nenhum evento nem uso livre atravessa a meia-noite | Pergunta 7 | Aula até depois da meia-noite seria recusada pelo `check` |
| A9 | Editar horário/vagas/público da turma vale para `data > hoje` (hoje fica como estava) | Pergunta 9 | Mudança feita de manhã para a aula da noite de hoje não pega; ajustar a data de hoje à mão |
| A10 | Na falha de leitura em tempo de regeneração, mostrar o estado "sem Agenda" (em vez de lançar e manter o calendário velho) | Pergunta 10 | Por até 5 min o site mostra os cartões de texto; alternativa: lançar em runtime e só cair no build (`NEXT_PHASE`) |
| A11 | Janela pública: de hoje até o fim do 6º mês | Pergunta 10 | Oficina marcada para daqui a 8 meses não aparece no site |
| A12 | Horas-pessoa de aula na aba Números = presentes × `teto(duração/60)`, como o protótipo (`286`) | Módulo puro | Aula de 2h30 conta 3h por pessoa |
| A13 | Entrar como aluno quem já está inscrito numa data futura (experimental) mantém a inscrição existente (`on conflict do nothing`) | Pergunta 9 | Experimental cobrada + mensalidade no mesmo mês — o gestor tira a experimental |
| A14 | A desativação da turma apaga as datas futuras (e as inscrições delas), não as cancela | Pergunta 9 | Se cancelar, a semana fica cheia de datas riscadas da turma desativada |

## Open Questions

> O dono está disponível nesta sessão. Cada pergunta tem opções, recomendação e se é **one-way**
> (migração/dado) ou **reversível** (código/tela). Nenhuma reabre decisão travada.

1. **Quando o Caixa cancela a venda de uma cobrança da Agenda, o que acontece com ela?** (E: dá para "tirar
   da lista" ou tirar o aluno de uma data/turma cuja cobrança já virou venda?)
   - O que se sabe: `cancelarDocumento` (`lib/financeiro/acoes.ts:613-683`) não sabe da Agenda; a 06.1
     resolveu o caso dela na própria transação (D-07 da 06.1). O protótipo, ao cancelar uma **oficina**, diz
     "Quem já pagou continua no Financeiro — devolução se resolve lá" (`352`).
   - Opções: **(a)** a cobrança **volta a "A receber" sozinha** (derivado: vínculo com venda cancelada = livre),
     com a etiqueta "venda nº N cancelada", e pode ser lançada de novo — nada é gravado no cancelamento;
     (b) fica "venda cancelada" fora de "A receber" e o gestor decide (relançar ou dispensar); (c) o
     cancelamento grava na Agenda (desvincula) dentro de `cancelarDocumento`.
   - **Recomendação: (a)** + bloquear "tirar da lista"/"sair da data" de cobrança ligada a venda **não
     cancelada**, com a frase "Esta inscrição já virou a venda nº N. Para devolver, cancele a venda no Caixa."
     Por quê: o Caixa continua sendo o único lugar de dinheiro (§5) e nenhuma trava nova entra em
     `cancelarDocumento`. Se o aluno desistiu, a Open Question 2 cobre.
   - **Reversível** (só código: a regra é derivada).

2. **Dá para dispensar uma cobrança?** (Aluno que sai no dia 2 e não deve o mês; bolsa; experimental marcada
   "cobrar" por engano; venda cancelada que não será refeita.)
   - O que se sabe: o protótipo não tem como tirar uma mensalidade de "A receber"; o briefing não fala; a
     mensalidade nasce para quem está na turma no dia 1 (D-02) e não some quando o aluno sai (AGE-07: "o que
     já aconteceu fica").
   - Opções: **(a)** botão "Dispensar" na linha de "A receber" (mensalidade e inscrição), com confirmação e
     motivo opcional, que **marca** (`dispensada_em`, `dispensada_por`) e nunca apaga — e "desfazer"; (b) sem
     dispensa: o gestor lança e cancela no Caixa (gera venda e cancelamento sem dinheiro nenhum); (c) a
     mensalidade some sozinha se o aluno sair antes da primeira aula do mês.
   - **Recomendação: (a)**, só para cobrança **ainda não lançada** (ou com venda cancelada). Por quê: (b) suja o
     Caixa e o Mês com vendas fantasma; (c) é regra de dinheiro automática que ninguém pediu.
   - **One-way** (duas colunas por migração em `mensalidades` e `inscricoes`) — decidir antes da `0026`.

3. **O site mostra preço?** A D-18 da 04.6 (28/09) decidiu "**Sem preço no site**" e trocou "R$ 35 por hora"
   por "Consulte o valor pelo WhatsApp" (`conteudo/site.ts`, `agLivre`); o AGE-18 (briefing de 26/09, anterior)
   pede preço por mês/por pessoa nos cartões e "preço da hora" no bloco de uso livre.
   - Opções: (a) AGE-18 inteiro: preço nos cartões e preço da hora (do item "Uso livre (hora)") no bloco; (b) D-18
     inteiro: nenhum preço, "Consulte o valor pelo WhatsApp" em tudo; **(c)** preço **nos cartões de evento**
     (o gestor digita o preço daquela oficina/turma ao lançar — é decisão por evento) e o bloco de uso livre
     continua com o texto da D-18.
   - **Recomendação: (c)** — o motivo da D-18 ("nenhuma ligação com o Catálogo … na página que precisa
     sobreviver ao Postgres cair", `04.6-CONTEXT.md:114-115`) não vale para o evento, que já vem do banco com
     queda segura; e o preço da hora pode continuar indefinido antes da inauguração.
   - **Reversível** (só tela).

4. **Dois casos de borda do que o site mostra.**
   - (4a) **Nenhum evento público marcado**: **recomendação** — continuar mostrando os três cartões de texto e
     "O calendário … entra aqui em breve" (o estado aprovado, SIT-07), em vez de um calendário vazio ("nada de
     calendário vazio", `BRIEFING-site.md:64`). Alternativa: calendário vazio com "Nenhuma data marcada ainda".
   - (4b) **Vagas da turma fixa em "Próximas"**: o protótipo conta os inscritos da **próxima data**
     (`cartaoSite(e)`, `prototipo.html:277`), que inclui reposições e experimentais daquele dia.
     **Recomendação** — em "Próximas", vagas = vagas da turma − **alunos ativos** (é a vaga que interessa a quem
     quer entrar na turma); no calendário mensal, por data (como o protótipo).
   - **Reversível** (só tela).

5. **Dia fechado × o que já está marcado.** A folha do bloqueio diz "avisa se alguém lançar algo por cima"
   (`prototipo.html:298`), mas nada implementa; a geração de datas de turma não pula bloqueio (`344`).
   - Opções: **(a)** ao lançar qualquer coisa num dia fechado (ou fechar um dia que já tem algo), **aviso que
     não bloqueia** ("Esse dia está fechado: Natal — lançar mesmo assim?"); as datas de turma que caem num dia
     fechado **não** são canceladas sozinhas — a semana mostra a etiqueta "dia fechado" nelas e o gestor cancela
     com um toque; (b) gerar/estender a turma **pulando** dias fechados e cancelar sozinho as datas de turma ao
     fechar um dia; (c) nenhum aviso, nenhuma regra.
   - **Recomendação: (a)** — é o "avisa e não bloqueia" que o projeto usa para lista cheia (AGE-11), não mexe em
     presença nem em crédito sem o gestor ver, e o §2.8 continua valendo (é sobre lotação, não dia fechado).
   - **Reversível** (código; nenhum dado novo).

6. **Material "cobrar": de onde vem o preço e em que categoria entra na venda?**
   - O que se sabe: o briefing diz "preço de venda do Catálogo × quantidade" (§6); item de estoque pode não ter
     `preco_venda_centavos` nem categoria de venda (só `controla_estoque` exige categoria de **compra**,
     `db/schema.ts:682-685`). A linha precisa ser livre (Pitfall 3) e linha livre exige categoria `receita`/`fora`
     ativa (`acoes.ts:129-152`).
   - Opções: **(a)** "cobrar" só aparece para material **com preço de venda**; sem preço, só "incluso" e a dica
     "Cadastre o preço de venda em Cadastros para poder cobrar"; a linha entra na **mesma categoria do item "Uso
     livre (hora)"** (Uso do espaço, área Espaço — receita e custo do uso livre na mesma área); (b) sem preço, a folha
     pede o valor na hora; (c) a categoria de venda do próprio material, quando houver.
   - **Recomendação: (a)** — preço é cadastro, nunca digitado no balcão (AGE-17); e o Mês mostra o uso livre
     inteiro (horas + material) na área que paga o material (D-06).
   - **One-way pequeno**: o preço unitário é **congelado** em `usos_livres_material` no encerramento (coluna).

7. **Ordem de publicação.** A `0026` acrescenta colunas a `documentos` e `movimentacoes_estoque`: com o código
   novo no ar e a migração ainda não aplicada, **toda venda, despesa, aprovação de orçamento e baixa falha**
   (Pitfall 2).
   - Opções: (a) como a D-09 da 06.1: **uma publicação** e o `db:migrate` logo depois do `implantar` (janela de
     minutos); (b) commit só-migração publicado e aplicado **antes** do código (molde do Roteiro 15) — zero janela,
     duas idas ao servidor; (c) aplicar a migração antes e só então publicar tudo (mesmo que b).
   - **Recomendação: (a) se a plataforma ainda não estiver em uso no dia; (b) se já estiver.** Em 30/09 o dono
     disse "ainda não estamos operando" — confirmar se continua valendo no dia da publicação.
   - **One-way** (é o procedimento de produção).

8. **Nomes repetidos no cadastro de clientes.**
   - Opções: **(a)** permitir, com **aviso** ao criar quando já existe nome igual pelo `nome_normalizado` ("Já
     existe Marina Lopes (62) 9…. É a mesma pessoa?" → usar a existente / criar outra), e o telefone aparecendo
     na lista para distinguir; (b) proibir (índice único) — duas Marinas reais não caberiam; (c) sem aviso.
   - **Recomendação: (a)** — herda o AGD-14 sem impedir homônimos reais.
   - **Reversível** (o índice é não único; o aviso é tela).

9. **Os itens "Mensalidade", "Inscrição em oficina" e "Uso livre (hora)" podem ser desativados em Cadastros?**
   - Opções: **(a)** coluna `itens_catalogo.chave_do_sistema` + gatilho: o item **não se desativa nem sai da
     venda**; nome, preço e categoria editáveis (como a categoria "diferença", `0015:155-193`); (b) a Agenda acha
     pelo nome e falha com aviso se não achar; (c) desativar é permitido e a Agenda mostra "o item X está desativado
     em Cadastros — reative para cobrar".
   - **Recomendação: (a)** — o precedente existe e é o único que não quebra cobrança no meio do mês.
   - **One-way** (coluna + gatilho por migração).

10. **Uso livre esquecido "no espaço".** Alguém marcou "Chegou" ontem e não encerrou.
    - Opções: **(a)** "Agora no espaço" só conta usos **de hoje**; o de dia passado aparece na semana com a
      etiqueta "encerrar" (como "marcar presença"), e encerrar continua possível; (b) conta todos os abertos (o
      texto literal da D-05: "todo uso livre com Chegou e ainda não encerrado").
    - **Recomendação: (a)** — o número de relance não pode ficar inflado por esquecimento; a D-05 descreve o caso
      normal (o uso de hoje).
    - **Reversível** (consulta).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | build, testes | ✓ | v24.19.0 | — |
| Docker (daemon) | `test:migracoes`, `test:e2e`, `test:site-sem-banco` (Postgres efêmero) | ✓ | 29.6.2 | — |
| Postgres 17 (imagem `postgres:17-alpine`) | migração, testes | ✓ (puxada nesta sessão) | 17.10 | — |
| Postgres de produção | aplicar a `0026` | — (servidor do dono) | 17 | Dono aplica à mão depois de backup |
| Documentação do Next 16.3.5 | cache/ISR/efeitos | ✓ embarcada em `node_modules/next/dist/docs` | 16.3.5 | — |

**Missing dependencies with no fallback:** nenhuma.
**Missing dependencies with fallback:** nenhuma.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (unit) · Playwright ^1.62.1 (e2e) · `scripts/testar-migracoes.mjs` (banco efêmero) · `scripts/testar-site-sem-banco.mjs` (raiz sem Postgres) |
| Config file | `vitest.config.ts` (`tests/unit/**/*.test.ts`), `playwright.config.ts` |
| Quick run command | `npx vitest run tests/unit/agenda-*.test.ts tests/unit/clientes-*.test.ts` |
| Full suite command | `npm run verificar` (lint, `tsc --noEmit`, `verificar-acoes`, `npm test`, `test:migracoes`) + `npm run test:e2e` (varredura completa **uma vez**, no último plano) + `npm run test:site-sem-banco` (uma vez, no último plano) |

**Custo do e2e (CLAUDE.md):** ~53 s fixos por invocação (15 s de Postgres + 38 s de `next build`). **No máximo
uma invocação por tarefa, sempre com `--grep` no que a tarefa mexeu; nunca `npm run build` separado; a varredura
sem `--grep` uma vez por fase, no último plano.** Registrar no SUMMARY os comandos rodados.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AGE-01 | Folha "Lançar" cria os 4 tipos; só autenticado | e2e | `npm run test:e2e -- --grep "agenda lancar"` | ❌ Wave 0 |
| AGE-02 | Semana (padrão no celular, Hoje, + lançar) e mês (pontos; toque abre a semana) | unit + e2e | `npx vitest run tests/unit/agenda-semana.test.ts`; `--grep "agenda vistas"` | ❌ Wave 0 |
| AGE-03 | Turma marca N semanas (8); estender sem duplicar; folha da turma (D-03) | unit + migração + e2e | `tests/unit/agenda-turma.test.ts`; `test:migracoes` (unique 23505); `--grep "agenda turma"` | ❌ |
| AGE-04 | Data cancelada não conta falta; lista própria | unit + e2e | `tests/unit/agenda-reposicao.test.ts`; `--grep "agenda cancelar data"` | ❌ |
| AGE-05 | Cancelar risca e desfaz; remover só fechado e reserva não iniciada, com confirmação | e2e + migração | `--grep "agenda remover"`; `test:migracoes` (revoke delete 42501 nas que não se apagam) | ❌ |
| AGE-06 | Pessoas = clientes; busca sem acento; tags; ficha; Cadastros → Clientes | unit + migração + e2e | `tests/unit/clientes-esquemas.test.ts`; `test:migracoes` (`nome_normalizado`); `--grep "agenda pessoas"` | ❌ |
| AGE-07 | Entrar (proporcional) / sair (futuras) | unit + e2e | `tests/unit/agenda-mensalidade.test.ts`; `--grep "agenda entrar na turma"` | ❌ Wave 0 |
| AGE-08 | Veio/Faltou um toque, desmarca; "marcar presença" | unit + e2e (celular) | `tests/unit/agenda-presenca.test.ts`; `--grep "agenda presenca"` | ❌ |
| AGE-09 | Crédito = faltas com direito − reposições; dois celulares não estouram | unit + e2e | `agenda-reposicao.test.ts`; `--grep "agenda reposicao"` | ❌ |
| AGE-10 | Colocar: a repor primeiro; experimental cobrar/gratuita (D-07); tirar da lista | unit + e2e | `agenda-mensalidade.test.ts` (`valorDaAula`); `--grep "agenda colocar"` | ❌ |
| AGE-11 | n/vagas; lista cheia avisa e não bloqueia | unit + e2e | `tests/unit/agenda-vagas.test.ts`; `--grep "agenda lista cheia"` | ❌ |
| AGE-12 | Avulsa com preço; inscrição vai para A receber | e2e | `--grep "agenda oficina"` | ❌ |
| AGE-13 | Reservado → No espaço → Encerrado; horas cheias × pessoas × preço | unit + e2e | `tests/unit/agenda-uso-livre.test.ts`; `--grep "agenda uso livre"` | ❌ Wave 0 |
| AGE-14 | Cada material vira saída `uso_livre` com vínculo e área Espaço, inclusive incluso | unit + migração + e2e | `tests/unit/estoque-pedidos.test.ts`, `estoque-destinos.test.ts`; `test:migracoes` (checks em texto); `--grep "agenda material estoque"` | ✅ estender / ❌ |
| AGE-15 | Recebi agora (paga hoje, no Caixa) e Lançar na Venda (rascunho preenchido); vínculo; pago derivado | unit + e2e | `tests/unit/agenda-receber.test.ts`, `financeiro-gravacao.test.ts`; `--grep "agenda receber"` | ❌ |
| AGE-16 | Lote: uma venda por mensalidade, parcela no vencimento; D-02 idempotente | unit + migração + e2e | `test:migracoes` (insert da D-02 duas vezes = mesma contagem); `--grep "agenda mensalidades lote"` | ❌ |
| AGE-17 | Três itens semeados, editáveis, sem preço no código | migração + e2e | `test:migracoes` (semente + chave); `--grep "cadastros itens da agenda"` | ❌ |
| AGE-18 | Site: só público, não cancelado, de hoje em diante; vagas; sem nome; cai no "sem Agenda" sem banco | unit + e2e + script | `tests/unit/agenda-publico.test.ts`, `site-isolamento.test.ts` (cerca reescrita); `--grep "site agenda"`; `npm run test:site-sem-banco` | ✅ reescrever / ❌ |
| AGE-19 | Números do mês até hoje | unit + e2e (`@vazio-historico` serial) | `tests/unit/agenda-numeros.test.ts`; `--grep "agenda numeros"` | ❌ |
| AGE-20 | Pureza; centavos/milésimos; cancelar não apaga venda nem baixa | unit + migração | teste de pureza por leitura; `test:migracoes` (FK impede apagar uso com baixa, 23503) | ❌ Wave 0 |
| D-05 | "Agora no espaço" | unit + e2e (`@vazio-historico`) | `tests/unit/agenda-espaco.test.ts`; `--grep "inicio agenda de hoje"` | ✅ `inicio-saudacao.test.ts` estender / ❌ |
| Core Value | Presença de uma turma inteira no celular, um toque por pessoa | manual | roteiro de verificação humana (medir no celular) | — |
| Migração aplicada | `0026` em produção | saúde | `curl /api/health/agenda` (Roteiro 17) | ❌ |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/unit/agenda-*.test.ts` + `npx tsc --noEmit`
- **Per wave merge:** `npm run verificar`
- **Phase gate:** `npm run verificar` verde + **uma** varredura `npm run test:e2e` completa + `npm run test:site-sem-banco`, no último plano

### Wave 0 Gaps
- [ ] `tests/unit/agenda-semana.test.ts`, `agenda-horario.test.ts`, `agenda-turma.test.ts`
- [ ] `tests/unit/agenda-mensalidade.test.ts` — proporcional, vencimento, valor da aula (D-07)
- [ ] `tests/unit/agenda-uso-livre.test.ts` — horas cheias, valor, material, transições
- [ ] `tests/unit/agenda-reposicao.test.ts`, `agenda-presenca.test.ts`, `agenda-vagas.test.ts`
- [ ] `tests/unit/agenda-receber.test.ts`, `agenda-espaco.test.ts`, `agenda-numeros.test.ts`, `agenda-publico.test.ts`, `agenda-abas.test.ts`
- [ ] `tests/unit/agenda-paridade.test.ts` — uniões × `db/schema.ts` (enums novos e `destino_saida`)
- [ ] `tests/unit/financeiro-gravacao.test.ts` (se o escritor tiver parte pura) e `estoque-destinos.test.ts` atualizado
- [ ] `scripts/testar-migracoes.mjs` — `TABELAS_ESPERADAS` (+8) e `conferirAgenda`
- [ ] `tests/unit/site-isolamento.test.ts` — cerca reescrita com exceção nomeada
- [ ] `tests/e2e/apoio/semear-agenda.ts` (+ `agoraNoAtelie()`), `tests/e2e/agenda-*.spec.ts`; `casca.spec.ts` sem o placeholder

## Security Domain

### Applicable ASVS Categories (L1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | não (nada muda) | Auth.js existente |
| V3 Session Management | não | — |
| V4 Access Control | sim | `exigirUsuario()` na 1ª linha de toda ação de `lib/agenda/acoes.ts` e `lib/clientes/acoes.ts` (`npm run verificar-acoes`); páginas com `exigirUsuario()` na 1ª instrução; a consulta pública é a única leitura sem login e não seleciona pessoa; `revoke delete` nas tabelas que não se apagam |
| V5 Input Validation | sim | Zod no servidor: uuids; `"HH:MM"`; datas civis; inteiros com teto (semanas 1..52, vagas 1..999, pessoas 1..50, horas 1..12, dia 1..28); centavos pela função de `lib/financeiro/dinheiro.ts`; milésimos por `converterQuantidade`; textos com teto (nome 160, título 120, telefone 40); `origem` como união fechada |
| V6 Cryptography | não | — |
| V8 Data Protection | sim | Telefone e nome só na gestão; site sem pessoa; nenhum dado real em fixture/teste (repositório público) |
| V11 Business Logic | sim | Vínculo condicional sob trava (sem venda em dobro); crédito sob trava do cliente; idempotência pelo banco (D-02, datas de turma); valores e descrições da venda derivados no servidor; área decidida por `areaDoDestino` |

### Known Threat Patterns for este stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cliente forja valor/descrição/cliente da cobrança no "Lançar na Venda" | Tampering | `origem` resolvida no servidor; `pessoaNome`/`clienteId`/descrição sobrescritos sob trava; só valor e quantidade do carrinho são do gestor |
| Duas vendas para a mesma mensalidade (duplo toque, dois celulares) | Tampering | Trava + conferência "livre" na mesma transação (Pitfall 8) |
| Reposição além do crédito | Tampering | Trava `for no key update` do cliente + recálculo (Pitfall 7) |
| Nome/telefone de aluno vazando no site | Information Disclosure | Consulta pública sem coluna de pessoa; teste de forma do tipo; e2e "nenhum nome de cliente na raiz" |
| Motivo do dia fechado no site ("viagem", "queima grande") | Information Disclosure | Não selecionado; o site diz só "Fechado" |
| GET autenticado forjado disparando a mensalidade (D-02 no render) | CSRF | Escrita idempotente e igual à de abrir a tela; nada além disso no render |
| Destino `uso_livre` forjado na folha do Estoque | Tampering | `ehDestinoDaFolha` recusa; `check` do banco exige o vínculo |
| Função com `tx` exportada de arquivo `use server` | Elevation of Privilege | `gravacao.ts` sem a diretiva; `verificar-acoes` barra |
| Apagar uso livre/turma com histórico | Repudiation | `revoke delete`; FK sem `on delete`; remoção só sob trava e no estado permitido |
| Mensagem do banco na tela | Information Disclosure | Frase humana; SQLSTATE só no log via `codigoDoErroPostgres` |
| `/api/health/agenda` revelando volume | Information Disclosure | Corpo só `{ status }` (molde `health/producao`) |

## Sources

### Primary (HIGH confidence — lidos ou executados nesta sessão)
- `.planning/phases/05-agenda/{05-CONTEXT.md, BRIEFING.md, prototipo.html (inteiro, 371 linhas)}`; `.planning/REQUIREMENTS.md:149-168, 385-460`; `.planning/ROADMAP.md:722-755`; `.planning/STATE.md:1-120`; `.planning/phases/06.1-producao/06.1-RESEARCH.md`; `.planning/phases/04.6-*/{04.6-CONTEXT.md:101-116, BRIEFING-site.md:48-73, prototipo-gestao.html:155-219}`; `amassa-plataforma/02-MODELO-DE-DADOS.md:38-58, 138-146`
- `db/schema.ts:1-130, 575-975, 1485-1635`; `db/migrations/{0002:1-30, 0015:150-195, 0016:13-44, 0023:84-146, 0024:1-60, meta/_journal.json}`; `db/index.ts`; `db/migrate.ts`; `docker/{Dockerfile, compose.yml}`
- `lib/estoque/{destinos.ts, pedidos.ts:1-140, 233-273, gravacao.ts:1-290, acoes.ts:1-295, historico.ts:353-400, esquemas.ts:93-185}`; `lib/financeiro/{acoes.ts:1-325, 600-870, esquemas.ts:60-290, rascunho.ts:1-60, abas.ts, navegacao.ts, formato.ts, parcelas.ts:171-221, efeito-estoque.ts:1-120, mes.ts:1-40}`; `components/amassa/financeiro/painel-venda.tsx:1-620`
- `lib/cadastros/{abas.ts, acoes.ts:770-918}`; `app/gestao/(app)/cadastros/page.tsx:1-80`; `lib/orcamentos/acoes.ts:1180-1300`; `lib/producao/gravacao.ts:1-25`
- `lib/agenda/espaco.ts`; `app/gestao/(app)/agenda/page.tsx`; `components/amassa/inicio/{bloco-agenda-de-hoje.tsx, bloco-producao.tsx}`; `app/gestao/(app)/page.tsx`; `lib/inicio/textos.ts`; `lib/navegacao/itens.ts`
- `app/page.tsx`; `components/site/aulas-e-oficinas.tsx`; `lib/site/whatsapp.ts`; `conteudo/site.ts:60-145`; `tests/unit/site-isolamento.test.ts`; `scripts/testar-site-sem-banco.mjs:1-130`
- `scripts/{testar-migracoes.mjs:1-90, 4835-4908, verificar-acoes.mjs:1-60}`; `playwright.config.ts`; `tests/e2e/apoio/semear-financeiro.ts:150-178`; `tests/e2e/{inicio.spec.ts:60-100, casca.spec.ts:85-110}`; `tests/unit/{estoque-destinos.test.ts, producao-horas.test.ts:50-60}`; `app/api/health/producao/route.ts`; `next.config.ts`; `package.json`
- `node_modules/drizzle-orm/pg-core/dialect.js:40-80, 355-395` (migrador numa transação; `insert` lista todas as colunas; `insert().select()`)
- **Execução**: `postgres:17-alpine` (17.10) — `ADD VALUE` + `check` com literal na mesma transação → `unsafe use of new value`; com `::text` → passa e recusa o caso errado
- `node_modules/next/dist/docs/01-app/{02-guides/data-security.md:567-601, 02-guides/incremental-static-regeneration.md, 02-guides/caching-without-cache-components.md:78-170, 03-api-reference/04-functions/revalidatePath.md, 03-api-reference/03-file-conventions/02-route-segment-config/index.md}` (documentação do Next 16.3.5 embarcada)

### Secondary (MEDIUM)
- Nenhuma busca na web foi necessária: as perguntas de framework foram respondidas pela documentação embarcada da versão instalada.

### Tertiary (LOW)
- O texto exato que o `drizzle-kit 0.31.10` gera para o valor novo do enum (Assumption A1) — conferir no arquivo gerado.

## Metadata

**Confidence breakdown:**
- Integração (perguntas 1-13): HIGH — cada afirmação com arquivo e linha lidos nesta sessão.
- Migração: HIGH na mecânica (migrador lido; enum reproduzido no Postgres 17.10); MEDIUM no texto gerado pelo `drizzle-kit` (A1).
- Site/ISR e efeitos no render: HIGH (documentação da versão instalada); MEDIUM na escolha "queda para o estado sem Agenda" (A10).
- Modelo de dados e `lib/agenda/`: MEDIUM — desenho desta pesquisa dentro do "Claude's Discretion", fiel ao protótipo e ao briefing.
- Open Questions: LOW até o dono responder.

**Research date:** 2026-10-01
**Valid until:** 2026-10-31 (código estável; revalidar se `lib/financeiro/acoes.ts`, `lib/estoque/gravacao.ts`,
`components/amassa/financeiro/painel-venda.tsx` ou `app/page.tsx` mudarem antes do planejamento)

# Roteiro 6 — Migração da Espera dos Marcos em produção

Este roteiro leva o banco de produção de "marcos com interruptor liga/desliga" a "marcos que
sempre acontecem, sempre duram 1 dia, com um número de espera antes deles" — a mudança de
modelo da Fase 04.1, nascida da caminhada do dono em produção em 2026-08-20.

**O que este roteiro faz:** aplica a migração `0009_espera-dos-marcos.sql`, já commitada e
provada contra o banco de teste efêmero por `npm run test:migracoes` (parte de `npm run
verificar`) e pela suíte ponta a ponta inteira da fase (`04.1-04-PLAN.md`, Tarefa 1).

**O que este roteiro NÃO faz, e por quê:** ele não roda sozinho, nunca é disparado pelo
pipeline, e não pula o backup. `CLAUDE.md` é explícito — *"Migrações: aplicadas à mão, depois de
um backup, por alguém que está olhando. Nunca pelo pipeline automático."* Uma migração ruim
aplicada por um `git push` acidental não tem desfazer, e o banco passa a ser dela.

**Diferença deste roteiro em relação aos Roteiros 4 e 5:** esta é a primeira migração do
repositório que faz `ALTER TABLE` sobre uma tabela que já pode ter dado real (`encomenda_etapas`)
— os Roteiros 4 e 5 criavam tabelas novas, vazias por definição. D-10 (`04.1-CONTEXT.md`) afirma
que hoje só existem dados de teste em produção, mas essa afirmação é **conferida antes de rodar
qualquer coisa**, inclusive antes do backup — é o Passo 1, não uma nota de rodapé.

**Como ler cada passo:** o mesmo formato dos roteiros anteriores — cada bloco de comando vem
acompanhado de **o que faz** e **o que você deve ver** de volta. Se a tela divergir muito do
descrito, **pare naquele passo** e não siga para o próximo.

Os marcadores entre `<` e `>` saem junto com o valor. Este roteiro não introduz nenhum marcador
novo: os comandos abaixo já usam os nomes fixos de sempre (`amassa_owner`, `amassa_app`,
`amassa`) e não pedem IP nem senha real em nenhum lugar.

Os comandos rodam todos **no servidor**, na sessão SSH como `theo`. Use `docker compose run --rm
ferramentas`, **nunca** `docker compose exec app` — a imagem `app` não tem `drizzle-kit`, `tsx`
nem a pasta `db/`, de propósito.

---

## 1. A guarda de D-10, antes de qualquer coisa

D-10 afirma que só existem dados de teste em produção. Barato de conferir, caro de errar —
confira antes de tocar em qualquer coisa, inclusive antes do backup:

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select count(*) as encomendas from encomendas; select count(*) as etapas from encomenda_etapas;"
```

**O que você deve ver:** duas contagens. Se algum nome ou cliente que você reconheça como real
aparecer numa consulta seguinte (`select nome, cliente from encomendas limit 20;`, se quiser
olhar antes de decidir), **pare aqui** e volte com o número — a migração passaria a precisar de
um plano de conversão de dados que esta fase não tem. Se as linhas forem só dado de teste
(`[e2e]`, nomes inventados), siga para o Passo 2.

---

## 2. Backup

Nenhuma migração deste projeto roda sem um backup imediatamente antes.

```bash
cd /opt/amassa
./scripts/backup.sh --agora
```

**O que faz:** dispara o mesmo script que o `cron` roda sozinho todo dia às 3h15 de Brasília —
dump completo, comprimido, gravado localmente e enviado para o Drive do ateliê.

**O que você deve ver:** nenhuma saída — sucesso silencioso. Confira com `echo $?` se quiser ter
certeza (`0` é sucesso).

Confira que o dump é recente, pelo domínio público:

```bash
curl -s https://amassacerrado.com.br/api/health/backup
```

**O que você deve ver:** um corpo com `"status":"ok"` e `"idadeEmHoras"` próximo de `0` — o
backup que você acabou de disparar. Se `status` vier diferente de `ok`, **pare aqui** e resolva
o backup antes de seguir (`docs/operacao/03-backup-e-restauracao.md`). **Não siga para o Passo 3
sem isso.**

---

## 3. Conferir o que vai ser aplicado, antes de aplicar

```bash
docker compose pull ferramentas
docker compose run --rm ferramentas ls db/migrations
docker compose run --rm ferramentas cat db/migrations/0009_espera-dos-marcos.sql
```

**O que você deve ver:** a lista de migrações termina em `0009_espera-dos-marcos.sql`. O
conteúdo é este SQL, na íntegra — cinco instruções, todas sobre `encomenda_etapas`:

```sql
ALTER TABLE "encomenda_etapas" DROP CONSTRAINT "marcos_zero_ou_um";--> statement-breakpoint
ALTER TABLE "encomenda_etapas" ADD COLUMN "espera_dias" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "encomenda_etapas" ADD CONSTRAINT "marcos_sempre_um_dia" CHECK ("encomenda_etapas"."etapa" not in ('queima1','queima2','entrega') or "encomenda_etapas"."dias" = 1);--> statement-breakpoint
ALTER TABLE "encomenda_etapas" ADD CONSTRAINT "encomenda_etapas_espera_no_intervalo" CHECK ("encomenda_etapas"."espera_dias" >= 0 and "encomenda_etapas"."espera_dias" <= 365);--> statement-breakpoint
ALTER TABLE "encomenda_etapas" ADD CONSTRAINT "espera_so_em_marco" CHECK ("encomenda_etapas"."etapa" in ('queima1','queima2','entrega') or "encomenda_etapas"."espera_dias" = 0);
```

Em ordem: derruba a restrição antiga do interruptor (`marcos_zero_ou_um`); acrescenta a coluna
`espera_dias` (padrão `0`, nunca nulo — linhas existentes recebem `0` automaticamente, sem
espera); recria a defesa dos marcos como `marcos_sempre_um_dia` (`dias = 1` sempre, para os três
marcos, no lugar de `dias in (0, 1)`); e acrescenta duas restrições novas — o teto de 365 dias na
espera, e a garantia de que só um marco pode ter espera diferente de zero.

**Nada apaga dado.** As linhas existentes (dado de teste, conferido no Passo 1) ganham
`espera_dias = 0` automaticamente; nenhuma linha é removida.

---

## 4. Aplicar

```bash
docker compose run --rm ferramentas npm run db:migrate
```

**O que você deve ver:** `Migrações aplicadas com sucesso.`, saindo com código `0`. Seguro rodar
mais de uma vez — o Drizzle pula o que já foi aplicado.

---

## 5. Conferir de fora, não pelo relato do comando

**A coluna `espera_dias` existe, `not null`, padrão `0`:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select column_name, data_type, is_nullable, column_default from information_schema.columns where table_name = 'encomenda_etapas' and column_name = 'espera_dias';"
```

**O que você deve ver:** uma linha — `espera_dias | integer | NO | 0`.

**As três restrições existem, com os nomes exatos:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select conname from pg_constraint where conname in ('marcos_sempre_um_dia', 'encomenda_etapas_espera_no_intervalo', 'espera_so_em_marco') order by conname;"
```

**O que você deve ver:** três linhas, os três nomes.

**A restrição de marco REJEITA um insert inválido** — a prova de que não é só um nome em
`pg_constraint`, mas está de fato bloqueando dado impossível. Grava uma encomenda de teste
inventada (nunca nome ou cliente real) e um marco (`queima1`) com `dias = 2` — fora do `dias = 1`
que `marcos_sempre_um_dia` exige — dentro de uma transação com `rollback`:

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "
begin;
with e as (
  insert into encomendas (nome, data_inicio) values ('[roteiro-06] teste de restrição', current_date) returning id
)
insert into encomenda_etapas (encomenda_id, etapa, dias, espera_dias, ordem)
select id, 'queima1', 2, 0, 0 from e;
rollback;
"
```

**O que você deve ver:** a instrução falha com uma mensagem citando `marcos_sempre_um_dia` (algo
como `ERROR: new row for relation "encomenda_etapas" violates check constraint
"marcos_sempre_um_dia"`). O `rollback` desfaz tudo — nenhuma linha de teste sobra no banco. Se a
instrução **não** falhar, **pare aqui** — a restrição não está valendo.

---

## 6. Conferir a aplicação

No navegador, pelo domínio público:

- [ ] Crie uma encomenda nova com data de início hoje, sem editar nenhuma etapa. O rodapé da
      trilha mostra **"Duração total: 32 dias"** (5 produção + 15 secagem + 1 + 1 + 1 + 1 marcos
      + 0 + 3 + 5 esperas).
- [ ] No Gantt (desktop) ou na trilha/barra (celular), existe um **vão vazio** — espaço em
      branco, sem cor nem hachura — antes do losango da Queima do esmalte (3 dias) e antes do
      losango da Entrega (5 dias).

---

Isto encerra a migração de produção da Fase 04.1. A partir daqui, o modelo de marcos sem
interruptor está em uso real no ateliê, com as mesmas garantias que o banco de teste já provou —
coluna, restrições e rejeição de dado inválido conferidas de fora, não pelo relato de um comando.

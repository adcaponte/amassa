# Roteiro 7 — Migração da Abertura do Espaço em produção

Este roteiro leva o banco de produção de "sem o módulo Abertura do Espaço" a "com as três
tabelas do módulo" — `abertura_itens`, `abertura_tarefas` e `abertura_configuracao` —, os três
tipos de enum que elas usam e os três gatilhos `tocar_atualizado_em_*` que mantêm
`atualizado_em` correto sozinho.

**O que este roteiro faz:** aplica as migrações `0010_abertura-do-espaco.sql` e
`0011_gatilhos-abertura.sql`, já commitadas e provadas contra o banco de teste efêmero por
`npm run test:migracoes` (parte de `npm run verificar`) e pela suíte ponta a ponta da fase
(`04.2-05-PLAN.md`, Tarefa 2).

**Diferença deste roteiro em relação ao Roteiro 6:** estas duas migrações **criam tabelas
novas**, vazias por definição — a mesma situação dos Roteiros 4 e 5, não a do 6. Não há dado
preexistente a converter, então não existe guarda de "isso parece dado real?" a fazer antes.

**O que este roteiro NÃO faz, e por quê:** ele não roda sozinho, nunca é disparado pelo
pipeline, e não pula o backup. `CLAUDE.md` é explícito — *"Migrações: aplicadas à mão, depois de
um backup, por alguém que está olhando. Nunca pelo pipeline automático."* Uma migração ruim
aplicada por um `git push` acidental não tem desfazer, e o banco passa a ser dela.

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

## 1. Backup, antes de qualquer coisa

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
o backup antes de seguir (`docs/operacao/03-backup-e-restauracao.md`). **Não siga para o Passo 2
sem isso.**

---

## 2. Conferir o que vai ser aplicado, antes de aplicar

```bash
docker compose pull ferramentas
docker compose run --rm ferramentas ls db/migrations
```

**O que você deve ver:** a lista de migrações termina em `0011_gatilhos-abertura.sql`, com
`0010_abertura-do-espaco.sql` logo antes — as duas únicas que este roteiro aplica.

```bash
docker compose run --rm ferramentas cat db/migrations/0010_abertura-do-espaco.sql
docker compose run --rm ferramentas cat db/migrations/0011_gatilhos-abertura.sql
```

**O que você deve ver:** a primeira cria os três tipos de enum (`categoria_item_abertura`,
`forma_pagamento_abertura`, `grupo_tarefa_abertura`) e as três tabelas (`abertura_itens`,
`abertura_tarefas`, `abertura_configuracao`), com os `check` de nome/valor/parcelas e a chave
estrangeira de `abertura_tarefas` para `abertura_itens` (`on delete set null` — D-14: remover um
item não apaga a tarefa ligada); a segunda liga as três tabelas ao gatilho
`tocar_atualizado_em()` que já existe desde a migração `0002`. **Nenhuma das duas altera ou
apaga nada que já existe** — só criam tabela, tipo e gatilho novos.

---

## 3. Aplicar

Pelo serviço `ferramentas`, nunca por `docker compose exec app` (a imagem `app` não tem
`drizzle-kit`, `tsx` nem a pasta `db/`, de propósito):

```bash
docker compose run --rm ferramentas npm run db:migrate
```

**O que você deve ver:** `Migrações aplicadas com sucesso.`, saindo com código `0`. Seguro rodar
mais de uma vez — o Drizzle pula o que já foi aplicado.

> Não espere uma lista de migrações — o `migrate()` do Drizzle é silencioso, e a mensagem de
> sucesso **não prova o que foi aplicado**. As conferências do próximo passo é que provam.

---

## 4. Conferir de fora, não pelo relato do comando

**As três tabelas existem:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c '\dt'
```

**O que você deve ver:** as tabelas de sempre mais as três novas — `abertura_itens`,
`abertura_tarefas`, `abertura_configuracao`.

**Os três gatilhos estão ligados:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select event_object_table, trigger_name from information_schema.triggers where trigger_name like 'tocar_atualizado_em_abertura%' order by event_object_table;"
```

**O que você deve ver:** três linhas — `tocar_atualizado_em_abertura_itens`,
`tocar_atualizado_em_abertura_tarefas`, `tocar_atualizado_em_abertura_configuracao`.

**Um `check` recusa um insert inválido** — a prova de que a restrição não é só um nome em
`pg_constraint`, mas está de fato bloqueando dado impossível. Grava um item de teste inventado
(nunca nome real) à vista com duas parcelas — fora do que `abertura_itens_vista_uma_parcela`
permite — dentro de uma transação com `rollback`:

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "
begin;
insert into abertura_itens (nome, categoria, valor_centavos, forma_pagamento, parcelas, primeira_parcela_em)
values ('[roteiro-07] teste de restrição', 'outros', 100, 'vista', 2, current_date);
rollback;
"
```

**O que você deve ver:** a instrução falha com uma mensagem citando
`abertura_itens_vista_uma_parcela` (algo como `ERROR: new row for relation "abertura_itens"
violates check constraint "abertura_itens_vista_uma_parcela"`). O `rollback` desfaz tudo —
nenhuma linha de teste sobra no banco. Se a instrução **não** falhar, **pare aqui** — a
restrição não está valendo.

**`amassa_app` enxerga as três tabelas novas** (o `alter default privileges` da migração `0003`
deveria ter dado a ele `select`/`insert`/`update`/`delete` automaticamente, sem grant adicional):

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select grantee, table_name, privilege_type from information_schema.role_table_grants where grantee = 'amassa_app' and table_name in ('abertura_itens', 'abertura_tarefas', 'abertura_configuracao') order by table_name, privilege_type;"
```

**O que você deve ver:** doze linhas — as três tabelas, cada uma com as quatro linhas
`DELETE`/`INSERT`/`SELECT`/`UPDATE` para `amassa_app`. Se alguma faltar, o passo 4 da migração
`0003` não estava em vigor quando `0010` rodou — investigue antes de seguir; a aplicação vai
falhar silenciosamente na primeira tentativa de gravar um item ou uma tarefa.

---

## 5. Conferir a aplicação

No navegador, pelo domínio público:

- [ ] Entre no sistema e abra **Abertura do Espaço** pelo menu do usuário (`/abertura`).
- [ ] Cadastre um item de teste (nome curto, inventado) e confirme que ele aparece na lista.
- [ ] Remova o item de teste — a confirmação nomeia o item e o valor, e o remove sem deixar
      resíduo.

---

## Lembrete: este módulo tem data de morte

`Abertura do Espaço` é um módulo temporário (D-01/ABE-15). A remoção dele — tabelas, código,
rota e item de menu — já está escrita e provada desde a Fase 4.2, em `db/remocao/` e no
**Roteiro 8** (`docs/operacao/08-remover-abertura-do-espaco.md`). Este roteiro (7) só cria o
módulo; o dia de apagá-lo é o do Roteiro 8, não este.

Isto encerra a migração de produção da Fase 4.2. A partir daqui, o módulo Abertura do Espaço
está em uso real no ateliê, com as mesmas garantias que o banco de teste já provou — tabela,
tipo, gatilho e recusa de dado inválido conferidos de fora, não pelo relato de um comando.

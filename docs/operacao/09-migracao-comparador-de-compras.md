# Roteiro 9 — Migração do Comparador de Compras em produção

Este roteiro leva o banco de produção de "sem o Comparador de Compras" a "com as duas tabelas do
módulo" — `cotacao_categorias` e `cotacoes` — o tipo de enum `situacao_cotacao` que a segunda usa
e os dois gatilhos `tocar_atualizado_em_*` que mantêm `atualizado_em` correto sozinho.

**O que este roteiro faz:** aplica as migrações `0012_comparador-de-compras.sql` e
`0013_gatilhos-comparador.sql`, já commitadas e provadas contra o banco de teste efêmero por
`npm run test:migracoes` (parte de `npm run verificar`) e pela suíte ponta a ponta completa da
fase (`04.3-05-PLAN.md`, Tarefa 2).

**Diferença deste roteiro em relação ao Roteiro 6:** estas duas migrações **criam tabelas
novas**, vazias por definição — a mesma situação dos Roteiros 4, 5 e 7, não a do 6. Não há dado
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
`amassa`) e não pedem IP nem senha real em nenhum lugar. Nos dados de teste digitados na
conferência (passos 5 e 6), use nomes inventados — nenhum fornecedor real.

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

**O que você deve ver:** a lista de migrações termina em `0013_gatilhos-comparador.sql`, com
`0012_comparador-de-compras.sql` logo antes — as duas únicas que este roteiro aplica.

```bash
docker compose run --rm ferramentas cat db/migrations/0012_comparador-de-compras.sql
docker compose run --rm ferramentas cat db/migrations/0013_gatilhos-comparador.sql
```

**O que você deve ver:** a primeira cria o tipo de enum `situacao_cotacao` (`cotando`,
`favorito`, `descartado`) e as duas tabelas (`cotacao_categorias`, `cotacoes`), com os `check` de
comprimento de nome/empresa/produto/campos longos, o `check` de faixa do preço, a chave
estrangeira de `cotacoes` para `cotacao_categorias` (`on delete cascade` — remover uma categoria
remove as cotações dela, D-15) e os dois índices; a segunda liga as duas tabelas ao gatilho
`tocar_atualizado_em()` que já existe desde a migração `0002`. **Nenhuma das duas altera ou
apaga nada que já existe** — só criam tabela, tipo, índice e gatilho novos.

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

**As duas tabelas existem:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c '\dt'
```

**O que você deve ver:** as tabelas de sempre mais as duas novas — `cotacao_categorias` e
`cotacoes`.

**Os dois gatilhos estão ligados:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select event_object_table, trigger_name from information_schema.triggers where trigger_name like 'tocar_atualizado_em_cotac%' order by event_object_table;"
```

**O que você deve ver:** duas linhas — `tocar_atualizado_em_cotacao_categorias` e
`tocar_atualizado_em_cotacoes`.

**O tipo de enum existe:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select typname from pg_type where typname = 'situacao_cotacao';"
```

**O que você deve ver:** uma linha, `situacao_cotacao`.

**Um `check` recusa um insert inválido** — a prova de que a restrição não é só um nome em
`pg_constraint`, mas está de fato bloqueando dado impossível. Cria uma categoria de teste
(nome inventado) e tenta gravar nela uma cotação com preço acima do teto de dez milhões de
reais — fora do que `cotacoes_preco_no_intervalo` permite — dentro de uma transação com
`rollback`:

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "
begin;
insert into cotacao_categorias (nome) values ('[roteiro-09] teste de restrição') \gset teste_
insert into cotacoes (categoria_id, empresa, preco_centavos)
values ((select id from cotacao_categorias where nome = '[roteiro-09] teste de restrição'), '[roteiro-09] fornecedor teste', 1000000001);
rollback;
"
```

**O que você deve ver:** a segunda instrução falha com uma mensagem citando
`cotacoes_preco_no_intervalo` (algo como `ERROR: new row for relation "cotacoes" violates check
constraint "cotacoes_preco_no_intervalo"`). O `rollback` desfaz tudo — nenhuma linha de teste
sobra no banco. Se a instrução **não** falhar, **pare aqui** — a restrição não está valendo.

**`amassa_app` enxerga as duas tabelas novas** (o `alter default privileges` da migração `0003`
deveria ter dado a ele `select`/`insert`/`update`/`delete` automaticamente, sem grant adicional):

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select grantee, table_name, privilege_type from information_schema.role_table_grants where grantee = 'amassa_app' and table_name in ('cotacao_categorias', 'cotacoes') order by table_name, privilege_type;"
```

**O que você deve ver:** oito linhas — as duas tabelas, cada uma com as quatro linhas
`DELETE`/`INSERT`/`SELECT`/`UPDATE` para `amassa_app`. Se alguma faltar, o passo 4 da migração
`0003` não estava em vigor quando `0012` rodou — investigue antes de seguir; a aplicação vai
falhar silenciosamente na primeira tentativa de gravar uma categoria ou uma cotação.

---

## 5. Conferir a aplicação

No navegador, pelo domínio público:

- [ ] Entre no sistema e abra **Abertura do Espaço** pelo menu do usuário (`/abertura`).
- [ ] Abra a aba **Cotações**.
- [ ] Crie uma categoria de teste (nome curto, inventado) e, dentro dela, uma cotação de teste
      (empresa inventada, com preço).
- [ ] Remova a cotação e depois a categoria de teste — as duas confirmações nomeiam o que se
      perde e não deixam resíduo.

---

## Lembrete: estas tabelas não têm data de morte

Diferente do Roteiro 7, este módulo **não** é temporário. `Abertura do Espaço` tem data de
morte conhecida (D-01/ABE-15) e sai do sistema no dia da inauguração — o **Roteiro 8**
(`docs/operacao/08-remover-abertura-do-espaco.md`) já cobre o procedimento. As duas tabelas do
Comparador de Compras e o tipo `situacao_cotacao`, ao contrário, **ficam no banco** quando a
Abertura for desmontada — a decisão do dono foi **arquivar, não apagar** (D-03,
`.planning/phases/04.3-comparador-de-compras/04.3-CONTEXT.md`): o que sai naquele dia é a
interface do comparador (a aba, o código e a rota), nunca o dado. `npm run test:migracoes`
(`conferirRemocaoDoModuloAbertura`) prova essa sobrevivência com dado real desde o plano 01 desta
fase.

**Atualização de 2026-09-18:** o dono estendeu essa mesma decisão ao módulo Abertura inteiro —
quando a Abertura for desmontada, **nenhuma** tabela é apagada, nem as três da Abertura nem as
duas do comparador. As três tabelas da Abertura (`abertura_itens`, `abertura_tarefas`,
`abertura_configuracao`), que este roteiro não cria, também passam a ser arquivadas no dia da
inauguração, não apagadas. Reescrever o Roteiro 8 e a SQL de remoção (`db/remocao/`) para
refletir essa decisão é tarefa separada, ainda não feita — ver o aviso no topo do Roteiro 8. Isto
não muda nada do que este roteiro (9) faz: ele só cria tabelas novas e vazias.

Isto encerra a migração de produção da Fase 4.3. A partir daqui, o Comparador de Compras está em
uso real no ateliê, com as mesmas garantias que o banco de teste já provou — tabela, tipo,
gatilho e recusa de dado inválido conferidos de fora, não pelo relato de um comando.

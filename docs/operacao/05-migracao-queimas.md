# Roteiro 5 — Migração do Contador de Queima (Fornos) em produção

Este roteiro leva o banco de produção de "com Encomendas" (`encomendas`, `encomenda_itens`,
`encomenda_etapas`) a "com as três tabelas do módulo de Fornos" — `fornos`, `queimas` e
`manutencoes` —, mais o tipo `tipo_queima` e os três gatilhos `tocar_atualizado_em_*` que mantêm
`atualizado_em` correto sozinho nas tabelas novas.

**O que este roteiro faz:** aplica as migrações `0007_queimas.sql` e
`0008_gatilhos-queimas.sql`, já commitadas e provadas contra o banco de teste efêmero por
`npm run test:migracoes` (parte de `npm run verificar`) e pela suíte ponta a ponta inteira da
fase (`04-07-PLAN.md`, Tarefa 1).

**O que este roteiro NÃO faz, e por quê:** ele não roda sozinho, nunca é disparado pelo
pipeline, e não pula o backup. `CLAUDE.md` é explícito — *"Migrações: aplicadas à mão, depois de
um backup, por alguém que está olhando. Nunca pelo pipeline automático."* Uma migração ruim
aplicada por um `git push` acidental não tem desfazer, e o banco passa a ser dela.

**Como ler cada passo:** o mesmo formato do Roteiro 4 — cada bloco de comando vem acompanhado de
**o que faz** e **o que você deve ver** de volta. Se a tela divergir muito do descrito, **pare
naquele passo** e não siga para o próximo — é assim que um problema fica localizável onde
aconteceu, em vez de aparecer três passos depois sem explicação.

Os marcadores entre `<` e `>` saem junto com o valor. Este roteiro não introduz nenhum marcador
novo: os comandos abaixo já usam os nomes fixos de sempre (`amassa_owner`, `amassa_app`,
`amassa`) e não pedem IP nem senha real em nenhum lugar.

Os comandos rodam todos **no servidor**, na sessão SSH como `theo` — o mesmo padrão dos roteiros
anteriores. Use `docker compose run --rm ferramentas`, **nunca** `docker compose exec app` — a
imagem `app` não tem `drizzle-kit`, `tsx` nem a pasta `db/`, de propósito.

---

## 1. Backup primeiro, sempre

Nenhuma migração deste projeto roda sem um backup imediatamente antes.

```bash
cd /opt/amassa
./scripts/backup.sh --agora
```

**O que faz:** dispara o mesmo script que o `cron` roda sozinho todo dia às 3h15 de Brasília —
dump completo, comprimido, gravado localmente e enviado para o Drive do ateliê.

**O que você deve ver:** nenhuma saída — sucesso silencioso, o mesmo comportamento de sempre.
Confira com `echo $?` se quiser ter certeza (`0` é sucesso).

Confira que o dump é recente, pelo domínio público:

```powershell
curl.exe https://amassacerrado.com.br/api/health/backup
```

**O que você deve ver:** um corpo com `"status":"ok"` e `"idadeEmHoras"` próximo de `0` — o
backup que você acabou de disparar, não um antigo. Se `status` vier diferente de `ok`, **pare
aqui** e resolva o backup antes de seguir (`docs/operacao/03-backup-e-restauracao.md`, seção
"Perguntas que você vai fazer às três da manhã"). **Não siga para o passo 2 sem isso.**

---

## 2. Conferir que o servidor já está com o compose.yml e a imagem certos

Desde a correção registrada em `WINDOWS.md` (ids 13/14, Fase 3), o job `implantar` do pipeline já
ressincroniza `docker/compose.yml` para o servidor e já puxa a imagem `:ferramentas` junto com
`:app` a cada deploy — os dois artefatos que antes envelheciam em silêncio. Ainda assim, confirme
antes de migrar, porque este roteiro não confia no relato de outro processo:

```bash
docker compose pull ferramentas
```

**O que você deve ver:** `Image is up to date` (o pipeline já puxou) ou as camadas baixando
agora, terminando em `Pulled`. Qualquer um dos dois é aceitável — o segundo só significa que o
pull automático ainda não tinha rodado por algum motivo.

Liste as migrações que a imagem carrega, e confirme que as duas novas estão lá:

```bash
docker compose run --rm ferramentas ls db/migrations
```

**O que você deve ver:** uma lista de arquivos `.sql` numerados, incluindo `0007_queimas.sql` e
`0008_gatilhos-queimas.sql` no fim — as únicas duas que este roteiro aplica.

Leia o conteúdo de cada uma antes de seguir:

```bash
docker compose run --rm ferramentas cat db/migrations/0007_queimas.sql
docker compose run --rm ferramentas cat db/migrations/0008_gatilhos-queimas.sql
```

**O que você deve ver:** a primeira cria o tipo `tipo_queima` (`biscoito`, `esmalte`, `ouro`) e
as três tabelas (`fornos`, `queimas`, `manutencoes`), com as restrições
`fornos_nome_comprimento`, `fornos_limite_minimo` e
`manutencoes_queimas_acumuladas_nao_negativo`; a segunda liga as três tabelas ao gatilho
`tocar_atualizado_em()` que já existe desde a migração `0002`. Nenhuma das duas altera ou apaga
nada que já existe.

---

## 3. Aplicar

```bash
docker compose run --rm ferramentas npm run db:migrate
```

**O que você deve ver:** uma única linha, `Migrações aplicadas com sucesso.`, saindo com código
`0`, e a saída deve citar `0007_queimas` e `0008_gatilhos-queimas` (ou nenhum erro visível — o
Drizzle não lista o que aplicou, só reclama se algo falhar). É seguro rodar mais de uma vez — o
Drizzle pula o que já foi aplicado.

> Não espere uma lista de migrações — o `migrate()` do Drizzle é silencioso quando dá certo, e a
> mensagem de sucesso **não prova o que foi aplicado**. As conferências do próximo passo é que
> provam.

---

## 4. Conferir de fora, não pelo relato do comando

**As três tabelas existem:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c '\dt'
```

**O que você deve ver:** as tabelas de sempre mais as três novas — `fornos`, `queimas`,
`manutencoes`.

**O tipo `tipo_queima` tem exatamente os três valores:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select enumlabel from pg_enum where enumtypid = 'tipo_queima'::regtype order by enumsortorder;"
```

**O que você deve ver:** três linhas — `biscoito`, `esmalte`, `ouro`, nesta ordem.

**Os três gatilhos existem:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select event_object_table, trigger_name from information_schema.triggers where trigger_name like 'tocar_atualizado_em%' order by event_object_table;"
```

**O que você deve ver:** entre as linhas devolvidas, as três novas —
`tocar_atualizado_em_fornos`, `tocar_atualizado_em_manutencoes`, `tocar_atualizado_em_queimas`
(mais as que já existiam de `usuarios`/`execucoes_backup`/`encomendas`/etc.).

**A restrição `fornos_limite_minimo` existe e bloqueia dado impossível** — a prova de que a
restrição não é só um nome em `pg_constraint`, mas está de fato recusando um limite abaixo de 10.
Isto grava um forno de teste inventado (nunca um nome real do ateliê) com `limite = 5` — fora do
mínimo — e espera o Postgres recusar:

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "
begin;
insert into fornos (nome, limite) values ('[roteiro-05] teste de restrição', 5);
rollback;
"
```

**O que você deve ver:** a instrução falha com uma mensagem citando `fornos_limite_minimo`
(algo como `ERROR: new row for relation "fornos" violates check constraint
"fornos_limite_minimo"`). O `rollback` no fim desfaz tudo — nenhuma linha de teste sobra no
banco. Se a instrução **não** falhar, **pare aqui** — a restrição não está valendo.

---

## 5. Conferir os grants

O `alter default privileges` da migração `0003` deveria ter dado ao papel `amassa_app`
`select`/`insert`/`update`/`delete` nas três tabelas novas automaticamente, sem grant adicional —
este passo é o que prova isso, em vez de confiar que funcionou:

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select grantee, table_name, privilege_type from information_schema.role_table_grants where grantee = 'amassa_app' and table_name in ('fornos', 'queimas', 'manutencoes') order by table_name, privilege_type;"
```

**O que você deve ver:** doze linhas — as três tabelas, cada uma com as quatro linhas
`DELETE`/`INSERT`/`SELECT`/`UPDATE` para `amassa_app`. Se alguma faltar, investigue antes de
seguir; a aplicação vai falhar silenciosamente na primeira tentativa de registrar uma queima.

---

## 6. Provar o gatilho de verdade, com uma alteração real de linha

Um gatilho ausente não quebra nada visível — só congela `atualizado_em` no valor de criação para
sempre, em silêncio. Este passo prova que ele está vivo, não apenas declarado, usando a própria
interface (nunca SQL direto — é o caminho que a aplicação de verdade usa):

1. Abra `https://amassacerrado.com.br/queimas` em produção e cadastre um forno de teste (nome
   claramente marcado, ex.: `[roteiro-05] forno de teste`).
2. Pelo menu **⋮ Mais ações → Editar forno**, mude o nome ou a descrição e salve.
3. Confira `atualizado_em` daquela linha antes e depois pelo `psql`:

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select nome, criado_em, atualizado_em from fornos where nome like '[roteiro-05]%' order by criado_em desc limit 1;"
```

**O que você deve ver:** `atualizado_em` mais recente que `criado_em` — o gatilho tocou a coluna
sozinho, sem que a aplicação tenha mencionado esse campo em nenhum lugar do seu código.

---

## 7. Fluxo funcional em produção — registrar e desfazer uma queima

Confirma que o caminho mais usado do sistema inteiro funciona de ponta a ponta contra o banco
real:

1. No cartão do forno de teste, toque **Queimar** e escolha um tipo — o contador deve subir na
   hora, sem nenhum indicador de carregamento entre os dois toques.
2. No aviso "Queima registrada.", toque **Desfazer** dentro dos 7 segundos.

**O que você deve ver:** o contador sobe ao registrar e volta ao valor anterior ao desfazer — a
prova de que a Server Action grava e remove no banco de produção de verdade, não num estado
otimista de tela.

Ao final, decida se mantém ou desativa o forno de teste — desativar (nunca excluir: a aplicação
não oferece exclusão de forno, por desenho, FOR-11) é a limpeza recomendada, pelo mesmo menu
**⋮ Mais ações**.

---

Isto encerra a aplicação da migração de Fornos. Os nove critérios de sucesso da Fase 4 e os três
backstops do UI-SPEC são percorridos item a item, com o resultado escrito, em
`.planning/phases/04-contador-de-queima/04-VERIFICACAO-HUMANA.md` — este roteiro só cobre a
migração e a prova técnica de que ela pegou; a verificação de produto é o documento separado.

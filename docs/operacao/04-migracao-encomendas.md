# Roteiro 4 — Migração das Encomendas em produção

Este roteiro leva o banco de produção de "só a fundação da Fase 2a" (`usuarios`,
`execucoes_backup`) a "com as três tabelas do módulo de Encomendas" — `encomendas`,
`encomenda_itens` e `encomenda_etapas`, mais os três gatilhos `tocar_atualizado_em_*` que
mantêm `atualizado_em` correto sozinho.

**O que este roteiro faz:** aplica as migrações `0005_encomendas.sql` e
`0006_gatilhos-encomendas.sql`, já commitadas e provadas contra o banco de teste efêmero por
toda a suíte ponta a ponta da fase.

**O que este roteiro NÃO faz, e por quê:** ele não roda sozinho, nunca é disparado pelo
pipeline, e não pula o backup. `CLAUDE.md` é explícito — *"Migrações: aplicadas à mão, depois de
um backup, por alguém que está olhando. Nunca pelo pipeline automático."* Uma migração ruim
aplicada por um `git push` acidental não tem desfazer, e o banco passa a ser dela.

**Como ler cada passo:** o mesmo formato dos três roteiros anteriores — cada bloco de comando
vem acompanhado de **o que faz** e **o que você deve ver** de volta. Se a tela divergir muito do
descrito, **pare naquele passo** e não siga para o próximo — é assim que um problema fica
localizável onde aconteceu, em vez de aparecer três passos depois sem explicação.

**Os marcadores entre `<` e `>` saem junto com o valor** — a mesma regra dos roteiros 1 a 3.
Este roteiro não introduz nenhum marcador novo: os comandos abaixo já usam os nomes fixos de
sempre (`amassa_owner`, `amassa_app`, `amassa`) e não pedem IP nem senha real em nenhum lugar.

Os comandos rodam todos **no servidor**, na sessão SSH como `theo` — o mesmo padrão dos roteiros
2 e 3.

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

Confira que o dump é recente, pelo domínio público — ainda na mesma sessão SSH, em `bash`
(`curl.exe` é a forma do PowerShell, na sua máquina local; não existe no servidor Linux):

```bash
curl -s https://amassacerrado.com.br/api/health/backup
```

**O que você deve ver:** um corpo com `"status":"ok"` e `"idadeEmHoras"` próximo de `0` — o
backup que você acabou de disparar, não um antigo. Se `status` vier diferente de `ok`, **pare
aqui** e resolva o backup antes de seguir (`docs/operacao/03-backup-e-restauracao.md`, seção
"Perguntas que você vai fazer às três da manhã").

---

## 2. Conferir o que vai ser aplicado, antes de aplicar

Antes de rodar qualquer coisa, leia o SQL que está prestes a tocar o banco de produção. Puxe a
imagem `ferramentas` mais recente primeiro — o job `implantar` do pipeline só baixa o serviço
`app`, nunca `ferramentas` (mesmo aviso do Roteiro 3, passo 3):

```bash
docker compose pull ferramentas
```

**O que você deve ver:** as camadas sendo baixadas e, ao final, `Pulled` (ou `Image is up to
date`, se a cópia local já era a mais nova).

Liste as migrações que a imagem carrega, e confirme que as duas novas estão lá:

```bash
docker compose run --rm ferramentas ls db/migrations
```

**O que você deve ver:** uma lista de arquivos `.sql` numerados, incluindo `0005_encomendas.sql`
e `0006_gatilhos-encomendas.sql` no fim — as únicas duas que este roteiro aplica.

Leia o conteúdo de cada uma antes de seguir:

```bash
docker compose run --rm ferramentas cat db/migrations/0005_encomendas.sql
docker compose run --rm ferramentas cat db/migrations/0006_gatilhos-encomendas.sql
```

**O que você deve ver:** a primeira cria os dois tipos enumerados (`etapa_encomenda`,
`status_encomenda`) e as três tabelas (`encomendas`, `encomenda_itens`, `encomenda_etapas`), com
a restrição `marcos_zero_ou_um`; a segunda liga as três tabelas ao gatilho
`tocar_atualizado_em()` que já existe desde a migração `0002`. Nenhuma das duas altera ou apaga
nada que já existe.

---

## 3. Aplicar

Pelo estágio `ferramentas` — a mesma regra dos roteiros 1 a 3, nunca pelo serviço `app` (a
imagem `app` não tem `drizzle-kit`, nem `tsx`, nem a pasta `db/`, de propósito):

```bash
docker compose run --rm ferramentas npm run db:migrate
```

**O que você deve ver:** uma única linha, `Migrações aplicadas com sucesso.`, saindo com código
`0`. É seguro rodar mais de uma vez — o Drizzle pula o que já foi aplicado.

> Não espere uma lista de migrações — o `migrate()` do Drizzle é silencioso, e a mensagem de
> sucesso **não prova o que foi aplicado**. As conferências do próximo passo é que provam.

---

## 4. Conferir de fora, não pelo relato do comando

Quatro conferências, nesta ordem — um portão que nunca foi visto falhando é indistinguível de um
portão quebrado, e é por isso que o quarto item abaixo exige um `insert` que **precisa dar
erro**.

**As três tabelas existem:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c '\dt'
```

**O que você deve ver:** as tabelas de sempre (`verificacao_infraestrutura`, `usuarios`,
`execucoes_backup`) mais as três novas — `encomendas`, `encomenda_itens`, `encomenda_etapas`.

**Os três gatilhos existem:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select event_object_table, trigger_name from information_schema.triggers where trigger_name like 'tocar_atualizado_em%' order by event_object_table;"
```

**O que você deve ver:** três linhas — `tocar_atualizado_em_encomendas`,
`tocar_atualizado_em_encomenda_etapas` e `tocar_atualizado_em_encomenda_itens` (mais as que já
existiam de `usuarios`/`execucoes_backup`, se a consulta não filtrar por tabela).

**A restrição `marcos_zero_ou_um` existe:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select conname from pg_constraint where conname = 'marcos_zero_ou_um';"
```

**O que você deve ver:** uma linha com `marcos_zero_ou_um`.

**Um `insert` inválido precisa FALHAR** — a prova de que a restrição não é só um nome na tabela
`pg_constraint`, mas está de fato bloqueando dado impossível. Isto grava uma encomenda de teste
inventada (nunca um nome ou cliente real do ateliê), um marco (`queima1`) com `dias = 2` — fora
de `{0, 1}` — e espera o Postgres recusar:

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "
begin;
with e as (
  insert into encomendas (nome, data_inicio) values ('[roteiro-04] teste de restrição', current_date) returning id
)
insert into encomenda_etapas (encomenda_id, etapa, dias, ordem)
select id, 'queima1', 2, 0 from e;
rollback;
"
```

**O que você deve ver:** a instrução falha com uma mensagem citando `marcos_zero_ou_um` (algo
como `ERROR: new row for relation "encomenda_etapas" violates check constraint
"marcos_zero_ou_um"`). O `rollback` no fim desfaz tudo — nenhuma linha de teste sobra no banco,
nem a encomenda inválida nem nenhuma etapa dela (o CTE grava as duas linhas dentro da MESMA
instrução, então uma falha na segunda parte desfaz a primeira sem precisar de dois comandos
separados). Se a instrução **não** falhar, **pare aqui** — a restrição não está valendo, e
nenhuma etapa gravada por engano com `dias = 2` num marco vai ser pega depois.

> **Por que não `\gset`.** Uma versão mais simples deste teste tentaria gravar a encomenda
> primeiro, guardar o `id` com `\gset` e usá-lo num segundo `insert`. Isso **não funciona**: o
> `psql -c` aceita ou SQL puro ou um único comando de barra invertida, nunca os dois misturados
> na mesma invocação — falha com `syntax error at or near "\"`. O CTE acima resolve o mesmo
> problema (usar o `id` recém-criado numa segunda gravação) dentro de uma única instrução SQL,
> sem depender de nenhum recurso interativo do `psql`. Achado durante a execução real deste
> roteiro em produção — a versão com `\gset` nunca funcionaria, em nenhuma versão do Postgres.

---

## 5. Conferir os grants

O `alter default privileges` da migração `0003` deveria ter dado ao papel `amassa_app`
`select`/`insert`/`update`/`delete` nas três tabelas novas automaticamente, sem grant adicional —
este passo é o que prova isso, em vez de confiar que funcionou:

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select grantee, table_name, privilege_type from information_schema.role_table_grants where grantee = 'amassa_app' and table_name in ('encomendas', 'encomenda_itens', 'encomenda_etapas') order by table_name, privilege_type;"
```

**O que você deve ver:** doze linhas — as três tabelas, cada uma com as quatro linhas
`DELETE`/`INSERT`/`SELECT`/`UPDATE` para `amassa_app`. Se alguma faltar, o passo 4 da migração
`0003` (`alter default privileges`) não estava em vigor quando `0005` rodou — investigue antes
de seguir; a aplicação vai falhar silenciosamente na primeira tentativa de gravar uma encomenda.

---

## 6. Critérios de aceite da fase

Confira cada um, um a um, no navegador, pelo domínio público — esta lista é copiada de
`.planning/ROADMAP.md` §"Phase 3":

- [ ] Criar uma encomenda com nome, cliente, data de início e as 6 etapas mostra as datas
      calculadas em cascata
- [ ] Mudar a duração de uma etapa (ex.: "secagem") desloca todas as etapas seguintes
- [ ] Os três marcos (queima 1, queima 2, entrega) aparecem como losango e são um interruptor,
      nunca um campo numérico; desligar "Entrega" faz o losango sumir e encurta a encomenda
- [ ] No desktop, o Gantt usa 18px/dia, cabeçalho em quinzenas, coluna fixa e a linha de "Hoje"
      na posição certa, já rolado até deixá-la centralizada
- [ ] Uma encomenda guarda e mostra vários itens com descrição e quantidade
- [ ] No celular, dá para ler o andamento de todas as encomendas como lista vertical, sem
      rolagem horizontal
- [ ] Encomendas podem ser filtradas por status, ordenadas e buscadas por nome ou cliente
- [ ] O rodapé do formulário mostra duração total e data de conclusão, atualizando conforme se
      digita
- [ ] Uma encomenda criada em um dispositivo aparece no outro ao recarregar a página (sem
      atualização em tempo real, deliberadamente)
- [ ] Excluir uma encomenda pede confirmação
- [ ] O estado vazio mostra "A roda ainda não gira."
- [ ] Um botão de imprimir produz uma folha A4 com as encomendas ativas — nome, cliente, etapa
      atual e data de conclusão — legível e cabendo em uma página no volume atual do ateliê

Para os três primeiros, crie uma encomenda de verdade com dois itens, com nome e cliente
inventados (nunca um nome real de cliente do ateliê nesta primeira prova). Toque no botão de
imprimir e veja a folha abrir. No celular, confira que a lista de cartões não rola para o lado.

---

Isto encerra os roteiros de servidor da Fase 3. A partir daqui, o módulo de Encomendas está
migrado em produção, com as mesmas garantias que o banco de teste já provou — restrições,
gatilhos e grants conferidos de fora, não pelo relato de um comando.

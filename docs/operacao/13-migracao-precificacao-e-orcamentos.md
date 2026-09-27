# Roteiro 13 — Migração de Precificação e Orçamento em produção

**Quando rodar:** **uma vez**, **depois** do Roteiro 12 (`docs/operacao/12-fotos-volume-e-backup.md`,
diretório das fotos com a posse certa) já ter rodado por completo — sem o diretório do host pronto,
o passo 8 deste roteiro (o primeiro envio de foto de verdade) falha com permissão negada. **Nunca
pelo pipeline.** Abra a sessão SSH **antes** de os commits desta fase serem enviados — `/financeiro`
já responde na aba Venda hoje, mas as abas **Peças** e **Orçamentos**, e a sub-aba **Parâmetros** de
Cadastros, só existem no código publicado por este deploy e consultam tabelas que ainda não existem
no banco.

**O que este roteiro faz:** aplica as cinco migrações desta fase, nesta ordem —

1. `0017_precificacao-e-orcamentos.sql` — as oito tabelas e os dois tipos de enum;
2. `0018_gatilhos-precificacao.sql` — os seis gatilhos de `atualizado_em`, o gatilho que recusa
   mudar o VALOR de um parâmetro já gravado, e os privilégios de `amassa_app`;
3. `0019_parametros-iniciais.sql` — a semente dos 18 parâmetros ilustrativos, todos marcados
   **estimado** (D-17: nenhum valor real de precificação entrou em seed versionado);
4. `0020_corrigir-gatilho-parametro-mesmo-dia.sql` — corrige o gatilho de `0018`, que recusava até
   uma correção de valor no MESMO dia (achado real do plano 04.5-02);
5. `0021_corrigir-fuso-da-semente-de-parametros.sql` — corrige o fuso da semente de `0019`
   (WINDOWS #44, ver a caixa abaixo) e a MESMA classe de defeito no gatilho de `0020`.

Todas as cinco já commitadas e provadas contra o banco de teste efêmero por
`npm run test:migracoes` (parte de `npm run verificar`) e pela suíte ponta a ponta completa da fase
(`04.5-13-PLAN.md`, Tarefa 1).

🔴 **Por que existe uma quinta migração que nenhum plano anterior previu.** A `0019` grava
`vigente_desde = current_date` — o `current_date` **do Postgres**, que roda em UTC (CLAUDE.md:
`TZ` só no serviço app, nunca no banco). A leitura dos parâmetros usa a data civil de **Brasília**.
Entre **21h e meia-noite**, horário de Brasília, os dois relógios discordam sobre "que dia é hoje" —
e é **exatamente a hora em que alguém aplica uma migração**. Se `0019` tivesse sido aplicada sozinha
nessa janela, os 18 parâmetros nasceriam "datados de amanhã" e as telas **Peças** e o editor de
**Orçamento** mostrariam "Não deu para carregar os parâmetros" até a virada do dia. A `0021` corrige
isso — **sem editar `0019`** (regra do projeto: migração commitada nunca é reescrita) — e vale a
pena aplicá-la **de dia** de qualquer forma, mas o roteiro funciona igual em qualquer horário: a
correção é automática, faça parte do mesmo passo 3.

**O que este roteiro NÃO faz, e por quê:**

- **Não mexe em Financeiro, parte 1.** `lib/precificacao/` e `lib/orcamentos/` **leem** a taxa do
  cartão de `lib/financeiro/taxa.ts` (D-16) e a aprovação de um orçamento **grava** uma venda em
  `documentos`/`parcelas` — mas nenhuma tabela desta fase substitui ou migra dado de lá. As tabelas
  do Financeiro, parte 1, continuam exatamente como o Roteiro 10 as deixou.
- **Não semeia peça nem orçamento real.** Só os 18 **parâmetros** nascem com dado (D-17, todos
  "estimado"). Nenhuma ficha de peça, nenhum orçamento — o dono cadastra pela tela, depois da
  migração.
- **Não roda sozinho, nunca é disparado pelo pipeline, e não pula o backup.** CLAUDE.md é
  explícito — *"Migrações: aplicadas à mão, depois de um backup, por alguém que está olhando.
  Nunca pelo pipeline automático."*

**Como ler cada passo:** o mesmo formato dos roteiros anteriores — cada bloco de comando vem
acompanhado de **o que faz** e **o que você deve ver** de volta. Se a tela divergir muito do
descrito, **pare naquele passo** e não siga para o próximo.

Os comandos rodam todos **no servidor**, na sessão SSH como `theo`. Use `docker compose run --rm
ferramentas`, **nunca** `docker compose exec app` — a imagem `app` não tem `drizzle-kit`, `tsx` nem
a pasta `db/`, de propósito (esse erro já aconteceu neste projeto, Roteiro 4 da Fase 3, e está
registrado em `WINDOWS.md #14`). Nenhum comando abaixo pede credencial de acesso nem string de
conexão — o repositório é público.

---

## Passo 1 — Guarda de segurança: confirmar em qual servidor a sessão está

```bash
hostname
whoami
ls -d /opt/amassa
```

**O que faz:** confirma que você está na sessão SSH do servidor de produção, não no seu computador
— os passos seguintes aplicam migração num banco de verdade, e o comando certo no lugar errado não
tem desfazer fácil.

**O que você deve ver:** o nome do host do VPS (não o nome do seu computador), `theo`, e
`/opt/amassa` listado sem erro. Se `ls` disser "No such file or directory", você não está no
servidor certo — **pare aqui**.

---

## Passo 2 — Backup, antes de qualquer coisa

```bash
cd /opt/amassa
./scripts/backup.sh --agora
```

**O que você deve ver:** nenhuma saída — sucesso silencioso. Confira com `echo $?` (`0` é sucesso).

Confira que a linha foi gravada:

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select quando, sucesso, destino_externo_ok from execucoes_backup order by quando desc limit 1;"
```

**O que você deve ver:** uma linha com `sucesso = t` e o horário de agora. **Sem backup
verificado, não siga para o Passo 3.**

---

## Passo 3 — Aplicar

Pelo serviço `ferramentas`, nunca por `docker compose exec app`:

```bash
docker compose pull ferramentas
docker compose run --rm ferramentas npm run db:migrate
```

**O que você deve ver:** `Migrações aplicadas com sucesso.`, saindo com código `0`. Seguro rodar
mais de uma vez — o Drizzle pula o que já foi aplicado; `0019` é idempotente por
`on conflict (chave, vigente_desde) do nothing`, e `0021` é idempotente por `create or replace
function` mais um `update`/`delete` que não afeta nenhuma linha já corrigida.

> Não espere uma lista de migrações — o `migrate()` do Drizzle é silencioso, e a mensagem de
> sucesso **não prova o que foi aplicado**. As conferências dos próximos passos é que provam.

`/cadastros?sub=parametros`, `/financeiro?aba=pecas` e `/financeiro?aba=orcamentos` já voltam a
responder a partir daqui.

---

## Passo 4 — Conferir as oito tabelas novas

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select table_name from information_schema.tables where table_schema = 'public' and table_name in ('parametros_precificacao','fichas_precificacao','orcamentos','orcamento_linhas','orcamento_projeto','orcamento_fotos','orcamento_revisoes','contadores_orcamento') order by table_name;"
```

**O que você deve ver:** as oito linhas, em ordem alfabética: `contadores_orcamento`,
`fichas_precificacao`, `orcamento_fotos`, `orcamento_linhas`, `orcamento_projeto`,
`orcamento_revisoes`, `orcamentos`, `parametros_precificacao`.

Os dois tipos de enum também existem:

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select typname from pg_type where typname in ('plano_pagamento_orcamento','status_orcamento') order by typname;"
```

**O que você deve ver:** duas linhas — `plano_pagamento_orcamento` e `status_orcamento`.

---

## Passo 5 — Conferir os gatilhos, e provar a recusa de verdade

**Os seis gatilhos de `atualizado_em` estão ligados** (as seis tabelas de `0017` que têm essa
coluna — `orcamento_revisoes` e `contadores_orcamento` não entram, de propósito: a primeira é
tabela só de inserção, a segunda não tem `atualizado_em`):

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select event_object_table, trigger_name from information_schema.triggers where trigger_name like 'tocar_atualizado_em_%' and event_object_table in ('parametros_precificacao','fichas_precificacao','orcamentos','orcamento_linhas','orcamento_projeto','orcamento_fotos') order by event_object_table;"
```

**O que você deve ver:** seis linhas, uma por tabela.

**O gatilho que recusa mudar o VALOR de um parâmetro já gravado (D-15) está ligado:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select event_object_table, trigger_name from information_schema.triggers where trigger_name = 'recusar_mudanca_de_valor_do_parametro';"
```

**O que você deve ver:** uma linha, em `parametros_precificacao`.

**Prove a recusa de verdade** — um `update` que tenta mudar o valor de um parâmetro de um dia
ANTERIOR ao de hoje precisa falhar, dentro de uma transação que você reverte (nada fica gravado,
nem o teste nem um erro parado no meio):

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "begin; update parametros_precificacao set valor_inteiro = 999999 where chave = 'material_argila' and vigente_desde < hoje_brasilia(); rollback;"
```

**O que você deve ver:** se já existir uma linha de um dia anterior para `material_argila` (o que
não acontece logo após esta migração, já que a semente inteira nasce "hoje"), o `update` viria com
`ERROR: O valor de um parâmetro já histórico não pode ser alterado...`. **Se ainda não existir
nenhuma linha histórica** (o caso normal, recém-migrado), o comando acima não afeta nenhuma linha
(`UPDATE 0`) e não prova nada por si — o que importa aqui é que o comando **não trava nem gera erro
de sintaxe**; a recusa de verdade já foi provada contra o Postgres de teste por
`npm run test:migracoes` antes deste deploy. Se quiser ver a recusa acontecer ao vivo, edite o MESMO
parâmetro duas vezes em dias diferentes pela tela (Cadastros → Parâmetros) e tente, depois, uma
correção de banco direta no valor do dia mais antigo — **essa sim** deve ser recusada.

---

## Passo 6 — Conferir que os 18 parâmetros nasceram, todos estimados

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select count(*) as total, count(*) filter (where medido = false) as estimados, count(*) filter (where vigente_desde > hoje_brasilia()) as datados_no_futuro from parametros_precificacao;"
```

**O que você deve ver:** `total = 18`, `estimados = 18` e `datados_no_futuro = 0`. Se
`datados_no_futuro` vier diferente de zero, a `0021` não aplicou corretamente — **pare aqui** e
confira a saída do Passo 3 de novo antes de continuar; não edite a data à mão.

---

## Passo 7 — Conferir os privilégios de `amassa_app`

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select table_name, has_table_privilege('amassa_app', table_name, 'select') as pode_ler, has_table_privilege('amassa_app', table_name, 'insert') as pode_inserir, has_table_privilege('amassa_app', table_name, 'update') as pode_atualizar, has_table_privilege('amassa_app', table_name, 'delete') as pode_apagar from (values ('parametros_precificacao'),('fichas_precificacao'),('orcamentos'),('orcamento_linhas'),('orcamento_projeto'),('orcamento_fotos'),('orcamento_revisoes'),('contadores_orcamento')) as t(table_name) order by table_name;"
```

**O que você deve ver:** `pode_ler`/`pode_inserir`/`pode_atualizar = t` nas oito linhas;
`pode_apagar = t` **só** em `fichas_precificacao`, `orcamento_fotos` e `orcamento_linhas`,
`orcamento_projeto` (tirar uma ficha sem orçamento, uma foto, uma linha ou o projeto/frete de um
rascunho, D-20); `pode_apagar = f` em `orcamentos`, `orcamento_revisoes`,
`parametros_precificacao` e `contadores_orcamento` — os quatro `revoke delete` explícitos de
`0018`.

---

## Passo 8 — Conferir que o envio de foto funciona de verdade

Este é o passo que só existe de verdade em produção — nenhum ambiente de desenvolvimento reproduz
a posse de arquivo entre o host e o contêiner (ver Roteiro 12, Pitfall 4 da pesquisa da fase).

- [ ] No navegador, pelo domínio público, entre no sistema e abra **Financeiro → Orçamentos**.
- [ ] Toque **"Novo orçamento"**, preencha um nome de teste (ex.: "[roteiro-13] teste de foto") e
      confirme.
- [ ] Anexe **uma foto pequena** tirada agora pelo celular (ou qualquer JPEG/HEIC pequeno).
      Confirme que ela aparece na tela, reduzida, sem erro.
- [ ] No servidor, confirme que o arquivo chegou ao diretório do host:

```bash
ls -la /opt/amassa/dados/fotos-orcamentos/
```

**O que você deve ver:** pelo menos um arquivo `.jpg` novo, com dono `100` e grupo `101` (o mesmo
usuário `nextjs` de dentro do contêiner) — a prova de que o bind mount e a posse aplicados no
Roteiro 12 realmente permitem gravação de dentro do contêiner.

**Se a foto falhar com erro de servidor:** volte ao Roteiro 12, Passo 6 (conferência de escrita) e
confira a posse do diretório antes de tentar de novo — não insista neste passo sem corrigir a
permissão primeiro.

---

## Passo 9 — Backup depois, e a rota de saúde

```bash
./scripts/backup.sh --agora
```

**O que você deve ver:** nenhuma saída — sucesso silencioso.

```bash
curl -s https://amassacerrado.com.br/api/health/backup
```

**O que você deve ver:** um corpo com `"status":"ok"`, já cobrindo o dump do Postgres (com as oito
tabelas novas e o parâmetro de teste) e a cópia externa das fotos (Roteiro 12) — incluindo a foto
de teste do Passo 8, se o `rclone` já tiver rodado.

---

## Passo 10 — O que fazer se algo falhar

Quatro erros prováveis, cada um com a causa e a correção:

1. **`docker compose run --rm ferramentas npm run db:migrate` sai diferente de `0`, com um erro de
   permissão negada no banco.** Causa mais provável: o `compose.yml` do servidor está desatualizado
   em relação à variável de conexão de migração (a mesma classe de defeito já registrada em
   `WINDOWS.md #14`). Correção: confira `grep DATABASE_URL_MIGRACAO /opt/amassa/compose.yml` — se
   não aparecer, a publicação com esta fase ainda não sincronizou o `compose.yml`; **pare aqui** e
   confirme o deploy antes de tentar de novo.
2. **O Passo 6 mostra `datados_no_futuro` diferente de zero, mesmo depois da migração.** Causa:
   a `0021` não chegou a aplicar (confira `docker compose run --rm ferramentas ls db/migrations` —
   a lista precisa terminar em `0021_corrigir-fuso-da-semente-de-parametros.sql`). Correção: rode
   o Passo 3 de novo — reaplicar é seguro (idempotente).
3. **`/cadastros?sub=parametros` ou `/financeiro?aba=pecas` mostram "Não deu para carregar os
   parâmetros" mesmo depois do Passo 6 confirmar zero linhas no futuro.** Causa provável: o
   contêiner `app` ainda está rodando a imagem de ANTES desta migração (a mesma classe de defeito
   de `WINDOWS.md #13` — o pipeline nunca faz `pull` automático da imagem `ferramentas`, e o `app`
   também precisa ser atualizado). Correção: `docker compose pull app && docker compose up -d app`.
4. **O Passo 8 falha com permissão negada ao gravar a foto.** Causa: o Roteiro 12 não rodou, ou
   rodou num caminho diferente do que está em `docker/compose.yml`. Correção: volte ao Roteiro 12
   por completo antes de repetir este passo — não adianta insistir aqui sem o diretório do host
   pronto.

Se nenhum destes quatro descrever o que você está vendo: **pare e chame** antes de improvisar num
banco de produção — um problema pequeno vira grande rápido quando alguém tenta um comando
inventado na hora.

---

## Lembrete: a ordem desta virada é 12 → 13

O Roteiro 12 (diretório das fotos, posse `100:101`) e este Roteiro 13 (as cinco migrações) formam a
virada desta fase, **nessa ordem**: sem o diretório certo, o Passo 8 deste roteiro falha; sem as
migrações, nenhuma tela nova (Peças, Orçamentos, Parâmetros) abre. Depois dos dois, a Fase 04.5
está no ar — falta só a verificação humana
(`.planning/phases/04.5-financeiro-parte-2/04.5-VERIFICACAO-HUMANA.md`) para a fase fechar de
verdade.

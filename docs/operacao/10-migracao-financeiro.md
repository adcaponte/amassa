# Roteiro 10 — Migração do Financeiro em produção

Este roteiro leva o banco de produção de "sem o Financeiro" a "com o módulo inteiro" — as oito
tabelas de `0014_financeiro.sql` (tipos, categorias, catálogo, ficha técnica, documentos, linhas,
parcelas, contas fixas, configuração), os oito gatilhos e as três travas de `0015_gatilhos-financeiro.sql`
(a restrição de soma do documento, a trava de grupo/área de categoria depois de lançamento, e o
`revoke delete` que faz "nada lançado se apaga" valer alguma coisa), e a semente das 24 categorias
de `0016_categorias-iniciais.sql`.

**O que este roteiro faz:** aplica as três migrações, já commitadas e provadas contra o banco de
teste efêmero por `npm run test:migracoes` (parte de `npm run verificar`) e pela suíte ponta a
ponta completa da fase (`04.4-11-PLAN.md`, Tarefa 2).

**O que este roteiro NÃO faz, e por quê:**

- **Não traz nada da Abertura do Espaço.** As duas fases não têm nenhuma referência cruzada —
  `lib/financeiro/` nunca importa `lib/abertura`/`lib/cotacoes`, e nenhuma tabela do Financeiro tem
  chave estrangeira para `abertura_itens`. Trazer as parcelas em aberto da Abertura para o Caixa é
  o **Roteiro 11** (`docs/operacao/11-virada-do-financeiro.md`), rodado **uma vez**, na virada, no
  fim de novembro — não faz parte deste roteiro.
- **Não semeia catálogo nem conta fixa.** A `0016` grava só as 24 categorias (as 23 do protótipo
  mais "Juros, multas e descontos"). Catálogo e contas fixas nascem **vazios** de propósito —
  os preços e valores do protótipo são inventados (D-14, `04.4-CONTEXT.md`). O dono cadastra os
  itens e as contas reais pela tela, depois da migração.
- **Não roda sozinho, nunca é disparado pelo pipeline, e não pula o backup.** `CLAUDE.md` é
  explícito — *"Migrações: aplicadas à mão, depois de um backup, por alguém que está olhando.
  Nunca pelo pipeline automático."*

**Quando rodar:** logo depois do deploy que traz as migrações `0014`/`0015`/`0016` — os arquivos
delas só chegam ao servidor dentro da imagem `ferramentas` publicada por esse deploy. **`/financeiro`
e `/cadastros` ficam fora do ar entre o fim do deploy e o passo 3 deste roteiro** (as duas rotas já
existem no código publicado e consultam tabelas que ainda não existem no banco). Abra a sessão SSH
**antes** de enviar os commits e siga do passo 1 ao 3 sem pausa; do passo 4 em diante as duas
páginas já voltaram.

**Como ler cada passo:** o mesmo formato dos roteiros anteriores — cada bloco de comando vem
acompanhado de **o que faz** e **o que você deve ver** de volta. Se a tela divergir muito do
descrito, **pare naquele passo** e não siga para o próximo.

Os marcadores entre `<` e `>` saem junto com o valor. Este roteiro não introduz nenhum marcador
novo: os comandos abaixo já usam os nomes fixos de sempre (`amassa_owner`, `amassa_app`, `amassa`)
e não pedem nenhum dado de acesso real ao servidor em lugar nenhum. Nos dados de teste digitados na
conferência (passo 5), use valores pequenos e a palavra "teste" na descrição — nada se apaga, e o
**Roteiro 11** recusa aplicar a virada se encontrar um lançamento pago antes da virada que não
esteja cancelado.

Os comandos rodam todos **no servidor**, na sessão SSH como `theo`. Use `docker compose run --rm
ferramentas`, **nunca** `docker compose exec app` — a imagem `app` não tem `drizzle-kit`, `tsx` nem
a pasta `db/`, de propósito.

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

**O que você deve ver:** um corpo com `"status":"ok"` e `"idadeEmHoras"` próximo de `0` — o backup
que você acabou de disparar. Se `status` vier diferente de `ok`, **pare aqui** e resolva o backup
antes de seguir (`docs/operacao/03-backup-e-restauracao.md`). **Não siga para o Passo 2 sem isso.**

---

## 2. Conferir o que vai ser aplicado, antes de aplicar

```bash
docker compose pull ferramentas
docker compose run --rm ferramentas ls db/migrations
```

**O que você deve ver:** a lista de migrações termina em `0016_categorias-iniciais.sql`, com
`0014_financeiro.sql` e `0015_gatilhos-financeiro.sql` logo antes — as três únicas que este
roteiro aplica.

```bash
docker compose run --rm ferramentas cat db/migrations/0014_financeiro.sql
```

**O que você deve ver:** cinco `create type` (enums `area_financeira`, `forma_pagamento`,
`grupo_categoria`, `tipo_documento`, `unidade_estoque`) e oito `create table`
(`categorias`, `configuracao_financeira`, `contas_fixas`, `documento_linhas`, `documentos`,
`ficha_tecnica`, `itens_catalogo`, `parcelas`), com dinheiro em `integer` de centavos, teto de
10^9 em toda coluna de valor, e nenhuma chave estrangeira apontando para tabela da Abertura.

```bash
docker compose run --rm ferramentas cat db/migrations/0015_gatilhos-financeiro.sql
```

**O que você deve ver:** os oito gatilhos `tocar_atualizado_em_<tabela>` (um por tabela de
`0014`), a função `conferir_soma_do_documento()` com três `constraint trigger ... deferrable
initially deferred` (documento sem linha, sem parcela, ou soma que não fecha), a função
`travar_grupo_e_area_da_categoria()`, e o `revoke delete on documentos, parcelas, categorias,
itens_catalogo, contas_fixas, configuracao_financeira from amassa_app` no final — `documento_linhas`
e `ficha_tecnica` **mantêm** `delete` (desfazer uma diferença e tirar um insumo da ficha técnica
continuam possíveis).

```bash
docker compose run --rm ferramentas cat db/migrations/0016_categorias-iniciais.sql
```

**O que você deve ver:** **esta é uma migração de DADO** (D-14, `04.4-CONTEXT.md`) — 23 `insert`
com nome/grupo/área de cada categoria (as mesmas do protótipo) mais um `insert` extra para "Juros,
multas e descontos" com `chave_do_sistema = 'diferenca'`, ambos com
`on conflict (lower(trim(nome))) do nothing` — rodar de novo não duplica nenhuma categoria. O que
esta migração grava vira dado de produção de verdade, editável depois só pela tela (nome,
desativar/reativar) — nunca apagável.

---

## 3. Aplicar

Pelo serviço `ferramentas`, nunca por `docker compose exec app`:

```bash
docker compose run --rm ferramentas npm run db:migrate
```

**O que você deve ver:** `Migrações aplicadas com sucesso.`, saindo com código `0`. Seguro rodar
mais de uma vez — o Drizzle pula o que já foi aplicado, e a `0016` é idempotente por
`on conflict do nothing`.

> Não espere uma lista de migrações — o `migrate()` do Drizzle é silencioso, e a mensagem de
> sucesso **não prova o que foi aplicado**. As conferências do próximo passo é que provam.

`/financeiro` e `/cadastros` já voltam a responder a partir daqui.

---

## 4. Conferir de fora, não pelo relato do comando

**As oito tabelas existem:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c '\dt'
```

**O que você deve ver:** as tabelas de sempre mais as oito novas — `categorias`,
`configuracao_financeira`, `contas_fixas`, `documento_linhas`, `documentos`, `ficha_tecnica`,
`itens_catalogo`, `parcelas`.

**Os oito gatilhos de `atualizado_em` estão ligados:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select event_object_table, trigger_name from information_schema.triggers where trigger_name like 'tocar_atualizado_em_%' and event_object_table in ('categorias','configuracao_financeira','contas_fixas','documento_linhas','documentos','ficha_tecnica','itens_catalogo','parcelas') order by event_object_table;"
```

**O que você deve ver:** oito linhas, uma por tabela.

**Os gatilhos de restrição da soma e a trava de categoria estão ligados:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select event_object_table, trigger_name from information_schema.triggers where trigger_name in ('conferir_soma_apos_linha','conferir_soma_apos_parcela','conferir_soma_apos_documento','travar_grupo_e_area_da_categoria') order by trigger_name;"
```

**O que você deve ver:** quatro linhas — as três de `conferir_soma_apos_*` (em
`documento_linhas`, `parcelas` e `documentos`, respectivamente) e
`travar_grupo_e_area_da_categoria` (em `categorias`).

**Os cinco tipos de enum existem:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select typname from pg_type where typname in ('area_financeira','forma_pagamento','grupo_categoria','tipo_documento','unidade_estoque') order by typname;"
```

**O que você deve ver:** cinco linhas.

**Exatamente 24 categorias, uma com a chave `diferenca`:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select count(*) as total, count(*) filter (where chave_do_sistema = 'diferenca') as com_chave_diferenca from categorias;"
```

**O que você deve ver:** `total = 24` e `com_chave_diferenca = 1`.

**O banco recusa uma parcela de valor zero** — a prova de que a restrição não é só um nome em
`pg_constraint`, mas está de fato bloqueando dado impossível. O comando abaixo cria um documento de
despesa de teste (título inventado) com uma linha, e então tenta a parcela de **valor zero**. Os
dois comandos vão num `-c` só, então o Postgres os trata como uma transação única: quando a parcela
é recusada, o documento e a linha são desfeitos junto, sem `begin`/`rollback` explícitos.

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "with d as (insert into documentos (tipo, data, titulo, criado_por) values ('despesa', current_date, '[roteiro-10] teste de restricao', (select id from usuarios order by criado_em limit 1)) returning id) insert into documento_linhas (documento_id, categoria_id, descricao, valor_centavos) select d.id, (select id from categorias where chave_do_sistema is null limit 1), '[roteiro-10] linha teste', 100 from d; insert into parcelas (documento_id, numero, vencimento, valor_centavos, forma) select id, 1, current_date, 0, 'dinheiro' from documentos where titulo = '[roteiro-10] teste de restricao';"
```

**O que você deve ver:** `INSERT 0 1` (o documento e a linha, numa tacada só pelo `with`) e em
seguida `ERROR: new row for relation "parcelas" violates check constraint
"parcelas_valor_no_intervalo"`. Se a parcela de valor zero **for aceita**, **pare aqui** — a
restrição não está valendo.

Confirme que nada sobrou:

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select count(*) from documentos where titulo like '[roteiro-10]%';"
```

**O que você deve ver:** `0`. Se vier `1`, o documento de teste sobreviveu ao erro — apague-o antes
de seguir e avise, porque isso contradiz o comportamento transacional esperado.

> **Por que não `\gset`:** a primeira versão deste roteiro usava `returning id \gset` para reusar o
> id do documento. `\gset` é um meta-comando do `psql`, que **não funciona** com `-c` (só numa
> sessão interativa ou lendo de um arquivo/stdin). Corrigido em 2026-09-20, durante a própria
> migração, para a forma com `with` acima — que roda igual nos dois canais.

**`amassa_app` NÃO tem `delete` em `documentos` nem em `parcelas`:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select table_name, has_table_privilege('amassa_app', table_name, 'delete') as pode_deletar from (values ('documentos'),('parcelas'),('categorias'),('itens_catalogo'),('contas_fixas'),('configuracao_financeira'),('documento_linhas'),('ficha_tecnica')) as t(table_name) order by table_name;"
```

**O que você deve ver:** `pode_deletar = f` para `categorias`, `configuracao_financeira`,
`contas_fixas`, `documentos`, `itens_catalogo` e `parcelas`; `pode_deletar = t` para
`documento_linhas` e `ficha_tecnica` (as duas exceções deliberadas — desfazer uma diferença e tirar
um insumo da ficha técnica).

---

## 5. Conferir a aplicação

No navegador, pelo domínio público:

- [ ] Entre no sistema e confira **"Financeiro"** na barra (celular: entre Encomendas e Agenda;
      desktop: barra lateral) — abrindo direto na Venda.
- [ ] Abra **Cadastros → Categorias** e confira as **24 categorias**, agrupadas por Receitas,
      Custos, Geral e Fora do resultado.
- [ ] Abra **Cadastros → Taxas** e grave a taxa real da maquininha do ateliê.
- [ ] Em **Financeiro → Venda**, use **"+ Valor livre"** para lançar uma venda de teste de
      **R$ 1,00**, descrição "teste da migração", à vista, em Dinheiro. Confirme o aviso de venda
      lançada.
- [ ] Abra o documento recém-lançado no Caixa (extrato ou "A receber", se não tiver marcado como
      pago) e toque **"Cancelar esta venda"**, confirmando o `AlertDialog`. Confirme que ela
      aparece **riscada** no extrato deste mês, fora do saldo e do Mês.

**Nada se apaga** — a venda de teste cancelada fica no extrato para sempre, riscada, com quem
cancelou e quando. O **Roteiro 11** exige que qualquer lançamento pago antes da virada esteja
cancelado; deixar esta venda de teste cancelada já satisfaz essa exigência sem trabalho extra.

---

## Lembrete: o próximo roteiro do Financeiro é o 11, na virada

Isto encerra a migração de produção do Financeiro — parte 1. As oito tabelas, os cinco enums e as
24 categorias estão no ar, com as mesmas garantias que o banco de teste já provou: soma do
documento, trava de categoria e ausência de `delete` conferidos de fora, não pelo relato de um
comando.

O **script da virada não roda nesta fase.** Ele fica pronto (`scripts/importar-parcelas-abertura.ts`,
provado em banco próprio por `npm run test:migracoes`) para o **Roteiro 11**
(`docs/operacao/11-virada-do-financeiro.md`), rodado **uma vez**, no fim de novembro, quando o
espaço físico abrir de verdade e as parcelas em aberto da Abertura precisarem virar contas a pagar
no Caixa.

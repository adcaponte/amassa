# Roteiro 24 — Limpeza geral dos dados antes da inauguração

**Quando rodar:** **uma vez**, antes da inauguração, quando você quiser zerar o sistema. Durante a Parte B, ninguém
usa o sistema: avise a equipe e escolha um horário sem movimento. Escrito em 08/10/2026 pelo quick `261008-6f1`,
**sem ter sido rodado**. Se algum passo divergir do descrito, o erro pode ser do roteiro: **pare naquele passo** e
não improvise.

**Sem migração nenhuma.** A `0031` continua sendo a última. A limpeza é um script que roda pela `ferramentas`, numa
transação só, e grava só quando você manda.

---

## Resumo

**O que SOME** (todas as linhas):

- **Caixa:** vendas, despesas, parcelas, correções e contas fixas.
- **Orçamentos:** todos, com linhas, projeto, revisões e as fotos (as linhas no banco; os arquivos, nos Passos B17 e B18).
- **Produção:** ordens, etapas e peças.
- **Catálogo e fichas:** todos os itens, **menos os 6 itens do sistema**, mais as fichas técnicas e as fichas de
  precificação.
- **Queimas:** fornos, queimas, contagens, a cobrança das externas e as manutenções.
- **Agenda:** turmas, alunos, eventos, inscrições, mensalidades e uso livre (com o material).
- **Cadastros:** clientes, fornecedores e os anexos deles (as linhas; os arquivos, nos Passos B17 e B18).
- **Estoque:** todas as movimentações.
- **Início:** os lembretes e o texto das anotações da casa. A folha fica, vazia, como no primeiro dia.

**O que FICA** (intacto): a **Abertura do Espaço** inteira (itens, tarefas, data da inauguração), o **Comparador de
Compras** (categorias e cotações), as **categorias** do Financeiro, os **parâmetros** de precificação e a régua das
Queimas, os **usuários e senhas**, o **histórico de backup** e o registro das migrações.

**O que ZERA:**

- o **saldo inicial** do caixa vai a **R$ 0,00**. A taxa do cartão e a data do saldo ficam como estão;
- a **numeração** volta a 1. A próxima venda ou despesa é a nº 1, assim como a próxima ordem de produção, a próxima
  movimentação do estoque e o próximo orçamento do ano.

**Os 6 itens do sistema ficam com nome, preço e categoria:** Mensalidade, Inscrição em oficina, Uso livre (hora),
Queima externa P, Queima externa M e Queima externa G. A Agenda e as Queimas os acham pelo código. Sem o "Queima
externa P", `/api/health/queimas` responde 503.

**O que muda no site público:** a agenda do site fica sem turmas e sem eventos, inclusive o "Teste" de 05/11. Sem
nenhum evento público, a seção "Aulas e oficinas" volta ao estado sem calendário (`components/site/agenda-publica.tsx`
cai em `AulasEOficinas`): três cartões de texto (**Turmas fixas**, **Oficinas de uma tarde**, **Uso livre do
ateliê**) e o botão de WhatsApp **"Quero saber das próximas aulas"**. A página inicial se atualiza em até 5 minutos.

**O que não volta sem restaurar o backup:** tudo o que está em "O que SOME". O caminho de volta está no fim deste
roteiro. Ele usa o dump do backup do Passo B5 (o nome anotado no B9) e a cópia das pastas do Passo B10, e devolve **tudo** ao momento do backup.

**Por que o push vem antes do backup:** o push não muda dado nenhum. Ele só coloca o script na imagem `ferramentas`.
O backup fica logo antes da limpeza, para ser o mais novo possível. O script **recusa gravar** se o último backup
tiver mais de 3 horas, se tiver falhado ou se não tiver chegado ao destino externo.

---

## Parte A — No seu computador

### Passo A1 — O push

```bash
git push
```

**O que você deve ver:** o push aceito, sem aviso de segredo. Se recusar, **pare** e cole a saída para o Code.

### Passo A2 — O pipeline começou

```bash
gh run list --limit 3
```

**O que você deve ver:** o run novo no topo, em andamento (`in_progress` ou `queued`).

### Passo A3 — Esperar o pipeline terminar

```bash
gh run watch
```

**O que você deve ver:** todos os jobs verdes, inclusive o **`implantar`**. O job **`banco`** agora também roda a
prova da limpeza: no log dele aparece **`Limpeza geral provada: 46 tabelas, 10 casos.`**

**Se algum job ficar vermelho:** nada foi implantado. **Pare aqui**, sem ir ao servidor, e cole para o Code o nome do
job e as últimas linhas do log.

### Passo A4 — O sistema continua no ar

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://amassacerrado.com.br/api/health
```

**O que você deve ver:** **`200`**. Qualquer outro número: **pare** e chame.

---

## Parte B — No servidor

Entre por SSH como `theo` e vá para `/opt/amassa`. Os passos abaixo partem dessa pasta.

### Passo B1 — Trazer a imagem nova da `ferramentas`

```bash
docker compose pull ferramentas
```

**O que você deve ver:** a imagem baixada (`Pulled`).

### Passo B2 — Conferir que o script está na imagem

```bash
docker compose run --rm ferramentas ls db/limpeza
```

**O que você deve ver:** `limpeza-geral.sql`. Se aparecer `No such file or directory`, a imagem é velha: confira se
o Passo A3 terminou verde e repita o B1.

### Passo B3 — Contagem ANTES: o que vai sumir (só leitura)

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -x -c "select (select count(*) from documentos) as documentos, (select count(*) from parcelas) as parcelas, (select count(*) from contas_fixas) as contas_fixas, (select count(*) from itens_catalogo) as itens_catalogo, (select count(*) from itens_catalogo where chave_do_sistema is not null) as itens_do_sistema, (select count(*) from fichas_precificacao) as fichas_precificacao, (select count(*) from clientes) as clientes, (select count(*) from fornecedores) as fornecedores, (select count(*) from fornos) as fornos, (select count(*) from queimas) as queimas, (select count(*) from ordens_producao) as ordens_producao, (select count(*) from orcamentos) as orcamentos, (select count(*) from movimentacoes_estoque) as movimentacoes_estoque, (select count(*) from turmas) as turmas, (select count(*) from eventos) as eventos, (select count(*) from lembretes) as lembretes;"
```

**O que você deve ver:** uma coluna de números, com **`itens_do_sistema = 6`**. **Anote todos.** Se
`itens_do_sistema` não for 6, **pare** e chame.

### Passo B4 — Contagem ANTES: o que vai ficar (só leitura)

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -x -c "select (select count(*) from abertura_itens) as abertura_itens, (select count(*) from abertura_tarefas) as abertura_tarefas, (select count(*) from abertura_configuracao) as abertura_configuracao, (select count(*) from cotacao_categorias) as cotacao_categorias, (select count(*) from cotacoes) as cotacoes, (select count(*) from categorias) as categorias, (select count(*) from parametros_precificacao) as parametros_precificacao, (select count(*) from usuarios) as usuarios, (select count(*) from drizzle.__drizzle_migrations) as migracoes_aplicadas, (select saldo_inicial_centavos from configuracao_financeira) as saldo_inicial_centavos, (select taxa_cartao_pontos_base from configuracao_financeira) as taxa_cartao_pontos_base;"
```

**O que você deve ver:** **`migracoes_aplicadas = 32`** (`0000` a `0031`) e os outros números. **Anote todos.**
Depois da limpeza eles têm de continuar iguais, menos o saldo, que vai a 0. Se `migracoes_aplicadas` for diferente de
32, **pare** e chame.

### Passo B5 — Backup agora

```bash
./scripts/backup.sh --agora
```

**O que você deve ver:** nenhuma saída.

### Passo B6 — O backup terminou bem

```bash
echo $?
```

**O que você deve ver:** **`0`**. Qualquer outro número: **pare aqui**. Sem backup, não há limpeza.

### Passo B7 — O backup chegou inteiro ao destino externo

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -x -c "select quando, sucesso, destino_externo_ok, bytes, fotos_bytes, fotos_destino_externo_ok, anexos_bytes, anexos_destino_externo_ok from execucoes_backup order by quando desc limit 1;"
```

**O que você deve ver:** `quando` com o horário de agora, **`sucesso = t`**, **`destino_externo_ok = t`**, `bytes`
maior que zero e os dois **`_destino_externo_ok = t`**. Se as pastas tiverem arquivos, `fotos_bytes` e
`anexos_bytes` aparecem maiores que zero. Se aparecer algum `f`: **pare aqui**.

### Passo B8 — A rota do backup diz que está tudo certo

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://amassacerrado.com.br/api/health/backup
```

**O que você deve ver:** **`200`**. Se não for: **pare aqui**.

### Passo B9 — Anotar o nome do dump de agora (é o caminho de volta)

```bash
ls -lt /opt/amassa/backups/ | head -3
```

**O que você deve ver:** no topo, um arquivo `amassa-AAAA-MM-DD-HHMM.sql.gz` com a data e a hora de agora.
**Anote o nome exato.** Se precisar desfazer a limpeza, é ele que volta.

### Passo B10 — Cópia local das duas pastas, antes de apagar

```bash
sudo tar -czf /opt/amassa/backups/arquivos-antes-da-limpeza-$(date +%Y-%m-%d).tar.gz -C /opt/amassa/dados fotos-orcamentos anexos-fornecedores
```

**O que você deve ver:** nenhuma saída. O `sudo` pode pedir a sua senha.

### Passo B11 — A cópia existe

```bash
sudo ls -l /opt/amassa/backups/arquivos-antes-da-limpeza-$(date +%Y-%m-%d).tar.gz
```

**O que você deve ver:** o arquivo, com tamanho maior que zero. Com as pastas vazias, ele fica pequeno, mas nunca 0.
Se o arquivo não existir: **pare aqui**.

### Passo B12 — O ensaio (não grava nada)

```bash
docker compose run --rm ferramentas npm run limpeza-geral
```

**O que você deve ver:**

- `Banco: …/amassa`. O host é o que a `DATABASE_URL_MIGRACAO` do `.env` diz, e o roteiro não tenta adivinhar. O que
  importa é o fim: **`/amassa`**;
- `Modo: ensaio — nada será gravado.`;
- uma linha por tabela no formato `nome  antes → depois`. Os números da esquerda batem com os que você anotou nos
  Passos B3 e B4, e as tabelas que mudam vêm marcadas com `(muda)`;
- `Itens do sistema que ficam no catálogo (6):`, com os seis nomes e os preços;
- o saldo inicial indo a R$ 0,00, com a taxa do cartão e a data ficando;
- no fim, **`Ensaio — nada foi gravado.`**

**Se aparecer `Recusado`** (por exemplo, por tabela que a limpeza não conhece): nada foi gravado. **Pare** e cole a
saída inteira para o Code.

### Passo B13 — A limpeza, gravando

```bash
docker compose run --rm ferramentas npm run limpeza-geral -- --confirmar --banco amassa
```

**O que você deve ver:** o mesmo relatório do ensaio, com `Modo: GRAVAR (--confirmar).` no começo e **`Limpeza
gravada.`** no fim.

**Se der `Recusado`:** nada foi gravado.

- Se a recusa falar de **backup**, por exemplo porque passaram mais de 3 horas desde o B5, refaça a partir do Passo
  B5 e volte aqui.
- Se for qualquer outra recusa, ou outro erro, **pare** e cole a saída para o Code.
- Se aparecer `O banco estava ocupado com outra operação`, espere um minuto e repita este passo.

### Passo B14 — O comando terminou bem

```bash
echo $?
```

**O que você deve ver:** **`0`**.

### Passo B15 — Contagem DEPOIS: o que sumiu

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -x -c "select (select count(*) from documentos) as documentos, (select count(*) from parcelas) as parcelas, (select count(*) from contas_fixas) as contas_fixas, (select count(*) from itens_catalogo) as itens_catalogo, (select count(*) from itens_catalogo where chave_do_sistema is not null) as itens_do_sistema, (select count(*) from fichas_precificacao) as fichas_precificacao, (select count(*) from clientes) as clientes, (select count(*) from fornecedores) as fornecedores, (select count(*) from fornos) as fornos, (select count(*) from queimas) as queimas, (select count(*) from ordens_producao) as ordens_producao, (select count(*) from orcamentos) as orcamentos, (select count(*) from movimentacoes_estoque) as movimentacoes_estoque, (select count(*) from turmas) as turmas, (select count(*) from eventos) as eventos, (select count(*) from lembretes) as lembretes;"
```

**O que você deve ver:** **tudo `0`**, menos **`itens_catalogo = 6`** e **`itens_do_sistema = 6`**.

### Passo B16 — Contagem DEPOIS: o que ficou

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -x -c "select (select count(*) from abertura_itens) as abertura_itens, (select count(*) from abertura_tarefas) as abertura_tarefas, (select count(*) from abertura_configuracao) as abertura_configuracao, (select count(*) from cotacao_categorias) as cotacao_categorias, (select count(*) from cotacoes) as cotacoes, (select count(*) from categorias) as categorias, (select count(*) from parametros_precificacao) as parametros_precificacao, (select count(*) from usuarios) as usuarios, (select count(*) from drizzle.__drizzle_migrations) as migracoes_aplicadas, (select saldo_inicial_centavos from configuracao_financeira) as saldo_inicial_centavos, (select taxa_cartao_pontos_base from configuracao_financeira) as taxa_cartao_pontos_base;"
```

**O que você deve ver:** os mesmos números que você anotou no Passo B4. As duas exceções esperadas são
**`saldo_inicial_centavos = 0`** e `taxa_cartao_pontos_base` igual à de antes. Se algum outro número mudou: **pare**
e chame.

### Passo B17 — Apagar o conteúdo da pasta das fotos de orçamento (a pasta fica)

```bash
sudo find /opt/amassa/dados/fotos-orcamentos -mindepth 1 -delete
```

**O que você deve ver:** nenhuma saída. Confira o caminho, letra por letra, antes de apertar Enter. O `-mindepth 1`
apaga o que está **dentro** da pasta e deixa a pasta.

### Passo B18 — Apagar o conteúdo da pasta dos anexos dos fornecedores (a pasta fica)

```bash
sudo find /opt/amassa/dados/anexos-fornecedores -mindepth 1 -delete
```

**O que você deve ver:** nenhuma saída.

### Passo B19 — As duas pastas ficaram vazias

```bash
sudo find /opt/amassa/dados/fotos-orcamentos /opt/amassa/dados/anexos-fornecedores -mindepth 1 | wc -l
```

**O que você deve ver:** **`0`**.

### Passo B20 — As duas pastas continuam com dono e permissão certos

```bash
stat -c '%a %u:%g %n' /opt/amassa/dados/fotos-orcamentos /opt/amassa/dados/anexos-fornecedores
```

**O que você deve ver:** duas linhas, as duas com **`755 100:101`**. O app grava como o usuário `100` (`nextjs`) e
precisa disso.

**Se não vier assim** (Roteiros 12 e 19), rode, um por vez, na pasta que estiver errada:

```bash
sudo chown 100:101 /opt/amassa/dados/fotos-orcamentos
```

```bash
sudo chmod 755 /opt/amassa/dados/fotos-orcamentos
```

Para a de anexos, use os mesmos dois comandos com `/opt/amassa/dados/anexos-fornecedores`. Depois repita o B20.

### Passo B21 — Conferir de fora: o sistema

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://amassacerrado.com.br/api/health
```

**O que você deve ver:** **`200`**.

### Passo B22 — Conferir de fora: as Queimas (o item do sistema)

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://amassacerrado.com.br/api/health/queimas
```

**O que você deve ver:** **`200`**. Um `503` aqui quer dizer que o item "Queima externa P" sumiu. **Pare** e chame.

### Passo B23 — Conferir de fora: o backup

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://amassacerrado.com.br/api/health/backup
```

**O que você deve ver:** **`200`**.

### Passo B24 — Conferir de fora: o site

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://amassacerrado.com.br/
```

**O que você deve ver:** **`200`**.

### Passo B25 — No navegador

Abra `https://amassacerrado.com.br/gestao`, entre com a sua conta (as senhas não mudaram) e confira:

- **Início:** as anotações da casa vazias e nenhum lembrete;
- **Caixa:** nenhum lançamento e o saldo em **R$ 0,00**;
- **Catálogo:** só os 6 itens do sistema, com os preços de antes;
- **Abertura do Espaço** e **Comparador de Compras:** como estavam antes;
- **o site** (`https://amassacerrado.com.br/`): a seção "Aulas e oficinas" com os três cartões, sem calendário. Pode
  levar até 5 minutos para aparecer.

**Observação para os próximos dias:** o backup da madrugada seguinte vai registrar `fotos_bytes` e `anexos_bytes`
iguais a `0`. Isso é normal, porque as pastas estão vazias, e `/api/health/backup` continua `200`. O destino externo
(o Drive) **guarda as cópias antigas** dos arquivos, porque o `rclone copy` do backup nunca apaga do remoto.

A cópia `arquivos-antes-da-limpeza-*.tar.gz` fica em `/opt/amassa/backups/`. A rotação do backup só apaga os
`amassa-*.sql.gz`, então essa cópia não some sozinha. Apague-a à mão quando tiver certeza de que não vai precisar.

---

## Se der errado: o caminho de volta

**1. Recusa ou erro no ensaio (B12) ou na execução (B13):** **nada foi gravado.** A limpeza roda numa transação só:
ou grava tudo, ou não grava nada. Cole a saída para o Code.

**2. Desfazer DEPOIS de gravado.** Restaurar devolve **tudo** ao momento do backup do Passo B5. O que alguém lançou
depois disso **se perde**. Use o nome do dump anotado no Passo B9. Os comandos vão um por vez, na ordem.

Parar o app (o banco continua no ar):

```bash
docker compose stop app
```

Ver o que seria perdido (sem `--confirmar`, não grava nada):

```bash
/opt/amassa/scripts/restaurar.sh --arquivo /opt/amassa/backups/<O-DUMP-ANOTADO-NO-B9> --banco amassa
```

Restaurar de verdade:

```bash
/opt/amassa/scripts/restaurar.sh --arquivo /opt/amassa/backups/<O-DUMP-ANOTADO-NO-B9> --banco amassa --confirmar
```

Subir o app de novo:

```bash
docker compose start app
```

Devolver os arquivos das duas pastas a partir da cópia do Passo B10. O `restaurar.sh` também tenta trazer as fotos e
os anexos do destino externo; esta cópia local é o caminho que não depende dele:

```bash
sudo tar -xzf /opt/amassa/backups/arquivos-antes-da-limpeza-<AAAA-MM-DD>.tar.gz -C /opt/amassa/dados
```

Conferir dono e permissão das pastas, que devem voltar como **`755 100:101`**:

```bash
stat -c '%a %u:%g %n' /opt/amassa/dados/fotos-orcamentos /opt/amassa/dados/anexos-fornecedores
```

Depois, repita os Passos B21 a B25. Os números do B15 e do B16 devem voltar a ser os que você anotou nos Passos B3 e
B4.

**3. Restauração de verdade, com o servidor perdido:** Roteiro 3, §13 (`docs/operacao/03-backup-e-restauracao.md`).

Se nenhum caso descreve o que você vê: **pare e chame** antes de improvisar em produção.

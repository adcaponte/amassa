# Roteiro 19 — Os Fornecedores: a pasta dos anexos, a publicação e a migração `0028`

**Quando rodar:** **uma vez**, para publicar a Fase 06.2 (Fornecedores), num dia em que a plataforma
**continua fora de uso real**, com o backup feito por você e olhando. **Nunca pelo pipeline.** Escrito em
03/10/2026 pelo plano `06.2-13`, sem ter sido rodado, no molde do Roteiro 18
(`docs/operacao/18-migracao-dispensa-do-uso-livre.md`) e do Roteiro 12
(`docs/operacao/12-fotos-volume-e-backup.md`, que criou a pasta irmã das fotos). Se algum passo divergir do
descrito, o erro pode ser do roteiro: **pare naquele passo** e não improvise.

**Antes do Passo 1, o Passo 0:** leia a Parte 0 de
`.planning/phases/06.2-fornecedores/06.2-VERIFICACAO-HUMANA.md` (as decisões tomadas sem você) e responda.
Se trocar alguma, o executor ajusta no branch e roda `npm run verificar` — só depois disso este roteiro segue.

---

## Resumo

O que este roteiro faz, na ordem: guarda e contagem → backup → **criar a pasta dos anexos no host, com a
posse do usuário do contêiner, ANTES do deploy** → publicar o branch `gsd/phase-06.2-fornecedores` → esperar o
job `implantar` terminar → migrar logo em seguida → re-extrair os scripts de backup do host → conferir a
escrita na pasta → conferir de fora e de dentro → backup de novo e a cópia externa.

**O que a `0028_fornecedores.sql` faz no banco — só acrescenta.**

- **Duas tabelas novas:** `fornecedores` (o cadastro) e `fornecedor_anexos` (os arquivos), e o tipo
  `tipo_anexo_fornecedor` (`tabela`, `catalogo`, `nota`, `outro`).
- **`documentos` ganha `fornecedor_id`, que aceita vazio** — toda venda e despesa passa por essa tabela.
  Nenhuma despesa antiga ganha fornecedor (nada retroativo). Dois checks novos:
  `documentos_fornecedor_exige_pessoa_nome` e `documentos_fornecedor_so_em_despesa`.
- 🔴 **`execucoes_backup` ganha `anexos_bytes` e `anexos_destino_externo_ok`, que aceitam vazio (D-05).**
  É a tabela onde o backup do host registra cada execução. Por isso a ordem dos Passos 5 e 6 importa: o
  `backup.sh` novo grava essas duas colunas e falharia antes da migração.
- **`revoke delete on fornecedores from amassa_app`:** fornecedor nunca se apaga, desativa. Anexo se apaga
  (é o único "apagar" do módulo).
- **Nada é apagado nem renomeado.** O código de antes funciona sobre o banco novo.
- **Provada, não aplicada.** Rodou no Postgres efêmero de `npm run test:migracoes` e em toda execução do
  e2e. Em produção, só você a aplica.

### 🔴 A `0027` (Roteiro 18) vem antes — e, no estado medido, entra junto

A `0027_dispensa-do-uso-livre.sql` (Roteiro 18) precisa estar aplicada antes da `0028`, ou ser aplicada
**na mesma sessão** de migração. O migrador aplica **todas as pendentes, em ordem, numa transação só**: um
único `db:migrate` aplica a `0027` e depois a `0028`, ou nenhuma das duas.

**Estado medido em 03/10/2026, 02h17 UTC (02/10, 23h17 em Brasília), no computador, sem tocar o servidor:**

- `git log origin/main..main --oneline` lista **6 commits não publicados**, entre eles
  `c008b1d feat(agenda): migração 0027 — dispensa do uso livre (versionada, não aplicada)` e
  `534afd2 feat(agenda): Dispensar do uso livre na tela e em Dispensadas; Roteiro 18 (quick 261002-sdt)`.
  Ou seja: **o Roteiro 18 ainda não foi rodado** — a `0027` nem chegou à imagem `ferramentas`.
- `git ls-tree origin/main db/migrations/ | grep -c 0027` → `0` (a `0027` não está no que foi publicado).
- `curl https://amassacerrado.com.br/api/health/agenda` → `200`. **Isso NÃO prova a `0027`:** a versão no
  ar da rota (`git show origin/main:app/api/health/agenda/route.ts | grep -c dispensad` → `0`) ainda não lê
  `dispensada_em`. O `200` de hoje prova só a `0026`.
- `curl https://amassacerrado.com.br/api/health/fornecedores` → `404` (a rota ainda não foi publicada).

**O que fazer em cada caso** (confira no Passo 1.4 — é o número de migrações aplicadas que decide):

| `migracoes_aplicadas` no Passo 1.4 | Situação | O que fazer |
|---|---|---|
| **27** (o esperado pelo estado medido) | Nem a `0027` nem a `0028` aplicadas | Siga este roteiro: o `git push` do Passo 4 publica **junto** os commits do Roteiro 18; o Passo 5 aplica as duas; o Passo 8 faz também a conferência do Roteiro 18 (8.4). **Não rode o Roteiro 18 separado.** |
| **28** | A `0027` já aplicada (você rodou o Roteiro 18 antes) | Siga este roteiro; no Passo 5 entra só a `0028`; pule o 8.4. Depois do Passo 5, o número esperado é **29** nos dois casos. |
| outro | Algo diferente do que este roteiro supõe | **Pare e chame.** |

### 🔴 A janela — a do Pitfall 12, maior que a do Roteiro 18

Entre o fim do job `implantar` (Passo 4) e o fim do `db:migrate` (Passo 5), o **código novo roda sobre o
banco velho**. Nesse intervalo:

- **Todo `insert` em `documentos` falha** — vendas no Caixa, despesas, "Recebi agora" e "Lançar na Venda"
  da Agenda, contas fixas — porque o Drizzle lista a coluna nova `fornecedor_id` em todo `insert`. A
  Agenda falha também pela `0027` (o Roteiro 18 descreve).
- **`/api/health/fornecedores` fica `503`** — é o sinal de que a migração falta.
- **`/api/health/backup` também fica `503`**: desde esta fase ele lê `execucoes_backup.anexos_destino_externo_ok`,
  que só existe depois da `0028`. Se o monitor externo avisar nessa janela, é isto.

Por isso: **publicar e migrar numa sessão só**, com você olhando, e **ninguém lança nada** do Passo 2 ao
Passo 8. Migrar **antes** do `implantar` também seria seguro (as duas migrações só acrescentam), mas a
imagem `ferramentas` só traz a `0028` depois que o job `imagem` publica — este roteiro segue a ordem que os
Roteiros 15 a 18 já provaram: publicar, esperar o `implantar`, migrar logo em seguida.

**Como ler cada passo:** cada comando com **o que faz** e **o que você deve ver**. Os comandos do servidor
rodam na sessão SSH como `theo`, em `/opt/amassa`; migração e scripts saem da imagem `ferramentas`, com
`docker compose run --rm ferramentas` (**nunca** `docker compose exec app` para migrar). Nenhum comando pede
credencial e nenhuma aparece aqui.

---

## Passo 1 — Guarda e contagem ANTES

**1.1 — Servidor e banco certos** (no servidor):

```bash
hostname
whoami
cd /opt/amassa
ls -d /opt/amassa/dados/fotos-orcamentos
docker compose exec postgres psql -U amassa_owner -d amassa -c "select current_database();"
```

**O que faz:** confirma que a sessão está no VPS de produção, no banco `amassa` — os passos seguintes
criam pasta, mudam posse e migram o banco; o comando certo no lugar errado não tem desfazer fácil.

**O que você deve ver:** o host do VPS (não o nome do seu computador), `theo`, a pasta irmã das fotos
listada sem erro, e `amassa`. Qualquer outra coisa: **pare aqui**.

**1.2 — A plataforma continua fora de uso real?**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select tipo, count(*) as quantos, max(data) as ultimo_dia from documentos where cancelado_em is null and data >= current_date - 14 group by tipo order by tipo;"
```

**O que você deve ver:** só lançamentos que você reconhece como teste. 🔴 **Alguém está usando a
plataforma de verdade hoje (vendas reais no Caixa)? Se sim, PARE e fale com o Theo antes** — na janela do
Passo 4 ao Passo 5 nenhuma venda nem despesa grava.

**1.3 — Contagem ANTES** (anote os quatro números):

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select (select count(*) from documentos) as documentos, (select count(*) from parcelas) as parcelas, (select count(*) from execucoes_backup) as execucoes_backup, (select count(*) from drizzle.__drizzle_migrations) as migracoes_aplicadas;"
```

**O que você deve ver:** quatro números. Depois do Passo 8, `documentos` e `parcelas` têm de ser **iguais**
a estes; `execucoes_backup` cresce **um** por backup que você rodar (o do Passo 2, e o do Passo 9).

**1.4 — Quantas migrações já estão aplicadas** — é o `migracoes_aplicadas` do 1.3:

- **27** (`0000` a `0026`; medido pelo Passo 7 do Roteiro 17 em 02/10/2026) → a `0027` ainda falta; ela entra
  junto no Passo 5 (veja a tabela do topo).
- **28** → o Roteiro 18 já foi rodado; só a `0028` entra.
- Outro número → **pare e chame.**

---

## Passo 2 — Backup, antes de tocar em qualquer coisa

```bash
cd /opt/amassa
./scripts/backup.sh --agora
echo $?
docker compose exec postgres psql -U amassa_owner -d amassa -c "select quando, sucesso, destino_externo_ok, fotos_destino_externo_ok from execucoes_backup order by quando desc limit 1;"
ls -la /opt/amassa/backups/ | tail -5
```

**O que faz:** o dump do banco e a cópia das fotos, com o script que está hoje no host (o velho — ele ainda
não conhece os anexos, e está certo assim até o Passo 6).

**O que você deve ver:** nenhuma saída do backup, `0` no `echo`, uma linha com `sucesso = t` e o horário
de agora, e o arquivo de hoje com tamanho na mesma ordem dos anteriores. **Sem backup verificado (linha E
tamanho), não siga.** Daqui até o fim do Passo 8, ninguém lança nada na plataforma.

---

## Passo 3 — Criar a pasta dos anexos e dar a posse, ANTES do deploy

```bash
mkdir -p /opt/amassa/dados/anexos-fornecedores
sudo chown 100:101 /opt/amassa/dados/anexos-fornecedores
sudo chmod 750 /opt/amassa/dados/anexos-fornecedores
ls -ld /opt/amassa/dados/anexos-fornecedores
stat -c '%u %g %a' /opt/amassa/dados/anexos-fornecedores
```

**O que faz:** cria a pasta do host que o `compose.yml` novo monta em `/dados/anexos-fornecedores` dentro do
contêiner `app`, e a entrega ao usuário `nextjs` da imagem — **uid 100, gid 101**, os mesmos da pasta das
fotos (Roteiro 12, Passo 4). Por número, não por nome: esse usuário só existe dentro da imagem.

🔴 **Por que antes do deploy:** se o `implantar` subir o contêiner novo e a pasta não existir, o Docker cria a
origem do bind mount sozinho, como **`root:root`** — e todo envio de anexo falha por permissão. (Se isso
acontecer, os mesmos três comandos acima corrigem: `chown` e `chmod` com `sudo` sobre a pasta que o Docker
criou, e o Passo 7 confere.)

🔴 **O `sudo` do `chmod` não é enfeite** (a lição do Roteiro 12, 27/09/2026): depois do `chown` você deixa de
ser dono da pasta, e só o dono ou o root mudam a permissão.

**O que você deve ver:** nenhuma saída nos três primeiros; no `ls -ld`, `drwxr-x---` com dono e grupo
`dhcpcd messagebus` (é como o Debian deste VPS chama o uid 100 e o gid 101 — parece errado e está certo);
no `stat`, **`100 101 750`**.

---

## Passo 4 — Publicar (no seu computador) e esperar o `implantar` TERMINAR

```bash
cd <a pasta do projeto no seu computador>
git status
git checkout main
git fetch
git log origin/main..main --oneline
git log main..gsd/phase-06.2-fornecedores --oneline | wc -l
git merge --no-ff gsd/phase-06.2-fornecedores -m "Merge da Fase 06.2 (Fornecedores): gsd/phase-06.2-fornecedores em main — Roteiro 19"
git log origin/main..main --oneline | head -20
git push
gh run list --limit 3
```

**O que faz:** confirma que não há nada a meio, mostra o que vai junto, integra o branch da fase no `main`
local e publica. O `push` dispara "Entrega contínua" (`qualidade`, `e2e`, `imagem`, `implantar`).

**O que você deve ver:**

- `nothing to commit, working tree clean`.
- No primeiro `git log origin/main..main`: os commits do quick `261002-sdt` (o Roteiro 18; medido em
  03/10/2026: 6 commits, de `c008b1d` a `0b6bdd4`) — ou nada, se você já os publicou. **Um commit que você
  não reconhece: pare e pergunte.**
- No `wc -l`: o número de commits da fase — 60 às 02h17 UTC de 03/10/2026, no meio do plano 13; o plano
  acrescenta os seus (a rota, a correção de um teste, a documentação do portão), e o número ao fim dele está
  no `06.2-13-SUMMARY.md`. Mais que isso só se o branch tiver mudado depois (uma troca da Parte 0).
- O `merge` sem conflito (o `main` é ancestral do branch: medido com `git merge-base --is-ancestor`).
- Depois do `push`, repita `gh run list` até o run ficar **`completed  success`** nos quatro jobs (uns 20 a
  30 minutos).

**O que o `implantar` traz sozinho:** o `compose.yml` do servidor é ressincronizado a cada deploy — o bind
mount novo (`/opt/amassa/dados/anexos-fornecedores:/dados/anexos-fornecedores`) e a variável
`CAMINHO_ANEXOS_FORNECEDORES` (com padrão no próprio `compose.yml`) chegam com ele. **Nada a editar à mão;
o `.env` não muda.** Para conferir depois que o `implantar` ficar verde (no servidor):

```bash
grep -n "anexos-fornecedores" /opt/amassa/compose.yml
docker compose ps app
```

**O que você deve ver:** duas linhas (o bind mount e a variável) e o `app` em `Up` com horário de início
recente.

> 🔴 **A janela abre quando o `implantar` fica verde** (Pitfall 12 — veja o topo): vendas e despesas param,
> `/api/health/fornecedores` e `/api/health/backup` ficam `503`. **Vá direto ao Passo 5.** Vermelho em
> `qualidade`, `e2e` ou `imagem`: o app no ar continua o antigo e o banco está intacto — **não migre**,
> chame. Se for a janela conhecida da fonte, `gh run rerun <id> --failed`.

---

## Passo 5 — `db:migrate`, logo em seguida

```bash
cd /opt/amassa
docker compose pull ferramentas
docker compose run --rm ferramentas ls db/migrations | grep -E "0027|0028"
docker compose run --rm ferramentas npm run db:migrate
echo $?
```

**O que faz:** baixa a `ferramentas` do run do Passo 4 (o `implantar` só puxa o `app`), confere que as duas
migrações estão dentro dela e aplica as pendentes **numa transação só**: a `0027` (se o Passo 1.4 deu 27) e
a `0028`.

**O que você deve ver:** `0027_dispensa-do-uso-livre.sql` e `0028_fornecedores.sql` no `grep` (**faltou a
`0028`? pare** — a imagem é velha e o `db:migrate` diria sucesso sem aplicar nada); depois **`Migrações
aplicadas com sucesso.`** e **`0`**. A mensagem é a mesma tenha ele aplicado duas migrações ou nenhuma — quem
prova é o Passo 8.

**Saiu diferente de `0`:** **pare**, copie a saída inteira e vá ao Passo 10 — nada ficou aplicado.

---

## Passo 6 — Re-extrair `backup.sh` e `restaurar.sh` da `ferramentas`, DEPOIS do `db:migrate`

```bash
cd /opt/amassa
docker compose run --rm -T ferramentas cat scripts/backup.sh > /opt/amassa/scripts/backup.sh
docker compose run --rm -T ferramentas cat scripts/restaurar.sh > /opt/amassa/scripts/restaurar.sh
chmod +x /opt/amassa/scripts/backup.sh /opt/amassa/scripts/restaurar.sh
ls -l /opt/amassa/scripts/backup.sh /opt/amassa/scripts/restaurar.sh
head -n 1 /opt/amassa/scripts/backup.sh /opt/amassa/scripts/restaurar.sh
grep -c "anexos-fornecedores" /opt/amassa/scripts/backup.sh /opt/amassa/scripts/restaurar.sh
```

**O que faz:** os scripts do host são **cópias** extraídas da imagem (Roteiro 3, passo 6) e não se atualizam
sozinhos. Os novos copiam também a pasta dos anexos para o destino externo (`backup.sh`) e a trazem de volta
(`restaurar.sh`), e o `backup.sh` grava `anexos_bytes` e `anexos_destino_externo_ok`.

🔴 **Por que depois do Passo 5, nunca antes:** o `backup.sh` novo grava duas colunas que só existem depois da
`0028`. Antes dela, o `insert` do registro falharia, a execução não ficaria registrada, e o alarme de idade
de `/api/health/backup` dispararia no dia seguinte.

**O que você deve ver:** nenhuma saída nos três primeiros; `backup.sh` com cerca de **13,6 kB** e
`restaurar.sh` com cerca de **9,3 kB** (medidos no branch em 03/10/2026: 13 605 e 9 339 bytes); `#!/bin/sh`
na primeira linha dos dois; e um número maior que zero para cada um no `grep -c`. **Arquivo de `0` byte ou
`grep` com `0`:** a `ferramentas` local é velha — refaça o `docker compose pull ferramentas` do Passo 5 e
extraia de novo.

---

## Passo 7 — Conferência de escrita na pasta, pelo contêiner `app`

```bash
docker compose exec app sh -c 'echo ok > /dados/anexos-fornecedores/.teste-escrita && cat /dados/anexos-fornecedores/.teste-escrita && rm /dados/anexos-fornecedores/.teste-escrita'
```

**O que faz:** grava, lê e apaga um arquivo de teste **dentro do contêiner, como o usuário dele** (`nextjs`)
— a prova de que a posse do Passo 3 está certa antes de qualquer anexo de verdade.

**O que você deve ver:** a palavra `ok`, sem erro. **`Permission denied`:** a pasta foi criada pelo Docker
como `root` (o deploy subiu antes do Passo 3) ou a posse não pegou — refaça os comandos do Passo 3 e repita
este.

---

## Passo 8 — Conferir: de fora e de dentro

**8.1 — De fora** (de qualquer lugar):

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://amassacerrado.com.br/api/health/fornecedores
curl -s https://amassacerrado.com.br/api/health/fornecedores
curl -s -o /dev/null -w "%{http_code}\n" https://amassacerrado.com.br/api/health/agenda
curl -s -o /dev/null -w "%{http_code}\n" https://amassacerrado.com.br/api/health
```

**O que você deve ver:** `200`, `{"status":"ok"}`, `200`, `200`. A rota dos Fornecedores só responde `200`
se a tabela dos anexos, a coluna `fornecedor_id` de `documentos` e a coluna `anexos_destino_externo_ok` de
`execucoes_backup` existem — as três nascem na `0028`. Era `503` entre o Passo 4 e o Passo 5 (e `404` antes
do Passo 4). **`503` agora:** a migração não aplicou; volte ao Passo 5. A da Agenda, desde a `0027`, lê
`usos_livres.dispensada_em` — `200` prova também a `0027`.

`/api/health/backup` já deve responder `200` aqui: a última linha de `execucoes_backup` é a do Passo 2, com
as colunas novas vazias, e vazio cai direto na conferência de idade (`lib/backup/frescor.ts`). Se responder
`503`, anote a frase do `motivo` e siga — o Passo 9 é quem decide.

**8.2 — De dentro, por SQL — as tabelas, as permissões, nada retroativo:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select table_name from information_schema.tables where table_schema = 'public' and table_name in ('fornecedores', 'fornecedor_anexos') order by table_name;"
docker compose exec postgres psql -U amassa_owner -d amassa -c "select has_table_privilege('amassa_app', 'fornecedores', 'DELETE') as apaga_fornecedor, has_table_privilege('amassa_app', 'fornecedor_anexos', 'DELETE') as apaga_anexo, has_table_privilege('amassa_app', 'fornecedores', 'INSERT') as cadastra_fornecedor;"
docker compose exec postgres psql -U amassa_owner -d amassa -c "select count(*) as despesas_com_fornecedor from documentos where fornecedor_id is not null;"
docker compose exec postgres psql -U amassa_owner -d amassa -c "select column_name, data_type, is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'execucoes_backup' and column_name in ('anexos_bytes', 'anexos_destino_externo_ok') order by column_name;"
```

**O que você deve ver:**

- as **duas** tabelas, `fornecedor_anexos` e `fornecedores`;
- `apaga_fornecedor = f` (o `revoke delete`), `apaga_anexo = t` (tirar anexo é o único "apagar"),
  `cadastra_fornecedor = t`;
- `despesas_com_fornecedor = 0` — nenhuma despesa antiga ganhou fornecedor;
- as **duas** colunas de `execucoes_backup`, `anexos_bytes` (`bigint`) e `anexos_destino_externo_ok`
  (`boolean`), ambas `is_nullable = YES`.

**8.3 — As contagens, comparadas com o Passo 1.3:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select (select count(*) from documentos) as documentos, (select count(*) from parcelas) as parcelas, (select count(*) from execucoes_backup) as execucoes_backup, (select count(*) from drizzle.__drizzle_migrations) as migracoes_aplicadas;"
```

**O que você deve ver:** `documentos` e `parcelas` **iguais** aos do Passo 1.3; `execucoes_backup` = o do
1.3 **+ 1** (o backup do Passo 2); `migracoes_aplicadas = 29`. **`documentos` ou `parcelas` diferentes:**
alguém lançou na janela, ou algo se perdeu — pare e chame antes de qualquer outra coisa.

**8.4 — Só se a `0027` entrou junto (Passo 1.4 deu 27): a conferência do Roteiro 18.** Rode os dois primeiros
comandos do Passo 5.2 do Roteiro 18 (`docs/operacao/18-migracao-dispensa-do-uso-livre.md`) e espere o que
ele descreve: três colunas em `usos_livres`, todas `is_nullable = YES`, e quatro restrições. E, no celular,
o 5.3 dele (Agenda → "A receber" abre sem erro).

---

## Passo 9 — Backup de novo, a vigia e a cópia externa dos anexos

**9.1 — Agora (com os scripts novos):**

```bash
cd /opt/amassa
./scripts/backup.sh --agora
echo $?
docker compose exec postgres psql -U amassa_owner -d amassa -c "select quando, sucesso, destino_externo_ok, fotos_destino_externo_ok, anexos_bytes, anexos_destino_externo_ok from execucoes_backup order by quando desc limit 1;"
curl -s -o /dev/null -w "%{http_code}\n" https://amassacerrado.com.br/api/health/backup
curl -s https://amassacerrado.com.br/api/health/backup
```

**O que você deve ver:** nenhuma saída e `0`; uma linha com `sucesso = t`, o horário de agora,
**`anexos_bytes = 0`** e **`anexos_destino_externo_ok = t`** (a pasta está vazia; pasta vazia não tem o que
copiar e conta como sucesso); e `/api/health/backup` **`200`**, com `"status":"ok"`. `anexos_bytes` vazio
(não `0`): o `backup.sh` é o velho — volte ao Passo 6.

**9.2 — Depois que a caminhada (Parte 2) subir o primeiro anexo:**

```bash
cd /opt/amassa
ls -la /opt/amassa/dados/anexos-fornecedores/
./scripts/backup.sh --agora
echo $?
rclone lsl amassa-backup:amassa/anexos-fornecedores/
curl -s -o /dev/null -w "%{http_code}\n" https://amassacerrado.com.br/api/health/backup
```

**O que faz:** confere que o anexo de verdade está no host, que o backup o leva para o destino externo, e que
a vigia continua verde.

**O que você deve ver:** o arquivo na pasta (nome `<uuid>.pdf`, `.jpg` ou da planilha, dono `dhcpcd`); `0`;
o **mesmo arquivo** listado pelo `rclone lsl`, com o mesmo tamanho; e `200`. O destino é a pasta irmã das
fotos na conta do dump — `amassa-backup:amassa/fotos/` no Roteiro 12, aqui `.../anexos-fornecedores/`
(derivada de `RCLONE_REMOTE`; se você tiver posto `RCLONE_REMOTE_ANEXOS` no `.env`, é ela).
**`rclone lsl` vazio com o arquivo na pasta:** a cópia falhou — `/api/health/backup` deve estar `503` com a
frase "A cópia externa dos anexos dos fornecedores falhou na última execução."; copie a saída e chame.

---

## Passo 10 — Se der errado: o caminho de volta

- **A migração falhou (Passo 5, código diferente de `0`).** **Nada ficou aplicado** — nem a `0027` nem a
  `0028` (transação única). O app novo está no ar sobre o banco velho: a janela continua. Ou corrija para a
  frente (copie a saída e chame; a correção é commit novo, `npm run verificar`, `git push`, e de volta ao
  Passo 5), ou volte o app:

  ```bash
  git log --oneline -5
  git revert -m 1 <o hash do merge do Passo 4>
  git push
  ```

  e espere o run verde. Isso tira a Fase 06.2 do ar. **Se a `0027` também estava pendente**, os commits do
  Roteiro 18 continuam no ar e a Agenda continua falhando em parte: reverta-os também, do mais novo ao mais
  antigo, como o Passo 6 do Roteiro 18 descreve. O banco nunca mudou.
- **Falha depois da migração** (`503` com o `db:migrate` em `0`, SQL que não bate, telas quebradas). Como a
  `0028` só acrescenta, **o código antigo funciona sobre o banco novo**: reverter a publicação
  (`git revert -m 1 <merge>` + `git push`, como acima) basta, e as tabelas e colunas novas ficam vazias e sem
  uso. **Restaurar o backup do Passo 2** pelo Roteiro 3 (`./scripts/restaurar.sh`) **só se algum dado tiver
  sido estragado** — compare o 8.3 com o 1.3: iguais, não restaure. Se restaurar, use o `restaurar.sh` que
  combina com o banco que volta.
- **O envio de anexo falha por permissão** (Passo 7 ou na caminhada): Passo 3 de novo, sobre a pasta que
  existe; não precisa reverter nada.
- **A pasta do host pode ficar.** Vazia, ela não atrapalha nada; o `compose.yml` antigo nem a monta.
- **Desfazer a `0028` de vez** (se um dia você desistir dos Fornecedores): é outra migração, nova, escrita
  por um plano, provada no `test:migracoes` e aplicada por este mesmo caminho (backup antes). Nunca à mão
  no `psql`.

Se nenhum caso descreve o que você vê: **pare e chame** antes de improvisar em produção.

---

## O que NÃO muda

- **`.env`:** nada a mexer. `CAMINHO_ANEXOS_FORNECEDORES` tem padrão no `compose.yml`; a pasta remota dos
  anexos deriva de `RCLONE_REMOTE`, que já existe.
- **Caddy:** nada a mexer. O `docker/Caddyfile` não configura limite de corpo (`request_body`) — por isso o PDF
  de ~15 MB deve passar. **Se o envio grande falhar SÓ em produção** (passa no e2e, falha pelo domínio), é a
  suposição A6 da pesquisa (`06.2-RESEARCH.md`): olhe o `Caddyfile` antes de qualquer outra coisa.
- **`AUTH_URL`:** nada a mexer; a plataforma continua em `/gestao`.
- **As fotos de orçamento e o `CAMINHO_FOTOS`:** não mudam. A pasta `/opt/amassa/dados/fotos-orcamentos`, o
  limite delas e o pipeline da foto dos orçamentos são os mesmos (os achados colaterais sobre elas ficaram
  para uma tarefa separada — Parte 0 da caminhada).
- **O cron do backup:** o mesmo horário e o mesmo comando; só o script por trás dele é o novo (Passo 6).

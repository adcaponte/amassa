# Roteiro 3 — Virada de produção e backup diário

Continuação dos Roteiros 1 e 2. Este documento leva o servidor de "site no ar, banco só com a
tabela de infraestrutura da Fase 1" a duas coisas: a aplicação falando com o banco pelo papel de
acesso restrito, com as contas de gestor criadas, e o backup diário rodando sozinho, enviado para
fora do servidor e vigiado por um monitor externo. A segunda metade (passos 11 a 14) é a razão de
tudo isso existir: o dia em que você precisa restaurar um banco de verdade.

**Como ler cada passo:** o mesmo formato dos dois roteiros anteriores — cada bloco de comando vem
acompanhado de **o que faz** e **o que você deve ver** de volta. Se a tela divergir muito do
descrito, pare naquele passo e não siga para o próximo — é assim que um problema fica localizável
onde aconteceu, em vez de aparecer três passos depois sem explicação.

**Os marcadores entre `<` e `>` saem junto com o valor** — a mesma regra do Roteiro 1. Além de
`<IP_DO_SEU_VPS>`, que você já usa desde lá, este roteiro usa:

- `<NOME_DA_GESTORA>` / `<EMAIL_DA_GESTORA>` — nome completo e e-mail de cada gestora, informados
  na hora, no servidor. **Nunca escreva o nome ou e-mail real num arquivo, num commit ou nesta
  conversa** — os exemplos usam um nome inventado e o domínio reservado `exemplo.test`.
- `<ARQUIVO_MAIS_RECENTE>` — o nome do arquivo de dump mais novo, que você vê listando o diretório
  de backups ou o destino externo (por exemplo, `amassa-2026-08-09.sql.gz`).

Os comandos marcados "na sua máquina" rodam no PowerShell do Windows; os demais rodam no servidor,
na sessão SSH como `theo` — o mesmo padrão do Roteiro 2.

---

## 0. Reconferir o Auto Backup da Contabo

No encerramento da Fase 1 o painel da Contabo reportava o Auto Backup com incidente aberto —
backups atrasados, *restores* indisponíveis. Antes de seguir, confira o estado atual.

Ação de painel, não comando: entre no painel de controle da Contabo, na página do seu VPS, e
confira a aba do Auto Backup.

**O que você deve ver:** o Auto Backup listado como ativo, com a data do backup mais recente ao
lado. Se ainda estiver degradado (atrasado, ou sem *restore* disponível), **siga o roteiro assim
mesmo** — é exatamente por isso que os passos 1 a 10 abaixo existem: o Auto Backup protege a
máquina inteira, mas nunca substituiu o dump do banco, que passa a ser a única camada de proteção
enquanto ele continuar indisponível. Registre o que você viu aqui no relato ao final da execução —
não precisa entrar neste arquivo.

---

## 1. Conferir que a versão nova está no ar

A publicação é automática desde a Fase 1: o código desta fase (login, scripts de conta, rota de
saúde do backup) já foi publicado pelo pipeline assim que a `main` recebeu os commits. Confirme
antes de tocar no banco.

Na sua máquina:

```powershell
curl.exe https://amassacerrado.com.br/api/health
```

**O que você deve ver:** `{"status":"ok","banco":"ok"}` — igual ao que você já confere desde o
Roteiro 2.

```powershell
curl.exe -I https://amassacerrado.com.br/login
```

**O que você deve ver:** a primeira linha da resposta começando com `HTTP/2 200` (ou `HTTP/1.1
200`). A tela de login já está no ar, mesmo que ainda não exista nenhuma conta para entrar — isso
só se resolve no passo 5.

---

## 2. Dump manual, antes de qualquer migração

Toda migração deste projeto é precedida por um backup — a regra de
`amassa-plataforma/01-ARQUITETURA.md` §8. Mas desta vez não dá para usar
`./scripts/backup.sh --agora`: o script registra o resultado na tabela `execucoes_backup`, e é
**esta migração, no próximo passo**, que cria essa tabela. Usar o script agora falharia tentando
gravar numa tabela que ainda não existe. Este é o único momento de todo o projeto em que essa
ordem se inverte — dump manual, na mão, sem o script — e vale escrever isso aqui para não parecer
descuido.

No servidor:

```bash
cd /opt/amassa
docker compose exec -T postgres pg_dump -U amassa_owner --clean --if-exists amassa | gzip > dump-manual-antes-da-migracao-do-roteiro-03.sql.gz
```

**O que faz:** gera um dump completo do banco atual (hoje, só a tabela
`verificacao_infraestrutura` da Fase 1) e comprime, direto na pasta `/opt/amassa`.

**O que você deve ver:** nenhuma saída — sucesso silencioso, o mesmo comportamento do `pg_dump`
dentro de `scripts/backup.sh`.

Confira o tamanho antes de seguir:

```bash
ls -lh dump-manual-antes-da-migracao-do-roteiro-03.sql.gz
```

**O que você deve ver:** um arquivo com alguns kilobytes — nunca `0`. Um arquivo de tamanho zero
significa que o comando anterior falhou em silêncio; pare e refaça antes de continuar.

---

## 3. Aplicar as migrações desta fase

À mão, pelo estágio `ferramentas`, com a saída na tela — a mesma regra do Roteiro 2, passo 3. Como
você já tem o dump de segurança do passo anterior, pode seguir.

```bash
docker compose run --rm ferramentas npm run db:migrate
```

**O que você deve ver:** a saída lista as migrações aplicadas e termina com `Migrações aplicadas
com sucesso.`, saindo com código `0`. É seguro rodar mais de uma vez — o Drizzle pula o que já foi
aplicado.

Confira do lado do banco. Primeiro, as tabelas:

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c '\dt'
```

**O que você deve ver:** três tabelas — `verificacao_infraestrutura` (da Fase 1), `usuarios` e
`execucoes_backup`.

A função de data:

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select hoje_brasilia();"
```

**O que você deve ver:** uma linha com a data de hoje, no formato `AAAA-MM-DD`.

O trigger de `usuarios`:

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select tgname from pg_trigger where tgrelid = 'usuarios'::regclass and not tgisinternal;"
```

**O que você deve ver:** uma linha com `tocar_atualizado_em_usuarios`.

E o papel de aplicação:

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c '\du amassa_app'
```

**O que você deve ver:** o papel `amassa_app` listado, sem `Superuser`, sem `Create role` e sem
`Create DB` na coluna de atributos. Ele ainda está sem senha — nenhuma conexão por rede funciona
até o próximo passo definir uma.

---

## 4. Virar a conexão da aplicação para o papel de aplicação

Três movimentos, nesta ordem exata: gerar a senha, defini-la sem que ela apareça na tela, e só
depois editar o arquivo — trocar a ordem deixaria a senha nova sem lugar nenhum para morar até o
arquivo ser salvo.

Gere a senha, **no próprio servidor** — como as senhas do Roteiro 1, ela nunca deve ser digitada à
mão nem vir de outro lugar:

```bash
openssl rand -base64 32
```

**O que você deve ver:** uma linha de texto aleatório. Copie para um gerenciador de senhas antes
de seguir — **se você perder esse valor depois de definido, a saída é gerar outro, não recuperar
o antigo.**

Defina essa senha para o papel `amassa_app`, usando o comando interativo do `psql` que **pede a
senha sem exibi-la** — nunca `alter role ... password '...'` direto na linha de comando, porque ela
ficaria gravada no histórico do terminal:

```bash
docker compose exec -it postgres psql -U amassa_owner -d amassa
```

Dentro do prompt que abrir (`amassa=#`), rode:

```
\password amassa_app
```

**O que você deve ver:** duas perguntas de senha, uma para digitar e outra para confirmar. Como no
passo 1 do Roteiro 1, **a senha não aparece enquanto você digita** — nem caracteres, nem
asteriscos. É esperado; cole ou digite às cegas e aperte Enter nas duas vezes. Depois, saia do
`psql`:

```
\q
```

Agora edite o arquivo de ambiente:

```bash
nano /opt/amassa/.env
```

Acrescente a variável de migração (usa o dono do banco, a mesma senha que já está em
`POSTGRES_PASSWORD` neste arquivo) e troque `DATABASE_URL` para o papel novo:

```env
DATABASE_URL_MIGRACAO=postgresql://amassa_owner:<A_MESMA_SENHA_DE_POSTGRES_PASSWORD_JA_NESTE_ARQUIVO>@postgres:5432/amassa
DATABASE_URL=postgresql://amassa_app:<A_SENHA_QUE_VOCE_ACABOU_DE_DEFINIR_NO_PASSWORD>@postgres:5432/amassa
```

Salve e saia (`Ctrl+O`, `Enter`, `Ctrl+X`).

Recrie **apenas o serviço da aplicação** — nunca `docker compose up -d` sozinho, pela mesma razão
do Roteiro 2, passo 8:

```bash
docker compose up -d app
```

Confira pelo domínio, na sua máquina:

```powershell
curl.exe https://amassacerrado.com.br/api/health
```

**O que você deve ver:** de novo `{"status":"ok","banco":"ok"}` — é a prova imediata de que o
papel novo tem exatamente os privilégios que precisa, nem mais nem menos. Se a rota devolver erro
de banco, a causa é sempre uma destas três, nesta ordem de probabilidade:

1. A senha que você digitou no `\password` é diferente da que você colou no `.env` — redefina as
   duas de novo, com cuidado.
2. O papel `amassa_app` está sem algum privilégio esperado — confira se a migração do passo 3
   rodou sem erro.
3. O serviço `app` não foi recriado de verdade — repita `docker compose up -d app` e confira
   `docker compose ps app` para ver se o horário de início é recente.

---

## 5. Criar as contas de gestor

Pelo estágio `ferramentas`. O exemplo abaixo usa um nome inventado e o domínio reservado
`exemplo.test` — substitua pelos dados reais na hora, sem escrevê-los em lugar nenhum além do
próprio comando:

```bash
docker compose run --rm ferramentas npm run criar-usuario -- --nome "<NOME_DA_GESTORA>" --email "<EMAIL_DA_GESTORA>"
```

**O que você deve ver:** `Conta criada para <nome> <<email>>.` seguido de uma linha
`SENHA: ...`. **A senha aparece uma única vez** — copie para um gerenciador de senhas antes de
fechar o terminal ou rodar o próximo comando. Perder essa senha significa rodar
`redefinir-senha`, não recuperar.

Repita o comando para cada gestora (o dono, mais 2 a 4 pessoas — decisão D-07 da fase).

Ao final, confirme entrando pela tela de login com uma das contas:

**O que você deve ver:** no navegador, `https://amassacerrado.com.br/login` aceitando o e-mail e a
senha de uma das contas recém-criadas e abrindo a aplicação.

---

## 6. Instalar os scripts de backup no host

Eles precisam estar no **host**, fora de qualquer contêiner — quem vai disparar o backup é o
`cron` do sistema operacional (passo 9), e o Compose não tem agendador: um serviço declarado nele
roda uma vez e morre, não se repete sozinho.

Extraia os dois scripts da imagem `ferramentas` já publicada — assim a versão que fica no host é
exatamente a que está no ar, e não uma cópia colada à mão que envelhece sozinha:

```bash
mkdir -p /opt/amassa/scripts
docker compose run --rm -T ferramentas cat scripts/backup.sh > /opt/amassa/scripts/backup.sh
docker compose run --rm -T ferramentas cat scripts/restaurar.sh > /opt/amassa/scripts/restaurar.sh
```

**O que você deve ver:** nenhuma saída no terminal — o conteúdo foi para os arquivos, não para a
tela. Confira que chegou inteiro, olhando a primeira linha de cada um:

```bash
head -n 1 /opt/amassa/scripts/backup.sh /opt/amassa/scripts/restaurar.sh
```

**O que você deve ver:** `#!/bin/sh` no topo dos dois. Se vier qualquer outra coisa (uma mensagem
do Docker, uma linha em branco), o arquivo veio contaminado — apague e repita o comando de
extração.

Dê permissão de execução:

```bash
chmod +x /opt/amassa/scripts/backup.sh /opt/amassa/scripts/restaurar.sh
```

Crie o diretório de backups e a pasta mensal, e restrinja o acesso — o conteúdo é o banco inteiro
em texto:

```bash
mkdir -p /opt/amassa/backups/mensais
chmod 700 /opt/amassa/backups
```

**O que você deve ver:** nenhuma saída nos três comandos acima. Confira o resultado:

```bash
ls -ld /opt/amassa/backups
```

**O que você deve ver:** uma linha começando com `drwx------`, confirmando que só o dono (`theo`)
consegue entrar nessa pasta.

---

## 7. Configurar o envio externo

Instale o `rclone` no servidor:

```bash
curl https://rclone.org/install.sh | sudo bash
```

**O que você deve ver:** a instalação termina com uma mensagem confirmando a versão instalada.

Configure o destino:

```bash
rclone config
```

Siga o assistente: escolha `n` (novo destino), dê um nome curto para ele — este roteiro usa
`amassa-backup` como exemplo, e é o mesmo nome usado em `RCLONE_REMOTE` mais adiante — e escolha o
tipo `drive` quando ele listar os provedores disponíveis.

Em algum ponto ele pergunta se pode **abrir um navegador automaticamente para autorizar**
(`Use auto config?`). Responda **`n`** — o VPS não tem navegador, e dizer `y` aqui trava esperando
uma janela que nunca vai abrir.

**O que você deve ver:** o programa imprime um comando para rodar **em outra máquina que tenha
navegador** — a sua.

Instale o `rclone` na sua máquina Windows, se ainda não tiver:

```powershell
winget install Rclone.Rclone
```

Abra um **novo** PowerShell (para o `winget` terminar de ajustar o `PATH`) e rode o comando exato
que o servidor imprimiu. Ele abre o navegador, pede para você entrar com a conta do Drive do
ateliê e autorizar o acesso.

**O que você deve ver:** depois de autorizar no navegador, o terminal da sua máquina imprime um
bloco de texto — a autorização, em formato de token.

> Trate esse texto com o mesmo cuidado da chave SSH do Roteiro 1, que chegou corrompida por
> copiar-e-colar: é **uma linha só**, longa; a quebra visual na tela é normal, mas não aperte
> Enter no meio nem edite o texto à mão. Cole exatamente o que apareceu, sem nenhum caractere a
> mais ou a menos. Se o servidor recusar no próximo passo, refaça o comando na sua máquina em vez
> de tentar consertar o texto.

Volte para a sessão do **servidor**, que ainda está esperando essa colagem, e cole o texto quando
ele pedir. Confirme o nome dado ao destino e finalize o assistente.

Crie a pasta de destino dentro da conta do Drive do ateliê:

```bash
rclone mkdir amassa-backup:amassa
```

**O que você deve ver:** nenhuma saída — sucesso silencioso.

Defina o destino no arquivo de ambiente:

```bash
nano /opt/amassa/.env
```

```env
RCLONE_REMOTE=amassa-backup:amassa/
```

Salve e saia. Confira que a autorização chegou inteira listando o destino a partir do servidor:

```bash
rclone lsd amassa-backup:amassa
```

**O que você deve ver:** ou nenhuma saída (a pasta existe e está vazia — normal, ainda não há
nenhum backup lá) ou nenhum erro. A listagem funcionando — mesmo vazia — é a prova de que a
autorização é válida; um erro de autenticação aqui significa refazer a autorização, nunca editar
nada à mão.

---

## 8. Primeiro backup de verdade

```bash
cd /opt/amassa
./scripts/backup.sh --agora
```

**O que você deve ver:** nenhuma saída — sucesso silencioso. O comando sai com código `0`; confira
com `echo $?` se quiser ter certeza.

Confira, nesta ordem, as quatro provas:

**1. O arquivo apareceu no diretório local:**

```bash
ls -lh /opt/amassa/backups/
```

**O que você deve ver:** um arquivo `amassa-<data>-<hora><minuto>.sql.gz`, com alguns kilobytes.

**2. O arquivo apareceu na conta do Drive:**

```bash
rclone lsl amassa-backup:amassa/
```

**O que você deve ver:** o mesmo arquivo listado, com o mesmo tamanho.

**3. A tabela de execuções ganhou uma linha, com sucesso e cópia externa confirmada:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select quando, sucesso, destino_externo_ok, mensagem from execucoes_backup order by quando desc limit 1;"
```

**O que você deve ver:** uma linha com `sucesso = t`, `destino_externo_ok = t` e `mensagem` vazia
(nula).

**4. A rota de saúde do backup responde `ok`, pelo domínio público:**

```powershell
curl.exe https://amassacerrado.com.br/api/health/backup
```

**O que você deve ver:** um corpo parecido com
`{"status":"ok","motivo":null,"ultimoBackupEm":"...","idadeEmHoras":0...}` — o campo `status` é o
que importa aqui.

---

## 9. Agendar

Confira em que fuso o servidor está — o `cron` roda no fuso do sistema, não no de Brasília:

```bash
timedatectl
```

**O que você deve ver:** uma linha `Time zone:`. VPS novos da Contabo costumam vir em `Etc/UTC`.

Abra o agendamento do usuário `theo`:

```bash
crontab -e
```

Na primeira vez, ele pergunta qual editor usar — escolha `nano` (geralmente a opção `1`, a mais
simples).

Acrescente **uma** das duas linhas abaixo, dependendo do que `timedatectl` mostrou — nunca as
duas:

```cron
# Se o servidor está em UTC (o caso mais comum): 3h15 em Brasília (UTC-3, sem horário de
# verão desde 2019) equivale a 6h15 UTC.
15 6 * * * /opt/amassa/scripts/backup.sh >> /var/log/amassa-backup.log 2>&1
```

```cron
# Se o servidor já está configurado para America/Sao_Paulo:
15 3 * * * /opt/amassa/scripts/backup.sh >> /var/log/amassa-backup.log 2>&1
```

**Por que 3h/6h da manhã:** é o horário de menor uso do ateliê, e dá folga antes do expediente
para qualquer alerta do monitor (passo 10) chegar e ainda dar tempo de agir.

Salve e saia. Confira que a linha entrou:

```bash
crontab -l
```

**O que você deve ver:** a linha exata que você acrescentou, e nenhuma outra relacionada ao
backup.

No dia seguinte, confira se rodou olhando o log:

```bash
cat /var/log/amassa-backup.log
```

**O que você deve ver:** o arquivo existe e está vazio (ou só com quebras de linha) — o script não
imprime nada no sucesso. Qualquer texto de erro aqui significa que algo falhou; a linha mais
recente de `execucoes_backup` (comando do passo 8, item 3) diz o quê.

---

## 10. Vigiar de fora

Ação de painel, no mesmo serviço que o Roteiro 2 já usa (UptimeRobot ou equivalente). Cadastre um
segundo monitor:

- **Tipo:** HTTP(s)
- **URL:** `https://amassacerrado.com.br/api/health/backup`
- **Intervalo de checagem:** 5 minutos
- **Alerta:** por e-mail, para o seu endereço

**O que você deve ver:** o monitor listado com status verde ("Up") logo depois da primeira
checagem.

Um monitor que nunca disparou é um monitor não testado — prove o alerta antes de confiar nele.
Primeiro, guarde o instante da última execução real:

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select quando from execucoes_backup order by quando desc limit 1;"
```

Anote o valor. Agora adiante o relógio da janela, tornando essa mesma linha "velha" sem apagar
nada:

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "update execucoes_backup set quando = now() - interval '27 hours' where quando = (select max(quando) from execucoes_backup);"
```

**O que você deve ver:** `UPDATE 1`.

Confira que a rota já reprova, pelo domínio:

```powershell
curl.exe https://amassacerrado.com.br/api/health/backup
```

**O que você deve ver:** `"status"` diferente de `"ok"`, código HTTP `503`, e um `motivo`
mencionando a idade do backup.

Espere até 5 minutos — o intervalo do monitor — e confira sua caixa de entrada.

**O que você deve ver:** um e-mail de alerta do serviço de monitoramento avisando que o monitor
caiu.

Restaure a linha para não deixar a rota vermelha até o próximo backup real:

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "update execucoes_backup set quando = now() where quando = (select max(quando) from execucoes_backup);"
```

Confira de novo:

```powershell
curl.exe https://amassacerrado.com.br/api/health/backup
```

**O que você deve ver:** `"status":"ok"` de novo.

---

## 11. Conferir o backup de ontem

No dia seguinte ao agendamento (passo 9), confira as quatro coisas juntas — não uma delas
isolada:

```bash
ls -lh /opt/amassa/backups/amassa-$(date +%Y-%m-%d).sql.gz
```

**O que você deve ver:** o arquivo do dia de ontem, com alguns kilobytes.

```bash
rclone lsl amassa-backup:amassa/
```

**O que você deve ver:** o mesmo arquivo de ontem listado no destino externo.

```bash
cat /var/log/amassa-backup.log
```

**O que você deve ver:** vazio, ou só quebras de linha — sem texto de erro.

```powershell
curl.exe https://amassacerrado.com.br/api/health/backup
```

**O que você deve ver:** `"status":"ok"` de novo, com `idadeEmHoras` menor que 26 — é a diferença
entre "rodou uma vez, no passo 8" e "está rodando sozinho".

---

## 12. Ensaio de restauração — a prova que falta

Este passo não é opcional, e é o motivo de todo o resto deste roteiro existir: um backup nunca
restaurado não é um backup, só uma promessa. E ele acontece **antes** de qualquer dado real do
ateliê entrar no sistema — é a regra D-11 da fase, e não há como confirmá-la por inspeção, só
executando de verdade.

**Baixe um dump da conta do Drive**, não o arquivo local — o objetivo é provar a camada externa,
que é a que sobra se o próprio servidor morrer:

```bash
mkdir -p /tmp/ensaio-restauracao
cd /tmp/ensaio-restauracao
rclone lsl amassa-backup:amassa/
```

**O que você deve ver:** a lista de arquivos no destino externo. Anote o nome do mais recente — é
o `<ARQUIVO_MAIS_RECENTE>` usado daqui em diante.

```bash
rclone copy amassa-backup:amassa/<ARQUIVO_MAIS_RECENTE> .
ls -lh /tmp/ensaio-restauracao/
```

**O que você deve ver:** o arquivo baixado, listado com o mesmo tamanho do destino externo.

**Suba um Postgres limpo e temporário**, isolado do banco de produção — nome de banco diferente,
contêiner separado, fora do `compose.yml`:

```bash
docker run -d --name postgres-ensaio \
  -e POSTGRES_USER=amassa_owner \
  -e POSTGRES_PASSWORD=temporaria-so-para-o-ensaio \
  -e POSTGRES_DB=amassa_ensaio \
  postgres:17-alpine
```

**O que você deve ver:** um identificador hexadecimal longo (o ID do contêiner novo).

> Este contêiner é **descartável**. Ele não usa o volume `dados_postgres` da produção, não
> aparece em `docker compose ps` e nada do que acontecer nele toca o banco real — é justamente
> por isso que ele existe: para restaurar de verdade sem nenhum risco.

Espere alguns segundos (o Postgres precisa iniciar) e confirme que está pronto:

```bash
docker exec postgres-ensaio pg_isready -U amassa_owner
```

**O que você deve ver:** `accepting connections`.

Primeiro, **sem** confirmação, só para ver o que o script diria que faria — aponte
`PG_CLIENT_CMD` para o contêiner temporário, não para o de produção:

```bash
PG_CLIENT_CMD="docker exec -i postgres-ensaio psql" /opt/amassa/scripts/restaurar.sh \
  --arquivo /tmp/ensaio-restauracao/<ARQUIVO_MAIS_RECENTE> --banco amassa_ensaio
```

**O que você deve ver:** o aviso de que nada foi alterado, e a mensagem "(o banco 'amassa_ensaio'
não tem nenhuma tabela ainda)" — o Postgres temporário nasceu vazio, como esperado. O comando sai
com código diferente de zero — normal, ele não confirmou nada.

Agora, com a confirmação:

```bash
PG_CLIENT_CMD="docker exec -i postgres-ensaio psql" /opt/amassa/scripts/restaurar.sh \
  --arquivo /tmp/ensaio-restauracao/<ARQUIVO_MAIS_RECENTE> --banco amassa_ensaio --confirmar
```

**O que você deve ver:** a conferência de integridade, a restauração acontecendo, e ao final um
resumo de tabela e contagem de linhas — `usuarios`, `execucoes_backup` e
`verificacao_infraestrutura`, cada uma com um número.

Confira os dados. Primeiro, que as contas de gestor aparecem com os nomes certos — você reconhece
na tela, mas **relate ao orquestrador só a contagem, nunca os nomes**:

```bash
docker exec -i postgres-ensaio psql -U amassa_owner -d amassa_ensaio -c "select nome, email from usuarios;"
```

**O que você deve ver:** uma linha por conta de gestor criada no passo 5, com os nomes e e-mails
certos.

Compare a contagem por tabela com a de produção. O mesmo comando "sem `--confirmar`" do
`restaurar.sh`, apontado desta vez para o banco de produção (sem sobrescrever `PG_CLIENT_CMD`),
mostra as contagens atuais sem alterar nada — reaproveitando a mesma tela de antes:

```bash
/opt/amassa/scripts/restaurar.sh --arquivo /tmp/ensaio-restauracao/<ARQUIVO_MAIS_RECENTE> --banco amassa
```

**O que você deve ver:** as contagens de produção. Elas precisam bater com as do banco temporário,
linha por tabela — essa é a prova que D-11 exige. (A aplicação **não** é apontada para o banco
temporário em nenhum momento; só as contagens são comparadas.)

Derrube e apague tudo o que este ensaio criou:

```bash
docker rm -f -v postgres-ensaio
rm -rf /tmp/ensaio-restauracao
```

**O que você deve ver:** nenhuma saída relevante — o contêiner, seu volume anônimo e o arquivo
baixado desaparecem.

---

## 13. Restauração de verdade — o dia ruim

A versão sem ensaio: o que fazer quando o banco de produção se perdeu de verdade. A ordem importa
— não pule nem inverta nenhum destes seis movimentos.

**1. Pare a aplicação, não o banco:**

```bash
docker compose stop app
```

**O que você deve ver:** o serviço `app` parado; `postgres` e `caddy` continuam rodando
(`docker compose ps` confirma).

**2. Baixe o dump mais recente da conta do Drive:**

```bash
mkdir -p /opt/amassa/restauracao-emergencia
cd /opt/amassa/restauracao-emergencia
rclone lsl amassa-backup:amassa/
rclone copy amassa-backup:amassa/<ARQUIVO_MAIS_RECENTE> .
```

**O que você deve ver:** o arquivo baixado, listado com `ls -lh`.

**3. Confira a integridade do arquivo antes de tocar em qualquer coisa:**

```bash
gzip -t <ARQUIVO_MAIS_RECENTE> && echo "arquivo íntegro"
```

**O que você deve ver:** `arquivo íntegro`. Se vier erro, o arquivo baixado está corrompido —
baixe de novo, ou tente o dump do dia anterior a esse.

**4. Restaure sobre o banco de produção, com a confirmação:**

```bash
/opt/amassa/scripts/restaurar.sh --arquivo /opt/amassa/restauracao-emergencia/<ARQUIVO_MAIS_RECENTE> --banco amassa --confirmar
```

**O que você deve ver:** o aviso do que seria perdido (dessa vez é real — está prestes a
substituir o banco de produção), a restauração acontecendo, e o resumo final de contagens por
tabela.

**5. Suba a aplicação de novo:**

```bash
docker compose start app
```

**O que você deve ver:** o serviço voltando; confira com `docker compose ps app` até aparecer
`Up`.

**6. Entre pela tela de login**, no navegador, com uma conta de gestor.

**O que você deve ver:** o painel abrindo normalmente — a prova final de que a aplicação está de
pé com os dados restaurados.

**Quanto se perde, no pior caso:** até 24 horas — o intervalo entre o último dump e a falha. Isso
foi avaliado e aceito conscientemente (`amassa-plataforma/01-ARQUITETURA.md` §7). Se um dia isso
incomodar, a saída barata é rodar o dump **de hora em hora** em vez de uma vez por dia: uma
segunda linha no `crontab -e` do passo 9, custo zero, derruba a perda máxima de 24h para 1h.

---

## 14. Perguntas que você vai fazer às três da manhã

- **"Onde ficam os arquivos?"** `/opt/amassa/backups/` (últimos 14 dias) e
  `/opt/amassa/backups/mensais/` (todo dia 1º, para sempre).
- **"Quanto tempo cada um é guardado?"** Os diários, 14 dias (rotação automática, passo 5 de
  `backup.sh`). Os mensais, para sempre — a pasta nunca é limpa.
- **"O que é a pasta mensal?"** Uma cópia extra do dump do dia 1º de cada mês, para o caso de um
  problema só ser percebido semanas depois — quando o diário já teria girado.
- **"A rota de saúde do backup ficou vermelha, o que eu faço?"** Rode
  `curl.exe https://amassacerrado.com.br/api/health/backup` para ler o `motivo`. Depois confira
  `execucoes_backup` (comando do passo 8, item 3) e o log do `cron`
  (`cat /var/log/amassa-backup.log`) — juntos, eles dizem o que falhou: o dump, o envio externo,
  ou o backup simplesmente não rodou.
- **"O envio externo parou mas o dump local continua, o que eu faço?"** O dump em disco está
  seguro — `destino_externo_ok = f` na tabela não apaga nada. Confira a autorização do `rclone`
  (`rclone lsd amassa-backup:amassa`, passo 7); se ela expirou, refaça a autorização pela sua
  máquina, com a conta do Drive do ateliê.
- **"Como eu sei qual dump usar?"** O mais recente que passa no teste de integridade (`gzip -t`).
  Prefira sempre o do dia mais próximo da falha — é o passo 2 da seção 13.

---

Isto encerra os roteiros de servidor desta fase. A partir daqui, o backup diário roda sozinho,
vigiado de fora, e este documento é a referência para qualquer dia ruim.

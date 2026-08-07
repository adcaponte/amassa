# Roteiro 2 — DNS, primeira publicação, HTTPS e monitor externo

Continuação do Roteiro 1. Este documento leva o servidor de "pronto" a "site no ar em
`https://amassacerrado.com.br`, banco migrado, monitor externo ativo" — e termina com os dez
critérios de aceite da fase, para você conferir um a um.

**Como ler cada passo:** o mesmo formato do Roteiro 1 — cada comando vem com **o que faz** e
**o que você deve ver**. Os comandos marcados "na sua máquina" rodam no seu computador; os
marcados "no servidor" rodam dentro da sessão SSH como `theo`.

> **Por que `curl.exe` e não `curl` nos comandos da sua máquina.** No Windows PowerShell, `curl`
> é **apelido para `Invoke-WebRequest`** — um comando diferente, que tenta interpretar a página
> como HTML e interrompe pedindo confirmação de segurança. O curl de verdade também está
> instalado, e é chamado por `curl.exe`. Escrever o `.exe` contorna o apelido.
>
> Nos comandos que rodam **no servidor**, é `curl` normal — lá é Linux e não há apelido nenhum.

---

## 1. Apontar o DNS

No painel do seu provedor de domínio, crie dois registros, ambos apontando para o IP do VPS (o
mesmo `<IP_DO_SEU_VPS>` do Roteiro 1):

- Um registro **A** para `amassacerrado.com.br` (o apex — em alguns painéis isso é digitado como
  `@`)
- Um registro **A** (ou `CNAME` para o apex, se seu provedor preferir) para
  `www.amassacerrado.com.br`

Espere alguns minutos e confirme a propagação **antes de seguir para o próximo passo** — o Caddy
só consegue emitir o certificado HTTPS depois que o nome resolve, e tentar antes gasta uma
tentativa no limite do Let's Encrypt (a conta de tentativas malsucedidas é curta).

Na sua máquina, **no PowerShell** (o `dig` não vem instalado no Windows; o `Resolve-DnsName` é
nativo e faz o mesmo):

```powershell
Resolve-DnsName amassacerrado.com.br -Type A | Select-Object Name, IPAddress
Resolve-DnsName www.amassacerrado.com.br | Select-Object Name, IPAddress, NameHost
```

Se estiver num terminal Linux ou macOS, o equivalente é:

```bash
dig +short amassacerrado.com.br
dig +short www.amassacerrado.com.br
```

**O que você deve ver:** os dois comandos devolvem o mesmo endereço IP, e esse endereço é o do
seu VPS (o mesmo que você anotou no Roteiro 1). Se vier vazio ou um IP diferente, aguarde mais e
tente de novo — não siga em frente sem essa confirmação.

> Se o `Resolve-DnsName` devolver um IP antigo mesmo depois de você ter mudado o registro, limpe
> o cache local com `Clear-DnsClientCache` e tente outra vez. O Windows guarda respostas de DNS
> por um tempo, e isso já fez muita gente achar que a propagação não aconteceu.

---

## 2. Primeira subida da pilha completa

> **Antes de rodar isto, a imagem precisa existir no GHCR.** O `compose.yml` do servidor não
> constrói nada — ele **baixa** `ghcr.io/adcaponte/amassa:latest`, que é publicada pelo job
> `imagem` do pipeline. Se o pipeline nunca fechou verde, essa imagem não existe e este passo
> falha com `manifest unknown` ou `pull access denied`, o que parece um problema de permissão e
> não é.
>
> Confira antes, na sua máquina:
>
> ```bash
> docker manifest inspect ghcr.io/adcaponte/amassa:latest
> ```
>
> **O que você deve ver:** um bloco JSON descrevendo a imagem. Se vier `manifest unknown`, pare:
> vá em [github.com/adcaponte/amassa/actions](https://github.com/adcaponte/amassa/actions),
> confirme que a execução mais recente fechou com os jobs `qualidade`, `e2e` e `imagem` em verde,
> e só volte aqui depois disso. Se vier erro de autenticação, o pacote ainda está privado — é o
> passo 10 do Roteiro 1.

> **Isto acontece uma única vez.** É a única vez em todo este projeto que o comando sobe **todos**
> os serviços de uma vez, sem nomear nenhum. Dali em diante — no roteiro, no pipeline, sempre —
> toda publicação nomeia o serviço `app`, porque o comando sem o nome recria todos os contêineres
> declarados, inclusive o do Postgres, e é isso que INFRA-06 proíbe.

No servidor:

```bash
cd /opt/amassa
docker compose up -d
```

**O que faz:** sobe os quatro serviços declarados em `compose.yml` — `postgres`, `app`, `caddy`
e (sob demanda, não neste comando) `ferramentas` — pela primeira vez.

Confira:

```bash
docker compose ps
```

**O que você deve ver:** uma tabela com `postgres`, `app` e `caddy` listados, todos com estado
`Up`. O `postgres` mostra `(healthy)` depois de alguns segundos. O `caddy` aparece com as portas
`0.0.0.0:80->80` e `0.0.0.0:443->443` — é o único serviço com porta publicada. O `ferramentas`
não aparece, e está certo: ele fica atrás de um `profile` e só roda sob demanda.

> **O `app` vai ficar em `health: starting` e depois `unhealthy` — e isso é esperado agora.**
> O `/api/health` consulta a tabela `verificacao_infraestrutura`, que só é criada pela migração
> do passo 3. Antes dela, a rota responde 503 corretamente, dizendo que o banco não está pronto,
> e o `healthcheck` reflete isso.
>
> Se você olhar `docker compose logs app`, vai ver um erro do Postgres mencionando
> `parserOpenTable` — é a mensagem de "tabela não existe". Não é defeito: é a aplicação sendo
> honesta sobre o estado do banco em vez de responder 200 sem consultar nada.
>
> **O `app` só passa a `(healthy)` depois do passo 3.** Confira lá, não aqui.

Confirme também que o Postgres **não** publicou porta nenhuma:

```bash
docker compose ps postgres
```

**O que você deve ver:** na coluna `PORTS`, apenas `5432/tcp` — sem nenhum `0.0.0.0:5432->`. Se
aparecer um mapeamento para o host, pare: o banco está exposto à internet, e isso contraria o
critério INFRA-04. O teste definitivo, feito de fora, é o passo 6.

---

## 3. Aplicar a migração à mão

> **Migração é sempre assim: à mão, depois de um backup, por alguém que está olhando o
> resultado — nunca pelo pipeline automático.** Como esta é a primeira migração deste servidor,
> não há dado de produção para fazer backup antes; a partir da próxima vez que você migrar algo
> (Fase 2 em diante), rode o backup primeiro.

No servidor:

```bash
docker compose run --rm ferramentas npm run db:migrate
```

**O que você deve ver:** a saída termina com a linha `Migrações aplicadas com sucesso.` e o
comando sai com código `0`. É seguro rodar mais de uma vez — o Drizzle pula o que já foi
aplicado.

Confira que a tabela foi criada:

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c '\dt'
```

**O que você deve ver:** uma tabela de uma linha só, com `verificacao_infraestrutura` na coluna
`Name` e `table` na coluna `Type`.

Grave uma linha de prova, que vamos conferir de novo depois do reinício da máquina no passo 7:

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "insert into verificacao_infraestrutura (nota) values ('roteiro-02-linha-de-prova');"
```

**O que você deve ver:** a linha `INSERT 0 1`, confirmando que uma linha foi gravada.

---

## 4. Conferir o HTTPS

No navegador, abra `https://amassacerrado.com.br`.

**O que você deve ver:** a página abre com o cadeado fechado na barra de endereço, sem nenhum
aviso de "conexão não segura" — o Caddy emitiu o certificado sozinho, via Let's Encrypt.

Confira também pela linha de comando, na sua máquina:

```bash
curl.exe -I https://amassacerrado.com.br
```

**O que você deve ver:** a primeira linha da resposta começando com `HTTP/2 200` (ou `HTTP/1.1
200`, dependendo do `curl` da sua máquina) — sem erro de certificado.

Confira o redirecionamento do `www`:

```bash
curl.exe -I https://www.amassacerrado.com.br
```

**O que você deve ver:** um código de redirecionamento (`301` ou `308`) e um cabeçalho
`location:` apontando para `https://amassacerrado.com.br/` — o `www` nunca serve conteúdo
diretamente, só redireciona para o apex.

---

## 5. Conferir `/api/health`

Na sua máquina:

```bash
curl.exe https://amassacerrado.com.br/api/health
```

**O que você deve ver:** exatamente `{"status":"ok","banco":"ok"}` — a aplicação está no ar **e**
conseguiu fazer uma consulta real ao banco (não é só "o servidor respondeu", é "o servidor
respondeu depois de falar com o Postgres").

---

## 6. Confirmar que a porta do banco não está exposta

> **Este é o critério INFRA-04, e ele só vale se for conferido de fora do servidor.** Rodar o
> teste de dentro do próprio VPS não prova nada — de dentro, a porta sempre parece acessível.

Na sua máquina (não no servidor), **no PowerShell** — o `nmap` e o `telnet` não vêm instalados no
Windows, e o `Test-NetConnection` é nativo:

```powershell
Test-NetConnection -ComputerName amassacerrado.com.br -Port 5432 -InformationLevel Detailed
```

**O que você deve ver:** `TcpTestSucceeded : False`. Ele demora alguns segundos antes de
responder — essa demora é o próprio firewall descartando a tentativa em silêncio, e é o
comportamento correto.

Para contraste, confirme que a porta que **deve** estar aberta está:

```powershell
Test-NetConnection -ComputerName amassacerrado.com.br -Port 443
```

**O que você deve ver:** `TcpTestSucceeded : True`. Fazer os dois testes é o que separa "o banco
está protegido" de "o servidor está fora do ar" — sem este segundo teste, um servidor desligado
passaria pelo primeiro critério parecendo seguro.

Num terminal Linux ou macOS, os equivalentes são `nmap -p 5432 amassacerrado.com.br` (deve
mostrar `filtered` ou `closed`, nunca `open`) e `nc -vz amassacerrado.com.br 443`.

---

## 7. Reiniciar o VPS e confirmar que ele volta sozinho

> **Este é o critério INFRA-05.** É o que a política `restart: unless-stopped` do `compose.yml`
> existe para garantir — não é preciso religar nada manualmente.

No servidor:

```bash
sudo reboot
```

**O que você deve ver:** a sessão SSH cai imediatamente (o comando não devolve resposta — é
esperado, a máquina está reiniciando).

Espere cerca de um minuto e confira, na sua máquina:

```bash
curl.exe https://amassacerrado.com.br/api/health
```

**O que você deve ver:** de novo `{"status":"ok","banco":"ok"}`, sem ter rodado nenhum comando
manual no servidor depois do reinício.

Confirme também que a linha de prova gravada no passo 3 sobreviveu. Reconecte por SSH e rode:

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select nota from verificacao_infraestrutura where nota = 'roteiro-02-linha-de-prova';"
```

**O que você deve ver:** a linha `roteiro-02-linha-de-prova` listada — os dados sobreviveram ao
reinício porque vivem no volume nomeado do Postgres, não no contêiner.

---

## 8. Confirmar que uma publicação não recria o Postgres

> **Este é o critério INFRA-06.** A partir de agora, toda publicação nomeia o serviço `app` —
> nunca mais `docker compose up -d` sozinho.

No servidor, anote o identificador do contêiner do Postgres:

```bash
docker compose ps -q postgres
```

**O que você deve ver:** uma sequência de caracteres hexadecimais (o ID do contêiner). Copie ou
anote esse valor.

Rode a publicação nomeando o serviço, exatamente como o pipeline faz:

```bash
docker compose pull app
docker compose up -d app
```

**O que você deve ver:** o `app` sendo baixado/recriado; `postgres` e `caddy` nem aparecem
mencionados — não são tocados.

Confira o identificador de novo:

```bash
docker compose ps -q postgres
```

**O que você deve ver:** o **mesmo** identificador hexadecimal de antes.

> **Uma exceção conhecida: o primeiro comando do Compose depois de um reinício da máquina.**
> Quando o servidor reinicia, os contêineres voltam pela política `restart: unless-stopped`, e
> não pelo Compose. O primeiro `up -d app` seguinte encontra uma divergência entre o que está
> em execução e o que o arquivo declara, e reconcilia — o que pode recriar o Postgres uma vez.
>
> Isso foi observado na execução real deste roteiro, logo após o passo 7. **Os dados não se
> perdem**: eles vivem no volume nomeado `dados_postgres`, que sobrevive à recriação do
> contêiner. Mas o identificador muda, e parece falha do critério.
>
> **Como distinguir de um problema real:** rode a mesma sequência uma segunda vez, sem mudar
> nada. Se o identificador se mantiver, era a reconciliação única e o critério está satisfeito.
> Se mudar de novo, aí sim há algo no `compose.yml` fazendo o serviço ser considerado
> desatualizado a cada execução — pare e investigue antes de seguir.
>
> Se você acabou de reiniciar a máquina no passo 7, considere rodar um `docker compose up -d app`
> antes de começar este passo, só para deixar a reconciliação para trás e medir o comportamento
> em regime.

Depois de qualquer recriação do Postgres, confirme que os dados continuam lá:

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select nota from verificacao_infraestrutura;"
```

**O que você deve ver:** a linha `roteiro-02-linha-de-prova` e `(1 row)`. É a diferença entre
"o contêiner foi recriado" e "os dados se perderam" — duas coisas muito diferentes, e só a
segunda é grave.

---

## 9. Monitor externo (UptimeRobot)

Ação de painel, não comando. Crie uma conta gratuita em `uptimerobot.com` (ou entre na que já
existir) e cadastre um novo monitor:

- **Tipo:** HTTP(s)
- **URL:** `https://amassacerrado.com.br/api/health`
- **Intervalo de checagem:** 5 minutos
- **Alerta:** por e-mail, para o seu endereço

**O que você deve ver:** o monitor listado no painel do UptimeRobot com status verde ("Up") logo
depois da primeira checagem.

Um segundo monitor, para o endpoint `/api/health/backup`, entra no mesmo painel na **Fase 2**,
quando esse endpoint existir — não é escopo deste roteiro.

---

## Critérios de aceite da fase

Confira cada um, um a um. Esta lista é copiada de `.planning/ROADMAP.md` §"Phase 1" — é por ela
que a fase se dá por encerrada.

- [ ] Nenhum arquivo `.env` com valores reais aparece no repositório público (`git log --all --full-history -- .env` não mostra nada)
- [ ] `https://amassacerrado.com.br` abre com cadeado e sem aviso de segurança
- [ ] Alterar um texto, dar `git push` na `main`, e a mudança aparece sozinha em poucos minutos
- [ ] `https://amassacerrado.com.br/api/health` responde `ok` e confirma uma consulta real ao banco
- [ ] A porta 5432 do IP do VPS não aceita conexão de fora (`nmap`/`telnet` não conectam) — o banco não está exposto
- [ ] Reiniciar o VPS traz a aplicação de volta sozinha, com os dados intactos
- [ ] O Auto Backup da Contabo aparece ativo no painel
- [ ] Um deploy não recria o container do Postgres
- [ ] Um deploy com teste quebrado é barrado pelo pipeline e não vai ao ar
- [ ] Migrações podem ser aplicadas à mão no servidor, com um comando, fora do pipeline automático

O item "alterar um texto e dar `git push`" e o item "teste quebrado barra o deploy" só ficam
prontos para conferir depois do plano **01-07**, que é quem faz esse push real e observa o
pipeline de ponta a ponta — os demais nove já podem ser conferidos ao final deste roteiro.
